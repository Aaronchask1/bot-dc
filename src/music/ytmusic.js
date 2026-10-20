const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PY_DIR = path.join(__dirname, '..', '..', 'python');
const BRIDGE = path.join(PY_DIR, 'ytmusic_bridge.py');
const VENV_PYTHON = process.platform === 'win32'
    ? path.join(PY_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(PY_DIR, '.venv', 'bin', 'python');

function resolvePython() {
    if (process.env.YTMUSIC_PYTHON) return process.env.YTMUSIC_PYTHON;
    if (fs.existsSync(VENV_PYTHON)) return VENV_PYTHON;
    return process.platform === 'win32' ? 'python' : 'python3';
}

const PYTHON = resolvePython();

function callBridge(payload, { timeout = 45_000 } = {}) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(BRIDGE)) {
            return reject(new Error('No encontré python/ytmusic_bridge.py'));
        }

        const child = spawn(PYTHON, [BRIDGE], { windowsHide: true });

        let stdout = '';
        let stderr = '';
        let finished = false;

        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            child.kill('SIGKILL');
            reject(new Error('ytmusicapi tardó demasiado en responder'));
        }, timeout);

        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        child.on('error', (error) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);

            reject(
                error.code === 'ENOENT'
                    ? new Error('No encontré Python. Define YTMUSIC_PYTHON o crea python/.venv')
                    : error
            );
        });

        child.on('close', () => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);

            const line = stdout.trim().split('\n').filter(Boolean).at(-1);

            if (!line) {
                return reject(new Error(stderr.trim() || 'ytmusicapi no devolvió respuesta'));
            }

            let parsed;
            try {
                parsed = JSON.parse(line);
            } catch {
                return reject(new Error(`Respuesta inválida de ytmusicapi: ${line.slice(0, 200)}`));
            }

            if (!parsed.ok) {
                const error = new Error(parsed.error || 'Error de ytmusicapi');
                error.code = parsed.code || 'YTMUSIC_ERROR';
                return reject(error);
            }

            resolve(parsed.data);
        });

        child.stdin.on('error', () => {});
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
    });
}

function toTrack(item) {
    return {
        id: item.videoId,
        title: item.title || 'Desconocido',
        url: `https://www.youtube.com/watch?v=${item.videoId}`,
        duration: Number.isFinite(item.duration) ? item.duration : null,
        thumbnail: item.thumbnail,
        uploader: item.artists?.length ? item.artists.join(', ') : 'Desconocido',
        album: item.album || null
    };
}

/**
 * Busca canciones en YouTube Music. Sin oauth.json también funciona (modo anónimo).
 */
async function search(query, { limit = 1, filter = 'songs' } = {}) {
    const data = await callBridge({ action: 'search', query, limit, filter });
    return data.map(toTrack);
}

async function createPlaylist(title, description, videoIds = []) {
    return callBridge({ action: 'create_playlist', title, description, videoIds });
}

async function addItems(playlistId, videoIds = []) {
    return callBridge({ action: 'add_items', playlistId, videoIds });
}

async function listPlaylists(limit = 25) {
    return callBridge({ action: 'list_playlists', limit });
}

async function authStatus() {
    return callBridge({ action: 'auth_status' });
}

module.exports = {
    PYTHON,
    search,
    createPlaylist,
    addItems,
    listPlaylists,
    authStatus
};
