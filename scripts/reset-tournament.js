const admin = require('firebase-admin');
const path = require('path');

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const TOURNAMENT_ID = process.argv[2] || 'TEST_HB_1770450782796';

async function reset() {
    console.log(`Resetting tournament: ${TOURNAMENT_ID}`);

    // 1. Delete all matches subcollection docs
    const matchesSnap = await db.collection('tournaments').doc(TOURNAMENT_ID).collection('matches').get();
    console.log(`Matches to delete: ${matchesSnap.size}`);
    for (const doc of matchesSnap.docs) {
        await doc.ref.delete();
    }
    console.log('Matches cleared');

    // 2. Delete all stats subcollection docs
    const statsSnap = await db.collection('tournaments').doc(TOURNAMENT_ID).collection('stats').get();
    console.log(`Stats to delete: ${statsSnap.size}`);
    for (const doc of statsSnap.docs) {
        await doc.ref.delete();
    }
    console.log('Stats cleared');

    // 3. Reset bracket
    const tournRef = db.collection('tournaments').doc(TOURNAMENT_ID);
    const tournDoc = await tournRef.get();
    if (!tournDoc.exists) {
        console.error('Tournament not found');
        process.exit(1);
    }
    const data = tournDoc.data();
    const bracket = data.bracket;

    if (bracket && bracket.winners) {
        bracket.winners = bracket.winners.map(m => {
            if (m.round === 1) {
                if (m.team1 && m.team2) {
                    return { ...m, status: 'pending', scores: null, winner_id: null, loser_id: null, completed_at: null, started_at: null, board: null, stats: null };
                } else {
                    // Bye match
                    return { ...m, status: 'bye', scores: null, winner_id: m.team1_id || m.team2_id, completed_at: null };
                }
            } else {
                // Round 2+ - clear teams
                return { ...m, team1: null, team1_id: null, team2: null, team2_id: null, status: 'waiting', scores: null, winner_id: null, loser_id: null, completed_at: null, started_at: null, board: null, stats: null };
            }
        });
    }

    // Clear losers bracket
    if (bracket && bracket.losers) {
        bracket.losers = bracket.losers.map(m => ({
            ...m, team1: null, team1_id: null, team2: null, team2_id: null,
            status: 'waiting', scores: null, winner_id: null, loser_id: null,
            completed_at: null, started_at: null, board: null, stats: null
        }));
    }

    // Reset grand finals
    if (bracket && bracket.grand_finals) {
        if (bracket.grand_finals.match1) {
            bracket.grand_finals.match1 = { ...bracket.grand_finals.match1, team1: null, team1_id: null, team2: null, team2_id: null, status: 'waiting', scores: null, winner_id: null, completed_at: null, stats: null };
        }
        if (bracket.grand_finals.match2) {
            bracket.grand_finals.match2 = { ...bracket.grand_finals.match2, team1: null, team1_id: null, team2: null, team2_id: null, status: 'waiting', scores: null, winner_id: null, completed_at: null, stats: null };
        }
        bracket.grand_finals.bracket_reset_needed = false;
    }

    bracket.mingle_active = true;

    await tournRef.update({
        bracket,
        bracket_locked: false,
        champion: null,
        status: 'bracket_generated'
    });
    console.log('Bracket reset');

    // Re-advance byes into round 2
    if (bracket.winners) {
        const round1Byes = bracket.winners.filter(m => m.round === 1 && m.status === 'bye');
        for (const byeMatch of round1Byes) {
            const advId = byeMatch.team1_id || byeMatch.team2_id;
            const advTeam = byeMatch.team1 || byeMatch.team2;
            if (!advId || !advTeam) continue;

            byeMatch.winner_id = advId;
            byeMatch.completed_at = new Date().toISOString();

            const nextPos = Math.floor(byeMatch.position / 2);
            const nextMatch = bracket.winners.find(m => m.round === 2 && m.position === nextPos);
            if (nextMatch) {
                const isSlot1 = byeMatch.position % 2 === 0;
                if (isSlot1) {
                    nextMatch.team1_id = advId;
                    nextMatch.team1 = advTeam;
                } else {
                    nextMatch.team2_id = advId;
                    nextMatch.team2 = advTeam;
                }
                if (nextMatch.team1_id && nextMatch.team2_id) {
                    nextMatch.status = 'pending';
                }
            }
        }

        await tournRef.update({ bracket });
        console.log(`Auto-advanced ${round1Byes.length} bye(s)`);
    }

    console.log('Tournament reset complete!');
    process.exit(0);
}

reset().catch(e => { console.error(e); process.exit(1); });
