const marriage = require('../lib/marriage');
const props = require('../lib/marriage-props');

module.exports = {
  name: 'marry',
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
    await reply({
      embeds: [props.proposalEmbed(user, person)],
      components: [props.buttons(user.id, person.id)],
    });
  },
};
