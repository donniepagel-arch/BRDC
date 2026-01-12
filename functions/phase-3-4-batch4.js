// Batch 4: Payouts & Boards (Refactored)

// Calculate Payouts
exports.calculatePayouts = functions.https.onRequest((req, res) => {
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
        const playersMap = tournamentData.players || {};
        
        const totalPlayers = Object.keys(playersMap).length;
        const paidPlayers = Object.values(playersMap).filter(p => p.paid === true).length;
        const unpaidPlayers = totalPlayers - paidPlayers;

        // Calculate pot
        const entryFee = tournamentData.entry_fee || 0;
        const grossPot = totalPlayers * entryFee;
        
        // House fee
        const houseFeePercent = tournamentData.house_fee_pct || 0;
        const houseFee = grossPot * (houseFeePercent / 100);
        const netPot = grossPot - houseFee;

        // Get payout structure (default 60/40 for 2 places)
        const payoutStructure = tournamentData.payout_structure || {
            '1st': 60,
            '2nd': 40
        };

        // Calculate actual payouts
        const payouts = {};
        Object.entries(payoutStructure).forEach(([place, percent]) => {
            payouts[place] = (netPot * percent / 100).toFixed(2);
        });

        // Update tournament
        await tournamentRef.update({
            payouts: {
                grossPot: grossPot,
                houseFee: houseFee,
                netPot: netPot,
                structure: payoutStructure,
                amounts: payouts,
                totalPlayers: totalPlayers,
                paidPlayers: paidPlayers,
                unpaidPlayers: unpaidPlayers
            }
        });

        res.json({
            success: true,
            grossPot: grossPot,
            houseFee: houseFee,
            netPot: netPot,
            payouts: payouts,
            totalPlayers: totalPlayers,
            paidPlayers: paidPlayers,
            unpaidPlayers: unpaidPlayers
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

// Apply Payout Preset
exports.applyPayoutPreset = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id, preset_name } = req.body;

        if (!tournament_id || !preset_name) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const PAYOUT_PRESETS = {
            'winner_take_all': { '1st': 100 },
            '60_40': { '1st': 60, '2nd': 40 },
            '50_30_20': { '1st': 50, '2nd': 30, '3rd': 20 },
            '40_30_20_10': { '1st': 40, '2nd': 30, '3rd': 20, '4th': 10 },
            '30_25_20_15_10': { '1st': 30, '2nd': 25, '3rd': 20, '4th': 15, '5th': 10 }
        };

        const preset = PAYOUT_PRESETS[preset_name];
        
        if (!preset) {
            return res.status(400).json({ success: false, error: 'Invalid preset' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        
        await tournamentRef.update({
            payout_structure: preset,
            payout_structure_name: preset_name
        });

        res.json({
            success: true,
            message: `Applied ${preset_name} payout structure`,
            structure: preset
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

// Assign Boards
exports.assignBoards = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id, assignments } = req.body;

        if (!tournament_id || !assignments) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();

        if (!tournament.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournamentData = tournament.data();
        const bracket = tournamentData.bracket || {};

        if (!bracket.matches) {
            return res.status(400).json({ success: false, error: 'No bracket generated' });
        }

        // Apply board assignments
        // assignments format: [{ matchId: 'match-1', board: 5 }, ...]
        assignments.forEach(({ matchId, board }) => {
            const matchIndex = bracket.matches.findIndex(m => m.id === matchId);
            if (matchIndex !== -1) {
                bracket.matches[matchIndex].board = board;
                bracket.matches[matchIndex].status = 'in_progress';
            }
        });

        await tournamentRef.update({
            bracket: bracket
        });

        res.json({
            success: true,
            message: `Assigned ${assignments.length} matches to boards`,
            assignments: assignments
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

// Get Board Status
exports.getBoardStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { tournament_id } = req.query;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();

        if (!tournament.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournamentData = tournament.data();
        const bracket = tournamentData.bracket || {};
        const matches = bracket.matches || [];

        // Get board status
        const boardStatus = {};
        const totalBoards = 12; // 10 primary + 2 supplemental at Rookies

        // Initialize all boards
        for (let i = 1; i <= totalBoards; i++) {
            boardStatus[i] = {
                board: i,
                status: 'available',
                match: null
            };
        }

        // Mark boards in use
        matches.forEach(match => {
            if (match.board && match.status === 'in_progress') {
                boardStatus[match.board] = {
                    board: match.board,
                    status: 'in_use',
                    match: {
                        id: match.id,
                        matchNumber: match.matchNumber,
                        round: match.round,
                        player1: match.player1?.name,
                        player2: match.player2?.name
                    }
                };
            }
        });

        const available = Object.values(boardStatus).filter(b => b.status === 'available').length;
        const inUse = Object.values(boardStatus).filter(b => b.status === 'in_use').length;

        res.json({
            success: true,
            totalBoards: totalBoards,
            available: available,
            inUse: inUse,
            boards: Object.values(boardStatus)
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});
