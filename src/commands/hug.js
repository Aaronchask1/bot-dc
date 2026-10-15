const { EmbedBuilder } = require('discord.js');
const hugs = require('../lib/hugs');

module.exports = {
  name: 'hug',
  aliases: ['abrazo', 'abraza'],
  description: 'Le manda un abrazo.',
  usage: 'xyb hug [persona]',
  slash: {
    description: 'Le manda un abrazo.',
    setup(builder) {
      return builder.addUserOption((option) => option
        .setName('persona')
        .setDescription('A quién le quieres abrazar.'));
    },
  },

  async execute({ target, user, fail, reply }) {
    const person = target ?? user;
    if (person.id === user.id) {
      await fail('¿Abrazarte a ti mismo? Ni de chiste.');
      return;
    }
    if (person.bot) {
      await fail('Los bots no abrazamos... todavía.');
      return;
    }

    await reply({
      embeds: [hugs.embed(`${user} abraza a ${person}.`)],
      components: [hugs.backButton(user.id, person.id)],
    });
  },
};
