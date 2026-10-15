// Herramienta de una vez: lista quién ha hablado en el servidor, con su ID,
// para poder revisar la base de datos. Uso: node scripts/who.js
require('dotenv').config();

(async () => {
  const headers = { Authorization: `Bot ${process.env.DISCORD_TOKEN}` };
  const guilds = await (await fetch('https://discord.com/api/v10/users/@me/guilds', { headers })).json();
  const guild = guilds.find((item) => item.id === process.env.GUILD_ID);
  if (!guild) {
    console.log('El bot no está en ese servidor.');
    return;
  }

  const channels = await (await fetch(`https://discord.com/api/v10/guilds/${guild.id}/channels`, { headers })).json();
  for (const channel of channels.filter((item) => item.type === 0).slice(0, 6)) {
    const messages = await (await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages?limit=8`, { headers })).json();
    if (!Array.isArray(messages) || messages.length === 0) continue;
    const people = new Map();
    for (const message of messages) {
      if (message.author.bot) continue;
      people.set(message.author.id, `${message.author.username} · ${message.author.global_name ?? ''}`);
    }
    if (people.size === 0) continue;
    console.log(`#${channel.name}`);
    for (const [id, name] of people) console.log('   ', id, name);
  }
})();
