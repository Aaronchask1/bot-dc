const {
    joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    NoSubscriberBehavior,
    StreamType
} = require('@discordjs/voice');

const { EmbedBuilder } = require('discord.js');
const ytdlp = require('./ytdlp');
const youtube = require('./youtube');
const soundcloud = require('./soundcloud');
const itunes = require('./itunes');

const LEAVE_DELAY_MS = 2 * 60 * 1000;

const sessions = new Map();
const volumeDefaults = new Map();

function clampVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(Math.max(numeric, 0), 2);
}

/**
 * Acepta 0.5 u 80 (porcentaje) indistintamente.
 * MUSIC_VOLUME=100 se interpreta como 100 %, no como 200 %.
 */
function normalizeVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return clampVolume(numeric > 2 ? numeric / 100 : numeric);
}

const DEFAULT_VOLUME = normalizeVolume(process.env.MUSIC_VOLUME);

function getSession(guildId, client) {
    let session = sessions.get(guildId);

    if (!session) {
        session = {
            guildId,
            client,
            connection: null,
            player: null,
            queue: [],
            current: null,
            stream: null,
            textChannelId: null,
            advancing: false,
            loadToken: 0,
            bitrateKbps: 64,
            volume: clampVolume(volumeDefaults.get(guildId) ?? DEFAULT_VOLUME),
            directUrl: null,
            directTrackId: null,
            playStartedAt: null,
            pausedAt: null,
            pausedTotal: 0,
            reloadPending: null,
            leaveTimer: null
        };

        session.player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
        });

        session.player.on(AudioPlayerStatus.Idle, () => {
            if (!sessions.has(guildId)) return;

            const reload = session.reloadPending;
            if (reload) {
                session.reloadPending = null;
                if (session.current) {
                    startTrack(guildId, session.current, {
                        seek: reload.seek,
                        keepPaused: reload.keepPaused,
                        silent: true
                    });
                }
                return;
            }

            session.current = null;
            session.playStartedAt = null;
            playNext(guildId);
        });

        session.player.on('error', (error) => {
            console.error('[MUSIC] Error de reproducción:', error.message);
        });

        sessions.set(guildId, session);
    }

    return session;
}

function computeBitrate() {
    const configured = Number(process.env.MUSIC_BITRATE);
    if (Number.isFinite(configured) && configured > 0) {
        return Math.min(Math.max(Math.round(configured), 32), 128);
    }

    return 64;
}

function clearLeaveTimer(session) {
    if (session.leaveTimer) {
        clearTimeout(session.leaveTimer);
        session.leaveTimer = null;
    }
}

function destroyCurrentStream(session) {
    if (session.stream) {
        try { session.stream.kill(); } catch {}
        session.stream = null;
    }

    session.directUrl = null;
    session.directTrackId = null;
}

function scheduleLeave(session) {
    clearLeaveTimer(session);

    session.leaveTimer = setTimeout(() => {
        const current = sessions.get(session.guildId);
        if (!current || current.current || current.queue.length > 0) return;
        leave(session.guildId);
    }, LEAVE_DELAY_MS);
}

function leave(guildId) {
    const session = sessions.get(guildId);
    if (!session) return false;

    clearLeaveTimer(session);
    session.reloadPending = null;
    destroyCurrentStream(session);

    try { session.player.stop(true); } catch {}
    try { session.connection?.destroy(); } catch {}

    sessions.delete(guildId);
    return true;
}

/**
 * Entra al canal de voz del autor. El contexto puede ser un mensaje
 * (`message`) o el contexto de los comandos nuevos (`ctx`).
 */
async function ensureConnection(source) {
    const guild = source.guild;
    const member = source.member;
    const channel = source.channel;
    const client = source.client;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
        const error = new Error('Necesitas estar en un canal de voz.');
        error.code = 'NOVOICE';
        throw error;
    }

    const permissions = voiceChannel.permissionsFor(guild.members.me);
    if (!permissions?.has('Connect') || !permissions?.has('Speak')) {
        const error = new Error('No tengo permisos para conectarme o hablar en ese canal.');
        error.code = 'NOPERMS';
        throw error;
    }

    const session = getSession(guild.id, client);
    clearLeaveTimer(session);

    session.textChannelId = channel.id;
    session.bitrateKbps = computeBitrate();

    // Si otro comando (por ejemplo `vc`) dejó una conexión abierta, se cierra:
    // `vc` entra auto-muteado y por esa conexión no se podría reproducir audio.
    const globalConnection = getVoiceConnection(guild.id);
    if (globalConnection && globalConnection !== session.connection) {
        try { globalConnection.destroy(); } catch {}
    }

    const alreadyConnected =
        session.connection &&
        session.connection.state.status !== VoiceConnectionStatus.Destroyed &&
        session.connection.joinConfig.channelId === voiceChannel.id;

    if (!alreadyConnected) {
        if (session.connection) {
            try { session.connection.destroy(); } catch {}
        }

        session.connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false
        });

        session.connection.subscribe(session.player);

        session.connection.on(VoiceConnectionStatus.Destroyed, () => {
            const active = sessions.get(guild.id);
            if (!active) return;
            destroyCurrentStream(active);
            sessions.delete(guild.id);
        });

        try {
            await entersState(session.connection, VoiceConnectionStatus.Ready, 20_000);
        } catch {
            try { session.connection.destroy(); } catch {}
            session.connection = null;
            sessions.delete(guild.id);

            const error = new Error('No pude conectarme al canal de voz.');
            error.code = 'NOCONNECTION';
            throw error;
        }
    } else {
        session.connection.subscribe(session.player);
    }

    return session;
}

function formatDuration(seconds) {
    if (!seconds || !Number.isFinite(seconds)) return 'EN VIVO';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
}

function getPositionSeconds(session) {
    if (!session.playStartedAt) return 0;

    const end = session.pausedAt ?? Date.now();
    return Math.max(0, (end - session.playStartedAt - session.pausedTotal) / 1000);
}

async function notify(session, content) {
    if (!session.textChannelId) return;

    try {
        const channel = await session.client.channels.fetch(session.textChannelId);
        if (channel?.isTextBased()) await channel.send(content);
    } catch (error) {
        console.error('[MUSIC] No pude enviar el aviso:', error.message);
    }
}

async function announce(session, track) {
    if (!session.textChannelId) return;

    try {
        const channel = await session.client.channels.fetch(session.textChannelId);
        if (!channel?.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setAuthor({ name: '🎶 Reproduciendo ahora' })
            .setTitle(String(track.title).slice(0, 256))
            .setDescription(`**${track.uploader}**\n\`${formatDuration(track.duration)}\``)
            .setFooter({ text: `Pedido por ${track.requestedBy}` });

        if (track.url) embed.setURL(track.url);
        if (track.thumbnail) embed.setThumbnail(track.thumbnail);

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[MUSIC] No pude enviar el embed:', error.message);
    }
}

async function startTrack(guildId, track, { seek = 0, keepPaused = false, silent = false } = {}) {
    const session = sessions.get(guildId);
    if (!session || !track) return;

    if (session.advancing) return;
    session.advancing = true;

    const token = ++session.loadToken;
    let retry = false;

    try {
        const cachedUrl = session.directTrackId === track.id ? session.directUrl : null;

        destroyCurrentStream(session);
        session.current = track;

        const source = await ytdlp.openStream(track.url, {
            seek,
            bitrateKbps: session.bitrateKbps,
            volume: session.volume,
            directUrl: cachedUrl || track.directUrl || null
        });

        if (token !== session.loadToken || !sessions.has(guildId)) {
            source.kill();
            retry = sessions.has(guildId);
            return;
        }

        session.stream = source;
        session.directUrl = source.directUrl || null;
        session.directTrackId = track.id;

        session.playStartedAt = Date.now();
        session.pausedAt = null;
        session.pausedTotal = 0;

        const resource = createAudioResource(source.stream, {
            inputType: StreamType.OggOpus,
            metadata: track
        });

        session.player.play(resource);

        if (keepPaused) {
            session.player.pause();
            session.pausedAt = Date.now();
        }

        if (!silent) announce(session, track);
    } catch (error) {
        console.error('[MUSIC] Error al reproducir:', error.message);
        session.current = null;
        session.playStartedAt = null;

        // Si YouTube falla (IP bloqueada, token caducado, etc.) se intenta
        // una vez la misma búsqueda en SoundCloud antes de rendirse.
        if (track.source === 'youtube' && track.fallbackQuery && !track.fallbackAttempted) {
            track.fallbackAttempted = true;

            try {
                const fallback = await resolveSoundCloudOnly(track.fallbackQuery);
                fallback.requestedBy = track.requestedBy;
                fallback.fallbackAttempted = true;
                session.queue.unshift(fallback);
                retry = true;

                if (!silent) {
                    notify(session, '⚠️ YouTube no respondió; probando la misma canción en SoundCloud...');
                }

                return;
            } catch (fallbackError) {
                console.error('[MUSIC] Tampoco se pudo reproducir en SoundCloud:', fallbackError.message);
            }
        }

        if (!silent) {
            if (error.code === 'NO_PLAYABLE' || error.code === 'DRM') {
                notify(session, `⚠️ No pude reproducir **${track.title}**: ${error.message}`);
            } else {
                notify(session, `⚠️ No pude reproducir **${track.title}**. Prueba con otra versión o enlace.`);
            }
        }

        retry = sessions.has(guildId) && session.queue.length > 0;
        if (!retry) scheduleLeave(session);
    } finally {
        session.advancing = false;
        if (retry) setImmediate(() => playNext(guildId));
    }
}

function playNext(guildId) {
    const session = sessions.get(guildId);
    if (!session || session.advancing) return;

    const track = session.queue.shift();

    if (!track) {
        session.current = null;
        session.playStartedAt = null;
        scheduleLeave(session);
        return;
    }

    startTrack(guildId, track);
}

function applyMetadata(track, metadata) {
    if (!track.thumbnail && metadata[0]?.thumbnail) {
        track.thumbnail = metadata[0].thumbnail;
    }

    if (!track.duration && metadata[0]?.duration) {
        track.duration = metadata[0].duration;
    }

    return track;
}

async function resolveSoundCloudOnly(text, metadata) {
    let info = metadata;

    if (!info) {
        try {
            info = await itunes.search(text, { limit: 1 });
        } catch (error) {
            console.error('[MUSIC] iTunes no respondió, se busca el texto original:', error.message);
            info = [];
        }
    }

    const title = info[0]?.title;
    const artist = info[0]?.artist;
    const attempts = [];

    // El título solo suele encontrar subidas de usuarios; añadir el artista
    // puede dejar únicamente la versión oficial con DRM.
    if (title) attempts.push({ query: title, expectedTitle: title });
    if (title && artist) attempts.push({ query: `${title} ${artist}`, expectedTitle: title });
    if (!attempts.some((attempt) => attempt.query.toLowerCase() === text.toLowerCase())) {
        attempts.push({ query: text, expectedTitle: null });
    }

    let results = [];
    let lastError = null;

    for (const attempt of attempts) {
        try {
            results = await soundcloud.search(attempt.query, {
                limit: 10,
                expectedTitle: attempt.expectedTitle
            });
            if (results.length) break;
        } catch (error) {
            lastError = error;
            if (error.code !== 'NO_PLAYABLE') throw error;
        }
    }

    if (!results.length) {
        if (lastError?.code === 'NO_PLAYABLE') throw lastError;

        const error = new Error('No encontré resultados para esa búsqueda.');
        error.code = 'NORESULTS';
        throw error;
    }

    return applyMetadata(results[0], info);
}

async function resolveTrack(query) {
    const text = String(query || '').trim();

    if (ytdlp.isUrl(text)) {
        if (youtube.isYouTubeUrl(text)) return youtube.resolveUrl(text);
        if (soundcloud.isSoundCloudUrl(text)) return soundcloud.resolveUrl(text);
        throw soundcloud.unsupportedUrlError();
    }

    // iTunes solo aporta título/artista/duración para acertar con la búsqueda.
    let metadata = [];
    try {
        metadata = await itunes.search(text, { limit: 1 });
    } catch (error) {
        console.error('[MUSIC] iTunes no respondió, se busca el texto original:', error.message);
    }

    const title = metadata[0]?.title;
    const artist = metadata[0]?.artist;
    const duration = metadata[0]?.duration;
    const attempts = [];

    if (title && artist) {
        attempts.push({
            query: `${title} ${artist}`,
            expectedTitle: title,
            expectedArtist: artist,
            expectedDuration: duration
        });
    }
    if (title) {
        attempts.push({
            query: title,
            expectedTitle: title,
            expectedArtist: artist,
            expectedDuration: duration
        });
    }
    if (!attempts.some((attempt) => attempt.query.toLowerCase() === text.toLowerCase())) {
        attempts.push({
            query: text,
            expectedTitle: null,
            expectedArtist: null,
            expectedDuration: duration
        });
    }

    let youtubeError = null;

    // YouTube es la fuente principal (la misma que usaba el bot anterior).
    for (const attempt of attempts) {
        try {
            const results = await youtube.search(attempt.query, {
                limit: 10,
                expectedTitle: attempt.expectedTitle,
                expectedArtist: attempt.expectedArtist,
                expectedDuration: attempt.expectedDuration
            });

            if (results.length) {
                const track = applyMetadata(results[0], metadata);
                track.fallbackQuery = text;
                return track;
            }
        } catch (error) {
            youtubeError = error;
            if (process.env.MUSIC_DEBUG) {
                console.error(`[YouTube] ${attempt.query}: ${error.message}`);
            }
        }
    }

    // Si YouTube no da una versión reproducible, se mantiene SoundCloud como
    // respaldo para que el comando no se quede sin audio.
    try {
        return await resolveSoundCloudOnly(text, metadata);
    } catch (soundCloudError) {
        if (soundCloudError.code === 'NO_PLAYABLE' || soundCloudError.code === 'NORESULTS') {
            throw soundCloudError;
        }
        throw youtubeError || soundCloudError;
    }
}

async function enqueue(source, query) {
    const session = await ensureConnection(source);

    const track = await resolveTrack(query);
    const user = source.author ?? source.user;
    track.requestedBy = user?.username ?? user?.tag ?? 'Desconocido';

    session.queue.push(track);

    if (!session.current && session.player.state.status !== AudioPlayerStatus.Playing) {
        playNext(source.guild.id);
    }

    return { track, position: session.queue.length, session };
}

function skip(guildId) {
    const session = sessions.get(guildId);
    if (!session || !session.current) return false;

    session.loadToken++;
    session.reloadPending = null;

    const status = session.player.state.status;
    const playing =
        status === AudioPlayerStatus.Playing ||
        status === AudioPlayerStatus.Paused ||
        status === AudioPlayerStatus.AutoPaused ||
        status === AudioPlayerStatus.Buffering;

    if (playing) {
        session.player.stop();
    } else if (!session.advancing) {
        session.current = null;
        playNext(guildId);
    }

    return true;
}

function stop(guildId) {
    return leave(guildId);
}

function pause(guildId) {
    const session = sessions.get(guildId);
    if (!session || !session.current) return false;

    const paused = session.player.pause();
    if (paused && !session.pausedAt) session.pausedAt = Date.now();

    return paused;
}

function resume(guildId) {
    const session = sessions.get(guildId);
    if (!session || !session.current) return false;

    const resumed = session.player.unpause();
    if (resumed && session.pausedAt) {
        session.pausedTotal += Date.now() - session.pausedAt;
        session.pausedAt = null;
    }

    return resumed;
}

function getVolume(guildId) {
    const session = sessions.get(guildId);
    if (session) return session.volume;

    return clampVolume(volumeDefaults.get(guildId) ?? DEFAULT_VOLUME);
}

function setVolume(guildId, value) {
    const volume = clampVolume(value);
    volumeDefaults.set(guildId, volume);

    const session = sessions.get(guildId);
    if (!session) return volume;

    session.volume = volume;

    const status = session.player.state.status;
    const active =
        status === AudioPlayerStatus.Playing ||
        status === AudioPlayerStatus.Paused ||
        status === AudioPlayerStatus.AutoPaused ||
        status === AudioPlayerStatus.Buffering;

    if (session.current && active) {
        session.reloadPending = {
            seek: getPositionSeconds(session),
            keepPaused: Boolean(session.pausedAt)
        };
        session.player.stop(true);
    }

    return volume;
}

function getSessionInfo(guildId) {
    const session = sessions.get(guildId);
    if (!session) return null;

    return {
        current: session.current,
        queue: session.queue,
        paused: session.player.state.status === AudioPlayerStatus.Paused,
        volume: session.volume,
        position: getPositionSeconds(session)
    };
}

module.exports = {
    enqueue,
    resolveTrack,
    skip,
    stop,
    pause,
    resume,
    leave,
    getVolume,
    setVolume,
    getSessionInfo,
    formatDuration,
    normalizeVolume
};
