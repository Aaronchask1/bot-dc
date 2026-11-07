const panel = require('../music/panel');
module.exports = {
  name: 'panel', aliases: ['musicpanel'], guildOnly: true,
  description: 'Abre los controles de música.', usage: 'xyb panel',
  slash: { description: 'Abre los controles de música.' },
  execute(ctx) { return ctx.reply(panel.payload(ctx.guild.id)); },
};
