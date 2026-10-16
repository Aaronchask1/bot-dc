const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economy = require('../lib/economy');
const pending = new Map();
const allowed = (item) => Object.hasOwn(economy.SHOP, item);

async function handleComponent(interaction) {
  if (!interaction.isButton?.() || !interaction.customId?.startsWith('trade:')) return false;
  const [, action, id] = interaction.customId.split(':'); const offer = pending.get(id);
  if (!offer || offer.expires < Date.now()) { pending.delete(id); await interaction.reply({ content: 'Este intercambio ya caducó.', ephemeral: true }); return true; }
  if (interaction.user.id !== offer.toId) { await interaction.reply({ content: 'Solo la persona invitada puede responder.', ephemeral: true }); return true; }
  pending.delete(id);
  if (action === 'no') { await interaction.update({ content: '❌ Intercambio rechazado.', embeds: [], components: [] }); return true; }
  const result = economy.exchange(interaction.guildId, offer.fromId, offer.toId, offer.offered, offer.wanted);
  await interaction.update(result ? { content: `✅ Intercambio hecho: <@${offer.fromId}> dio **${economy.SHOP[offer.offered].name}** por **${economy.SHOP[offer.wanted].name}** de <@${offer.toId}>.`, embeds: [], components: [] } : { content: '❌ Ya no se puede completar: alguien no tiene el objeto ofrecido.', embeds: [], components: [] });
  return true;
}
module.exports = { name: 'trade', aliases: ['intercambiar'], description: 'Propone intercambio de objetos de tienda.', usage: 'xyb trade @persona mi_item por item_deseado', guildOnly: true, resolveMember: false,
  slash: { description: 'Propone intercambio de objetos.', setup(builder) { return builder.addUserOption((option) => option.setName('usuario').setDescription('Persona').setRequired(true)).addStringOption((option) => option.setName('ofrezco').setDescription('bait, rod o insurance').setRequired(true)).addStringOption((option) => option.setName('quiero').setDescription('bait, rod o insurance').setRequired(true)); } },
  async execute({ args, message, isSlash, interaction, guild, user, reply, fail }) { const person = isSlash ? interaction.options.getUser('usuario', true) : message?.mentions?.users?.first?.(); const raw = isSlash ? [interaction.options.getString('ofrezco', true), interaction.options.getString('quiero', true)] : args.filter((arg) => allowed(arg.toLowerCase())); const [offered, wanted] = raw.map((item) => item.toLowerCase()); if (!person || person.bot || person.id === user.id || !allowed(offered) || !allowed(wanted)) return fail('Uso: `xyb trade @persona bait por insurance`. Objetos: bait, rod, insurance.'); const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`; pending.set(id, { fromId: user.id, toId: person.id, offered, wanted, expires: Date.now() + 5 * 60_000 }); const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`trade:yes:${id}`).setLabel('Aceptar').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`trade:no:${id}`).setLabel('Rechazar').setStyle(ButtonStyle.Danger)); return reply({ content: `🔁 ${person}, ${user} ofrece **${economy.SHOP[offered].name}** por tu **${economy.SHOP[wanted].name}**. Caduca en 5 min.`, components: [buttons] }); }, handleComponent,
};
