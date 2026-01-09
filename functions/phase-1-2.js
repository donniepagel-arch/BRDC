/**
 * BRDC Phase 1 & 2 Cloud Functions
 * Advanced Brackets + Team Management
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

// ============================================================================
// PHASE 1: ADVANCED BRACKET GENERATION
// ============================================================================

/**
 * Generate Double Elimination Bracket
 */
exports.generateDoubleElimBracket = functions.https.onRequest((req, res) => {
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
            return res.status(400).json({ success: false, error: 'Need at least 2 checked-in players' });
        }
        
        // Determine bracket size
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(players.length)));
        const byeCount = bracketSize - players.length;
        
        // Shuffle for random seeding
        const seededPlayers = players.sort(() => Math.random() - 0.5);
        
        const allMatches = [];
        
        // Generate Winners Bracket
        allMatches.push(...await generateWinnersBracket(
            tournament_id, event_id, seededPlayers, bracketSize, event
        ));
        
        // Generate Losers Bracket
        allMatches.push(...generateLosersBracket(
            tournament_id, event_id, bracketSize, event
        ));
        
        // Generate Grand Finals
        allMatches.push(...generateGrandFinals(
            tournament_id, event_id, event
        ));
        
        // Save all matches
        const batch = admin.firestore().batch();
        allMatches.forEach(match => {
            const matchRef = admin.firestore().collection('matches').doc();
            batch.set(matchRef, match);
        });
        await batch.commit();
        
        res.json({
            success: true,
            matches_created: allMatches.length,
            message: 'Double elimination bracket generated'
        });
        
    } catch (error) {
        console.error('Error generating double elim bracket:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

async function generateWinnersBracket(tournament_id, event_id, seededPlayers, bracketSize, event) {
    const matches = [];
    const totalRounds = Math.log2(bracketSize);
    
    // Round 1
    const matchesInRound1 = bracketSize / 2;
    for (let i = 0; i < matchesInRound1; i++) {
        const p1 = seededPlayers[i * 2];
        const p2 = seededPlayers[i * 2 + 1];
        
        matches.push({
            tournament_id,
            event_id,
            round: 'WB_R1',
            match_no: i + 1,
            bracket: 'winners',
            position: i + 1,
            player1_id: p1 ? p1.id : null,
            player1_name: p1 ? p1.name : 'BYE',
            player2_id: p2 ? p2.id : null,
            player2_name: p2 ? p2.name : 'BYE',
            player1_score: null,
            player2_score: null,
            winner_id: (!p1 || !p2) ? (p1 ? p1.id : p2?.id) : null,
            loser_id: null,
            status: (p1 && p2) ? 'pending' : 'bye',
            board_number: null,
            src1_match_id: null,
            src1_take: null,
            src2_match_id: null,
            src2_take: null,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    
    // Subsequent rounds (all TBD)
    for (let round = 2; round <= totalRounds; round++) {
        const matchesInRound = Math.pow(2, totalRounds - round);
        const roundLabel = `WB_R${round}`;
        
        for (let i = 0; i < matchesInRound; i++) {
            matches.push({
                tournament_id,
                event_id,
                round: roundLabel,
                match_no: i + 1,
                bracket: 'winners',
                position: i + 1,
                player1_id: null,
                player1_name: 'TBD',
                player2_id: null,
                player2_name: 'TBD',
                player1_score: null,
                player2_score: null,
                winner_id: null,
                loser_id: null,
                status: 'pending',
                board_number: null,
                src1_match_id: `WB_R${round-1}_M${i*2+1}`,
                src1_take: 'winner',
                src2_match_id: `WB_R${round-1}_M${i*2+2}`,
                src2_take: 'winner',
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
    
    return matches;
}

function generateLosersBracket(tournament_id, event_id, bracketSize, event) {
    const matches = [];
    const wbRounds = Math.log2(bracketSize);
    const lbRounds = (2 * wbRounds) - 1;
    
    // LB Round 1
    const lbR1Matches = bracketSize / 4;
    for (let i = 0; i < lbR1Matches; i++) {
        matches.push({
            tournament_id,
            event_id,
            round: 'LB_R1',
            match_no: i + 1,
            bracket: 'losers',
            position: i + 1,
            player1_id: null,
            player1_name: 'TBD',
            player2_id: null,
            player2_name: 'TBD',
            player1_score: null,
            player2_score: null,
            winner_id: null,
            loser_id: null,
            status: 'pending',
            board_number: null,
            src1_match_id: `WB_R1_M${i*2+1}`,
            src1_take: 'loser',
            src2_match_id: `WB_R1_M${i*2+2}`,
            src2_take: 'loser',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    
    // LB subsequent rounds
    let currentLBWinners = lbR1Matches;
    for (let lbRound = 2; lbRound <= lbRounds; lbRound++) {
        const roundLabel = `LB_R${lbRound}`;
        const isConsolidation = (lbRound % 2 === 0);
        const matchesInRound = isConsolidation ? currentLBWinners / 2 : currentLBWinners;
        
        for (let i = 0; i < matchesInRound; i++) {
            let src1_take, src2_take, src1_match_id, src2_match_id;
            
            if (isConsolidation) {
                src1_match_id = `LB_R${lbRound-1}_M${i*2+1}`;
                src1_take = 'winner';
                src2_match_id = `LB_R${lbRound-1}_M${i*2+2}`;
                src2_take = 'winner';
            } else {
                const wbRoundNum = Math.floor(lbRound / 2) + 1;
                src1_match_id = `LB_R${lbRound-1}_M${i+1}`;
                src1_take = 'winner';
                src2_match_id = `WB_R${wbRoundNum}_M${i+1}`;
                src2_take = 'loser';
            }
            
            matches.push({
                tournament_id,
                event_id,
                round: roundLabel,
                match_no: i + 1,
                bracket: 'losers',
                position: i + 1,
                player1_id: null,
                player1_name: 'TBD',
                player2_id: null,
                player2_name: 'TBD',
                player1_score: null,
                player2_score: null,
                winner_id: null,
                loser_id: null,
                status: 'pending',
                board_number: null,
                src1_match_id,
                src1_take,
                src2_match_id,
                src2_take,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        
        if (isConsolidation) {
            currentLBWinners = matchesInRound;
        }
    }
    
    return matches;
}

function generateGrandFinals(tournament_id, event_id, event) {
    return [
        {
            tournament_id,
            event_id,
            round: 'GRAND_FINAL',
            match_no: 1,
            bracket: 'finals',
            position: 1,
            player1_id: null,
            player1_name: 'TBD (WB Winner)',
            player2_id: null,
            player2_name: 'TBD (LB Winner)',
            player1_score: null,
            player2_score: null,
            winner_id: null,
            loser_id: null,
            status: 'pending',
            board_number: null,
            src1_match_id: 'WB_FINAL',
            src1_take: 'winner',
            src2_match_id: 'LB_FINAL',
            src2_take: 'winner',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        }
    ];
}

// ============================================================================
// PHASE 2: BLIND DRAW TEAM MANAGEMENT
// ============================================================================

/**
 * Generate Blind Draw Teams
 */
exports.generateBlindDrawTeams = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id, team_size, odd_player_handling } = req.body;
        
        // Get players for this event
        const playersSnapshot = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('players')
            .where('events', 'array-contains', event_id)
            .get();
        
        const players = [];
        playersSnapshot.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
        
        if (players.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 players' });
        }
        
        const targetTeamSize = team_size || 2;
        const expectedTeams = Math.floor(players.length / targetTeamSize);
        const leftoverPlayers = players.length % targetTeamSize;
        
        // Check for odd players
        if (leftoverPlayers > 0 && !odd_player_handling) {
            return res.json({
                success: false,
                needs_decision: true,
                player_count: players.length,
                expected_teams: expectedTeams,
                leftover_players: leftoverPlayers,
                options: [
                    { value: 'solo', label: `${expectedTeams} teams + ${leftoverPlayers} solo` },
                    { value: 'triple', label: `${expectedTeams - 1} teams + 1 triple`, available: targetTeamSize === 2 && leftoverPlayers === 1 },
                    { value: 'exclude', label: `Exclude ${leftoverPlayers} random players` }
                ]
            });
        }
        
        // Generate teams
        let playersToTeam = [...players];
        
        // Handle odd players
        if (odd_player_handling === 'exclude' && leftoverPlayers > 0) {
            playersToTeam = playersToTeam.sort(() => Math.random() - 0.5).slice(0, -leftoverPlayers);
        }
        
        // Shuffle
        playersToTeam = playersToTeam.sort(() => Math.random() - 0.5);
        
        // Create teams
        const teams = [];
        const batch = admin.firestore().batch();
        
        for (let i = 0; i < playersToTeam.length; i += targetTeamSize) {
            const teamPlayers = playersToTeam.slice(i, i + targetTeamSize);
            
            if (teamPlayers.length < targetTeamSize && odd_player_handling !== 'solo') {
                continue;
            }
            
            const teamName = teamPlayers.map(p => p.name).join(' / ');
            const teamRef = admin.firestore()
                .collection('tournaments').doc(tournament_id)
                .collection('events').doc(event_id)
                .collection('teams').doc();
            
            const team = {
                team_name: teamName,
                team_size: teamPlayers.length,
                player_ids: teamPlayers.map(p => p.id),
                locked: false,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };
            
            batch.set(teamRef, team);
            teams.push(team);
        }
        
        await batch.commit();
        
        // Update event
        await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id)
            .update({
                teams_generated: true,
                teams_generated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        
        res.json({
            success: true,
            teams_created: teams.length,
            teams: teams
        });
        
    } catch (error) {
        console.error('Error generating blind draw teams:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Lock Blind Draw Teams
 */
exports.lockBlindDrawTeams = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id } = req.body;
        
        // Lock all teams
        const teamsSnapshot = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id)
            .collection('teams')
            .get();
        
        const batch = admin.firestore().batch();
        teamsSnapshot.forEach(doc => {
            batch.update(doc.ref, { locked: true });
        });
        
        // Update event
        const eventRef = admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id);
        
        batch.update(eventRef, {
            teams_locked: true,
            teams_locked_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        
        res.json({
            success: true,
            message: 'Teams locked successfully'
        });
        
    } catch (error) {
        console.error('Error locking teams:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Reshuffle Blind Draw Teams
 */
exports.reshuffleBlindDrawTeams = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_id } = req.body;
        
        // Check if teams are locked
        const eventDoc = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id)
            .get();
        
        if (eventDoc.data().teams_locked) {
            return res.status(400).json({ success: false, error: 'Teams are locked and cannot be reshuffled' });
        }
        
        // Delete existing teams
        const teamsSnapshot = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id)
            .collection('teams')
            .get();
        
        const batch = admin.firestore().batch();
        teamsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        // Regenerate (call generateBlindDrawTeams)
        res.json({
            success: true,
            message: 'Teams deleted. Call generateBlindDrawTeams to create new teams'
        });
        
    } catch (error) {
        console.error('Error reshuffling teams:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
    });
});
    });
});
