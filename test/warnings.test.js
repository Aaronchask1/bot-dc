const test = require('node:test');
const assert = require('node:assert/strict');
const { applyWarning, permissions } = require('../src/commands/warn');
const { PermissionFlagsBits } = require('discord.js');

test('advertencias por servidor y usuario se pueden consultar y eliminar sin afectar otras', () => {
  const data = {};
  const base = { guildId: 'g1', targetId: 'u1', actorId: 'm1', action: 'add', reason: 'Spam' };
  const one = applyWarning(data, base);
  applyWarning(data, { ...base, guildId: 'g2' });
  applyWarning(data, { ...base, targetId: 'u2' });
  assert.equal(applyWarning(data, { ...base, action: 'list' }).records.length, 1);
  assert.ok(applyWarning(data, { ...base, targetId: 'u2', action: 'remove', caseId: one.id }).error);
  assert.equal(applyWarning(data, { ...base, action: 'remove', caseId: one.id }).removed, true);
  assert.equal(data.g1.length, 1);
  assert.equal(data.g2.length, 1);
  assert.deepEqual(permissions, [PermissionFlagsBits.ModerateMembers]);
});
