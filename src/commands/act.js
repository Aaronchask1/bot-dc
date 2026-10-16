const socialCard = require('../lib/social-card');

const ACTIONS = {
  pat: 'da unas palmaditas a', slap: 'da una bofetada a', poke: 'pica a',
  wave: 'saluda a', dance: 'baila con', highfive: 'choca los cinco con', bonk: 'da un bonk a',
};

module.exports = {
  name: 'act', aliases: Object.keys(ACTIONS), description: 'Interacciones: hug, pat, slap, poke, wave, dance, highfive y bonk.', usage: 'xyb act pat @persona | xyb pat @persona', guildOnly: true, resolveMember: true,
  slash: { description: 'Haz una interacción con alguien.', setup(builder) { return builder
    .addStringOption((option) => option.setName('accion').setDescription('Acción').setRequired(true).addChoices(...Object.keys(ACTIONS).map((name) => ({ name, value: name }))))
    .addUserOption((option) => option.setName('usuario').setDescription('Persona')); } },
  async execute({ invokedName, args, target, user, isSlash, interaction, reply, fail, defer }) {
    const action = isSlash ? interaction.options.getString('accion', true) : (invokedName === 'act' ? args.shift()?.toLowerCase() : invokedName);
    if (!ACTIONS[action]) return fail(`Acciones: ${Object.keys(ACTIONS).join(', ')}.`);
    const person = isSlash ? (interaction.options.getUser('usuario') ?? user) : (target ?? user);
    if (person.bot) return fail('Esa interacción es solo para personas.');
    const object = person.id === user.id ? 'sí mismo/a' : person.username;
    if (isSlash) await defer();
    await reply(await socialCard.card({ left: user, right: person, title: action.toUpperCase(), subtitle: `${user.username} ${ACTIONS[action]} ${object}`, badge: action === 'bonk' ? '💥' : '✨', color: action === 'slap' || action === 'bonk' ? '#ff746c' : '#ff9cc4', file: `${action}.png` }));
  },
};
