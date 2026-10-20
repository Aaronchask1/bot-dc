FROM node:24-bookworm-slim

# FFmpeg del sistema + yt-dlp + Python para ytmusicapi (playlists).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg python3 python3-pip \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod 755 /usr/local/bin/yt-dlp \
  && python3 -m pip install --break-system-packages --no-cache-dir ytmusicapi \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./

CMD ["npm", "start"]
