const { randomInt } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { createStore } = require('../store');
const logger = require('../logger');

const store = createStore('giveaways');
const JOIN = 'xyb-giveaway:join';
const MAX_DURATION = 30 * 24 * 60 * 60 * 1000;
let timer = null, sweeping = false;
function durationMs(text) {
  const m = String(text ?? '').trim().match(/^(\d+)(m|h|d)$/i);
  if (!m) throw new Error('Usa una duración como 10m, 2h o 3d.');
  const ms = Number(m[1]) * ({ m: 60000, h: 3600000, d: 86400000 })[m[2].toLowerCase()];
  if (!Number.isSafeInteger(ms) || ms < 60000 || ms > MAX_DURATION) throw new Error('La duración debe estar entre 1 minuto y 30 días.');
  return ms;
}
function message(record, ended = false) {
  const end = Math.floor(record.ends / 1000);
  const content = ended
    ? `🎉 **Sorteo finalizado**\nPremio: ${record.prize}\n${record.winner ? `Ganador: <@${record.winner}>` : 'Nadie participó.'}`
    : `🎁 **Sorteo**\nPremio: ${record.prize}\nTermina <t:${end}:R>. Pulsa el botón para participar.`;
  return { content, allowedMentions: { parse: [] }, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(JOIN).setLabel(ended ? 'Sorteo finalizado' : 'Participar').setStyle(ButtonStyle.Primary).setDisabled(ended))] };
}
function save(guildId, config) { store.set(guildId, config); store.flush(); }
async function sweep(client, now = Date.now()) {
  if (sweeping) return;
  sweeping = true;
  try {
    for (const [guildId, config] of Object.entries(store.read())) {
      for (const record of Object.values(config || {})) {
        if (record.ends > now || record.announced) continue;
        if (!record.closed) {
          record.closed = true;
          record.winner = record.entries.length ? record.entries[randomInt(record.entries.length)] : null;
          save(guildId, config);
        }
        try {
          const channel = await client.channels.fetch(record.channelId);
          const msg = await channel.messages.fetch(record.messageId);
          await msg.edit(message(record, true));
          record.announced = true;
          save(guildId, config);
        } catch (error) { logger.warn('No pude actualizar el sorteo finalizado; se volverá a intentar.', error); }
      }
    }
  } finally { sweeping = false; }
}
function start(client) {
  if (timer) return;
  void sweep(client);
  timer = setInterval(() => { void sweep(client); }, 30000);
  timer.unref();
}
function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = {
  name: 'giveaway', aliases: ['sorteo'], description: 'Organiza un sorteo con un ganador.',
  usage: 'xyb giveaway 10m premio', guildOnly: true, permissions: [PermissionFlagsBits.ManageGuild],
  slash: { description: 'Crea un sorteo con un ganador.', setup(builder) {
    return builder.addStringOption(o => o.setName('duracion').setDescription('Ejemplo: 10m, 2h o 3d').setRequired(true)).addStringOption(o => o.setName('premio').setDescription('Premio del sorteo').setRequired(true).setMaxLength(150));
  } },
  async execute({ guild, channel, args = [], isSlash, interaction, reply, fail, defer }) {
    const duration = isSlash ? interaction.options.getString('duracion', true) : args[0];
    const prize = (isSlash ? interaction.options.getString('premio', true) : args.slice(1).join(' ')).trim();
    if (!prize || prize.length > 150 || /[\r\n]/.test(prize)) return fail('Indica un premio de hasta 150 caracteres en una sola línea.');
    let ms; try { ms = durationMs(duration); } catch (error) { return fail(error.message); }
    const config = store.get(guild.id) || {};
    if (Object.values(config).filter(g => !g.closed).length >= 15) return fail('Hay 15 sorteos activos. Espera a que termine uno antes de crear otro.');
    if (defer) await defer();
    const record = { channelId: channel.id, ends: Date.now() + ms, prize, entries: [], closed: false, announced: false, winner: null };
    const sent = await channel.send(message(record));
    record.messageId = sent.id;
    config[sent.id] = record;
    save(guild.id, config);
    return reply('🎁 Sorteo creado.');
  },
  async handleComponent(interaction) {
    if (!interaction.isButton?.() || interaction.customId !== JOIN) return false;
    const config = interaction.guildId && store.get(interaction.guildId);
    const record = config?.[interaction.message?.id];
    if (!record || record.closed || record.ends <= Date.now()) { await interaction.reply({ content: 'Este sorteo ya no acepta participaciones.', ephemeral: true }); return true; }
    if (interaction.user.bot) { await interaction.reply({ content: 'Los bots no pueden participar.', ephemeral: true }); return true; }
    if (record.entries.includes(interaction.user.id)) { await interaction.reply({ content: 'Ya estás participando.', ephemeral: true }); return true; }
    if (record.entries.length >= 10000) { await interaction.reply({ content: 'El sorteo alcanzó el máximo de participantes.', ephemeral: true }); return true; }
    record.entries.push(interaction.user.id);
    save(interaction.guildId, config);
    await interaction.reply({ content: '🎉 ¡Ya estás participando!', ephemeral: true });
    return true;
  },
  start, stop, sweep, durationMs, JOIN,
};
