/**
 * Generate Double Elimination Bracket
 * REFACTORED for unified structure
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

exports.generateDoubleElimBracket = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();

        if (!tournament.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournamentData = tournament.data();
        
        // Get checked-in players
        const playersMap = tournamentData.players || {};
        const players = Object.entries(playersMap)
            .filter(([id, player]) => player.checkedIn === true)
            .map(([id, player]) => ({ id, name: player.name, ...player }));

        if (players.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 checked-in players' });
        }

        // Shuffle for random seeding
        const seeded = players.sort(() => Math.random() - 0.5);
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(seeded.length)));

        const bracket = {
            type: 'double-elimination',
            totalPlayers: seeded.length,
            bracketSize: bracketSize,
            winnersMatches: generateWinnersBracket(seeded, bracketSize),
            losersMatches: generateLosersBracket(bracketSize),
            grandFinals: {
                id: 'grand-finals',
                round: 'finals',
                player1: null,
                player2: null,
                score: { player1: null, player2: null },
                winner: null,
                status: 'waiting'
            },
            createdAt: admin.firestore.Timestamp.now()
        };

        await tournamentRef.update({
            bracket: bracket,
            bracketGenerated: true,
            bracketGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
            started: true
        });

        res.json({
            success: true,
            matches_created: bracket.winnersMatches.length + bracket.losersMatches.length + 1,
            message: 'Double elimination bracket generated'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

function generateWinnersBracket(players, bracketSize) {
    const matches = [];
    const rounds = Math.log2(bracketSize);
    let matchNum = 1;

    // First round
    for (let i = 0; i < bracketSize / 2; i++) {
        const p1 = players[i * 2];
        const p2 = players[i * 2 + 1];
        
        matches.push({
            id: `w-${matchNum}`,
            matchNumber: matchNum++,
            round: 1,
            bracket: 'winners',
            player1: p1 ? { id: p1.id, name: p1.name } : null,
            player2: p2 ? { id: p2.id, name: p2.name } : null,
            score: { player1: null, player2: null },
            winner: null,
            loser: null,
            status: 'pending'
        });
    }

    // Subsequent rounds
    let prevMatches = bracketSize / 2;
    for (let r = 2; r <= rounds; r++) {
        for (let i = 0; i < prevMatches / 2; i++) {
            matches.push({
                id: `w-${matchNum}`,
                matchNumber: matchNum++,
                round: r,
                bracket: 'winners',
                player1: null,
                player2: null,
                score: { player1: null, player2: null },
                winner: null,
                loser: null,
                status: 'waiting'
            });
        }
        prevMatches /= 2;
    }

    return matches;
}

function generateLosersBracket(bracketSize) {
    const matches = [];
    const rounds = (Math.log2(bracketSize) - 1) * 2;
    let matchNum = 1;

    for (let r = 1; r <= rounds; r++) {
        const matchCount = Math.ceil(bracketSize / Math.pow(2, Math.ceil((r + 2) / 2)));
        for (let i = 0; i < matchCount; i++) {
            matches.push({
                id: `l-${matchNum}`,
                matchNumber: matchNum++,
                round: r,
                bracket: 'losers',
                player1: null,
                player2: null,
                score: { player1: null, player2: null },
                winner: null,
                status: 'waiting'
            });
        }
    }

    return matches;
}

exports.generateBlindDrawTeams = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id, team_size } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();

        if (!tournament.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournamentData = tournament.data();
        const playersMap = tournamentData.players || {};
        const players = Object.entries(playersMap)
            .filter(([id, player]) => player.checkedIn === true)
            .map(([id, player]) => ({ id, name: player.name }));

        if (players.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 players' });
        }

        const size = team_size || 2;
        
        // Shuffle players
        const shuffled = players.sort(() => Math.random() - 0.5);
        
        // Create teams
        const teams = [];
        for (let i = 0; i < Math.ceil(shuffled.length / size); i++) {
            const teamPlayers = shuffled.slice(i * size, (i + 1) * size);
            teams.push({
                id: `team-${i + 1}`,
                name: `Team ${i + 1}`,
                players: teamPlayers,
                locked: false
            });
        }

        await tournamentRef.update({
            teams: teams,
            teamsGenerated: true,
            teamsLocked: false
        });

        res.json({
            success: true,
            teams_created: teams.length,
            teams: teams
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

exports.lockBlindDrawTeams = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        
        await tournamentRef.update({
            teamsLocked: true,
            teamsLockedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Teams locked successfully' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

exports.reshuffleBlindDrawTeams = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();

        if (!tournament.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournamentData = tournament.data();

        if (tournamentData.teamsLocked) {
            return res.status(400).json({ success: false, error: 'Teams are locked' });
        }

        // Delete teams
        await tournamentRef.update({
            teams: admin.firestore.FieldValue.delete(),
            teamsGenerated: false
        });

        res.json({
            success: true,
            message: 'Teams deleted. Call generateBlindDrawTeams to create new teams'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});
