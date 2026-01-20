/**
 * BRDC Streaming Relay Server
 *
 * Accepts WebSocket connections from stream-director.html,
 * receives webm video chunks, and pipes to FFmpeg for RTMP output.
 */

const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;

// Active streaming sessions
const sessions = new Map();

// RTMP URLs for platforms
const RTMP_URLS = {
  youtube: 'rtmp://a.rtmp.youtube.com/live2',
  twitch: 'rtmp://live.twitch.tv/app',
  facebook: 'rtmps://live-api-s.facebook.com:443/rtmp'
};

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      activeSessions: sessions.size,
      uptime: process.uptime()
    }));
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('BRDC Streaming Relay Server');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const sessionId = uuidv4();
  console.log(`[${sessionId}] New connection from ${req.socket.remoteAddress}`);

  let ffmpeg = null;
  let platform = null;
  let streamKey = null;
  let isStreaming = false;
  let bytesReceived = 0;

  // Store session
  sessions.set(sessionId, {
    ws,
    startTime: Date.now(),
    bytesReceived: 0
  });

  ws.on('message', (data) => {
    try {
      // Check if this is a control message (JSON) or video data (binary)
      if (typeof data === 'string' || (data instanceof Buffer && data[0] === 0x7b)) {
        // JSON control message
        const message = JSON.parse(data.toString());
        handleControlMessage(message);
      } else {
        // Binary video data
        handleVideoData(data);
      }
    } catch (err) {
      console.error(`[${sessionId}] Error processing message:`, err);
    }
  });

  ws.on('close', () => {
    console.log(`[${sessionId}] Connection closed`);
    stopStream();
    sessions.delete(sessionId);
  });

  ws.on('error', (err) => {
    console.error(`[${sessionId}] WebSocket error:`, err);
    stopStream();
  });

  function handleControlMessage(message) {
    console.log(`[${sessionId}] Control message:`, message.type);

    switch (message.type) {
      case 'start':
        platform = message.platform;
        streamKey = message.streamKey;
        startStream();
        break;

      case 'stop':
        stopStream();
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
    }
  }

  function handleVideoData(data) {
    if (!isStreaming || !ffmpeg || !ffmpeg.stdin.writable) {
      return;
    }

    bytesReceived += data.length;
    sessions.get(sessionId).bytesReceived = bytesReceived;

    try {
      ffmpeg.stdin.write(data);
    } catch (err) {
      console.error(`[${sessionId}] Error writing to FFmpeg:`, err);
    }
  }

  function startStream() {
    if (isStreaming) {
      console.log(`[${sessionId}] Already streaming`);
      return;
    }

    if (!platform || !streamKey) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Missing platform or stream key'
      }));
      return;
    }

    const rtmpUrl = RTMP_URLS[platform];
    if (!rtmpUrl) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown platform: ${platform}`
      }));
      return;
    }

    const fullRtmpUrl = `${rtmpUrl}/${streamKey}`;
    console.log(`[${sessionId}] Starting stream to ${platform}`);

    // FFmpeg command to transcode webm input to RTMP output
    // Input: webm (VP8/VP9 video, Opus audio) from browser MediaRecorder
    // Output: H.264 video, AAC audio for RTMP compatibility
    const ffmpegArgs = [
      // Input options
      '-f', 'webm',           // Input format
      '-i', 'pipe:0',         // Read from stdin

      // Video encoding
      '-c:v', 'libx264',      // H.264 codec (required for RTMP)
      '-preset', 'veryfast',  // Fast encoding for real-time
      '-tune', 'zerolatency', // Minimize latency
      '-b:v', '4500k',        // Video bitrate
      '-maxrate', '4500k',
      '-bufsize', '9000k',
      '-pix_fmt', 'yuv420p',  // Pixel format
      '-g', '60',             // Keyframe interval (2 seconds at 30fps)
      '-keyint_min', '60',

      // Audio encoding
      '-c:a', 'aac',          // AAC codec (required for RTMP)
      '-b:a', '128k',         // Audio bitrate
      '-ar', '44100',         // Sample rate
      '-ac', '2',             // Stereo

      // Output
      '-f', 'flv',            // FLV container for RTMP
      fullRtmpUrl
    ];

    console.log(`[${sessionId}] FFmpeg args:`, ffmpegArgs.join(' '));

    ffmpeg = spawn('ffmpeg', ffmpegArgs);
    isStreaming = true;

    ffmpeg.stdout.on('data', (data) => {
      console.log(`[${sessionId}] FFmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
      // FFmpeg writes progress to stderr
      const msg = data.toString();
      if (msg.includes('frame=') || msg.includes('fps=')) {
        // Progress update - send to client occasionally
        const match = msg.match(/frame=\s*(\d+).*fps=\s*([\d.]+)/);
        if (match) {
          ws.send(JSON.stringify({
            type: 'progress',
            frames: parseInt(match[1]),
            fps: parseFloat(match[2])
          }));
        }
      } else if (msg.includes('Error') || msg.includes('error')) {
        console.error(`[${sessionId}] FFmpeg error: ${msg}`);
        ws.send(JSON.stringify({ type: 'error', message: msg }));
      }
    });

    ffmpeg.on('close', (code) => {
      console.log(`[${sessionId}] FFmpeg exited with code ${code}`);
      isStreaming = false;
      ws.send(JSON.stringify({
        type: 'stopped',
        code,
        bytesProcessed: bytesReceived
      }));
    });

    ffmpeg.on('error', (err) => {
      console.error(`[${sessionId}] FFmpeg spawn error:`, err);
      isStreaming = false;
      ws.send(JSON.stringify({
        type: 'error',
        message: `FFmpeg error: ${err.message}`
      }));
    });

    ws.send(JSON.stringify({ type: 'started', platform }));
  }

  function stopStream() {
    if (ffmpeg) {
      console.log(`[${sessionId}] Stopping stream`);
      isStreaming = false;

      try {
        ffmpeg.stdin.end();

        // Give FFmpeg time to flush buffers
        setTimeout(() => {
          if (ffmpeg && !ffmpeg.killed) {
            ffmpeg.kill('SIGTERM');
          }
        }, 2000);
      } catch (err) {
        console.error(`[${sessionId}] Error stopping FFmpeg:`, err);
      }

      ffmpeg = null;
    }
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`BRDC Streaming Relay listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');

  // Stop all active streams
  for (const [id, session] of sessions) {
    console.log(`Closing session ${id}`);
    session.ws.close();
  }

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
