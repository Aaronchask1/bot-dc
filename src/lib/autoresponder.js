const { createStore } = require('../store');

// Ya no hay respuestas automáticas por defecto: cada regla debe añadirse con
// `xyb add autoresponder ...` (o con `/autoresponder agregar`).
const KEYWORD_REPLIES = [];
const LEGACY_DEFAULT_REPLIES = new Map([
  ['kemono', 'puto cerdo'],
  ['marrano', 'la puti cerda'],
]);

const store = createStore('autoresponders');
const MAX_TRIGGER_LENGTH = 40;
const MAX_REPLY_LENGTH = 200;

function cleanTrigger(value) {
  const trigger = String(value ?? '').trim().toLocaleLowerCase().replace(/^@+/, '');
  return trigger.length <= MAX_TRIGGER_LENGTH && trigger.length > 0 && !/[\r\n]/.test(trigger)
    ? trigger : null;
}

function cleanReply(value) {
  const reply = String(value ?? '').trim();
  return reply.length <= MAX_REPLY_LENGTH && reply.length > 0 && !/[\r\n]/.test(reply)
    ? reply : null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rulePattern(trigger) {
  const words = trigger.split(/\s+/).map(escapeRegex).join('\\s+');
  // Also accepts a literal @ before a name, while not matching inside a larger word.
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])@?${words}(?=$|[^\\p{L}\\p{N}_])`, 'iu');
}

function matchesTrigger(trigger, content) {
  return rulePattern(trigger).test(String(content ?? ''));
}

function defaultRules() {
  return [];
}

function normalizeConfig(raw) {
  const rules = Array.isArray(raw?.rules) ? raw.rules
    .map((item) => ({
      trigger: cleanTrigger(item?.trigger),
      replies: (Array.isArray(item?.replies) ? item.replies : [item?.reply])
        .map(cleanReply).filter(Boolean).filter((reply, index, list) => list.indexOf(reply) === index),
    }))
    .filter((item) => item.trigger && item.replies.length)
    // Remove old built-in rules; only explicitly added rules may remain active.
    .filter((item) => !(item.replies.length === 1 && LEGACY_DEFAULT_REPLIES.get(item.trigger) === item.replies[0])) : defaultRules();
  return { enabled: raw?.enabled !== false, rules, aliases: {} };
}

function getConfig(guildId) {
  return normalizeConfig(store.get(guildId));
}

function saveConfig(guildId, config) {
  return store.set(guildId, normalizeConfig(config));
}

function setEnabled(guildId, enabled) {
  const config = getConfig(guildId);
  config.enabled = Boolean(enabled);
  return saveConfig(guildId, config);
}

function setRule(guildId, trigger, reply) {
  const cleanName = cleanTrigger(trigger);
  const cleanText = cleanReply(reply);
  if (!cleanName || !cleanText) return { ok: false, reason: `La palabra debe tener 1-${MAX_TRIGGER_LENGTH} caracteres y la respuesta 1-${MAX_REPLY_LENGTH}.` };
  const config = getConfig(guildId);
  const existing = config.rules.find((rule) => rule.trigger === cleanName);
  if (existing) existing.replies = [cleanText];
  else config.rules.push({ trigger: cleanName, replies: [cleanText] });
  config.enabled = true;
  saveConfig(guildId, config);
  return { ok: true, config };
}

function addRule(guildId, trigger, replies) {
  const cleanName = cleanTrigger(trigger);
  const values = (Array.isArray(replies) ? replies : String(replies ?? '').split(/\s*\|\s*/))
    .map(cleanReply).filter(Boolean).filter((reply, index, list) => list.indexOf(reply) === index);
  if (!cleanName || !values.length) return { ok: false, reason: `La palabra debe tener 1-${MAX_TRIGGER_LENGTH} caracteres y la respuesta 1-${MAX_REPLY_LENGTH}.` };
  const config = getConfig(guildId);
  const existing = config.rules.find((rule) => rule.trigger === cleanName);
  if (existing) existing.replies = [...new Set([...existing.replies, ...values])];
  else config.rules.push({ trigger: cleanName, replies: values });
  config.enabled = true;
  saveConfig(guildId, config);
  return { ok: true, config };
}

function removeRule(guildId, trigger) {
  const cleanName = cleanTrigger(trigger);
  const config = getConfig(guildId);
  const rules = config.rules.filter((rule) => rule.trigger !== cleanName);
  if (rules.length === config.rules.length) return { ok: false, reason: `No hay una respuesta configurada para \`${cleanName ?? trigger}\`.` };
  config.rules = rules.length ? rules : defaultRules();
  saveConfig(guildId, config);
  return { ok: true, config };
}

function resetConfig(guildId) {
  store.delete(guildId);
  return getConfig(guildId);
}

function formatConfig(guildId) {
  const config = getConfig(guildId);
  const state = config.enabled ? 'activado' : 'desactivado';
  const lines = config.rules.map((rule) => `• \`${rule.trigger}\` → ${rule.replies.join(' | ')}`);
  return `**Autoresponder ${state}**\n${lines.join('\n') || 'No hay reglas manuales configuradas.'}`;
}

function createAutoresponder() {
  function responseFor(message) {
    if (!message?.guild || message.author?.bot) return null;
    const content = String(message.content ?? '').trim();
    if (!content || /^xyb(?:\s|$)/i.test(content)) return null;

    const config = getConfig(message.guild.id);
    if (!config.enabled) return null;
    const keyword = config.rules.find(({ trigger }) => matchesTrigger(trigger, content));
    if (!keyword) return null;
    const reply = keyword.replies[Math.floor(Math.random() * keyword.replies.length)];
    return { content: reply, allowedMentions: { parse: [] } };
  }

  async function responseForAsync(message) {
    if (!message?.guild || message.author?.bot) return null;
    const content = String(message.content ?? '').trim();
    if (!content || /^xyb(?:\s|$)/i.test(content)) return null;
    const config = getConfig(message.guild.id);
    if (!config.enabled) return null;

    const keyword = config.rules.find(({ trigger }) => matchesTrigger(trigger, content));
    if (!keyword) return null;
    const reply = keyword.replies[Math.floor(Math.random() * keyword.replies.length)];
    return { content: reply, allowedMentions: { parse: [] } };
  }

  async function handle(message) {
    const response = await responseForAsync(message);
    if (!response) return false;
    await message.reply(response);
    return true;
  }

  return { handle, responseFor, responseForAsync };
}

module.exports = {
  KEYWORD_REPLIES,
  MAX_REPLY_LENGTH,
  MAX_TRIGGER_LENGTH,
  createAutoresponder,
  addRule,
  formatConfig,
  getConfig,
  matchesTrigger,
  removeRule,
  resetConfig,
  setEnabled,
  setRule,
  store,
};
