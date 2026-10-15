const os = require('node:os');
const { version: djsVersion } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { listCommands } = require('./index');

function formatUptime(milliseconds) {
  const total = Math.floor(milliseconds / 1000);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [
    days && `${days}d`,
    hours && `${hours}h`,
    minutes && `${minutes}m`,
    `${seconds}s`,
  ].filter(Boolean).join(' ');
}

module.exports = {
  name: 'botinfo',
  aliases: ['info', 'stats', 'estadisticas'],
  description: 'Información técnica del bot.',
  usage: 'xyb botinfo',
  slash: { description: 'Información técnica del bot.' },

  async execute({ client, guild, user, reply }) {
    const memory = process.memoryUsage();
    const heap = (memory.heapUsed / 1024 / 1024).toFixed(1);
    const rss = (memory.rss / 1024 / 1024).toFixed(1);

    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setAuthor({ name: client.user.tag, iconURL: client.user.displayAvatarURL({ size: 128 }) })
      .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: '⏱️ Uptime', value: `\`${formatUptime(client.uptime ?? 0)}\``, inline: true },
        { name: '🌐 Gateway', value: `\`${Math.round(client.ws.ping ?? 0)} ms\``, inline: true },
        { name: '💾 Memoria', value: `\`${heap} MB\` (${rss} MB)`, inline: true },
        { name: '🏠 Servidores', value: `\`${client.guilds.cache.size}\``, inline: true },
        { name: '👥 Personas cacheadas', value: `\`${client.users.cache.size}\``, inline: true },
        { name: '⚙️ Comandos', value: `\`${listCommands().length}\``, inline: true },
        { name: '📚 discord.js', value: `\`v${djsVersion}\``, inline: true },
        { name: '🟢 Node', value: `\`${process.version}\``, inline: true },
        { name: '💻 Sistema', value: `\`${os.platform()} ${os.arch()}\``, inline: true },
      )
      .setFooter({ text: `Consultado por ${user.tag} · 🐰 xyb` })
      .setTimestamp();

    if (guild) embed.addFields({ name: '📍 Aquí', value: `\`${guild.name}\` · ${guild.memberCount} miembros`, inline: true });

    await reply({ embeds: [embed] });
  },
};
