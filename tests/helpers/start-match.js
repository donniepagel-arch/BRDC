// Populates the games array for a match document
// Usage: node start-match.js <league_id> <match_id>

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp();
const db = getFirestore();

async function main() {
    const leagueId = process.argv[2];
    const matchId = process.argv[3];

    if (!leagueId || !matchId) {
        console.error('Usage: node start-match.js <league_id> <match_id>');
        process.exit(1);
    }

    const ref = db.collection('leagues').doc(leagueId)
        .collection('matches').doc(matchId);
    const doc = await ref.get();

    if (!doc.exists) {
        console.error('Match not found');
        process.exit(1);
    }

    const d = doc.data();
    if (d.games && d.games.length > 0) {
        console.log('Games already populated: ' + d.games.length);
        process.exit(0);
    }

    // Build 9 game slots matching the triples league format
    const games = [];
    for (let i = 1; i <= 9; i++) {
        games.push({
            game_number: i,
            status: 'pending',
            winner: null,
            legs: [],
            home_legs_won: 0,
            away_legs_won: 0
        });
    }

    await ref.update({ games, status: 'in_progress' });
    console.log('OK: Populated 9 game slots, status=in_progress');
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e.message);
    process.exit(1);
});
