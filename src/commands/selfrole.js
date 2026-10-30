const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { createStore } = require('../store');
const { validateRole, hasPrivilegedPermissions } = require('./autorole');
const store = createStore('selfroles');
const TOGGLE = 'xyb-selfrole:toggle';
const busy = new Set();

module.exports = {
  name: 'selfrole', aliases: ['rolboton'], description: 'Publica un botón para que cada persona elija un rol seguro.',
  usage: 'xyb selfrole @rol', guildOnly: true, permissions: [PermissionFlagsBits.ManageRoles],
  slash: { description: 'Publica un botón para elegir un rol.', setup(builder) {
    return builder.addRoleOption(o => o.setName('rol').setDescription('Rol seguro que los miembros pueden elegir').setRequired(true));
  } },
  async execute({ guild, channel, member, args = [], isSlash, interaction, reply, fail, defer }) {
    const id = (args[0] || '').replace(/^<@&(?=\d+>$)|>$/g, '');
    const role = isSlash ? interaction.options.getRole('rol', true) : guild.roles.cache.get(id);
    const error = validateRole(guild, member, role);
    if (error) return fail(error);
    if (defer) await defer();
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(TOGGLE).setLabel('Añadir o quitar rol').setStyle(ButtonStyle.Primary));
    const panel = await channel.send({ content: `🎭 Pulsa el botón para añadir o quitar <@&${role.id}>.`, components: [row], allowedMentions: { parse: [] } });
    const panels = store.get(guild.id) || {};
    panels[panel.id] = role.id;
    store.set(guild.id, panels);
    store.flush();
    return reply('Panel de rol publicado.');
  },
  async handleComponent(interaction) {
    if (!interaction.isButton?.() || interaction.customId !== TOGGLE) return false;
    const guild = interaction.guild;
    const roleId = guild && store.get(guild.id)?.[interaction.message?.id];
    const role = roleId && guild.roles.cache.get(roleId);
    const me = guild?.members.me;
    if (!role || role.managed || role.id === guild.id || !role.editable || hasPrivilegedPermissions(role) || !me?.permissions?.has(PermissionFlagsBits.ManageRoles) || me.roles.highest.comparePositionTo(role) <= 0) {
      await interaction.reply({ content: 'Este rol ya no está disponible para asignación automática.', ephemeral: true });
      return true;
    }
    const member = interaction.member;
    if (!member?.roles?.cache || typeof member.roles.add !== 'function' || typeof member.roles.remove !== 'function') {
      await interaction.reply({ content: 'No pude comprobar tus roles en este servidor.', ephemeral: true });
      return true;
    }
    const key = `${guild.id}:${interaction.user.id}:${role.id}`;
    if (busy.has(key)) { await interaction.reply({ content: 'Espera a que termine tu solicitud anterior.', ephemeral: true }); return true; }
    busy.add(key);
    try {
      await interaction.deferReply({ ephemeral: true });
      if (member.roles.cache.has(role.id)) { await member.roles.remove(role, 'Rol elegido por el miembro'); await interaction.editReply('Rol retirado.'); }
      else { await member.roles.add(role, 'Rol elegido por el miembro'); await interaction.editReply('Rol añadido.'); }
    } catch {
      if (interaction.deferred || interaction.replied) await interaction.editReply('No pude cambiar el rol. Revisa los permisos del bot.').catch(() => {});
    } finally { busy.delete(key); }
    return true;
  },
  TOGGLE,
};
