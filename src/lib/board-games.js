const { randomBytes, randomInt } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');

// Games are deliberately ephemeral: a restart invalidates existing buttons.
const games = new Map();
const TTL = 10 * 60 * 1000;
const MAX_GAMES = 500;
const icon = (n) => n === 1 ? '🔴' : n === 2 ? '🟡' : '⚪';
const mention = (id) => `<@${id}>`;
function clean(now = Date.now()) { for (const [id, game] of games) if (game.expires <= now) games.delete(id); }
function button(id, label, disabled = false, style = ButtonStyle.Secondary) { return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled); }
function payload(g, note = '') {
  if (g.kind === 'memory') {
    const embed = new EmbedBuilder().setTitle('🧠 Memoria').setColor(0xFF8C69).setDescription(`Encuentra las parejas. Solo puede jugar ${mention(g.players[0])}.\nParejas: **${g.matched.size / 2}/6**`).setFooter({text:'La partida caduca tras 10 minutos sin jugar.'});
    const rows=[];
    for(let y=0;y<3;y++) rows.push(new ActionRowBuilder().addComponents(...Array.from({length:4},(_,x)=>{const n=y*4+x, visible=g.matched.has(n)||g.revealed.includes(n);return button(`board:${g.id}:${n}`,visible?g.cards[n]:'·',g.matched.has(n)||g.revealed.includes(n));})));
    return {embeds:[embed],components:rows,allowedMentions:{parse:[]}};
  }
  if (g.kind === 'findemoji') {
    const embed = new EmbedBuilder().setTitle('🔎 Encuentra el emoji').setColor(0xFF8C69).setDescription(`Encuentra **${g.oddEmoji}** entre los demás. Solo puede responder ${mention(g.players[0])}.`).setFooter({ text: 'Tienes 10 minutos para encontrarlo.' });
    const rows = [];
    for (let y=0; y<3; y++) rows.push(new ActionRowBuilder().addComponents(...Array.from({length:3}, (_,x) => {const n=y*3+x; return button(`board:${g.id}:${n}`, n===g.answer ? g.oddEmoji : g.commonEmoji);})));
    return { embeds:[embed], components:rows, allowedMentions:{parse:[]} };
  }
  const title = g.kind === 'tictactoe' ? '⭕ Tres en raya' : '🔴 Conecta 4';
  const embed = new EmbedBuilder().setTitle(title).setColor(0xFF8C69);
  if (g.phase === 'invite') {
    embed.setDescription(`${mention(g.players[0])} desafía a ${mention(g.players[1])}.\nLa invitación caduca en 10 minutos.`);
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button(`board:${g.id}:accept`, 'Aceptar', false, ButtonStyle.Success), button(`board:${g.id}:decline`, 'Rechazar', false, ButtonStyle.Danger))], allowedMentions: { parse: [] } };
  }
  const w = g.kind === 'tictactoe' ? 3 : 7, h = g.kind === 'tictactoe' ? 3 : 6;
  const board = Array.from({ length: h }, (_, y) => g.cells.slice(y*w, (y+1)*w).map(icon).join('')).join('\n');
  embed.setDescription(`${board}\n\n${note || `Turno: ${mention(g.players[g.turn])} ${icon(g.turn + 1)}`}\n🔴 ${mention(g.players[0])} · 🟡 ${mention(g.players[1])}`).setFooter({ text: 'La partida caduca tras 10 minutos sin movimiento.' });
  const rows = [];
  if (g.phase === 'playing' && g.kind === 'tictactoe') {
    for (let y = 0; y < 3; y++) rows.push(new ActionRowBuilder().addComponents(...Array.from({length:3}, (_,x) => { const i=y*3+x; return button(`board:${g.id}:${i}`, g.cells[i] ? (g.cells[i]===1?'🔴':'🟡') : '·', Boolean(g.cells[i])); })));
  } else if (g.phase === 'playing') {
    for (let start=0; start<7; start+=4) rows.push(new ActionRowBuilder().addComponents(...Array.from({length:Math.min(4,7-start)}, (_,n) => {const x=start+n; return button(`board:${g.id}:${x}`, String(x+1), Boolean(g.cells[x]));})));
  }
  return { embeds: [embed], components: rows, allowedMentions: { parse: [] } };
}
function wins(cells, w, h, x, y, mark, needed) {
  return [[1,0],[0,1],[1,1],[1,-1]].some(([dx,dy]) => {
    let n = 1;
    for (const sign of [-1,1]) for (let step=1; step<needed; step++) { const xx=x+sign*dx*step, yy=y+sign*dy*step; if (xx<0||xx>=w||yy<0||yy>=h||cells[yy*w+xx]!==mark) break; n++; }
    return n >= needed;
  });
}
function create(kind, user, target, channelId, now = Date.now()) {
  if (kind === 'memory') {
    clean(now);
    if (games.size >= MAX_GAMES) throw new Error('Hay muchas partidas activas. Inténtalo más tarde.');
    const id=randomBytes(8).toString('hex'), cards=['🐱','🐶','🐰','🐼','🦊','🐸'].flatMap(e=>[e,e]);
    for(let i=cards.length-1;i>0;i--){const n=randomInt(i+1);[cards[i],cards[n]]=[cards[n],cards[i]];}
    const g={id,kind,players:[user.id],channelId,cards,revealed:[],matched:new Set(),phase:'playing',expires:now+TTL};
    games.set(id,g); return payload(g);
  }
  if (kind === 'findemoji') {
    clean(now);
    if (games.size >= MAX_GAMES) throw new Error('Hay muchas partidas activas. Inténtalo más tarde.');
    const id=randomBytes(8).toString('hex');
    const pair=[['🐱','🐯'],['🌕','🌝'],['🍎','🍅'],['🐸','🐲']][randomInt(4)];
    const g={id,kind,players:[user.id],channelId,commonEmoji:pair[0],oddEmoji:pair[1],answer:randomInt(9),phase:'playing',expires:now+TTL};
    games.set(id,g); return payload(g);
  }
  if (!['tictactoe','connect4'].includes(kind) || !target?.id || target.id === user?.id || target.bot) throw new Error('Menciona a otra persona para jugar.');
  clean(now);
  if (games.size >= MAX_GAMES) throw new Error('Hay muchas partidas activas. Inténtalo más tarde.');
  const id = randomBytes(8).toString('hex');
  const g = { id, kind, players:[user.id,target.id], channelId, cells:Array(kind==='tictactoe'?9:42).fill(0), phase:'invite', turn:0, expires:now+TTL };
  games.set(id,g);
  return payload(g);
}
async function handle(interaction, now = Date.now()) {
  if (!interaction.isButton?.() || !interaction.customId?.startsWith('board:')) return false;
  const [,id,action] = interaction.customId.split(':'); const g = games.get(id);
  const fail = async (text) => interaction.reply({content:text, flags:MessageFlags.Ephemeral, allowedMentions:{parse:[]}});
  if (!g || g.expires <= now) { games.delete(id); await fail('Esta partida caducó. Inicia una nueva.'); return true; }
  if (g.channelId && interaction.channelId !== g.channelId) { await fail('Esta partida pertenece a otro canal.'); return true; }
  if (g.kind === 'memory') {
    if (interaction.user.id !== g.players[0]) { await fail('Solo quien inició el juego puede responder.'); return true; }
    if (!/^\d{1,2}$/.test(action) || Number(action) >= 12) { await fail('Movimiento inválido.'); return true; }
    const n=Number(action);
    if (g.matched.has(n) || g.revealed.includes(n)) { await fail('Esa carta ya está descubierta.'); return true; }
    if (g.revealed.length === 2) g.revealed=[];
    g.revealed.push(n); g.expires=now+TTL;
    if(g.revealed.length===2 && g.cards[g.revealed[0]]===g.cards[g.revealed[1]]) {g.revealed.forEach(i=>g.matched.add(i));g.revealed=[];}
    if(g.matched.size===12) {games.delete(id);await interaction.update({content:'🎉 ¡Encontraste las seis parejas!',embeds:[],components:[],allowedMentions:{parse:[]}});return true;}
    await interaction.update(payload(g)); return true;
  }
  if (g.kind === 'findemoji') {
    if (interaction.user.id !== g.players[0]) { await fail('Solo quien inició el juego puede responder.'); return true; }
    if (!/^[0-8]$/.test(action)) { await fail('Movimiento inválido.'); return true; }
    const correct=Number(action)===g.answer;
    games.delete(id);
    await interaction.update({content:correct?'🎉 ¡Lo encontraste!':'❌ No era ese. Inicia otra partida para intentarlo de nuevo.',embeds:[],components:[],allowedMentions:{parse:[]}}); return true;
  }
  if (g.phase === 'invite') {
    if (interaction.user.id !== g.players[1]) { await fail('Solo la persona invitada puede responder.'); return true; }
    if (action === 'decline') { games.delete(id); await interaction.update({content:'Invitación rechazada.',embeds:[],components:[],allowedMentions:{parse:[]}}); return true; }
    if (action !== 'accept') { await fail('Acción inválida.'); return true; }
    g.phase='playing'; g.expires=now+TTL; await interaction.update(payload(g)); return true;
  }
  if (interaction.user.id !== g.players[g.turn]) { await fail('No es tu turno.'); return true; }
  if (!/^\d+$/.test(action)) { await fail('Movimiento inválido.'); return true; }
  const n=Number(action), w=g.kind==='tictactoe'?3:7, h=g.kind==='tictactoe'?3:6;
  let x,y;
  if (g.kind==='tictactoe') { if (n<0||n>=9||g.cells[n]) { await fail('Esa casilla no está disponible.'); return true; } x=n%3; y=Math.floor(n/3); }
  else { if(n<0||n>=7) { await fail('Columna inválida.'); return true; } x=n; y=h-1; while(y>=0&&g.cells[y*w+x]) y--; if(y<0) { await fail('Esa columna está llena.'); return true; } }
  const mark=g.turn+1; g.cells[y*w+x]=mark; g.expires=now+TTL;
  let note='';
  if (wins(g.cells,w,h,x,y,mark,g.kind==='tictactoe'?3:4)) note=`¡Ganó ${mention(g.players[g.turn])}! 🎉`;
  else if (g.cells.every(Boolean)) note='¡Empate!';
  if (note) { g.phase='finished'; games.delete(id); } else g.turn=1-g.turn;
  await interaction.update(payload(g,note)); return true;
}
module.exports = { create, handle, wins, _games: games, TTL };
