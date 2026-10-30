const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PermissionFlagsBits } = require('discord.js');

process.env.XYB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-management-test-'));
const autorole = require('../src/commands/autorole');
const tickets = require('../src/commands/tickets');
const giveaway = require('../src/commands/giveaway');
const selfrole = require('../src/commands/selfrole');

function fixture(id) {
  const role = { id: 'role', managed: false, editable: true, permissions: { has: () => false } };
  const highest = { comparePositionTo: () => 1 };
  const guild = { id, ownerId: 'owner', roles: { cache: new Map([['role', role]]) }, members: { me: { permissions: { has: () => true }, roles: { highest } } }, channels: { cache: new Map() } };
  const member = { id: 'owner', permissions: { has: () => true }, roles: { highest } };
  return { guild, role, member };
}

test('autorol se guarda por servidor y se aplica solo a personas', async () => {
  const { guild, role, member } = fixture('guild-a');
  const replies = [];
  await autorole.execute({ guild, member, args: ['set', 'role'], reply: p => replies.push(p), fail: m => { throw Error(m); } });
  let assigned;
  assert.equal(await autorole.handleMemberAdd({ guild, user: { bot: false }, roles: { add: async r => { assigned = r; } } }), true);
  assert.equal(assigned, role);
  assert.equal(await autorole.handleMemberAdd({ guild, user: { bot: true } }), false);
  assert.equal(await autorole.handleMemberAdd({ guild: fixture('guild-b').guild, user: { bot: false } }), false);
  await autorole.execute({ guild, member, args: ['quitar'], reply: p => replies.push(p) });
  assert.equal(await autorole.handleMemberAdd({ guild, user: { bot: false } }), false);
});

test('autorol rechaza rol gestionado o por encima del bot y del administrador', () => {
  const { guild, role, member } = fixture('guild-c');
  assert.match(autorole.validateRole(guild, member, { ...role, managed: true }), /rol normal/);
  assert.match(autorole.validateRole(guild, member, { ...role, editable: false }), /debajo/);
  member.id = 'other'; member.roles.highest.comparePositionTo = () => -1;
  assert.match(autorole.validateRole(guild, member, role), /debajo/);
});

test('autorol no puede escalar privilegios por cambios del rol', async () => {
  const { guild, role, member } = fixture('guild-risk');
  let privileged = false;
  role.permissions.has = permission => privileged && permission === PermissionFlagsBits.ManageGuild;
  await autorole.execute({ guild, member, args: ['set', 'role'], reply: () => {}, fail: m => { throw Error(m); } });
  privileged = true;
  assert.match(autorole.validateRole(guild, member, role), /administrativos/);
  assert.equal(await autorole.handleMemberAdd({ guild, user: { bot: false }, roles: { add: () => { throw Error('no debe asignarse'); } } }), false);
});

test('tickets privados evitan duplicados y solo creador o soporte puede cerrar', async () => {
  const { guild, member } = fixture('tickets-guild');
  let created = 0, overwrites, revoke;
  const channel = { id: 'ticket-channel', send: async () => {}, permissionOverwrites: { edit: async (...args) => { revoke = args; } } };
  guild.channels.create = async opts => { created++; overwrites = opts.permissionOverwrites; guild.channels.cache.set(channel.id, channel); return channel; };
  await tickets.execute({ guild, member, args: ['role'], reply: async () => {}, fail: m => { throw Error(m); } });
  const make = (user, action, channelId = '') => ({
    guild, guildId: guild.id, channelId, channel, user: { id: user }, client: { user: { id: 'bot' } },
    customId: action, isButton: () => true, memberPermissions: { has: () => false }, member: { roles: { cache: new Map() } },
    async deferReply() { this.deferred = true; }, async editReply(message) { this.result = message; },
  });
  const open = make('user-123456', tickets.OPEN);
  await tickets.handleComponent(open);
  assert.equal(created, 1);
  assert.ok(overwrites.some(o => o.id === guild.id && o.deny.includes(PermissionFlagsBits.ViewChannel)));
  assert.ok(overwrites.some(o => o.id === 'role' && o.allow.includes(PermissionFlagsBits.ViewChannel)));
  const duplicate = make('user-123456', tickets.OPEN);
  await tickets.handleComponent(duplicate);
  assert.equal(created, 1);
  assert.match(duplicate.result.content, /Ya tienes/);
  const other = make('another', tickets.CLOSE, channel.id);
  await tickets.handleComponent(other);
  assert.match(other.result, /Solo el creador/);
  assert.equal(revoke, undefined);
  const close = make('user-123456', tickets.CLOSE, channel.id);
  await tickets.handleComponent(close);
  assert.equal(revoke[0], 'user-123456');
  assert.equal(revoke[1].ViewChannel, false);
  assert.equal(close.result, 'Ticket cerrado.');
});

test('sorteo guarda participantes, evita duplicados y termina una sola vez', async () => {
  assert.equal(giveaway.durationMs('2h'), 7200000);
  assert.throws(() => giveaway.durationMs('0m'));
  assert.throws(() => giveaway.durationMs('31d'));
  const { guild } = fixture('guild-giveaway');
  const sent = [];
  const channel = { id: 'giveaway-channel', send: async payload => { sent.push(payload); return { id: 'message-123' }; } };
  await giveaway.execute({ guild, channel, args: ['1m', 'Premio'], reply: () => {}, fail: m => { throw Error(m); }, defer: () => {} });
  const join = (user, guildId = guild.id) => ({ guildId, user: { id: user, bot: false }, message: { id: 'message-123' }, customId: giveaway.JOIN, isButton: () => true, async reply(p) { this.result = p; } });
  const one = join('user-1'); await giveaway.handleComponent(one); assert.match(one.result.content, /participando/);
  const duplicate = join('user-1'); await giveaway.handleComponent(duplicate); assert.match(duplicate.result.content, /Ya estás/);
  const otherServer = join('user-2', 'other-guild'); await giveaway.handleComponent(otherServer); assert.match(otherServer.result.content, /no acepta/);
  let edits = 0;
  const client = { channels: { fetch: async () => ({ messages: { fetch: async () => ({ edit: async payload => { edits++; assert.match(payload.content, /user-1/); } }) } }) } };
  await giveaway.sweep(client, Date.now() + 120000);
  await giveaway.sweep(client, Date.now() + 120000);
  assert.equal(edits, 1);
  const closed = join('user-2'); await giveaway.handleComponent(closed); assert.match(closed.result.content, /no acepta/);
});

test('selfrole solo otorga el rol seguro del panel y vuelve a revisar sus permisos', async () => {
  const { guild, role, member } = fixture('guild-selfrole');
  const channel = { send: async () => ({ id: 'panel-selfrole' }) };
  await selfrole.execute({ guild, channel, member, args: ['role'], reply: () => {}, fail: m => { throw Error(m); } });
  let added = 0;
  const interaction = { guild, message: { id: 'panel-selfrole' }, user: { id: 'member' }, customId: selfrole.TOGGLE, isButton: () => true,
    member: { roles: { cache: new Map(), add: async () => { added++; }, remove: async () => {} } },
    async deferReply() { this.deferred = true; }, async editReply(message) { this.result = message; }, async reply(message) { this.result = message; } };
  await selfrole.handleComponent(interaction);
  assert.equal(added, 1);
  role.permissions.has = permission => permission === PermissionFlagsBits.BanMembers;
  await selfrole.handleComponent(interaction);
  assert.equal(added, 1);
  assert.match(interaction.result.content, /no está disponible/);
  const forged = { ...interaction, message: { id: 'otro-panel' } };
  await selfrole.handleComponent(forged);
  assert.match(forged.result.content, /no está disponible/);
});
