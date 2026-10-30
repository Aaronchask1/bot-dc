const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { createStore } = require('../store');

const store = createStore('tickets');
const locks = new Set();
const OPEN = 'xyb-ticket:open';
const CLOSE = 'xyb-ticket:close';
const row = (id, label, style) => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style));
const save = (id, value) => { store.set(id, value); store.flush(); };

module.exports = {
  name: 'tickets', aliases: ['ticket'], description: 'Publica un panel para abrir tickets privados.',
  usage: 'xyb tickets [@rol de soporte]', guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],
  slash: { description: 'Publica un panel de tickets en este canal.', setup(builder) {
    return builder.addRoleOption(o => o.setName('soporte').setDescription('Rol que podrá ver y atender los tickets'));
  } },
  async execute({ guild, args = [], isSlash, interaction, reply, fail }) {
    const id = (args[0] || '').replace(/^<@&(?=\d+>$)|>$/g, '');
    const role = isSlash ? interaction.options.getRole('soporte') : (id ? guild.roles.cache.get(id) : null);
    if ((id || (isSlash && role)) && (!role || role.id === guild.id || role.managed)) return fail('Elige un rol de soporte válido y distinto de @everyone.');
    const current = store.get(guild.id) || {};
    save(guild.id, { ...current, supportRole: role?.id || null, tickets: current.tickets || {} });
    return reply({ content: '🎫 **Soporte**\nPulsa el botón para abrir un canal privado. Solo tú, el equipo de soporte configurado y el bot tendrán acceso.', components: [row(OPEN, 'Abrir ticket', ButtonStyle.Primary)], allowedMentions: { parse: [] } });
  },
  async handleComponent(interaction) {
    if (!interaction.isButton?.() || ![OPEN, CLOSE].includes(interaction.customId)) return false;
    const guild = interaction.guild;
    if (!guild || !interaction.guildId) { await interaction.reply({ content: 'Este botón solo funciona en un servidor.', ephemeral: true }); return true; }
    const key = `${guild.id}:${interaction.user.id}`;
    if (locks.has(key)) { await interaction.reply({ content: 'Espera a que termine tu solicitud anterior.', ephemeral: true }); return true; }
    locks.add(key);
    try {
      await interaction.deferReply({ ephemeral: true });
      const config = store.get(guild.id) || { supportRole: null, tickets: {} };
      const records = config.tickets || {};
      if (interaction.customId === OPEN) {
        const existing = Object.entries(records).find(([channelId, ticket]) => ticket.owner === interaction.user.id && ticket.open && guild.channels.cache.has(channelId));
        if (existing) { await interaction.editReply({ content: `Ya tienes un ticket abierto: <#${existing[0]}>.`, allowedMentions: { parse: [] } }); return true; }
        if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) { await interaction.editReply('Necesito el permiso Gestionar canales para abrir tickets.'); return true; }
        const overwrites = [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
        ];
        const supportRole = config.supportRole && guild.roles.cache.get(config.supportRole);
        if (config.supportRole && (!supportRole || supportRole.managed || supportRole.id === guild.id)) { await interaction.editReply('El rol de soporte ya no existe o no es válido. Un administrador debe configurar el panel de nuevo.'); return true; }
        if (supportRole) overwrites.push({ id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
        const channel = await guild.channels.create({ name: `ticket-${interaction.user.id.slice(-6)}`, type: ChannelType.GuildText, permissionOverwrites: overwrites, reason: 'Ticket solicitado por un miembro' });
        records[channel.id] = { owner: interaction.user.id, open: true };
        save(guild.id, { ...config, tickets: records });
        try {
          await channel.send({ content: `🎫 Ticket de <@${interaction.user.id}>. Explica aquí en qué podemos ayudarte.`, allowedMentions: { parse: [], users: [interaction.user.id] }, components: [row(CLOSE, 'Cerrar ticket', ButtonStyle.Danger)] });
          await interaction.editReply({ content: `Tu ticket está listo: <#${channel.id}>.`, allowedMentions: { parse: [] } });
        } catch {
          await interaction.editReply({ content: `Se creó <#${channel.id}>, pero no pude enviar el botón de cierre. Pide ayuda a un administrador.`, allowedMentions: { parse: [] } });
        }
      } else {
        const ticket = records[interaction.channelId];
        if (!ticket?.open) { await interaction.editReply('Este ticket no está abierto o no pertenece a este panel.'); return true; }
        const staff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || (config.supportRole && interaction.member?.roles?.cache?.has(config.supportRole));
        if (ticket.owner !== interaction.user.id && !staff) { await interaction.editReply('Solo el creador o el equipo de soporte puede cerrar este ticket.'); return true; }
        await interaction.channel.permissionOverwrites.edit(ticket.owner, { ViewChannel: false, SendMessages: false }, { reason: 'Ticket cerrado' });
        records[interaction.channelId] = { ...ticket, open: false };
        save(guild.id, { ...config, tickets: records });
        await interaction.channel.send({ content: '🔒 Ticket cerrado. El canal se conserva para el equipo de soporte.', allowedMentions: { parse: [] } });
        await interaction.editReply('Ticket cerrado.');
      }
    } catch {
      if (interaction.deferred || interaction.replied) await interaction.editReply('No pude completar el ticket. Revisa los permisos del bot.').catch(() => {});
      else await interaction.reply({ content: 'No pude completar el ticket.', ephemeral: true }).catch(() => {});
    } finally { locks.delete(key); }
    return true;
  },
  OPEN, CLOSE,
};
