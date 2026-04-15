const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({
    origin: [
        'https://brdc-v2.web.app',
        'https://brdc-v2.firebaseapp.com',
        'https://burningriverdarts.com',
        'https://www.burningriverdarts.com'
    ]
});
const { verifyFirebaseAuth } = require('./src/firebase-auth-helper');

const db = admin.firestore();

function cleanUndefined(obj) {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) {
        return obj.map(item => cleanUndefined(item)).filter(item => item !== undefined);
    }
    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = cleanUndefined(value);
            }
        }
        return cleaned;
    }
    return obj;
}

async function verifyDirectorPin(req) {
    const player = await verifyFirebaseAuth(req);
    return player ? player.id : null;
}

exports.saveLeagueTemplate = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { template_name, template_data } = req.body;
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            await db.collection('league_templates').add({
                player_id: playerId,
                name: template_name,
                data: cleanUndefined(template_data),
                events_count: template_data?.events?.length || 0,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true, message: 'Template saved' });
        } catch (error) {
            console.error('Error saving league template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.getLeagueTemplates = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const templatesSnapshot = await db.collection('league_templates')
                .where('player_id', '==', playerId)
                .get();

            const templates = templatesSnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name,
                events_count: doc.data().events_count || 0,
                created_at: doc.data().created_at?.toDate?.() || doc.data().created_at || new Date()
            }));

            templates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            res.json({ success: true, templates });
        } catch (error) {
            console.error('Error getting league templates:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.getLeagueTemplate = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { template_id } = req.body;
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const templateDoc = await db.collection('league_templates').doc(template_id).get();
            if (!templateDoc.exists) {
                return res.status(404).json({ success: false, error: 'Template not found' });
            }

            const template = templateDoc.data();
            if (template.player_id !== playerId) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }

            res.json({ success: true, template: { id: templateDoc.id, ...template } });
        } catch (error) {
            console.error('Error getting league template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.deleteLeagueTemplate = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { template_id } = req.body;
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const templateDoc = await db.collection('league_templates').doc(template_id).get();
            if (!templateDoc.exists) {
                return res.status(404).json({ success: false, error: 'Template not found' });
            }

            if (templateDoc.data().player_id !== playerId) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }

            await db.collection('league_templates').doc(template_id).delete();
            res.json({ success: true, message: 'Template deleted' });
        } catch (error) {
            console.error('Error deleting league template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.saveLeagueDraft = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { draft_data } = req.body;
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const existingDrafts = await db.collection('league_drafts')
                .where('player_id', '==', playerId)
                .limit(1)
                .get();

            if (!existingDrafts.empty) {
                await db.collection('league_drafts').doc(existingDrafts.docs[0].id).update({
                    data: cleanUndefined(draft_data),
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await db.collection('league_drafts').add({
                    player_id: playerId,
                    data: cleanUndefined(draft_data),
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            res.json({ success: true, message: 'Draft saved' });
        } catch (error) {
            console.error('Error saving league draft:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.getLeagueDraft = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const draftsSnapshot = await db.collection('league_drafts')
                .where('player_id', '==', playerId)
                .limit(1)
                .get();

            if (draftsSnapshot.empty) {
                return res.json({ success: true, draft: null });
            }

            const draftDoc = draftsSnapshot.docs[0];
            res.json({
                success: true,
                draft: {
                    id: draftDoc.id,
                    ...draftDoc.data(),
                    updated_at: draftDoc.data().updated_at?.toDate?.()?.toISOString() || null
                }
            });
        } catch (error) {
            console.error('Error getting league draft:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.deleteLeagueDraft = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const draftsSnapshot = await db.collection('league_drafts')
                .where('player_id', '==', playerId)
                .limit(1)
                .get();

            if (!draftsSnapshot.empty) {
                await db.collection('league_drafts').doc(draftsSnapshot.docs[0].id).delete();
            }

            res.json({ success: true, message: 'Draft deleted' });
        } catch (error) {
            console.error('Error deleting league draft:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.saveTournamentTemplate = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { template_name, template_data } = req.body;
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            await db.collection('tournament_templates').add({
                player_id: playerId,
                name: template_name,
                data: cleanUndefined(template_data),
                events_count: template_data?.events?.length || 0,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true, message: 'Template saved' });
        } catch (error) {
            console.error('Error saving tournament template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.getTournamentTemplates = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const templatesSnapshot = await db.collection('tournament_templates')
                .where('player_id', '==', playerId)
                .get();

            const templates = templatesSnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name,
                events_count: doc.data().events_count || 0,
                created_at: doc.data().created_at?.toDate?.() || doc.data().created_at || new Date()
            }));

            templates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            res.json({ success: true, templates });
        } catch (error) {
            console.error('Error getting tournament templates:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.getTournamentTemplate = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { template_id } = req.body;
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const templateDoc = await db.collection('tournament_templates').doc(template_id).get();
            if (!templateDoc.exists) {
                return res.status(404).json({ success: false, error: 'Template not found' });
            }

            const template = templateDoc.data();
            if (template.player_id !== playerId) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }

            res.json({ success: true, template: { id: templateDoc.id, ...template } });
        } catch (error) {
            console.error('Error getting tournament template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.deleteTournamentTemplate = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { template_id } = req.body;
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const templateDoc = await db.collection('tournament_templates').doc(template_id).get();
            if (!templateDoc.exists) {
                return res.status(404).json({ success: false, error: 'Template not found' });
            }

            if (templateDoc.data().player_id !== playerId) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }

            await db.collection('tournament_templates').doc(template_id).delete();
            res.json({ success: true, message: 'Template deleted' });
        } catch (error) {
            console.error('Error deleting tournament template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.saveTournamentDraft = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { draft_data } = req.body;
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const existingDrafts = await db.collection('tournament_drafts')
                .where('player_id', '==', playerId)
                .limit(1)
                .get();

            if (!existingDrafts.empty) {
                await db.collection('tournament_drafts').doc(existingDrafts.docs[0].id).update({
                    data: cleanUndefined(draft_data),
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await db.collection('tournament_drafts').add({
                    player_id: playerId,
                    data: cleanUndefined(draft_data),
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            res.json({ success: true, message: 'Draft saved' });
        } catch (error) {
            console.error('Error saving tournament draft:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.getTournamentDraft = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const draftsSnapshot = await db.collection('tournament_drafts')
                .where('player_id', '==', playerId)
                .limit(1)
                .get();

            if (draftsSnapshot.empty) {
                return res.json({ success: true, draft: null });
            }

            const draftDoc = draftsSnapshot.docs[0];
            res.json({
                success: true,
                draft: {
                    id: draftDoc.id,
                    ...draftDoc.data(),
                    updated_at: draftDoc.data().updated_at?.toDate?.()?.toISOString() || null
                }
            });
        } catch (error) {
            console.error('Error getting tournament draft:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.deleteTournamentDraft = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const playerId = await verifyDirectorPin(req);
            if (!playerId) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const draftsSnapshot = await db.collection('tournament_drafts')
                .where('player_id', '==', playerId)
                .limit(1)
                .get();

            if (!draftsSnapshot.empty) {
                await db.collection('tournament_drafts').doc(draftsSnapshot.docs[0].id).delete();
            }

            res.json({ success: true, message: 'Draft deleted' });
        } catch (error) {
            console.error('Error deleting tournament draft:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
