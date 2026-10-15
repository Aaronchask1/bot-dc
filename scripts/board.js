// Herramienta de trabajo: busca candidatas en Tenor, las baja y arma un tablero
// HTML para revisarlas a ojo antes de meterlas al bot. No se usa en producción.
// Uso: node scripts/board.js <carpeta-de-salida>
const fs = require('node:fs');
const path = require('node:path');

const QUERIES = {
  beso: ['anime-kiss-gifs', 'kiss-anime', 'anime-kiss', 'anime-kissing', 'manga-kiss', 'anime-couple-kiss', 'kiss-anime-couple', 'anime-love-kiss'],
  rechazo: ['anime-sad', 'anime-reject', 'sad-anime-gif', 'anime-crying', 'anime-disappointed', 'tsundere-anime', 'anime-no'],
};

const BAD = /nba|mimi|4mcna|chappelle|hogan|carolina|sanae|pvz|drake|ariana|conan|fortnite|rock-league|garfield|spongebob|penguin|tom-and-jerry|dog|cat-|kermit|pikachu|chocolate|elmo|luigi|sonic|minion|puss|csgo|valorant|furry|gojo/;

async function search(query) {
  const response = await fetch(`https://tenor.com/search/${query}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await response.text();
  return [...html.matchAll(/https:\/\/media\.tenor\.com\/[A-Za-z0-9]+\/[A-Za-z0-9_-]+\.gif/g)].map((match) => match[0]);
}

async function main() {
  const outDir = process.argv[2];
  const imgDir = path.join(outDir, 'imgs');
  fs.mkdirSync(imgDir, { recursive: true });

  const index = new Map();
  let counter = 0;
  let rows = '';

  for (const [group, queries] of Object.entries(QUERIES)) {
    const found = new Set();
    for (const query of queries) {
      try {
        for (const url of await search(query)) found.add(url);
      } catch { /* se ignora una búsqueda fallida */ }
    }
    const urls = [...found].filter((url) => !BAD.test(url.toLowerCase())).slice(0, 125);
    rows += `<h2>${group} (${urls.length})</h2><div class="g">`;

    for (const url of urls) {
      counter += 1;
      index.set(counter, url);
      const file = path.join(imgDir, `${counter}.gif`);
      if (!fs.existsSync(file)) {
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
        } catch { continue; }
      }
      rows += `<div class="c"><img src="imgs/${counter}.gif"><div class="n">${counter}</div></div>`;
    }
    rows += '</div>';
  }

  const page = `<html><head><meta charset="utf-8"><style>
    body{background:#000;margin:0;font-family:Arial}
    .g{display:grid;grid-template-columns:repeat(8,1fr);gap:2px}
    .c{position:relative;background:#111}
    .c img{width:100%;height:120px;object-fit:contain;display:block;background:#000}
    .n{position:absolute;top:0;left:0;background:#ff0044;color:#fff;font-weight:bold;font-size:20px;padding:0 5px}
    h2{color:#0f0;margin:2px;font-size:18px}
  </style></head><body>${rows}</body></html>`;

  fs.writeFileSync(path.join(outDir, 'board.html'), page);
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(Object.fromEntries(index), null, 0));
  console.log(`imágenes: ${counter} · tablero: ${path.join(outDir, 'board.html')}`);
}

main();
