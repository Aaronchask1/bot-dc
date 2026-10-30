const test=require('node:test');
const assert=require('node:assert/strict');
const {PermissionFlagsBits,SlashCommandBuilder}=require('discord.js');
const {createController}=require('../src/lib/guild-events');
const logsCommand=require('../src/commands/memberlogs');
const goodbyeCommand=require('../src/commands/despedida');

function fixture() {
  const data=new Map(), sent=[], errors=[];
  const store={get:k=>data.get(k),set:(k,v)=>data.set(k,v)};
  const controller=createController(store,{warn:(...x)=>errors.push(x)});
  const channel={id:'123',guild:{id:'g1'},isTextBased:()=>true,send:async data=>sent.push(data)};
  const guild={id:'g1',name:'Comunidad',memberCount:3,channels:{cache:new Map([['123',channel]])}};
  const member={id:'999',user:{username:'@everyone'},guild};
  return {controller,store,data,sent,errors,channel,guild,member};
}
test('events are opt-in, isolated per guild and suppress all mentions',async()=>{
  const f=fixture(); await f.controller.handleMemberAdd(f.member); await f.controller.handleMemberRemove(f.member); assert.equal(f.sent.length,0);
  f.controller.set('g1',{logsChannel:'123',goodbyeChannel:'123',goodbyeMessage:'Adiós {{username}} de {{server}}; quedan {{members}}'});
  const restored=createController(f.store,{warn(){}}); assert.equal(restored.get('g1').logsChannel,'123'); assert.equal(restored.get('g2').logsChannel,null);
  await restored.handleMemberAdd(f.member); await restored.handleMemberRemove(f.member);
  assert.equal(f.sent.length,3); assert.ok(f.sent.some(s=>s.content.includes('Adiós @everyone de Comunidad; quedan 3')));
  assert.ok(f.sent.every(s=>s.allowedMentions.parse.length===0));
});
test('failure to send logs does not prevent goodbye and text remains bounded',async()=>{
  const f=fixture(), broken={id:'456',isTextBased:()=>true,send:async()=>{throw Error('missing permission')}};
  f.guild.channels.cache.set('456',broken);
  f.controller.set('g1',{logsChannel:'456',goodbyeChannel:'123',goodbyeMessage:'x'.repeat(3000)});
  await f.controller.handleMemberRemove(f.member);
  assert.equal(f.errors.length,1); assert.equal(f.sent.length,1); assert.equal(f.sent[0].content.length,2000);
});
test('configuration commands enforce ManageGuild and have valid slash definitions',()=>{
  for(const command of [logsCommand,goodbyeCommand]){
    assert.equal(command.guildOnly,true);assert.ok(command.permissions.includes(PermissionFlagsBits.ManageGuild));
    const json=command.slash.setup(new SlashCommandBuilder().setName(command.name).setDescription(command.description)).toJSON();
    assert.ok(json.options.some(o=>o.name==='canal'));
  }
});
