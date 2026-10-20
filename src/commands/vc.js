const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const logger = require('../logger');

const ACTIONS = { salir: 'leave', leave: 'leave', desconectar: 'leave', desconectarse: 'leave', salirvc: 'leave', status: 'status', estado: 'status' };

module.exports = {
  name: 'vc', aliases: ['voz', 'voice', '24x7'], description: 'Entra a un canal de voz y se queda hasta que tú lo saques.', usage: 'xyb vc [salir]', guildOnly: true, botPermissions: [PermissionFlagsBits.Connect],
  slash: { description: 'Entra a un canal de voz y se queda hasta que tú lo saques.', setup(builder) { return builder.addStringOption((option) => option.setName('accion').setDescription('`salir` lo desconecta.').addChoices({ name: 'Entrar', value: 'join' }, { name: 'Salir', value: 'leave' }, { name: 'Estado', value: 'status' })); } },
  async execute({ guild, member, isSlash, interaction, args, reply, fail }) {
    const word = (isSlash ? interaction.options.getString('accion') : args[0])?.toLowerCase(); const action = ACTIONS[word] ?? 'join'; const connection = getVoiceConnection(guild.id);
    if (action === 'leave') { if (!connection) return fail('No estoy en ningún canal de voz.'); connection.destroy(); return reply('👋 Salí del canal de voz.'); }
    if (action === 'status') { const channel = connection?.joinConfig?.channel; return reply(channel ? `🔊 Estoy en <#${channel}> desde hace ${connection.joinConfig.selfMute ? '(silenciado)' : ''} \`${connection.state.status}\`.` : '🔇 No estoy en ningún canal de voz. Usa `xyb vc`.'); }
    if (connection) return fail(`Ya estoy en <#${connection.joinConfig.channel}>. Usa \`xyb vc salir\` cuando quieras.`);
    const channel = member?.voice?.channel ?? guild.channels.cache.find((item) => item.type === ChannelType.GuildVoice && item.joinable !== false);
    if (!channel) return fail('No encuentro ningún canal de voz. Entra a uno y usa `xyb vc`.');
    try { joinVoiceChannel({ channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: true }); } catch (error) { logger.error('No pude entrar al canal de voz', error); return fail('No pude entrar. Revisa que el bot tenga **Conectar** y **Ver el canal de voz**.'); }
    const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🔊 Bot 24/7 en voz').setDescription(`Me conecté a **${channel}** y me quedo aquí hasta que me saques.`).addFields({ name: '👥 Conectados', value: `${channel.members?.size ?? 0}`, inline: true }, { name: '🔇 Estado', value: 'Silenciado (no molesto a nadie)', inline: true }, { name: '🚪 Sacarme', value: '`xyb vc salir`', inline: true }).setFooter({ text: '🐰 xyb' }).setTimestamp();
    return reply({ embeds: [embed] });
  },
};
