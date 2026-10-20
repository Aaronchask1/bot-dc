const { EmbedBuilder } = require('discord.js');
const music = require('../music/manager');

module.exports = {
    name: 'queue',
    aliases: ['cola', 'q'],
    description: 'Muestra la cola de reproducción.',
    usage: 'xyb queue',
    guildOnly: true,
    slash: { description: 'Muestra la cola de reproducción.' },

    async execute(ctx) {
        const info = music.getSessionInfo(ctx.guild.id);

        if (!info?.current) {
            return ctx.fail('❌ La cola está vacía.');
        }

        const lista = info.queue.slice(0, 10).map((track, index) =>
            `**${index + 1}.** ${track.title.slice(0, 60)} \`${music.formatDuration(track.duration)}\``
        );

        if (info.queue.length > 10) {
            lista.push(`> ...y ${info.queue.length - 10} más.`);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎵 Cola de reproducción')
            .addFields(
                {
                    name: `${info.paused ? '⏸️' : '▶️'} Sonando ahora`,
                    value: `**${info.current.title}**\n> \`${info.current.uploader}\` • \`${music.formatDuration(info.current.duration)}\``
                },
                {
                    name: `📜 En cola (${info.queue.length})`,
                    value: lista.length ? lista.join('\n') : '*No hay más canciones.*'
                }
            )
            .setFooter({ text: `Pedido por ${info.current.requestedBy ?? ctx.user.username}` });

        return ctx.reply({ embeds: [embed] });
    }
};
