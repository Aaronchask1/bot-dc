const { EmbedBuilder } = require('discord.js');
const mb = require('../music/musicbrainz');
const music = require('../music/manager');

const COLOR = '#BA478F';
const BASE = 'https://musicbrainz.org';
const cooldowns = new Map();
const COOLDOWN_MS = 2500;

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(null), ms))
    ]);
}

function splitPipe(text) {
    const index = text.indexOf('|');
    if (index === -1) return [text.trim(), null];

    return [text.slice(0, index).trim(), text.slice(index + 1).trim()];
}

function helpEmbed() {
    return new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🧠 MusicBrainz')
        .setDescription('Base de datos abierta de música: grabaciones, artistas y lanzamientos.')
        .addFields(
            { name: '`xyb mb <búsqueda> | <artista>`', value: 'Busca grabaciones (opcionalmente filtra por artista).' },
            { name: '`xyb mb artist <nombre>`', value: 'Busca artistas.' },
            { name: '`xyb mb release <álbum> | <artista>`', value: 'Busca lanzamientos.' },
            { name: '`xyb mb now`', value: 'Busca la canción que está sonando.' }
        )
        .setFooter({ text: 'Datos de MusicBrainz (CC0)' });
}

function recordingEmbed(query, results) {
    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`🔎 Grabaciones: ${query.slice(0, 200)}`);

    if (!results.length) return embed.setDescription('Sin resultados.');

    embed.setDescription(
        results.map((item, index) => {
            const album = item.releases[0]
                ? `${item.releases[0].title}${item.firstReleaseDate ? ` (${item.firstReleaseDate})` : ''}`
                : 'Sin álbum';

            return (
                `**${index + 1}. ${item.title}** — ${item.artist}\n` +
                `> ${album} • \`${item.length || '--:--'}\` • ` +
                `[${item.mbid.slice(0, 8)}](${BASE}/recording/${item.mbid})`
            );
        }).join('\n\n')
    );

    return embed.setFooter({ text: 'mb · MusicBrainz' });
}

function artistEmbed(query, results) {
    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`🎤 Artistas: ${query.slice(0, 200)}`);

    if (!results.length) return embed.setDescription('Sin resultados.');

    embed.setDescription(
        results.map((item, index) => {
            const details = [item.type, item.country, item.disambiguation].filter(Boolean).join(' • ');

            return (
                `**${index + 1}. ${item.name}**` +
                `${details ? `\n> ${details}` : ''}` +
                `\n> [${item.mbid.slice(0, 8)}](${BASE}/artist/${item.mbid})`
            );
        }).join('\n\n')
    );

    return embed.setFooter({ text: 'mb artist · MusicBrainz' });
}

function releaseEmbed(query, results) {
    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`💿 Lanzamientos: ${query.slice(0, 200)}`);

    if (!results.length) return embed.setDescription('Sin resultados.');

    embed.setDescription(
        results.map((item, index) => {
            const details = [
                item.date,
                item.trackCount ? `${item.trackCount} pistas` : null,
                item.country,
                item.status
            ].filter(Boolean).join(' • ');

            return (
                `**${index + 1}. ${item.title}** — ${item.artist}\n` +
                `> ${details || 'Sin datos'}\n` +
                `> [${item.mbid.slice(0, 8)}](${BASE}/release/${item.mbid})`
            );
        }).join('\n\n')
    );

    return embed.setFooter({ text: 'mb release · MusicBrainz' });
}

module.exports = {
    name: 'mb',
    aliases: ['musicbrainz', 'meta'],
    description: 'Consulta grabaciones, artistas y álbumes en MusicBrainz.',
    usage: 'xyb mb <búsqueda> | artist <nombre> | release <álbum> | now',
    guildOnly: true,
    requiresNetwork: true,
    slash: {
        description: 'Consulta MusicBrainz (grabaciones, artistas o álbumes).',
        setup(builder) {
            return builder.addStringOption((option) => option
                .setName('consulta')
                .setDescription('Ej: artist Bad Bunny, release Un Verano Sin Ti, now')
                .setMaxLength(200));
        }
    },

    async execute(ctx) {
        const text = String(ctx.isSlash
            ? ctx.interaction.options.getString('consulta') ?? ''
            : ctx.args.join(' ')).trim();
        const args = text ? text.split(/\s+/) : [];
        const sub = (args[0] || '').toLowerCase();

        if (!text || sub === 'help' || sub === 'ayuda') {
            return ctx.reply({ embeds: [helpEmbed()] });
        }

        const userId = ctx.user?.id ?? 'anon';
        const lastUse = cooldowns.get(userId) || 0;
        if (Date.now() - lastUse < COOLDOWN_MS) {
            return ctx.fail('⏳ Espera un momento antes de volver a consultar MusicBrainz.');
        }
        cooldowns.set(userId, Date.now());

        if (ctx.isSlash) await ctx.defer();

        try {
            if (sub === 'artist') {
                const query = args.slice(1).join(' ').trim();
                if (!query) return ctx.fail('❌ Uso: `xyb mb artist <nombre>`');

                const results = await mb.searchArtists(query, { limit: 5 });
                return ctx.reply({ embeds: [artistEmbed(query, results)] });
            }

            if (sub === 'release' || sub === 'album') {
                const value = args.slice(1).join(' ').trim();
                if (!value) return ctx.fail('❌ Uso: `xyb mb release <álbum> | <artista>`');

                const [title, artist] = splitPipe(value);
                const results = await mb.searchReleases(title, { limit: 5, artist });
                return ctx.reply({ embeds: [releaseEmbed(title, results)] });
            }

            if (sub === 'now' || sub === 'actual') {
                const info = music.getSessionInfo(ctx.guild.id);
                if (!info?.current) return ctx.fail('❌ No hay nada reproduciéndose.');

                const track = info.current;
                const results = await mb.searchRecordings(track.title, {
                    artist: track.uploader,
                    limit: 1
                });

                if (!results.length) {
                    return ctx.fail(`❌ No encontré **${track.title}** en MusicBrainz.`);
                }

                const found = await mb.lookupRecording(results[0].mbid);
                const release = found.releases[0] || null;
                const cover = release ? await withTimeout(mb.getReleaseCover(release.id), 4000) : null;

                const embed = new EmbedBuilder()
                    .setColor(COLOR)
                    .setTitle(found.title)
                    .setURL(`${BASE}/recording/${found.mbid}`)
                    .setDescription(`**${found.artist}**`)
                    .addFields(
                        { name: 'Álbum', value: release?.title || '—', inline: true },
                        { name: 'Fecha', value: release?.date || found.firstReleaseDate || '—', inline: true },
                        { name: 'Duración', value: found.length || '—', inline: true },
                        { name: 'ISRC', value: found.isrcs[0] || '—', inline: true },
                        { name: 'MBID', value: `\`${found.mbid}\``, inline: false }
                    )
                    .setFooter({ text: 'mb now · MusicBrainz' });

                if (cover) embed.setThumbnail(cover);

                return ctx.reply({ embeds: [embed] });
            }

            const [title, artist] = splitPipe(text);
            const results = await mb.searchRecordings(title, { limit: 5, artist });

            return ctx.reply({ embeds: [recordingEmbed(title, results)] });
        } catch (error) {
            console.error('[MB]', error.message);

            const status = error?.status || error?.statusCode;
            if (status === 503) {
                return ctx.fail('❌ MusicBrainz está limitando las peticiones (503). Intenta de nuevo en unos segundos.');
            }

            return ctx.fail(`❌ Error consultando MusicBrainz: ${String(error.message).slice(0, 300)}`);
        }
    }
};
