// game.js — Void Runner v3 (full retention systems)
// Features: skins, streak, missions, ghost run, 2× ON FIRE multiplier,
//           sector names, new-best celebration, daily challenge, score context

import { Ship }           from './engine/ship.js';
import { MeteorManager }  from './engine/meteors.js';
import { ParticleSystem } from './engine/particles.js';
import { StarField }      from './engine/starfield.js';
import { AudioManager }   from './audio/audio.js';
import { StorageUtils }   from './storage/storage.js';
import { initializeApp }  from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAnalytics, logEvent as _fbLog } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js';

const _fbApp = initializeApp({
  apiKey:            'AIzaSyC6gTi5XM68cOTPKYsjhnpdInPa3NpmW-M',
  authDomain:        'arcadeflash-74cff.firebaseapp.com',
  projectId:         'arcadeflash-74cff',
  storageBucket:     'arcadeflash-74cff.firebasestorage.app',
  messagingSenderId: '543521880447',
  appId:             '1:543521880447:web:afe50c400b205ceedbc24a',
  measurementId:     'G-DYWD0ZL148',
});
const _fbAnalytics = getAnalytics(_fbApp);

// ── CRASH HANDLER ─────────────────────────────────────────────────
window.onerror = function (msg, src, line, col, err) {
  if (window.Sentry) Sentry.captureException(err || new Error(msg));
  document.getElementById('error-screen').style.display = 'flex';
};

// ── CANVAS ────────────────────────────────────────────────────────
const cv  = document.getElementById('cv');
const ctx = cv.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);

let W, H;
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  cv.width  = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.scale(DPR, DPR);
  if (stars) stars.resize(W, H);
}
window.addEventListener('resize', resize);

// ── SECTOR NAMES ─────────────────────────────────────────────────
// Every 15 score points = 1 sector. Names give meaning to the number.
const SECTOR_NAMES = [
  'TRAINING ZONE',   // 1  (0-14)
  'DEEP ORBIT',      // 2  (15-29)
  'ASTEROID BELT',   // 3  (30-44)
  'METEOR STORM',    // 4  (45-59)
  'VOID ZONE',       // 5  (60-74)
  'CHAOS FIELD',     // 6  (75-89)
  'DANGER CORE',     // 7  (90-104)
  'CRITICAL MASS',   // 8  (105-119)
  'ULTRA CHAOS',     // 9  (120+)
];
function getSectorNum(s) { return Math.floor(s / 15) + 1; }
function getSectorName(s) { return SECTOR_NAMES[Math.min(Math.floor(s/15), SECTOR_NAMES.length-1)]; }

// ── SKILL GRADE ───────────────────────────────────────────────────
function getSkillGrade(s) {
  if (s >= 120) return 'SS';
  if (s >= 80)  return 'S';
  if (s >= 50)  return 'A';
  if (s >= 30)  return 'B';
  if (s >= 15)  return 'C';
  return 'D';
}
function getSkillGradeColor(g) {
  return { SS:'#FFD700', S:'#FF8020', A:'#FF4444', B:'#00FFC8', C:'#60D8FF', D:'rgba(200,220,240,0.72)' }[g];
}

// ── METEOR WAVE EVENTS ────────────────────────────────────────────
const _waveTriggered = new Set();

function checkWaveEvents(s) {
  for (const ws of [20, 40, 70]) {
    if (s >= ws && !_waveTriggered.has(ws)) {
      _waveTriggered.add(ws);
      _spawnMeteorWave(ws);
    }
  }
}

function _spawnMeteorWave(atScore) {
  // 4 of 5 columns — one random gap gives a survivable path
  const cols = [0.15, 0.30, 0.50, 0.70, 0.85];
  const gap  = Math.floor(Math.random() * cols.length);
  cols.forEach((cx, i) => {
    if (i === gap) return;
    const delay = i * 160; // staggered 160 ms apart
    setTimeout(() => {
      if (meteors && state === 'playing') meteors._spawnWaveMeteor(cx * W, atScore);
    }, delay);
  });
  sectorBannerText  = '⚠ METEOR WAVE';
  sectorBannerTimer = 1.6;
  doFlash('rgba(255,80,0,0.18)', 400);
  audio.meteorWarn();
}

// ── SKIN METADATA ────────────────────────────────────────────────
const SKIN_UNLOCKS = { fire:25, neon:50, shadow:100, chaos:200 };
const SKIN_LABELS  = { default:'DEFAULT', fire:'FIRE', neon:'NEON', shadow:'SHADOW', chaos:'CHAOS' };
const SKIN_COLORS  = { default:'#00D4FF', fire:'#FF6600', neon:'#FF00FF', shadow:'#4444AA', chaos:'#FF0000' };

// ── MISSIONS ─────────────────────────────────────────────────────
const MISSION_DEFS = [
  { id:'score10',  name:'First Orbit',     desc:'Score 10 meteors',           check:(r)=>r.score >= 10 },
  { id:'score25',  name:'Pilot',           desc:'Score 25 meteors',           check:(r)=>r.score >= 25 },
  { id:'close5',   name:'Daredevil',       desc:'5 close calls in one run',   check:(r)=>r.closeCalls >= 5 },
  { id:'gold1',    name:'Gold Rush',       desc:'Dodge a gold meteor',        check:(r)=>r.goldDodged >= 1 },
  { id:'onfire1',  name:'ON FIRE!',        desc:'Achieve ON FIRE combo',      check:(r)=>r.onFireAchieved },
  { id:'insane1',  name:'Insane Pilot',    desc:'Get an INSANE!! near-miss',  check:(r)=>r.insaneCount >= 1 },
  { id:'score50',  name:'Veteran',         desc:'Score 50 meteors',           check:(r)=>r.score >= 50 },
  { id:'time60',   name:'Survivor',        desc:'Survive 60 seconds',         check:(r)=>r.duration >= 60 },
  { id:'score100', name:'Elite',           desc:'Score 100 meteors',          check:(r)=>r.score >= 100 },
  { id:'streak3',  name:'Regular Pilot',   desc:'3-day play streak',          check:(r)=>r.streak >= 3 },
];

// ── SUBSYSTEMS ────────────────────────────────────────────────────
const audio   = new AudioManager();
const storage = StorageUtils;
let stars, ship, meteors, particles;

// ── GAME STATE ────────────────────────────────────────────────────
let state        = 'idle';
let score        = 0;
let best         = 0;
let sessionStart = 0;
let lastTs       = 0;
let T            = 0;
let deathPending = false;

// Near-miss
let nearMissSlowTimer = 0;
let nearMissText      = '';
let nearMissTimer     = 0;
let nearMissColor     = '#00FFC8';
let nearMissCount     = 0;

// Shake
let shakeTimer = 0;
let shakeAmt   = 0;

// Sector / milestone
let lastSector        = 1;
let sectorBannerText  = '';
let sectorBannerTimer = 0;
const MILESTONES      = [25, 50, 75, 100, 150];
let shownMilestones   = new Set();
let chaosMode         = false;

// ON FIRE combo
let nearMissCombo   = 0;
let comboTimer      = 0;
let onFire          = false;
let scoreMultiplier = 1;

// New-best celebration
let celebrating     = false;
let newRecordTimer  = 0;

// Floating text
const _floaters = [];

// Ghost run recording & playback
let ghostRecord = [];  // positions recorded this run
let ghostBest   = null;
let ghostFrame  = 0;
let ghostStep   = 0;

// Session mission stats
let sessionGold         = 0;
let sessionInsane       = 0;
let sessionOnFireAchieved = false;

// Streak & skin
let currentStreak = 0;
let activeSkin    = 'default';

// Score multiplier UI timer
let multiBannerTimer = 0;

// Mute
let audioMuted = false;

// Thrust edge detection
let _lastThrustUp = false;

// ── INPUT ─────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault();
  if (state === 'idle' || state === 'dead') { audio.init(); startGame(); return; }
  keys[e.code] = true;
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

let touchZone = { left:false, right:false, up:false };
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); audio.init();
  if (state === 'idle' || state === 'dead') { startGame(); return; }
  _updateTouchZone(e);
});
cv.addEventListener('pointermove',   e => { if (e.buttons > 0) _updateTouchZone(e); });
cv.addEventListener('pointerup',     ()  => _clearTouchZone());
cv.addEventListener('pointercancel', ()  => _clearTouchZone());

const btnPlay = document.getElementById('btn-play');
if (btnPlay) btnPlay.onclick = () => { audio.init(); startGame(); };

document.getElementById('overlay').addEventListener('pointerdown', e => {
  if (state === 'idle' && !e.target.closest('#btn-play') && !e.target.closest('.skin-btn') && !e.target.closest('#btn-daily')) {
    audio.init(); startGame();
  }
});

function _updateTouchZone(e) {
  const px = e.clientX / W, py = e.clientY / H;
  touchZone.left  = px < 0.35;
  touchZone.right = px > 0.65;
  touchZone.up    = py < 0.50;
}
function _clearTouchZone() { touchZone = { left:false, right:false, up:false }; }

// ── SKIN SELECTOR ─────────────────────────────────────────────────
function initSkinSelector() {
  const row = document.getElementById('skin-row');
  if (!row) return;
  const unlocked = storage.getUnlockedSkins();
  activeSkin = storage.getActiveSkin();
  row.innerHTML = '';
  ['default','fire','neon','shadow','chaos'].forEach(id => {
    const isUnlocked = unlocked.includes(id);
    const reqScore   = SKIN_UNLOCKS[id];
    const btn = document.createElement('button');
    btn.className   = `skin-btn ${!isUnlocked ? 'locked' : ''} ${activeSkin === id ? 'active' : ''}`;
    btn.dataset.skin = id;
    btn.style.setProperty('--sc', SKIN_COLORS[id]);
    btn.title = isUnlocked ? SKIN_LABELS[id] : `Unlock at score ${reqScore}`;
    btn.innerHTML = isUnlocked
      ? `<span class="skin-dot-icon">●</span><span class="skin-name">${SKIN_LABELS[id]}</span>`
      : `<span class="skin-dot-icon">🔒</span><span class="skin-name">${reqScore}</span>`;
    if (isUnlocked) {
      btn.addEventListener('click', () => selectSkin(id));
    }
    row.appendChild(btn);
  });
  // Next unlock hint
  const nextHint = document.getElementById('next-unlock-hint');
  if (nextHint) {
    const nxt = Object.entries(SKIN_UNLOCKS).find(([id]) => !unlocked.includes(id));
    nextHint.textContent = nxt ? `Next: ${SKIN_LABELS[nxt[0]]} skin unlocks at score ${nxt[1]}` : '✦ All skins unlocked!';
  }
}

function selectSkin(id) {
  activeSkin = id;
  storage.setActiveSkin(id);
  if (ship) ship.skinId = id;
  initSkinSelector(); // refresh UI
}

function checkSkinUnlocks(score) {
  const unlocked = storage.getUnlockedSkins();
  Object.entries(SKIN_UNLOCKS).forEach(([id, req]) => {
    if (score >= req && !unlocked.includes(id)) {
      storage.unlockSkin(id);
      toast(`🛸 UNLOCKED: ${SKIN_LABELS[id]} SKIN!`);
      doFlash('rgba(255,200,0,0.28)', 600);
      initSkinSelector();
    }
  });
}

// ── START GAME ────────────────────────────────────────────────────
function startGame() {
  score = 0; deathPending = false;
  sessionStart = performance.now();
  nearMissSlowTimer = 0; shakeTimer = 0;
  _lastThrustUp = false;
  nearMissCount = 0; lastSector = 1;
  chaosMode = false; shownMilestones = new Set();
  _waveTriggered.clear();
  _floaters.length = 0;
  sectorBannerText = ''; sectorBannerTimer = 0;
  nearMissCombo = 0; comboTimer = 0; onFire = false;
  scoreMultiplier = 1; multiBannerTimer = 0;
  celebrating = false; newRecordTimer = 0;
  sessionGold = 0; sessionInsane = 0; sessionOnFireAchieved = false;
  ghostRecord = []; ghostFrame = 0; ghostStep = 0;
  ghostBest = storage.getGhostPath();

  best = storage.getBest();
  currentStreak = storage.updateStreak();
  activeSkin = storage.getActiveSkin();

  if (!stars)     stars     = new StarField(W, H);
  if (!particles) particles = new ParticleSystem(200);
  else            particles.reset();

  ship    = new Ship(W * 0.22, H * 0.5, W, H);
  ship.skinId = activeSkin;
  meteors = new MeteorManager(W, H);

  storage.incrementSession();
  storage.recordFirstVisit();

  audio.startAmbient();
  audio.startEngineHum();
  audio.startMusic();

  trackEvent('game_start', { session_number: storage.getSessionCount() });
  showGame();
  state = 'playing';
}

// ── GAME LOOP ─────────────────────────────────────────────────────
function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts; T += dt;

  ctx.clearRect(0, 0, W, H);
  drawBackground();
  if (stars) stars.draw(ctx, T);

  const playing = state === 'playing';
  const dying   = state === 'dying';
  const idle    = state === 'idle';

  if (idle && ship) ship.animateIdle(dt, T);

  if (playing) {
    const thrustUp = keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || touchZone.up;
    const goLeft   = keys['ArrowLeft']  || keys['KeyA'] || touchZone.left;
    const goRight  = keys['ArrowRight'] || keys['KeyD'] || touchZone.right;
    const goDown   = keys['ArrowDown']  || keys['KeyS'];

    if (thrustUp && !_lastThrustUp) audio.thrust();
    _lastThrustUp = thrustUp;

    if (ship) audio.setEngineHum(ship.thrustGlow);
    if (thrustUp && particles && Math.random() < 0.20) {
      particles.thrustBurst(ship.x, ship.y + ship.r * 0.85, 1);
    }
    audio.setSpeedPitch(score);

    // ON FIRE combo decay
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        nearMissCombo = 0; onFire = false;
        if (scoreMultiplier > 1) { scoreMultiplier = 1; multiBannerTimer = 0; }
      }
    }
    if (ship) ship.onFire = onFire;

    // Ghost recording ~20fps
    ghostFrame++;
    if (ghostFrame % 3 === 0 && ship) {
      ghostRecord.push({ x: Math.round(ship.x), y: Math.round(ship.y) });
    }

    // UFO dynamic scale: grows 0.80→1.75 as score → 50 (bidirectional trigger)
    const powerLevel = Math.min(score / 50, 1.0);
    ship.drawScale   = 0.80 + 0.95 * powerLevel;
    ship.powerLevel  = powerLevel;

    const timeScale = nearMissSlowTimer > 0 ? 0.30 : 1.0;
    nearMissSlowTimer = Math.max(0, nearMissSlowTimer - dt);
    const scaledDt = dt * timeScale;

    ship.update(scaledDt, thrustUp, goLeft, goRight, goDown);
    meteors.update(scaledDt, score);

    if (meteors.checkCollision(ship.getBounds()) && !deathPending) startDeath();

    const nm = meteors.checkNearMiss(ship.getBounds());
    if (nm && !deathPending) handleNearMiss(nm);

    // ── SCORING ──────────────────────────────────────────────────
    const { gained, goldBonus } = meteors.checkScore(ship.x, ship.y);
    if (gained > 0) {
      const raw = gained + goldBonus;
      score += raw * scoreMultiplier;

      if (goldBonus > 0) {
        sessionGold++;
        audio.goldDodge();
        doFlash('rgba(255,220,50,0.28)', 400);
        showFloatingText(`+${raw * scoreMultiplier}`, ship.x, ship.y - ship.r * 2.2, '#FFD700');
      } else if (scoreMultiplier > 1) {
        showFloatingText(`×${scoreMultiplier}`, ship.x + ship.r * 1.5, ship.y - ship.r * 1.5, '#FF8020');
      }
      audio.scoreTick();

      // Sector transition
      const curSector = getSectorNum(score);
      if (curSector > lastSector) {
        lastSector = curSector;
        audio.sectorUp(curSector);
        doFlash('rgba(100,200,255,0.20)', 700);
        triggerShake(2, 0.14);
        sectorBannerText  = `SECTOR ${curSector} — ${getSectorName(score)}`;
        sectorBannerTimer = 2.2;
      }

      // Bidirectional trigger at score 50 (UFO at full power)
      if (score >= 50 && !chaosMode) {
        chaosMode = true;
        doFlash('rgba(255,30,0,0.42)', 1200);
        triggerShake(5, 0.45);
        sectorBannerText  = '⚠ FULL POWER — ALL SIDES';
        sectorBannerTimer = 2.8;
        audio.milestone();
        if (navigator.vibrate) navigator.vibrate([30, 50, 100]);
      }

      // Score milestones
      for (const ms of MILESTONES) {
        if (score >= ms && !shownMilestones.has(ms)) {
          shownMilestones.add(ms);
          if (ms < 50) audio.milestone();
          doFlash('rgba(255,200,60,0.22)', 500);
          toast(`✦ ${ms} METEORS — ${getSectorName(ms)}`);
        }
      }

      checkSkinUnlocks(score);
      checkWaveEvents(score);
      updateHUD();
    }

    if (meteors.hasNewWarning()) audio.meteorWarn();

    // Multiplier banner
    if (multiBannerTimer > 0) multiBannerTimer -= dt;

    if (shakeTimer > 0) {
      shakeTimer -= dt;
      const s = shakeAmt * (shakeTimer > 0 ? 1 : 0);
      cv.style.transform = `translate(${(Math.random()-0.5)*s}px,${(Math.random()-0.5)*s}px)`;
    } else {
      cv.style.transform = 'none';
    }

    particles.update(dt);
  } else if (dying) {
    particles.update(dt);
  }

  // ── DRAW ──────────────────────────────────────────────────────
  if (meteors)   meteors.draw(ctx, score, T);
  drawGhost();
  if (ship)      ship.draw(ctx, T);
  if (particles) particles.draw(ctx);

  drawNearMissText(dt);
  drawSectorBanner(dt);
  drawFloatingTexts(dt);
  drawNewRecord(dt);
  updateHUD();

  requestAnimationFrame(loop);
}

// ── GHOST RUN PLAYBACK ────────────────────────────────────────────
function drawGhost() {
  if (!ghostBest || ghostBest.length === 0 || state !== 'playing' || !ship) return;
  if (ghostStep >= ghostBest.length) return;
  const gp = ghostBest[ghostStep++];
  if (!gp) return;
  const r = ship.r * 0.88;

  ctx.save();
  // Outer glow so the ghost reads against the starfield
  ctx.globalAlpha = 0.14;
  const glow = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, r * 2.4);
  glow.addColorStop(0, 'rgba(180,230,255,1)');
  glow.addColorStop(1, 'rgba(80,140,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(gp.x, gp.y, r * 2.4, 0, Math.PI * 2); ctx.fill();

  // Filled saucer disc — clearly visible at 28% opacity
  ctx.globalAlpha = 0.28;
  const dg = ctx.createLinearGradient(gp.x, gp.y - r * 0.42, gp.x, gp.y + r * 0.42);
  dg.addColorStop(0, 'rgba(200,230,255,0.95)');
  dg.addColorStop(1, 'rgba(100,160,230,0.55)');
  ctx.fillStyle = dg;
  ctx.beginPath(); ctx.ellipse(gp.x, gp.y, r * 1.60, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();

  // Dome
  const domeg = ctx.createRadialGradient(gp.x, gp.y - r * 0.32, 0, gp.x, gp.y - r * 0.32, r * 0.84);
  domeg.addColorStop(0, 'rgba(220,245,255,0.80)');
  domeg.addColorStop(1, 'rgba(120,180,255,0.20)');
  ctx.fillStyle = domeg;
  ctx.beginPath(); ctx.ellipse(gp.x, gp.y - r * 0.32, r * 0.84, r * 0.56, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── NEW RECORD CELEBRATION ────────────────────────────────────────
function drawNewRecord(dt) {
  if (newRecordTimer <= 0) return;
  newRecordTimer -= dt;
  if (newRecordTimer <= 0) return;
  const prog = Math.min(1, newRecordTimer * 0.7);
  ctx.save();
  ctx.globalAlpha = prog;
  ctx.font        = `900 ${Math.round(36 + (1-prog)*10)}px 'Orbitron', monospace`;
  ctx.fillStyle   = '#FFD700';
  ctx.textAlign   = 'center';
  ctx.shadowColor = 'rgba(255,200,0,0.85)';
  ctx.shadowBlur  = 28;
  ctx.fillText('NEW RECORD!', W/2, H * 0.34);
  ctx.shadowBlur  = 0;
  ctx.font        = `400 14px 'Orbitron', monospace`;
  ctx.fillStyle   = 'rgba(255,220,100,0.78)';
  ctx.fillText(`${score} METEORS — PERSONAL BEST`, W/2, H * 0.34 + 38);
  ctx.textAlign   = 'left';
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── NEAR MISS ─────────────────────────────────────────────────────
function handleNearMiss(type) {
  audio.nearMiss(type);
  triggerShake(3, 0.18);
  nearMissSlowTimer = 0.4;
  nearMissColor = type === 'INSANE!!' ? '#F472B6' : type === 'PERFECT!' ? '#FFB800' : '#4ADE80';
  nearMissText  = type;
  nearMissTimer = 1.2;
  nearMissCount++;
  if (type === 'INSANE!!') { sessionInsane++; }
  particles.nearMissBurst(ship.x, ship.y, nearMissColor);
  if (navigator.vibrate) navigator.vibrate(25);

  // ON FIRE combo — 3 consecutive near-misses
  nearMissCombo++;
  comboTimer = 4.5;
  if (nearMissCombo >= 3 && !onFire) {
    onFire = true;
    scoreMultiplier = 2;
    sessionOnFireAchieved = true;
    multiBannerTimer = 3.0;
    sectorBannerText  = 'ON FIRE!  ×2 SCORE';
    sectorBannerTimer = 1.8;
    doFlash('rgba(255,100,0,0.30)', 600);
    audio.milestone();
  }
  if (type === 'INSANE!!') trackEvent('near_miss_insane', { score });
}

function drawNearMissText(dt) {
  if (nearMissTimer <= 0) return;
  nearMissTimer -= dt;
  if (nearMissTimer <= 0) { nearMissText = ''; return; }
  const a = Math.min(1, nearMissTimer);
  ctx.globalAlpha = a;
  ctx.font        = `900 ${Math.round(18 * (1 + (1-a) * 0.2))}px 'Orbitron', monospace`;
  ctx.fillStyle   = nearMissColor;
  ctx.textAlign   = 'center';
  ctx.fillText(nearMissText, W/2, H * 0.38);
  ctx.textAlign   = 'left';
  ctx.globalAlpha = 1;
}

// ── SECTOR BANNER ─────────────────────────────────────────────────
function drawSectorBanner(dt) {
  if (sectorBannerTimer <= 0) return;
  sectorBannerTimer -= dt;
  if (sectorBannerTimer <= 0) { sectorBannerText = ''; return; }
  const prog  = Math.min(1, sectorBannerTimer * 0.8);
  const isChaos = sectorBannerText.includes('CHAOS') || sectorBannerText.includes('FULL');
  const isFire  = sectorBannerText.includes('ON FIRE');
  ctx.save();
  ctx.globalAlpha = prog * 0.95;
  ctx.font        = `900 18px 'Orbitron', monospace`;
  ctx.fillStyle   = isChaos ? '#FF4444' : isFire ? '#FF8020' : '#60D8FF';
  ctx.textAlign   = 'center';
  ctx.shadowColor = isChaos ? 'rgba(255,50,0,0.85)' : isFire ? 'rgba(255,100,0,0.85)' : 'rgba(0,200,255,0.85)';
  ctx.shadowBlur  = 20;
  ctx.fillText(sectorBannerText, W/2, H * 0.28);
  ctx.shadowBlur  = 0;
  ctx.textAlign   = 'left';
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── FLOATING TEXT ─────────────────────────────────────────────────
function showFloatingText(text, x, y, color) {
  _floaters.push({ text, x, y, vy:-55, life:1.0, color });
}
function drawFloatingTexts(dt) {
  for (let i = _floaters.length - 1; i >= 0; i--) {
    const f = _floaters[i];
    f.y += f.vy * dt; f.vy *= 0.92; f.life -= dt;
    if (f.life <= 0) { _floaters.splice(i,1); continue; }
    const a = Math.min(1, f.life * 1.5);
    ctx.globalAlpha = a;
    ctx.font        = `900 14px 'Orbitron', monospace`;
    ctx.fillStyle   = f.color;
    ctx.textAlign   = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

// ── SCREEN SHAKE ──────────────────────────────────────────────────
function triggerShake(amount, duration) { shakeAmt = amount; shakeTimer = duration; }

// ── DEATH ─────────────────────────────────────────────────────────
function startDeath() {
  if (deathPending) return;
  deathPending = true;
  state = 'dying';

  audio.death();
  audio.stopAmbient();
  audio.stopEngineHum();
  audio.stopMusic();
  triggerShake(6, 0.30);
  particles.deathExplosion(ship.x, ship.y, ship.getColor());
  ship.kill();
  cv.style.transform = 'none';
  onFire = false; scoreMultiplier = 1;
  if (navigator.vibrate) navigator.vibrate([20, 40, 80]);

  const isNew = score > best;
  if (isNew) { best = score; storage.setBest(best); }

  const duration = Math.round((performance.now() - sessionStart) / 1000);
  trackEvent('game_over', { score, duration_seconds: duration });

  // Save ghost if new best
  if (isNew && ghostRecord.length > 0) {
    storage.setGhostPath(ghostRecord);
    storage.setGhostScore(score);
  }

  if (isNew && score > 5) {
    // Dramatic new-record celebration before death screen
    celebrating  = true;
    newRecordTimer = 2.0;
    doFlash('rgba(255,200,0,0.55)', 1400);
    triggerShake(4, 0.35);
    setTimeout(() => { celebrating = false; showDeath(isNew, duration); }, 2100);
  } else {
    setTimeout(() => showDeath(isNew, duration), 300);
  }
}

// ── SCREENS ───────────────────────────────────────────────────────
function showGame() {
  document.getElementById('overlay').classList.add('hid');
  document.getElementById('screen-idle').style.display  = 'none';
  document.getElementById('screen-death').style.display = 'none';
}

function showDeath(isNew, duration) {
  state = 'dead';
  const sector     = getSectorNum(score);
  const sectorName = getSectorName(score);

  document.getElementById('death-score').textContent        = score;
  document.getElementById('death-sector-label').textContent = `SECTOR ${sector} — ${sectorName}`;
  document.getElementById('stat-best').textContent          = best > 0 ? best : '—';
  document.getElementById('stat-closecalls').textContent    = nearMissCount;
  document.getElementById('stat-time').textContent          = duration + 's';
  document.getElementById('new-best-badge').style.display   = isNew ? 'block' : 'none';
  document.getElementById('death-motivation').textContent   = _getMotivation(score, best, nearMissCount);

  // Next milestone context
  const nextEl = document.getElementById('next-milestone');
  if (nextEl) {
    const nextMs = MILESTONES.find(m => m > score);
    if (nextMs) nextEl.textContent = `${nextMs - score} more to reach ${getSectorName(nextMs)}`;
    else nextEl.textContent = currentStreak > 1 ? `🔥 ${currentStreak}-day streak!` : '';
  }

  // Missions update
  const missionStats = {
    score, duration, closeCalls: nearMissCount, goldDodged: sessionGold,
    insaneCount: sessionInsane, onFireAchieved: sessionOnFireAchieved, streak: currentStreak,
  };
  renderMissions(missionStats);

  document.getElementById('btn-retry').onclick = () => startGame();
  document.getElementById('btn-share').onclick = () => shareScore(score, best, sector, duration);

  document.getElementById('overlay').classList.remove('hid');
  document.getElementById('screen-idle').style.display  = 'none';
  const deathEl = document.getElementById('screen-death');
  deathEl.style.display   = 'flex';
  deathEl.style.opacity   = '0';
  deathEl.style.transform = 'translateY(10px) scale(0.97)';
  setTimeout(() => {
    deathEl.style.transition = 'opacity 220ms ease, transform 220ms ease';
    deathEl.style.opacity    = '1';
    deathEl.style.transform  = 'translateY(0) scale(1)';
  }, 10);
}

function renderMissions(stats) {
  const list = document.getElementById('missions-list');
  if (!list) return;
  const done = storage.getCompletedMissions();
  // Show 3 active missions: first 3 incomplete, plus any just-completed
  const active = [];
  const justCompleted = [];
  for (const def of MISSION_DEFS) {
    if (done.includes(def.id)) continue;
    const completed = def.check(stats);
    if (completed) { storage.completeMission(def.id); justCompleted.push(def); }
    else active.push(def);
  }
  const toShow = [...justCompleted.slice(0,2), ...active].slice(0, 3);
  list.innerHTML = '';
  toShow.forEach(def => {
    const isJustDone = justCompleted.includes(def);
    const div = document.createElement('div');
    div.className = `mission-item ${isJustDone ? 'completed' : ''}`;

    const info = document.createElement('div');
    info.className = 'mission-info';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'mission-name';
    nameSpan.textContent = (isJustDone ? '✓ ' : '') + def.name;
    const descSpan = document.createElement('span');
    descSpan.className = 'mission-desc';
    descSpan.textContent = def.desc;
    info.appendChild(nameSpan);
    info.appendChild(descSpan);

    const stateSpan = document.createElement('span');
    stateSpan.className = 'mission-state';
    stateSpan.textContent = isJustDone ? 'DONE' : '';

    div.appendChild(info);
    div.appendChild(stateSpan);
    list.appendChild(div);
  });
  // If all missions done
  if (toShow.length === 0) {
    const p = document.createElement('p');
    p.className = 'all-done';
    p.textContent = '✦ All missions complete — Legend!';
    list.appendChild(p);
  }
}

function _getMotivation(s, b, closeCalls) {
  if (s === 0)                     return 'You never left the dock. One more try.';
  if (s === b && s > 0)            return `✦ New record! ${closeCalls > 2 ? closeCalls + ' close calls — you\'re dangerous.' : 'Keep climbing.'}`;
  if (b > 0 && s >= b-3 && s < b) return `${b - s} away from your best (${b}). One. More. Run.`;
  if (closeCalls >= 6)             return `${closeCalls} close calls. The void respects your nerve.`;
  if (s >= 100)                    return 'Beyond chaos. You\'ve entered legend territory.';
  if (s >= 50)                     return `${getSectorName(s)}. The UFO is at full power now.`;
  if (s >= 30)                     return 'You\'ve found your groove. Push through.';
  if (s >= 15)                     return 'Good start. Now go twice as far.';
  return 'The void is calling. One more run.';
}

// ── HUD ───────────────────────────────────────────────────────────
function updateHUD() {
  const elScore = document.getElementById('sc-score');
  if (!elScore) return;
  elScore.textContent = score;
  if (state === 'playing') {
    if      (score >= 75) elScore.className = 'danger';
    else if (score >= 50) elScore.className = 'warning';
    else if (score > 0 && score >= best) elScore.className = 'gold';
    else elScore.className = '';
  } else { elScore.className = ''; }

  document.getElementById('sc-best').textContent   = best > 0 ? best : '—';
  document.getElementById('sc-sector').textContent = getSectorNum(score);
  const sn = document.getElementById('sc-sector-name');
  if (sn) {
    const grade = getSkillGrade(score);
    sn.textContent = `RANK ${grade}`;
    sn.style.color = getSkillGradeColor(grade);
    sn.style.fontWeight = score >= 50 ? '700' : '400';
  }

  // Danger bar: count in-flight meteors → fill red bar
  const dangerFill = document.getElementById('danger-bar-fill');
  if (dangerFill && meteors) {
    const count = meteors.meteors.length;
    const pct   = Math.min(100, count * 12);
    dangerFill.style.width = pct + '%';
    dangerFill.style.background = pct > 72 ? '#FF2828' : pct > 44 ? '#FF8020' : '#00FFC8';
  }

  // Multiplier badge
  const mb = document.getElementById('sc-multi');
  if (mb) {
    mb.textContent     = scoreMultiplier > 1 ? `×${scoreMultiplier}` : '';
    mb.style.display   = scoreMultiplier > 1 ? 'block' : 'none';
  }
}

// ── BACKGROUND — cool→warm red as score rises ─────────────────────
function drawBackground() {
  const t   = Math.min(score / 80, 1.0);
  const top = `rgb(${Math.round(1+t*14)},${Math.round(8-t*7)},${Math.round(18-t*10)})`;
  const mid = `rgb(${Math.round(2+t*8)},${Math.round(13-t*9)},${Math.round(32-t*20)})`;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, top); grad.addColorStop(0.5, mid); grad.addColorStop(1, top);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ── FLASH / TOAST ─────────────────────────────────────────────────
function doFlash(color, duration) {
  const el = document.getElementById('flash');
  el.style.background = color; el.style.transition = 'none'; el.style.opacity = '1';
  setTimeout(() => { el.style.transition = `opacity ${duration}ms`; el.style.opacity = '0'; }, 20);
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

// ── IDLE PREVIEW ──────────────────────────────────────────────────
function drawIdlePreview() {
  const pc = document.getElementById('ship-preview');
  if (!pc) return;
  const pctx = pc.getContext('2d');
  pctx.clearRect(0, 0, 80, 40);
  pctx.fillStyle = '#164080';
  pctx.beginPath(); pctx.moveTo(60,20); pctx.lineTo(30,30); pctx.lineTo(35,20); pctx.lineTo(30,10); pctx.closePath(); pctx.fill();
  pctx.fillStyle = 'rgba(0,255,200,0.7)';
  pctx.beginPath(); pctx.ellipse(52,20,7,5,0,0,Math.PI*2); pctx.fill();
  pctx.fillStyle = '#FF6B00';
  pctx.beginPath(); pctx.moveTo(32,17); pctx.lineTo(32,23); pctx.lineTo(20,20); pctx.closePath(); pctx.fill();
  [[10,8],[15,25],[5,18],[70,12],[65,30]].forEach(([x,y]) => {
    pctx.fillStyle = 'rgba(255,255,255,0.6)';
    pctx.beginPath(); pctx.arc(x,y,1,0,Math.PI*2); pctx.fill();
  });
}

// ── SHARE CARD ────────────────────────────────────────────────────
async function generateShareCard(score, best, sector, duration) {
  await document.fonts.ready;
  const sc = document.createElement('canvas');
  sc.width = 1080; sc.height = 1080;
  const c = sc.getContext('2d');
  const bg = c.createLinearGradient(0,0,0,1080);
  bg.addColorStop(0,'#030818'); bg.addColorStop(0.5,'#060D20'); bg.addColorStop(1,'#020610');
  c.fillStyle=bg; c.fillRect(0,0,1080,1080);
  for (let i=0;i<200;i++) {
    c.globalAlpha=0.2+Math.random()*0.6;
    c.fillStyle=Math.random()<0.2?`hsl(${200+Math.random()*40},60%,88%)`:'#fff';
    c.beginPath(); c.arc(Math.random()*1080,Math.random()*1080,0.5+Math.random()*1.4,0,Math.PI*2); c.fill();
  }
  c.globalAlpha=1;
  [[180,860,38,'#AA5522'],[870,680,28,'#884422'],[110,380,22,'#774422']].forEach(([mx,my,mr,col])=>{
    const mg=c.createRadialGradient(mx,my,0,mx,my,mr*2.2);
    mg.addColorStop(0,'rgba(255,130,40,0.4)'); mg.addColorStop(1,'transparent');
    c.fillStyle=mg; c.beginPath(); c.arc(mx,my,mr*2.2,0,Math.PI*2); c.fill();
    c.fillStyle=col; c.beginPath(); c.arc(mx,my,mr,0,Math.PI*2); c.fill();
  });
  c.textAlign='center';
  c.font='700 54px Orbitron,monospace'; c.fillStyle='rgba(0,255,200,0.72)'; c.fillText('VOID RUNNER',540,148);
  c.font="400 26px 'Exo 2',sans-serif"; c.fillStyle='rgba(100,140,160,0.55)'; c.fillText('Float. Dodge. Survive.',540,192);
  c.strokeStyle='rgba(0,255,200,0.14)'; c.lineWidth=1; c.beginPath(); c.moveTo(160,220); c.lineTo(920,220); c.stroke();
  c.shadowColor='#00FFC8'; c.shadowBlur=50; c.font='900 240px Orbitron,monospace'; c.fillStyle='#00FFC8'; c.fillText(String(score),540,510); c.shadowBlur=0;
  c.font='600 28px Orbitron,monospace'; c.fillStyle='rgba(0,200,160,0.5)'; c.fillText(`SECTOR ${sector} — ${getSectorName(score*15)}`,540,562);
  c.strokeStyle='rgba(0,255,200,0.18)'; c.lineWidth=1.5; c.beginPath(); c.moveTo(200,610); c.lineTo(880,610); c.stroke();
  [{label:'BEST',value:String(best||'—'),x:270},{label:'SECTOR',value:String(sector),x:540},{label:'TIME',value:duration+'s',x:810}].forEach(s=>{
    c.font='700 44px Orbitron,monospace'; c.fillStyle='#fff'; c.fillText(s.value,s.x,700);
    c.font='400 15px Orbitron,monospace'; c.fillStyle='rgba(100,140,160,0.5)'; c.fillText(s.label,s.x,726);
  });
  c.font='700 30px Orbitron,monospace'; c.fillStyle='rgba(255,184,0,0.82)'; c.fillText('CAN YOU BEAT ME?',540,830);
  c.font="400 21px 'Exo 2',sans-serif"; c.fillStyle='rgba(100,140,160,0.4)'; c.fillText('arcadeflash.fun/void-runner',540,872);
  c.strokeStyle='rgba(0,255,200,0.10)'; c.lineWidth=3; c.strokeRect(18,18,1044,1044);
  c.textAlign='left'; return sc;
}

async function shareScore(score, best, sector, duration) {
  const card = await generateShareCard(score, best, sector, duration);
  card.toBlob(async blob => {
    const file = new File([blob], `void-runner-${score}.png`, { type:'image/png' });
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files:[file] })) {
        await navigator.share({ title:'Void Runner', text:`I survived ${score} meteors in Void Runner! Can you beat me?`, files:[file] });
        return;
      }
    } catch(e) {}
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`void-runner-score-${score}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    try { await navigator.clipboard.writeText(`I survived ${score} meteors in Void Runner!\nhttps://arcadeflash.fun/void-runner`); toast('Card downloaded + text copied!'); }
    catch(e) { toast('Score card downloaded!'); }
  }, 'image/png', 0.95);
}

// ── MUTE ──────────────────────────────────────────────────────────
function toggleMute() {
  audioMuted = !audioMuted;
  audio.init();
  audio.setMute(audioMuted);
  const btn = document.getElementById('btn-mute');
  if (btn) {
    btn.textContent = audioMuted ? '🔇' : '🔊';
    btn.classList.toggle('muted', audioMuted);
    btn.title = audioMuted ? 'Unmute' : 'Mute';
  }
}

// ── ANALYTICS ─────────────────────────────────────────────────────
function trackEvent(name, props) {
  try { _fbLog(_fbAnalytics, name, props); } catch(e) {}
}

// ── BOOT ──────────────────────────────────────────────────────────
resize();
drawIdlePreview();
stars = new StarField(W, H);
ship  = new Ship(W * 0.5, H * 0.5, W, H);
best  = storage.getBest();
activeSkin = storage.getActiveSkin();
if (ship) ship.skinId = activeSkin;

// Show streak on idle screen
const streakCount = storage.getStreak();
const streakEl    = document.getElementById('streak-bar');
if (streakEl && streakCount > 1) {
  streakEl.style.display = 'flex';
  document.getElementById('streak-count').textContent = `🔥 ${streakCount}-Day Streak`;
}

initSkinSelector();
updateHUD();

const muteBtn = document.getElementById('btn-mute');
if (muteBtn) muteBtn.addEventListener('click', e => { e.stopPropagation(); toggleMute(); });

document.getElementById('btn-error-reload')?.addEventListener('click', () => location.reload());

requestAnimationFrame(ts => { lastTs = ts; loop(ts); });
