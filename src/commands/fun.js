const socialCard = require('../lib/social-card');
const choices = ['Sí.', 'No.', 'Probablemente.', 'Mejor no contar con ello.', 'Claro que sí.', 'Pregunta de nuevo más tarde.', 'Las señales apuntan a que sí.'];
const pick = (items) => items[Math.floor(Math.random() * items.length)];

module.exports = {
  name: 'fun', aliases: ['8ball', 'eightball', 'choose', 'elige', 'coinflip', 'moneda', 'ship'], description: '8ball, elegir, moneda o compatibilidad.', usage: 'xyb fun (8ball|choose|coinflip|ship) · también xyb 8ball', guildOnly: false,
  slash: { description: 'Herramientas divertidas.', setup(builder) { return builder
    .addStringOption((option) => option.setName('accion').setDescription('8ball, choose, moneda o ship').setRequired(true).addChoices({ name: '8ball', value: '8ball' }, { name: 'Elegir', value: 'choose' }, { name: 'Moneda', value: 'coinflip' }, { name: 'Ship', value: 'ship' }))
    .addStringOption((option) => option.setName('texto').setDescription('Pregunta u opciones separadas por |'))
    .addUserOption((option) => option.setName('usuario1').setDescription('Primera persona para ship'))
    .addUserOption((option) => option.setName('usuario2').setDescription('Segunda persona para ship'));
  } },
  async execute({ invokedName, args, text, isSlash, interaction, message, reply, defer }) {
    const action = isSlash ? interaction.options.getString('accion', true) : (invokedName === 'fun' ? args.shift()?.toLowerCase() : invokedName);
    const body = isSlash ? (interaction.options.getString('texto') ?? '') : (invokedName === 'fun' ? args.join(' ') : text);
    if (['8ball', 'eightball'].includes(action)) return reply(body ? `🎱 **Pregunta:** ${body}\n**Respuesta:** ${pick(choices)}` : 'Uso: `xyb 8ball ¿hoy gano?`.');
    if (['choose', 'elige'].includes(action)) {
      const options = body.split('|').map((item) => item.trim()).filter(Boolean);
      return reply(options.length >= 2 ? `🎲 Elijo: **${pick(options)}**` : 'Uso: `xyb choose pizza | tacos | ramen`.');
    }
    if (['coinflip', 'moneda'].includes(action)) return reply(`🪙 Salió **${pick(['cara', 'cruz'])}**.`);
    if (action === 'ship') {
      const people = isSlash
        ? [interaction.options.getUser('usuario1'), interaction.options.getUser('usuario2')].filter(Boolean)
        : [...(message?.mentions?.users?.values?.() ?? [])].slice(0, 2);
      if (people.length !== 2) return reply('Uso: `xyb ship @persona1 @persona2`.');
      const percent = Math.floor(Math.random() * 101);
      if (isSlash) await defer();
      return reply(await socialCard.card({ left: people[0], right: people[1], title: `${percent}%`, subtitle: 'Compatibilidad', badge: '💘', color: '#ff7aa8', file: 'ship.png' }));
    }
    return reply('Usa `xyb 8ball`, `xyb choose` o `xyb coinflip`.');
  },
};
