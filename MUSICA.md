# 🎵 Música

Reproductor directo desde **SoundCloud** (sin YouTube, Lavalink, cookies ni
credenciales de Spotify). Usa `yt-dlp` para resolver el audio, iTunes solo para
mejorar la búsqueda y FFmpeg para entregar **Ogg/Opus** a `@discordjs/voice`.

## Comandos

| Comando | Alias | Qué hace |
| --- | --- | --- |
| `xyb play <canción o URL>` | `p`, `tocar`, `reproducir` | Busca en SoundCloud y reproduce; si ya hay algo, lo pone en cola. |
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
ITUNES_COUNTRY=US      # opcional: US, MX, ES...
YTDLP_PATH=            # opcional
FFMPEG_PATH=           # opcional
YTMUSIC_PYTHON=        # opcional, solo para ytm
```

El volumen se guarda por servidor y se aplica **en caliente**: al cambiarlo, el
bot reabre el audio en la posición actual (pausa breve de 1-2 s).

## Cómo busca

1. Si escribes un nombre, iTunes devuelve el título y artista más probables.
   Por ejemplo, `cara quintero` se convierte en `Rafa Caro T3r Elemento`.
2. Se buscan varias versiones en SoundCloud.
3. Se prueba cada una con `yt-dlp -g`; las pistas oficiales con DRM se saltan
   automáticamente y se usa la primera versión que sí se puede abrir.
4. Si no hay ninguna versión válida, se intenta de nuevo con el texto original.

Las URLs de YouTube se rechazan: el bot solo acepta nombres o enlaces de
SoundCloud.

## Audio

- Salida **Opus 48 kHz estéreo a 64 kbps** por defecto.
- SoundCloud suele entregar HLS (`.m3u8`); FFmpeg lo convierte a Ogg/Opus.
- Se **prebufferean ~256 KB** antes de empezar para evitar cortes.
- Si una URL de CDN expira o devuelve 403, se pide una nueva y se reintenta una
  vez.
- El canal de voz debe tener un bitrate de al menos 64 kbps para la calidad
  pedida.

## Si una canción no se reproduce

- SoundCloud puede tener la versión oficial protegida con DRM. El bot busca
  otras subidas de la misma canción; si ninguna funciona, prueba con el nombre
  del artista o pega otro enlace de SoundCloud.
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

Incluye pruebas de bitrate, volumen, alias, formato de duración y carga de
comandos. Para probar el audio real (requiere red):

```bash
node -e "const y=require('./src/music/ytdlp');(async()=>{const s=await y.openStream('https://soundcloud.com/edgar-martinez-arellano/rafa-caro-grupo-efectivo');s.stream.once('data',d=>{console.log(d.subarray(0,4).toString(),s.bitrate);s.kill();process.exit(0)})})()"
```

Debe imprimir `OggS 64`.

## Docker / Railway

El `Dockerfile` instala `yt-dlp`, Python, `ytmusicapi` y FFmpeg. Define
`DISCORD_TOKEN`, `CLIENT_ID` y, si quieres playlists, sube `python/oauth.json`
como secreto o volumen. No se necesitan cookies ni archivos del navegador.
