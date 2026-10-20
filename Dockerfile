FROM node:24-bookworm-slim

# FFmpeg del sistema + yt-dlp + plugin PO Token + Python para ytmusicapi.
# El plugin permite que YouTube entregue audio desde Railway sin cookies.
ARG BGUTIL_POT_VERSION=2.0.2
ENV YTDLP_PLUGIN_DIR=/opt/yt-dlp-plugins
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg python3 python3-pip \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod 755 /usr/local/bin/yt-dlp \
  && mkdir -p "$YTDLP_PLUGIN_DIR" \
  && curl -fsSL "https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/${BGUTIL_POT_VERSION}/bgutil-ytdlp-pot-provider.zip" \
       -o "$YTDLP_PLUGIN_DIR/bgutil-ytdlp-pot-provider.zip" \
  && python3 -m pip install --break-system-packages --no-cache-dir ytmusicapi \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./

CMD ["npm", "start"]
