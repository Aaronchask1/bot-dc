const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { createDashboardBridge, startDashboardBridge } = require('../src/lib/dashboard-bridge');

const GUILD = '111111111111111111', ACTOR = '222222222222222222', CHANNEL = '333333333333333333', ROLE = '444444444444444444';
const SECRET = '0123456789abcdef0123456789abcdef';

async function fixture() {
  let permitted = true, rolePermission = true, validRole = true;
  let welcomeConfig = { channel: null, message: 'Hola', embed: true, mention: false };
  let goodbyeConfig = { goodbyeChannel: null, goodbyeMessage: 'Adiós' }, role = null;
  const member = { permissions: { has(p) { return p === PermissionFlagsBits.ManageGuild ? permitted : rolePermission; } } };
  const guild = { id: GUILD, name: 'Servidor', members: { async fetch({ user, force }) { assert.equal(force, true); if (user !== ACTOR) throw Error('missing'); return member; } },
    channels: { cache: new Map([[CHANNEL, { id: CHANNEL, name: 'general', type: ChannelType.GuildText }], ['555555555555555555', { id: '555555555555555555', name: 'voz', type: ChannelType.GuildVoice }]]) },
    roles: { cache: new Map([[ROLE, { id: ROLE, name: 'Miembros' }]]) } };
  const bridge = createDashboardBridge({ client: { guilds: { cache: new Map([[GUILD, guild]]) } }, secret: SECRET,
    welcome: { getConfig: () => welcomeConfig, setConfig: (_, patch) => { welcomeConfig = { ...welcomeConfig, ...patch }; } },
    guildEvents: { get: () => goodbyeConfig, set: (_, patch) => { goodbyeConfig = { ...goodbyeConfig, ...patch }; } },
    autorole: { getConfiguredRole: () => role, setConfiguredRole: (_, value) => { role = value; }, validateRole: (_, __, value) => !validRole || !value ? 'invalid' : null } });
  bridge.listen(0, '127.0.0.1'); await once(bridge, 'listening');
  const origin = `http://127.0.0.1:${bridge.address().port}`;
  const send = (path, { method = 'GET', body, token = SECRET, actor = ACTOR } = {}) => fetch(origin + path, { method, headers: { Authorization: `Bearer ${token}`, 'X-XYB-Actor': actor, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { bridge, send, settings: () => ({ welcomeConfig, goodbyeConfig, role }), deny: () => { permitted = false; }, noRoles: () => { rolePermission = false; }, unsafeRole: () => { validRole = false; } };
}

test('puente deshabilitado por defecto y secreto protegido', async () => {
  assert.equal(startDashboardBridge({}, {}), null);
  assert.throws(() => startDashboardBridge({}, { DASHBOARD_BRIDGE_PORT: '1234', DASHBOARD_BRIDGE_SECRET: 'corto' }));
  const f = await fixture(); try {
    const path = `/guilds/${GUILD}/settings`;
    assert.equal((await f.send(path, { token: 'incorrecto' })).status, 401);
    assert.equal((await f.send(path, { actor: '999999999999999999' })).status, 403);
    f.deny(); assert.equal((await f.send(path)).status, 403);
  } finally { f.bridge.close(); }
});

test('ajustes aislados al servidor, canales válidos y escritura parcial', async () => {
  const f = await fixture(); try {
    assert.equal((await f.send('/guilds/999999999999999999/settings')).status, 404);
    const channels = await (await f.send(`/guilds/${GUILD}/channels`)).json();
    assert.deepEqual(channels.channels, [{ id: CHANNEL, name: 'general' }]);
    const path = `/guilds/${GUILD}/settings`;
    assert.equal((await f.send(path, { method: 'POST', body: { welcome: { channel: '555555555555555555', message: 'Hola' } } })).status, 400);
    assert.equal((await f.send(path, { method: 'POST', body: { welcome: { channel: CHANNEL, message: '@everyone' } } })).status, 400);
    assert.equal((await f.send(path, { method: 'POST', body: { welcome: { channel: CHANNEL, message: 'Hola {{user}}' }, goodbye: { channel: CHANNEL, message: 'Adiós {{username}}' } } })).status, 200);
    assert.deepEqual(f.settings().welcomeConfig, { channel: CHANNEL, message: 'Hola {{user}}', embed: true, mention: false });
    assert.equal(f.settings().goodbyeConfig.goodbyeChannel, CHANNEL);
    assert.equal((await f.send(path, { method: 'POST', body: { welcome: { channel: null, message: 'Hola' } } })).status, 200);
    assert.equal(f.settings().welcomeConfig.channel, null);
  } finally { f.bridge.close(); }
});

test('autoroles requieren permiso y rol seguro, sin aplicar cambios parciales', async () => {
  const f0 = await fixture(); try {
    assert.deepEqual(await (await f0.send(`/guilds/${GUILD}/roles`)).json(), { roles: [{ id: ROLE, name: 'Miembros' }], manageable: true });
    assert.equal((await f0.send(`/guilds/${GUILD}/settings`, { method: 'POST', body: { autorole: { role: ROLE } } })).status, 200);
    assert.equal(f0.settings().role, ROLE);
    assert.equal((await f0.send(`/guilds/${GUILD}/settings`, { method: 'POST', body: { autorole: { role: null } } })).status, 200);
    assert.equal(f0.settings().role, null);
  } finally { f0.bridge.close(); }
  const f = await fixture(); try {
    const path = `/guilds/${GUILD}/settings`;
    f.noRoles(); assert.deepEqual(await (await f.send(`/guilds/${GUILD}/roles`)).json(), { roles: [], manageable: false });
    assert.equal((await f.send(path, { method: 'POST', body: { autorole: { role: ROLE } } })).status, 403);
  } finally { f.bridge.close(); }
  const f2 = await fixture(); try {
    f2.unsafeRole();
    assert.equal((await f2.send(`/guilds/${GUILD}/settings`, { method: 'POST', body: { welcome: { channel: CHANNEL, message: 'Hola' }, autorole: { role: ROLE } } })).status, 400);
    assert.equal(f2.settings().welcomeConfig.channel, null);
    assert.equal(f2.settings().role, null);
  } finally { f2.bridge.close(); }
});
