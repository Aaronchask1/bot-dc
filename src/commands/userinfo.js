const { EmbedBuilder } = require('discord.js');
module.exports = {
  name: 'userinfo', aliases: ['usuario'], description: 'Muestra la información pública de un usuario.', usage: 'xyb userinfo @usuario', guildOnly: false, resolveMember: true,
  slash: { description: 'Muestra la información pública de un usuario.', setup(builder) { return builder.addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar')); } },
  async execute({ user, target, guild, reply }) {
    const person = target ?? user;
    const member = guild?.members?.cache?.get(person.id);
    const fields = [{ name: 'ID', value: String(person.id), inline: true }, { name: 'Cuenta creada', value: person.createdTimestamp ? `<t:${Math.floor(person.createdTimestamp / 1000)}:D>` : 'No disponible', inline: true }];
    if (member?.joinedTimestamp) fields.push({ name: 'En este servidor desde', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true });
    const embed = new EmbedBuilder().setColor(0xA47BFA).setTitle('👤 Información de usuario').setDescription(String(person.globalName || person.username || 'Usuario').slice(0, 100)).addFields(fields);
    const avatar = person.displayAvatarURL?.({ size: 256 }); if (avatar) embed.setThumbnail(avatar);
    return reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};
