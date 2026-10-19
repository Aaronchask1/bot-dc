FROM ghcr.io/lavalink-devs/lavalink:4

USER root
# La versión oficial autónoma de yt-dlp se actualiza con rapidez cuando los
# proveedores cambian sus extractores; FFmpeg permite procesar los formatos
# de audio que devuelven esos proveedores.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl unzip ffmpeg ca-certificates \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod 755 /usr/local/bin/yt-dlp \
  && curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -o /tmp/deno.zip \
  && unzip /tmp/deno.zip -d /usr/local/bin \
  && chmod +x /usr/local/bin/deno \
  && rm -rf /var/lib/apt/lists/* /tmp/deno.zip

USER 322
COPY application.yml /opt/Lavalink/application.yml
