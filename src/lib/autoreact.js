const { createStore } = require('../store');
const { matchesTrigger } = require('./autoresponder');

const store = createStore('autoreacts');
const MAX_TRIGGER_LENGTH = 40;
const MAX_EMOJI_LENGTH = 100;

function clean(value, max) {
  const text = String(value ?? '').trim();
  return text.length > 0 && text.length <= max && !/[\r\n]/.test(text) ? text.toLocaleLowerCase() : null;
}

function cleanEmoji(value) {
  const emoji = String(value ?? '').trim();
  return emoji.length > 0 && emoji.length <= MAX_EMOJI_LENGTH && !/[\r\n]/.test(emoji) ? emoji : null;
}

function getConfig(guildId) {
  const raw = store.get(guildId);
  const rules = Array.isArray(raw?.rules) ? raw.rules
    .map((item) => ({
      trigger: clean(item?.trigger, MAX_TRIGGER_LENGTH),
      emojis: (Array.isArray(item?.emojis) ? item.emojis : [item?.emoji])
        .map(cleanEmoji).filter(Boolean).filter((emoji, index, list) => list.indexOf(emoji) === index),
    }))
    .filter((item) => item.trigger && item.emojis.length) : [];
  return { enabled: raw?.enabled !== false, rules };
}

function saveConfig(guildId, config) {
  const normalized = { enabled: Boolean(config.enabled), rules: config.rules
    .map((item) => ({
      trigger: clean(item.trigger, MAX_TRIGGER_LENGTH),
      emojis: (item.emojis ?? [item.emoji]).map(cleanEmoji).filter(Boolean),
    }))
    .filter((item) => item.trigger && item.emojis.length) };
  return store.set(guildId, normalized);
}

function setEnabled(guildId, enabled) {
  const config = getConfig(guildId);
  config.enabled = Boolean(enabled);
  return saveConfig(guildId, config);
}

function setRule(guildId, trigger, emoji) {
  const cleanTrigger = clean(trigger, MAX_TRIGGER_LENGTH)?.replace(/^@+/, '');
  const cleanReaction = cleanEmoji(emoji);
  if (!cleanTrigger || !cleanReaction) return { ok: false, reason: 'Indica una palabra (máximo 40 caracteres) y un emoji válido.' };
  const config = getConfig(guildId);
  const existing = config.rules.find((rule) => rule.trigger === cleanTrigger);
  if (existing) existing.emojis = [cleanReaction];
  else config.rules.push({ trigger: cleanTrigger, emojis: [cleanReaction] });
  config.enabled = true;
  saveConfig(guildId, config);
  return { ok: true, config };
}

function addRule(guildId, trigger, emojis) {
  const cleanTrigger = clean(trigger, MAX_TRIGGER_LENGTH)?.replace(/^@+/, '');
  const values = (Array.isArray(emojis) ? emojis : String(emojis ?? '').split(/\s*\|\s*/))
    .map(cleanEmoji).filter(Boolean).filter((emoji, index, list) => list.indexOf(emoji) === index);
  if (!cleanTrigger || !values.length) return { ok: false, reason: 'Indica una palabra (máximo 40 caracteres) y un emoji válido.' };
  const config = getConfig(guildId);
  const existing = config.rules.find((rule) => rule.trigger === cleanTrigger);
  if (existing) existing.emojis = [...new Set([...existing.emojis, ...values])];
  else config.rules.push({ trigger: cleanTrigger, emojis: values });
  config.enabled = true;
  saveConfig(guildId, config);
  return { ok: true, config };
}

function removeRule(guildId, trigger) {
  const wanted = clean(trigger, MAX_TRIGGER_LENGTH)?.replace(/^@+/, '');
  const config = getConfig(guildId);
  const rules = config.rules.filter((rule) => rule.trigger !== wanted);
  if (rules.length === config.rules.length) return { ok: false, reason: `No hay una reacción configurada para \`${wanted ?? trigger}\`.` };
  config.rules = rules;
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
  const lines = config.rules.map((rule) => `• \`${rule.trigger}\` → ${rule.emojis.join(' ')}`);
  return `**Autoreact ${state}**\n${lines.join('\n') || 'No hay reglas de reacción.'}`;
}

function createAutoReact() {
  async function handle(message) {
    if (!message?.guild || message.author?.bot) return false;
    const content = String(message.content ?? '').trim();
    if (!content || /^xyb(?:\s|$)/i.test(content)) return false;
    const config = getConfig(message.guild.id);
    if (!config.enabled) return false;
    const rule = config.rules.find(({ trigger }) => matchesTrigger(trigger, content));
    if (!rule || typeof message.react !== 'function') return false;
    try {
      for (const emoji of rule.emojis) await message.react(emoji);
      return true;
    } catch {
      return false;
    }
  }
  return { handle };
}

module.exports = {
  MAX_EMOJI_LENGTH,
  MAX_TRIGGER_LENGTH,
  createAutoReact,
  addRule,
  formatConfig,
  getConfig,
  removeRule,
  resetConfig,
  setEnabled,
  setRule,
  store,
};
