# BRDC Streaming Relay - Cloud Run Dockerfile
# Node.js + FFmpeg for RTMP streaming

FROM node:20-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application code
COPY server.js ./

# Cloud Run uses PORT environment variable
ENV PORT=8080

EXPOSE 8080

# Run the server
CMD ["node", "server.js"]
