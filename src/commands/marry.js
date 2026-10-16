const marriage = require('../lib/marriage');
const props = require('../lib/marriage-props');
const { prepareKissPayload } = require('../lib/kiss-media');
const socialCard = require('../lib/social-card');

module.exports = {
  name: 'marry',
  resolveMember: true,
  aliases: ['casar', 'casarse', 'pedirmatrimonio'],
  description: 'Le pide la mano. La otra persona tiene que aceptar.',
  usage: 'xyb marry [persona]',
  guildOnly: true,
  slash: {
    description: 'Le pide la mano. La otra persona tiene que aceptar.',
    setup(builder) {
      return builder.addUserOption((option) => option
        .setName('persona')
        .setDescription('A quién le pides la mano.'));
    },
  },

  async execute({ target, user, guild, isSlash, fail, reply }) {
    const person = target;
    if (!person || person.id === user.id) {
      await fail(isSlash ? 'Elige a otra persona, no a ti.' : 'Menciona a alguien: `xyb marry @persona`');
      return;
    }
    if (person.bot) {
      await fail('No te cases con un bot, te va a abandonar.');
      return;
    }
    if (marriage.getPartner(guild.id, user.id)) {
      await fail('Ya estás casada(o). Primero `xyb divorce`.');
      return;
    }
    if (marriage.getPartner(guild.id, person.id)) {
      await fail('Esa persona ya está casada(o).');
      return;
    }

    // Todavía no se casan: aquí solo va la propuesta con sus botones.
    let payload = await prepareKissPayload(props.proposalPayload(user, person));
    // A bad third-party GIF must never leave an empty marriage proposal.
    if (!payload.files?.length) {
      payload = await socialCard.card({ left: user, right: person, title: '¡PROPUESTA!', subtitle: `${user.username} + ${person.username}`, badge: '💍', color: '#ffb6c1', file: 'proposal-card.png', variant: 'ship' });
      payload.content = `💍 ${user} le está pidiendo la mano a ${person}.`;
    }
    payload.components = [props.buttons(user.id, person.id)];
    await reply(payload);
  },
};
