/**
 * BRDC Mini Tournaments - Phase 5
 * Quick tournaments in scorer, guest names, single-elim brackets
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

const db = admin.firestore();

// Helper: Verify player PIN
async function verifyPlayer(pin) {
    if (!pin) return null;
    const playersSnapshot = await db.collection('players')
        .where('pin', '==', pin)
        .limit(1)
        .get();

    if (playersSnapshot.empty) return null;
    return { id: playersSnapshot.docs[0].id, ...playersSnapshot.docs[0].data() };
}

/**
 * Create a quick mini tournament
 */
exports.createMiniTournament = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                player_pin,
                name,
                game_type,
                game_settings,
                players, // Array of { name, player_id (optional for guests) }
                bracket_type
            } = req.body;

            if (!player_pin || !players || !Array.isArray(players)) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            if (players.length < 2 || players.length > 8) {
                return res.status(400).json({ success: false, error: 'Must have 2-8 players' });
            }

            const creator = await verifyPlayer(player_pin);
            if (!creator) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const creatorName = creator.name || `${creator.first_name} ${creator.last_name}`;

            // Generate tournament PIN
            const tournamentPin = Math.floor(100000 + Math.random() * 900000).toString();

            // Pad players to power of 2 for bracket
            let bracketSize = 2;
            while (bracketSize < players.length) {
                bracketSize *= 2;
            }

            // Shuffle players
            const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

            // Add byes if needed
            while (shuffledPlayers.length < bracketSize) {
                shuffledPlayers.push({ name: 'BYE', is_bye: true });
            }

            // Create first round matches
            const firstRoundMatches = [];
            for (let i = 0; i < shuffledPlayers.length; i += 2) {
                const player1 = shuffledPlayers[i];
                const player2 = shuffledPlayers[i + 1];

                firstRoundMatches.push({
                    match_number: Math.floor(i / 2) + 1,
                    round: 1,
                    player1_name: player1.name,
                    player1_id: player1.player_id || null,
                    player1_is_bye: player1.is_bye || false,
                    player2_name: player2.name,
                    player2_id: player2.player_id || null,
                    player2_is_bye: player2.is_bye || false,
                    status: 'pending',
                    winner_name: null,
                    winner_id: null
                });
            }

            // Auto-advance byes
            firstRoundMatches.forEach(match => {
                if (match.player1_is_bye) {
                    match.status = 'completed';
                    match.winner_name = match.player2_name;
                    match.winner_id = match.player2_id;
                } else if (match.player2_is_bye) {
                    match.status = 'completed';
                    match.winner_name = match.player1_name;
                    match.winner_id = match.player1_id;
                }
            });

            // Calculate total rounds
            const totalRounds = Math.log2(bracketSize);

            // Create tournament document
            const tournamentRef = await db.collection('mini_tournaments').add({
                name: name || `${creatorName}'s Tournament`,
                creator_id: creator.id,
                creator_name: creatorName,
                tournament_pin: tournamentPin,
                game_type: game_type || '501',
                game_settings: game_settings || {
                    starting_score: 501,
                    legs_to_win: 2
                },
                bracket_type: bracket_type || 'single_elimination',
                bracket_size: bracketSize,
                total_rounds: totalRounds,
                current_round: 1,
                players: shuffledPlayers.filter(p => !p.is_bye).map(p => ({
                    name: p.name,
                    player_id: p.player_id || null,
                    is_guest: !p.player_id
                })),
                matches: firstRoundMatches,
                status: 'in_progress',
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Notify BRDC players
            for (const p of players) {
                if (p.player_id && p.player_id !== creator.id) {
                    await db.collection('message_notifications').add({
                        recipient_id: p.player_id,
                        source_type: 'mini_tournament',
                        source_id: tournamentRef.id,
                        message_preview: `You've been added to ${name || 'a mini tournament'}`,
                        sender_name: creatorName,
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                        digest_sent: false,
                        priority: 'high'
                    });
                }
            }

            res.json({
                success: true,
                tournament_id: tournamentRef.id,
                tournament_pin: tournamentPin,
                bracket_size: bracketSize,
                total_rounds: totalRounds,
                matches: firstRoundMatches
            });

        } catch (error) {
            console.error('Error creating mini tournament:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get mini tournament by PIN
 */
exports.getMiniTournament = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { tournament_pin, tournament_id } = req.body;

            if (!tournament_pin && !tournament_id) {
                return res.status(400).json({ success: false, error: 'Missing tournament_pin or tournament_id' });
            }

            let tournamentDoc;

            if (tournament_id) {
                tournamentDoc = await db.collection('mini_tournaments').doc(tournament_id).get();
            } else {
                const snapshot = await db.collection('mini_tournaments')
                    .where('tournament_pin', '==', tournament_pin)
                    .limit(1)
                    .get();

                if (snapshot.empty) {
                    return res.status(404).json({ success: false, error: 'Tournament not found' });
                }
                tournamentDoc = snapshot.docs[0];
            }

            if (!tournamentDoc.exists) {
                return res.status(404).json({ success: false, error: 'Tournament not found' });
            }

            const tournament = {
                id: tournamentDoc.id,
                ...tournamentDoc.data(),
                created_at: tournamentDoc.data().created_at?.toDate()
            };

            res.json({ success: true, tournament });

        } catch (error) {
            console.error('Error getting mini tournament:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Record mini tournament match result
 */
exports.recordMiniTournamentMatch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, tournament_id, match_number, winner_name, winner_id, match_data } = req.body;

            if (!player_pin || !tournament_id || !match_number || !winner_name) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const tournamentDoc = await db.collection('mini_tournaments').doc(tournament_id).get();
            if (!tournamentDoc.exists) {
                return res.status(404).json({ success: false, error: 'Tournament not found' });
            }

            const tournament = tournamentDoc.data();
            const matches = tournament.matches;

            // Find the match
            const matchIndex = matches.findIndex(m =>
                m.match_number === match_number && m.round === tournament.current_round
            );

            if (matchIndex === -1) {
                return res.status(404).json({ success: false, error: 'Match not found' });
            }

            const match = matches[matchIndex];

            if (match.status === 'completed') {
                return res.status(400).json({ success: false, error: 'Match already completed' });
            }

            // Update match result
            matches[matchIndex] = {
                ...match,
                status: 'completed',
                winner_name: winner_name,
                winner_id: winner_id || null,
                match_data: match_data || {},
                completed_at: new Date().toISOString()
            };

            // Check if round is complete
            const currentRoundMatches = matches.filter(m => m.round === tournament.current_round);
            const roundComplete = currentRoundMatches.every(m => m.status === 'completed');

            let tournamentComplete = false;
            let champion = null;

            if (roundComplete) {
                if (tournament.current_round === tournament.total_rounds) {
                    // Tournament complete
                    tournamentComplete = true;
                    champion = winner_name;
                } else {
                    // Create next round matches
                    const winners = currentRoundMatches.map(m => ({
                        name: m.winner_name,
                        player_id: m.winner_id
                    }));

                    const nextRound = tournament.current_round + 1;
                    for (let i = 0; i < winners.length; i += 2) {
                        matches.push({
                            match_number: Math.floor(i / 2) + 1,
                            round: nextRound,
                            player1_name: winners[i].name,
                            player1_id: winners[i].player_id,
                            player1_is_bye: false,
                            player2_name: winners[i + 1]?.name || 'TBD',
                            player2_id: winners[i + 1]?.player_id || null,
                            player2_is_bye: false,
                            status: 'pending',
                            winner_name: null,
                            winner_id: null
                        });
                    }
                }
            }

            const updates = {
                matches: matches
            };

            if (roundComplete && !tournamentComplete) {
                updates.current_round = tournament.current_round + 1;
            }

            if (tournamentComplete) {
                updates.status = 'completed';
                updates.champion_name = champion;
                updates.champion_id = winner_id || null;
                updates.completed_at = admin.firestore.FieldValue.serverTimestamp();

                // Update stats for BRDC players
                if (winner_id) {
                    await db.collection('players').doc(winner_id).update({
                        'stats.mini_tournaments_won': admin.firestore.FieldValue.increment(1)
                    });
                }
            }

            await tournamentDoc.ref.update(updates);

            res.json({
                success: true,
                round_complete: roundComplete,
                tournament_complete: tournamentComplete,
                champion: champion,
                next_round: roundComplete && !tournamentComplete ? tournament.current_round + 1 : null
            });

        } catch (error) {
            console.error('Error recording mini tournament match:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get player's mini tournament history
 */
exports.getMiniTournamentHistory = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, limit: resultLimit } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const playerName = player.name || `${player.first_name} ${player.last_name}`;
            const queryLimit = Math.min(resultLimit || 20, 50);

            // Get tournaments created by player
            const createdSnapshot = await db.collection('mini_tournaments')
                .where('creator_id', '==', player.id)
                .orderBy('created_at', 'desc')
                .limit(queryLimit)
                .get();

            const tournaments = createdSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                created_at: doc.data().created_at?.toDate(),
                completed_at: doc.data().completed_at?.toDate(),
                role: 'creator'
            }));

            res.json({ success: true, tournaments });

        } catch (error) {
            console.error('Error getting mini tournament history:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Search BRDC members for mini tournament
 */
exports.searchPlayersForMiniTournament = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, query: searchQuery } = req.body;

            if (!player_pin || !searchQuery) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const searchLower = searchQuery.toLowerCase();

            // Search players
            const playersSnapshot = await db.collection('players')
                .limit(100)
                .get();

            const matches = playersSnapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    const name = data.name || `${data.first_name} ${data.last_name}`;
                    return name.toLowerCase().includes(searchLower) && doc.id !== player.id;
                })
                .slice(0, 10)
                .map(doc => {
                    const data = doc.data();
                    return {
                        player_id: doc.id,
                        name: data.name || `${data.first_name} ${data.last_name}`,
                        photo_url: data.photo_url
                    };
                });

            res.json({ success: true, players: matches });

        } catch (error) {
            console.error('Error searching players:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Quick bracket from chat command (/bracket 8)
 */
exports.createQuickBracket = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, size, chat_room_id } = req.body;

            if (!player_pin || !size) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            if (size < 2 || size > 8) {
                return res.status(400).json({ success: false, error: 'Size must be 2-8' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const playerName = player.name || `${player.first_name} ${player.last_name}`;

            // Create placeholder players
            const players = [];
            for (let i = 1; i <= size; i++) {
                players.push({ name: `Player ${i}`, player_id: null });
            }

            // Generate tournament PIN
            const tournamentPin = Math.floor(100000 + Math.random() * 900000).toString();

            // Pad to power of 2
            let bracketSize = 2;
            while (bracketSize < size) {
                bracketSize *= 2;
            }

            // Create first round matches
            const firstRoundMatches = [];
            for (let i = 0; i < bracketSize; i += 2) {
                const player1 = players[i] || { name: 'BYE', is_bye: true };
                const player2 = players[i + 1] || { name: 'BYE', is_bye: true };

                const match = {
                    match_number: Math.floor(i / 2) + 1,
                    round: 1,
                    player1_name: player1.name,
                    player1_id: player1.player_id || null,
                    player1_is_bye: player1.is_bye || false,
                    player2_name: player2.name,
                    player2_id: player2.player_id || null,
                    player2_is_bye: player2.is_bye || false,
                    status: 'pending',
                    winner_name: null,
                    winner_id: null
                };

                // Auto-advance byes
                if (match.player1_is_bye && !match.player2_is_bye) {
                    match.status = 'completed';
                    match.winner_name = match.player2_name;
                    match.winner_id = match.player2_id;
                } else if (match.player2_is_bye && !match.player1_is_bye) {
                    match.status = 'completed';
                    match.winner_name = match.player1_name;
                    match.winner_id = match.player1_id;
                }

                firstRoundMatches.push(match);
            }

            const totalRounds = Math.log2(bracketSize);

            const tournamentRef = await db.collection('mini_tournaments').add({
                name: `Quick Bracket (${size} players)`,
                creator_id: player.id,
                creator_name: playerName,
                tournament_pin: tournamentPin,
                game_type: '501',
                game_settings: { starting_score: 501, legs_to_win: 2 },
                bracket_type: 'single_elimination',
                bracket_size: bracketSize,
                total_rounds: totalRounds,
                current_round: 1,
                players: players.filter(p => !p.is_bye),
                matches: firstRoundMatches,
                status: 'setup', // Still needs player names
                is_quick_bracket: true,
                chat_room_id: chat_room_id || null,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                tournament_id: tournamentRef.id,
                tournament_pin: tournamentPin,
                bracket_size: bracketSize,
                message: `Created ${size}-player bracket. PIN: ${tournamentPin}`
            });

        } catch (error) {
            console.error('Error creating quick bracket:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Update player names in quick bracket
 */
exports.updateBracketPlayers = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, tournament_id, players } = req.body;

            if (!player_pin || !tournament_id || !players) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const tournamentDoc = await db.collection('mini_tournaments').doc(tournament_id).get();
            if (!tournamentDoc.exists) {
                return res.status(404).json({ success: false, error: 'Tournament not found' });
            }

            const tournament = tournamentDoc.data();

            // Verify creator
            if (tournament.creator_id !== player.id) {
                return res.status(403).json({ success: false, error: 'Only creator can update' });
            }

            // Update player names in matches
            const updatedMatches = tournament.matches.map(match => {
                const p1Index = parseInt(match.player1_name.replace('Player ', '')) - 1;
                const p2Index = parseInt(match.player2_name.replace('Player ', '')) - 1;

                const newMatch = { ...match };
                if (players[p1Index]) {
                    newMatch.player1_name = players[p1Index].name;
                    newMatch.player1_id = players[p1Index].player_id || null;
                }
                if (players[p2Index]) {
                    newMatch.player2_name = players[p2Index].name;
                    newMatch.player2_id = players[p2Index].player_id || null;
                }

                return newMatch;
            });

            await tournamentDoc.ref.update({
                players: players.filter(p => p.name && p.name !== 'BYE'),
                matches: updatedMatches,
                status: 'in_progress'
            });

            res.json({ success: true, message: 'Players updated' });

        } catch (error) {
            console.error('Error updating bracket players:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
