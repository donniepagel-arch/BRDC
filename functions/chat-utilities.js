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

exports.createGroupChatRoom = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        try {
            const { player_pin, name, participant_ids } = req.body;

            if (!player_pin || !name || !participant_ids || !participant_ids.length) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const playerQuery = await admin.firestore()
                .collection('players')
                .where('pin', '==', player_pin)
                .limit(1)
                .get();

            if (playerQuery.empty) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const creatorDoc = playerQuery.docs[0];
            const creatorId = creatorDoc.id;
            const creatorName = creatorDoc.data().name || 'Unknown';
            const allParticipants = [...new Set([creatorId, ...participant_ids])];

            const roomRef = admin.firestore().collection('chat_rooms').doc();
            await roomRef.set({
                name: name.trim(),
                type: 'group',
                participants: allParticipants,
                created_by: creatorId,
                created_by_name: creatorName,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                last_message: null,
                unread_counts: {}
            });

            return res.json({
                success: true,
                room_id: roomRef.id,
                name: name.trim()
            });
        } catch (error) {
            console.error('createGroupChatRoom error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });
});
