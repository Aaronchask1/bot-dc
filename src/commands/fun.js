const socialCard = require('../lib/social-card');
const choices = ['Sí.', 'No.', 'Probablemente.', 'Mejor no contar con ello.', 'Claro que sí.', 'Pregunta de nuevo más tarde.', 'Las señales apuntan a que sí.'];
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const displayName = (person) => String(person?.globalName ?? person?.username ?? 'Usuario').trim();

// Hashing the two IDs makes a ship stable: reversing the order, or repeating
// the command later, always produces the same compatibility.
function shipResult(left, right) {
  const ids = [String(left.id), String(right.id)].sort();
  let hash = 2166136261;
  for (const char of ids.join(':')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  const percent = left.id === right.id ? 100 : 1 + ((hash >>> 0) % 100);
  const a = displayName(left); const b = displayName(right);
  const first = a.slice(0, Math.max(1, Math.ceil(a.length / 2)));
  const last = b.slice(Math.max(0, Math.floor(b.length / 2)));
  const name = `${first}${last}`.slice(0, 32);
  const phrase = percent >= 90 ? 'Nunca se engañen. Esto es muy bello.'
    : percent >= 70 ? 'Hay una conexión que vale la pena cuidar.'
      : percent >= 45 ? 'Con paciencia, esta pareja puede funcionar.'
        : 'Los opuestos también pueden sorprender.';
  return { name, percent, phrase };
}

module.exports = {
  name: 'fun', aliases: ['8ball', 'eightball', 'choose', 'elige', 'coinflip', 'moneda', 'ship'], description: '8ball, elegir, moneda o compatibilidad.', usage: 'xyb fun (8ball|choose|coinflip|ship) · también xyb 8ball', guildOnly: false,
  slash: { description: 'Herramientas divertidas.', setup(builder) { return builder
    .addStringOption((option) => option.setName('accion').setDescription('8ball, choose, moneda o ship').setRequired(true).addChoices({ name: '8ball', value: '8ball' }, { name: 'Elegir', value: 'choose' }, { name: 'Moneda', value: 'coinflip' }, { name: 'Ship', value: 'ship' }))
    .addStringOption((option) => option.setName('texto').setDescription('Pregunta u opciones separadas por |'))
    .addUserOption((option) => option.setName('usuario1').setDescription('Persona para hacer ship contigo'))
    .addUserOption((option) => option.setName('usuario2').setDescription('Opcional: segunda persona para comparar a dos terceros'));
  } },
  async execute({ invokedName, args, text, user, isSlash, interaction, message, reply, defer }) {
    const action = isSlash ? interaction.options.getString('accion', true) : (invokedName === 'fun' ? args.shift()?.toLowerCase() : invokedName);
    const body = isSlash ? (interaction.options.getString('texto') ?? '') : (invokedName === 'fun' ? args.join(' ') : text);
    if (['8ball', 'eightball'].includes(action)) return reply(body ? `🎱 **Pregunta:** ${body}\n**Respuesta:** ${pick(choices)}` : 'Uso: `xyb 8ball ¿hoy gano?`.');
    if (['choose', 'elige'].includes(action)) {
      const options = body.split('|').map((item) => item.trim()).filter(Boolean);
      return reply(options.length >= 2 ? `🎲 Elijo: **${pick(options)}**` : 'Uso: `xyb choose pizza | tacos | ramen`.');
    }
    if (['coinflip', 'moneda'].includes(action)) return reply(`🪙 Salió **${pick(['cara', 'cruz'])}**.`);
    if (action === 'ship') {
      const mentioned = [...(message?.mentions?.users?.values?.() ?? [])];
      const first = isSlash ? interaction.options.getUser('usuario1') : mentioned[0];
      const second = isSlash ? interaction.options.getUser('usuario2') : mentioned[1];
      // The normal use is `xyb ship @persona`: the caller is the other half.
      // Two mentions remain supported for comparing two people other than the caller.
      const people = second ? [first ?? user, second] : first ? [user, first] : [];
      if (people.length !== 2) return reply('Uso: `xyb ship @persona`. También puedes mencionar a dos personas para compararlas entre sí.');
      const result = shipResult(people[0], people[1]);
      if (isSlash) await defer();
      const payload = await socialCard.card({ left: people[0], right: people[1], title: `${result.percent}%`, subtitle: `${result.name} · Compatibilidad`, badge: '♥', color: '#ff7aa8', file: 'ship.png' });
      payload.content = `💗 | El nombre del ship es **${result.name}**\n❤️ | La compatibilidad es **${result.percent}%**\n\n${result.phrase}`;
      return reply(payload);
    }
    return reply('Usa `xyb 8ball`, `xyb choose` o `xyb coinflip`.');
  },
};
module.exports.shipResult = shipResult;
