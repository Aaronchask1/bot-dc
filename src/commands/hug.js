const hugs = require('../lib/hugs');
const interactionGifs = require('../lib/interaction-gifs');

module.exports = {
  name: 'hug',
  resolveMember: true,
  aliases: ['abrazo', 'abraza'],
  description: 'Le manda un abrazo con GIF.',
  usage: 'xyb hug [persona]',
  slash: {
    description: 'Le manda un abrazo con GIF.',
    setup(builder) {
      return builder.addUserOption((option) => option
        .setName('persona')
        .setDescription('A quién le quieres abrazar.'));
    },
  },

  async execute({ target, user, isSlash, fail, reply, defer }) {
    const person = target ?? user;
    if (person.bot) {
      await fail('Los bots no abrazamos... todavía.');
      return;
    }

    if (isSlash) await defer();
    const payload = interactionGifs.payloadFor({ action: 'hug', user, target: person });
    if (person.id !== user.id) payload.components = [hugs.backButton(user.id, person.id)];
    await reply(payload);
  },
};
