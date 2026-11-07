const music = require('../music/manager');
module.exports = {
  name: 'join', aliases: ['entrar'], guildOnly: true,
  description: 'Conecta el reproductor a tu canal de voz.', usage: 'xyb join',
  slash: { description: 'Conecta el reproductor a tu canal de voz.' },
  async execute(ctx) {
    if (ctx.isSlash) await ctx.defer();
    try {
      await music.ensureConnection(ctx);
      return ctx.reply('✅ Conectado a tu canal de voz.');
    } catch (error) { return ctx.fail(error.message); }
  },
};
