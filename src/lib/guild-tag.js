const { Routes } = require('discord.js');
const logger = require('../logger');

const REVIEW_INTERVAL = 60 * 60 * 1000;
// Kept as the public name used by the test suite and live-test helpers.
const HOUR = REVIEW_INTERVAL;
const WARNING_GRACE = 20 * 60 * 1000;

function isServerBooster(member) {
  // Discord's Guild Member payload exposes the boost start as premium_since.
  // discord.js objects may expose equivalent premiumSince fields.
  return Boolean(member?.premium_since || member?.premiumSince || member?.premiumSinceTimestamp);
}

// Use raw REST responses: a missing field must not become a cached/null value.
function classify(user, guildId) {
  if (!user || !Object.hasOwn(user, 'primary_guild')) return 'unknown';
  const primary = user.primary_guild;
  if (primary === null) return 'missing';
  if (!primary || typeof primary !== 'object') return 'unknown';
  // null can mean Discord cleared the identity because tags became unavailable.
  if (primary.identity_enabled === false) return 'missing';
  if (primary.identity_enabled !== true || !/^\d{17,20}$/.test(primary.identity_guild_id ?? '')) return 'unknown';
  return primary.identity_guild_id === guildId ? 'valid' : 'missing';
}

async function listMembers(rest, guildId) {
  const members = [];
  let after = '0';
  for (;;) {
    const page = await rest.get(Routes.guildMembers(guildId), {
      query: new URLSearchParams({ limit: '1000', after }),
    });
    members.push(...page);
    if (page.length < 1000) return members;
    const next = page.at(-1).user.id;
    if (BigInt(next) <= BigInt(after)) throw new Error('Paginación de miembros inválida');
    after = next;
  }
}

function createMonitor(client, { guildId, warningChannelId, log = logger, now = Date.now } = {}) {
  let pending = new Map();
  let running = false;

  async function scan({ auditOnly = false, dueOnly = false, testUserId = null } = {}) {
    if (running) return { skipped: 'scan-running' };
    running = true;
    const report = { valid: 0, missing: 0, unknown: 0, exempt: 0, banned: 0, waiting: 0, warned: 0 };
    try {
      if (!/^\d{17,20}$/.test(guildId ?? '')) throw new Error('TAG_GUILD_ID inválido');
      const rawGuild = await client.rest.get(Routes.guild(guildId));
      if (!rawGuild.features?.includes('GUILD_TAGS')) throw new Error('El servidor no tiene etiquetas disponibles');
      const all = await listMembers(client.rest, guildId);
      // Complete all reads before taking any action. HTTP failures abort this cycle.
      const observations = [];
      for (const member of all) {
        if (member.user.bot || member.user.id === rawGuild.owner_id || isServerBooster(member)) { report.exempt++; continue; }
        const user = await client.rest.get(Routes.user(member.user.id));
        if (user.id !== member.user.id) throw new Error('Respuesta de usuario inconsistente');
        // Any positive observation protects the member even if another endpoint
        // briefly returns stale/empty data after a profile change.
        const state = classify(member.user, guildId) === 'valid' ? 'valid' : classify(user, guildId);
        observations.push({ id: user.id, state });
        report[state]++;
      }
      // A server-wide tag loss must not become a server-wide ban.
      const witness = all.find(m => classify(m.user, guildId) === 'valid');
      if (!witness || classify(await client.rest.get(Routes.user(witness.user.id)), guildId) !== 'valid') {
        throw new Error('No se pudo confirmar una etiqueta activa del servidor; ciclo cancelado');
      }
      const nextPending = new Map();
      for (const { id, state } of observations) {
        if (state !== 'missing') continue;
        const evidence = pending.get(id) ?? { since: now() };
        nextPending.set(id, evidence);
        const manualTest = testUserId === id;
        if (auditOnly || (testUserId && !manualTest)
          || (!manualTest && evidence.warnedAt === undefined && now() - evidence.since < HOUR)
          || (dueOnly && evidence.warnedAt === undefined)
          || (evidence.warnedAt !== undefined && now() - evidence.warnedAt < WARNING_GRACE)) {
          report.waiting++; continue;
        }
        const guild = await client.guilds.fetch(guildId);
        await guild.roles.fetch();
        await guild.members.fetchMe({ force: true });
        const member = await guild.members.fetch({ user: id, force: true });
        if (member.user.bot || id === guild.ownerId || isServerBooster(member) || !member.bannable) { report.exempt++; continue; }
        const currentGuild = await client.rest.get(Routes.guild(guildId));
        if (!currentGuild.features?.includes('GUILD_TAGS')) throw new Error('Etiquetas desactivadas durante el ciclo');
        const current = await client.rest.get(Routes.user(id));
        const rawMember = await client.rest.get(Routes.guildMember(guildId, id));
        if (current.id !== id || current.bot || rawMember.user?.bot || isServerBooster(rawMember)
          || classify(rawMember.user, guildId) !== 'missing' || classify(current, guildId) !== 'missing') {
          nextPending.delete(id);
          continue;
        }
        if (evidence.warnedAt === undefined) {
          if (!/^\d{17,20}$/.test(warningChannelId ?? '')) throw new Error('Falta TAG_WARNING_CHANNEL_ID; no se banea sin aviso');
          const channel = await client.channels.fetch(warningChannelId);
          if (channel?.guildId !== guildId || !channel.isTextBased() || typeof channel.send !== 'function') {
            throw new Error('Canal de avisos inválido o de otro servidor');
          }
          await channel.send({
            content: `<@${id}> pongase el puto uniforme o lo voy a banear mierda tienes 5, y se los va chingar esta noche kemono`,
            allowedMentions: { parse: [], users: [id] },
          });
          // Start grace only after Discord confirms that the warning was sent.
          nextPending.set(id, { ...evidence, warnedAt: now() });
          report.warned++;
          log.info(`[guild-tag] Aviso enviado a ${id} en ${warningChannelId}; plazo mínimo de 20 minutos.`);
          continue;
        }
        await member.ban({ deleteMessageSeconds: 0, reason: `Etiqueta de ${guildId} ausente; aviso enviado hace al menos 20 minutos y ausencia reconfirmada antes del ban` });
        report.banned++;
        nextPending.delete(id);
        log.info(`[guild-tag] Baneado ${id} en ${guildId}; mensajes conservados.`);
      }
      pending = nextPending;
      log.info(`[guild-tag] ${guildId} ${JSON.stringify(report)}`);
      return report;
    } catch (error) {
      pending.clear();
      log.warn(`[guild-tag] Ciclo cancelado; no se realizarán más baneos. ${error.message}`);
      return { ...report, error: error.message };
    } finally {
      running = false;
    }
  }
  function checkDue() {
    if (![...pending.values()].some(entry => entry.warnedAt !== undefined && now() - entry.warnedAt >= WARNING_GRACE)) return;
    return scan({ dueOnly: true });
  }
  return { scan, checkDue };
}

function start(client, env = process.env) {
  if (env.TAG_ENFORCEMENT_ENABLED !== 'true') return null;
  const guildId = env.TAG_GUILD_ID;
  if (!/^\d{17,20}$/.test(guildId ?? '')) {
    logger.warn('[guild-tag] No se inicia: falta TAG_GUILD_ID válido.');
    return null;
  }
  const monitor = createMonitor(client, { guildId, warningChannelId: env.TAG_WARNING_CHANNEL_ID });
  // Startup only gathers evidence. Restarting never triggers an immediate ban.
  void monitor.scan({ auditOnly: true }).then(async () => {
    // Explicit one-person live test, recorded in the persistent volume so a
    // container restart never sends the same test warning again.
    if (!/^\d{17,20}$/.test(env.TAG_TEST_USER_ID ?? '') || !env.TAG_TEST_RUN_ID) return;
    const { createStore } = require('../store');
    const tests = createStore('guild-tag-tests');
    const key = `${guildId}:${env.TAG_TEST_RUN_ID}`;
    if (tests.get(key)) return;
    tests.set(key, { userId: env.TAG_TEST_USER_ID, startedAt: Date.now() });
    tests.flush();
    const report = await monitor.scan({ testUserId: env.TAG_TEST_USER_ID });
    tests.set(key, { userId: env.TAG_TEST_USER_ID, finishedAt: Date.now(), report });
    tests.flush();
    logger.info(`[guild-tag] Prueba individual ${env.TAG_TEST_RUN_ID}: ${JSON.stringify(report)}`);
  });
  const timer = setInterval(() => void monitor.scan(), REVIEW_INTERVAL);
  timer.unref?.();
  // Only perform network reads when a successfully delivered warning is due.
  const deadlines = setInterval(() => void monitor.checkDue(), 1000);
  deadlines.unref?.();
  logger.info(`[guild-tag] Revisión cada 1 hora activada para ${guildId}; etiqueta o mejora mantienen a la persona; primera revisión sin baneos.`);
  return { stop: () => { clearInterval(timer); clearInterval(deadlines); }, ...monitor };
}

module.exports = { classify, isServerBooster, listMembers, createMonitor, start, HOUR, WARNING_GRACE };
