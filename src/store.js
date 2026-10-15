const fs = require('node:fs');
const path = require('node:path');
const logger = require('./logger');

const DATA_DIR = process.env.XYB_DATA_DIR
  ? path.resolve(process.env.XYB_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const WRITE_DELAY_MS = 300;
const stores = [];

/**
 * Almacén JSON con caché en memoria y escritura agrupada.
 * Evita leer y escribir el disco en cada comando, que es lo que hace más lento
 * un bot con muchos usuarios. La escritura es atómica (archivo temporal + rename).
 */
function createStore(name, fallback = {}) {
  const file = path.join(DATA_DIR, `${name}.json`);
  let cache = null;
  let timer = null;

  function load() {
    if (cache) return cache;
    try {
      cache = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') logger.warn(`No pude leer ${name}.json`, error);
      cache = JSON.parse(JSON.stringify(fallback));
    }
    return cache;
  }

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!cache) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(cache, null, 2)}\n`);
      fs.renameSync(temporary, file);
    } catch (error) {
      logger.error(`No pude guardar ${name}.json`, error);
    }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(flush, WRITE_DELAY_MS);
  }

  const store = {
    file,
    read: load,
    get: (key) => load()[key],
    set(key, value) {
      load()[key] = value;
      schedule();
      return value;
    },
    update(key, updater, valueIfMissing) {
      const data = load();
      const result = updater(key in data ? data[key] : valueIfMissing);
      if (result === undefined) delete data[key];
      else data[key] = result;
      schedule();
      return result;
    },
    delete(key) {
      if (!(key in load())) return false;
      delete load()[key];
      schedule();
      return true;
    },
    flush,
  };

  stores.push(store);
  return store;
}

// Si el proceso se muere de golpe, lo que estaba pendiente se guarda igual.
process.on('exit', () => {
  for (const store of stores) store.flush();
});

module.exports = { createStore, DATA_DIR };
