const { EmbedBuilder } = require('discord.js');
const ytmusic = require('../music/ytmusic');
const music = require('../music/manager');

const AUTH_HELP =
    '❌ Falta autenticación de YouTube Music.\n' +
    '```\nnpm run ytmusic\n```\n' +
    'Se abrirá el flujo OAuth y se guardará `python/oauth.json`.';

function splitPipe(text) {
    const index = text.indexOf('|');
    if (index === -1) return [text.trim(), null];

    return [text.slice(0, index).trim(), text.slice(index + 1).trim()];
}

function extractPlaylistId(value) {
    const match = value.match(/[?&]list=([\w-]+)/);
    return match ? match[1] : value;
}

function trackList(tracks) {
    return tracks
        .map((track, index) => `**${index + 1}.** ${track.title} — \`${music.formatDuration(track.duration)}\``)
        .join('\n');
}

function helpEmbed() {
    return new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🎧 YouTube Music')
        .setDescription('Crea y administra playlists de tu cuenta de YouTube Music.')
        .addFields(
            { name: '`xyb ytm create <nombre> | <búsqueda>`', value: 'Crea una playlist con las 5 mejores coincidencias.' },
            { name: '`xyb ytm add <id o URL> | <búsqueda>`', value: 'Añade 5 canciones a una playlist existente.' },
            { name: '`xyb ytm save <nombre>`', value: 'Guarda la canción actual y la cola en una playlist nueva.' },
            { name: '`xyb ytm list`', value: 'Lista tus playlists.' },
            { name: '`xyb ytm status`', value: 'Comprueba si hay autenticación configurada.' }
        )
        .setFooter({ text: 'Requiere npm run ytmusic para crear playlists' });
}

module.exports = {
    name: 'ytm',
    aliases: ['ytmusic', 'ytplaylist'],
    description: 'Crea y administra playlists de YouTube Music.',
    usage: 'xyb ytm create|add|save|list|status',
    guildOnly: true,
    requiresNetwork: true,
    slash: {
        description: 'Administra tus playlists de YouTube Music.',
        setup(builder) {
            return builder
                .addStringOption((option) => option
                    .setName('accion')
                    .setDescription('Qué quieres hacer.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Crear playlist', value: 'create' },
                        { name: 'Añadir canciones', value: 'add' },
                        { name: 'Guardar cola actual', value: 'save' },
                        { name: 'Listar playlists', value: 'list' },
                        { name: 'Ver estado de acceso', value: 'status' }
                    ))
                .addStringOption((option) => option
                    .setName('texto')
                    .setDescription('Ej: Mi playlist | Bad Bunny — o el ID/URL de la playlist.')
                    .setMaxLength(300));
        }
    },

    async execute(ctx) {
        const action = String(ctx.isSlash
            ? ctx.interaction.options.getString('accion') ?? ''
            : ctx.args[0] ?? '').toLowerCase();
        const rest = String(ctx.isSlash
            ? ctx.interaction.options.getString('texto') ?? ''
            : ctx.args.slice(1).join(' ')).trim();

        if (!action || action === 'help' || action === 'ayuda') {
            return ctx.reply({ embeds: [helpEmbed()] });
        }

        if (ctx.isSlash) await ctx.defer();

        try {
            if (action === 'status' || action === 'auth') {
                const status = await ytmusic.authStatus();

                return ctx.reply(
                    status.authenticated
                        ? `✅ Autenticado con YouTube Music.\n> Archivo: \`${status.authFile}\``
                        : AUTH_HELP
                );
            }

            if (action === 'create') {
                const [name, query] = splitPipe(rest);
                if (!name) return ctx.fail('❌ Uso: `xyb ytm create <nombre> | <búsqueda>`');

                const tracks = await ytmusic.search(query || name, { limit: 5 });
                if (!tracks.length) return ctx.fail('❌ No encontré canciones para esa búsqueda.');

                const result = await ytmusic.createPlaylist(
                    name,
                    `Creada desde Discord por ${ctx.user.username}`,
                    tracks.map((track) => track.id)
                );

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`🎧 Playlist creada: ${name}`)
                    .setURL(result.url)
                    .setDescription(trackList(tracks))
                    .setFooter({ text: `${result.added} canciones añadidas` });

                return ctx.reply({ embeds: [embed] });
            }

            if (action === 'add') {
                const [target, query] = splitPipe(rest);
                if (!target || !query) {
                    return ctx.fail('❌ Uso: `xyb ytm add <id o URL> | <búsqueda>`');
                }

                const tracks = await ytmusic.search(query, { limit: 5 });
                if (!tracks.length) return ctx.fail('❌ No encontré canciones para esa búsqueda.');

                const playlistId = extractPlaylistId(target);
                await ytmusic.addItems(playlistId, tracks.map((track) => track.id));

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🎧 Canciones añadidas')
                    .setURL(`https://music.youtube.com/playlist?list=${playlistId}`)
                    .setDescription(trackList(tracks));

                return ctx.reply({ embeds: [embed] });
            }

            if (action === 'save') {
                if (!rest) return ctx.fail('❌ Uso: `xyb ytm save <nombre>`');

                const info = music.getSessionInfo(ctx.guild.id);
                const tracks = [info?.current, ...(info?.queue || [])].filter(Boolean);

                if (!tracks.length) {
                    return ctx.fail('❌ No hay nada en la cola para guardar.');
                }

                const result = await ytmusic.createPlaylist(
                    rest,
                    `Guardada desde Discord por ${ctx.user.username}`,
                    tracks.map((track) => track.id)
                );

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`🎧 Playlist guardada: ${rest}`)
                    .setURL(result.url)
                    .setDescription(trackList(tracks))
                    .setFooter({ text: `${result.added} canciones guardadas` });

                return ctx.reply({ embeds: [embed] });
            }

            if (action === 'list') {
                const playlists = await ytmusic.listPlaylists(25);
                if (!playlists.length) return ctx.reply('📭 No tienes playlists en tu biblioteca.');

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🎧 Tus playlists')
                    .setDescription(
                        playlists
                            .map((item) => `• **${item.title}** — \`${item.count || 0}\` canciones\n\`${item.playlistId}\``)
                            .join('\n')
                    );

                return ctx.reply({ embeds: [embed] });
            }

            return ctx.fail('❌ Acción desconocida. Usa `xyb ytm` para ver la ayuda.');
        } catch (error) {
            console.error('[YTM]', error.message);

            if (error.code === 'NO_AUTH') return ctx.fail(AUTH_HELP);
            if (error.code === 'BAD_INPUT') return ctx.fail(`❌ ${error.message}`);

            return ctx.fail(`❌ Error de YouTube Music: ${String(error.message).slice(0, 300)}`);
        }
    }
};
