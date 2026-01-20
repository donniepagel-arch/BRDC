/**
 * BRDC Message Digest System
 * Sends SMS digests for unread messages to offline players
 */

const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// Twilio configuration (from environment)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    try {
        twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        console.log('Twilio client initialized for message digest');
    } catch (e) {
        console.log('Twilio not available for message digest');
    }
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(to, body) {
    // Clean phone number
    let cleanPhone = to.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
        cleanPhone = '1' + cleanPhone;
    }
    if (!cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone;
    }

    if (!twilioClient) {
        console.log('SMS (simulated):', { to: cleanPhone, body });
        return { success: true, simulated: true };
    }

    try {
        const message = await twilioClient.messages.create({
            body: body,
            to: cleanPhone,
            from: TWILIO_PHONE_NUMBER
        });
        console.log('SMS sent:', message.sid);
        return { success: true, sid: message.sid };
    } catch (error) {
        console.error('SMS error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Daily Message Digest - Runs at 8 AM ET
 * Sends SMS summary of unread messages to players with daily digest enabled
 */
exports.dailyMessageDigest = onSchedule('0 8 * * *', async (event) => {
        console.log('Running daily message digest...');

        try {
            // Get all unsent notifications
            const notificationsSnapshot = await db.collection('message_notifications')
                .where('digest_sent', '==', false)
                .get();

            if (notificationsSnapshot.empty) {
                console.log('No pending notifications');
                return null;
            }

            // Group notifications by recipient
            const byRecipient = {};
            notificationsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const recipientId = data.recipient_id;

                if (!byRecipient[recipientId]) {
                    byRecipient[recipientId] = {
                        phone: data.recipient_phone,
                        notifications: [],
                        docIds: []
                    };
                }

                byRecipient[recipientId].notifications.push(data);
                byRecipient[recipientId].docIds.push(doc.id);
            });

            console.log(`Processing digests for ${Object.keys(byRecipient).length} recipients`);

            // Process each recipient
            for (const [recipientId, recipientData] of Object.entries(byRecipient)) {
                // Get player preferences
                const playerDoc = await db.collection('players').doc(recipientId).get();
                if (!playerDoc.exists) continue;

                const player = playerDoc.data();
                const prefs = player.messaging_preferences || {};

                // Check if they want daily digest
                if (prefs.digest_frequency !== 'daily' || !prefs.sms_enabled) {
                    // Mark as sent anyway to clear the queue
                    const batch = db.batch();
                    recipientData.docIds.forEach(docId => {
                        batch.update(db.collection('message_notifications').doc(docId), {
                            digest_sent: true,
                            digest_sent_at: admin.firestore.FieldValue.serverTimestamp(),
                            skipped_reason: 'digest_disabled'
                        });
                    });
                    await batch.commit();
                    continue;
                }

                // Check if they have a phone
                const phone = recipientData.phone || player.phone;
                if (!phone) {
                    console.log(`No phone for player ${recipientId}`);
                    continue;
                }

                // Build digest message
                const notifications = recipientData.notifications;
                const dmCount = notifications.filter(n => n.source_type === 'dm').length;
                const chatCount = notifications.filter(n => n.source_type !== 'dm').length;

                // Group DMs by sender
                const dmBySender = {};
                notifications.filter(n => n.source_type === 'dm').forEach(n => {
                    if (!dmBySender[n.sender_name]) dmBySender[n.sender_name] = 0;
                    dmBySender[n.sender_name]++;
                });

                // Group chats by room
                const chatByRoom = {};
                notifications.filter(n => n.source_type !== 'dm').forEach(n => {
                    if (!chatByRoom[n.source_name]) chatByRoom[n.source_name] = 0;
                    chatByRoom[n.source_name]++;
                });

                // Build message
                let message = `BRDC Messages (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}):\n`;

                if (dmCount > 0) {
                    Object.entries(dmBySender).forEach(([sender, count]) => {
                        message += `- ${count} from ${sender}\n`;
                    });
                }

                if (chatCount > 0) {
                    Object.entries(chatByRoom).forEach(([room, count]) => {
                        message += `- ${room}: ${count} new\n`;
                    });
                }

                message += `\nView: brdc-v2.web.app/pages/messages.html`;

                // Send SMS
                const result = await sendSMS(phone, message);

                // Mark notifications as sent
                const batch = db.batch();
                recipientData.docIds.forEach(docId => {
                    batch.update(db.collection('message_notifications').doc(docId), {
                        digest_sent: true,
                        digest_sent_at: admin.firestore.FieldValue.serverTimestamp(),
                        sms_sent: result.success,
                        sms_error: result.error || null
                    });
                });
                await batch.commit();

                console.log(`Sent digest to ${recipientId}: ${dmCount} DMs, ${chatCount} chat messages`);
            }

            console.log('Daily message digest complete');
            return null;

        } catch (error) {
            console.error('Error in daily message digest:', error);
            return null;
        }
    });

/**
 * Weekly Message Digest - Runs Monday at 10 AM ET
 * Sends weekly summary to players with weekly digest enabled
 */
exports.weeklyMessageDigest = onSchedule('0 10 * * 1', async (event) => {
        console.log('Running weekly message digest...');

        try {
            // Get notifications from the past week
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const notificationsSnapshot = await db.collection('message_notifications')
                .where('digest_sent', '==', false)
                .where('created_at', '>=', oneWeekAgo)
                .get();

            if (notificationsSnapshot.empty) {
                console.log('No pending weekly notifications');
                return null;
            }

            // Group by recipient
            const byRecipient = {};
            notificationsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const recipientId = data.recipient_id;

                if (!byRecipient[recipientId]) {
                    byRecipient[recipientId] = {
                        phone: data.recipient_phone,
                        notifications: [],
                        docIds: []
                    };
                }

                byRecipient[recipientId].notifications.push(data);
                byRecipient[recipientId].docIds.push(doc.id);
            });

            // Process each recipient
            for (const [recipientId, recipientData] of Object.entries(byRecipient)) {
                const playerDoc = await db.collection('players').doc(recipientId).get();
                if (!playerDoc.exists) continue;

                const player = playerDoc.data();
                const prefs = player.messaging_preferences || {};

                // Check if they want weekly digest
                if (prefs.digest_frequency !== 'weekly' || !prefs.sms_enabled) {
                    const batch = db.batch();
                    recipientData.docIds.forEach(docId => {
                        batch.update(db.collection('message_notifications').doc(docId), {
                            digest_sent: true,
                            digest_sent_at: admin.firestore.FieldValue.serverTimestamp(),
                            skipped_reason: 'weekly_digest_disabled'
                        });
                    });
                    await batch.commit();
                    continue;
                }

                const phone = recipientData.phone || player.phone;
                if (!phone) continue;

                // Build weekly summary
                const notifications = recipientData.notifications;
                const totalCount = notifications.length;
                const dmCount = notifications.filter(n => n.source_type === 'dm').length;
                const chatCount = totalCount - dmCount;

                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                const dateRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                let message = `BRDC Weekly (${dateRange}):\n`;
                message += `${totalCount} unread messages\n`;
                if (dmCount > 0) message += `- ${dmCount} direct messages\n`;
                if (chatCount > 0) message += `- ${chatCount} chat room messages\n`;
                message += `\nView: brdc-v2.web.app/pages/messages.html`;

                const result = await sendSMS(phone, message);

                // Mark as sent
                const batch = db.batch();
                recipientData.docIds.forEach(docId => {
                    batch.update(db.collection('message_notifications').doc(docId), {
                        digest_sent: true,
                        digest_sent_at: admin.firestore.FieldValue.serverTimestamp(),
                        sms_sent: result.success
                    });
                });
                await batch.commit();

                console.log(`Sent weekly digest to ${recipientId}: ${totalCount} messages`);
            }

            console.log('Weekly message digest complete');
            return null;

        } catch (error) {
            console.error('Error in weekly message digest:', error);
            return null;
        }
    });

/**
 * Immediate High-Priority Notification
 * For match day messages and urgent communications
 * Called directly when a high-priority notification is queued
 */
exports.processHighPriorityNotifications = onSchedule('*/5 * * * *', async (event) => {
        try {
            // Get high-priority unsent notifications
            const highPrioritySnapshot = await db.collection('message_notifications')
                .where('digest_sent', '==', false)
                .where('priority', '==', 'high')
                .limit(50)
                .get();

            if (highPrioritySnapshot.empty) return null;

            for (const doc of highPrioritySnapshot.docs) {
                const notification = doc.data();

                // Get player preferences
                const playerDoc = await db.collection('players').doc(notification.recipient_id).get();
                if (!playerDoc.exists) continue;

                const player = playerDoc.data();
                const prefs = player.messaging_preferences || {};

                // Check if immediate notifications are enabled
                if (prefs.dm_notifications === 'none' && prefs.chat_notifications === 'none') {
                    await doc.ref.update({
                        digest_sent: true,
                        skipped_reason: 'notifications_disabled'
                    });
                    continue;
                }

                const phone = notification.recipient_phone || player.phone;
                if (!phone) {
                    await doc.ref.update({
                        digest_sent: true,
                        skipped_reason: 'no_phone'
                    });
                    continue;
                }

                // Check quiet hours
                const now = new Date();
                const hour = now.getHours();
                if (hour >= 22 || hour < 8) {
                    // In quiet hours, skip immediate notification
                    continue;
                }

                // Build message
                let message = `BRDC: `;
                if (notification.source_type === 'dm') {
                    message += `New message from ${notification.sender_name}: "${notification.message_preview}..."`;
                } else {
                    message += `New in ${notification.source_name} from ${notification.sender_name}: "${notification.message_preview}..."`;
                }

                const result = await sendSMS(phone, message);

                await doc.ref.update({
                    digest_sent: true,
                    digest_sent_at: admin.firestore.FieldValue.serverTimestamp(),
                    sms_sent: result.success,
                    immediate: true
                });

                console.log(`Sent high-priority notification to ${notification.recipient_id}`);
            }

            return null;

        } catch (error) {
            console.error('Error processing high-priority notifications:', error);
            return null;
        }
    });

/**
 * Cleanup old notifications (older than 30 days)
 * Runs weekly on Sundays at 3 AM
 */
exports.cleanupOldNotifications = onSchedule('0 3 * * 0', async (event) => {
        console.log('Cleaning up old message notifications...');

        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const oldNotificationsSnapshot = await db.collection('message_notifications')
                .where('created_at', '<', thirtyDaysAgo)
                .limit(500)
                .get();

            if (oldNotificationsSnapshot.empty) {
                console.log('No old notifications to clean up');
                return null;
            }

            const batch = db.batch();
            oldNotificationsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log(`Deleted ${oldNotificationsSnapshot.size} old notifications`);

            return null;

        } catch (error) {
            console.error('Error cleaning up notifications:', error);
            return null;
        }
    });
