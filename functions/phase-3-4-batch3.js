// Round Robin Bracket Generator
exports.generateRoundRobinBracket = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id, num_groups } = req.body;

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
            .map(([id, player]) => ({ id, name: player.name, ...player }));

        if (players.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 players' });
        }

        // Shuffle for random seeding
        const shuffled = players.sort(() => Math.random() - 0.5);

        let bracket = {};

        if (num_groups && num_groups > 1) {
            // Multi-group round robin
            bracket = generateMultiGroupRoundRobin(shuffled, num_groups);
        } else {
            // Single group round robin
            bracket = generateSingleGroupRoundRobin(shuffled);
        }

        await tournamentRef.update({
            bracket: bracket,
            bracketGenerated: true,
            bracketGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
            started: true
        });

        res.json({
            success: true,
            matches_created: bracket.matches.length,
            message: 'Round robin bracket generated'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

function generateSingleGroupRoundRobin(players) {
    const matches = [];
    let matchNum = 1;

    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            matches.push({
                id: `rr-${matchNum}`,
                matchNumber: matchNum++,
                round: 'RR',
                player1: { id: players[i].id, name: players[i].name },
                player2: { id: players[j].id, name: players[j].name },
                score: { player1: null, player2: null },
                winner: null,
                status: 'pending'
            });
        }
    }

    return {
        type: 'round_robin',
        groups: 1,
        totalPlayers: players.length,
        matches: matches,
        standings: {},
        createdAt: admin.firestore.Timestamp.now()
    };
}

function generateMultiGroupRoundRobin(players, numGroups) {
    const groupSize = Math.ceil(players.length / numGroups);
    const allMatches = [];
    let matchNum = 1;

    for (let g = 0; g < numGroups; g++) {
        const groupPlayers = players.slice(g * groupSize, (g + 1) * groupSize);
        const groupName = String.fromCharCode(65 + g);
        
        for (let i = 0; i < groupPlayers.length; i++) {
            for (let j = i + 1; j < groupPlayers.length; j++) {
                allMatches.push({
                    id: `rr-${groupName}-${matchNum}`,
                    matchNumber: matchNum++,
                    round: `RR-${groupName}`,
                    group: groupName,
                    player1: { id: groupPlayers[i].id, name: groupPlayers[i].name },
                    player2: { id: groupPlayers[j].id, name: groupPlayers[j].name },
                    score: { player1: null, player2: null },
                    winner: null,
                    status: 'pending'
                });
            }
        }
    }

    return {
        type: 'round_robin',
        groups: numGroups,
        totalPlayers: players.length,
        matches: allMatches,
        standings: {},
        createdAt: admin.firestore.Timestamp.now()
    };
}

exports.calculateRoundRobinStandings = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id } = req.body;

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();
        const tournamentData = tournament.data();
        const bracket = tournamentData.bracket || {};

        const standings = {};

        bracket.matches.forEach(match => {
            if (match.status === 'completed' && match.winner) {
                const p1 = match.player1;
                const p2 = match.player2;

                if (!standings[p1.id]) {
                    standings[p1.id] = { name: p1.name, wins: 0, losses: 0, points: 0 };
                }
                if (!standings[p2.id]) {
                    standings[p2.id] = { name: p2.name, wins: 0, losses: 0, points: 0 };
                }

                if (match.winner.id === p1.id) {
                    standings[p1.id].wins++;
                    standings[p1.id].points += 2;
                    standings[p2.id].losses++;
                } else {
                    standings[p2.id].wins++;
                    standings[p2.id].points += 2;
                    standings[p1.id].losses++;
                }
            }
        });

        await tournamentRef.update({ 'bracket.standings': standings });

        res.json({ success: true, standings: standings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

exports.generateSwissTournament = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id, num_rounds } = req.body;

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();
        const tournamentData = tournament.data();
        
        const playersMap = tournamentData.players || {};
        const players = Object.entries(playersMap)
            .filter(([id, player]) => player.checkedIn === true)
            .map(([id, player]) => ({ id, name: player.name }));

        const rounds = num_rounds || Math.ceil(Math.log2(players.length));
        const shuffled = players.sort(() => Math.random() - 0.5);

        const matches = [];
        let matchNum = 1;

        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                matches.push({
                    id: `swiss-1-${matchNum}`,
                    matchNumber: matchNum++,
                    round: 1,
                    player1: { id: shuffled[i].id, name: shuffled[i].name },
                    player2: { id: shuffled[i + 1].id, name: shuffled[i + 1].name },
                    score: { player1: null, player2: null },
                    winner: null,
                    status: 'pending'
                });
            }
        }

        const bracket = {
            type: 'swiss',
            totalRounds: rounds,
            currentRound: 1,
            totalPlayers: players.length,
            matches: matches,
            playerRecords: shuffled.reduce((acc, p) => {
                acc[p.id] = { name: p.name, wins: 0, losses: 0, opponents: [] };
                return acc;
            }, {}),
            createdAt: admin.firestore.Timestamp.now()
        };

        await tournamentRef.update({
            bracket: bracket,
            bracketGenerated: true,
            started: true
        });

        res.json({ success: true, rounds: rounds, matches_created: matches.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

exports.generateNextSwissRound = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id } = req.body;

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();
        const tournamentData = tournament.data();
        const bracket = tournamentData.bracket || {};

        const currentRound = bracket.currentRound;
        const currentRoundMatches = bracket.matches.filter(m => m.round === currentRound);
        const allComplete = currentRoundMatches.every(m => m.status === 'completed');

        if (!allComplete) {
            return res.status(400).json({ success: false, error: 'Current round not complete' });
        }

        // Update records
        const playerRecords = { ...bracket.playerRecords };
        
        currentRoundMatches.forEach(match => {
            if (match.winner) {
                const winnerId = match.winner.id;
                const loserId = match.winner.id === match.player1.id ? match.player2.id : match.player1.id;
                
                playerRecords[winnerId].wins++;
                playerRecords[loserId].losses++;
            }
        });

        // Pair for next round
        const players = Object.entries(playerRecords)
            .map(([id, record]) => ({ id, ...record }))
            .sort((a, b) => b.wins - a.wins);

        const newMatches = [];
        const paired = new Set();

        for (let i = 0; i < players.length; i++) {
            if (paired.has(players[i].id)) continue;

            for (let j = i + 1; j < players.length; j++) {
                if (paired.has(players[j].id)) continue;

                newMatches.push({
                    id: `swiss-${currentRound + 1}-${newMatches.length + 1}`,
                    round: currentRound + 1,
                    player1: { id: players[i].id, name: players[i].name },
                    player2: { id: players[j].id, name: players[j].name },
                    score: { player1: null, player2: null },
                    winner: null,
                    status: 'pending'
                });

                paired.add(players[i].id);
                paired.add(players[j].id);
                break;
            }
        }

        bracket.matches.push(...newMatches);
        bracket.currentRound++;
        bracket.playerRecords = playerRecords;

        await tournamentRef.update({ bracket: bracket });

        res.json({ success: true, round: bracket.currentRound, matches_created: newMatches.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
    });
});
