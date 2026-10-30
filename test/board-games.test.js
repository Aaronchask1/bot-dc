const test = require('node:test');
const assert = require('node:assert/strict');
const board = require('../src/lib/board-games');
const command = require('../src/commands/games');

const a = {id:'111',username:'Ana'}, b = {id:'222',username:'Beto'};
function component(id, user, channelId='c') {
  return { customId:id, channelId, user:{id:user}, isButton:()=>true,
    async reply(value) { this.replyValue=value; }, async update(value) { this.updateValue=value; } };
}
function idOf(p) { return p.components[0].components[0].data.custom_id.split(':')[1]; }
async function move(id, action, user, now=1001, channel='c') { const i=component(`board:${id}:${action}`,user,channel); assert.equal(await board.handle(i,now),true); return i; }
test.afterEach(() => board._games.clear());
test('invitation, turn and channel checks; three-in-a-row ends and clears buttons', async () => {
  const invite=board.create('tictactoe',a,b,'c',1000), id=idOf(invite);
  assert.match((await move(id,'accept','333')).replyValue.content,/invitada/);
  assert.match((await move(id,'accept','222',1001,'other')).replyValue.content,/otro canal/);
  const accepted=await move(id,'accept','222'); assert.equal(accepted.updateValue.components.length,3);
  assert.match((await move(id,'0','222')).replyValue.content,/turno/);
  await move(id,'0','111');
  assert.match((await move(id,'0','222')).replyValue.content,/no está disponible/);
  await move(id,'3','222'); await move(id,'1','111'); await move(id,'4','222');
  const win=await move(id,'2','111'); assert.match(win.updateValue.embeds[0].data.description,/Ganó/);
  assert.deepEqual(win.updateValue.components,[]); assert.equal(board._games.has(id),false);
});
test('connect4 uses gravity and detects four in a column', async () => {
  const id=idOf(board.create('connect4',a,b,'c',1000));
  await move(id,'accept','222');
  for (let n=0;n<3;n++) { await move(id,'0','111'); await move(id,'1','222'); }
  const win=await move(id,'0','111'); assert.match(win.updateValue.embeds[0].data.description,/Ganó/);
  assert.deepEqual(win.updateValue.components,[]);
});
test('decline, expiry and invalid targets do not start games', async () => {
  assert.throws(()=>board.create('tictactoe',a,a,'c'),/otra persona/);
  assert.throws(()=>board.create('connect4',a,{id:'3',bot:true},'c'),/otra persona/);
  const id=idOf(board.create('tictactoe',a,b,'c',1000));
  assert.match((await move(id,'accept','222',1000+board.TTL)).replyValue.content,/caducó/);
  const id2=idOf(board.create('connect4',a,b,'c',1000));
  assert.match((await move(id2,'decline','222')).updateValue.content,/rechazada/);
});
test('prefix command routes named games and slash definition is valid', async () => {
  let result;
  await command.execute({invokedName:'tictactoe',args:['<@222>'],text:'<@222>',isSlash:false,user:a,target:b,channel:{id:'c'},reply:async p=>{result=p;},fail:async e=>{throw Error(e)}});
  assert.equal(result.components.length,1);
  const {SlashCommandBuilder}=require('discord.js');
  const json=command.slash.setup(new SlashCommandBuilder().setName('games').setDescription('Juegos')).toJSON();
  assert.equal(json.options.some(o=>o.name==='usuario'),true);
});
test('findemoji is limited to its player and ends after a choice', async () => {
  const data=board.create('findemoji',a,null,'c',1000), id=idOf(data), answer=board._games.get(id).answer;
  assert.match((await move(id,String(answer),'222')).replyValue.content,/Solo quien/);
  const result=await move(id,String(answer),'111');
  assert.match(result.updateValue.content,/encontraste/);
  assert.equal(board._games.has(id),false);
});
test('hangman uses letter guesses and rejects repeated or invalid guesses', async () => {
  const results=[], failures=[];
  const run=async text=>command.execute({invokedName:'hangman',text,args:[],isSlash:false,user:{id:'hangman-test'},guild:{id:'g'},reply:async p=>results.push(p),fail:async p=>failures.push(p)});
  await run(''); assert.match(results.at(-1),/Errores: \*\*0\/6/);
  await run('z'); assert.match(results.at(-1),/Errores: \*\*1\/6/);
  await run('z'); assert.match(failures.at(-1),/Ya intentaste/);
  await run('ab'); assert.match(failures.at(-1),/sola letra/);
  await run('salir'); assert.match(results.at(-1),/terminada/);
});
test('memory enforces player, checks pairs and finishes when all six match', async () => {
  const data=board.create('memory',a,null,'c',1000), id=idOf(data), cards=board._games.get(id).cards;
  assert.match((await move(id,'0','222')).replyValue.content,/Solo quien/);
  for (const card of new Set(cards)) {
    const indices=cards.map((value,index)=>value===card?index:-1).filter(n=>n>=0);
    await move(id,String(indices[0]),'111');
    const response=await move(id,String(indices[1]),'111');
    if(!board._games.has(id)) assert.match(response.updateValue.content,/seis parejas/);
  }
  assert.equal(board._games.has(id),false);
});
