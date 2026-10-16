const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, escapeMarkdown } = require('discord.js');
const profiles = require('../lib/profiles');
const kisses = require('../lib/kisses');
const marriage = require('../lib/marriage');
const members = require('../lib/members');

function panel(guild, person, view = 'main') {
  const record = profiles.get(guild.id, person.id);
  const xp = profiles.progress(record.xp);
  const rank = profiles.rank(guild.id, person.id);
  const stats = kisses.stats(guild.id, person.id);
  const partner = marriage.getPartner(guild.id, person.id);
  const avatar = person.displayAvatarURL?.({ size: 256 }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png';
  const embed = new EmbedBuilder().setColor(0xE69A80)
    .setAuthor({ name: `${person.globalName ?? person.username ?? person.id} (@${person.username ?? person.id})`.slice(0, 256) })
    .setThumbnail(avatar)
    .setDescription(`⭐ **Nivel:** ${xp.level} (${xp.current}/${xp.needed} XP)\n👑 **Rank del servidor:** ${rank.position}/${rank.total}\n💻 **Profesión:** ${escapeMarkdown(record.profession || 'Sin elegir')}`)
    .addFields({ name: 'Frase', value: record.phrase ? `*${escapeMarkdown(record.phrase)}*` : '*Sin frase todavía.*' });
  if (view === 'main') {
    embed.addFields(
      { name: 'Stats', value: `💞 Besos compartidos: **${stats.total}**\n💌 Personas: **${stats.partners}**`, inline: true },
      { name: 'Actividad', value: `✨ XP total: **${record.xp}**\n📍 Progreso en este servidor`, inline: true },
    );
  } else {
    embed.addFields({ name: 'Progreso', value: 'Ganas 15 XP por participar, como máximo una vez por minuto. Los niveles y el ranking cuentan desde que XYB empezó a registrar actividad en este servidor.' });
  }
  embed.addFields({ name: 'Matrimonio', value: partner ? `💕 <@${partner.id}>\nDesde <t:${Math.floor(partner.since / 1000)}:D> · ${kisses.get(guild.id, person.id, partner.id)} besos compartidos` : '🤍 Sin pareja registrada.' });
  embed.setFooter({ text: `Registrado en XYB el ${new Date(record.registeredAt).toLocaleDateString('es-ES', { timeZone: 'UTC' })} · 🐰 xyb` });
  const select = new StringSelectMenuBuilder().setCustomId(`profile:${person.id}`)
    .setPlaceholder('🐱 Perfil principal').addOptions(
      { label: 'Perfil principal', value: 'main', emoji: '🐱', default: view === 'main' },
      { label: 'Actividad y nivel', value: 'activity', emoji: '⭐', default: view === 'activity' },
      { label: 'Editar mi frase y profesión', value: 'edit', emoji: '✏️' },
    );
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)], allowedMentions: { parse: [] } };
}

async function handleComponent(interaction) {
  if (!interaction.customId?.startsWith('profile:')) return false;
  const [, userId, action] = interaction.customId.split(':');
  if (!interaction.guild) return false;
  const isEdit = action === 'save' || interaction.values?.[0] === 'edit';
  if (isEdit && interaction.user.id !== userId) {
    await interaction.reply({ content: 'Solo puedes editar tu propio perfil.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (action === 'save' && interaction.isModalSubmit?.()) {
    profiles.update(interaction.guild.id, userId, {
      phrase: interaction.fields.getTextInputValue('phrase'), profession: interaction.fields.getTextInputValue('profession'),
    });
    await interaction.update(panel(interaction.guild, interaction.user));
    return true;
  }
  if (!interaction.isStringSelectMenu?.()) return false;
  const choice = interaction.values[0];
  if (choice === 'edit') {
    const record = profiles.get(interaction.guild.id, userId);
    const field = (id, label, value, max) => {
      const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(max);
      if (value) input.setValue(value);
      return new ActionRowBuilder().addComponents(input);
    };
    await interaction.showModal(new ModalBuilder().setCustomId(`profile:${userId}:save`).setTitle('Editar mi perfil')
      .addComponents(field('phrase', 'Frase', record.phrase, 160), field('profession', 'Profesión (texto personal)', record.profession, 40)));
    return true;
  }
  if (!['main', 'activity'].includes(choice)) return false;
  await interaction.deferUpdate();
  const person = interaction.client.users.cache.get(userId) ?? await interaction.client.users.fetch(userId);
  await interaction.editReply(panel(interaction.guild, person, choice));
  return true;
}

module.exports = {
  name: 'profile', aliases: ['perfil'], description: 'Tu perfil social, nivel, frase y matrimonio.',
  usage: 'xyb profile [@persona] | xyb perfil', guildOnly: true, resolveMember: false,
  slash: { description: 'Muestra un perfil social de XYB.', setup(builder) {
    return builder.addUserOption((option) => option.setName('usuario').setDescription('Persona cuyo perfil quieres ver'));
  } },
  async execute({ args = [], user, target, guild, reply, fail, isSlash, interaction, message }) {
    let person = target ?? user;
    if (!isSlash && args.length && !message?.mentions?.users?.first?.()) {
      const found = await members.resolveMemberAsync(guild, args.join(' '));
      if (!found.member) return fail(members.personHelp(found.reason));
      person = found.member.user;
    }
    if (isSlash) person = interaction.options.getUser('usuario') ?? user;
    if (person.bot) return fail('El perfil social es para personas, no para bots.');
    await reply(panel(guild, person));
  },
  handleComponent, panel,
};
