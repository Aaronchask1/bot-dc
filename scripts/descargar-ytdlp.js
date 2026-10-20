/**
 * Descarga el binario de yt-dlp en bot/bin.
 * Uso: npm run ytdlp
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const DEST_DIR = path.join(__dirname, '..', 'bin');

const ASSETS = {
    'win32-x64': 'yt-dlp.exe',
    'linux-x64': 'yt-dlp',
    'linux-arm64': 'yt-dlp_linux_aarch64',
    'darwin-x64': 'yt-dlp_macos',
    'darwin-arm64': 'yt-dlp_macos'
};

const key = `${process.platform}-${process.arch}`;
const asset = ASSETS[key];

if (!asset) {
    console.error(`❌ Plataforma no soportada: ${key}. Descarga yt-dlp manualmente y define YTDLP_PATH.`);
    process.exit(1);
}

const fileName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const destination = path.join(DEST_DIR, fileName);
const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;

fs.mkdirSync(DEST_DIR, { recursive: true });

function download(target, redirects = 0) {
    if (redirects > 5) {
        console.error('❌ Demasiadas redirecciones.');
        process.exit(1);
    }

    https.get(target, { headers: { 'User-Agent': 'xyb-bot' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return download(res.headers.location, redirects + 1);
        }

        if (res.statusCode !== 200) {
            console.error(`❌ Error HTTP ${res.statusCode} al descargar yt-dlp.`);
            process.exit(1);
        }

        const file = fs.createWriteStream(destination);
        res.pipe(file);

        file.on('finish', () => {
            file.close(() => {
                if (process.platform !== 'win32') fs.chmodSync(destination, 0o755);
                console.log(`✅ yt-dlp descargado en ${destination}`);
            });
        });
    }).on('error', (error) => {
        console.error('❌ Error de red:', error.message);
        process.exit(1);
    });
}

console.log(`⬇️  Descargando ${asset}...`);
download(url);
