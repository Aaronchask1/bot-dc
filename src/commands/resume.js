const music = require('../music/manager');

module.exports = {
    name: 'resume',
    aliases: ['reanudar', 'continuar'],
    description: 'Continúa la canción pausada.',
    usage: 'xyb resume',
    guildOnly: true,
    slash: { description: 'Continúa la canción pausada.' },

    async execute(ctx) {
        const info = music.getSessionInfo(ctx.guild.id);

        if (!info?.current) {
            return ctx.fail('❌ No hay nada reproduciéndose.');
        }

        if (!info.paused) {
            return ctx.fail('▶️ Ya está reproduciéndose.');
        }

        music.resume(ctx.guild.id);

        return ctx.reply('▶️ Reanudado.');
    }
};
