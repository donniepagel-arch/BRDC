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

const db = admin.firestore();

exports.bulkCheckIn = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { tournamentId, playerIds, players } = req.body;

            const tournamentRef = db.collection('tournaments').doc(tournamentId);
            const tournamentDoc = await tournamentRef.get();

            if (!tournamentDoc.exists) {
                return res.status(404).json({ error: 'Tournament not found' });
            }

            const updates = {};

            if (players && Array.isArray(players)) {
                players.forEach(player => {
                    updates[`players.${player.id}`] = {
                        name: player.name || player.id,
                        checkedIn: true,
                        checkInTime: admin.firestore.FieldValue.serverTimestamp(),
                        paid: player.paid || false
                    };
                });
            } else if (playerIds && Array.isArray(playerIds)) {
                playerIds.forEach(playerId => {
                    updates[`players.${playerId}`] = {
                        name: playerId,
                        checkedIn: true,
                        checkInTime: admin.firestore.FieldValue.serverTimestamp(),
                        paid: false
                    };
                });
            }

            await tournamentRef.update(updates);

            const count = players?.length || playerIds?.length || 0;
            res.json({
                success: true,
                message: `${count} players checked in successfully`,
                checkedInCount: count
            });
        } catch (error) {
            console.error('Error bulk checking in players:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

exports.addWalkIn = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { tournamentId, playerName, playerEmail, playerPhone } = req.body;

            const tournamentRef = db.collection('tournaments').doc(tournamentId);
            const tournamentDoc = await tournamentRef.get();

            if (!tournamentDoc.exists) {
                return res.status(404).json({ error: 'Tournament not found' });
            }

            const playerId = `walkin_${Date.now()}`;

            await tournamentRef.update({
                [`players.${playerId}`]: {
                    name: playerName,
                    email: playerEmail || null,
                    phone: playerPhone || null,
                    registrationTime: admin.firestore.FieldValue.serverTimestamp(),
                    checkedIn: true,
                    checkInTime: admin.firestore.FieldValue.serverTimestamp(),
                    isWalkIn: true,
                    paid: false
                }
            });

            res.json({
                success: true,
                message: 'Walk-in player added successfully',
                playerId
            });
        } catch (error) {
            console.error('Error adding walk-in player:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

exports.getTournamentSummary = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { tournamentId } = req.query;

            const tournamentRef = db.collection('tournaments').doc(tournamentId);
            const tournamentDoc = await tournamentRef.get();

            if (!tournamentDoc.exists) {
                return res.status(404).json({ error: 'Tournament not found' });
            }

            const tournament = tournamentDoc.data();
            const players = tournament.players || {};

            const totalPlayers = Object.keys(players).length;
            const checkedInPlayers = Object.values(players).filter(p => p.checkedIn).length;
            const walkIns = Object.values(players).filter(p => p.isWalkIn).length;
            const paidPlayers = Object.values(players).filter(p => p.paid).length;

            res.json({
                tournamentName: tournament.tournament_name,
                tournamentDate: tournament.tournament_date,
                format: tournament.format,
                totalPlayers,
                checkedInPlayers,
                walkIns,
                paidPlayers,
                pendingPayments: totalPlayers - paidPlayers,
                bracketGenerated: !!tournament.bracket,
                tournamentStarted: tournament.started || false,
                tournamentCompleted: tournament.completed || false
            });
        } catch (error) {
            console.error('Error getting tournament summary:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

exports.undoCheckIn = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { tournamentId, playerId } = req.body;

            const tournamentRef = db.collection('tournaments').doc(tournamentId);
            const tournamentDoc = await tournamentRef.get();

            if (!tournamentDoc.exists) {
                return res.status(404).json({ error: 'Tournament not found' });
            }

            await tournamentRef.update({
                [`players.${playerId}.checkedIn`]: false,
                [`players.${playerId}.checkInTime`]: admin.firestore.FieldValue.delete()
            });

            res.json({ success: true, message: 'Check-in undone successfully' });
        } catch (error) {
            console.error('Error undoing check-in:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

exports.addEventToTournament = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                tournament_id,
                event_name,
                format,
                bracket_type,
                max_players,
                entry_fee,
                event_details
            } = req.body;

            if (!tournament_id || !event_name || !format || !bracket_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: tournament_id, event_name, format, bracket_type'
                });
            }

            const tournamentRef = db.collection('tournaments').doc(tournament_id);
            const tournamentDoc = await tournamentRef.get();

            if (!tournamentDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Tournament not found'
                });
            }

            const eventRef = await db
                .collection('tournaments')
                .doc(tournament_id)
                .collection('events')
                .add({
                    event_name,
                    format,
                    bracket_type,
                    max_players: max_players || 32,
                    entry_fee: entry_fee || 0,
                    event_details: event_details || '',
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    status: 'registration_open',
                    current_registrations: 0,
                    bracket_generated: false
                });

            await tournamentRef.update({
                event_count: admin.firestore.FieldValue.increment(1)
            });

            console.log('Event added successfully:', eventRef.id);

            return res.json({
                success: true,
                event_id: eventRef.id,
                message: 'Event added successfully'
            });
        } catch (error) {
            console.error('Error adding event:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
});
