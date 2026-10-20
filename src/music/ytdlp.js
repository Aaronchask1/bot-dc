const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { Transform, PassThrough } = require('stream');

const BIN_DIR = path.join(__dirname, '..', '..', 'bin');
const BIN_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

const PREBUFFER_BYTES = 256 * 1024;      // colchón inicial (~32 s a 64 kbps)
const PREBUFFER_TIMEOUT_MS = 10_000;
const DEFAULT_BITRATE = 64;

const USER_AGENT = process.env.YTDLP_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function resolveYtDlp() {
    if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
        return process.env.YTDLP_PATH;
    }

    const local = path.join(BIN_DIR, BIN_NAME);
    if (fs.existsSync(local)) return local;

    return process.env.YTDLP_PATH || 'yt-dlp';
}

const YTDLP = resolveYtDlp();

function resolveFfmpeg() {
    if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

    // En Linux (Railway/Docker) conviene el ffmpeg del sistema: el binario
    // empaquetado por @ffmpeg-installer es de 2018 y puede fallar con URLs
    // modernas de YouTube. En Windows se usa el instalador si no hay ffmpeg.
    try {
        const probe = spawnSync('ffmpeg', ['-version'], {
            windowsHide: true,
            timeout: 3000,
            stdio: 'ignore'
        });
        if (probe.status === 0) return 'ffmpeg';
    } catch {
        // ffmpeg no está en PATH: seguimos con el instalador.
    }

    try {
        return require('@ffmpeg-installer/ffmpeg').path;
    } catch {
        return 'ffmpeg';
    }
}

const FFMPEG = resolveFfmpeg();

function clampBitrate(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_BITRATE;
    return Math.min(Math.max(Math.round(numeric), 32), 128);
}

function isUrl(text) {
    return /^https?:\/\//i.test(text);
}

let base64CookiesPath = null;
let base64CookiesValue = null;

function looksLikeNetscapeCookies(text) {
    if (typeof text !== 'string' || !text.trim()) return false;

    const lines = text.split(/\r?\n/);
    const hasHeader = lines.some((line) => /^# (Netscape )?HTTP Cookie File/i.test(line.trim()));
    if (!hasHeader) return false;

    return lines.some((line) => {
        if (!line || line.trim().startsWith('#')) return false;
        const fields = line.split('\t');
        return fields.length >= 7 && fields[0].trim() && fields[5].trim();
    });
}

/**
 * Railway/Render no permiten subir archivos: acepta el cookies.txt en Base64.
 * Se valida antes de escribirlo para no pasarle basura a yt-dlp.
 */
function cookiesFromBase64() {
    const encoded = String(process.env.YTDLP_COOKIES_B64 || '').trim();
    if (!encoded) return null;

    if (base64CookiesPath && base64CookiesValue === encoded && fs.existsSync(base64CookiesPath)) {
        return base64CookiesPath;
    }

    const compact = encoded.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact) || compact.length % 4 === 1) {
        console.error('[yt-dlp] YTDLP_COOKIES_B64 no es Base64 válido; se ignora. Debe ser el contenido de cookies.txt codificado, no el comando que lo genera.');
        return null;
    }

    try {
        const normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(normalized, 'base64').toString('utf8');

        if (!looksLikeNetscapeCookies(decoded)) {
            console.error('[yt-dlp] YTDLP_COOKIES_B64 no contiene un cookies.txt de Netscape válido; se ignora.');
            return null;
        }

        const directory = path.join(os.tmpdir(), 'xyb-bot');
        fs.mkdirSync(directory, { recursive: true });

        const target = path.join(directory, 'cookies.txt');
        fs.writeFileSync(target, decoded, { mode: 0o600 });

        base64CookiesPath = target;
        base64CookiesValue = encoded;
        return target;
    } catch (error) {
        console.error('[yt-dlp] No pude decodificar YTDLP_COOKIES_B64:', error.message);
        return null;
    }
}

function cookieArgs() {
    const custom = process.env.YTDLP_COOKIES;
    const file = custom || path.join(BIN_DIR, '..', 'cookies.txt');

    if (fs.existsSync(file)) {
        try {
            const text = fs.readFileSync(file, 'utf8');
            if (looksLikeNetscapeCookies(text)) return ['--cookies', path.resolve(file)];
            console.error(`[yt-dlp] El archivo de cookies ${file} no tiene formato Netscape; se ignora.`);
        } catch (error) {
            console.error('[yt-dlp] No pude leer el archivo de cookies:', error.message);
        }
    }

    const base64File = cookiesFromBase64();
    if (base64File) {
        return ['--cookies', base64File];
    }

    if (process.env.YTDLP_COOKIES_FROM_BROWSER) {
        return ['--cookies-from-browser', process.env.YTDLP_COOKIES_FROM_BROWSER];
    }

    return [];
}

function classifyError(error) {
    const message = error?.message || '';

    if (/Sign in to confirm|not a bot|confirm your age|age.?restricted|login required|private video|members-only/i.test(message)) {
        error.code = 'YOUTUBE_AUTH';
    } else if (/403|Forbidden/i.test(message)) {
        error.code = 'YOUTUBE_403';
    }

    return error;
}

function run(args, { timeout = 60_000 } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(YTDLP, args, { windowsHide: true });

        let stdout = '';
        let stderr = '';
        let finished = false;

        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            child.kill('SIGKILL');
            reject(new Error('yt-dlp tardó demasiado en responder'));
        }, timeout);

        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        child.on('error', (err) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            reject(
                err.code === 'ENOENT'
                    ? new Error('yt-dlp no está instalado. Coloca yt-dlp en bin/ o define YTDLP_PATH.')
                    : err
            );
        });

        child.on('close', (code) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);

            if (code !== 0) {
                return reject(classifyError(new Error(stderr.trim().split('\n').slice(-3).join(' ') || `yt-dlp salió con código ${code}`)));
            }

            resolve(stdout);
        });
    });
}

function normalize(entry) {
    return {
        id: entry.id,
        title: entry.title || 'Desconocido',
        url: entry.webpage_url || entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
        duration: Number.isFinite(entry.duration) ? entry.duration : null,
        thumbnail: entry.thumbnail || entry.thumbnails?.at(-1)?.url || null,
        uploader: entry.uploader || entry.channel || 'Desconocido',
        isLive: entry.is_live === true || entry.live_status === 'is_live'
    };
}

/**
 * Resuelve una búsqueda o una URL a una lista de pistas.
 */
async function search(query, { limit = 1 } = {}) {
    const target = isUrl(query) ? query : `ytsearch${limit}:${query}`;

    const args = [
        '-J',
        '--no-warnings',
        '--no-progress',
        '--no-playlist',
        '--flat-playlist',
        ...cookieArgs(),
        target
    ];

    const raw = await run(args);
    const json = JSON.parse(raw);

    if (json.entries) {
        return json.entries.filter(Boolean).map(normalize);
    }

    return [normalize(json)];
}

/**
 * Obtiene la URL directa del audio (googlevideo).
 */
const FALLBACK_CLIENTS = ['android', 'android_vr'];

async function extractDirectUrl(url, client = null) {
    const args = [
        '-g',
        '-f', 'bestaudio[acodec=opus]/bestaudio/best',
        '--no-playlist',
        '--no-warnings',
        '--no-progress'
    ];

    if (client) args.push('--extractor-args', `youtube:player_client=${client}`);

    args.push(...cookieArgs(), url);

    const raw = await run(args, { timeout: 45_000 });

    const candidate = raw
        .split('\n')
        .map((line) => line.trim())
        .find((line) => /^https?:\/\//i.test(line));

    if (!candidate) {
        throw new Error('yt-dlp no devolvió una URL de audio válida');
    }

    return candidate;
}

async function getDirectUrl(url) {
    try {
        return await extractDirectUrl(url);
    } catch (error) {
        // Si el cliente web está bloqueado, probamos clientes alternativos.
        if (error.code !== 'YOUTUBE_AUTH' && error.code !== 'YOUTUBE_403') throw error;

        let lastError = error;

        for (const client of FALLBACK_CLIENTS) {
            try {
                return await extractDirectUrl(url, client);
            } catch (fallbackError) {
                lastError = fallbackError;
            }
        }

        throw lastError;
    }
}

function startTranscoder(directUrl, { seek = 0, bitrateKbps = DEFAULT_BITRATE, volume = 1 } = {}) {
    return new Promise((resolve, reject) => {
        const bitrate = clampBitrate(bitrateKbps);
        const gain = Math.min(Math.max(Number(volume) || 0, 0), 2);

        const args = [
            '-hide_banner',
            '-loglevel', 'error',
            '-nostdin',
            '-user_agent', USER_AGENT,
            '-referer', 'https://www.youtube.com/',
            '-reconnect', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5',
            '-rw_timeout', '15000000',
            '-analyzeduration', '1000000',
            '-probesize', '1048576'
        ];

        if (seek > 0) args.push('-ss', String(seek));

        args.push('-i', directUrl);

        if (gain !== 1) args.push('-af', `volume=${gain.toFixed(3)}`);

        args.push(
            '-vn', '-sn', '-dn',
            '-c:a', 'libopus',
            '-b:a', `${bitrate}k`,
            '-ar', '48000',
            '-ac', '2',
            '-application', 'audio',
            '-frame_duration', '20',
            '-compression_level', '10',
            '-f', 'ogg',
            'pipe:1'
        );

        const transcoder = spawn(FFMPEG, args, { windowsHide: true });

        let stderr = '';
        let received = 0;
        let settled = false;

        const buffer = new PassThrough({ highWaterMark: 4 * 1024 * 1024 });

        const counter = new Transform({
            transform(chunk, _encoding, callback) {
                received += chunk.length;
                if (!settled && received >= PREBUFFER_BYTES) start();
                callback(null, chunk);
            }
        });

        const cleanup = () => {
            clearTimeout(prebufferTimer);
            transcoder.removeListener('close', onClose);
            transcoder.removeListener('error', onError);
        };

        const start = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve({
                stream: buffer,
                bitrate,
                directUrl,
                kill: () => {
                    try { transcoder.kill('SIGKILL'); } catch {}
                    try { buffer.destroy(); } catch {}
                }
            });
        };

        const fail = (message) => {
            if (settled) return;
            settled = true;
            cleanup();
            try { transcoder.kill('SIGKILL'); } catch {}
            try { buffer.destroy(); } catch {}
            reject(new Error(message));
        };

        const onClose = (code) => {
            if (settled) return;

            // Si ya llegó audio, dejamos que el recurso lo consuma hasta el final.
            if (received > 0) return start();

            fail(code === 0
                ? 'El audio terminó antes de empezar'
                : `ffmpeg falló (${code}): ${stderr.trim().split('\n').slice(-2).join(' ')}`);
        };

        const onError = (error) => {
            fail(
                error.code === 'ENOENT'
                    ? 'No encontré ffmpeg. Define FFMPEG_PATH.'
                    : error.message
            );
        };

        const prebufferTimer = setTimeout(() => {
            if (received > 0) return start();
            fail('No se pudo iniciar el audio a tiempo');
        }, PREBUFFER_TIMEOUT_MS);

        transcoder.stderr.on('data', (d) => { stderr += d.toString(); });
        transcoder.on('close', onClose);
        transcoder.on('error', onError);
        transcoder.stdout.on('error', () => {});

        transcoder.stdout.pipe(counter).pipe(buffer);
    });
}

/**
 * Abre el audio y entrega un stream Ogg/Opus con prebuffer.
 * Reintenta una vez con una URL fresca si YouTube devuelve 403.
 */
async function openStream(url, { seek = 0, bitrateKbps = DEFAULT_BITRATE, volume = 1, directUrl = null } = {}) {
    let lastError;
    let cachedUrl = directUrl;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const direct = cachedUrl || await getDirectUrl(url);
            return await startTranscoder(direct, { seek, bitrateKbps, volume });
        } catch (error) {
            lastError = error;
            cachedUrl = null;
            if (process.env.MUSIC_DEBUG) {
                console.error(`[yt-dlp] intento ${attempt + 1} falló: ${error.message}`);
            }
        }
    }

    throw classifyError(lastError);
}

module.exports = {
    YTDLP,
    search,
    openStream,
    getDirectUrl,
    isUrl,
    clampBitrate
};
