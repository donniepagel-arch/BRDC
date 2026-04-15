const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

exports.sendPlayerNotification = functions.https.onCall(async (data, context) => {
    const { player_id, title, body, link, type, data: notifData } = data;

    if (!player_id || !title) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing player_id or title');
    }

    try {
        const tokenDoc = await admin.firestore().collection('fcm_tokens').doc(player_id).get();

        if (!tokenDoc.exists || !tokenDoc.data().token) {
            const playerDoc = await admin.firestore().collection('players').doc(player_id).get();
            if (!playerDoc.exists || !playerDoc.data().fcm_token) {
                return { success: false, reason: 'no_token' };
            }

            const message = {
                token: playerDoc.data().fcm_token,
                notification: { title, body: body || '' },
                data: {
                    title,
                    body: body || '',
                    type: type || 'general',
                    ...(notifData || {}),
                    link: link || ''
                },
                webpush: {
                    notification: {
                        title,
                        body: body || '',
                        icon: '/images/gold_logo.png',
                        badge: '/images/gold_logo.png',
                        vibrate: [200, 100, 200, 100, 200]
                    },
                    fcmOptions: { link: link || '/' }
                }
            };

            await admin.messaging().send(message);
            return { success: true };
        }

        const message = {
            token: tokenDoc.data().token,
            notification: { title, body: body || '' },
            data: {
                title,
                body: body || '',
                type: type || 'general',
                ...(notifData || {}),
                link: link || ''
            },
            webpush: {
                notification: {
                    title,
                    body: body || '',
                    icon: '/images/gold_logo.png',
                    badge: '/images/gold_logo.png',
                    vibrate: [200, 100, 200, 100, 200]
                },
                fcmOptions: { link: link || '/' }
            }
        };

        await admin.messaging().send(message);
        return { success: true };
    } catch (error) {
        console.error('Send notification error:', error);
        return { success: false, reason: error.message };
    }
});
