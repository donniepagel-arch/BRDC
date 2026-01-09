/**
 * BRDC Phase 3 & 4 Cloud Functions
 * Payouts + Round Robin + Swiss + Board Management
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

// ============================================================================
// PHASE 3A: PAYOUT CALCULATIONS
// ============================================================================

/**
 * Payout presets for common distributions
 */
const PAYOUT_PRESETS = {
    'winner_take_all': {
        name: 'Winner Take All',
        splits: [100, 0, 0, 0, 0, 0, 0, 0]
    },
    '60_40': {
        name: '60/40',
        splits: [60, 40, 0, 0, 0, 0, 0, 0]
    },
    '50_30_20': {
        name: '50/30/20',
        splits: [50, 30, 20, 0, 0, 0, 0, 0]
    },
    '40_30_20_10': {
        name: '40/30/20/10',
        splits: [40, 30, 20, 10, 0, 0, 0, 0]
    },
    '30_25_20_15_10': {
        name: '30/25/20/15/10',
        splits: [30, 25, 20, 15, 10, 0, 0, 0]
    },
    '25_20_15_12_10_8_6_4': {
        name: '25/20/15/12/10/8/6/4',
        splits: [25, 20, 15, 12, 10, 8, 6, 4]
    }
};

/**
 * Calculate event payouts
 */
exports.calculatePayouts = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id } = req.body;
        
        // Get event
        const eventDoc = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id)
            .get();
        
        if (!eventDoc.exists) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }
        
        const event = eventDoc.data();
        
        // Get players
        const playersSnapshot = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('players')
            .where('events', 'array-contains', event_id)
            .get();
        
        const totalPlayers = playersSnapshot.size;
        const paidPlayers = playersSnapshot.docs.filter(doc => doc.data().paid === true).length;
        const unpaidPlayers = totalPlayers - paidPlayers;
        
        // Calculate payout structure
        const entryFee = event.entry_fee || 0;
        const grossPot = totalPlayers * entryFee;
        
        // House fee
        const houseFeePercent = event.house_fee_pct || 0;
        const houseFee = grossPot * (houseFeePercent / 100);
        
        // Net pot
        const netPot = grossPot - houseFee;
        
        // Payout pool (usually 100% but can be less if saving for future events)
        const payoutPercent = event.payout_percent || 100;
        const payoutPool = netPot * (payoutPercent / 100);
        
        // Calculate each place
        const places = [];
        const payoutFields = [
            'payout_1st_pct', 'payout_2nd_pct', 'payout_3rd_pct', 'payout_4th_pct',
            'payout_5th_pct', 'payout_6th_pct', 'payout_7th_pct', 'payout_8th_pct'
        ];
        
        let totalPct = 0;
        payoutFields.forEach((field, index) => {
            const pct = event[field] || 0;
            if (pct > 0) {
                places.push({
                    place: index + 1,
                    percent: pct,
                    amount: payoutPool * (pct / 100)
                });
                totalPct += pct;
            }
        });
        
        const outstanding = unpaidPlayers * entryFee;
        const collected = grossPot - outstanding;
        
        res.json({
            success: true,
            event_name: event.event_name,
            registered_entries: totalPlayers,
            paid_entries: paidPlayers,
            unpaid_entries: unpaidPlayers,
            entry_fee: entryFee,
            gross_pot: grossPot,
            house_fee_pct: houseFeePercent,
            house_fee: houseFee,
            net_pot: netPot,
            payout_percent: payoutPercent,
            payout_pool: payoutPool,
            places: places,
            total_payout_pct: totalPct,
            payout_valid: totalPct === 100,
            outstanding: outstanding,
            collected: collected
        });
        
    } catch (error) {
        console.error('Error calculating payouts:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Apply payout preset
 */
exports.applyPayoutPreset = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id, preset_name } = req.body;
        
        const preset = PAYOUT_PRESETS[preset_name];
        if (!preset) {
            return res.status(400).json({ success: false, error: 'Invalid preset' });
        }
        
        // Update event with preset
        await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id)
            .update({
                payout_structure_name: preset_name,
                payout_1st_pct: preset.splits[0],
                payout_2nd_pct: preset.splits[1],
                payout_3rd_pct: preset.splits[2],
                payout_4th_pct: preset.splits[3],
                payout_5th_pct: preset.splits[4],
                payout_6th_pct: preset.splits[5],
                payout_7th_pct: preset.splits[6],
                payout_8th_pct: preset.splits[7]
            });
        
        res.json({
            success: true,
            message: `Applied ${preset.name} payout structure`
        });
        
    } catch (error) {
        console.error('Error applying preset:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get payout presets
 */
exports.getPayoutPresets = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    res.json({
        success: true,
        presets: PAYOUT_PRESETS
    });
});

// ============================================================================
// PHASE 3B: ROUND ROBIN BRACKETS
// ============================================================================

/**
 * Generate Round Robin bracket
 */
exports.generateRoundRobinBracket = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id, num_groups } = req.body;
        
        // Get event
        const eventDoc = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id)
            .get();
        
        if (!eventDoc.exists) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }
        
        const event = eventDoc.data();
        
        // Get checked-in players
        const playersSnapshot = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('players')
            .where('checked_in', '==', true)
            .where('events', 'array-contains', event_id)
            .get();
        
        const players = [];
        playersSnapshot.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
        
        if (players.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 players' });
        }
        
        // Shuffle for random seeding
        const shuffled = players.sort(() => Math.random() - 0.5);
        
        const allMatches = [];
        
        if (num_groups && num_groups > 1) {
            // Multi-group round robin
            const groups = divideIntoGroups(shuffled, num_groups);
            
            groups.forEach((group, groupIndex) => {
                const groupName = String.fromCharCode(65 + groupIndex); // A, B, C...
                const groupMatches = generateSingleRoundRobinMatches(
                    tournament_id, event_id, group, groupName, event
                );
                allMatches.push(...groupMatches);
            });
        } else {
            // Single group round robin
            const matches = generateSingleRoundRobinMatches(
                tournament_id, event_id, shuffled, null, event
            );
            allMatches.push(...matches);
        }
        
        // Save matches
        const batch = admin.firestore().batch();
        allMatches.forEach(match => {
            const matchRef = admin.firestore().collection('matches').doc();
            batch.set(matchRef, match);
        });
        await batch.commit();
        
        res.json({
            success: true,
            matches_created: allMatches.length,
            message: 'Round robin bracket generated'
        });
        
    } catch (error) {
        console.error('Error generating round robin:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

function generateSingleRoundRobinMatches(tournament_id, event_id, participants, groupName, event) {
    const matches = [];
    let players = [...participants];
    
    // Add bye if odd number
    if (players.length % 2 !== 0) {
        players.push({ isBye: true });
    }
    
    const totalPlayers = players.length;
    const rounds = totalPlayers - 1;
    const matchesPerRound = totalPlayers / 2;
    
    // Circle method for round robin scheduling
    for (let round = 1; round <= rounds; round++) {
        for (let match = 0; match < matchesPerRound; match++) {
            let home, away;
            
            if (match === 0) {
                home = 0; // First player stays fixed
                away = round;
            } else {
                home = round - match;
                away = round + match;
                
                if (home < 0) home += totalPlayers - 1;
                if (away >= totalPlayers) away -= totalPlayers - 1;
            }
            
            const p1 = players[home];
            const p2 = players[away];
            
            // Skip if either is bye
            if (p1?.isBye || p2?.isBye) continue;
            
            matches.push({
                tournament_id,
                event_id,
                round: `RR_R${round}`,
                match_no: matches.length + 1,
                bracket: groupName ? `group_${groupName}` : 'round_robin',
                position: matches.length + 1,
                player1_id: p1.id,
                player1_name: p1.name,
                player2_id: p2.id,
                player2_name: p2.name,
                player1_score: null,
                player2_score: null,
                winner_id: null,
                status: 'pending',
                board_number: null,
                rr_group: groupName,
                rr_round: round,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
    
    return matches;
}

function divideIntoGroups(participants, numGroups) {
    const groups = Array.from({ length: numGroups }, () => []);
    
    // Snake draft to balance groups
    participants.forEach((participant, index) => {
        const groupIndex = Math.floor(index / Math.ceil(participants.length / numGroups)) % numGroups;
        groups[groupIndex].push(participant);
    });
    
    return groups;
}

/**
 * Calculate Round Robin standings
 */
exports.calculateRoundRobinStandings = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id, group_name } = req.body;
        
        // Get completed matches
        const matchesQuery = admin.firestore()
            .collection('matches')
            .where('tournament_id', '==', tournament_id)
            .where('event_id', '==', event_id)
            .where('status', '==', 'complete');
        
        const matchesSnapshot = await matchesQuery.get();
        
        const standings = {};
        
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            
            // Filter by group if specified
            if (group_name && match.rr_group !== group_name) return;
            
            // Initialize players
            [match.player1_id, match.player2_id].forEach(playerId => {
                if (!standings[playerId]) {
                    standings[playerId] = {
                        player_id: playerId,
                        player_name: match.player1_id === playerId ? match.player1_name : match.player2_name,
                        wins: 0,
                        losses: 0,
                        matches_played: 0,
                        legs_won: 0,
                        legs_lost: 0,
                        leg_diff: 0
                    };
                }
            });
            
            // Update stats
            if (match.winner_id) {
                standings[match.winner_id].wins++;
                const loserId = match.winner_id === match.player1_id ? match.player2_id : match.player1_id;
                standings[loserId].losses++;
                
                standings[match.player1_id].matches_played++;
                standings[match.player2_id].matches_played++;
                
                standings[match.player1_id].legs_won += match.player1_score || 0;
                standings[match.player1_id].legs_lost += match.player2_score || 0;
                standings[match.player2_id].legs_won += match.player2_score || 0;
                standings[match.player2_id].legs_lost += match.player1_score || 0;
            }
        });
        
        // Calculate leg differential
        Object.values(standings).forEach(s => {
            s.leg_diff = s.legs_won - s.legs_lost;
        });
        
        // Sort standings
        const standingsArray = Object.values(standings).sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.leg_diff !== a.leg_diff) return b.leg_diff - a.leg_diff;
            if (b.legs_won !== a.legs_won) return b.legs_won - a.legs_won;
            return a.player_name.localeCompare(b.player_name);
        });
        
        // Add positions
        standingsArray.forEach((standing, index) => {
            standing.position = index + 1;
        });
        
        res.json({
            success: true,
            standings: standingsArray
        });
        
    } catch (error) {
        console.error('Error calculating standings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PHASE 3C: SWISS SYSTEM
// ============================================================================

/**
 * Generate Swiss tournament (first round)
 */
exports.generateSwissTournament = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id, num_rounds } = req.body;
        
        // Get checked-in players
        const playersSnapshot = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('players')
            .where('checked_in', '==', true)
            .where('events', 'array-contains', event_id)
            .get();
        
        const players = [];
        playersSnapshot.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
        
        if (players.length < 4) {
            return res.status(400).json({ success: false, error: 'Need at least 4 players for Swiss' });
        }
        
        // Shuffle for random round 1 pairings
        const shuffled = players.sort(() => Math.random() - 0.5);
        
        // Generate round 1 matches
        const matches = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                matches.push({
                    tournament_id,
                    event_id,
                    round: 'SWISS_R1',
                    match_no: Math.floor(i / 2) + 1,
                    bracket: 'swiss',
                    position: Math.floor(i / 2) + 1,
                    player1_id: shuffled[i].id,
                    player1_name: shuffled[i].name,
                    player2_id: shuffled[i + 1].id,
                    player2_name: shuffled[i + 1].name,
                    player1_score: null,
                    player2_score: null,
                    winner_id: null,
                    status: 'pending',
                    board_number: null,
                    swiss_round: 1,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        
        // Save matches
        const batch = admin.firestore().batch();
        matches.forEach(match => {
            const matchRef = admin.firestore().collection('matches').doc();
            batch.set(matchRef, match);
        });
        
        // Update event
        const eventRef = admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id);
        
        batch.update(eventRef, {
            swiss_rounds: num_rounds || 5,
            swiss_current_round: 1
        });
        
        await batch.commit();
        
        res.json({
            success: true,
            matches_created: matches.length,
            message: 'Swiss tournament Round 1 generated'
        });
        
    } catch (error) {
        console.error('Error generating Swiss tournament:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Generate next Swiss round based on standings
 */
exports.generateNextSwissRound = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id } = req.body;
        
        // Get event
        const eventDoc = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id)
            .get();
        
        const event = eventDoc.data();
        const currentRound = event.swiss_current_round || 1;
        const nextRound = currentRound + 1;
        
        // Get all matches
        const matchesSnapshot = await admin.firestore()
            .collection('matches')
            .where('tournament_id', '==', tournament_id)
            .where('event_id', '==', event_id)
            .get();
        
        const allMatches = [];
        matchesSnapshot.forEach(doc => allMatches.push(doc.data()));
        
        // Calculate standings
        const standings = calculateSwissStandings(allMatches);
        
        // Check for previous matchups
        const previousMatchups = new Set();
        allMatches.forEach(match => {
            const pair = [match.player1_id, match.player2_id].sort().join('_');
            previousMatchups.add(pair);
        });
        
        // Pair players by score groups (no rematches)
        const newMatches = [];
        const paired = new Set();
        
        for (let i = 0; i < standings.length - 1; i++) {
            if (paired.has(standings[i].player_id)) continue;
            
            // Find best opponent
            for (let j = i + 1; j < standings.length; j++) {
                if (paired.has(standings[j].player_id)) continue;
                
                const pair = [standings[i].player_id, standings[j].player_id].sort().join('_');
                if (!previousMatchups.has(pair)) {
                    newMatches.push({
                        tournament_id,
                        event_id,
                        round: `SWISS_R${nextRound}`,
                        match_no: newMatches.length + 1,
                        bracket: 'swiss',
                        position: newMatches.length + 1,
                        player1_id: standings[i].player_id,
                        player1_name: standings[i].player_name,
                        player2_id: standings[j].player_id,
                        player2_name: standings[j].player_name,
                        player1_score: null,
                        player2_score: null,
                        winner_id: null,
                        status: 'pending',
                        board_number: null,
                        swiss_round: nextRound,
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    paired.add(standings[i].player_id);
                    paired.add(standings[j].player_id);
                    break;
                }
            }
        }
        
        // Save new matches
        const batch = admin.firestore().batch();
        newMatches.forEach(match => {
            const matchRef = admin.firestore().collection('matches').doc();
            batch.set(matchRef, match);
        });
        
        // Update event
        batch.update(eventDoc.ref, {
            swiss_current_round: nextRound
        });
        
        await batch.commit();
        
        res.json({
            success: true,
            matches_created: newMatches.length,
            message: `Swiss Round ${nextRound} generated`
        });
        
    } catch (error) {
        console.error('Error generating next Swiss round:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

function calculateSwissStandings(matches) {
    const standings = {};
    
    matches.filter(m => m.status === 'complete').forEach(match => {
        // Initialize
        [match.player1_id, match.player2_id].forEach(playerId => {
            if (!standings[playerId]) {
                standings[playerId] = {
                    player_id: playerId,
                    player_name: match.player1_id === playerId ? match.player1_name : match.player2_name,
                    wins: 0,
                    losses: 0,
                    points: 0
                };
            }
        });
        
        // Award points (1 for win, 0 for loss)
        if (match.winner_id === match.player1_id) {
            standings[match.player1_id].wins++;
            standings[match.player1_id].points++;
            standings[match.player2_id].losses++;
        } else if (match.winner_id === match.player2_id) {
            standings[match.player2_id].wins++;
            standings[match.player2_id].points++;
            standings[match.player1_id].losses++;
        }
    });
    
    // Sort by points
    return Object.values(standings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.player_name.localeCompare(b.player_name);
    });
}

// ============================================================================
// PHASE 4: BOARD MANAGEMENT
// ============================================================================

/**
 * Auto-assign boards to matches
 */
exports.assignBoards = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id, num_boards } = req.body;
        
        // Get pending matches
        const matchesSnapshot = await admin.firestore()
            .collection('matches')
            .where('tournament_id', '==', tournament_id)
            .where('event_id', '==', event_id)
            .where('status', '==', 'pending')
            .where('board_number', '==', null)
            .get();
        
        const matches = [];
        matchesSnapshot.forEach(doc => matches.push({ id: doc.id, ...doc.data() }));
        
        if (matches.length === 0) {
            return res.json({ success: true, message: 'No matches need board assignment' });
        }
        
        // Assign boards in round-robin fashion
        const batch = admin.firestore().batch();
        matches.forEach((match, index) => {
            const boardNumber = (index % num_boards) + 1;
            const matchRef = admin.firestore().collection('matches').doc(match.id);
            batch.update(matchRef, { board_number: boardNumber });
        });
        
        await batch.commit();
        
        res.json({
            success: true,
            matches_assigned: matches.length,
            message: `Assigned ${matches.length} matches to ${num_boards} boards`
        });
        
    } catch (error) {
        console.error('Error assigning boards:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get board status (which boards are in use)
 */
exports.getBoardStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id } = req.body;
        
        // Get in-progress matches
        const matchesSnapshot = await admin.firestore()
            .collection('matches')
            .where('tournament_id', '==', tournament_id)
            .where('event_id', '==', event_id)
            .where('status', 'in', ['pending', 'in_progress'])
            .get();
        
        const boards = {};
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            if (match.board_number) {
                if (!boards[match.board_number]) {
                    boards[match.board_number] = [];
                }
                boards[match.board_number].push({
                    match_id: doc.id,
                    player1: match.player1_name,
                    player2: match.player2_name,
                    round: match.round,
                    status: match.status
                });
            }
        });
        
        res.json({
            success: true,
            boards: boards
        });
        
    } catch (error) {
        console.error('Error getting board status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

