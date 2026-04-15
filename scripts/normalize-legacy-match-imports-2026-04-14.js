'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const BACKUP_DIR = path.join(__dirname, '..', 'docs', 'backups', 'match-import-repair-2026-04-14');
const REPAIR_TAG = 'codex-2026-04-14';

const MATCH_REPAIRS = [
    {
        id: 'smKBx8m5t5QJYQrXpcxV',
        mode: 'legacy_stats_legs',
        missingThrowGames: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        note: 'Legacy web-scrape import only retained summary stats. Top-level legs were rebuilt from stats.legs without inventing throw arrays.'
    },
    {
        id: 'kC7C0NNtalEyNblHHTSW',
        mode: 'legacy_stats_legs',
        missingThrowGames: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        note: 'Legacy import only retained summary stats. Top-level legs were rebuilt from stats.legs without inventing throw arrays.'
    },
    {
        id: 'fqICAD9zFe7cLgNM2m4T',
        mode: 'metadata_only',
        missingThrowGames: [9],
        note: 'Game 9 has summary stats and winners but no preserved throw-by-throw source in the stored match document.'
    },
    {
        id: '0vSyH2zgRdoevOv2KEgX',
        mode: 'metadata_only',
        missingThrowGames: [2, 3, 5],
        note: 'Cricket games 2, 3, and 5 only retain leg summary stats in the stored match document.'
    },
    {
        id: '56py28cEEFO64uo8IN3U',
        mode: 'metadata_only',
        missingThrowGames: [2, 3, 5],
        note: 'Cricket games 2, 3, and 5 only retain leg summary stats in the stored match document.'
    },
    {
        id: 'JVrGYr5saQADImC451xc',
        mode: 'metadata_only',
        missingThrowGames: [2, 3, 5],
        note: 'Cricket games 2, 3, and 5 only retain leg summary stats in the stored match document.'
    }
];

function cloneLegFromLegacy(rawLeg, index) {
    return {
        leg_number: rawLeg.leg_number || index + 1,
        format: rawLeg.format || 'unknown',
        winner: rawLeg.winner || null,
        home_stats: rawLeg.home_stats || {},
        away_stats: rawLeg.away_stats || {},
        player_stats: rawLeg.player_stats || {},
        throws: Array.isArray(rawLeg.throws) ? rawLeg.throws : []
    };
}

function normalizeGame(game) {
    if (Array.isArray(game.legs) && game.legs.length > 0) {
        return game;
    }

    const legacyLegs = game.stats?.legs;
    if (!Array.isArray(legacyLegs) || legacyLegs.length === 0) {
        return game;
    }

    return {
        ...game,
        legs: legacyLegs.map(cloneLegFromLegacy),
        legacy_summary_source: 'stats.legs',
        legacy_summary_rebuilt_at: new Date().toISOString()
    };
}

async function main() {
    admin.initializeApp({ projectId: 'brdc-v2' });
    const db = admin.firestore();

    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    for (const repair of MATCH_REPAIRS) {
        const ref = db.collection('leagues').doc(LEAGUE_ID).collection('matches').doc(repair.id);
        const snap = await ref.get();

        if (!snap.exists) {
            console.log(`[SKIP] ${repair.id} missing`);
            continue;
        }

        const data = snap.data();
        const backupPath = path.join(BACKUP_DIR, `${repair.id}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));

        const nextGames = (data.games || []).map(game => (
            repair.mode === 'legacy_stats_legs' ? normalizeGame(game) : game
        ));

        const payload = {
            games: nextGames,
            import_truth_source: 'legacy_summary_stats',
            import_review_status: 'legacy_summary_only',
            legacy_summary_only: true,
            legacy_summary_missing_throw_games: repair.missingThrowGames,
            legacy_summary_note: repair.note,
            legacy_summary_normalized_at: admin.firestore.FieldValue.serverTimestamp(),
            legacy_summary_normalized_by: REPAIR_TAG,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        await ref.set(payload, { merge: true });
        console.log(`[UPDATED] ${repair.id} -> ${backupPath}`);
    }

    console.log('Legacy match normalization complete.');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
