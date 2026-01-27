# BRDC Live Stream How-To Guide

**Last Updated:** 2026-01-26

This guide covers how to set up and use the live streaming features in BRDC for broadcasting darts matches to platforms like YouTube Live and Twitch.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Prerequisites](#prerequisites)
4. [Available Pages](#available-pages)
5. [Stream Director Setup](#stream-director-setup)
6. [Camera Source Setup](#camera-source-setup)
7. [TV Display for Venues](#tv-display-for-venues)
8. [Live Scoreboard Display](#live-scoreboard-display)
9. [Live Match Viewer](#live-match-viewer)
10. [Streaming to YouTube/Twitch](#streaming-to-youtubetwitch)
11. [Troubleshooting](#troubleshooting)

---

## Overview

BRDC includes a browser-based live streaming system that allows you to:

- **Capture video** from multiple camera sources (board camera, thrower camera)
- **Composite feeds** into a single output with multiple layout options
- **Overlay live scores** on the stream
- **Broadcast directly** to YouTube Live or Twitch
- **Display scores** on venue TVs for spectators
- **Provide real-time match viewing** for remote viewers

The system uses WebRTC for peer-to-peer camera connections and MediaRecorder for capturing the composite output.

---

## System Architecture

```
+------------------+      WebRTC        +------------------+
|  Camera Source   | ----------------> |  Stream Director |
|  (Phone/Tablet)  |                   |   (Main PC)      |
+------------------+                   +------------------+
                                              |
+------------------+      WebRTC        |     | Canvas
|  Camera Source   | ----------------> |     | Composite
|  (Phone/Tablet)  |                   |     v
+------------------+               +------------------+
                                   | MediaRecorder    |
                                   | WebM/VP8         |
                                   +------------------+
                                          |
                                          | WebSocket
                                          v
                                   +------------------+
                                   | Relay Server     |
                                   | (Cloud Run)      |
                                   +------------------+
                                          |
                                          | RTMP
                                          v
                                   +------------------+
                                   | YouTube/Twitch   |
                                   +------------------+
```

### Data Flow

1. **Camera devices** (phones/tablets) open the Camera Source page
2. **Stream Director** (main computer) creates a session with a 6-character code
3. Camera operators enter the session code to connect their video feeds
4. **WebRTC** streams video from cameras to the director's browser
5. Director's browser **composites** the feeds on a canvas (1920x1080)
6. **MediaRecorder** captures the canvas at 30fps as WebM
7. Video chunks are sent via **WebSocket** to the relay server
8. Relay server uses **FFmpeg** to transcode and push to YouTube/Twitch via **RTMP**

---

## Prerequisites

### Hardware Requirements

| Component | Recommended | Minimum |
|-----------|-------------|---------|
| Stream Director PC | Modern laptop/desktop with good CPU | Any device with modern browser |
| Camera Devices | Smartphones or tablets (2 devices ideal) | 1 camera device |
| Network | Stable WiFi (5GHz preferred) | Any internet connection |
| TV Display (optional) | Any TV with browser or HDMI input | - |

### Software Requirements

- **Modern web browser** (Chrome, Edge, or Firefox recommended)
- **YouTube Studio** or **Twitch Dashboard** account for streaming
- Stream key from your chosen platform

### Accounts Needed

- **YouTube Live**: Google account with live streaming enabled (requires phone verification, 24hr wait for new accounts)
- **Twitch**: Twitch account with stream key from dashboard

---

## Available Pages

| Page | URL | Purpose |
|------|-----|---------|
| Stream Director | `/pages/stream-director.html` | Main control panel for compositing and broadcasting |
| Camera Source | `/pages/stream-camera.html` | Connect camera devices to stream |
| Matchmaker TV | `/pages/matchmaker-tv.html?tournament_id=XXX` | Venue TV display for Matchmaker tournaments |
| Live Scoreboard | `/pages/live-scoreboard.html` | Aggregated view of all live matches |
| Live Match | `/pages/live-match.html?league_id=XXX&match_id=XXX` | Real-time match viewer with chat |

---

## Stream Director Setup

The Stream Director is the central control hub for your live stream.

### Step 1: Open Stream Director

Navigate to: `https://brdc-v2.web.app/pages/stream-director.html`

### Step 2: Create a Session

1. Click **CREATE SESSION**
2. A 6-character session code will be generated (e.g., `AB34XY`)
3. Share this code with your camera operators

### Step 3: Wait for Camera Connections

The page shows two camera slots:
- **Board Camera**: Wide shot of the dartboard
- **Thrower Camera**: Close-up of the player throwing

When cameras connect, their status will change from "Waiting" to "Connected" with a teal border.

### Step 4: Configure Layout

Choose from four layout options:

| Layout | Description |
|--------|-------------|
| **Side by Side** | Board on left, thrower on right (50/50 split) |
| **Board + PIP** | Full-screen board with small thrower in corner |
| **Thrower + PIP** | Full-screen thrower with small board in corner |
| **Board Only** | Just the board camera, full screen |

### Step 5: Configure Overlay (Optional)

Toggle **Show Scorer Overlay** to add:
- Player names at bottom
- Live scores
- BRDC branding

Select a **Match Source** to link live scoring data (if available).

### Step 6: Preview Output

The main preview area shows exactly what will be broadcast:
- 1920x1080 resolution
- All camera feeds composited
- Overlay graphics (if enabled)

---

## Camera Source Setup

Camera operators use the Camera Source page to send their video to the Stream Director.

### Step 1: Open Camera Source

On each camera device, navigate to: `https://brdc-v2.web.app/pages/stream-camera.html`

### Step 2: Select Camera Role

Choose one:
- **Board Camera (Wide Shot)**: For the main dartboard view
- **Thrower Camera (Close Up)**: For the player/throwing angle

### Step 3: Select Camera Device

The page will request camera permission. Choose which camera to use:
- Front-facing camera
- Rear-facing camera
- External USB camera (if connected)

### Step 4: Enter Session Code

1. Get the 6-character code from the Stream Director
2. Enter it in the **Session Code** field
3. Tap **Connect**

### Step 5: Verify Connection

- Status badge should change to **Connected** (green)
- You should see your video preview
- The Stream Director should now show your feed

### Tips for Camera Operators

- **Keep the device stable** - use a tripod or phone mount
- **Ensure good lighting** on the dartboard
- **Landscape orientation** is preferred for the output
- **Keep the app in foreground** - don't switch apps or lock screen

---

## TV Display for Venues

The Matchmaker TV display is designed for large screens at venues during Matchmaker tournaments.

### Setup

1. Navigate to: `https://brdc-v2.web.app/pages/matchmaker-tv.html?tournament_id=YOUR_TOURNAMENT_ID`
2. Add URL parameters:
   - `tournament_id` (required): The tournament ID from Firebase
   - `mode` (optional): Display mode (see below)

### Display Modes

| Mode | URL Parameter | Description |
|------|--------------|-------------|
| Bracket View | `mode=bracket` | Shows tournament bracket with live scores |
| Partner Reveal | `mode=partner-reveal` | Animated team announcements |
| Match Call | `mode=match-call` | Shows current matches and board assignments |
| Mingle Alert | `mode=heartbreaker-alert` | Countdown timer for mingle periods |

### Director Control

Tournament directors can control the TV display mode from the **Matchmaker Director** page:

1. Go to `/pages/matchmaker-director.html`
2. Navigate to the **TV DISPLAY** tab
3. Click buttons to switch between modes
4. Click **OPEN TV DISPLAY (NEW WINDOW)** to launch the display

### Full URL Example

```
https://brdc-v2.web.app/pages/matchmaker-tv.html?tournament_id=abc123&mode=bracket
```

---

## Live Scoreboard Display

The Live Scoreboard shows all active matches across leagues and tournaments.

### URL

`https://brdc-v2.web.app/pages/live-scoreboard.html`

### Features

- **Real-time updates** via Firestore listeners
- **Filter by type**: All, Leagues, or Tournaments
- **Auto-scroll** mode for unattended displays
- **TV Mode** for larger text (add `?tv=1` or press `T`)
- **Fullscreen** support (press `F`)

### URL Parameters

| Parameter | Effect |
|-----------|--------|
| `?tv=1` | Enable TV mode with larger fonts |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `T` | Toggle TV mode |
| `F` | Toggle fullscreen |

---

## Live Match Viewer

The Live Match page provides detailed real-time viewing of a single match.

### URL Format

```
/pages/live-match.html?league_id=XXX&match_id=YYY
```

### Features

- **Live scoreboard** with team scores
- **Current leg display** showing remaining points
- **Throw-by-throw updates** in a table view
- **Match chat** for spectators (requires login)
- **Quick reactions** for celebrating great shots
- **Viewer count** showing how many are watching
- **Match stats sidebar** showing 180s, averages, etc.

### Linking to Live Match

Share the URL with viewers:
```
https://brdc-v2.web.app/pages/live-match.html?league_id=abc123&match_id=xyz789
```

---

## Streaming to YouTube/Twitch

### Getting Your Stream Key

**YouTube Live:**
1. Go to [YouTube Studio](https://studio.youtube.com)
2. Click **Create** > **Go Live**
3. Under Stream settings, copy your **Stream key**

**Twitch:**
1. Go to [Twitch Dashboard](https://dashboard.twitch.tv)
2. Navigate to **Settings** > **Stream**
3. Click **Copy** next to your Primary Stream key

### Connecting to the Relay Server

1. In Stream Director, expand **Relay Server Settings**
2. The default relay URL is pre-configured
3. Click **Connect**
4. Wait for status to show **Relay: Connected**

### Going Live

1. Select your **Platform** (YouTube Live or Twitch)
2. Paste your **Stream Key**
3. Click **GO LIVE**
4. The LIVE badge will appear and pulse
5. Your stream should appear on your platform within 10-30 seconds

### Stopping the Stream

1. Click **STOP STREAM**
2. The relay connection will close
3. Your platform may take a moment to end the stream

### Stream Stats

While live, monitor these metrics:
- **Frame Rate**: Target 30 fps
- **Stream Bitrate**: ~4500 kbps for good quality
- **Data Sent**: Total MB uploaded

---

## Troubleshooting

### Camera Won't Connect

| Issue | Solution |
|-------|----------|
| Camera permission denied | Allow camera access in browser settings |
| Session code invalid | Verify the code matches exactly (case-sensitive) |
| Connection stuck on "Connecting" | Check WiFi, try refreshing both pages |
| Wrong camera selected | Use the camera dropdown to switch devices |

### Video Quality Issues

| Issue | Solution |
|-------|----------|
| Pixelated video | Improve lighting on the dartboard |
| Laggy/stuttering | Check network bandwidth, reduce other device usage |
| Video freezes | Camera device may have switched apps; bring back to foreground |
| Dark image | Ensure adequate lighting; avoid backlighting |

### Streaming Issues

| Issue | Solution |
|-------|----------|
| Relay won't connect | Check the relay URL, verify server is running |
| Stream not appearing on platform | Verify stream key is correct, check platform dashboard |
| Stream keeps disconnecting | Check internet stability, may need better connection |
| Low bitrate warning | Reduce video quality or improve upload speed |

### Audio Issues

| Issue | Solution |
|-------|----------|
| No audio | Current system streams silent audio; add mic separately if needed |
| Echo/feedback | Mute speakers on camera devices |

### General Tips

1. **Test before going live**: Do a dry run to verify all connections
2. **Use 5GHz WiFi**: More bandwidth and less interference
3. **Keep devices plugged in**: Streaming drains battery quickly
4. **Have a backup plan**: Keep phone data as fallback
5. **Monitor the output**: Watch the preview to catch issues early

---

## Technical Reference

### Session Data (Firestore)

Streaming sessions are stored in `streaming_sessions/{sessionId}`:

```javascript
{
  created_at: Timestamp,
  status: 'active',
  layout: 'side-by-side'
}
```

Subcollections:
- `offers/{role}` - WebRTC offers from cameras
- `answers/{role}` - WebRTC answers from director
- `ice_candidates` - ICE candidates for connection negotiation

### Video Specifications

| Setting | Value |
|---------|-------|
| Resolution | 1920 x 1080 |
| Frame Rate | 30 fps |
| Video Codec | VP8 (WebM container) |
| Video Bitrate | ~4.5 Mbps |
| Audio Codec | Opus |
| Audio Bitrate | 128 kbps |

### Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 80+ | Full support |
| Edge 80+ | Full support |
| Firefox 75+ | Full support |
| Safari 14+ | Partial (WebRTC issues possible) |
| Mobile Chrome | Full support |
| Mobile Safari | Limited (background tab issues) |

---

## Quick Start Checklist

- [ ] Stream Director PC with Chrome browser ready
- [ ] Two camera devices (phones/tablets) charged
- [ ] Good WiFi connection for all devices
- [ ] Tripods or mounts for cameras
- [ ] Adequate lighting on dartboard
- [ ] YouTube/Twitch stream key obtained
- [ ] Test run completed before event

---

## Related Pages

- [PAGES.md](./PAGES.md) - Complete page inventory
- [DATA-STRUCTURE.md](./DATA-STRUCTURE.md) - Firestore database structure
- [FUNCTIONS.md](./FUNCTIONS.md) - Cloud Functions reference

---

## Support

For issues with the BRDC streaming system, check:
1. Browser console for JavaScript errors
2. Network tab for failed requests
3. Firestore for session document status

For platform-specific issues (YouTube/Twitch), consult their respective help centers.
