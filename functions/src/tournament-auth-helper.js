const admin = require('firebase-admin');
const { verifyFirebaseAuth } = require('./firebase-auth-helper');

const db = admin.firestore();

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function pickLegacyPin(req) {
    return req.body?.director_pin
        || req.body?.admin_pin
        || req.query?.director_pin
        || req.query?.admin_pin
        || null;
}

function isTournamentStaff(tournament, playerId) {
    if (!playerId || !tournament) return false;

    const staffLists = [
        tournament.staff_player_ids,
        tournament.staff_ids,
        tournament.cohost_player_ids,
        tournament.co_host_player_ids,
        tournament.admin_player_ids
    ];

    return staffLists.some(list => Array.isArray(list) && list.includes(playerId));
}

function getRoleFromTournament(tournament, authPlayer) {
    if (!tournament || !authPlayer) return null;

    if (authPlayer.is_admin) return 'admin';

    if (tournament.director_player_id && tournament.director_player_id === authPlayer.id) {
        return 'host';
    }

    if (tournament.host_player_id && tournament.host_player_id === authPlayer.id) {
        return 'host';
    }

    if (tournament.created_by_player_id && tournament.created_by_player_id === authPlayer.id) {
        return 'host';
    }

    if (tournament.director_firebase_uid && tournament.director_firebase_uid === authPlayer.firebase_uid) {
        return 'host';
    }

    const tournamentEmail = normalizeEmail(tournament.director_email);
    const playerEmail = normalizeEmail(authPlayer.email);
    if (tournamentEmail && playerEmail && tournamentEmail === playerEmail) {
        return 'host';
    }

    if (isTournamentStaff(tournament, authPlayer.id)) {
        return 'staff';
    }

    return null;
}

async function getTournamentContext(tournamentId) {
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();
    if (!tournamentDoc.exists) {
        return null;
    }
    return {
        tournamentRef,
        tournamentDoc,
        tournament: tournamentDoc.data()
    };
}

async function requireTournamentAccess(req, tournamentId, options = {}) {
    const {
        allowLegacyPin = true,
        allowedRoles = ['host', 'staff', 'admin']
    } = options;

    const context = await getTournamentContext(tournamentId);
    if (!context) {
        const err = new Error('Tournament not found');
        err.status = 404;
        throw err;
    }

    const authPlayer = await verifyFirebaseAuth(req);
    const authRole = getRoleFromTournament(context.tournament, authPlayer);

    if (authRole && allowedRoles.includes(authRole)) {
        return {
            ...context,
            authPlayer,
            access_mode: 'firebase_auth',
            role: authRole
        };
    }

    const legacyPin = allowLegacyPin ? pickLegacyPin(req) : null;
    if (legacyPin && context.tournament.director_pin && context.tournament.director_pin === legacyPin) {
        return {
            ...context,
            authPlayer,
            access_mode: 'legacy_pin',
            role: 'host'
        };
    }

    const err = new Error(authPlayer ? 'Forbidden' : 'Unauthorized');
    err.status = authPlayer ? 403 : 401;
    throw err;
}

module.exports = {
    getTournamentContext,
    requireTournamentAccess,
    getRoleFromTournament
};
