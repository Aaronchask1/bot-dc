FROM ghcr.io/lavalink-devs/lavalink:4

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3-pip curl unzip \
  && pip3 install --no-cache-dir --break-system-packages -U yt-dlp \
  && curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -o /tmp/deno.zip \
  && unzip /tmp/deno.zip -d /usr/local/bin \
  && chmod +x /usr/local/bin/deno \
  && rm -rf /var/lib/apt/lists/* /tmp/deno.zip

USER 322
COPY application.yml /opt/Lavalink/application.yml
