const music = require('../music/manager');

module.exports = {
    name: 'stop',
    aliases: ['detener', 'disconnect'],
    description: 'Detiene la música, vacía la cola y sale del canal de voz.',
    usage: 'xyb stop',
    guildOnly: true,
    slash: { description: 'Detiene la música y sale del canal de voz.' },

    async execute(ctx) {
        const info = music.getSessionInfo(ctx.guild.id);

        if (!info?.current && !info?.queue.length) {
            return ctx.fail('❌ No estoy reproduciendo nada.');
        }

        music.stop(ctx.guild.id);

        return ctx.reply('⏹️ Reproducción detenida y cola vaciada. Me desconecté del canal.');
    }
};
