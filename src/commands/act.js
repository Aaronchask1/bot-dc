const { EmbedBuilder } = require('discord.js');

const ACTIONS = {
  pat: 'da unas palmaditas a', slap: 'da una bofetada a', poke: 'pica a',
  wave: 'saluda a', dance: 'baila con', highfive: 'choca los cinco con', bonk: 'da un bonk a',
};
const MEDIA = {
  pat: 'https://media.tenor.com/4C3YZ9rK_TAAAAAC/anime-pat.gif',
  slap: 'https://media.tenor.com/Toq8w2NPI4oAAAAC/anime-slap.gif', poke: 'https://media.tenor.com/1V4lWwFyxJ0AAAAC/anime-poke.gif',
  wave: 'https://media.tenor.com/9tICx8xmbqEAAAAC/anime-wave.gif', dance: 'https://media.tenor.com/Pr0xR2jaUXwAAAAC/anime-dance.gif',
  highfive: 'https://media.tenor.com/PKKCAakpBV0AAAAC/anime-high-five.gif', bonk: 'https://media.tenor.com/8ZL5Pq0Fw0cAAAAC/bonk-anime.gif',
};

module.exports = {
  name: 'act', aliases: Object.keys(ACTIONS), description: 'Interacciones: hug, pat, slap, poke, wave, dance, highfive y bonk.', usage: 'xyb act pat @persona | xyb pat @persona', guildOnly: true, resolveMember: true,
  slash: { description: 'Haz una interacción con alguien.', setup(builder) { return builder
    .addStringOption((option) => option.setName('accion').setDescription('Acción').setRequired(true).addChoices(...Object.keys(ACTIONS).map((name) => ({ name, value: name }))))
    .addUserOption((option) => option.setName('usuario').setDescription('Persona')); } },
  async execute({ invokedName, args, target, user, isSlash, interaction, reply, fail }) {
    const action = isSlash ? interaction.options.getString('accion', true) : (invokedName === 'act' ? args.shift()?.toLowerCase() : invokedName);
    if (!ACTIONS[action]) return fail(`Acciones: ${Object.keys(ACTIONS).join(', ')}.`);
    const person = isSlash ? (interaction.options.getUser('usuario') ?? user) : (target ?? user);
    if (person.bot) return fail('Esa interacción es solo para personas.');
    const object = person.id === user.id ? 'sí mismo/a' : person;
    await reply({ embeds: [new EmbedBuilder().setColor(0xFF8C69).setDescription(`**${user.username}** ${ACTIONS[action]} ${object}.`).setImage(MEDIA[action]) ] });
  },
};
