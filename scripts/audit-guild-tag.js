require('dotenv').config();
const { REST } = require('discord.js');
const { createMonitor } = require('../src/lib/guild-tag');

// Deliberately no gateway login or ban-capable guild manager: read-only audit.
const client = { rest: new REST({ version: '10', timeout: 15000, retries: 0 }).setToken(process.env.DISCORD_TOKEN) };
createMonitor(client, { guildId: process.env.TAG_GUILD_ID }).scan({ auditOnly: true }).then(report => {
  if (report.error) process.exitCode = 1;
});
