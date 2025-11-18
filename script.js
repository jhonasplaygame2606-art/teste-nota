// Runner Cube — avançado com skins, moedas, sons, menu, animações
// Desenvolvido para rodar em Canvas 2D (leve e compatível com GitHub Pages)

/* --------------- CONFIG --------------- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

/* --------------- UI ELEMENTS --------------- */
const menu = document.getElementById('menu');
const startBtn = document.getElementById('startBtn');
const toggleSoundBtn = document.getElementById('toggleSound');
const skinsContainer = document.getElementById('skins');
const uiLast = document.getElementById('uiLast');
const uiBest = document.getElementById('uiBest');

const hudScore = document.getElementById('score');
const hudCoins = document.getElementById('coins') || null;
const hudSpd = document.getElementById('spd') || null;

const gameOverPanel = document.getElementById('gameOver');
const retryBtn = document.getElementById('retryBtn');
const menuBtn = document.getElementById('menuBtn');
const finalScore = document.getElementById('finalScore');
const finalCoins = document.getElementById('finalCoins');
const lastView = document.getElementById('lastView');
const bestView = document.getElementById('bestView');

/* --------------- STORAGE --------------- */
const LAST_KEY = 'runner_last';
const BEST_KEY = 'runner_best';
const SKIN_KEY = 'runner_skin';
const SOUND_KEY = 'runner_sound';

function saveLast(v){ localStorage.setItem(LAST_KEY, String(v)); }
function saveBest(v){ localStorage.setItem(BEST_KEY, String(v)); }
function getLast(){ return Number(localStorage.getItem(LAST_KEY) || 0); }
function getBest(){ return Number(localStorage.getItem(BEST_KEY) || 0); }
function saveSkin(i){ localStorage.setItem(SKIN_KEY, String(i)); }
function getSkin(){ return Number(localStorage.getItem(SKIN_KEY) || 0); }
function saveSound(b){ localStorage.setItem(SOUND_KEY, b ? '1' : '0'); }
function getSound(){ return localStorage.getItem(SOUND_KEY) !== '0'; }

/* --------------- AUDIO (WebAudio simple effects) --------------- */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let SOUND_ON = getSound();

function playBeep(freq=440, time=0.08, type='sine', gain=0.06){
  if(!SOUND_ON) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, audioCtx.currentTime);
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + time);
}

function playCoin(){
  if(!SOUND_ON) return;
  // short arpeggio
  playBeep(880,0.06,'sine',0.07);
  setTimeout(()=> playBeep(1100,0.05,'sine',0.06),60);
}

/* --------------- SKINS --------------- */
const SKINS = [
  {name:'Ciano', color:'#22c1c3'},
  {name:'Roxo', color:'#8b5cf6'},
  {name:'Laranja', color:'#ff7a18'},
  {name:'Verde', color:'#16a34a'},
  {name:'Preto', color:'#333333'}
];

let selectedSkin = getSkin();
if(selectedSkin < 0 || selectedSkin >= SKINS.length) selectedSkin = 0;

/* render skins buttons */
function buildSkins(){
  skinsContainer.innerHTML = '';
  SKINS.forEach((s, i)=>{
    const el = document.createElement('div');
    el.className = 'skin' + (i===selectedSkin ? ' selected' : '');
    el.title = s.name;
    el.style.background = s.color;
    el.onclick = () => {
      selectedSkin = i;
      saveSkin(i);
      buildSkins();
      playBeep(520,0.06);
    };
    skinsContainer.appendChild(el);
  });
}
buildSkins();

/* --------------- GAME STATE --------------- */
let gameStarted = false;
let gameOver = false;

let score = 0;
let coinsCollected = 0;

/* lanes (x positions) */
function laneX(idx){
  // center near middle of screen
  const center = canvas.width/2;
  const spacing = Math.min(160, canvas.width * 0.12);
  return center + (idx-1) * spacing;
}

/* player */
const PLAYER = {
  lane: 1, // 0 left,1 mid,2 right
  x: laneX(1),
  y: canvas.height - 180,
  size: 64,
  vy: 0,
  jumping: false
};

/* obstacles and coins arrays */
let obstacles = []; // {lane, y, size}
let coins = [];     // {lane, y, size, wobble}

/* spawn control */
let spawnTimer = 0;
let spawnInterval = 1.2; // seconds

/* speed control */
let baseSpeed = 200; // pixels/second forward (player moves up the screen visually)
let speedMultiplier = 1.0;
let timeSinceStart = 0;

/* --------------- HUD initial values --------------- */
uiLast.innerText = getLast();
uiBest.innerText = getBest();
if(hudScore) hudScore.innerText = '0';
if(hudCoins) hudCoins.innerText = '0';
if(hudSpd) hudSpd.innerText = '1.0x';
toggleSoundBtn.textContent = SOUND_ON ? 'ON' : 'OFF';

/* --------------- UTILS --------------- */
function rand(min,max){ return Math.random()*(max-min)+min; }

/* --------------- INPUT --------------- */
window.addEventListener('keydown', (e) => {
  // Start / restart with Space
  if(e.code === 'Space'){
    if(!gameStarted){
      startGame();
      return;
    }
    if(gameOver){
      restart();
      return;
    }
    // else attempt jump
    if(!PLAYER.jumping) jump();
    return;
  }

  // left/right arrows move lanes only when running
  if(!gameStarted || gameOver) return;
  if(e.code === 'ArrowLeft'){
    if(PLAYER.lane > 0){ PLAYER.lane--; moveToLane(); playBeep(400,0.04); }
  } else if(e.code === 'ArrowRight'){
    if(PLAYER.lane < 2){ PLAYER.lane++; moveToLane(); playBeep(540,0.04); }
  }
});

/* mouse / button handlers */
startBtn.onclick = startGame;
toggleSoundBtn.onclick = () => {
  SOUND_ON = !SOUND_ON;
  saveSound(SOUND_ON);
  toggleSoundBtn.textContent = SOUND_ON ? 'ON' : 'OFF';
  playBeep(440,0.06);
};
retryBtn.onclick = restart;
menuBtn.onclick = showMenu;

/* lane movement smoothing */
let laneTween = null;
function moveToLane(){
  const targetX = laneX(PLAYER.lane);
  const startX = PLAYER.x;
  const dur = 120; // ms
  const t0 = performance.now();
  laneTween = function frame(){
    const t = (performance.now()-t0)/dur;
    if(t < 1){
      PLAYER.x = startX + (targetX-startX) * easeOutCubic(t);
      requestAnimationFrame(laneTween);
    } else {
      PLAYER.x = targetX;
      laneTween = null;
    }
  };
  laneTween();
}

/* easing */
function easeOutCubic(t){ return 1 - Math.pow(1-t,3); }

/* jump */
function jump(){
  if(PLAYER.jumping) return;
  PLAYER.jumping = true;
  PLAYER.vy = -12;
  playBeep(720,0.09,'triangle',0.06);
}

/* --------------- SPAWN logic --------------- */
function spawnObstacleOrCoin(){
  // decide coin or obstacle
  const r = Math.random();
  if(r < 0.28){
    // spawn coin (higher chance)
    const lane = Math.floor(Math.random()*3);
    const size = 28;
    coins.push({lane, y: -60, size, wobble: Math.random()*Math.PI});
  } else {
    const lane = Math.floor(Math.random()*3);
    const size = rand(48,92);
    obstacles.push({lane, y: -80, size});
  }
}

/* --------------- COLLISIONS --------------- */
function checkCollisions(){
  // obstacles
  for(let i=obstacles.length-1;i>=0;i--){
    const o = obstacles[i];
    const dx = Math.abs(laneX(o.lane) - PLAYER.x);
    const dy = o.y - PLAYER.y;
    if(dx < (o.size/2 + PLAYER.size/2 - 8) && Math.abs(dy) < 20 && PLAYER.y > (canvas.height - 250) - 10 && !PLAYER.jumping){
      // collided (player on ground)
      onDeath();
      return;
    }
    // handle passing obstacle (if it passes player, grant points)
    if(o.y > canvas.height + 60){
      obstacles.splice(i,1);
      score += 5;
    }
  }

  // coins
  for(let i=coins.length-1;i>=0;i--){
    const c = coins[i];
    const dx = Math.abs(laneX(c.lane) - PLAYER.x);
    const dy = c.y - PLAYER.y;
    if(dx < 36 && Math.abs(dy) < 40){
      coins.splice(i,1);
      coinsCollected++;
      score += 10;
      playCoin();
    } else if(c.y > canvas.height + 40){
      coins.splice(i,1);
    }
  }
}

/* --------------- DEATH / RESTART --------------- */
function onDeath(){
  gameOver = true;
  gameStarted = false;
  playBeep(120,0.2,'sawtooth',0.08);
  // save last and best
  saveLast(score);
  const best = getBest();
  if(score > best) saveBest(score);
  // update UI panels
  finalScore.innerText = score;
  finalCoins.innerText = coinsCollected;
  lastView.innerText = getLast();
  bestView.innerText = getBest();
  uiLast.innerText = getLast();
  uiBest.innerText = getBest();
  // show panel
  gameOverPanel.classList.remove('hidden');
}

/* restart (from game over) */
function restart(){
  // reset variables
  obstacles = [];
  coins = [];
  PLAYER.lane = 1;
  PLAYER.x = laneX(1);
  PLAYER.y = canvas.height - 180;
  PLAYER.vy = 0;
  PLAYER.jumping = false;
  score = 0;
  coinsCollected = 0;
  spawnTimer = 0;
  timeSinceStart = 0;
  spawnInterval = 1.2;
  speedMultiplier = 1.0;
  gameOverPanel.classList.add('hidden');
  gameOver = false;
  startGame();
}

/* show menu */
function showMenu(){
  menu.classList.remove('hidden');
  gameOverPanel.classList.add('hidden');
}

/* start game */
function startGame(){
  if(!audioCtx) return;
  // resume audio context if suspended (user gesture)
  if(audioCtx.state === 'suspended') audioCtx.resume();
  menu.classList.add('hidden');
  gameOverPanel.classList.add('hidden');
  gameStarted = true;
  gameOver = false;
  timeSinceStart = 0;
  spawnTimer = 0;
  score = 0;
  coinsCollected = 0;
  PLAYER.lane = getSkinStartLane();
  PLAYER.x = laneX(PLAYER.lane);
  playBeep(660,0.08,'sine',0.08);
}

/* small helper: choose starting lane by skin index (just variety) */
function getSkinStartLane(){
  const s = getSkin();
  return s % 3;
}

/* --------------- MAIN LOOP --------------- */
let lastTime = performance.now();
function loop(now){
  const dt = Math.min(0.06, (now - lastTime) / 1000); // cap dt
  lastTime = now;

  if(gameStarted && !gameOver){
    timeSinceStart += dt;
    // speed increases with time
    speedMultiplier = 1 + Math.min(1.8, timeSinceStart / 30); // up to ~2.8x
    // spawn interval decreases slightly
    spawnInterval = Math.max(0.55, 1.2 - timeSinceStart * 0.01);

    // advance spawns
    spawnTimer += dt;
    if(spawnTimer > spawnInterval){
      spawnTimer = 0;
      spawnObstacleOrCoin();
    }

    // move obstacles & coins : since we simulate player moving "forward",
    // obstacles/coins increase y (coming down the screen)
    const dy = baseSpeed * speedMultiplier * dt;
    obstacles.forEach(o => o.y += dy);
    coins.forEach(c => { c.y += dy; c.wobble += dt*6; });

    // gravity update for player (jump)
    if(PLAYER.jumping){
      PLAYER.vy += 30 * dt; // gravity
      PLAYER.y += PLAYER.vy;
      if(PLAYER.y >= canvas.height - 180){
        PLAYER.y = canvas.height - 180;
        PLAYER.jumping = false;
        PLAYER.vy = 0;
      }
    }

    // collisions
    checkCollisions();

    // score slowly increases with distance
    score += Math.floor(10 * dt * speedMultiplier);
  }

  // update HUD
  hudScore.innerText = Math.max(0, score);
  hudCoins.innerText = coinsCollected;
  hudSpd.innerText = speedMultiplier.toFixed(2) + 'x';

  // draw frame
  renderFrame();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* --------------- RENDERING --------------- */
function renderFrame(){
  // clear
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // background gradient
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#07121a');
  g.addColorStop(1,'#08151b');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw track (three lanes)
  const center = canvas.width/2;
  const spacing = Math.min(160, canvas.width * 0.12);
  const laneW = spacing*0.9;
  for(let i=0;i<3;i++){
    const x = center + (i-1)*spacing;
    // lane background
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(x - laneW/2, 0, laneW, canvas.height);
    // lane separators
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    ctx.moveTo(x + laneW/2,0); ctx.lineTo(x + laneW/2,canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - laneW/2,0); ctx.lineTo(x - laneW/2,canvas.height);
    ctx.stroke();
  }

  // draw coins (behind player to appear ahead)
  coins.forEach(c => {
    const x = laneX(c.lane);
    const y = c.y;
    // small wobble animation
    const r = c.size/2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(c.wobble)*0.25);
    // coin body
    ctx.fillStyle = '#ffdb4d';
    ctx.beginPath(); ctx.ellipse(0,0,r,r*0.9,0,0,Math.PI*2); ctx.fill();
    // shine
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-r*0.2,-r*0.3,r*0.15,r*0.08,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // draw obstacles
  obstacles.forEach(o => {
    const x = laneX(o.lane);
    const y = o.y;
    const s = o.size;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x - s/2 - 2, y + s/2 + 6, s + 4, 6);
    // block
    ctx.fillStyle = '#ff6b6b';
    roundRect(ctx, x - s/2, y - s/2, s, s, 8, true, false);
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x - s/2 + 6, y - s/2 + 6, Math.max(6, s*0.12), Math.max(6, s*0.12));
  });

  // draw player (top)
  const px = PLAYER.x;
  const py = PLAYER.y;
  const s = PLAYER.size;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(px, py + s/2 + 8, s*0.7, 8, 0,0,Math.PI*2); ctx.fill();

  // cube body (with skin)
  ctx.fillStyle = SKINS[selectedSkin].color;
  roundRect(ctx, px - s/2, py - s/2, s, s, 10, true, false);

  // simple face / trim
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(px - s/2 + 8, py - s/2 + 8, s - 16, 8);
}

/* rounded rectangle util */
function roundRect(ctx,x,y,w,h,r,fill,stroke){
  if(typeof r === 'undefined') r=5;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

/* --------------- INITIALIZE & UI wiring --------------- */
function initUI(){
  // fill UI skins
  buildSkins();
  // show last & best
  uiLast.innerText = getLast();
  uiBest.innerText = getBest();
  // set sound button label done earlier
}
initUI();

/* --------------- Save last score on window unload (safety) --------------- */
window.addEventListener('beforeunload', ()=>{
  if(score>0) saveLast(score);
});

/* --------------- Helper: expose HUD elements (if present) --------------- */
(function bindHud(){
  const s = document.getElementById('score');
  const c = document.getElementById('coins');
  const sp = document.getElementById('spd');
  if(s) hudScore = s;
  if(c) hudCoins = c;
  if(sp) hudSpd = sp;
})();

/* --------------- minor tweak: allow clicking skins in menu after load --------------- */
skinsContainer.addEventListener('click', ()=>{ /* handled in buildSkins */ });

/* --------------- finalize start: allow clicking Start to open audio context --------------- */
document.body.addEventListener('click', ()=> {
  if(audioCtx.state === 'suspended') audioCtx.resume();
}, {once:true});
