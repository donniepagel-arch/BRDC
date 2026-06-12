const fs = require('fs');
const path = require('path');
let admin;
try {
  admin = require('firebase-admin');
} catch (_) {
  admin = require('../functions/node_modules/firebase-admin');
}

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '',
  'firebase',
  'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isPlayerLike(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && (value.id || value.player_id || value.name || value.player_name)
    && !value._seconds;
}

function cleanUndefined(value) {
  if (Array.isArray(value)) return value.map(cleanUndefined);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  Object.entries(value).forEach(([key, val]) => {
    if (val !== undefined) out[key] = cleanUndefined(val);
  });
  return out;
}

function stampValue(value, playerById, playerByName, counters) {
  if (Array.isArray(value)) {
    return value.map(item => stampValue(item, playerById, playerByName, counters));
  }

  if (!value || typeof value !== 'object' || value._seconds) return value;

  let next = {};
  let changed = false;

  if (isPlayerLike(value)) {
    const id = value.id || value.player_id;
    const name = value.name || value.player_name || value.imported_label;
    const player = (id && playerById.get(id)) || playerByName.get(normalizeName(name));

    if (player) {
      const isFillIn = Boolean(player.is_fill_in || player.fill_in || player.team_id === 'fill_in' || player.team_name === 'Fill-In');
      next = {
        ...value,
        id: value.id || player.id,
        name: value.name || player.name,
        level: player.level || value.level || value.skill_level || value.preferred_level || null,
        skill_level: player.skill_level || player.level || value.skill_level || null,
        preferred_level: player.preferred_level || player.level || value.preferred_level || null,
        team_id: player.team_id || null,
        team_name: player.team_name || null,
        is_fill_in: isFillIn,
        fill_in: isFillIn
      };
      changed = true;
      counters.playerRefs++;
      if (isFillIn) counters.fillInRefs++;
    } else {
      next = { ...value };
    }
  } else {
    next = { ...value };
  }

  Object.entries(next).forEach(([key, val]) => {
    const stamped = stampValue(val, playerById, playerByName, counters);
    if (stamped !== val) changed = true;
    next[key] = stamped;
  });

  return changed ? cleanUndefined(next) : value;
}

async function main() {
  const leagueRef = db.collection('leagues').doc(LEAGUE_ID);
  const [playersSnap, matchesSnap, feedSnap] = await Promise.all([
    leagueRef.collection('players').get(),
    leagueRef.collection('matches').get(),
    leagueRef.collection('feed').get()
  ]);

  const playerById = new Map();
  const playerByName = new Map();
  playersSnap.forEach(doc => {
    const player = { id: doc.id, ...doc.data() };
    playerById.set(doc.id, player);
    [player.name, player.player_name, ...(player.aliases || []), ...(player.alt_names || [])]
      .filter(Boolean)
      .forEach(name => playerByName.set(normalizeName(name), player));
  });

  const backup = {
    created_at: new Date().toISOString(),
    league_id: LEAGUE_ID,
    matches: {},
    feed: {}
  };

  const batchLimit = 1;
  let batch = db.batch();
  let pending = 0;
  const counters = {
    matchesScanned: matchesSnap.size,
    matchesUpdated: 0,
    feedScanned: feedSnap.size,
    feedUpdated: 0,
    playerRefs: 0,
    fillInRefs: 0
  };

  async function commitIfNeeded(force = false) {
    if (pending > 0 && (force || pending >= batchLimit)) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  for (const doc of matchesSnap.docs) {
    const original = doc.data();
    const before = JSON.stringify(original);
    const nextCounters = { playerRefs: 0, fillInRefs: 0 };
    const updated = stampValue(original, playerById, playerByName, nextCounters);
    if (JSON.stringify(updated) !== before) {
      backup.matches[doc.id] = original;
      batch.set(doc.ref, updated, { merge: false });
      pending++;
      counters.matchesUpdated++;
      counters.playerRefs += nextCounters.playerRefs;
      counters.fillInRefs += nextCounters.fillInRefs;
      await commitIfNeeded();
    }
  }

  for (const doc of feedSnap.docs) {
    const original = doc.data();
    const before = JSON.stringify(original);
    const nextCounters = { playerRefs: 0, fillInRefs: 0 };
    const updated = stampValue(original, playerById, playerByName, nextCounters);
    if (JSON.stringify(updated) !== before) {
      backup.feed[doc.id] = original;
      batch.set(doc.ref, updated, { merge: false });
      pending++;
      counters.feedUpdated++;
      counters.playerRefs += nextCounters.playerRefs;
      counters.fillInRefs += nextCounters.fillInRefs;
      await commitIfNeeded();
    }
  }

  await commitIfNeeded(true);

  const backupPath = `E:/scribd/brdc-v2-fillin-ref-restamp-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(JSON.stringify({ ...counters, backupPath }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
