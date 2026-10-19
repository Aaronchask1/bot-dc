const { Routes, Events } = require('discord.js');
const { createStore } = require('../store');
const logger = require('../logger');

function delayFor() {
  return 300_000;
}

function install(client, { store = createStore('auto-delete'), now = Date.now, schedule = setTimeout } = {}) {
  const timers = new Map();
  function arm(record) {
    if (timers.has(record.id)) return;
    const timer = schedule(async () => {
      timers.delete(record.id);
      try {
        await client.rest.delete(Routes.channelMessage(record.channelId, record.id));
        store.delete(record.id);
      } catch (error) {
        if (error.code === 10008 || error.code === 10003) store.delete(record.id);
        else {
          logger.warn(`[auto-delete] No pude borrar ${record.id}; reintento en un minuto.`, error.message);
          arm({ ...record, at: now() + 60_000 });
        }
      }
    }, Math.max(0, record.at - now()));
    timer.unref?.();
    timers.set(record.id, timer);
  }
  function track(message) {
    if (!client.user || message.author?.id !== client.user.id || !message.guildId) return;
    if (store.get(message.id)) return;
    const record = { id: message.id, channelId: message.channelId, at: (message.createdTimestamp ?? now()) + delayFor(message.content) };
    store.set(record.id, record);
    arm(record);
  }
  client.on(Events.MessageCreate, track);
  client.once(Events.ClientReady, () => {
    for (const record of Object.values(store.read())) arm(record);
  });
  return { track };
}

module.exports = { delayFor, install };
