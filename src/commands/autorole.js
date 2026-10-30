const { PermissionFlagsBits } = require('discord.js');
const { createStore } = require('../store');

const store = createStore('autorole');
const USAGE = 'Uso: `xyb autorole set @rol`, `xyb autorole ver` o `xyb autorole quitar`.';
const PRIVILEGED = ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'KickMembers', 'BanMembers', 'ModerateMembers', 'ManageWebhooks', 'ManageGuildExpressions', 'ManageMessages', 'MentionEveryone', 'ManageEvents', 'ManageNicknames', 'MoveMembers', 'MuteMembers', 'DeafenMembers', 'ManageThreads', 'ViewAuditLog', 'ViewGuildInsights'].map(name => PermissionFlagsBits[name]).filter(Boolean);
const hasPrivilegedPermissions = role => !role.permissions?.has || PRIVILEGED.some(permission => role.permissions.has(permission));

function validateRole(guild, member, role) {
  if (!role || role.id === guild.id || role.managed) return 'Elige un rol normal de este servidor.';
  if (hasPrivilegedPermissions(role)) return 'El autorol no puede tener permisos administrativos o de moderación.';
  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return 'El bot necesita el permiso Gestionar roles.';
  if (!role.editable || guild.members.me.roles.highest.comparePositionTo(role) <= 0) return 'El rol debe estar por debajo del rol más alto del bot.';
  if (guild.ownerId !== member.id && member.roles.highest.comparePositionTo(role) <= 0) return 'El rol debe estar por debajo de tu rol más alto.';
  return null;
}

async function handleMemberAdd(member) {
  if (member.user?.bot) return false;
  const roleId = store.get(member.guild.id);
  if (!roleId) return false;
  const role = member.guild.roles.cache.get(roleId);
  if (!role || role.managed || role.id === member.guild.id || !role.editable || hasPrivilegedPermissions(role) || !member.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return false;
  await member.roles.add(role, 'Autorol configurado en Xyb');
  return true;
}

module.exports = {
  name: 'autorole', aliases: ['autorol'], description: 'Configura un rol para nuevos miembros humanos.',
  usage: 'xyb autorole set @rol | ver | quitar', guildOnly: true,
  permissions: [PermissionFlagsBits.ManageRoles],
  slash: { description: 'Configura el rol automático al entrar.', setup(builder) {
    return builder.addStringOption(o => o.setName('accion').setDescription('Qué quieres hacer').setRequired(true).addChoices(
      { name: 'Configurar', value: 'set' }, { name: 'Ver', value: 'ver' }, { name: 'Quitar', value: 'quitar' },
    )).addRoleOption(o => o.setName('rol').setDescription('Rol para los nuevos miembros'));
  } },
  async execute({ guild, member, args = [], isSlash, interaction, reply, fail }) {
    const action = (isSlash ? interaction.options.getString('accion', true) : args[0] || 'ver').toLowerCase();
    if (action === 'ver') return reply({ content: store.get(guild.id) ? `🎭 Autorol configurado: <@&${store.get(guild.id)}>.` : '🎭 No hay autorol configurado.', allowedMentions: { parse: [] } });
    if (action === 'quitar' || action === 'off') { store.delete(guild.id); return reply('Autorol desactivado.'); }
    if (action !== 'set') return fail(USAGE);
    const id = (args[1] || '').replace(/^<@&(?=\d+>$)|>$/g, '');
    const role = isSlash ? interaction.options.getRole('rol') : guild.roles.cache.get(id);
    const error = validateRole(guild, member, role);
    if (error) return fail(error);
    store.set(guild.id, role.id);
    return reply({ content: `🎭 Autorol configurado: <@&${role.id}> para nuevos miembros humanos.`, allowedMentions: { parse: [] } });
  },
  handleMemberAdd,
  validateRole,
  hasPrivilegedPermissions,
};
