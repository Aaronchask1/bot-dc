// Herramienta de trabajo: baja candidatas de Imgur para una búsqueda y deja
// solo las que miden 400 px o más. No es parte del bot.
// Uso: node scripts/harvest.js <carpeta> <consulta1,consulta2,...>
const fs = require('node:fs');
const path = require('node:path');

const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };

function size(buffer) {
  if (buffer.slice(0, 3).toString() === 'GIF') return { w: buffer.readUInt16LE(6), h: buffer.readUInt16LE(8) };
  if (buffer.readUInt32BE(0) === 0x89504e47) return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
  return null;
}

(async () => {
  const [outDir, queriesArg] = process.argv.slice(2);
  const queries = queriesArg.split(',');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const galleries = new Set();
  for (const query of queries) {
    const response = await fetch(`https://imgur.com/search?q=${query}`, { headers: UA });
    for (const match of (await response.text()).matchAll(/\/gallery\/([A-Za-z0-9]{5,7})/g)) galleries.add(match[1]);
  }

  const gifs = new Map();
  for (const gallery of galleries) {
    const response = await fetch(`https://imgur.com/gallery/${gallery}`, { headers: UA });
    for (const match of (await response.text()).matchAll(/https:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.(gif|gifv)/g)) {
      const url = match[0].replace('.gifv', '.gif');
      if (!gifs.has(url)) gifs.set(url, gallery);
    }
  }

  const map = {};
  let n = 0;
  for (const [url, gallery] of gifs) {
    const response = await fetch(url);
    if (!response.ok) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    const measured = size(buffer);
    if (!measured || measured.w < 400) continue;
    n += 1;
    const name = `g${String(n).padStart(2, '0')}.gif`;
    fs.writeFileSync(path.join(outDir, name), buffer);
    map[name] = { url, size: `${measured.w}x${measured.h}`, gallery };
  }

  fs.writeFileSync(path.join(outDir, 'map.json'), JSON.stringify(map, null, 2));
  console.log(`galleries: ${galleries.size} · gifs: ${gifs.size} · guardados >=400px: ${n}`);
})();
