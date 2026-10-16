const { createStore } = require('../store');

// A persistent, SFW media pool. Each kind keeps 60 different anime images.
// Fallbacks make the command instant on a cold start; refills run in the
// background and never block a Discord response.
const TARGET = 60;
const store = createStore('anime-media');
const memory = new Map();
const pending = new Map();

const categoryFor = {
  kiss: 'kiss', kiss_return: 'kiss', kiss_reject: 'cry', hug: 'hug',
  proposal: 'cuddle', marriage_accept: 'cuddle', marriage_reject: 'cry',
};

function usable(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((url) => typeof url === 'string' && /^https:\/\//.test(url)))];
}
function pool(kind, fallback = []) {
  if (!memory.has(kind)) memory.set(kind, usable(store.get(kind) ?? fallback));
  return memory.get(kind);
}
async function refill(kind, fallback = []) {
  if (pending.has(kind)) return pending.get(kind);
  const task = (async () => {
    const values = pool(kind, fallback);
    const category = categoryFor[kind] ?? 'hug';
    for (let attempt = 0; values.length < TARGET && attempt < 4; attempt += 1) {
      try {
        const response = await fetch(`https://api.waifu.pics/many/sfw/${category}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ exclude: values }), signal: AbortSignal.timeout(4000),
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.files)) break;
        const before = values.length;
        for (const url of usable(data.files)) if (!values.includes(url)) values.push(url);
        if (values.length === before) break;
      } catch { break; }
    }
    const saved = values.slice(0, TARGET);
    memory.set(kind, saved); store.set(kind, saved);
    return saved;
  })().finally(() => pending.delete(kind));
  pending.set(kind, task);
  return task;
}
function pick(kind, fallback = []) {
  const values = pool(kind, fallback);
  if (values.length < TARGET) void refill(kind, fallback);
  return values[Math.floor(Math.random() * values.length)] ?? fallback[0] ?? null;
}
function warm(entries) { for (const [kind, fallback] of Object.entries(entries)) void refill(kind, fallback); }

module.exports = { TARGET, pick, refill, warm };
