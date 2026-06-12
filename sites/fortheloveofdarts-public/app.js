// PWA client. Connects to the relay which proxies the DartConnect SSE stream,
// parses the event JSON, narrates with the browser's speech synthesis, and
// renders a glance-able scoreboard plus a live-events sidebar.

const RELAY_BASE = (() => {
  const m = document.querySelector('meta[name="dcn-relay-base"]');
  const v = m && m.content ? m.content.trim() : '';
  return (v || location.origin).replace(/\/$/, '');
})();
const RELAY = RELAY_BASE + '/relay';
const EVENTS_API = RELAY_BASE + '/events';
const MATCHES_API = (id) => RELAY_BASE + '/event/' + encodeURIComponent(id) + '/matches';

const $ = (id) => document.getElementById(id);
const $url      = $('url');
const $listen   = $('listen');
const $status   = $('status');
const $log      = $('log');
const $voice    = $('voice');
const $sb       = $('scoreboard');
const $events   = $('events');
const $matches  = $('matches');
const $matchesWrap = $('matches-wrap');
const $matchesLabel = $('matches-label');
const $refresh  = $('refresh-events');
const $sbControls = $('sb-controls');
const $prevMatch = $('prev-match');
const $nextMatch = $('next-match');
const $pause    = $('pause');

let es = null;
let active = false;          // SSE connected
let muted = false;           // narration muted (SSE still flows for scoreboard)
let prev = null;
let introducedMatch = null;
let voices = [];
let chosenVoice = null;
let lastEventList = [];
let activeEventId = null;
let activeEventKind = null;  // 'event' | 'league'
let activeWatchCode = null;
let activeMatchList = [];    // list of watch codes currently shown in #matches
let lastMsg = null;

// ---------------- Voice ----------------
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
  const saved = localStorage.getItem('dcn-voice-name');
  const idx = saved ? voices.findIndex((v) => v.name === saved) : 0;
  $voice.value = String(Math.max(0, idx));
  chosenVoice = voices[Number($voice.value)] || voices[0];
}
$voice.addEventListener('change', () => {
  chosenVoice = voices[Number($voice.value)] || null;
  if (chosenVoice) localStorage.setItem('dcn-voice-name', chosenVoice.name);
});
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function say(text) {
  if (!text || muted) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    if (chosenVoice) u.voice = chosenVoice;
    u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
    speechSynthesis.speak(u);
  } catch (_) {}
}

// ---------------- Log ----------------
function logRow(text) {
  const row = document.createElement('div');
  row.className = 'row';
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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

// ---------------- Helpers ----------------
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
function teamShortName(o) {
  // For scoreboard: surnames only when there are multiple players
  const fns = (o?.first_name || []).filter(Boolean);
  const lns = (o?.last_name || []).filter(Boolean);
  if (!fns.length) return 'Player';
  if (fns.length === 1) return [fns[0], lns[0]].filter(Boolean).join(' ');
  return lns.length ? lns.join(' / ') : fns.join(' / ');
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

// ---------------- Scoreboard ----------------
function renderScoreboard(msg) {
  const ed = msg?.extended_details?.contents;
  if (!ed) return;
  const oppos = [ed.oppo_0, ed.oppo_1];
  if (!oppos[0] || !oppos[1]) return;
  const currentSide = ed.current_player; // 0 or 1
  const tournament = ed.tournament_name || '';
  const eventLabel = ed.bracket_info?.event_label || '';
  const race = ed.leg_race || ed.legDesc || '';
  const startScore = ed.game_options?.starting_score;

  const headBits = [eventLabel, race].filter(Boolean).join(' · ');
  const headHtml = `
    <div class="hint" style="margin-bottom: 8px; font-size: 11px;">
      ${escapeHtml(tournament)}${headBits ? ' · ' + escapeHtml(headBits) : ''}
    </div>`;

  const rowHtml = (o, idx) => {
    const isActive = idx === currentSide;
    const fns = (o.first_name || []).filter(Boolean);
    const lns = (o.last_name || []).filter(Boolean);
    let nameHtml;
    if (fns.length === 1) {
      nameHtml = escapeHtml([fns[0], lns[0]].filter(Boolean).join(' '));
    } else {
      // multi-player: highlight active player
      const active = isActive ? (o.active_player ?? 0) : -1;
      nameHtml = fns.map((f, i) => {
        const full = escapeHtml([f, lns[i]].filter(Boolean).join(' '));
        return i === active
          ? `<span class="active-marker">▸</span><b>${full}</b>`
          : `<span style="color: var(--muted)">${full}</span>`;
      }).join(' / ');
    }
    const remaining = o.current_score != null ? o.current_score : (startScore || '—');
    const last = o.last_score != null ? o.last_score : '—';
    const legs = o.leg_score ?? 0;
    const sets = o.set_score ?? 0;
    const showSets = sets > 0 || idx === 0 && oppos[1].set_score > 0; // only show sets if any side has them

    return `
      <div class="row ${isActive ? 'active' : ''}">
        <div class="head">
          <div class="name">${nameHtml}</div>
        </div>
        <div class="body">
          <div class="remaining">${remaining}</div>
          <div class="meta">
            <strong>Legs ${legs}</strong>${showSets ? ` · Sets ${sets}` : ''}<br>
            Last visit: <strong>${last}</strong>
          </div>
        </div>
      </div>`;
  };

  $sb.innerHTML = headHtml + rowHtml(oppos[0], 0) + rowHtml(oppos[1], 1);
}
function clearScoreboard() {
  $sb.innerHTML = '<div class="sb-empty">Pick a match to start narrating.</div>';
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------- Narrator ----------------
function onMsg(msg) {
  lastMsg = msg;
  renderScoreboard(msg);
  if (!active) return;
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
    logRow(txt); say(txt);
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
      flashSide(i);
    }
    if (c.leg_score > p.leg_score) {
      const thrower = throwerName(oppos[i], p.turn_count);
      const checkout = ed.winning_dart ? ` Checked out on ${pretty(ed.winning_dart)}.` : '';
      const txt = `Leg to ${thrower}.${checkout} Legs ${cur[0].leg_score} to ${cur[1].leg_score}.`;
      logRow(txt); say(txt);
      flashSide(i);
    }
    if (c.set_score > p.set_score) {
      const txt = `Set to team ${i + 1}. Sets ${cur[0].set_score} to ${cur[1].set_score}.`;
      logRow(txt); say(txt);
      flashSide(i);
    }
  });
}

function flashSide(i) {
  const rows = $sb.querySelectorAll('.row');
  const row = rows[i];
  if (!row) return;
  row.classList.remove('flash');
  // force reflow so the animation re-fires
  void row.offsetWidth;
  row.classList.add('flash');
  setTimeout(() => row.classList.remove('flash'), 800);
}

// ---------------- Listen control ----------------
function isPlausibleInput(input) {
  const s = (input || '').trim();
  if (!s) return false;
  return (
    /^https?:\/\/tv\.dartconnect\.com\/(broadcast\/alley\/\d+\/stream|live\/[A-Za-z0-9]+)/.test(s) ||
    /^[A-Za-z0-9]{4,10}$/.test(s) ||
    /^\d{2,8}$/.test(s)
  );
}
function startListen(inputOverride) {
  const input = (inputOverride || $url.value || '').trim();
  if (!isPlausibleInput(input)) {
    setStatus('Pick a match from the list, or paste a watch code.', 'error');
    return;
  }
  if (!inputOverride) localStorage.setItem('dcn-last-url', input);

  try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch (_) {}
  if (es) { try { es.close(); } catch (_) {} }
  prev = null;
  introducedMatch = null;
  lastMsg = null;
  active = true;
  muted = false;
  $listen.textContent = '🔇 Stop';
  $listen.classList.add('live');
  $sbControls.style.display = '';
  $pause.textContent = '🔈 Mute';
  $pause.classList.remove('muted');
  updateNavArrows();
  setStatus('Connecting…');

  const relayUrl = RELAY + '?url=' + encodeURIComponent(input);
  es = new EventSource(relayUrl);
  es.addEventListener('open',  () => setStatus('Live. Listening for throws.', 'live'));
  es.addEventListener('error', () => setStatus('Connection hiccup — auto-reconnecting…', 'error'));
  es.addEventListener('relay-error', (e) => { setStatus('Relay error: ' + e.data, 'error'); stopListen(); });
  es.addEventListener('message', (e) => {
    let data; try { data = JSON.parse(e.data); } catch { return; }
    onMsg(data);
  });
}
function stopListen() {
  active = false;
  muted = false;
  if (es) { try { es.close(); } catch (_) {} es = null; }
  $listen.textContent = '🔊 Listen';
  $listen.classList.remove('live');
  $sbControls.style.display = 'none';
  setStatus('Stopped.');
  try { speechSynthesis.cancel(); } catch (_) {}
  clearScoreboard();
  // refresh listening highlight in match list
  Array.from(document.querySelectorAll('#matches .item.listening'))
    .forEach((el) => el.classList.remove('listening'));
}
$listen.addEventListener('click', () => active ? stopListen() : startListen());

// Pause/resume narration without disconnecting the SSE.
$pause.addEventListener('click', () => {
  muted = !muted;
  $pause.textContent = muted ? '🔇 Muted (tap to unmute)' : '🔈 Mute';
  $pause.classList.toggle('muted', muted);
  if (muted) { try { speechSynthesis.cancel(); } catch (_) {} }
});

// Cycle through the live matches in the active event.
function jumpToMatch(delta) {
  if (!activeMatchList.length || !activeWatchCode) return;
  const idx = activeMatchList.indexOf(activeWatchCode);
  if (idx < 0) return;
  const next = activeMatchList[(idx + delta + activeMatchList.length) % activeMatchList.length];
  if (!next || next === activeWatchCode) return;
  activeWatchCode = next;
  $url.value = next;
  startListen(next);
  // Highlight in the match list
  Array.from(document.querySelectorAll('#matches .item')).forEach((el) => {
    el.classList.toggle('listening', el.dataset.sk === next);
  });
}
$prevMatch.addEventListener('click', () => jumpToMatch(-1));
$nextMatch.addEventListener('click', () => jumpToMatch(1));

function updateNavArrows() {
  const enable = activeMatchList.length > 1 && activeMatchList.includes(activeWatchCode);
  $prevMatch.disabled = !enable;
  $nextMatch.disabled = !enable;
}

// Restore last URL into the paste input
const last = localStorage.getItem('dcn-last-url');
if (last) $url.value = last;

// ---------------- Browse: events list ----------------
async function loadEvents() {
  $events.innerHTML = '<div class="hint" style="text-align:center; padding: 12px;">Loading events…</div>';
  try {
    const r = await fetch(EVENTS_API + '?org=dartconnect');
    if (!r.ok) throw new Error('events HTTP ' + r.status);
    const data = await r.json();
    const live = data.live || [];
    lastEventList = live;
    renderEvents(live);
  } catch (e) {
    $events.innerHTML = `<div class="hint" style="text-align:center; padding: 12px; color: var(--red);">Couldn't load events: ${escapeHtml(e.message)}</div>`;
  }
}
function renderEvents(events) {
  if (!events.length) {
    $events.innerHTML = '<div class="hint" style="text-align:center; padding: 12px;">No live events right now.</div>';
    return;
  }
  $events.innerHTML = events.map((e) => `
    <div class="item ${e.id === activeEventId ? 'active' : ''}" data-id="${escapeHtml(e.id)}" data-kind="${escapeHtml(e.kind)}">
      <div class="title">${escapeHtml(e.title)}</div>
      <div class="sub">
        <span class="badge live">${e.count} live</span>
        ${e.country ? '· ' + escapeHtml(e.country.toUpperCase()) : ''}
        ${e.kind === 'league' ? '· league' : ''}
      </div>
    </div>
  `).join('');
  Array.from($events.querySelectorAll('.item')).forEach((el) => {
    el.addEventListener('click', () => {
      loadEventMatches(el.dataset.id, el.dataset.kind);
    });
  });
}
$refresh.addEventListener('click', () => {
  loadEvents();
  if (activeEventId) loadEventMatches(activeEventId);
});

// ---------------- Browse: matches in event ----------------
async function loadEventMatches(eventId, kind) {
  activeEventId = eventId;
  activeEventKind = kind || 'event';
  Array.from($events.querySelectorAll('.item')).forEach((el) => {
    el.classList.toggle('active', el.dataset.id === eventId);
  });
  $matchesWrap.style.display = '';
  const event = lastEventList.find((e) => e.id === eventId);
  $matchesLabel.textContent = event ? (event.title || event.dctv_title || event.event_title || eventId) : eventId;
  $matches.innerHTML = '<div class="hint" style="text-align:center; padding: 12px;">Loading matches…</div>';
  const apiUrl = activeEventKind === 'league'
    ? RELAY_BASE + '/league/' + encodeURIComponent(eventId) + '/matches'
    : MATCHES_API(eventId);
  try {
    const r = await fetch(apiUrl);
    if (!r.ok) throw new Error('matches HTTP ' + r.status);
    const data = await r.json();
    renderMatches(data.matches_live || []);
  } catch (e) {
    $matches.innerHTML = `<div class="hint" style="text-align:center; padding: 12px; color: var(--red);">Couldn't load matches: ${escapeHtml(e.message)}</div>`;
  }
}
function renderMatches(list) {
  // Track watch codes for prev/next nav.
  activeMatchList = list.map((m) => m.sk).filter(Boolean);
  updateNavArrows();
  if (!list.length) {
    $matches.innerHTML = '<div class="hint" style="text-align:center; padding: 12px;">No live matches in this event.</div>';
    return;
  }
  // Sort: live (sta=O) first, then waiting/queued
  list = list.slice().sort((a, b) => {
    const aLive = a.sta === 'O' ? 0 : 1;
    const bLive = b.sta === 'O' ? 0 : 1;
    return aLive - bLive;
  });
  $matches.innerHTML = list.map((m) => {
    const isLive = m.sta === 'O';
    const isListening = m.sk && m.sk === activeWatchCode;
    const home = stripHtml(m.hcf || m.hc);
    const away = stripHtml(m.acf || m.ac);
    const score = `${m.hs || 0}-${m.as || 0}`;
    const round = m.mr || m.r || '';
    const board = m.bns ? `Board ${m.bns}` : '';
    const event = m.el || '';
    return `
      <div class="item ${isListening ? 'listening' : ''}" data-sk="${escapeHtml(m.sk || '')}">
        <div class="vs"><span style="color:var(--text)">${escapeHtml(home)}</span><span>vs</span><span style="color:var(--text)">${escapeHtml(away)}</span></div>
        <div class="sub">
          ${isLive ? '<span class="badge live">live</span>' : '<span class="badge queued">queued</span>'}
          ${score} · ${escapeHtml(round)} · ${escapeHtml(board)} · ${escapeHtml(event)}
        </div>
      </div>`;
  }).join('');
  Array.from($matches.querySelectorAll('.item')).forEach((el) => {
    el.addEventListener('click', () => {
      const sk = el.dataset.sk;
      if (!sk) return;
      activeWatchCode = sk;
      Array.from($matches.querySelectorAll('.item.listening')).forEach((x) => x.classList.remove('listening'));
      el.classList.add('listening');
      $url.value = sk;
      startListen(sk);
    });
  });
}

function stripHtml(s) {
  return String(s || '').replace(/<br\s*\/?>(\s*)/gi, ' / ').replace(/<[^>]+>/g, '').trim();
}

// ---------------- Init ----------------
loadEvents();
// Auto-refresh events every 30s and current matches every 10s when nothing is selected
setInterval(() => loadEvents(), 30_000);
setInterval(() => { if (activeEventId) loadEventMatches(activeEventId, activeEventKind); }, 10_000);

// PWA install
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
