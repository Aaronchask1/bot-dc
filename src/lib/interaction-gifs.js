const { EmbedBuilder } = require('discord.js');

// Acciones inspiradas en la página oficial de rol de Nekotina
// (https://nekotina.com/en/modules/roleplay). El GIF se pide a un proveedor
// SFW y siempre queda una lista local de respaldo si la API no responde.
const GIF_ENDPOINT = process.env.INTERACTION_GIF_API || 'https://api.otakugifs.xyz/gif';
const REFRESH_COOLDOWN_MS = 10 * 60_000;
const MAX_POOL = 24;
const OFFLINE = process.env.XYB_GIFS_OFFLINE === '1';

const FALLBACK_GIFS = {
  hug: [
    'https://cdn.otakugifs.xyz/gifs/hug/7a2404aa8760a665.gif',
    'https://cdn.otakugifs.xyz/gifs/hug/8366ecb42907d711.gif',
    'https://cdn.otakugifs.xyz/gifs/hug/e0f050fc0f8508fa.gif',
    'https://cdn.otakugifs.xyz/gifs/hug/Fd7apEdG1m.gif',
  ],
  slap: [
    'https://cdn.otakugifs.xyz/gifs/slap/8Xg35eViSf.gif',
    'https://cdn.otakugifs.xyz/gifs/slap/56d8426acc62f8fb.gif',
    'https://cdn.otakugifs.xyz/gifs/slap/ece489ec8a6a0c27.gif',
    'https://cdn.otakugifs.xyz/gifs/slap/bec6d0d98bd68398.gif',
  ],
  pat: [
    'https://cdn.otakugifs.xyz/gifs/pat/84f7a138d35d4081.gif',
    'https://cdn.otakugifs.xyz/gifs/pat/fe34c159c9551319.gif',
    'https://cdn.otakugifs.xyz/gifs/pat/a606PuT9XA.gif',
    'https://cdn.otakugifs.xyz/gifs/pat/761c3fc2651263bc.gif',
  ],
  cuddle: [
    'https://cdn.otakugifs.xyz/gifs/cuddle/ebc3e23450a4dcba.gif',
    'https://cdn.otakugifs.xyz/gifs/cuddle/aa8882919ed9833a.gif',
    'https://cdn.otakugifs.xyz/gifs/cuddle/f7a0437a100e7807.gif',
    'https://cdn.otakugifs.xyz/gifs/cuddle/7dca23f6128a1897.gif',
  ],
  poke: [
    'https://cdn.otakugifs.xyz/gifs/poke/ee2fea278c1765bd.gif',
    'https://cdn.otakugifs.xyz/gifs/poke/3U7KzbHzpt.gif',
    'https://cdn.otakugifs.xyz/gifs/poke/1e2d642623174623.gif',
    'https://cdn.otakugifs.xyz/gifs/poke/2527bd1932ba80df.gif',
  ],
  wave: [
    'https://cdn.otakugifs.xyz/gifs/wave/3f6db91547ebde66.gif',
    'https://cdn.otakugifs.xyz/gifs/wave/7832e5c768ca70cb.gif',
    'https://cdn.otakugifs.xyz/gifs/wave/219054cc5ff6806d.gif',
    'https://cdn.otakugifs.xyz/gifs/wave/2d7e6d6ab4f8c55e.gif',
  ],
  dance: [
    'https://cdn.otakugifs.xyz/gifs/dance/56f214a9c9af78ee.gif',
    'https://cdn.otakugifs.xyz/gifs/dance/mMnahvLne0.gif',
    'https://cdn.otakugifs.xyz/gifs/dance/970a3295802ae33f.gif',
    'https://cdn.otakugifs.xyz/gifs/dance/594d5fa6302b0e10.gif',
  ],
  smack: [
    'https://cdn.otakugifs.xyz/gifs/smack/bc7b0879f90cf6f7.gif',
    'https://cdn.otakugifs.xyz/gifs/smack/78c956974f371f70.gif',
    'https://cdn.otakugifs.xyz/gifs/smack/bd269a201834e64c.gif',
  ],
  bite: [
    'https://cdn.otakugifs.xyz/gifs/bite/7b9343dc2123353e.gif',
    'https://cdn.otakugifs.xyz/gifs/bite/9426533efd1d412f.gif',
    'https://cdn.otakugifs.xyz/gifs/bite/f99be8ff02b8f27b.gif',
  ],
  lick: [
    'https://cdn.otakugifs.xyz/gifs/lick/e14792b5f4433cc3.gif',
    'https://cdn.otakugifs.xyz/gifs/lick/68de3278a0041fcf.gif',
    'https://cdn.otakugifs.xyz/gifs/lick/edc58043ab55ff91.gif',
    'https://cdn.otakugifs.xyz/gifs/lick/e7796447a4db880a.gif',
  ],
  handhold: [
    'https://cdn.otakugifs.xyz/gifs/handhold/a2be9c7cbdb80d5b.gif',
    'https://cdn.otakugifs.xyz/gifs/handhold/3e100d40855fecea.gif',
    'https://cdn.otakugifs.xyz/gifs/handhold/1v0ZK48bw9.gif',
    'https://cdn.otakugifs.xyz/gifs/handhold/f9pOCLRlUU.gif',
  ],
  nom: [
    'https://cdn.otakugifs.xyz/gifs/nom/9e6d546b9894ebd8.gif',
    'https://cdn.otakugifs.xyz/gifs/nom/4bb7371b747a9815.gif',
    'https://cdn.otakugifs.xyz/gifs/nom/fc75b3ea3325450e.gif',
    'https://cdn.otakugifs.xyz/gifs/nom/ff56a7e108f2d5ee.gif',
  ],
  blush: [
    'https://cdn.otakugifs.xyz/gifs/blush/94860ccca44ef501.gif',
    'https://cdn.otakugifs.xyz/gifs/blush/b57021de2fa39cd0.gif',
    'https://cdn.otakugifs.xyz/gifs/blush/1ab8106c45113bc3.gif',
    'https://cdn.otakugifs.xyz/gifs/blush/6ac7a522bcd2a509.gif',
  ],
  cry: [
    'https://cdn.otakugifs.xyz/gifs/cry/2b80b2419a83f948.gif',
    'https://cdn.otakugifs.xyz/gifs/cry/72f26a1dc0901606.gif',
    'https://cdn.otakugifs.xyz/gifs/cry/2266af91bb2c6672.gif',
    'https://cdn.otakugifs.xyz/gifs/cry/bce899655bf64300.gif',
  ],
  laugh: [
    'https://cdn.otakugifs.xyz/gifs/laugh/80973fc3681ad813.gif',
    'https://cdn.otakugifs.xyz/gifs/laugh/mXuY67avPUeW.gif',
    'https://cdn.otakugifs.xyz/gifs/laugh/tFRZ88Dt24b5.gif',
    'https://cdn.otakugifs.xyz/gifs/laugh/58dac589db5416ed.gif',
  ],
  wink: ['https://cdn.otakugifs.xyz/gifs/wink/KOLnUuQpNg.gif'],
  smile: ['https://cdn.otakugifs.xyz/gifs/smile/4ce74643f35d606c.gif'],
  tickle: ['https://cdn.otakugifs.xyz/gifs/tickle/cf51f54dc51f8bf9.gif'],
  punch: ['https://cdn.otakugifs.xyz/gifs/punch/05bc002e281ddd92.gif'],
  happy: ['https://cdn.otakugifs.xyz/gifs/happy/W7tz474WLB.gif'],
  sleep: ['https://cdn.otakugifs.xyz/gifs/sleep/10ffda642616328b.gif'],
  stare: ['https://cdn.otakugifs.xyz/gifs/stare/rvYCQ3eRMbfP.gif'],
  scared: ['https://cdn.otakugifs.xyz/gifs/scared/8b66dab477403442.gif'],
};

const ACTIONS = {
  hug: {
    gif: 'hug', verb: 'abraza a', solo: 'se abraza a sí mismo/a', color: 0x9AD9A0,
    description: 'Un abrazo, quizá.',
  },
  slap: {
    gif: 'slap', verb: 'da una cachetada a', solo: 'da una cachetada al aire', color: 0xFF746C,
    description: 'Una cachetada leve... ¡con cariño!',
  },
  hi: {
    gif: 'wave', verb: 'saluda a', solo: 'saluda al servidor', color: 0x7ED6FF,
    description: 'Saluda con una sonrisa.',
  },
  highfive: {
    gif: 'wave', verb: 'choca los cinco con', solo: 'busca chocar esos cinco', color: 0xFFD166,
    description: 'Una high five para celebrar.',
  },
  pat: {
    gif: 'pat', verb: 'da palmaditas a', solo: 'pide palmaditas', color: 0xFFB4D8,
    description: 'Palmaditas suaves en la cabeza.',
  },
  cuddle: {
    gif: 'cuddle', verb: 'se acurruca con', solo: 'busca acurrucarse', color: 0xFF9CC4,
    description: 'Acurrucarse un ratito.',
  },
  poke: {
    gif: 'poke', verb: 'pica a', solo: 'pica al aire', color: 0xFFA36C,
    description: 'Un toquecito para llamar la atención.',
  },
  wave: {
    gif: 'wave', verb: 'saluda a', solo: 'saluda al servidor', color: 0x7ED6FF,
    description: 'Un saludo con la mano.',
  },
  dance: {
    gif: 'dance', verb: 'baila con', solo: 'baila para el servidor', color: 0xC792EA,
    description: '¡A mover el esqueleto!',
  },
  bonk: {
    gif: 'smack', verb: 'da un bonk a', solo: 'se da un bonk', color: 0xFF746C,
    description: '¡Bonk! Directo a la cabeza.',
  },
  bite: {
    gif: 'bite', verb: 'muerde a', solo: 'muerde al aire', color: 0xFF9CC4,
    description: 'Una mordidita de cariño.',
  },
  lick: {
    gif: 'lick', verb: 'lame a', solo: 'lame al aire', color: 0xFFB4D8,
    description: 'Un lametón de broma.',
  },
  handhold: {
    gif: 'handhold', verb: 'toma la mano de', solo: 'busca una mano', color: 0xFFB4D8,
    description: 'Tomar la mano sin soltar.',
  },
  feed: {
    gif: 'nom', verb: 'da de comer a', solo: 'come algo rico', color: 0xFFA36C,
    description: 'Un bocadito para compartir.',
  },
  heal: {
    gif: 'pat', verb: 'cura a', solo: 'se cura un poquito', color: 0x9AD9A0,
    description: 'Un poquito de amor curativo.',
  },
  blush: {
    gif: 'blush', verb: 'se sonroja por', solo: 'se sonroja', color: 0xFFB4D8,
    description: 'Ay, qué pena.',
  },
  cry: {
    gif: 'cry', verb: 'llora por', solo: 'llora un poquito', color: 0x7ED6FF,
    description: 'A llorar un rato.',
  },
  laugh: {
    gif: 'laugh', verb: 'se ríe con', solo: 'se ríe', color: 0xFFD166,
    description: 'Jajaja, no aguanto.',
  },
  wink: { gif: 'wink', verb: 'guiña un ojo a', solo: 'guiña un ojo', color: 0xFFB4D8, description: 'Un guiño cómplice.' },
  smile: { gif: 'smile', verb: 'sonríe a', solo: 'sonríe', color: 0xFFD166, description: 'Una sonrisa para compartir.' },
  tickle: { gif: 'tickle', verb: 'hace cosquillas a', solo: 'se hace cosquillas', color: 0xFF9CC4, description: '¡Cosquillas!' },
  punch: { gif: 'punch', verb: 'lanza un puñetazo de juego a', solo: 'entrena puñetazos', color: 0xFF746C, description: 'Un golpe de juego.' },
  happy: { gif: 'happy', verb: 'celebra con', solo: 'está feliz', color: 0xFFD166, description: '¡Un momento feliz!' },
  sleep: { gif: 'sleep', verb: 'duerme junto a', solo: 'se queda dormido/a', color: 0xC792EA, description: 'Hora de descansar.' },
  stare: { gif: 'stare', verb: 'mira fijamente a', solo: 'mira fijamente', color: 0x7ED6FF, description: 'Una mirada misteriosa.' },
  scared: { gif: 'scared', verb: 'se asusta junto a', solo: 'se lleva un susto', color: 0xC792EA, description: '¡Qué susto!' },
};

// Alias en español para que `xyb cachetada`, `xyb hola` o `xyb bailar`
// también funcionen sin aprender los nombres en inglés.
const ACTION_ALIASES = {
  hola: 'hi',
  cachetada: 'slap',
  palmadita: 'pat',
  acurrucar: 'cuddle',
  picar: 'poke',
  saludar: 'wave',
  bailar: 'dance',
  bonkear: 'bonk',
  morder: 'bite',
  lamer: 'lick',
  manos: 'handhold',
  alimentar: 'feed',
  curar: 'heal',
  sonrojar: 'blush',
  llorar: 'cry',
  reir: 'laugh',
  guino: 'wink',
  sonreir: 'smile',
  cosquillas: 'tickle',
  punetazo: 'punch',
  feliz: 'happy',
  dormir: 'sleep',
  mirar: 'stare',
  asustar: 'scared',
};

const pools = new Map(Object.entries(FALLBACK_GIFS).map(([kind, urls]) => [kind, [...urls]]));
const refreshing = new Set();
const refreshedAt = new Map();

function plainName(person) {
  const name = person?.displayName ?? person?.globalName ?? person?.username ?? person?.tag ?? 'alguien';
  return String(name).replace(/[*_`~|\\]/g, '').slice(0, 80);
}

function actionFor(action) {
  return ACTIONS[action] ?? ACTIONS.hug;
}

function randomGif(action) {
  const kind = actionFor(action).gif;
  const urls = pools.get(kind) ?? FALLBACK_GIFS.hug;
  void refresh(kind);
  return urls[Math.floor(Math.random() * urls.length)] ?? FALLBACK_GIFS.hug[0];
}

function refresh(kind) {
  if (OFFLINE || refreshing.has(kind)) return;
  const last = refreshedAt.get(kind) ?? 0;
  if (Date.now() - last < REFRESH_COOLDOWN_MS) return;

  let endpoint;
  try {
    endpoint = new URL(GIF_ENDPOINT);
  } catch {
    return;
  }
  refreshedAt.set(kind, Date.now());
  endpoint.searchParams.set('reaction', kind);
  endpoint.searchParams.set('format', 'gif');
  refreshing.add(kind);

  fetch(endpoint, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(2500),
  })
    .then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      if (typeof data?.url !== 'string' || !/^https:\/\//.test(data.url)) return;
      const urls = pools.get(kind);
      if (!urls || urls.includes(data.url)) return;
      urls.push(data.url);
      if (urls.length > MAX_POOL) urls.splice(0, urls.length - MAX_POOL);
    })
    .catch(() => { /* el respaldo local ya está listo */ })
    .finally(() => refreshing.delete(kind));
}

function describe(action, user, target) {
  const meta = actionFor(action);
  const actor = plainName(user);
  const other = plainName(target);
  const self = !target || target.id === user?.id;
  return `**${actor}** ${self ? meta.solo : `${meta.verb} **${other}**`}`;
}

function payloadFor({ action, user, target, description, components = [] }) {
  const meta = actionFor(action);
  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setDescription(description ?? describe(action, user, target))
    .setImage(randomGif(action))
    .setFooter({ text: '🐰 xyb · GIF de reacción' });
  return { embeds: [embed], components, allowedMentions: { parse: [] } };
}

module.exports = {
  ACTIONS,
  ACTION_ALIASES,
  FALLBACK_GIFS,
  plainName,
  randomGif,
  payloadFor,
};
