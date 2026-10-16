const crypto = require('node:crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createStore } = require('../store');

const store = createStore('polls');

function create(guildId, authorId, question, options) {
  const poll = { id: crypto.randomUUID().slice(0, 8), guildId, authorId, question: String(question).trim().slice(0, 256), options, votes: {}, createdAt: Date.now(), closed: false };
  store.set(`${guildId}:${poll.id}`, poll);
  return poll;
}
function get(guildId, id) { return store.get(`${guildId}:${id}`) ?? null; }
function vote(guildId, id, userId, option) {
  const poll = get(guildId, id);
  if (!poll || poll.closed || !poll.options[option]) return null;
  poll.votes[userId] = option;
  store.set(`${guildId}:${id}`, poll);
  return poll;
}
function totals(poll) { return poll.options.map((_, index) => Object.values(poll.votes).filter((vote) => vote === index).length); }
function payload(poll) {
  const counts = totals(poll);
  const embed = new EmbedBuilder().setColor(0xFF8C69).setTitle('📊 Encuesta')
    .setDescription(`**${poll.question}**\n\n${poll.options.map((option, index) => `**${index + 1}.** ${option} — **${counts[index]}** voto${counts[index] === 1 ? '' : 's'}`).join('\n')}`)
    .setFooter({ text: `${Object.keys(poll.votes).length} voto(s) · Puedes cambiar tu voto` });
  const buttons = poll.options.map((option, index) => new ButtonBuilder().setCustomId(`poll:${poll.id}:${index}`).setLabel(`${index + 1}. ${option}`.slice(0, 80)).setStyle(ButtonStyle.Secondary));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)], allowedMentions: { parse: [] } };
}
async function handleComponent(interaction) {
  if (!interaction.isButton?.() || !interaction.customId?.startsWith('poll:')) return false;
  const [, id, rawOption] = interaction.customId.split(':');
  const poll = vote(interaction.guildId, id, interaction.user.id, Number(rawOption));
  if (!poll) { await interaction.reply({ content: 'Esta encuesta ya no está disponible.', ephemeral: true }); return true; }
  await interaction.update(payload(poll));
  return true;
}
module.exports = { create, get, vote, totals, payload, handleComponent };
