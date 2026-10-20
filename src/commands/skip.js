const music = require('../music/manager');

module.exports = {
    name: 'skip',
    aliases: ['saltar', 'next'],
    description: 'Salta a la siguiente canción de la cola.',
    usage: 'xyb skip',
    guildOnly: true,
    slash: { description: 'Salta a la siguiente canción de la cola.' },

    async execute(ctx) {
        const info = music.getSessionInfo(ctx.guild.id);

        if (!info?.current) {
            return ctx.fail('❌ No hay nada reproduciéndose.');
        }

        const saltada = info.current.title;
        const siguiente = info.queue[0]?.title ?? null;

        music.skip(ctx.guild.id);

        return ctx.reply(
            siguiente
                ? `⏭️ Saltada: **${saltada}**\n> Siguiente: **${siguiente}**`
                : `⏭️ Saltada: **${saltada}**\n> No quedan más canciones en la cola.`
        );
    }
};
