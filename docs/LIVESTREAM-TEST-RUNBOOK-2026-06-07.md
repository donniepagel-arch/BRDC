# Livestream + Auto-Score — Test Runbook (2026-06-07)

State after investigation (this session):
- **Relay server: LIVE.** `wss://brdc-streaming-relay-726670872282.us-central1.run.app` returns HTTP 200
  (Cloud Run; WebSocket → FFmpeg → RTMP to YouTube/Twitch/Facebook). Code in `streaming-relay/`.
- **Score-assist relay: VERIFIED working** (data layer). Board phone writes
  `streaming_sessions/{code}/autoscore_candidates`; the scorer's `onSnapshot` receives it live and
  "Apply" calls `submitScore()`. Confirmed with a live round-trip on the Android device 2026-06-07.
- **"Auto-score" is MANUAL** — the board phone operator *types* the score (no computer vision). See
  `AUTO-SCORE-CV-SCOPE-2026-06-07.md` for the net-new CV build.
- **Not surfaced in vNext nav** — stream pages are reached by direct URL only.
- **End-to-end video path: NOT yet tested** — this runbook is for that.

## #1 — Data-path test (DONE ✅)
Board-phone→scorer relay verified live (write candidate → subscriber receives → Apply submits).
No hardware needed; re-run anytime via a Firestore write to
`streaming_sessions/<code>/autoscore_candidates` while the scorer subscribes to the same `<code>`.

## #2 — Guided live VIDEO test (needs your hardware)

You need: 1 PC (Chrome) as director, 2 phones/tablets (board-cam + thrower-cam), stable 5GHz WiFi,
and a YouTube **or** Twitch **stream key**. Pages live under the site `/pages/…` (the HOWTO references
`brdc-v2.web.app`; they should also serve from the apex — confirm the URL loads before the event).

**Step 1 — Director (PC):** open `/pages/stream-director.html` → **CREATE SESSION** → note the
6-char code (e.g. `AB34XY`). Two camera slots show "Waiting": Board + Thrower.

**Step 2 — Cameras (each phone/tablet):** open `/pages/stream-camera.html` → pick a role
(**Board Camera** on the phone aimed at the board; **Thrower Camera** on the tablet) → grant camera
permission, pick the lens → enter the 6-char code → **Connect**. Director slot should flip to
"Connected" (teal). Repeat on the 2nd device with the other role.

**Step 3 — Composite check:** in Director, pick a **Layout** (Side-by-Side / Board+PIP / etc.),
toggle **Show Scorer Overlay**, and pick a **Match Source** to bind live scores. The 1920×1080
preview should show both feeds + overlay.

**Step 4 — Score assist (optional, the relay we verified):** on the **Board phone**, the "Score
Assist" panel lets the caller enter each score → it appears on the **scorer tablet** as a card →
Apply/Reject. (Scorer must be the **tournament** scorer — assist currently initialises only for
`tournament:<id>:<matchId>`; see note below.)

**Step 5 — Go live:** Director → expand **Relay Server Settings** → URL is pre-filled
(`wss://brdc-streaming-relay-…run.app`) → **Connect** (wait "Relay: Connected") → choose Platform →
paste **Stream Key** → **GO LIVE**. Your YouTube/Twitch should show the stream in ~10–30s.

**Verify:** frame rate ~30fps, bitrate ~4500kbps in Director stats; the composite + overlay appear on
the platform; a score Applied on the scorer updates the overlay.

**Known limitations to expect:** silent audio (add a mic separately); mobile-Safari background tabs
drop the feed (use Chrome, keep app foreground, screen unlocked); Cloud Run may cold-start the relay
on first connect.

**If something fails:** browser console on Director + camera pages; Firestore
`streaming_sessions/<code>` (should have `offers/answers/ice_candidates` subdocs as cameras connect);
relay health = `https://brdc-streaming-relay-726670872282.us-central1.run.app/` (200 = up).

### Gaps worth fixing before a real broadcast (flag)
1. **Score assist only binds for tournament matches** (`initTournamentAutoscoreAssist`, requires
   `tournamentId`+`tournamentMatchId`). League/casual matches don't get the board-phone assist. If you
   want it for league nights, add a league/casual session-code path in the scorer.
2. **No vNext entry point** — add a "Go Live / Stream" link (director/admin only) so it's discoverable.
3. **`brdc_session.player_id` fragility** in `live-match-helper.js` (`LiveMatch.start`) — reads
   `.player_id`, which some sessions don't set (they store `.id`); make it
   `session.player_id || session.id || session.player?.id` so the live-match data broadcast can't
   silently no-op.

---

## SELF-HOSTED ON THE SITE (Option 1 — built 2026-06-07)

No YouTube/Twitch needed — viewers watch on burningriverdarts.com.

**Architecture:** cameras → Stream Director composite → relay → **ffmpeg outputs HLS** →
served at `https://brdc-streaming-relay-…run.app/hls/<id>/index.m3u8` (CORS-open) → viewers play it
via **`/pages/watch-vnext.html?id=<id>`** (hls.js, retries until live). Relay pinned to
`max-instances=1` so ffmpeg's segments + viewer requests share one instance (one match at a time).
~6–12s latency (fine for spectating).

### How to run it
1. Avatar → Manage → **Go live (stream)** → **Create Session** (gives a 6-char code).
2. On each phone: `/pages/stream-camera.html` → role + enter code → Connect (board + thrower).
3. In Stream Director: **Platform = "BRDC Site"** (now the default) → **GO LIVE**.
   (No stream key needed — the session code *is* the stream id.)
4. A **"Watch link"** appears — **Copy link** and share it. It's `…/pages/watch-vnext.html?id=<code>`.
5. Viewers open that link on the site → video plays automatically when you're live; shows
   "Waiting for stream…" and auto-retries before/after.

### Verified (static) 2026-06-07
- Relay redeployed with HLS support (`/health` 200; `/hls/<id>/…` route wired + CORS).
- `watch-vnext.html` live (200), hls.js player with LIVE/Offline pill + auto-retry.
- Director defaults to "BRDC Site", surfaces the shareable watch link on GO LIVE.
- **Not yet tested with real video** — needs the 2 cameras + director (your hardware). That run is
  the true end-to-end test; everything up to it is in place.

### If the video test misbehaves
- Director console + the relay logs (`gcloud run services logs read brdc-streaming-relay --project brdc-v2`).
- Check the manifest directly: open `https://brdc-streaming-relay-…run.app/hls/<code>/index.m3u8`
  while live — it should list `.ts` segments. 404 = ffmpeg isn't producing output (check codec/input).
- Future scale (many simultaneous streams / huge audiences): move HLS segments to Cloud Storage + CDN
  and lift `max-instances`.

### ✅ DEVICE-PROVEN end-to-end (Android, 2026-06-07)
Ran a synthetic stream on the real Android Chrome (canvas → MediaRecorder WebM → WebSocket → relay)
and played it back via hls.js in the same browser:
- `bytesSent 151175`, relay produced a valid HLS manifest with `.ts` segments,
  `hls.js manifestParsed: true`, **video played — `currentTime` advanced to 8.51s**, no errors.
- This proves: **browser → relay → ffmpeg → HLS → hls.js playback** all work on hardware.
- The ONLY hop not covered by this synthetic test is the camera→director **WebRTC** handshake
  (pre-existing). Its output is the same `MediaRecorder→relay` link proven here, feeding the same
  `watch-vnext.html` player proven here — so a real 2-camera run should light up cleanly.
