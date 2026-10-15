require('dotenv').config();

const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { listCommands } = require('./commands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Faltan DISCORD_TOKEN o CLIENT_ID en .env.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra los comandos disponibles.'),
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('Muestra la información de este servidor.'),
  new SlashCommandBuilder()
    .setName('kiss')
    .setDescription('Envía un beso a una persona.')
    .addUserOption((option) => option.setName('usuario').setDescription('Persona que recibirá el beso.').setRequired(true)),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Borra mensajes recientes del canal.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) => option.setName('cantidad').setDescription('Cantidad: 1 a 1000.').setRequired(true).setMinValue(1).setMaxValue(1000)),
  new SlashCommandBuilder()
    .setName('pg')
    .setDescription('Borra hasta 1000 de tus propios mensajes recientes.'),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa a un usuario.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) => option.setName('usuario').setDescription('Usuario a expulsar.').setRequired(true))
    .addStringOption((option) => option.setName('razon').setDescription('Motivo de la expulsión.')),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banea a un usuario.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) => option.setName('usuario').setDescription('Usuario a banear.').setRequired(true))
    .addStringOption((option) => option.setName('razon').setDescription('Motivo del ban.')),
  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Silencia temporalmente a un usuario.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('usuario').setDescription('Usuario a silenciar.').setRequired(true))
    .addIntegerOption((option) => option.setName('minutos').setDescription('Duración: 1 a 40320 minutos.').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption((option) => option.setName('razon').setDescription('Motivo del silencio.')),
  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Quita el silencio de un usuario.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('usuario').setDescription('Usuario a desmutear.').setRequired(true))
    .addStringOption((option) => option.setName('razon').setDescription('Motivo.')),
  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Cierra el canal actual para @everyone.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) => option.setName('razon').setDescription('Motivo del cierre.')),
  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Abre el canal actual para @everyone.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) => option.setName('razon').setDescription('Motivo de la apertura.')),
].map((command) => command.toJSON());

// Los comandos nuevos viven en src/commands y se describen ahí mismo, así que
// aquí solo se convierte su definición en un slash command.
for (const command of listCommands()) {
  if (!command.slash) continue;
  const builder = new SlashCommandBuilder()
    .setName(command.name)
    .setDescription(command.slash.description ?? command.description);
  if (command.permissions?.length) {
    builder.setDefaultMemberPermissions(command.permissions[0]);
  }
  if (command.slash.setup) command.slash.setup(builder);
  commands.push(builder.toJSON());
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

async function registerCommands() {
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, { body: commands });
  console.log(`${GUILD_ID ? 'En el servidor de prueba' : 'Globalmente'}: ${commands.length} comandos slash registrados.`);
}

registerCommands().catch((error) => {
  console.error('No se pudo registrar el comando:', error);
  process.exit(1);
});
