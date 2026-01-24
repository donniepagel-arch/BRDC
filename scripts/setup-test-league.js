// Setup script for Bot Battle Test League
const admin = require('firebase-admin');

// Initialize Firebase Admin with application default credentials
admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();

const LEAGUE_ID = '9CM4w1LLp5AZvMYSkEif';

// Bot players (from earlier creation)
const bots = {
    A: [
        { id: 'bot_bullseye_bob', globalId: 'Z5pCbwRu1wKw87B4dpHJ', name: 'Bullseye Bob', pin: '35779300', avg: 90, difficulty: 'pro' },
        { id: 'bot_maximum_mike', globalId: 'KS6XSVf8lTeBJKLPeEhJ', name: 'Maximum Mike', pin: '71796272', avg: 90, difficulty: 'pro' },
        { id: 'bot_archer_andy', globalId: 'Pj1QEKdQpO9vC3HRjpz1', name: 'Archer Andy', pin: '44870323', avg: 90, difficulty: 'pro' },
        { id: 'bot_finish_frank', globalId: 'vSM9N4aZPfKaHCxFYQT2', name: 'Finish Frank', pin: '66849218', avg: 90, difficulty: 'pro' }
    ],
    B: [
        { id: 'bot_triple_tony', globalId: 'dq5aMBHYLqPWqxLlkjER', name: 'Triple Tony', pin: '93728096', avg: 65, difficulty: 'league' },
        { id: 'bot_checkout_charlie', globalId: 'QNPx3OzDvJvq2PZ3A4QF', name: 'Checkout Charlie', pin: '20174480', avg: 65, difficulty: 'league' },
        { id: 'bot_shanghai_sam', globalId: 'yQD0HU4oLmBMpCvfLI9Y', name: 'Shanghai Sam', pin: '61599935', avg: 65, difficulty: 'league' },
        { id: 'bot_cork_carl', globalId: 'gMF7xVwJbkKc2QNR4S0P', name: 'Cork Carl', pin: '22011523', avg: 65, difficulty: 'league' }
    ],
    C: [
        { id: 'bot_double_dave', globalId: 'IDW5SgQHQHjWU5cYovFt', name: 'Double Dave', pin: '67320011', avg: 55, difficulty: 'medium' },
        { id: 'bot_leg_larry', globalId: 'X1qeErzHsdlAH8I2QoZ2', name: 'Leg Larry', pin: '40001052', avg: 55, difficulty: 'medium' },
        { id: 'bot_ton_tommy', globalId: '328ccIz48eKOJGHMOr5j', name: 'Ton Tommy', pin: '10916817', avg: 55, difficulty: 'medium' },
        { id: 'bot_marker_marvin', globalId: 'td4HG7GZgbRg0HHNalqP', name: 'Marker Marvin', pin: '47068084', avg: 55, difficulty: 'medium' }
    ]
};

// Teams composition
const teams = [
    { name: 'Tungsten Thunder', A: 0, B: 0, C: 0 }, // Bob, Tony, Dave
    { name: 'Steel City Shooters', A: 1, B: 1, C: 1 }, // Mike, Charlie, Larry
    { name: 'Flight Risk', A: 2, B: 2, C: 2 }, // Andy, Sam, Tommy
    { name: 'The Oche Boys', A: 3, B: 3, C: 3 } // Frank, Carl, Marvin
];

async function setupLeague() {
    try {
        console.log('Setting up Bot Battle Test League...');

        // 1. First, add all bot players to the league's players subcollection
        console.log('\nAdding players to league...');
        const playerRefs = {};

        for (const level of ['A', 'B', 'C']) {
            for (const bot of bots[level]) {
                const playerData = {
                    name: bot.name,
                    isBot: true,
                    bot_id: bot.globalId,
                    skill_level: level,
                    reported_average: bot.avg,
                    difficulty: bot.difficulty,
                    pin: bot.pin,
                    team_id: null,
                    position: null,
                    level: level,
                    payment_status: 'paid',
                    registered_at: admin.firestore.FieldValue.serverTimestamp()
                };

                const ref = await db.collection('leagues').doc(LEAGUE_ID)
                    .collection('players').add(playerData);
                playerRefs[bot.id] = ref.id;
                console.log(`  Added ${bot.name} (${level}) -> ${ref.id}`);
            }
        }

        // 2. Create teams
        console.log('\nCreating teams...');
        const teamRefs = [];

        for (const team of teams) {
            const aPlayer = bots.A[team.A];
            const bPlayer = bots.B[team.B];
            const cPlayer = bots.C[team.C];

            const aPlayerId = playerRefs[aPlayer.id];
            const bPlayerId = playerRefs[bPlayer.id];
            const cPlayerId = playerRefs[cPlayer.id];

            const teamData = {
                team_name: team.name,
                players: [
                    { id: aPlayerId, name: aPlayer.name, position: 1, level: 'A' },
                    { id: bPlayerId, name: bPlayer.name, position: 2, level: 'B' },
                    { id: cPlayerId, name: cPlayer.name, position: 3, level: 'C' }
                ],
                captain_id: aPlayerId,
                wins: 0,
                losses: 0,
                ties: 0,
                games_won: 0,
                games_lost: 0,
                points: 0,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            const teamRef = await db.collection('leagues').doc(LEAGUE_ID)
                .collection('teams').add(teamData);
            teamRefs.push({ id: teamRef.id, name: team.name });
            console.log(`  Created ${team.name} -> ${teamRef.id}`);

            // Update players with team assignment (position determines level: 1=A, 2=B, 3=C)
            await db.collection('leagues').doc(LEAGUE_ID)
                .collection('players').doc(aPlayerId).update({ team_id: teamRef.id, position: 1, level: 'A' });
            await db.collection('leagues').doc(LEAGUE_ID)
                .collection('players').doc(bPlayerId).update({ team_id: teamRef.id, position: 2, level: 'B' });
            await db.collection('leagues').doc(LEAGUE_ID)
                .collection('players').doc(cPlayerId).update({ team_id: teamRef.id, position: 3, level: 'C' });
        }

        // 3. Create Week 1 schedule (round robin: 0v1, 2v3)
        console.log('\nCreating Week 1 schedule...');

        // Match 1: Tungsten Thunder vs Steel City Shooters
        const match1 = {
            week: 1,
            match_number: 1,
            home_team_id: teamRefs[0].id,
            away_team_id: teamRefs[1].id,
            home_team_name: teamRefs[0].name,
            away_team_name: teamRefs[1].name,
            status: 'scheduled',
            home_score: 0,
            away_score: 0,
            games: [],
            scheduled_date: '2025-01-20',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const match1Ref = await db.collection('leagues').doc(LEAGUE_ID)
            .collection('matches').add(match1);
        console.log(`  Match 1: ${teamRefs[0].name} vs ${teamRefs[1].name} -> ${match1Ref.id}`);

        // Match 2: Flight Risk vs The Oche Boys
        const match2 = {
            week: 1,
            match_number: 2,
            home_team_id: teamRefs[2].id,
            away_team_id: teamRefs[3].id,
            home_team_name: teamRefs[2].name,
            away_team_name: teamRefs[3].name,
            status: 'scheduled',
            home_score: 0,
            away_score: 0,
            games: [],
            scheduled_date: '2025-01-20',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const match2Ref = await db.collection('leagues').doc(LEAGUE_ID)
            .collection('matches').add(match2);
        console.log(`  Match 2: ${teamRefs[2].name} vs ${teamRefs[3].name} -> ${match2Ref.id}`);

        // Update league with total weeks
        await db.collection('leagues').doc(LEAGUE_ID).update({
            total_weeks: 3, // Round robin with 4 teams
            current_week: 1,
            status: 'active'
        });

        console.log('\n=== Setup Complete ===');
        console.log(`League ID: ${LEAGUE_ID}`);
        console.log(`Teams: ${teamRefs.map(t => t.name).join(', ')}`);
        console.log(`Week 1 Matches: 2`);
        console.log('\nAccess the league director dashboard with PIN: 39632911');

    } catch (error) {
        console.error('Error setting up league:', error);
    } finally {
        process.exit();
    }
}

setupLeague();
