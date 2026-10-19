const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const pets = require('../lib/pets');

function bar(value) { const filled = Math.round(value / 10); return `${'🟩'.repeat(filled)}${'⬛'.repeat(10 - filled)} ${value}%`; }
function panel(guildId, userId) {
  const record = pets.get(guildId, userId); const stored = pets.active(record);
  if (!stored) return { embeds: [new EmbedBuilder().setColor(0xF2A7C1).setTitle('🐾 Mascota XYB').setDescription('No tienes una mascota activa. Compra un **🥚 Huevo misterioso** en `xyb shop buy egg` y usa `xyb pet hatch [nombre]`.')] };
  const pet = pets.careState(stored); const need = pets.levelNeed(pet.level);
  const embed = new EmbedBuilder().setColor(0xF2A7C1).setTitle(`${pet.emoji} ${pet.name}`)
    .setDescription(`**${pet.species}** · Nivel **${pet.level}/${pets.MAX_LEVEL}**\n✨ XP: **${pet.xp}/${need}**`)
    .addFields({ name: '🍽️ Hambre', value: bar(pet.hunger), inline: false }, { name: '🧼 Higiene', value: bar(pet.hygiene), inline: false }, { name: '💗 Cariño', value: bar(pet.affection), inline: false })
    .setFooter({ text: 'Aliméntala con frutas o pastel de la tienda. Jugar y limpiar dan XP cada 10 min.' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pet:${userId}:feed:apple`).setLabel('Manzana').setEmoji('🍎').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`pet:${userId}:feed:cake`).setLabel('Pastel').setEmoji('🍰').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pet:${userId}:play`).setLabel('Jugar').setEmoji('🎾').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pet:${userId}:clean`).setLabel('Limpiar').setEmoji('🧼').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}
function resultText(result) {
  if (result.ok) return `${result.food ? `🍽️ Alimentaste a ${result.pet.name} con ${result.food}.` : result.action === 'play' ? `🎾 Jugaste con ${result.pet.name}.` : `🧼 Dejaste impecable a ${result.pet.name}.`} +**${result.xp} XP**${result.levels ? ` · ¡subió ${result.levels} nivel${result.levels === 1 ? '' : 'es'}!` : ''}`;
  if (result.reason === 'pet') return 'Aún no tienes una mascota activa. Compra un huevo en la tienda y usa `xyb pet hatch`.';
  if (result.reason === 'egg') return 'Necesitas un 🥚 Huevo misterioso. Cómpralo con `xyb shop buy egg`.';
  if (result.reason === 'missing-food') return `No tienes ese alimento. Cómpralo en la tienda con \`xyb shop buy ${result.food}\`.`;
  if (result.reason === 'wait') return `Tu mascota necesita un descanso. Podrás cuidarla de nuevo <t:${Math.ceil((Date.now() + result.wait) / 1000)}:R>.`;
  return 'Usa `apple`, `banana`, `strawberry` o `cake` para alimentarla.';
}
module.exports = {
  name: 'pet', aliases: ['mascota'], description: 'Cuida, alimenta y sube de nivel a tu mascota.', usage: 'xyb pet | hatch [nombre] | feed fruta | play | clean', guildOnly: true,
  slash: { description: 'Cuida a tu mascota de XYB.', setup(builder) { return builder.addStringOption((o) => o.setName('accion').setDescription('view, hatch, feed, play o clean')).addStringOption((o) => o.setName('item').setDescription('Nombre para hatch o comida para feed')); } },
  async execute({ args, isSlash, interaction, guild, user, reply }) {
    const action = (isSlash ? interaction.options.getString('accion') : args[0])?.toLowerCase();
    const item = isSlash ? interaction.options.getString('item') : args.slice(1).join(' ');
    if (!action || ['view', 'ver', 'info'].includes(action)) return reply(panel(guild.id, user.id));
    if (['hatch', 'incubar'].includes(action)) { const result = pets.hatch(guild.id, user.id, item); return reply(result.ok ? { content: `🎉 ¡Nació **${result.pet.name}** (${result.pet.emoji} ${result.pet.species})! Ya es tu mascota activa.`, ...panel(guild.id, user.id) } : resultText(result)); }
    const normalized = action === 'alimentar' ? 'feed' : action === 'jugar' ? 'play' : action === 'limpiar' ? 'clean' : action;
    const result = pets.care(guild.id, user.id, normalized, String(item).toLowerCase());
    return reply({ content: resultText(result), ...panel(guild.id, user.id) });
  },
  async handleComponent(interaction) {
    if (!interaction.customId?.startsWith('pet:')) return false;
    const [, ownerId, action, food] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId) { await interaction.reply({ content: 'Esta mascota pertenece a otra persona.', ephemeral: true }); return true; }
    const result = pets.care(interaction.guildId, ownerId, action, food);
    await interaction.update({ content: resultText(result), ...panel(interaction.guildId, ownerId) }); return true;
  },
  panel,
};
