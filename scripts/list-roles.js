// Herramienta de una vez: lista los roles del servidor. Uso: node scripts/list-roles.js
require('dotenv').config();

(async () => {
  const headers = { Authorization: `Bot ${process.env.DISCORD_TOKEN}` };
  const roles = await (await fetch(`https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/roles`, { headers })).json();
  if (!Array.isArray(roles)) {
    console.log(roles);
    return;
  }
  console.log(`${roles.length} roles:`);
  for (const role of roles.sort((a, b) => b.position - a.position)) {
    console.log(`  ${String(role.id).padEnd(20)} ${role.name}`);
  }
})();
