const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const members = require('../lib/members');
const uidProfiles = require('../lib/uid-profiles');
const { durationParts, formatDuration, nextMilestone, parseDate } = require('../tenure');

const NITRO_MILESTONES = [1, 3, 6, 12, 24, 36, 60, 72];
const DISCORD_EPOCH = 1420070400000n;

function timestampFromId(id) {
  try { return Number((BigInt(id) >> 22n) + DISCORD_EPOCH); } catch { return null; }
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(value);
}

function relativeDate(value) {
  return `hace ${formatDuration(durationParts(value))}`;
}

async function guildMember(guild, userId) {
  if (!guild) return null;
  try { return guild.members.cache.get(userId) ?? await guild.members.fetch(userId); } catch { return null; }
}

function nitroValue(record) {
  if (!record.nitroStartedAt) {
    return 'No registrada. Solo la persona puede guardar esta fecha; XYB no inventa antigüedad de Nitro.';
  }
  const start = new Date(record.nitroStartedAt);
  const next = nextMilestone(start, NITRO_MILESTONES);
  const current = formatDuration(durationParts(start));
  const nextText = next
    ? `\nSiguiente insignia: **${next.milestone >= 12 ? `${next.milestone / 12} año${next.milestone === 12 ? '' : 's'}` : `${next.milestone} meses`}** · ${dateLabel(next.date)} (${next.remaining})`
    : '\nInsignia máxima de antigüedad alcanzada.';
  return `Desde ${dateLabel(start)} · **${current}**${nextText}`;
}

async function panel(guild, person, ownerId = null) {
  const member = await guildMember(guild, person.id);
  const record = uidProfiles.get(person.id);
  const createdAt = timestampFromId(person.id);
  const avatar = person.displayAvatarURL?.({ size: 512 }) ?? null;
  const displayName = person.globalName ?? person.username ?? person.id;
  const embed = new EmbedBuilder()
    .setColor(0xE878FF)
    .setAuthor({ name: `UID · ${displayName} (@${person.username ?? person.id})`.slice(0, 256), iconURL: avatar ?? undefined })
    .setThumbnail(avatar)
    .addFields({
      name: '✓ Datos confirmados por Discord',
      value: createdAt ? `**Cuenta creada:** ${dateLabel(new Date(createdAt))}\n${relativeDate(new Date(createdAt))}` : 'No pude leer la fecha de creación de esta cuenta.',
    });

  if (member) {
    const joined = member.joinedAt;
    const boost = member.premiumSince;
    embed.addFields({
      name: '⌂ En este servidor',
      value: [
        joined ? `**Entró:** ${dateLabel(joined)} · ${relativeDate(joined)}` : '**Entró:** Discord no devolvió una fecha.',
        boost ? `**Mejorando este servidor:** ${dateLabel(boost)} · ${relativeDate(boost)}` : '**Mejora del servidor:** no está mejorando este servidor.',
      ].join('\n'),
    });
  } else {
    embed.addFields({ name: '⌂ En este servidor', value: 'Esta persona no está disponible como miembro de este servidor.' });
  }

  embed.addFields({ name: '◉ Nitro · fecha registrada por la persona', value: nitroValue(record) });
  embed.setFooter({ text: 'Boost: confirmado por Discord · Nitro: fecha opcional registrada por su dueño · 🐰 xyb' });

  const components = [];
  if (ownerId === person.id) {
    const row = new ActionRowBuilder();
    row.addComponents(new ButtonBuilder()
      .setCustomId(`uid:nitro:${person.id}`)
      .setLabel(record.nitroStartedAt ? 'Cambiar mi fecha de Nitro' : 'Registrar mi fecha de Nitro')
      .setStyle(ButtonStyle.Primary));
    if (record.nitroStartedAt) {
      row.addComponents(new ButtonBuilder().setCustomId(`uid:clear:${person.id}`).setLabel('Eliminar mi fecha').setStyle(ButtonStyle.Secondary));
    }
    components.push(row);
  }
  return { embeds: [embed], components, allowedMentions: { parse: [] } };
}

function dateModal(userId, current = null) {
  const input = new TextInputBuilder()
    .setCustomId('nitro-start')
    .setLabel('¿Desde qué día tienes Nitro?')
    .setPlaceholder('AAAA-MM-DD · Ejemplo: 2024-09-02')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(10);
  if (current) input.setValue(current.slice(0, 10));
  return new ModalBuilder().setCustomId(`uid:save:${userId}`).setTitle('Registrar antigüedad de Nitro')
    .addComponents(new ActionRowBuilder().addComponents(input));
}

async function handleComponent(interaction) {
  if (!interaction.customId?.startsWith('uid:')) return false;
  const [, action, userId] = interaction.customId.split(':');
  if (!interaction.guild) return false;
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: 'Solo la dueña o el dueño del perfil puede cambiar su fecha de Nitro.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (action === 'nitro' && interaction.isButton()) {
    await interaction.showModal(dateModal(userId, uidProfiles.get(userId).nitroStartedAt));
    return true;
  }
  if (action === 'clear' && interaction.isButton()) {
    uidProfiles.clearNitroStart(userId);
    await interaction.update(await panel(interaction.guild, interaction.user, interaction.user.id));
    return true;
  }
  if (action === 'save' && interaction.isModalSubmit()) {
    const value = interaction.fields.getTextInputValue('nitro-start').trim();
    const date = parseDate(value);
    if (!date) {
      await interaction.reply({ content: 'Escribe una fecha pasada válida con formato `AAAA-MM-DD`.', flags: MessageFlags.Ephemeral });
      return true;
    }
    uidProfiles.setNitroStart(userId, date);
    await interaction.update(await panel(interaction.guild, interaction.user, interaction.user.id));
    return true;
  }
  return false;
}

module.exports = {
  name: 'uid',
  description: 'Muestra datos públicos y fechas confirmadas de un perfil.',
  usage: 'xyb uid [@persona]',
  guildOnly: true,
  resolveMember: false,
  slash: { description: 'Muestra una ficha UID con datos confirmados.', setup(builder) {
    return builder.addUserOption((option) => option.setName('usuario').setDescription('Persona cuyo UID quieres ver'));
  } },
  async execute({ args = [], user, target, guild, reply, fail, isSlash, interaction, message }) {
    // Usar UID es el consentimiento para registrar el propio perfil de XYB.
    uidProfiles.register(user.id);
    let person = target ?? user;
    if (isSlash) person = interaction.options.getUser('usuario') ?? user;
    if (!isSlash && args.length && !message?.mentions?.users?.first?.()) {
      const found = await members.resolveMemberAsync(guild, args.join(' '));
      if (!found.member) return fail(members.personHelp(found.reason));
      person = found.member.user;
    }
    if (person.bot) return fail('UID es para perfiles de personas, no de bots.');
    await reply(await panel(guild, person, user.id));
  },
  handleComponent,
  panel,
  timestampFromId,
  NITRO_MILESTONES,
};
