# 🎵 Música

Reproductor con **YouTube como fuente principal** y **SoundCloud como respaldo**.
No usa cookies, datos del navegador, Lavalink ni credenciales de Spotify. `yt-dlp`
resuelve el audio, iTunes solo mejora la búsqueda y FFmpeg entrega **Ogg/Opus**
a `@discordjs/voice`.

## Comandos

| Comando | Alias | Qué hace |
| --- | --- | --- |
| `xyb play <canción o URL>` | `p`, `tocar`, `reproducir` | Busca en YouTube y reproduce; si ya hay algo, lo pone en cola. |
| `xyb pause` | `pausa`, `pausar` | Pausa. |
| `xyb resume` | `reanudar`, `continuar` | Continúa. |
| `xyb skip` | `saltar`, `next` | Salta a la siguiente. |
| `xyb queue` | `cola`, `q` | Muestra la cola (10 primeras). |
| `xyb np` | `nowplaying`, `sonando` | Canción actual. |
| `xyb stop` | `detener`, `disconnect` | Detiene, vacía la cola y sale del canal. |
| `xyb volume [0-200]` | `vol`, `v` | Muestra o cambia el volumen. |
| `xyb mb ...` | `musicbrainz`, `meta` | Metadatos: grabaciones, artistas, álbumes y `mb now`. |
| `xyb ytm ...` | `ytmusic`, `ytplaylist` | Extra opcional de YouTube Music; no se usa para reproducir. |

Todos tienen versión slash (`/play`, `/queue`, etc.). Se registran con
`npm run register`.

## Requisitos

- **Node.js 24**.
- **yt-dlp**: ya está en `bin/yt-dlp.exe`. Si falta:
  ```bash
  npm run ytdlp
  ```
  En Linux se descarga `bin/yt-dlp`; en Docker se instala en `/usr/local/bin`.
- **FFmpeg**: en Railway/Docker se usa el del sistema (`/usr/bin/ffmpeg`). En
  Windows se usa `@ffmpeg-installer/ffmpeg` o la ruta de `FFMPEG_PATH`.
- **Plugin PO Token de bgutil** (solo para YouTube en Railway): el `Dockerfile`
  descarga `bgutil-ytdlp-pot-provider.zip` en `/opt/yt-dlp-plugins`. El plugin
  pide el token a un servicio HTTP que se ejecuta en la misma red privada.
- **Python + ytmusicapi** (solo para los comandos `ytm`, opcionales):
  ```bash
  py -m venv python/.venv
  python/.venv/Scripts/pip install ytmusicapi
  ```

## Configuración

En `.env`:

```env
MUSIC_BITRATE=64       # 32-128 kbps
MUSIC_VOLUME=100       # 0-200 %
YTDLP_POT_PROVIDER_URL=http://pot-provider.railway.internal:4416
# YTDLP_PLUGIN_DIR=/opt/yt-dlp-plugins
# YOUTUBE_CLIENTS=mweb,web_embedded,android
# ITUNES_COUNTRY=US
# YTDLP_PATH=
# FFMPEG_PATH=
# YTMUSIC_PYTHON=        # opcional, solo para ytm
```

El volumen se guarda por servidor y se aplica **en caliente**: al cambiarlo, el
bot reabre el audio en la posición actual (pausa breve de 1-2 s).

## Servicio PO Token (Railway)

YouTube bloquea las IP de datacenter con el mensaje *“Sign in to confirm you're
not a bot”*. El plugin de bgutil genera un **PO Token** sin cookies y permite
obtener los formatos de audio. En el proyecto de Railway debe existir un
servicio llamado `pot-provider` con la imagen:

```text
brainicism/bgutil-ytdlp-pot-provider:2.0.2-node
```

El bot lo alcanza por la red privada en
`http://pot-provider.railway.internal:4416`. No hace falta exponerlo a Internet.
Si el servicio no está disponible, YouTube falla y el bot intenta SoundCloud.

## Cómo busca

1. Si escribes un nombre, iTunes devuelve el título, artista y duración más
   probables. Por ejemplo, `cara quintero` se convierte en `Rafa Caro T3r
   Elemento`.
2. Se buscan varias versiones en YouTube y se ordenan para preferir la versión
   oficial: coincidencia de título/artista, duración parecida y palabras como
   *official*. Se descartan covers, remixes, versiones en vivo y aceleradas.
3. Si YouTube no entrega una versión reproducible, se buscan versiones en
   SoundCloud. Las pistas oficiales con DRM se saltan automáticamente y se usa
   la primera que sí se puede abrir.
4. Si tampoco hay una versión válida en SoundCloud, se intenta de nuevo con el
   texto original.

También se aceptan enlaces directos de YouTube (`youtube.com`, `youtu.be`,
`music.youtube.com`) y de SoundCloud.

## Audio

- Salida **Opus 48 kHz estéreo a 64 kbps** por defecto.
- YouTube entrega el audio mediante `yt-dlp` por tubería a FFmpeg. Así se usan
  las cabeceras y la sesión que YouTube exige, sin guardar cookies.
- SoundCloud suele entregar HLS (`.m3u8`); FFmpeg lo convierte a Ogg/Opus.
- Se **prebufferean ~256 KB** antes de empezar para evitar cortes.
- Si una URL de CDN de SoundCloud expira o devuelve 403, se pide una nueva y se
  reintenta una vez.
- El canal de voz debe tener un bitrate de al menos 64 kbps para la calidad
  pedida.

## Si una canción no se reproduce

- Si YouTube está bloqueado o el token caduca, el bot prueba la misma búsqueda
  en SoundCloud automáticamente.
- SoundCloud puede tener la versión oficial protegida con DRM. El bot busca
  otras subidas de la misma canción; si ninguna funciona, prueba con el nombre
  del artista o pega otro enlace.
- No se necesitan cookies, cuenta de YouTube ni datos del navegador.

## YouTube Music (opcional)

Los comandos `ytm` siguen disponibles como extra para playlists, pero **no
intervienen en `play`**. Si no los usas, no hace falta configurar nada.

## MusicBrainz

`musicbrainz-api` (ESM) se carga con `import()` dinámico. No necesita token.

- `xyb mb <búsqueda> | <artista>`
- `xyb mb artist <nombre>`
- `xyb mb release <álbum> | <artista>`
- `xyb mb now` (incluye portada desde Cover Art Archive)

Límite: 15 peticiones cada 18 s; el comando tiene un cooldown de 2,5 s por
usuario y maneja los 503.

## Pruebas

```bash
npm test
```

Incluye pruebas de bitrate, volumen, alias, formato de duración, ranking de
YouTube y carga de comandos. Para probar el audio real (requiere red y el
servicio PO Token):

```bash
node -e "const y=require('./src/music/ytdlp');(async()=>{const s=await y.openStream('https://www.youtube.com/watch?v=szgyuyDf7b0');s.stream.once('data',d=>{console.log(d.subarray(0,4).toString(),s.bitrate);s.kill();process.exit(0)})})()"
```

Debe imprimir `OggS 64`.

## Docker / Railway

El `Dockerfile` instala `yt-dlp`, el plugin PO Token, Python, `ytmusicapi` y
FFmpeg. Define `DISCORD_TOKEN`, `CLIENT_ID`, `YTDLP_POT_PROVIDER_URL` y, si
quieres playlists, sube `python/oauth.json` como secreto o volumen. No se
necesitan cookies ni archivos del navegador.
