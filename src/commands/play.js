const { PermissionFlagsBits } = require('discord.js');
const music = require('../music/manager');

const ERRORS = {
    NOVOICE: '❌ Entra a un canal de voz primero.',
    NOPERMS: '❌ No tengo permisos para conectarme o hablar en ese canal.',
    NOCONNECTION: '❌ No pude conectarme al canal de voz.',
    NORESULTS: '❌ No encontré resultados para esa búsqueda.',
    YOUTUBE_AUTH: '❌ YouTube pide iniciar sesión para ese video. Guarda `cookies.txt` y reinicia el bot.',
    YOUTUBE_403: '❌ YouTube bloqueó el audio. Prueba de nuevo en unos segundos.'
};

async function respond(ctx, waiting, content) {
    if (waiting?.edit) return waiting.edit({ content, embeds: [] });
    return ctx.reply(content);
}

module.exports = {
    name: 'play',
    aliases: ['p', 'tocar', 'reproducir'],
    description: 'Reproduce una canción de YouTube en tu canal de voz.',
    usage: 'xyb play <canción o URL>',
    guildOnly: true,
    botPermissions: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
    slash: {
        description: 'Reproduce una canción de YouTube en tu canal de voz.',
        setup(builder) {
            return builder.addStringOption((option) => option
                .setName('busqueda')
                .setDescription('Nombre, artista o URL de YouTube.')
                .setRequired(true)
                .setMaxLength(200));
        }
    },

    async execute(ctx) {
        const query = String(ctx.isSlash
            ? ctx.interaction.options.getString('busqueda') ?? ''
            : ctx.args.join(' ')).trim();

        if (!query) {
            return ctx.fail('❌ Uso: `xyb play <canción o URL>`');
        }

        if (ctx.isSlash) await ctx.defer();

        let waiting = null;
        if (!ctx.isSlash) waiting = await ctx.reply('🔎 Buscando...');

        try {
            const { track } = await music.enqueue(ctx, query);
            const info = music.getSessionInfo(ctx.guild.id);
            const playingNow = info?.current?.id === track.id && info.queue.length === 0;

            const lineas = [
                `${playingNow ? '▶️ Reproduciendo' : '✅ Añadido a la cola'}: **${track.title}**`,
                `> \`${track.uploader}\` • \`${music.formatDuration(track.duration)}\``
            ];

            if (!playingNow && info?.queue.length) {
                lineas.push(`> Posición en la cola: \`${info.queue.length}\``);
            }

            return respond(ctx, waiting, lineas.join('\n'));
        } catch (error) {
            console.error('[PLAY]', error.message);

            const message = ERRORS[error.code]
                ?? `❌ No pude reproducir esa canción: ${String(error.message).slice(0, 300)}`;

            return respond(ctx, waiting, message);
        }
    }
};
