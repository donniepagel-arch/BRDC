/**
 * Seed an isolated Rookies demo tenant from the live 2026 Triples League.
 *
 * The demo intentionally uses separate player document IDs and fake contacts so
 * directors can exercise notification and runtime controls without touching
 * real BRDC players.
 */

let admin;
try {
    admin = require('firebase-admin');
} catch {
    admin = require('../functions/node_modules/firebase-admin');
}

const PROJECT_ID = 'brdc-v2';
const SOURCE_LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const DEMO_LEAGUE_ID = 'rookies-demo-2026-triples';
const DEMO_TOURNAMENT_ID = 'rookies-wing-it-wednesdays-2026-05-27';
const BRIAN_SOURCE_ID = 'bIv2rga3jBSvzsQ2khne';
const BRIAN_DEMO_ID = 'demo_brian_beach';
const BRIAN_AUTH_EMAIL = 'brian.beach@rookies-demo.invalid';
const BRIAN_AUTH_PASSWORD = 'RookiesDemo!2026';
const BRIAN_PIN = '69130000';
const WING_SUMMER_DATES = [
    '2026-06-03',
    '2026-06-10',
    '2026-06-17',
    '2026-06-24',
    '2026-07-01',
    '2026-07-08',
    '2026-07-15',
    '2026-07-22',
    '2026-07-29',
    '2026-08-05',
    '2026-08-12',
    '2026-08-19',
    '2026-08-26'
];

admin.initializeApp({ projectId: PROJECT_ID });

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

function slugify(value) {
    return String(value || 'player')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '')
        || 'player';
}

function fakeEmail(name, index) {
    return `${slugify(name)}.${String(index + 1).padStart(2, '0')}@example.invalid`;
}

function fakePhone(index) {
    return `+1555010${String(index % 100).padStart(2, '0')}`;
}

function hashIndex(value) {
    let hash = 0;
    for (const char of String(value || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return Math.abs(hash) % 100;
}

function demoPlayerId(sourceId) {
    return sourceId === BRIAN_SOURCE_ID ? BRIAN_DEMO_ID : `demo_${sourceId}`;
}

function remapDeep(value, idMap) {
    if (Array.isArray(value)) return value.map(item => remapDeep(item, idMap));
    if (value && typeof value === 'object' && !(value instanceof Timestamp) && !(value instanceof admin.firestore.GeoPoint)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapDeep(item, idMap)]));
    }
    if (typeof value !== 'string') return value;
    if (idMap[value]) return idMap[value];
    return value
        .replaceAll('Brian Smith', 'Brian Beach')
        .replaceAll('B. Smith', 'B. Beach')
        .replaceAll('bsmithjr7@gmail.com', BRIAN_AUTH_EMAIL);
}

function scrubContactsDeep(value, path = 'root') {
    if (Array.isArray(value)) return value.map((item, index) => scrubContactsDeep(item, `${path}.${index}`));
    if (value && typeof value === 'object' && !(value instanceof Timestamp) && !(value instanceof admin.firestore.GeoPoint)) {
        const output = {};
        Object.entries(value).forEach(([key, item]) => {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('email')) {
                output[key] = fakeEmail(String(value.name || value.player_name || value.team_name || 'demo'), hashIndex(`${path}.${key}`));
            } else if (lowerKey.includes('phone')) {
                output[key] = fakePhone(hashIndex(`${path}.${key}`));
            } else if (lowerKey.includes('fcm') || lowerKey.includes('token')) {
                output[key] = null;
            } else {
                output[key] = scrubContactsDeep(item, `${path}.${key}`);
            }
        });
        return output;
    }
    if (typeof value === 'string' && /@[a-z0-9.-]+\.[a-z]{2,}/i.test(value)) {
        return fakeEmail('demo', hashIndex(path));
    }
    return value;
}

async function recursiveDelete(ref) {
    try {
        await db.recursiveDelete(ref);
    } catch (error) {
        if (!/NOT_FOUND|not found/i.test(error.message || '')) throw error;
    }
}

async function commitChunks(writes) {
    for (let i = 0; i < writes.length; i += 20) {
        const batch = db.batch();
        writes.slice(i, i + 20).forEach(({ ref, data }) => batch.set(ref, data, { merge: false }));
        await batch.commit();
    }
}

async function copyCollection(sourceCollection, targetCollection, transform) {
    const snap = await sourceCollection.get();
    const writes = snap.docs.map((sourceDoc, index) => {
        const transformed = transform(sourceDoc.id, sourceDoc.data(), index);
        if (!transformed) return null;
        return {
            ref: targetCollection.doc(transformed.id || sourceDoc.id),
            data: transformed.data
        };
    }).filter(Boolean);
    await commitChunks(writes);
    return snap.docs;
}

function sanitizePlayerData(data, index, idMap) {
    const name = data.id === BRIAN_SOURCE_ID || data.name === 'Brian Smith'
        ? 'Brian Beach'
        : (data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Demo Player');
    const isBrian = name === 'Brian Beach';
    const email = isBrian ? BRIAN_AUTH_EMAIL : fakeEmail(name, index);
    const phone = fakePhone(index);
    const remapped = remapDeep(data, idMap);

    return {
        ...remapped,
        name,
        name_lower: name.toLowerCase(),
        first_name: isBrian ? 'Brian' : (remapped.first_name || name.split(/\s+/)[0] || ''),
        last_name: isBrian ? 'Beach' : (remapped.last_name || name.split(/\s+/).slice(1).join(' ') || ''),
        email,
        email_lower: email,
        phone,
        phone_e164: phone,
        phone_last4: phone.slice(-4),
        firebase_uid: null,
        league_id: DEMO_LEAGUE_ID,
        notification_preference: 'none',
        sms_opt_in: false,
        email_opt_in: false,
        push_opt_in: false,
        fcm_token: null,
        demo_mode: true,
        demo_tenant: 'rookies',
        is_director: isBrian ? true : Boolean(remapped.is_director),
        is_captain: isBrian ? true : Boolean(remapped.is_captain),
        is_admin: isBrian ? false : Boolean(remapped.is_admin),
        is_master_admin: false,
        updated_at: FieldValue.serverTimestamp()
    };
}

function buildGlobalPlayer(leaguePlayer, id, index, authUid = null) {
    return {
        id,
        name: leaguePlayer.name,
        first_name: leaguePlayer.first_name || '',
        last_name: leaguePlayer.last_name || '',
        email: leaguePlayer.email,
        email_lower: leaguePlayer.email_lower || leaguePlayer.email,
        phone: leaguePlayer.phone,
        phone_e164: leaguePlayer.phone_e164 || leaguePlayer.phone,
        phone_last4: leaguePlayer.phone_last4,
        pin: id === BRIAN_DEMO_ID ? BRIAN_PIN : `6913${String(index + 1).padStart(4, '0')}`,
        firebase_uid: authUid || null,
        photo_url: null,
        stats: leaguePlayer.stats || {},
        notification_preference: 'none',
        sms_opt_in: false,
        email_opt_in: false,
        push_opt_in: false,
        fcm_token: null,
        is_director: id === BRIAN_DEMO_ID,
        is_admin: false,
        is_master_admin: false,
        demo_mode: true,
        demo_tenant: 'rookies',
        league_id: DEMO_LEAGUE_ID,
        team_id: leaguePlayer.team_id || null,
        position: leaguePlayer.position || null,
        involvements: {
            leagues: [{
                id: DEMO_LEAGUE_ID,
                league_id: DEMO_LEAGUE_ID,
                name: 'Rookies 2026 Triples League Demo',
                team_id: leaguePlayer.team_id || null,
                role: id === BRIAN_DEMO_ID ? 'director' : (leaguePlayer.is_captain ? 'captain' : 'player')
            }],
            tournaments: [{
                id: DEMO_TOURNAMENT_ID,
                tournament_id: DEMO_TOURNAMENT_ID,
                name: 'Wing It Wednesdays #1: Blind Draw',
                role: id === BRIAN_DEMO_ID ? 'director' : 'demo_player'
            }],
            directing: id === BRIAN_DEMO_ID ? [
                { type: 'league', id: DEMO_LEAGUE_ID, name: 'Rookies 2026 Triples League Demo' },
                { type: 'tournament', id: DEMO_TOURNAMENT_ID, name: 'Wing It Wednesdays #1: Blind Draw' }
            ] : [],
            captaining: (leaguePlayer.is_captain || id === BRIAN_DEMO_ID) ? [{ league_id: DEMO_LEAGUE_ID, team_id: leaguePlayer.team_id || null }] : []
        },
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp()
    };
}

async function ensureBrianAuthUser() {
    let user;
    try {
        user = await auth.getUserByEmail(BRIAN_AUTH_EMAIL);
        user = await auth.updateUser(user.uid, {
            password: BRIAN_AUTH_PASSWORD,
            displayName: 'Brian Beach',
            emailVerified: true,
            disabled: false
        });
    } catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
        user = await auth.createUser({
            email: BRIAN_AUTH_EMAIL,
            password: BRIAN_AUTH_PASSWORD,
            displayName: 'Brian Beach',
            emailVerified: true,
            disabled: false
        });
    }
    await auth.setCustomUserClaims(user.uid, { demo_tenant: 'rookies', director: true });
    return user.uid;
}

function wingRegistration(id, name, index, extra = {}) {
    const email = fakeEmail(name, 100 + index);
    const phone = fakePhone(50 + index);
    return {
        id,
        data: {
            name,
            player_name: name,
            full_name: name,
            team_name: name,
            email,
            phone,
            phone_e164: phone,
            notification_preference: 'none',
            sms_opt_in: false,
            email_opt_in: false,
            checked_in: true,
            status: 'registered',
            event_id: 'blind-draw-doubles',
            event_name: 'Blind Draw Doubles',
            demo_mode: true,
            demo_tenant: 'rookies',
            created_at: Timestamp.fromDate(new Date('2026-05-27T23:45:00Z')),
            ...extra
        }
    };
}

function buildWingTournament(brianUid) {
    const teams = [
        wingRegistration('patrick-and-brian', 'Patrick & Brian', 1),
        wingRegistration('eric-and-tony', 'Eric & Tony', 2),
        wingRegistration('dom-and-melissa', 'Dom & Melissa', 3),
        wingRegistration('matt-and-chris', 'Matt & Chris', 4)
    ];
    const bracket = {
        type: 'single_elimination',
        generated_at: Timestamp.fromDate(new Date('2026-05-28T00:12:00Z')),
        matches: [
            {
                id: 'semifinal-1',
                match_id: 'semifinal-1',
                round: 1,
                round_label: 'Semifinals',
                player1: { id: 'patrick-and-brian', name: 'Patrick & Brian' },
                player2: { id: 'eric-and-tony', name: 'Eric & Tony' },
                player1_score: 2,
                player2_score: 1,
                winner: 'player1',
                status: 'completed',
                board_number: 1,
                game_type: '501',
                best_of: 3
            },
            {
                id: 'semifinal-2',
                match_id: 'semifinal-2',
                round: 1,
                round_label: 'Semifinals',
                player1: { id: 'dom-and-melissa', name: 'Dom & Melissa' },
                player2: { id: 'matt-and-chris', name: 'Matt & Chris' },
                player1_score: 0,
                player2_score: 2,
                winner: 'player2',
                status: 'completed',
                board_number: 2,
                game_type: '501',
                best_of: 3
            },
            {
                id: 'final',
                match_id: 'final',
                round: 2,
                round_label: 'Finals',
                player1: { id: 'patrick-and-brian', name: 'Patrick & Brian' },
                player2: { id: 'matt-and-chris', name: 'Matt & Chris' },
                player1_score: 1,
                player2_score: 2,
                winner: 'player2',
                status: 'completed',
                board_number: 1,
                game_type: '501',
                best_of: 3
            }
        ]
    };

    return {
        tournament: {
            name: 'Wing It Wednesdays #1: Blind Draw',
            tournament_name: 'Wing It Wednesdays #1: Blind Draw',
            series_name: 'Wing It Wednesdays',
            description: 'First Wednesday event of the summer Wing It Wednesdays series. Blind draw doubles with flexible weekly format energy.',
            status: 'completed',
            registration_status: 'completed',
            date: Timestamp.fromDate(new Date('2026-05-27T23:00:00Z')),
            start_date: Timestamp.fromDate(new Date('2026-05-27T23:00:00Z')),
            start_time: '7:00 PM',
            registration_deadline: '6:45 PM',
            location_mode: 'in_person',
            venue_name: 'Rookies Sports Bar & Grill',
            venue_address: '6913 W 130th St, Parma Heights, OH 44130',
            format: 'single_elimination',
            bracket_type: 'single_elimination',
            event_type: 'blind_draw',
            entry_type: 'blind_draw_team',
            game_type: '501',
            x01_value: 501,
            in_rule: 'straight',
            out_rule: 'double',
            best_of: 3,
            entry_fee: 5,
            max_players: 32,
            registered_count: teams.length,
            venue_board_count: 8,
            unavailable_boards: [7, 8],
            director_name: 'Brian Beach',
            director_player_id: BRIAN_DEMO_ID,
            director_firebase_uid: brianUid,
            director_email: BRIAN_AUTH_EMAIL,
            director_pin: BRIAN_PIN,
            staff_player_ids: [BRIAN_DEMO_ID],
            demo_mode: true,
            demo_tenant: 'rookies',
            notification_preference: 'none',
            sms_opt_in: false,
            email_opt_in: false,
            bracket,
            bracketGenerated: true,
            winner_name: 'Matt & Chris',
            runner_up_name: 'Patrick & Brian',
            created_at: Timestamp.fromDate(new Date('2026-05-27T22:30:00Z')),
            updated_at: FieldValue.serverTimestamp()
        },
        events: [{
            id: 'blind-draw-doubles',
            data: {
                name: 'Blind Draw Doubles',
                event_name: 'Blind Draw Doubles',
                entry_type: 'blind_draw_team',
                format: 'single_elimination',
                game: '501',
                game_type: '501',
                best_of: 3,
                max_players: 32,
                registration_count: teams.length,
                registered_count: teams.length,
                status: 'completed',
                demo_mode: true,
                demo_tenant: 'rookies'
            }
        }],
        registrations: teams
    };
}

function buildFutureWingTournament(date, index, brianUid) {
    const number = index + 2;
    return {
        name: `Wing It Wednesdays #${number}`,
        tournament_name: `Wing It Wednesdays #${number}`,
        series_name: 'Wing It Wednesdays',
        description: 'Every Wednesday all summer at Rookies. The concept can change week to week: blind draws, social formats, quick brackets, and wing specials.',
        status: 'registration',
        registration_status: 'open',
        date: Timestamp.fromDate(new Date(`${date}T19:00:00-04:00`)),
        start_date: Timestamp.fromDate(new Date(`${date}T19:00:00-04:00`)),
        start_time: '7:00 PM',
        registration_deadline: '6:45 PM',
        location_mode: 'in_person',
        venue_name: 'Rookies Sports Bar & Grill',
        venue_address: '6913 W 130th St, Parma Heights, OH 44130',
        format: 'weekly_format_tbd',
        bracket_type: 'single_elimination',
        event_type: 'weekly_social',
        entry_type: 'open_player_registration',
        game_type: 'darts',
        in_rule: 'varies',
        out_rule: 'varies',
        best_of: 3,
        entry_fee: 5,
        max_players: 32,
        registered_count: 0,
        registration_count: 0,
        venue_board_count: 8,
        unavailable_boards: [],
        director_name: 'Brian Beach',
        director_player_id: BRIAN_DEMO_ID,
        director_firebase_uid: brianUid,
        director_email: BRIAN_AUTH_EMAIL,
        director_pin: BRIAN_PIN,
        staff_player_ids: [BRIAN_DEMO_ID],
        demo_mode: true,
        demo_tenant: 'rookies',
        notification_preference: 'none',
        sms_opt_in: false,
        email_opt_in: false,
        series_occurrence: number,
        series_week: number,
        summer_series: true,
        public_registration_required: true,
        bracketGenerated: false,
        created_at: Timestamp.fromDate(new Date(`${date}T12:00:00-04:00`)),
        updated_at: FieldValue.serverTimestamp()
    };
}

async function seedLeague() {
    const sourceRef = db.collection('leagues').doc(SOURCE_LEAGUE_ID);
    const targetRef = db.collection('leagues').doc(DEMO_LEAGUE_ID);
    const sourceDoc = await sourceRef.get();
    if (!sourceDoc.exists) throw new Error(`Source league not found: ${SOURCE_LEAGUE_ID}`);

    await recursiveDelete(targetRef);

    const sourcePlayers = await sourceRef.collection('players').get();
    const idMap = {};
    sourcePlayers.docs.forEach(doc => { idMap[doc.id] = demoPlayerId(doc.id); });

    const leagueData = scrubContactsDeep(remapDeep(sourceDoc.data(), idMap), 'league');
    await targetRef.set({
        ...leagueData,
        name: 'Rookies 2026 Triples League Demo',
        league_name: 'Rookies 2026 Triples League Demo',
        short_name: 'Rookies Triples',
        venue_name: 'Rookies Sports Bar & Grill',
        venue_address: '6913 W 130th St, Parma Heights, OH 44130',
        demo_mode: true,
        demo_tenant: 'rookies',
        source_league_id: SOURCE_LEAGUE_ID,
        director_name: 'Brian Beach',
        director_id: BRIAN_DEMO_ID,
        director_player_id: BRIAN_DEMO_ID,
        directors: [BRIAN_DEMO_ID],
        director_ids: [BRIAN_DEMO_ID],
        director_pin: BRIAN_PIN,
        admin_pin: BRIAN_PIN,
        notifications_disabled: true,
        updated_at: FieldValue.serverTimestamp()
    }, { merge: false });

    const brianUid = await ensureBrianAuthUser();
    const leaguePlayersByDemoId = new Map();

    await copyCollection(sourceRef.collection('teams'), targetRef.collection('teams'), (id, data) => ({
        id,
        data: {
            ...scrubContactsDeep(remapDeep(data, idMap), `teams.${id}`),
            demo_mode: true,
            demo_tenant: 'rookies',
            updated_at: FieldValue.serverTimestamp()
        }
    }));

    await copyCollection(sourceRef.collection('players'), targetRef.collection('players'), (id, data, index) => {
        const targetId = idMap[id];
        const player = sanitizePlayerData({ ...data, id }, index, idMap);
        player.firebase_uid = targetId === BRIAN_DEMO_ID ? brianUid : null;
        if (targetId === BRIAN_DEMO_ID) {
            player.involvements = {
                leagues: [{
                    id: DEMO_LEAGUE_ID,
                    league_id: DEMO_LEAGUE_ID,
                    name: 'Rookies 2026 Triples League Demo',
                    team_id: player.team_id || null,
                    team_name: player.team_name || null,
                    role: 'director'
                }],
                tournaments: [{
                    id: DEMO_TOURNAMENT_ID,
                    tournament_id: DEMO_TOURNAMENT_ID,
                    name: 'Wing It Wednesdays #1: Blind Draw',
                    role: 'director'
                }],
                directing: [
                    { type: 'league', id: DEMO_LEAGUE_ID, name: 'Rookies 2026 Triples League Demo' },
                    { type: 'tournament', id: DEMO_TOURNAMENT_ID, name: 'Wing It Wednesdays #1: Blind Draw' }
                ],
                captaining: [{ league_id: DEMO_LEAGUE_ID, team_id: player.team_id || null, team_name: player.team_name || null }]
            };
        }
        delete player.id;
        leaguePlayersByDemoId.set(targetId, player);
        return { id: targetId, data: player };
    });

    const brianDemoPlayer = leaguePlayersByDemoId.get(BRIAN_DEMO_ID);
    if (brianDemoPlayer?.team_id) {
        await targetRef.collection('teams').doc(brianDemoPlayer.team_id).set({
            captain_id: BRIAN_DEMO_ID,
            updated_at: FieldValue.serverTimestamp()
        }, { merge: true });
    }

    await copyCollection(sourceRef.collection('stats'), targetRef.collection('stats'), (id, data) => ({
        id: idMap[id] || `demo_${id}`,
        data: {
            ...scrubContactsDeep(remapDeep(data, idMap), `stats.${id}`),
            demo_mode: true,
            demo_tenant: 'rookies',
            updated_at: FieldValue.serverTimestamp()
        }
    }));

    const brianStatsDoc = await targetRef.collection('stats').doc(BRIAN_DEMO_ID).get();
    if (brianStatsDoc.exists && leaguePlayersByDemoId.has(BRIAN_DEMO_ID)) {
        const brianPlayer = leaguePlayersByDemoId.get(BRIAN_DEMO_ID);
        const currentStats = brianStatsDoc.data();
        brianPlayer.stats = currentStats;
        brianPlayer.unified_stats = currentStats;
        leaguePlayersByDemoId.set(BRIAN_DEMO_ID, brianPlayer);
        await targetRef.collection('players').doc(BRIAN_DEMO_ID).set({
            stats: currentStats,
            unified_stats: currentStats
        }, { merge: true });
    }

    for (const subcollection of ['matches', 'playoffs', 'feed', 'public_cache']) {
        await copyCollection(sourceRef.collection(subcollection), targetRef.collection(subcollection), (id, data) => ({
            id,
            data: {
                ...scrubContactsDeep(remapDeep(data, idMap), `${subcollection}.${id}`),
                demo_mode: true,
                demo_tenant: 'rookies',
                source_league_id: SOURCE_LEAGUE_ID,
                updated_at: FieldValue.serverTimestamp()
            }
        }));
    }

    const globalWrites = [];
    [...leaguePlayersByDemoId.entries()].forEach(([id, player], index) => {
        globalWrites.push({
            ref: db.collection('players').doc(id),
            data: buildGlobalPlayer(player, id, index, id === BRIAN_DEMO_ID ? brianUid : null)
        });
    });
    await commitChunks(globalWrites);

    return { idMap, brianUid, playerCount: leaguePlayersByDemoId.size };
}

async function seedWingTournament(brianUid) {
    const tournamentRef = db.collection('tournaments').doc(DEMO_TOURNAMENT_ID);
    await recursiveDelete(tournamentRef);
    const data = buildWingTournament(brianUid);
    await tournamentRef.set(data.tournament, { merge: false });
    await commitChunks([
        ...data.events.map(item => ({ ref: tournamentRef.collection('events').doc(item.id), data: item.data })),
        ...data.registrations.map(item => ({ ref: tournamentRef.collection('registrations').doc(item.id), data: item.data })),
        ...data.registrations.map(item => ({ ref: tournamentRef.collection('players').doc(item.id), data: item.data }))
    ]);

    await commitChunks(WING_SUMMER_DATES.map((date, index) => ({
        ref: db.collection('tournaments').doc(`rookies-wing-it-wednesdays-${date}`),
        data: buildFutureWingTournament(date, index, brianUid)
    })));
}

async function auditDemoContacts() {
    const badContacts = [];
    const leaguePlayers = await db.collection('leagues').doc(DEMO_LEAGUE_ID).collection('players').get();
    leaguePlayers.forEach(doc => {
        const data = doc.data();
        if (data.email && !String(data.email).endsWith('@example.invalid') && data.email !== BRIAN_AUTH_EMAIL) badContacts.push(`league:${doc.id}:${data.email}`);
        if (data.phone && !String(data.phone).startsWith('+1555010')) badContacts.push(`league:${doc.id}:${data.phone}`);
    });
    const regs = await db.collection('tournaments').doc(DEMO_TOURNAMENT_ID).collection('registrations').get();
    regs.forEach(doc => {
        const data = doc.data();
        if (data.email && !String(data.email).endsWith('@example.invalid')) badContacts.push(`tournament:${doc.id}:${data.email}`);
        if (data.phone && !String(data.phone).startsWith('+1555010')) badContacts.push(`tournament:${doc.id}:${data.phone}`);
    });
    if (badContacts.length) throw new Error(`Real-looking contacts found:\n${badContacts.join('\n')}`);
    return { leaguePlayers: leaguePlayers.size, registrations: regs.size };
}

async function main() {
    const { brianUid, playerCount } = await seedLeague();
    await seedWingTournament(brianUid);
    const audit = await auditDemoContacts();
    console.log(JSON.stringify({
        success: true,
        demoLeagueId: DEMO_LEAGUE_ID,
        demoTournamentId: DEMO_TOURNAMENT_ID,
        brianPlayerId: BRIAN_DEMO_ID,
        brianAuthEmail: BRIAN_AUTH_EMAIL,
        brianPassword: BRIAN_AUTH_PASSWORD,
        playerCount,
        audit
    }, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
