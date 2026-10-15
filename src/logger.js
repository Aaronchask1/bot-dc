const fs = require('node:fs');
const path = require('node:path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'bot.log');

function append(level, message, error) {
  const detail = error?.stack || error?.message || error || '';
  const line = `${new Date().toISOString()} [${level}] ${message}${detail ? ` :: ${detail}` : ''}`;

  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);

  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch (writeError) {
    console.error(`No se pudo escribir en el log: ${writeError.message}`);
  }
}

module.exports = {
  info: (message) => append('INFO', message),
  warn: (message, error) => append('WARN', message, error),
  error: (message, error) => append('ERROR', message, error),
};
