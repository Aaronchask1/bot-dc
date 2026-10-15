const { Collection, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const MAX_SCAN = 1000;
const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

/** Barre el canal hacia atrás quedándose con los mensajes que interesan. */
async function collect(channel, predicate, limit) {
  const found = [];
  const cutoff = Date.now() - TWO_WEEKS;
  let before;
  let scanned = 0;

  while (found.length < limit && scanned < MAX_SCAN) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    scanned += batch.size;
    for (const message of batch.values()) {
      if (message.createdTimestamp < cutoff) return found;
      if (predicate(message)) found.push(message);
      if (found.length >= limit) break;
    }
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return found;
}

async function deleteAll(channel, messages) {
  let deleted = 0;
  for (let index = 0; index < messages.length; index += 100) {
    const batch = new Collection(messages.slice(index, index + 100).map((message) => [message.id, message]));
    // El true es para que Discord ignore lo que ya tiene más de 14 días.
    const result = await channel.bulkDelete(batch, true);
    deleted += result.size;
  }
  return deleted;
}

function esBots(args) {
  return args[0]?.toLowerCase() === 'bots';
}

async function run({ channel, args, limit, client, fail, reply }) {
  const pedido = Number(args[1]);
  const cantidad = Number.isInteger(pedido) && pedido > 0 ? Math.min(pedido, MAX_SCAN) : limit;

  const mensajes = await collect(channel, (message) => message.author.bot, cantidad);
  if (!mensajes.length) {
    await fail('No encontré mensajes de bots en los últimos 14 días.');
    return;
  }

  const borrados = await deleteAll(channel, mensajes);
  const embed = new EmbedBuilder()
    .setColor(borrados ? 0x2ECC71 : 0xED4245)
    .setDescription(`🧹 Se borraron **${borrados}** mensajes de bots.`)
    .setFooter({ text: `Busqué hasta ${mensajes.length} en los últimos 14 días · 🐰 xyb` });
  await reply({ embeds: [embed] });
}

module.exports = {
  name: 'purge',
  aliases: ['c', 'purbots', 'pbots'],
  description: 'Borra mensajes de bots. Usa `xyb purge bots` o `xyb c bots`.',
  usage: 'xyb purge bots|c bots [1-1000]',
  permissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.ManageMessages],
  guildOnly: true,
  // Solo atiende la forma "purge bots"; los números los sigue creando
  // el comando original de index.js.
  match: esBots,

  async execute({ channel, args, isSlash, invokedName, fail, reply }) {
    // Por seguridad, sin cantidad se borran como máximo 100 mensajes.
    const limit = isSlash ? MAX_SCAN : 100;
    const argumentos = isSlash ? ['bots'] : args;
    try {
      await run({ channel, args: argumentos, limit, fail, reply });
    } catch (error) {
      await fail('No pude borrar los mensajes. Revisa que el bot tenga **Gestionar mensajes**.');
    }
  },
};

module.exports.collect = collect;
module.exports.deleteAll = deleteAll;
