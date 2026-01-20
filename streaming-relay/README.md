# BRDC Streaming Relay

WebSocket server that receives video chunks from the Stream Director and pushes to RTMP (YouTube Live, Twitch).

## Architecture

```
[Browser: stream-director.html]
    |
    | Canvas → MediaRecorder → WebM chunks
    |
    ↓ WebSocket
[Cloud Run: streaming-relay]
    |
    | WebM → FFmpeg → H.264/AAC
    |
    ↓ RTMP
[YouTube/Twitch]
```

## Deployment

### Prerequisites
- Google Cloud CLI (`gcloud`) installed and authenticated
- Docker (for local testing)

### Deploy to Cloud Run

```bash
cd streaming-relay
chmod +x deploy.sh
./deploy.sh
```

Or manually:

```bash
gcloud run deploy brdc-streaming-relay \
  --source . \
  --project brdc-v2 \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --session-affinity
```

### Local Testing

```bash
# Build
docker build -t brdc-streaming-relay .

# Run
docker run -p 8080:8080 brdc-streaming-relay
```

## WebSocket Protocol

### Client → Server

**Start streaming:**
```json
{
  "type": "start",
  "platform": "youtube|twitch",
  "streamKey": "xxxx-xxxx-xxxx-xxxx"
}
```

**Stop streaming:**
```json
{ "type": "stop" }
```

**Ping (keep-alive):**
```json
{ "type": "ping" }
```

**Video data:** Binary WebM chunks from MediaRecorder

### Server → Client

**Stream started:**
```json
{ "type": "started", "platform": "youtube" }
```

**Stream stopped:**
```json
{ "type": "stopped", "code": 0, "bytesProcessed": 123456 }
```

**Progress update:**
```json
{ "type": "progress", "frames": 1234, "fps": 29.97 }
```

**Error:**
```json
{ "type": "error", "message": "Error description" }
```

**Pong:**
```json
{ "type": "pong", "timestamp": 1234567890 }
```

## Stream Settings

- Input: WebM (VP8 video, Opus audio)
- Output: FLV (H.264 video, AAC audio)
- Video bitrate: 4500 kbps
- Audio bitrate: 128 kbps
- Resolution: Passthrough from source (1920x1080)
- Frame rate: Passthrough (30 fps)

## Supported Platforms

| Platform | RTMP URL |
|----------|----------|
| YouTube | rtmp://a.rtmp.youtube.com/live2 |
| Twitch | rtmp://live.twitch.tv/app |

## Health Check

```bash
curl https://brdc-streaming-relay-586498498498.us-central1.run.app/health
```

Response:
```json
{
  "status": "healthy",
  "activeSessions": 0,
  "uptime": 12345.678
}
```
