const music = require('../music/manager');

module.exports = {
    name: 'pause',
    aliases: ['pausa', 'pausar'],
    description: 'Pausa la canción que está sonando.',
    usage: 'xyb pause',
    guildOnly: true,
    slash: { description: 'Pausa la canción que está sonando.' },

    async execute(ctx) {
        const info = music.getSessionInfo(ctx.guild.id);

        if (!info?.current) {
            return ctx.fail('❌ No hay nada reproduciéndose.');
        }

        if (info.paused) {
            return ctx.fail('⏸️ Ya está pausado. Usa `xyb resume` para continuar.');
        }

        music.pause(ctx.guild.id);

        return ctx.reply('⏸️ Pausado.');
    }
};
