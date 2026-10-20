const fs = require('fs');
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
    // empaquetado por @ffmpeg-installer es de 2018 y puede fallar con streams
    // modernos. En Windows se usa el instalador si no hay ffmpeg.
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

function classifyError(error) {
    const message = error?.message || '';

    if (/DRM protected|DRM/i.test(message)) {
        error.code = 'DRM';
    } else if (/403|Forbidden/i.test(message)) {
        error.code = 'FORBIDDEN';
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
    const url = entry.webpage_url || entry.original_url || entry.url || null;

    return {
        id: entry.id || url,
        title: entry.title || entry.track || 'Desconocido',
        url,
        duration: Number.isFinite(entry.duration) ? entry.duration : null,
        thumbnail: entry.thumbnail || entry.thumbnails?.at(-1)?.url || null,
        uploader: entry.uploader || entry.channel || entry.artist || entry.artists?.join(', ') || 'Desconocido',
        isLive: entry.is_live === true || entry.live_status === 'is_live'
    };
}

function normalizeSoundCloud(entry) {
    const track = normalize(entry);
    return {
        ...track,
        id: `sc:${entry.id || track.url}`,
        url: track.url,
        source: 'soundcloud'
    };
}

function isDrmError(error) {
    return error?.code === 'DRM' || /DRM protected/i.test(error?.message || '');
}

function normalizeForMatch(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function titleMatches(candidate, expected) {
    const left = normalizeForMatch(candidate);
    const right = normalizeForMatch(expected);
    if (!left || !right) return true;
    return left.includes(right) || right.includes(left);
}

function noPlayableError(message) {
    const error = new Error(message);
    error.code = 'NO_PLAYABLE';
    return error;
}

/**
 * Busca en SoundCloud y devuelve la primera versión que yt-dlp puede abrir.
 * Se prueba cada resultado porque las pistas oficiales suelen tener DRM.
 */
async function searchSoundCloud(query, { limit = 10, probe = true, minDuration = 20, probeTimeout = 20_000, expectedTitle = null } = {}) {
    const target = `scsearch${Math.min(Math.max(Math.round(limit), 1), 30)}:${query}`;
    const raw = await run([
        '-J',
        '--no-warnings',
        '--no-progress',
        '--no-playlist',
        '--flat-playlist',
        target
    ]);

    const json = JSON.parse(raw);
    const entries = (json.entries || [json]).filter(Boolean);
    const candidates = entries
        .map(normalizeSoundCloud)
        .filter((track) => track.url && (!track.duration || track.duration >= minDuration))
        .filter((track) => !expectedTitle || titleMatches(track.title, expectedTitle));

    if (!candidates.length) {
        throw noPlayableError('No encontré una versión que coincida en SoundCloud.');
    }

    if (!probe) return candidates;

    let nonDrmCandidate = null;

    for (const track of candidates) {
        if (!track.url) continue;

        try {
            track.directUrl = await extractDirectUrl(track.url, { timeout: probeTimeout });
            return [track];
        } catch (error) {
            if (process.env.MUSIC_DEBUG) {
                console.error(`[SoundCloud] ${track.title}: ${error.message}`);
            }

            // Un fallo de red no significa que la pista sea inútil. Si no
            // aparece ninguna versión válida, se intentará abrir esta después.
            if (!isDrmError(error) && !nonDrmCandidate) nonDrmCandidate = track;
        }
    }

    if (nonDrmCandidate) return [nonDrmCandidate];

    throw noPlayableError('Las versiones encontradas en SoundCloud tienen DRM. Prueba con otro nombre o enlace.');
}

async function resolveSoundCloudUrl(url) {
    const raw = await run([
        '-J',
        '--no-warnings',
        '--no-progress',
        '--no-playlist',
        url
    ]);

    const json = JSON.parse(raw);
    const entry = (json.entries || [json]).filter(Boolean)[0];

    if (!entry) {
        throw noPlayableError('No pude leer esa canción de SoundCloud.');
    }

    const track = normalizeSoundCloud(entry);
    track.url = track.url || url;

    try {
        track.directUrl = await extractDirectUrl(url, { timeout: 30_000 });
    } catch (error) {
        if (isDrmError(error)) {
            throw noPlayableError('Esa versión de SoundCloud tiene DRM. Prueba con otro enlace.');
        }
        throw error;
    }

    return track;
}

/**
 * Obtiene la URL directa del audio de una pista de SoundCloud.
 */
async function extractDirectUrl(url, { timeout = 45_000 } = {}) {
    const raw = await run([
        '-g',
        '-f', 'bestaudio/best',
        '--no-playlist',
        '--no-warnings',
        '--no-progress',
        url
    ], { timeout });

    const candidate = raw
        .split('\n')
        .map((line) => line.trim())
        .find((line) => /^https?:\/\//i.test(line));

    if (!candidate) {
        throw new Error('yt-dlp no devolvió una URL de audio válida');
    }

    return candidate;
}

async function getDirectUrl(url, options = {}) {
    return extractDirectUrl(url, options);
}

function startTranscoder(directUrl, { seek = 0, bitrateKbps = DEFAULT_BITRATE, volume = 1 } = {}) {
    return new Promise((resolve, reject) => {
        const bitrate = clampBitrate(bitrateKbps);
        const gain = Math.min(Math.max(Number(volume) || 0, 0), 2);
        const referer = /soundcloud\.(?:com|cloud)|sndcdn\.com/i.test(directUrl)
            ? 'https://soundcloud.com/'
            : null;

        const args = [
            '-hide_banner',
            '-loglevel', 'error',
            '-nostdin',
            '-user_agent', USER_AGENT,
            '-reconnect', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5',
            '-rw_timeout', '15000000',
            '-analyzeduration', '1000000',
            '-probesize', '1048576'
        ];

        if (referer) args.push('-referer', referer);

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
 * Reintenta una vez con una URL fresca si la CDN devuelve 403 o expira.
 */
async function openStream(url, { seek = 0, bitrateKbps = DEFAULT_BITRATE, volume = 1, directUrl = null } = {}) {
    let lastError;
    let cachedUrl = directUrl;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const direct = cachedUrl || await getDirectUrl(url, { timeout: 30_000 });
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
    searchSoundCloud,
    resolveSoundCloudUrl,
    openStream,
    getDirectUrl,
    isUrl,
    clampBitrate
};
