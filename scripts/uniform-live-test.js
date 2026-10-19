require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { setTimeout: sleep } = require('node:timers/promises');
const { randomInt } = require('node:crypto');
const { classify, listMembers, WARNING_GRACE } = require('../src/lib/guild-tag');
const logger = require('../src/logger');

// Single explicitly authorized test; no other member is eligible for this job.
const guildId = '1494581763899396136';
const channelId = '1494581764390391961';
const messageId = '1561233406027628575';
let userId = '1318781284989931633';
const randomMode = process.argv.includes('--random');
const requestedId = process.argv.find(arg => arg.startsWith('--user='))?.slice(7);
if (requestedId && !/^\d{17,20}$/.test(requestedId)) throw new Error('ID inválido');
if (requestedId) userId = requestedId;
const sendNew = randomMode || Boolean(requestedId);
const rest = new REST({ version: '10', timeout: 15000, retries: 0 }).setToken(process.env.DISCORD_TOKEN);

async function eligible() {
  const guild = await rest.get(Routes.guild(guildId));
  if (!guild.features?.includes('GUILD_TAGS')) throw new Error('Etiquetas no disponibles; se cancela el ban');
  const member = await rest.get(Routes.guildMember(guildId, userId));
  if (member.user.bot || guild.owner_id === userId) return false;
  const user = await rest.get(Routes.user(userId));
  return user.id === userId && !user.bot && classify(member.user, guildId) === 'missing' && classify(user, guildId) === 'missing';
}

async function run() {
  if (randomMode) {
    const guild = await rest.get(Routes.guild(guildId));
    const all = await listMembers(rest, guildId);
    const me = await rest.get(Routes.user('@me'));
    const bot = all.find(m => m.user.id === me.id);
    if (!bot) throw new Error('No se encontró al bot en el servidor');
    const roleIds = new Set([guildId, ...bot.roles]);
    const botRoles = guild.roles.filter(r => roleIds.has(r.id));
    const permissions = botRoles.reduce((p, r) => p | BigInt(r.permissions), 0n);
    if (!(permissions & 8n) && !(permissions & 4n)) throw new Error('El bot no tiene permiso para banear');
    const highest = Math.max(...botRoles.map(r => r.position));
    const candidates = all.filter(m => !m.user.bot && m.user.id !== guild.owner_id
      && m.user.id !== '1318781284989931633'
      && classify(m.user, guildId) === 'missing'
      && guild.roles.filter(r => m.roles.includes(r.id)).every(r => r.position < highest));
    let selected;
    while (candidates.length) {
      const candidate = candidates.splice(randomInt(candidates.length), 1)[0];
      userId = candidate.user.id;
      if (await eligible()) { selected = candidate; break; }
    }
    if (!selected) throw new Error('No hay candidatos elegibles para esta prueba');
    logger.info(`[uniform-live-test] Elegido al azar ${userId} (${selected.user.username}).`);
  }
  if (!await eligible()) throw new Error('El destinatario ya tiene la etiqueta, es exento o los datos no son concluyentes');
  const payload = { body: {
    content: `<@${userId}> pongase el puto uniforme o lo voy a banear mierda tienes 5, y se los va chingar esta noche kemono`,
    allowed_mentions: { parse: [], users: [userId] },
  } };
  const message = sendNew
    ? await rest.post(Routes.channelMessages(channelId), payload)
    : await rest.patch(Routes.channelMessage(channelId, messageId), payload);
  const deadline = Date.now() + WARNING_GRACE;
  const deletionTimer = setTimeout(() => {
    rest.delete(Routes.channelMessage(channelId, message.id)).catch(error => {
      if (error.code !== 10008) logger.warn(`[uniform-live-test] No pude borrar el aviso: ${error.message}`);
    });
  }, 5 * 60_000);
  deletionTimer.unref();
  logger.info(`[uniform-live-test] Aviso ${message.id} ${sendNew ? 'enviado' : 'editado'}; usuario ${userId}; vencimiento ${new Date(deadline).toISOString()}`);
  await sleep(Math.max(0, deadline - Date.now()));
  const all = await listMembers(rest, guildId);
  const witness = all.find(m => classify(m.user, guildId) === 'valid');
  if (!witness || classify(await rest.get(Routes.user(witness.user.id)), guildId) !== 'valid') {
    throw new Error('No hay etiqueta activa verificable; se cancela el ban');
  }
  // Fresh membership and profile checks immediately before the action.
  if (!await eligible()) {
    logger.info(`[uniform-live-test] Sin ban para ${userId}: etiqueta restaurada, exención o datos desconocidos.`);
    return;
  }
  await rest.put(Routes.guildBan(guildId, userId), { body: { delete_message_seconds: 0 }, reason: 'Uniforme ausente; aviso y 20 minutos completos de plazo; perfil reconfirmado' });
  logger.info(`[uniform-live-test] Baneado ${userId} tras 20 minutos; mensajes conservados.`);
}

if (require.main === module && !process.env.NODE_TEST_CONTEXT && process.argv.includes('--execute-live')) run().catch(error => {
  logger.warn(`[uniform-live-test] Cancelado: ${error.message}`);
  process.exitCode = 1;
});
