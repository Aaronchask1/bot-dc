const welcome = require('../lib/welcome');

module.exports = {
  name: 'welcomevars',
  aliases: ['wlcvar', 'variables'],
  description: 'Muestra las variables que puedes usar en la bienvenida.',
  usage: 'xyb welcomevars',
  guildOnly: true,
  slash: { description: 'Muestra las variables que puedes usar en la bienvenida.' },

  async execute({ reply }) {
    await reply({ embeds: [welcome.variablesEmbed()] });
  },
};
