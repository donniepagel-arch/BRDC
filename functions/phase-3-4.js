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
exports.calculatePayouts = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
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
exports.applyPayoutPreset = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
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
exports.getPayoutPresets = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
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
exports.assignBoards = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
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
exports.getBoardStatus = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
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

