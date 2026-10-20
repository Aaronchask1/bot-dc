const { EmbedBuilder } = require('discord.js');
const music = require('../music/manager');

module.exports = {
    name: 'np',
    aliases: ['nowplaying', 'sonando'],
    description: 'Muestra la canción que está sonando.',
    usage: 'xyb np',
    guildOnly: true,
    slash: { description: 'Muestra la canción que está sonando.' },

    async execute(ctx) {
        const info = music.getSessionInfo(ctx.guild.id);

        if (!info?.current) {
            return ctx.fail('❌ No hay nada reproduciéndose.');
        }

        const track = info.current;
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setAuthor({ name: info.paused ? '⏸️ Pausado' : '▶️ Sonando ahora' })
            .setTitle(track.title.slice(0, 256))
            .setURL(track.url)
            .setDescription(`**${track.uploader}**\n\`${music.formatDuration(track.duration)}\``)
            .setFooter({ text: `Pedido por ${track.requestedBy ?? ctx.user.username}` });

        if (track.thumbnail) embed.setThumbnail(track.thumbnail);

        return ctx.reply({ embeds: [embed] });
    }
};
