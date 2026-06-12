const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { verifyFirebaseAuth } = require('./src/firebase-auth-helper');
const { sendManagedSms, sendManagedEmail } = require('./src/messaging-config');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const ALLOWED_CHANNELS = new Set(['site', 'sms', 'email']);
const MAX_RECIPIENTS = 500;

function isDirector(player) {
    return player?.is_director === true || player?.is_admin === true || player?.is_master_admin === true;
}

function senderName(player) {
    return player?.name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || player?.email || 'Director';
}

function cleanPhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function formatPhoneE164(value) {
    const digits = cleanPhone(value);
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return null;
}

function isReservedDemoPhone(value) {
    const digits = cleanPhone(value);
    const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    return national.length === 10 && national.slice(3, 6) === '555' && Number(national.slice(6)) >= 100 && Number(national.slice(6)) <= 199;
}

function cleanEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(value));
}

function isDemoEmail(value) {
    return cleanEmail(value).endsWith('.invalid');
}

function getConversationId(playerId1, playerId2) {
    return [playerId1, playerId2].sort().join('_');
}

function safeText(value, max = 2000) {
    return String(value || '').trim().slice(0, max);
}

function normalizeChannels(channels) {
    return [...new Set((Array.isArray(channels) ? channels : []).filter(channel => ALLOWED_CHANNELS.has(channel)))];
}

function normalizeRecipient(item = {}) {
    return {
        id: safeText(item.id || item.player_id || item.playerId || item.email || item.phone, 160),
        player_id: safeText(item.player_id || item.playerId, 160),
        name: safeText(item.name || item.full_name || item.player_name || 'Unknown', 180),
        email: cleanEmail(item.email),
        phone: safeText(item.phone, 40),
        tags: Array.isArray(item.tags) ? item.tags.map(tag => safeText(tag, 40)).filter(Boolean).slice(0, 12) : []
    };
}

async function writeChunks(items, writer) {
    for (let i = 0; i < items.length; i += 450) {
        const batch = db.batch();
        items.slice(i, i + 450).forEach(item => writer(batch, item));
        await batch.commit();
    }
}

async function sendSiteMessage({ sender, recipient, subject, body, broadcastId, dryRun }) {
    if (!recipient.player_id) {
        return { status: 'skipped', reason: 'missing_player_id' };
    }
    if (recipient.player_id === sender.id) {
        return { status: 'skipped', reason: 'sender_is_recipient' };
    }

    // Resolve the recipient even in dry-run so previews report missing accounts accurately.
    const recipientDoc = await db.collection('players').doc(recipient.player_id).get();
    if (!recipientDoc.exists) return { status: 'skipped', reason: 'player_not_found' };

    // DRY-RUN GUARD: nothing below this line executes on a dry run.
    // No conversation doc, no message doc, no unread-count bump.
    if (dryRun) return { status: 'preview', conversation_id: getConversationId(sender.id, recipient.player_id) };

    const now = FieldValue.serverTimestamp();
    const conversationId = getConversationId(sender.id, recipient.player_id);
    const conversationRef = db.collection('conversations').doc(conversationId);
    const messageRef = conversationRef.collection('messages').doc();
    const senderDisplayName = senderName(sender);
    const recipientData = recipientDoc.data() || {};
    const recipientDisplayName = recipientData.name || `${recipientData.first_name || ''} ${recipientData.last_name || ''}`.trim() || recipient.name;
    const text = subject ? `${subject}\n\n${body}` : body;

    const conversationDoc = await conversationRef.get();
    const batch = db.batch();
    batch.set(messageRef, {
        sender_id: sender.id,
        sender_name: senderDisplayName,
        sender_photo: sender.photo_url || null,
        text,
        timestamp: now,
        read_by: [sender.id],
        type: 'director_broadcast',
        broadcast_id: broadcastId
    });

    const currentUnread = conversationDoc.exists ? (conversationDoc.data().unread_count || {}) : {};
    batch.set(conversationRef, {
        participants: [sender.id, recipient.player_id],
        participant_names: {
            [sender.id]: senderDisplayName,
            [recipient.player_id]: recipientDisplayName
        },
        last_message: {
            text,
            sender_id: sender.id,
            sender_name: senderDisplayName,
            timestamp: now
        },
        unread_count: {
            ...currentUnread,
            [recipient.player_id]: (currentUnread[recipient.player_id] || 0) + 1
        },
        updated_at: now,
        created_at: conversationDoc.exists ? (conversationDoc.data().created_at || now) : now
    }, { merge: true });
    await batch.commit();
    return { status: 'sent', message_id: messageRef.id, conversation_id: conversationId };
}

async function sendSmsMessage({ recipient, body, dryRun }) {
    const to = formatPhoneE164(recipient.phone);
    if (!to) return { status: 'skipped', reason: 'invalid_or_missing_phone' };
    if (isReservedDemoPhone(to)) return { status: 'skipped', reason: 'reserved_demo_phone' };
    if (dryRun) return { status: 'preview', to };
    const result = await sendManagedSms(to, body);
    if (result.success || result.simulated) {
        return { status: result.simulated ? 'simulated' : 'sent', provider: result.source || null, sid: result.sid || null, reason: result.reason || null };
    }
    return { status: 'failed', error: result.error || 'SMS send failed' };
}

async function sendEmailMessage({ recipient, subject, body, dryRun }) {
    if (!isValidEmail(recipient.email)) return { status: 'skipped', reason: 'invalid_or_missing_email' };
    if (isDemoEmail(recipient.email)) return { status: 'skipped', reason: 'demo_email_domain' };
    if (dryRun) return { status: 'preview', to: recipient.email };
    const result = await sendManagedEmail(recipient.email, subject || 'Rookies darts update', body);
    if (result.success || result.simulated) {
        return { status: result.simulated ? 'simulated' : 'sent', provider: result.source || null, reason: result.reason || null };
    }
    return { status: 'failed', error: result.error || 'Email send failed' };
}

exports.sendDirectorBroadcast = functions.runWith({ timeoutSeconds: 540, memory: '512MB' }).https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method === 'OPTIONS') return res.status(204).send('');
        if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST required' });

        try {
            const sender = await verifyFirebaseAuth(req);
            if (!sender || !isDirector(sender)) {
                return res.status(403).json({ success: false, error: 'Director or admin access required' });
            }

            const subject = safeText(req.body?.subject, 120);
            const body = safeText(req.body?.body, 2000);
            const audience = safeText(req.body?.audience || 'custom', 80);
            const channels = normalizeChannels(req.body?.channels);
            const dryRun = req.body?.dry_run === true;
            const requireLiveSend = req.body?.require_live_send === true;
            const recipients = (Array.isArray(req.body?.recipients) ? req.body.recipients : []).map(normalizeRecipient).filter(recipient => recipient.id);

            if (!body) return res.status(400).json({ success: false, error: 'Message body is required' });
            if (!channels.length) return res.status(400).json({ success: false, error: 'At least one channel is required' });
            if (!recipients.length) return res.status(400).json({ success: false, error: 'At least one recipient is required' });
            if (recipients.length > MAX_RECIPIENTS) return res.status(400).json({ success: false, error: `Recipient limit is ${MAX_RECIPIENTS}` });
            if (!dryRun && !requireLiveSend) {
                return res.status(400).json({ success: false, error: 'Live send requires explicit confirmation' });
            }

            const now = FieldValue.serverTimestamp();
            const broadcastRef = db.collection('director_broadcasts').doc();
            const broadcastId = broadcastRef.id;
            const deliveryRows = [];

            await broadcastRef.set({
                tenant_id: req.body?.tenant_id || 'rookies',
                audience,
                channels,
                subject,
                body,
                dry_run: dryRun,
                status: dryRun ? 'preview' : 'processing',
                sender_id: sender.id,
                sender_name: senderName(sender),
                recipient_count: recipients.length,
                created_at: now,
                updated_at: now,
                source: 'contact_center_vnext'
            });

            await writeChunks(recipients, (batch, recipient) => {
                const ref = broadcastRef.collection('deliveries').doc(recipient.id.replace(/[\/#?[\]]/g, '_').slice(0, 120) || undefined);
                batch.set(ref, {
                    recipient,
                    channels: Object.fromEntries(channels.map(channel => [channel, { status: 'queued' }])),
                    created_at: now,
                    updated_at: now
                });
            });

            for (const recipient of recipients) {
                const channelResults = {};
                if (channels.includes('site')) {
                    channelResults.site = await sendSiteMessage({ sender, recipient, subject, body, broadcastId, dryRun });
                }
                if (channels.includes('sms')) {
                    channelResults.sms = await sendSmsMessage({ recipient, body, dryRun });
                }
                if (channels.includes('email')) {
                    channelResults.email = await sendEmailMessage({ recipient, subject, body, dryRun });
                }
                deliveryRows.push({ recipient, channels: channelResults });
            }

            await writeChunks(deliveryRows, (batch, row) => {
                const ref = broadcastRef.collection('deliveries').doc(row.recipient.id.replace(/[\/#?[\]]/g, '_').slice(0, 120) || undefined);
                batch.set(ref, {
                    channels: row.channels,
                    updated_at: now
                }, { merge: true });
            });

            const summary = {
                recipients: recipients.length,
                channels: {}
            };
            channels.forEach(channel => {
                const statuses = deliveryRows.map(row => row.channels[channel]?.status || 'skipped');
                summary.channels[channel] = {
                    sent: statuses.filter(status => status === 'sent' || status === 'simulated').length,
                    preview: statuses.filter(status => status === 'preview').length,
                    skipped: statuses.filter(status => status === 'skipped').length,
                    failed: statuses.filter(status => status === 'failed').length
                };
            });

            const hasFailure = deliveryRows.some(row => Object.values(row.channels).some(result => result.status === 'failed'));
            await broadcastRef.set({
                status: dryRun ? 'preview_complete' : (hasFailure ? 'completed_with_errors' : 'completed'),
                summary,
                completed_at: now,
                updated_at: now
            }, { merge: true });

            return res.json({
                success: true,
                broadcast_id: broadcastId,
                dry_run: dryRun,
                summary,
                deliveries: deliveryRows.map(row => ({
                    recipient: {
                        id: row.recipient.id,
                        player_id: row.recipient.player_id || null,
                        name: row.recipient.name,
                        email: row.recipient.email || null,
                        phone: row.recipient.phone || null
                    },
                    channels: row.channels
                }))
            });
        } catch (error) {
            console.error('[sendDirectorBroadcast] failed:', error);
            return res.status(500).json({ success: false, error: error.message || 'Broadcast failed' });
        }
    });
});

function toIso(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return null;
}

function serializeBroadcast(docSnap) {
    const data = docSnap.data() || {};
    return {
        id: docSnap.id,
        tenant_id: data.tenant_id || null,
        audience: data.audience || 'custom',
        channels: Array.isArray(data.channels) ? data.channels : [],
        subject: data.subject || '',
        body: data.body || '',
        dry_run: data.dry_run === true,
        status: data.status || 'unknown',
        sender_id: data.sender_id || null,
        sender_name: data.sender_name || '',
        recipient_count: data.recipient_count || 0,
        summary: data.summary || null,
        created_at: toIso(data.created_at),
        completed_at: toIso(data.completed_at)
    };
}

// READ-ONLY history endpoints. Broadcast history lives in director_broadcasts/{id}
// (written above with the Admin SDK). Reads are served here behind the same
// director gate instead of opening the collection in firestore.rules.

exports.getDirectorBroadcasts = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method === 'OPTIONS') return res.status(204).send('');
        if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST required' });

        try {
            const sender = await verifyFirebaseAuth(req);
            if (!sender || !isDirector(sender)) {
                return res.status(403).json({ success: false, error: 'Director or admin access required' });
            }

            const limitRaw = Number(req.body?.limit);
            const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 30;
            const tenantId = safeText(req.body?.tenant_id, 80);

            // Single-field orderBy only — no composite index required. Tenant filter is in-memory.
            const snap = await db.collection('director_broadcasts')
                .orderBy('created_at', 'desc')
                .limit(200)
                .get();

            const broadcasts = snap.docs
                .map(serializeBroadcast)
                .filter(item => !tenantId || item.tenant_id === tenantId)
                .slice(0, limit);

            return res.json({ success: true, broadcasts });
        } catch (error) {
            console.error('[getDirectorBroadcasts] failed:', error);
            return res.status(500).json({ success: false, error: error.message || 'Could not load broadcast history' });
        }
    });
});

exports.getDirectorBroadcastDetail = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method === 'OPTIONS') return res.status(204).send('');
        if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST required' });

        try {
            const sender = await verifyFirebaseAuth(req);
            if (!sender || !isDirector(sender)) {
                return res.status(403).json({ success: false, error: 'Director or admin access required' });
            }

            const broadcastId = safeText(req.body?.broadcast_id, 80);
            if (!broadcastId) return res.status(400).json({ success: false, error: 'broadcast_id is required' });

            const broadcastRef = db.collection('director_broadcasts').doc(broadcastId);
            const [broadcastSnap, deliveriesSnap] = await Promise.all([
                broadcastRef.get(),
                broadcastRef.collection('deliveries').limit(MAX_RECIPIENTS).get()
            ]);
            if (!broadcastSnap.exists) return res.status(404).json({ success: false, error: 'Broadcast not found' });

            const deliveries = deliveriesSnap.docs.map(deliveryDoc => {
                const data = deliveryDoc.data() || {};
                return {
                    id: deliveryDoc.id,
                    recipient: data.recipient || {},
                    channels: data.channels || {},
                    updated_at: toIso(data.updated_at)
                };
            }).sort((a, b) => String(a.recipient?.name || '').localeCompare(String(b.recipient?.name || '')));

            return res.json({
                success: true,
                broadcast: serializeBroadcast(broadcastSnap),
                deliveries
            });
        } catch (error) {
            console.error('[getDirectorBroadcastDetail] failed:', error);
            return res.status(500).json({ success: false, error: error.message || 'Could not load broadcast detail' });
        }
    });
});
