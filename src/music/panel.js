const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const music = require('./manager');

function payload(guildId) {
  const info = music.getSessionInfo(guildId);
  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🎵 Panel de música')
    .setDescription(info?.current?.title?.slice(0, 4000) || 'Añade canciones con xyb play')
    .addFields(
      { name: 'Estado', value: info?.paused ? 'Pausado' : info?.current ? 'Reproduciendo' : 'En espera', inline: true },
      { name: 'Volumen', value: Math.round(music.getVolume(guildId) * 100) + '%', inline: true },
      { name: 'En cola', value: String(info?.queue.length || 0), inline: true },
    );
  const buttons = [
    ['previous', 'Anterior', '⏮️'], ['pause', 'Pausa / Reanudar', '⏯️'],
    ['next', 'Siguiente', '⏭️'], ['down', 'Volumen −', '🔉'], ['up', 'Volumen +', '🔊'],
  ].map(([action, label, emoji]) => new ButtonBuilder().setCustomId('music:' + action)
    .setLabel(label).setEmoji(emoji).setStyle(action === 'pause' ? ButtonStyle.Primary : ButtonStyle.Secondary));
  return { embeds: [embed], components: [
    new ActionRowBuilder().addComponents(buttons.slice(0, 3)),
    new ActionRowBuilder().addComponents(buttons.slice(3)),
  ], allowedMentions: { parse: [] } };
}

async function handleComponent(interaction) {
  if (!interaction.isButton?.() || !interaction.customId?.startsWith('music:')) return false;
  const info = music.getSessionInfo(interaction.guildId);
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  if (!info?.channelId || member?.voice?.channelId !== info.channelId) {
    await interaction.reply({ content: 'Únete al mismo canal de voz que el bot.', flags: MessageFlags.Ephemeral });
    return true;
  }
  await interaction.deferUpdate();
  const action = interaction.customId.split(':')[1];
  if (action === 'pause') info.paused ? music.resume(interaction.guildId) : music.pause(interaction.guildId);
  else if (action === 'next') music.skip(interaction.guildId);
  else if (action === 'previous') music.previous(interaction.guildId);
  else if (action === 'up' || action === 'down') music.setVolume(interaction.guildId, info.volume + (action === 'up' ? 0.1 : -0.1));
  await interaction.editReply(payload(interaction.guildId));
  return true;
}

module.exports = { payload, handleComponent };
