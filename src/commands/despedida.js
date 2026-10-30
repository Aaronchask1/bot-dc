const { PermissionFlagsBits, ChannelType } = require('discord.js');
const events = require('../lib/guild-events');

module.exports = {
  name:'despedida', aliases:['goodbye'], guildOnly:true,
  permissions:[PermissionFlagsBits.ManageGuild],
  description:'Configura un mensaje al salir un miembro.',
  usage:'xyb despedida set #canal mensaje | ver | quitar',
  slash:{ description:'Configura un mensaje de despedida.', setup(builder) {
    return builder.addStringOption(o=>o.setName('accion').setDescription('Qué quieres hacer').setRequired(true).addChoices({name:'Configurar',value:'set'},{name:'Ver',value:'ver'},{name:'Quitar',value:'quitar'}))
      .addChannelOption(o=>o.setName('canal').setDescription('Canal para despedidas').addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement))
      .addStringOption(o=>o.setName('mensaje').setDescription('Usa {{username}}, {{server}} y {{members}}').setMaxLength(1500));
  } },
  async execute({guild,args=[],isSlash,interaction,reply,fail}) {
    const action=(isSlash?interaction.options.getString('accion',true):args[0]||'ver').toLowerCase();
    if(action==='ver') { const c=events.get(guild.id); return reply({content:c.goodbyeChannel?`👋 Despedidas en <#${c.goodbyeChannel}>.\nMensaje: ${c.goodbyeMessage}`:'Las despedidas están desactivadas.',allowedMentions:{parse:[]}}); }
    if(action==='quitar'||action==='off') { events.set(guild.id,{goodbyeChannel:null}); return reply('Despedidas desactivadas.'); }
    if(action!=='set') return fail('Uso: `xyb despedida set #canal [mensaje] | ver | quitar`.');
    const id=(args[1]||'').replace(/^<#(\d+)>$/,'$1');
    const channel=isSlash?interaction.options.getChannel('canal'):guild.channels.cache.get(id);
    if(!channel || channel.guild?.id!==guild.id || !channel.isTextBased?.() || typeof channel.send!=='function') return fail('Elige un canal de texto de este servidor.');
    const input=isSlash?interaction.options.getString('mensaje'):args.slice(2).join(' ');
    if(input && input.length>1500) return fail('El mensaje no puede superar 1500 caracteres.');
    const patch={goodbyeChannel:channel.id}; if(input?.trim()) patch.goodbyeMessage=input.trim();
    events.set(guild.id,patch);
    return reply({content:`👋 Despedidas configuradas en <#${channel.id}>. Variables: {{username}}, {{server}}, {{members}}.`,allowedMentions:{parse:[]}});
  },
};
