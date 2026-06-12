const admin = require('../functions/node_modules/firebase-admin');

if (!admin.apps.length) admin.initializeApp({ projectId: 'brdc-v2' });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const args = process.argv.slice(2);

function argValue(name, fallback = null) {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    return args[index + 1] || fallback;
}

function hasArg(name) {
    return args.includes(name);
}

const tournamentId = argValue('--tournament', 'wing-it-wednesdays-2026-05-27');
const eventId = argValue('--event', 'blind_draw_doubles');
const commit = hasArg('--commit');
const force = hasArg('--force');
const checkedInOnly = hasArg('--checked-in-only');
const generateBracket = hasArg('--generate-bracket');
const seed = argValue('--seed', null);
const houseName = argValue('--house', null);

function hashSeed(value) {
    let h = 1779033703 ^ value.length;
    for (let i = 0; i < value.length; i++) {
        h = Math.imul(h ^ value.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function nextHash() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    };
}

function seededRandom(value) {
    const nextHash = hashSeed(value);
    let t = nextHash();
    return function random() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(items) {
    const random = seed ? seededRandom(seed) : Math.random;
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function playerName(registration) {
    return registration.full_name || registration.name || registration.player_name || registration.email || 'Unknown Player';
}

function pairPlayers(players) {
    const shuffled = shuffle(players);
    const teams = [];
    for (let i = 0; i < shuffled.length; i += 2) {
        const first = shuffled[i];
        const second = shuffled[i + 1];
        const number = String((i / 2) + 1).padStart(2, '0');
        const teamId = `draw_team_${number}`;
        const teamPlayers = [first, second].filter(Boolean);
        teams.push({
            id: teamId,
            name: teamPlayers.map(playerName).join(' / '),
            team_name: teamPlayers.map(playerName).join(' / '),
            players: teamPlayers.map(player => ({
                registration_id: player.id,
                player_id: player.player_id || null,
                name: playerName(player),
                email: player.email || null,
                phone: player.phone || null,
                notification_preference: player.notification_preference || (player.sms_opt_in === false ? 'email' : 'both'),
                sms_opt_in: player.sms_opt_in !== false,
                email_opt_in: player.email_opt_in !== false,
                pin: player.pin || null,
                is_house: player.is_house === true
            })),
            checkedIn: true,
            checked_in: true,
            status: 'active',
            entry_type: 'blind_draw_team',
            draw_event_id: eventId,
            seed_number: teams.length + 1
        });
    }
    return teams;
}

function generateSingleElimination(teams) {
    const shuffled = shuffle(teams);
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
    const byeCount = bracketSize - shuffled.length;
    const totalRounds = Math.log2(bracketSize);
    const matches = [];
    let matchNumber = 1;
    const firstRoundSlots = Array(bracketSize).fill(null);
    const firstRoundMatches = bracketSize / 2;
    const byePositions = [];
    let left = 0;
    let right = firstRoundMatches - 1;
    const reservedByeOpponentSlots = new Set();

    while (byePositions.length < byeCount) {
        byePositions.push(left++);
        if (byePositions.length < byeCount) byePositions.push(right--);
    }

    let teamIndex = 0;
    for (const position of byePositions) {
        firstRoundSlots[position * 2] = shuffled[teamIndex++] || null;
        reservedByeOpponentSlots.add(position * 2 + 1);
    }

    for (let i = 0; i < firstRoundSlots.length && teamIndex < shuffled.length; i++) {
        if (reservedByeOpponentSlots.has(i)) continue;
        if (firstRoundSlots[i]) continue;
        firstRoundSlots[i] = shuffled[teamIndex++];
    }

    for (let i = 0; i < bracketSize / 2; i++) {
        const player1 = firstRoundSlots[i * 2] || null;
        const player2 = firstRoundSlots[i * 2 + 1] || null;
        const hasBye = (player1 && !player2) || (!player1 && player2);
        const byeWinner = hasBye ? (player1 || player2) : null;
        matches.push({
            id: `match-${matchNumber}`,
            matchNumber: matchNumber++,
            round: 1,
            position: i,
            player1,
            player2,
            score: { player1: null, player2: null },
            winner: byeWinner,
            winner_id: byeWinner?.id || null,
            status: hasBye ? 'bye' : (player1 && player2 ? 'pending' : 'waiting'),
            board: null
        });
    }

    let previousRoundMatches = bracketSize / 2;
    for (let round = 2; round <= totalRounds; round++) {
        const roundMatches = previousRoundMatches / 2;
        for (let i = 0; i < roundMatches; i++) {
            matches.push({
                id: `match-${matchNumber}`,
                matchNumber: matchNumber++,
                round,
                position: i,
                player1: null,
                player2: null,
                score: { player1: null, player2: null },
                winner: null,
                status: 'waiting',
                board: null
            });
        }
        previousRoundMatches = roundMatches;
    }

    matches
        .filter(match => match.round === 1 && match.status === 'bye' && match.winner)
        .forEach(match => {
            match.status = 'completed';
            match.completedAt = admin.firestore.Timestamp.now();

            const nextMatch = matches.find(item => item.round === 2 && item.position === Math.floor(match.position / 2));
            if (!nextMatch) return;

            if (match.position % 2 === 0) nextMatch.player1 = match.winner;
            else nextMatch.player2 = match.winner;

            if (nextMatch.player1 && nextMatch.player2) {
                nextMatch.status = 'pending';
            }
        });

    return {
        type: 'single-elimination',
        entry_type: 'blind_draw',
        team_size: 2,
        totalRounds,
        totalPlayers: teams.length,
        totalTeams: teams.length,
        bracketSize,
        matches,
        createdAt: admin.firestore.Timestamp.now()
    };
}

async function main() {
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentSnap = await tournamentRef.get();
    if (!tournamentSnap.exists) throw new Error(`Tournament not found: ${tournamentId}`);

    const tournament = tournamentSnap.data();
    if ((tournament.bracketGenerated || tournament.bracket) && !force) {
        throw new Error('Tournament already has a bracket. Re-run with --force to overwrite generated draw/bracket data.');
    }

    const registrationsSnap = await tournamentRef.collection('registrations').get();
    let registrations = registrationsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(registration => registration.status !== 'cancelled')
        .filter(registration => !eventId || (registration.event_ids || []).includes(eventId));

    if (checkedInOnly) {
        registrations = registrations.filter(registration => registration.checked_in === true || registration.checkedIn === true);
    }

    if (houseName) {
        registrations.push({
            id: `house_${houseName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'player'}`,
            full_name: houseName,
            name: houseName,
            email: null,
            phone: null,
            notification_preference: 'email',
            sms_opt_in: false,
            email_opt_in: false,
            player_id: null,
            pin: null,
            status: 'active',
            checked_in: true,
            event_ids: [eventId],
            is_house: true
        });
    }

    if (registrations.length < 4) {
        throw new Error(`Need at least 4 players for blind-draw doubles. Found ${registrations.length}.`);
    }

    if (registrations.length % 2 !== 0) {
        throw new Error(`Odd player count (${registrations.length}). Add a player or pass --house "House Player".`);
    }

    const teams = pairPlayers(registrations);
    const bracket = generateBracket ? generateSingleElimination(teams) : null;

    const report = {
        tournamentId,
        eventId,
        mode: commit ? 'commit' : 'dry-run',
        checkedInOnly,
        seed: seed || '(random)',
        players: registrations.length,
        teams: teams.map(team => ({
            id: team.id,
            name: team.name,
            players: team.players.map(player => player.name)
        })),
        bracket: bracket ? {
            generated: true,
            bracketSize: bracket.bracketSize,
            rounds: bracket.totalRounds,
            matches: bracket.matches.map(match => ({
                id: match.id,
                round: match.round,
                position: match.position,
                player1: match.player1?.name || null,
                player2: match.player2?.name || null,
                status: match.status
            }))
        } : { generated: false }
    };

    if (!commit) {
        console.log(JSON.stringify(report, null, 2));
        console.log('\nDry run only. Add --commit to write draw teams, and --generate-bracket to write a bracket.');
        return;
    }

    const batch = db.batch();
    const playersMap = {};
    for (const team of teams) {
        playersMap[team.id] = team;
        batch.set(tournamentRef.collection('draw_teams').doc(team.id), {
            ...team,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp()
        });
        batch.set(tournamentRef.collection('players').doc(team.id), {
            ...team,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp()
        }, { merge: true });
        batch.set(tournamentRef.collection('events').doc(eventId).collection('draw_teams').doc(team.id), {
            ...team,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp()
        });
    }

    batch.set(tournamentRef.collection('events').doc(eventId), {
        draw_generated: true,
        draw_generated_at: FieldValue.serverTimestamp(),
        team_count: teams.length,
        player_count: registrations.length,
        status: generateBracket ? 'active' : 'draw_ready',
        updated_at: FieldValue.serverTimestamp()
    }, { merge: true });

    const update = {
        players: playersMap,
        draw_generated: true,
        draw_generated_at: FieldValue.serverTimestamp(),
        team_count: teams.length,
        playerCount: registrations.length,
        updated_at: FieldValue.serverTimestamp()
    };

    if (bracket) {
        update.bracket = bracket;
        update.bracketGenerated = true;
        update.bracketGeneratedAt = FieldValue.serverTimestamp();
        update.started = true;
        update.status = 'bracket_generated';
    }

    batch.set(tournamentRef, update, { merge: true });
    await batch.commit();

    console.log(JSON.stringify(report, null, 2));
    console.log('\nBlind draw saved.');
}

main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
