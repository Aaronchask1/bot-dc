// Herramienta de una vez: lista los emojis custom del servidor con su nombre
// y su id, para poder usarlos en el uid. No es parte del bot.
// Uso: node scripts/list-emojis.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guildId = process.env.GUILD_ID;
  const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
  if (!guild) {
    console.log('No encontré el servidor.');
    process.exit(1);
  }

  const lista = [...guild.emojis.cache.values()]
    .map((emoji) => ({ nombre: emoji.name, id: emoji.id, animado: emoji.animated, url: emoji.imageURL() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  console.log(`Servidor: ${guild.name} (${guild.id}) — ${lista.length} emojis\n`);
  for (const emoji of lista) {
    console.log(`${emoji.nombre.padEnd(22)} ${emoji.id} ${emoji.url}`);
  }

  await client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
