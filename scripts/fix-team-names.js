/**
 * Fix team names in the 2026 Winter Triple Draft league
 * Updates team names to match the schedule format (captain initials/name)
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin using application default credentials
admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Team mapping from teams.rtf - team_id to team name (captain format)
// Using the schedule naming convention
const TEAM_NAME_MAP = {
    // team_id -> { name: schedule_name, captain: full_captain_name }
    '10': { name: 'M. Pagel', captain: 'Matt Pagel' },
    '9': { name: 'K. Yasenchak', captain: 'Kevin Yasenchak' },
    '8': { name: 'E. O', captain: 'Eddie Olshansky' },
    '7': { name: 'J. Ragnoni', captain: 'John Ragnoni' },
    '6': { name: 'N. Kull', captain: 'Nathan Kull' },
    '5': { name: 'D. Pagel', captain: 'Donnie Pagel' },
    '4': { name: 'neon nightmares', captain: 'Tony Massimiani' },  // Tony's team has a custom name
    '3': { name: 'N. Mezlak', captain: 'Nick Mezlak' },
    '2': { name: 'D. Partlo', captain: 'Dan Partlo' },
    '1': { name: 'D. Russano', captain: 'Danny Russano' }
};

async function fixTeamNames() {
    console.log('Fetching teams from league:', LEAGUE_ID);

    // Get all teams
    const teamsSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('teams').get();
    console.log(`Found ${teamsSnap.size} teams`);

    // Build mapping of current team names to team_ids
    const teamDocMap = {}; // team doc id -> team data
    const teamByName = {}; // current team name -> team doc id

    teamsSnap.forEach(doc => {
        const data = doc.data();
        teamDocMap[doc.id] = data;
        teamByName[data.team_name] = doc.id;
        console.log(`  Team doc ${doc.id}: "${data.team_name}"`);
    });

    // Current teams are named "Team 1", "Team 2", etc.
    // We need to map these to the captain names
    // The team number corresponds to the team_id in TEAM_NAME_MAP

    const updates = [];

    for (const [docId, teamData] of Object.entries(teamDocMap)) {
        // Extract team number from "Team X" name
        const match = teamData.team_name?.match(/Team (\d+)/);
        if (match) {
            const teamNum = match[1];
            const newInfo = TEAM_NAME_MAP[teamNum];
            if (newInfo) {
                console.log(`\nWill update "${teamData.team_name}" -> "${newInfo.name}"`);
                updates.push({
                    docId,
                    oldName: teamData.team_name,
                    newName: newInfo.name,
                    captain: newInfo.captain
                });
            }
        }
    }

    if (updates.length === 0) {
        console.log('\nNo teams to update. Teams may already be renamed or have different format.');
        return;
    }

    console.log(`\n=== Updating ${updates.length} teams ===\n`);

    // Update team documents
    const batch = db.batch();
    for (const update of updates) {
        const teamRef = db.collection('leagues').doc(LEAGUE_ID).collection('teams').doc(update.docId);
        batch.update(teamRef, {
            team_name: update.newName,
            captain_name: update.captain
        });
        console.log(`Batch: ${update.oldName} -> ${update.newName}`);
    }

    await batch.commit();
    console.log('\nTeam names updated!');

    // Now update match documents
    console.log('\n=== Updating match team names ===\n');

    const matchesSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('matches').get();
    console.log(`Found ${matchesSnap.size} matches to check`);

    // Build old->new name map
    const nameMap = {};
    for (const update of updates) {
        nameMap[update.oldName] = update.newName;
    }

    let matchUpdateCount = 0;
    const matchBatch = db.batch();

    matchesSnap.forEach(doc => {
        const match = doc.data();
        const updateFields = {};

        if (match.home_team_name && nameMap[match.home_team_name]) {
            updateFields.home_team_name = nameMap[match.home_team_name];
        }
        if (match.away_team_name && nameMap[match.away_team_name]) {
            updateFields.away_team_name = nameMap[match.away_team_name];
        }

        if (Object.keys(updateFields).length > 0) {
            matchBatch.update(doc.ref, updateFields);
            matchUpdateCount++;
        }
    });

    if (matchUpdateCount > 0) {
        await matchBatch.commit();
        console.log(`Updated ${matchUpdateCount} match documents`);
    } else {
        console.log('No matches needed team name updates');
    }

    console.log('\n=== Done! ===');
}

fixTeamNames()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
