const { AuditLogEvent } = require('discord.js');
const logger = require('../logger');

const byChannel = new Map();
const MAX_PER_CHANNEL = 10;
const AUDIT_WINDOW_MS = 5000;

/** Guarda un mensaje borrado para que `snipe` pueda recuperarlo. */
async function trackDeletion(message) {
  if (!message.guild || !message.author || message.author.bot) return;
  if (!message.content && message.attachments.size === 0) return;

  let deletedBy = null;
  try {
    const logs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
    const entry = logs.entries.first();
    if (entry && Date.now() - entry.createdTimestamp < AUDIT_WINDOW_MS) {
      deletedBy = entry.executor?.tag ?? null;
    }
  } catch (error) {
    logger.debug?.('Sin registro de auditoría para el borrado', error);
  }

  const record = {
    id: message.id,
    channelId: message.channel.id,
    author: message.author.tag,
    authorId: message.author.id,
    content: message.content || null,
    attachments: [...message.attachments.values()].slice(0, 3).map((attachment) => attachment.url),
    deletedBy,
    timestamp: message.createdTimestamp,
  };

  const list = byChannel.get(message.channel.id) ?? [];
  list.unshift(record);
  byChannel.set(message.channel.id, list.slice(0, MAX_PER_CHANNEL));

  // Limpieza para no crecer sin límite en servidores muy activos.
  if (byChannel.size > 500) {
    for (const [channelId, entries] of byChannel) {
      if (entries.length === 0 || Date.now() - entries[0].timestamp > 3_600_000) byChannel.delete(channelId);
    }
  }
}

function listFor(channelId) {
  return byChannel.get(channelId) ?? [];
}

module.exports = { trackDeletion, listFor, MAX_PER_CHANNEL };
