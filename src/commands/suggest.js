const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { createStore } = require('../store');
const store = createStore('suggestions');

module.exports = {
  name: 'suggest', aliases: ['sugerencia', 'sugerir'], description: 'Envía una sugerencia al canal configurado.', usage: 'xyb suggest texto | xyb suggest channel #canal', guildOnly: true, resolveMember: false,
  slash: { description: 'Envía una sugerencia al servidor.', setup(builder) { return builder.addStringOption((option) => option.setName('texto').setDescription('Tu sugerencia').setRequired(true)); } },
  async execute({ args, text, guild, channel, user, member, message, interaction, isSlash, reply, fail }) {
    if (!isSlash && ['channel', 'canal'].includes(args[0]?.toLowerCase())) {
      if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) return fail('Necesitas **Gestionar servidor** para configurar sugerencias.');
      const selected = message?.mentions?.channels?.first?.();
      if (!selected?.isTextBased?.()) return fail('Menciona un canal: `xyb suggest channel #sugerencias`.');
      store.set(guild.id, { channelId: selected.id });
      return reply(`✅ Las sugerencias se enviarán a ${selected}.`);
    }
    const body = (isSlash ? interaction.options.getString('texto', true) : text).trim();
    if (!body) return fail('Escribe tu sugerencia después del comando.');
    const config = store.get(guild.id);
    const destination = config?.channelId ? guild.channels.cache.get(config.channelId) : null;
    if (!destination?.isTextBased?.()) return fail('Aún no hay canal de sugerencias. Un admin debe usar `xyb suggest channel #canal`.');
    const embed = new EmbedBuilder().setColor(0xFF8C69).setTitle('💡 Nueva sugerencia').setDescription(body.slice(0, 4000)).setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() }).setFooter({ text: `ID: ${user.id}` }).setTimestamp();
    const sent = await destination.send({ embeds: [embed] });
    await sent.react('⬆️').catch(() => {}); await sent.react('⬇️').catch(() => {});
    await reply(`💡 Sugerencia enviada a ${destination}.`);
  },
};
