const music = require('../music/manager');
module.exports = {
  name: 'previous', aliases: ['anterior', 'back'], guildOnly: true,
  description: 'Vuelve a la canción anterior o reinicia la primera.', usage: 'xyb previous',
  slash: { description: 'Vuelve a la canción anterior.' },
  execute(ctx) {
    const info = music.getSessionInfo(ctx.guild.id);
    if (!info?.channelId || ctx.member?.voice?.channelId !== info.channelId) return ctx.fail('Únete al mismo canal de voz que el bot.');
    return ctx.reply(music.previous(ctx.guild.id) ? '⏮️ Volviendo a la canción anterior.' : 'No hay canción anterior disponible todavía.');
  },
};
