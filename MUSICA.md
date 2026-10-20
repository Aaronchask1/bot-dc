# 🎵 Música

Reproductor directo de YouTube (sin Lavalink ni Spotify). Usa `yt-dlp` para resolver
el audio y FFmpeg para entregar **Ogg/Opus** a `@discordjs/voice`.

## Comandos

| Comando | Alias | Qué hace |
| --- | --- | --- |
| `xyb play <canción o URL>` | `p`, `tocar`, `reproducir` | Busca y reproduce; si ya hay algo, lo pone en cola. |
| `xyb pause` | `pausa`, `pausar` | Pausa. |
| `xyb resume` | `reanudar`, `continuar` | Continúa. |
| `xyb skip` | `saltar`, `next` | Salta a la siguiente. |
| `xyb queue` | `cola`, `q` | Muestra la cola (10 primeras). |
| `xyb np` | `nowplaying`, `sonando` | Canción actual. |
| `xyb stop` | `detener`, `disconnect` | Detiene, vacía la cola y sale del canal. |
| `xyb volume [0-200]` | `vol`, `v` | Muestra o cambia el volumen. |
| `xyb mb ...` | `musicbrainz`, `meta` | Metadatos: grabaciones, artistas, álbumes y `mb now`. |
| `xyb ytm ...` | `ytmusic`, `ytplaylist` | Playlists de YouTube Music. |

Todos tienen versión slash (`/play`, `/queue`, etc.). Se registran con
`npm run register`.

## Requisitos

- **Node.js 24**.
- **yt-dlp**: ya está en `bin/yt-dlp.exe`. Si falta:
  ```bash
  npm run ytdlp
  ```
  En Linux se descarga `bin/yt-dlp`; en Docker se instala en `/usr/local/bin`.
- **FFmpeg**: lo aporta `@ffmpeg-installer/ffmpeg` (viene con `npm install`).
  También puedes definir `FFMPEG_PATH`.
- **Python + ytmusicapi** (opcional, para mejores búsquedas y playlists):
  ```bash
  py -m venv python/.venv
  python/.venv/Scripts/pip install ytmusicapi
  ```
  Si no está, el bot busca con `yt-dlp` y todo lo demás sigue funcionando.

## Configuración

En `.env`:

```env
MUSIC_BITRATE=64       # 32-128 kbps
MUSIC_VOLUME=100       # 0-200 %
YTDLP_PATH=            # opcional
FFMPEG_PATH=           # opcional
YTMUSIC_PYTHON=        # opcional
YTDLP_COOKIES=         # opcional, ruta a cookies.txt
```

El volumen se guarda por servidor y se aplica **en caliente**: al cambiarlo, el
bot reabre el audio en la posición actual (pausa breve de 1-2 s).

## Audio

- Salida **Opus 48 kHz estéreo a 64 kbps** por defecto.
- Se resuelve la URL directa (`yt-dlp -g`), se conecta con `-reconnect` y se
  **prebufferean ~256 KB** antes de empezar para evitar cortes.
- Si YouTube bloquea el cliente web, se reintenta automáticamente con los
  clientes `android` y `android_vr`, y una vez más con URL fresca si hay 403.
- El canal de voz debe tener un bitrate de al menos 64 kbps para la calidad
  pedida.

## Videos restringidos (cookies)

YouTube puede pedir iniciar sesión:

```
Sign in to confirm you're not a bot
```

El fallback `android` suele evitarlo. Si un video sigue fallando:

1. Instala en Chrome la extensión **Get cookies.txt LOCALLY**.
2. Con tu cuenta iniciada en YouTube, exporta las cookies de `youtube.com`.
3. Guarda el archivo como `cookies.txt` en la raíz de este proyecto.
4. Reinicia el bot.

También puedes usar `YTDLP_COOKIES=C:\ruta\a\cookies.txt`.

En Railway/Render no puedes subir archivos: pega el contenido de `cookies.txt`
codificado en Base64 en `YTDLP_COOKIES_B64`. El bot lo decodifica a un archivo
temporal la primera vez que reproduce.

> En Windows, `--cookies-from-browser chrome` no funciona con Chrome reciente
> (App-Bound Encryption). Usa `cookies.txt` o Firefox:
> `YTDLP_COOKIES_FROM_BROWSER=firefox`.
>
> `cookies.txt` da acceso a tu cuenta: no lo compartas ni lo subas a Git.

## YouTube Music (playlists)

Las búsquedas funcionan sin cuenta. Para crear/añadir/listar playlists hace falta
autenticación:

```bash
npm run ytmusic          # OAuth (recomendado)
npm run ytmusic -- browser
```

Se genera `python/oauth.json` (ignorado por Git). Comprueba con `xyb ytm status`.

- `xyb ytm create <nombre> | <búsqueda>` → crea una playlist con 5 canciones.
- `xyb ytm add <id o URL> | <búsqueda>` → añade 5 canciones.
- `xyb ytm save <nombre>` → guarda la canción actual y la cola.
- `xyb ytm list` → tus playlists.
- `xyb ytm status` → si hay autenticación.

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
node -e "const y=require('./src/music/ytdlp');(async()=>{const s=await y.openStream('https://www.youtube.com/watch?v=N50oc4pgo8w');s.stream.once('data',d=>{console.log(d.subarray(0,4).toString(),s.bitrate);s.kill();process.exit(0)})})()"
```

Debe imprimir `OggS 64`.

## Docker / Railway

El `Dockerfile` instala `yt-dlp`, Python, `ytmusicapi` y FFmpeg. Define
`DISCORD_TOKEN`, `CLIENT_ID` y, si quieres playlists, sube `python/oauth.json`
como secreto o volumen. `cookies.txt` también puede montarse como volumen.
