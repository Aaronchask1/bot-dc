const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const FACTS = {
  catfact: ['Los gatos duermen entre 12 y 16 horas al día.', 'El ronroneo de un gato también puede aparecer cuando se calma a sí mismo.'],
  dogfact: ['La huella de la nariz de cada perro es única.', 'Los perros usan mucho el olfato para conocer el mundo.'],
};
const LUCKY = ['Hoy una pequeña decisión te abrirá una puerta.', 'La paciencia te dará mejor resultado que la prisa.', 'Comparte algo bonito: volverá multiplicado.'];
const TRIVIA = [
  { q: 'Los padres de Coraline aman la tierra al comienzo de la película.', answer: true, image: 'https://media.tenor.com/lfzDXKjhSx4AAAAC/coraline.gif' },
  { q: 'Un pulpo tiene exactamente seis corazones.', answer: false },
  { q: 'Saturno es el único planeta con anillos.', answer: false },
  { q: 'La miel puede conservarse durante muchísimo tiempo sin estropearse.', answer: true },
  { q: 'Los pingüinos pueden volar largas distancias.', answer: false },
];
const WORDS = ['discord', 'conejo', 'aventura', 'mascota', 'galaxia'];
const active = new Map();
const triviaRounds = new Map();
const triviaPoints = new Map();
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const gameKey = (guild, user, type) => `${guild?.id ?? 'dm'}:${user.id}:${type}`;
const sponge = (text) => [...text].map((char, index) => index % 2 ? char.toLowerCase() : char.toUpperCase()).join('');
function shuffled(word) { return [...word].sort(() => Math.random() - 0.5).join(''); }
function gameAction(invokedName, args) { return invokedName === 'games' || invokedName === 'game' ? args.shift()?.toLowerCase() : invokedName; }
function triviaKey(guildId, userId) { return `${guildId ?? 'dm'}:${userId}`; }
function triviaPayload(user, guildId) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const question = pick(TRIVIA); const key = triviaKey(guildId, user.id);
  const round = { id, userId: user.id, question, expires: Date.now() + 20_000 };
  triviaRounds.set(id, round);
  const points = triviaPoints.get(key) ?? 0;
  const embed = new EmbedBuilder().setColor(0xA92FEA).setAuthor({ name: user.username, iconURL: user.displayAvatarURL?.({ size: 64 }) })
    .setTitle('🧠 Trivia XYB').setDescription(`**${question.q}**\n\nTienes **20 segundos** para elegir la respuesta correcta.`)
    .setFooter({ text: `Puntos: ${points} · Solo tú puedes responder` });
  if (question.image) embed.setImage(question.image);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`trivia:${id}:true`).setLabel('Verdadero').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`trivia:${id}:false`).setLabel('Falso').setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row] };
}

module.exports = {
  name: 'games',
  aliases: ['game', 'banana', 'catfact', 'dogfact', 'guess', 'hangman', 'kitty', 'pupper', 'lucky', 'match', 'petpet', 'reputation', 'roll', 'rps', 'say', 'spongify', 'stonks', 'tictactoe', 'traderep', 'trivia', 'tweet', 'unscramble', 'ask', 'chatbot', 'character', 'confess', 'delete', 'describe', 'dream', 'emojimixer', 'reimagine', 'upscale'],
  description: 'Minijuegos, datos, suerte y utilidades divertidas.',
  usage: 'xyb games acción [texto] · también xyb trivia, xyb rps o xyb roll', guildOnly: false,
  slash: { description: 'Minijuegos y diversión.', setup(builder) { return builder.addStringOption((o) => o.setName('accion').setDescription('trivia, rps, roll, guess, unscramble…').setRequired(true)).addStringOption((o) => o.setName('texto').setDescription('Respuesta o texto')); } },
  async execute({ invokedName, args = [], text, isSlash, interaction, guild, user, reply, fail }) {
    const action = isSlash ? interaction.options.getString('accion', true).toLowerCase() : gameAction(invokedName, args);
    const body = isSlash ? (interaction.options.getString('texto') ?? '').trim() : (invokedName === 'games' || invokedName === 'game' ? args.join(' ') : text).trim();
    if (FACTS[action]) return reply(`🐾 ${pick(FACTS[action])}`);
    if (action === 'banana') return reply(`🍌 La banana de ${user.username} mide **${1 + Math.floor(Math.random() * 30)} cm**. Ciencia totalmente seria.`);
    if (action === 'lucky') return reply(`🥠 ${pick(LUCKY)}`);
    if (action === 'roll') { const [minRaw, maxRaw] = body.split(/\s+/).map(Number); const min = Number.isFinite(minRaw) ? minRaw : 1; const max = Number.isFinite(maxRaw) ? maxRaw : 100; if (!Number.isInteger(min) || !Number.isInteger(max) || min > max || max - min > 1_000_000) return fail('Uso: `xyb roll [mínimo] [máximo]` (por ejemplo, `xyb roll 1 20`).'); return reply(`🎲 Salió **${min + Math.floor(Math.random() * (max - min + 1))}**.`); }
    if (action === 'rps') { const yours = body.toLowerCase(); if (!['piedra', 'papel', 'tijera', 'tijeras'].includes(yours)) return fail('Uso: `xyb rps piedra|papel|tijera`.'); const mine = pick(['piedra', 'papel', 'tijera']); const normalized = yours === 'tijeras' ? 'tijera' : yours; const win = normalized === mine ? 'Empate.' : (normalized === 'piedra' && mine === 'tijera') || (normalized === 'papel' && mine === 'piedra') || (normalized === 'tijera' && mine === 'papel') ? '¡Ganaste!' : 'Esta vez gano yo.'; return reply(`✊ Tú: **${normalized}** · XYB: **${mine}**\n${win}`); }
    if (action === 'spongify') return body ? reply(`🧽 ${sponge(body)}`) : fail('Uso: `xyb spongify texto`.');
    if (action === 'say') return body ? reply({ content: body.slice(0, 1800), allowedMentions: { parse: [] } }) : fail('Uso: `xyb say texto`.');
    if (action === 'stonks') return reply(`📈 ${user.username} acaba de hacer stonks. ¡A celebrar!`);
    if (action === 'petpet') return reply(`🐾 ${user.username} repartió caricias virtuales. *pat pat*`);
    if (action === 'kitty' || action === 'pupper') return reply(`🐾 Usa \`xyb img ${action === 'kitty' ? 'gato' : 'perro'}\` para recibir una imagen con fuente y licencia.`);
    if (action === 'match') return reply(`💞 El medidor de vibra de ${user.username}: **${1 + Math.floor(Math.random() * 100)}%**.`);
    if (action === 'guess') {
      const key = gameKey(guild, user, 'guess'); const current = active.get(key);
      if (!current) { active.set(key, { answer: 1 + Math.floor(Math.random() * 20), until: Date.now() + 5 * 60_000 }); return reply('🔢 Pensé un número del **1 al 20**. Adivínalo con `xyb guess número`.'); }
      const guess = Number(body); if (!Number.isInteger(guess)) return fail('Escribe un número del 1 al 20.'); if (guess === current.answer) { active.delete(key); return reply('🎉 ¡Correcto!'); } return reply(guess < current.answer ? '📈 Más alto.' : '📉 Más bajo.');
    }
    if (action === 'unscramble' || action === 'hangman') {
      const key = gameKey(guild, user, action); const current = active.get(key);
      if (!current) { const answer = pick(WORDS); active.set(key, { answer, until: Date.now() + 5 * 60_000 }); return reply(`🔤 Adivina la palabra: **${shuffled(answer)}**\nResponde con \`xyb ${action} palabra\`.`); }
      if (body.toLowerCase() === current.answer) { active.delete(key); return reply('🎉 ¡La adivinaste!'); } return reply('❌ No es esa. Inténtalo otra vez.');
    }
    if (action === 'trivia') return reply(triviaPayload(user, guild?.id));
    if (['ask', 'chatbot', 'character', 'dream', 'reimagine', 'upscale', 'describe'].includes(action)) return reply('✨ Ese comando necesita un proveedor de IA o de edición de imágenes conectado. Por ahora puedes usar `xyb img descripción` para buscar imágenes existentes.');
    if (['confess', 'tweet', 'delete', 'emojimixer', 'reputation', 'traderep', 'tictactoe'].includes(action)) return reply(`🎮 **${action}** está reservado para su versión interactiva; el resto de minijuegos ya está disponible.`);
    return fail('Prueba `xyb trivia`, `xyb rps piedra`, `xyb roll 1 20`, `xyb guess`, `xyb unscramble`, `xyb catfact` o `xyb spongify texto`.');
  },
  async handleComponent(interaction) {
    if (!interaction.isButton?.() || !interaction.customId?.startsWith('trivia:')) return false;
    const [, id, rawAnswer] = interaction.customId.split(':'); const round = triviaRounds.get(id);
    if (!round || round.expires < Date.now()) { triviaRounds.delete(id); await interaction.reply({ content: 'Esta trivia ya caducó. Inicia otra con `xyb trivia`.', ephemeral: true }); return true; }
    if (round.userId !== interaction.user.id) { await interaction.reply({ content: 'Solo quien inició esta trivia puede responder.', ephemeral: true }); return true; }
    triviaRounds.delete(id);
    const correct = String(round.question.answer) === rawAnswer; const key = triviaKey(interaction.guildId, interaction.user.id);
    const points = (triviaPoints.get(key) ?? 0) + (correct ? 1 : 0); triviaPoints.set(key, points);
    const embed = new EmbedBuilder().setColor(correct ? 0x57F287 : 0xED4245).setTitle(correct ? '✅ ¡Correcto!' : '❌ Incorrecto')
      .setDescription(`**${round.question.q}**\n\nLa respuesta era **${round.question.answer ? 'Verdadero' : 'Falso'}**.`)
      .setFooter({ text: `Puntos: ${points}` });
    if (round.question.image) embed.setImage(round.question.image);
    await interaction.update({ embeds: [embed], components: [] }); return true;
  },
};
