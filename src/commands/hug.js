const { EmbedBuilder } = require('discord.js');
const hugs = require('../lib/hugs');
const socialCard = require('../lib/social-card');

module.exports = {
  name: 'hug',
  resolveMember: true,
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

  async execute({ target, user, isSlash, fail, reply, defer }) {
    const person = target ?? user;
    if (person.id === user.id) {
      await fail('¿Abrazarte a ti mismo? Ni de chiste.');
      return;
    }
    if (person.bot) {
      await fail('Los bots no abrazamos... todavía.');
      return;
    }

    if (isSlash) await defer();
    const payload = await socialCard.card({ left: user, right: person, title: 'ABRAZO', subtitle: `${user.username} abraza a ${person.username}`, badge: '🫂', color: '#9ad9a0', file: 'hug.png', backgroundUrl: hugs.randomImage() });
    payload.components = [hugs.backButton(user.id, person.id)];
    await reply(payload);
  },
};
