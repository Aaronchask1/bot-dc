const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('trivia points survive restart and remain separated by user and guild', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'xyb-trivia-test-'));
  const cwd = path.resolve(__dirname, '..');
  const env = { ...process.env, XYB_DATA_DIR: temporary };
  try {
    const play = `
      const game=require('./src/commands/games'); Math.random=()=>0;
      (async()=>{let view;
        await game.execute({invokedName:'trivia',text:'',user:{id:'111',username:'Ana'},guild:{id:'333'},isSlash:false,reply:async p=>{view=p},fail:async e=>{throw Error(e)}});
        const id=view.components[0].components[0].data.custom_id;
        await game.handleComponent({isButton:()=>true,customId:id,user:{id:'111'},guildId:'333',update:async()=>{},reply:async()=>{throw Error('bad interaction')}});
      })().catch(e=>{console.error(e);process.exitCode=1});`;
    execFileSync(process.execPath, ['-e',play], {cwd,env,encoding:'utf8'});
    assert.equal(JSON.parse(fs.readFileSync(path.join(temporary,'trivia-points.json'),'utf8'))['333:111'],1);
    const read = `
      const game=require('./src/commands/games'); Math.random=()=>0;
      (async()=>{for(const [guild,user] of [['333','111'],['333','222'],['444','111']]){let view;
        await game.execute({invokedName:'trivia',text:'',user:{id:user,username:'Ana'},guild:{id:guild},isSlash:false,reply:async p=>{view=p},fail:async e=>{throw Error(e)}});
        console.log(view.embeds[0].data.footer.text);
      }})().catch(e=>{console.error(e);process.exitCode=1});`;
    const lines=execFileSync(process.execPath,['-e',read],{cwd,env,encoding:'utf8'}).trim().split(/\r?\n/);
    assert.match(lines[0],/Puntos: 1/);
    assert.match(lines[1],/Puntos: 0/);
    assert.match(lines[2],/Puntos: 0/);
  } finally {
    fs.rmSync(temporary,{recursive:true,force:true});
  }
});
