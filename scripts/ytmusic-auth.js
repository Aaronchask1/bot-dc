/**
 * Inicia el flujo de autenticación de ytmusicapi.
 * Uso: npm run ytmusic        -> OAuth (recomendado)
 *      npm run ytmusic -- browser
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PY_DIR = path.join(__dirname, '..', 'python');
const BIN = process.platform === 'win32' ? 'ytmusicapi.exe' : 'ytmusicapi';
const VENV_BIN = path.join(PY_DIR, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', BIN);

const command = fs.existsSync(VENV_BIN) ? VENV_BIN : 'ytmusicapi';
const mode = process.argv[2] === 'browser' ? 'browser' : 'oauth';

console.log(`🔐 Ejecutando \`ytmusicapi ${mode}\` en ${PY_DIR}`);

const child = spawn(command, [mode], {
    cwd: PY_DIR,
    stdio: 'inherit',
    windowsHide: false
});

child.on('error', (error) => {
    console.error('❌ No pude ejecutar ytmusicapi:', error.message);
    console.error('   Crea el entorno con: py -m venv python/.venv && python/.venv/Scripts/pip install ytmusicapi');
    process.exit(1);
});

child.on('close', (code) => {
    if (code === 0) {
        console.log('\n✅ Autenticación finalizada. El archivo quedó en bot/python/.');
    } else {
        console.error(`\n❌ ytmusicapi salió con código ${code}.`);
    }

    process.exit(code ?? 1);
});
