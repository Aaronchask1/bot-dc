const socialCard = require('../lib/social-card');
const { EmbedBuilder } = require('discord.js');
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
  name: 'fun', aliases: ['8ball', 'eightball', 'choose', 'elige', 'coinflip', 'flip', 'moneda', 'ship'], description: '8ball, elegir, moneda o compatibilidad.', usage: 'xyb fun (8ball|choose|flip|ship) · también xyb 8ball', guildOnly: false,
  slash: { description: 'Herramientas divertidas.', setup(builder) { return builder
    .addStringOption((option) => option.setName('accion').setDescription('8ball, choose, moneda o ship').setRequired(true).addChoices({ name: '8ball', value: '8ball' }, { name: 'Elegir', value: 'choose' }, { name: 'Moneda', value: 'coinflip' }, { name: 'Ship', value: 'ship' }))
    .addStringOption((option) => option.setName('texto').setDescription('Pregunta u opciones separadas por |'))
    .addUserOption((option) => option.setName('usuario1').setDescription('Persona para hacer ship contigo'))
    .addUserOption((option) => option.setName('usuario2').setDescription('Opcional: segunda persona para comparar a dos terceros'));
  } },
  async execute({ invokedName, args, text, user, isSlash, interaction, message, reply, send, defer }) {
    const action = isSlash ? interaction.options.getString('accion', true) : (invokedName === 'fun' ? args.shift()?.toLowerCase() : invokedName);
    const body = isSlash ? (interaction.options.getString('texto') ?? '') : (invokedName === 'fun' ? args.join(' ') : text);
    // En comandos de prefijo enviamos el panel al canal, no como una respuesta
    // anidada al mensaje original. En slash se mantiene la respuesta de interacción.
    const panel = (payload) => (!isSlash && send ? send(payload) : reply(payload));
    if (['8ball', 'eightball'].includes(action)) {
      if (!body) return reply('Uso: `xyb 8ball ¿hoy gano?`.');
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🎱 Bola mágica XYB')
        .addFields({ name: '❔ Pregunta', value: body.slice(0, 900) }, { name: '✨ Respuesta', value: pick(choices) })
        .setFooter({ text: `Consultada por ${user.username} · 🐰 xyb` });
      return panel({ embeds: [embed], allowedMentions: { parse: [] } });
    }
    if (['choose', 'elige'].includes(action)) {
      const options = body.split('|').map((item) => item.trim()).filter(Boolean);
      if (options.length < 2) return reply('Uso: `xyb choose pizza | tacos | ramen`.');
      return panel({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('🎲 Decisión tomada').setDescription(`Entre **${options.length}** opciones, elijo:\n\n# ${pick(options)}`).setFooter({ text: `Pedido por ${user.username}` })] });
    }
    if (['coinflip', 'flip', 'moneda'].includes(action)) {
      const result = pick(['Cara', 'Cruz']);
      return panel({ embeds: [new EmbedBuilder().setColor(0xF1C40F).setTitle('🪙 Lanzamiento de moneda').setDescription(`# ${result}`).setFooter({ text: `Lanzada por ${user.username}` })] });
    }
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
      const payload = await socialCard.card({ left: people[0], right: people[1], title: `${result.percent}%`, subtitle: `${result.name} · Compatibilidad`, badge: '♥', color: '#ff7aa8', file: 'ship.png', variant: 'ship' });
      payload.content = `💗 | El nombre del ship es **${result.name}**\n❤️ | La compatibilidad es **${result.percent}%**\n\n${result.phrase}`;
      return reply(payload);
    }
    return reply('Usa `xyb 8ball`, `xyb choose` o `xyb coinflip`.');
  },
};
module.exports.shipResult = shipResult;
