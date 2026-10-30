const { PermissionFlagsBits, ChannelType } = require('discord.js');
const events = require('../lib/guild-events');

module.exports = {
  name: 'memberlogs', aliases: ['logsmiembros'], guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],
  description: 'Configura el registro de entradas y salidas.',
  usage: 'xyb memberlogs set #canal | ver | quitar',
  slash: { description: 'Configura el registro de entradas y salidas.', setup(builder) {
    return builder.addStringOption(o => o.setName('accion').setDescription('Qué quieres hacer').setRequired(true).addChoices({name:'Configurar',value:'set'},{name:'Ver',value:'ver'},{name:'Quitar',value:'quitar'}))
      .addChannelOption(o => o.setName('canal').setDescription('Canal de registros').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement));
  } },
  async execute({guild,args=[],isSlash,interaction,reply,fail}) {
    const action=(isSlash?interaction.options.getString('accion',true):args[0]||'ver').toLowerCase();
    if(action==='ver') { const channel=events.get(guild.id).logsChannel; return reply({content:channel?`📋 Registro de miembros: <#${channel}>.`:'No hay registro de miembros configurado.',allowedMentions:{parse:[]}}); }
    if(action==='quitar'||action==='off') { events.set(guild.id,{logsChannel:null}); return reply('Registro de miembros desactivado.'); }
    if(action!=='set') return fail('Uso: `xyb memberlogs set #canal | ver | quitar`.');
    const id=(args[1]||'').replace(/^<#(\d+)>$/,'$1');
    const channel=isSlash?interaction.options.getChannel('canal'):guild.channels.cache.get(id);
    if(!channel || channel.guild?.id!==guild.id || !channel.isTextBased?.() || typeof channel.send!=='function') return fail('Elige un canal de texto de este servidor.');
    events.set(guild.id,{logsChannel:channel.id});
    return reply({content:`📋 Registro de entradas y salidas configurado en <#${channel.id}>.`,allowedMentions:{parse:[]}});
  },
};
