// PWA client. Connects to the relay which proxies the DartConnect SSE stream,
// parses the event JSON, and narrates with the browser's speech synthesis.

// Relay endpoint base. Configured via <meta name="dcn-relay-base" content="…">
// in index.html. Empty means same-origin (useful for local dev).
const RELAY_BASE = (() => {
  const m = document.querySelector('meta[name="dcn-relay-base"]');
  const v = m && m.content ? m.content.trim() : '';
  return (v || location.origin).replace(/\/$/, '');
})();
const RELAY = RELAY_BASE + '/relay';

const $url    = document.getElementById('url');
const $listen = document.getElementById('listen');
const $status = document.getElementById('status');
const $log    = document.getElementById('log');
const $voice  = document.getElementById('voice');

let es = null;
let active = false;
let prev = null;
let introducedMatch = null;
let voices = [];
let chosenVoice = null;

// ---------------- Voice selection ----------------
function rankVoice(v) {
  let s = 0;
  if (/(natural|neural|online|premium|enhanced|wavenet)/i.test(v.name)) s += 200;
  if (/^en[-_]/i.test(v.lang)) s += 50;
  if (v.localService === false) s += 25;
  if (/aria|jenny|guy|samantha|karen|daniel/i.test(v.name)) s += 10;
  return s;
}
function loadVoices() {
  voices = speechSynthesis.getVoices().slice().sort((a, b) => rankVoice(b) - rankVoice(a));
  $voice.innerHTML = '';
  if (!voices.length) {
    const o = document.createElement('option');
    o.textContent = 'System default';
    $voice.appendChild(o);
    chosenVoice = null;
    return;
  }
  voices.forEach((v, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${v.name} — ${v.lang}` + (v.default ? ' (default)' : '');
    $voice.appendChild(o);
  });
  // Persist user pick across reloads
  const saved = localStorage.getItem('dcn-voice-name');
  const idx = saved ? voices.findIndex(v => v.name === saved) : 0;
  $voice.value = String(Math.max(0, idx));
  chosenVoice = voices[Number($voice.value)] || voices[0];
}
$voice.addEventListener('change', () => {
  chosenVoice = voices[Number($voice.value)] || null;
  if (chosenVoice) localStorage.setItem('dcn-voice-name', chosenVoice.name);
});
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// ---------------- Speech ----------------
function say(text) {
  if (!text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    if (chosenVoice) u.voice = chosenVoice;
    u.rate = 1.0;
    u.pitch = 1.0;
    speechSynthesis.speak(u);
  } catch (_) {}
}

// ---------------- Log helpers ----------------
function logRow(text) {
  const row = document.createElement('div');
  row.className = 'row';
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = new Date().toLocaleTimeString().replace(/:\d{2}\s/, ' ');
  const body = document.createElement('span');
  body.textContent = text;
  row.appendChild(t);
  row.appendChild(body);
  $log.prepend(row);
  while ($log.children.length > 80) $log.removeChild($log.lastChild);
}
function setStatus(msg, cls) {
  $status.textContent = msg;
  $status.className = 'status' + (cls ? ' ' + cls : '');
}

// ---------------- Input validation ----------------
// The relay does the heavy lifting (watch code → alley id). We just sanity-check
// the input is plausible.
function isPlausibleInput(input) {
  const s = (input || '').trim();
  if (!s) return false;
  return (
    /^https?:\/\/tv\.dartconnect\.com\/(broadcast\/alley\/\d+\/stream|live\/[A-Za-z0-9]+)/.test(s) ||
    /^[A-Za-z0-9]{4,10}$/.test(s) ||
    /^\d{2,8}$/.test(s)
  );
}

// ---------------- Narrator core ----------------
function snap(o) {
  return {
    turn_count: o?.turn_count ?? 0,
    last_score: o?.last_score ?? 0,
    current_score: typeof o?.current_score === 'number' ? o.current_score : null,
    leg_score: o?.leg_score ?? 0,
    set_score: o?.set_score ?? 0,
  };
}
function teamName(o) {
  const fns = (o?.first_name || []).filter(Boolean);
  const lns = (o?.last_name || []).filter(Boolean);
  if (!fns.length) return 'Player';
  if (fns.length === 1) return [fns[0], lns[0]].filter(Boolean).join(' ');
  const parts = fns.map((f, i) => [f, lns[i]].filter(Boolean).join(' '));
  if (parts.length === 2) return parts.join(' and ');
  return parts.slice(0, -1).join(', ') + ', and ' + parts.slice(-1);
}
function throwerName(team, prevTurnCount) {
  const fns = team?.first_name || [];
  const lns = team?.last_name || [];
  const order = team?.player_order || fns.map((_, i) => i);
  const size = Math.max(fns.length, 1);
  const idx = order[prevTurnCount % size] ?? 0;
  return ((fns[idx] || '') + ' ' + (lns[idx] || '')).trim() || 'Player';
}
function pretty(d) {
  if (!d) return '';
  const s = String(d).toUpperCase().trim();
  if (s === 'BULL' || s === 'DB') return 'bullseye';
  if (s === 'SB' || s === '25') return 'twenty-five';
  const m = s.match(/^([TD])?(\d{1,2})$/);
  if (!m) return s;
  const n = parseInt(m[2], 10);
  if (m[1] === 'T') return `triple ${n}`;
  if (m[1] === 'D') return `double ${n}`;
  return String(n);
}

function onMsg(msg) {
  const ed = msg?.extended_details?.contents;
  if (!ed) return;
  const matchId = ed.bracket_info?.match_id || msg?.bracket_match_info?.contents?.match_id;
  const oppos = [ed.oppo_0, ed.oppo_1];
  if (!oppos[0] || !oppos[1]) return;

  if (matchId && matchId !== introducedMatch) {
    introducedMatch = matchId;
    prev = null;
    const teams = oppos.map(teamName);
    const ev = ed.bracket_info?.event_label ? `, ${ed.bracket_info.event_label}` : '';
    const fmt = (ed.leg_race || ed.legDesc) ? `. ${ed.leg_race || ed.legDesc}` : '';
    const txt = `Now playing${ev}: ${teams[0]} versus ${teams[1]}${fmt}.`;
    logRow(txt);
    say(txt);
  }

  const cur = oppos.map(snap);
  const before = prev;
  prev = cur;
  if (!before) return;

  cur.forEach((c, i) => {
    const p = before[i];
    if (!p) return;
    if (c.turn_count > p.turn_count) {
      const thrower = throwerName(oppos[i], p.turn_count);
      const rem = c.current_score != null ? `, ${c.current_score} remaining` : '';
      const txt = `${thrower}, ${c.last_score}${rem}.`;
      logRow(txt); say(txt);
    }
    if (c.leg_score > p.leg_score) {
      const thrower = throwerName(oppos[i], p.turn_count);
      const checkout = ed.winning_dart ? ` Checked out on ${pretty(ed.winning_dart)}.` : '';
      const txt = `Leg to ${thrower}.${checkout} Legs ${cur[0].leg_score} to ${cur[1].leg_score}.`;
      logRow(txt); say(txt);
    }
    if (c.set_score > p.set_score) {
      const txt = `Set to team ${i + 1}. Sets ${cur[0].set_score} to ${cur[1].set_score}.`;
      logRow(txt); say(txt);
    }
  });
}

// ---------------- Connection ----------------
function start() {
  const input = ($url.value || '').trim();
  if (!isPlausibleInput(input)) {
    setStatus('Paste a DartConnect match link or watch code.', 'error');
    return;
  }
  localStorage.setItem('dcn-last-url', input);

  // unlock TTS via this user-gesture click
  try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch (_) {}

  if (es) { try { es.close(); } catch (_) {} }
  prev = null;
  introducedMatch = null;
  active = true;
  $listen.textContent = '🔇 Stop';
  $listen.classList.add('live');
  setStatus('Connecting…');

  const relayUrl = RELAY + '?url=' + encodeURIComponent(input);
  es = new EventSource(relayUrl);
  es.addEventListener('open',  () => setStatus('Live. Listening for throws.', 'live'));
  es.addEventListener('error', () => setStatus('Connection hiccup — auto-reconnecting…', 'error'));
  es.addEventListener('relay-error', (e) => {
    setStatus('Relay error: ' + e.data, 'error');
    stop();
  });
  es.addEventListener('message', (e) => {
    let data;
    try { data = JSON.parse(e.data); } catch { return; }
    onMsg(data);
  });
}
function stop() {
  active = false;
  if (es) { try { es.close(); } catch (_) {} es = null; }
  $listen.textContent = '🔊 Listen';
  $listen.classList.remove('live');
  setStatus('Stopped.');
  try { speechSynthesis.cancel(); } catch (_) {}
}

$listen.addEventListener('click', () => active ? stop() : start());

// Restore last URL
const last = localStorage.getItem('dcn-last-url');
if (last) $url.value = last;

// PWA install. Use a relative URL so the SW scope matches whatever path the
// app is hosted at (e.g. "/narrator/").
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
