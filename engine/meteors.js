// engine/meteors.js — MeteorManager
// Real meteor look: spherical rocky body, fire trail, atmospheric entry glow.

export class MeteorManager {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.meteors     = [];
    this.pool        = [];
    this.embers      = [];
    this.spawnTimer  = 0;
    this._newWarning = false;
  }

  _radius(score) {
    const base = 12;
    const t    = Math.min(score / 80, 1.0);
    return base + base * 0.8 * t;
  }

  // Start at 220px/s — dangerous from frame 1. Cap at 420.
  _speed(score)  { return Math.min(220 + score * 2.4, 420); }
  _rate(score)   { return Math.max(0.32, 1.1 - score * 0.011); }

  _get()      { return this.pool.pop() || {}; }
  _release(m) { this.pool.push(m); }

  _spawn(score) {
    const r      = this._radius(score);
    const speed  = this._speed(score);
    const count = (score >= 50 && Math.random() < 0.28) ? 2 : 1;

    // Smooth top-spawn ramp: 0% at score <30, grows to 45% by score 60
    const topChance = score < 30 ? 0 : Math.min(0.45, 0.45 * ((score - 30) / 30));

    for (let c = 0; c < count; c++) {
      const m = this._get();

      // Diagonal meteors: 30% of spawns at score 25+ force genuine 2D movement
      const isDiag = score >= 25 && Math.random() < 0.30;
      m.isDiagonal = isDiag;

      if (isDiag) {
        const fromLeft = Math.random() < 0.5;
        m.x      = fromLeft ? -r - 10 : this.W + r + 10;
        m.y      = this.H * 0.12 + Math.random() * this.H * 0.76;
        m.vx     = fromLeft ? speed * 0.88 : -speed * 0.88;
        m.vy     = (Math.random() - 0.5) * speed * 0.55;
        m.fromTop = false;
      } else {
        m.x = this.W * 0.10 + Math.random() * this.W * 0.80;
        if (c === 1) m.x = Math.max(this.W * 0.10, Math.min(this.W * 0.90, m.x + (Math.random() - 0.5) * this.W * 0.25));
        const fromTop = Math.random() < topChance;
        m.y      = fromTop ? -r - 10 : this.H + r + 10;
        m.vy     = fromTop ? speed : -speed;
        m.vx     = (Math.random() - 0.5) * 25;
        m.fromTop = fromTop;
      }

      m.r      = r * (0.75 + Math.random() * 0.45);
      m.baseR  = m.r;
      m.rot    = Math.random() * Math.PI * 2;
      m.rotSpd = (Math.random() - 0.5) * 1.6;
      m.pulsePhase = Math.random() * Math.PI * 2;
      m.scored     = false;
      m.nearMissed = false;
      m.warned     = false;

      // ── Meteor type: tiny (fast), giant (slow), gold (bonus), normal ──
      const tr = Math.random();
      if      (score >= 15 && tr < 0.035)        m.mtype = 'gold';
      else if (score >= 20 && tr < 0.12)         m.mtype = 'tiny';
      else if (score >= 10 && tr < 0.20)         m.mtype = 'giant';
      else                                        m.mtype = 'normal';

      if (m.mtype === 'tiny') {
        m.r *= 0.52; m.baseR = m.r;  // was 0.40 — too small to react to
        m.vy *= 1.40;                 // was 1.60 — reaction-time-viable now
      } else if (m.mtype === 'giant') {
        m.r *= 1.90; m.baseR = m.r;
        m.vy *= 0.52; // lumbering — forces repositioning
      } else if (m.mtype === 'gold') {
        m.r *= 0.68; m.baseR = m.r;
        m.vx = (Math.random() - 0.5) * 60; // slightly more lateral drift
      }

      this.meteors.push(m);
    }
  }

  update(dt, score) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this._rate(score)) {
      this.spawnTimer = 0;
      this._spawn(score);
    }

    const pulse = Math.max(0, (score - 40) / 60);

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.rot        += m.rotSpd * dt;
      m.pulsePhase += dt * (1.8 + pulse * 3.5);
      if (pulse > 0.02) m.r = m.baseR * (1 + pulse * 0.08 * Math.sin(m.pulsePhase));

      // Warning trigger
      if (!m.warned) {
        if (!m.isDiagonal && Math.abs(m.vy) > 250) {
          const nearEdge = m.fromTop
            ? (m.y > -m.r && m.y < m.r + 30)
            : (m.y < this.H + m.r && m.y > this.H - m.r - 30);
          if (nearEdge) { m.warned = true; this._newWarning = true; }
        } else if (m.isDiagonal) {
          const nearSide = m.vx > 0
            ? (m.x > -m.r && m.x < m.r + 20)
            : (m.x < this.W + m.r && m.x > this.W - m.r - 20);
          if (nearSide) { m.warned = true; this._newWarning = true; }
        }
      }

      // Ember emission from fast meteors
      const spd = Math.abs(m.vy);
      if (spd > 100) {
        const rate = Math.min(spd / 350, 1) * 1.1;
        if (Math.random() < rate * dt * 60) this._emitEmber(m);
        if (spd > 250 && Math.random() < 0.35) this._emitEmber(m);
      }

      const gone = m.isDiagonal
        ? (m.vx > 0 ? m.x > this.W + m.r * 2 : m.x < -m.r * 2)
        : (m.fromTop ? m.y > this.H + m.r * 2 : m.y < -m.r * 2);
      if (gone) { this._release(m); this.meteors.splice(i, 1); }
    }

    // Update embers
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vy += 25 * dt;
      e.vx *= 0.95;
      e.life -= dt;
      if (e.life <= 0) this.embers.splice(i, 1);
    }
  }

  _emitEmber(m) {
    const spread = m.r * 0.5;
    const a   = Math.random() * Math.PI * 2;
    const spd = 20 + Math.random() * 55;
    const ny  = -Math.sign(m.vy);
    const nx  = m.vx !== 0 ? -Math.sign(m.vx) * 0.3 : 0;
    const life = 0.20 + Math.random() * 0.42;
    this.embers.push({
      x: m.x + (Math.random() - 0.5) * spread,
      y: m.y + (Math.random() - 0.5) * spread,
      vx: Math.cos(a) * spd * 0.3 + nx * spd * 0.7,
      vy: Math.sin(a) * spd * 0.3 + ny * spd * 0.9,
      life, maxLife: life,
      r: 0.8 + Math.random() * 1.8,
    });
  }

  _spawnWaveMeteor(x, score) {
    const r = this._radius(score) * (0.85 + Math.random() * 0.30);
    const speed = this._speed(score) * 0.92;
    const m = this._get();
    m.x = x; m.y = -r - 10;
    m.vx = 0; m.vy = speed;
    m.r = r; m.baseR = r;
    m.rot = Math.random() * Math.PI * 2;
    m.rotSpd = (Math.random() - 0.5) * 1.6;
    m.pulsePhase = Math.random() * Math.PI * 2;
    m.fromTop = true; m.isDiagonal = false;
    m.scored = false; m.nearMissed = false; m.warned = false;
    m.mtype = 'normal';
    this.meteors.push(m);
  }

  hasNewWarning() { const h = this._newWarning; this._newWarning = false; return h; }

  checkCollision(shipBounds) {
    const cx = (shipBounds.left + shipBounds.right)  / 2;
    const cy = (shipBounds.top  + shipBounds.bottom) / 2;
    const sr = (shipBounds.right - shipBounds.left)  / 2;
    for (const m of this.meteors) {
      if (Math.hypot(cx - m.x, cy - m.y) < m.r + sr) return true;
    }
    return false;
  }

  checkNearMiss(shipBounds) {
    const cx = (shipBounds.left + shipBounds.right)  / 2;
    const cy = (shipBounds.top  + shipBounds.bottom) / 2;
    const sr = (shipBounds.right - shipBounds.left)  / 2;
    for (const m of this.meteors) {
      if (m.nearMissed) continue;
      const dist      = Math.hypot(cx - m.x, cy - m.y);
      const clearance = dist - m.r - sr;
      const passed = m.isDiagonal
        ? (m.vx > 0 ? m.x > cx : m.x < cx)
        : (m.fromTop ? m.y > cy : m.y < cy);
      if (passed && clearance > 0 && clearance < 16) {
        m.nearMissed = true;
        return clearance < 5 ? 'INSANE!!' : clearance < 10 ? 'PERFECT!' : 'CLOSE!';
      }
    }
    return null;
  }

  // Returns { gained, goldBonus } — gold meteors award +2 extra points
  checkScore(shipX, shipY) {
    let gained = 0, goldBonus = 0;
    for (const m of this.meteors) {
      if (m.scored) continue;
      const passed = m.isDiagonal
        ? (m.vx > 0 ? m.x > shipX + 30 : m.x < shipX - 30)
        : (m.fromTop ? m.y > shipY + 30 : m.y < shipY - 30);
      if (passed) {
        m.scored = true;
        gained++;
        if (m.mtype === 'gold') goldBonus += 2;
      }
    }
    return { gained, goldBonus };
  }

  // ── Draw ──────────────────────────────────────────────────────────

  draw(ctx, score, T) {
    // Pass 1: Fire trails (world space — must be behind bodies)
    this.meteors.forEach(m => this._drawTrail(ctx, m));

    // Pass 2: Atmospheric glow + spherical rocky body
    const pulse = Math.max(0, (score - 40) / 60);
    this.meteors.forEach(m => {
      this._drawAtmosphericGlow(ctx, m, pulse);

      const isGold = m.mtype === 'gold';

      ctx.save();
      ctx.translate(m.x, m.y);

      const isTiny = m.mtype === 'tiny';

      ctx.beginPath();
      ctx.arc(0, 0, m.r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      if (isGold) {
        // Gold meteor — rounded, gleaming metallic sphere
        const gg = ctx.createRadialGradient(-m.r * 0.34, -m.r * 0.38, 0, 0, 0, m.r * 1.15);
        gg.addColorStop(0,    '#FFE080'); // bright gold
        gg.addColorStop(0.24, '#FFD044'); // hot shine
        gg.addColorStop(0.58, '#B87814'); // mid gold
        gg.addColorStop(0.82, '#5A3604'); // dark gold
        gg.addColorStop(1,    '#3A2800'); // shadow
        ctx.fillStyle = gg; ctx.fill();

        const shineA = 0.40 + 0.24 * Math.sin(m.pulsePhase * 5.2);
        const sg = ctx.createRadialGradient(-m.r * 0.35, -m.r * 0.42, 0, -m.r * 0.35, -m.r * 0.42, m.r * 0.44);
        sg.addColorStop(0, `rgba(255,255,230,${shineA})`);
        sg.addColorStop(1, 'rgba(255,255,230,0)');
        ctx.fillStyle = sg; ctx.fillRect(-m.r, -m.r, m.r * 2, m.r * 2);

        const glitA = 0.7 + 0.3 * Math.sin(m.pulsePhase * 5.2);
        ctx.beginPath();
        ctx.arc(0, 0, m.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,230,80,${glitA})`;
        ctx.lineWidth   = 1.8; ctx.stroke();

        ctx.fillStyle = `rgba(255,255,200,${0.5 + 0.4 * Math.sin(m.pulsePhase * 8)})`;
        ctx.beginPath(); ctx.arc(-m.r * 0.22, -m.r * 0.28, m.r * 0.12, 0, Math.PI * 2); ctx.fill();
      } else if (isTiny) {
        // Plasma ball: electric cyan — immediately distinct from normal meteors
        const pa = 0.80 + 0.20 * Math.sin(m.pulsePhase * 9);
        const pg = ctx.createRadialGradient(-m.r * 0.22, -m.r * 0.28, 0, 0, 0, m.r * 1.05);
        pg.addColorStop(0,    `rgba(255,255,255,${pa})`);
        pg.addColorStop(0.18, 'rgba(200,255,255,0.95)');
        pg.addColorStop(0.50, 'rgba(0,210,255,0.88)');
        pg.addColorStop(0.82, 'rgba(0,60,200,0.55)');
        pg.addColorStop(1,    'rgba(0,0,140,0.22)');
        ctx.fillStyle = pg; ctx.fill();

        // Electric crackle lines
        const ca = 0.55 + 0.45 * Math.sin(m.pulsePhase * 11);
        ctx.strokeStyle = `rgba(200,255,255,${ca})`;
        ctx.lineWidth = Math.max(0.4, m.r * 0.07); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-m.r*0.32,-m.r*0.38); ctx.lineTo(m.r*0.14,-m.r*0.04); ctx.lineTo(-m.r*0.08,m.r*0.28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(m.r*0.26,-m.r*0.22); ctx.lineTo(-m.r*0.10,m.r*0.10); ctx.stroke();
        ctx.lineCap = 'butt';

        // Bright white core dot
        ctx.fillStyle = `rgba(220,255,255,${pa * 0.90})`;
        ctx.beginPath(); ctx.arc(0, 0, m.r * 0.28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${pa})`;
        ctx.beginPath(); ctx.arc(0, 0, m.r * 0.13, 0, Math.PI * 2); ctx.fill();
      } else {
        // Rocky sphere: warm highlight, rounded shadow, heated edge.
        const bg = ctx.createRadialGradient(-m.r * 0.34, -m.r * 0.38, 0, 0, 0, m.r * 1.18);
        bg.addColorStop(0,    '#E09A5E');
        bg.addColorStop(0.26, '#A9572A');
        bg.addColorStop(0.58, '#4D210C');
        bg.addColorStop(0.84, '#211008');
        bg.addColorStop(1,    '#120502');
        ctx.fillStyle = bg; ctx.fill();

        const shade = ctx.createRadialGradient(m.r * 0.35, m.r * 0.42, 0, m.r * 0.35, m.r * 0.42, m.r * 1.05);
        shade.addColorStop(0, 'rgba(0,0,0,0)');
        shade.addColorStop(0.55, 'rgba(0,0,0,0.08)');
        shade.addColorStop(1, 'rgba(0,0,0,0.48)');
        ctx.fillStyle = shade; ctx.fill();

        ctx.save();
        ctx.rotate(m.rot);

        // Surface dimples rotate to preserve motion on the round body.
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        if (m.r > 9) {
          this._drawCrater(ctx,  m.r * 0.28, -m.r * 0.18, m.r * 0.15);
          this._drawCrater(ctx, -m.r * 0.20,  m.r * 0.30, m.r * 0.10);
        }
        if (m.r > 16) {
          this._drawCrater(ctx, -m.r * 0.34, -m.r * 0.22, m.r * 0.08);
          this._drawCrater(ctx,  m.r * 0.06,  m.r * 0.12, m.r * 0.07);
        }

        const crackA = 0.30 + 0.18 * Math.sin(m.pulsePhase * 2.1);
        ctx.strokeStyle = `rgba(255,190,60,${crackA})`;
        ctx.lineWidth   = Math.max(0.7, m.r * 0.045);
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(-m.r * 0.08, -m.r * 0.36);
        ctx.lineTo( m.r * 0.18,  m.r * 0.04);
        ctx.lineTo(-m.r * 0.12,  m.r * 0.30);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo( m.r * 0.16, -m.r * 0.22);
        ctx.lineTo(-m.r * 0.18,  m.r * 0.08);
        ctx.stroke();
        ctx.restore();

        const shine = ctx.createRadialGradient(-m.r * 0.38, -m.r * 0.42, 0, -m.r * 0.38, -m.r * 0.42, m.r * 0.55);
        shine.addColorStop(0, 'rgba(255,210,150,0.34)');
        shine.addColorStop(1, 'rgba(255,210,150,0)');
        ctx.fillStyle = shine; ctx.fillRect(-m.r, -m.r, m.r * 2, m.r * 2);

        ctx.beginPath();
        ctx.arc(0, 0, m.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,150,35,0.55)`;
        ctx.lineWidth   = 1.3; ctx.stroke();
      }

      ctx.restore();
    });

    // Pass 3: Ember particles
    this.embers.forEach(e => {
      const prog = Math.max(0, e.life / e.maxLife);
      ctx.globalAlpha = prog * 0.90;
      ctx.fillStyle = prog > 0.65 ? '#FFF0A0' : prog > 0.35 ? '#FF7020' : '#BB2A08';
      ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(0.3, e.r * prog), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  _drawCrater(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,190,110,0.18)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.26)');
    g.addColorStop(1, 'rgba(0,0,0,0.44)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,160,80,0.16)';
    ctx.lineWidth = Math.max(0.6, r * 0.14);
    ctx.stroke();
  }

  // Atmospheric halo — world space, behind body. Gold meteors glow gold.
  _drawAtmosphericGlow(ctx, m, pulse) {
    const spd = Math.hypot(m.vx, m.vy);
    if (spd < 55) return;
    const intensity = Math.min(spd / 360, 1);
    const isGold = m.mtype === 'gold';
    const isTiny = m.mtype === 'tiny';

    const haloR = m.r * 2.3;
    const hg    = ctx.createRadialGradient(m.x, m.y, m.r * 0.45, m.x, m.y, haloR);
    if (isGold) {
      hg.addColorStop(0,    `rgba(255,240,80,${0.55 * intensity})`);
      hg.addColorStop(0.30, `rgba(220,180,20,${0.30 * intensity})`);
      hg.addColorStop(0.65, `rgba(160,100,0,${0.14 * intensity})`);
      hg.addColorStop(1,    'rgba(80,40,0,0)');
    } else if (isTiny) {
      hg.addColorStop(0,    `rgba(0,255,255,${0.70 * intensity})`);
      hg.addColorStop(0.30, `rgba(0,180,255,${0.42 * intensity})`);
      hg.addColorStop(0.65, `rgba(0,80,200,${0.18 * intensity})`);
      hg.addColorStop(1,    'rgba(0,0,120,0)');
    } else {
      hg.addColorStop(0,    `rgba(255,185,45,${0.42 * intensity})`);
      hg.addColorStop(0.30, `rgba(220,80,15,${0.26 * intensity})`);
      hg.addColorStop(0.65, `rgba(160,20,0,${0.12 * intensity})`);
      hg.addColorStop(1,    'rgba(80,0,0,0)');
    }
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(m.x, m.y, haloR, 0, Math.PI * 2); ctx.fill();

    // Pulsating energy ring at high score
    if (pulse > 0.05) {
      const ringA = pulse * 0.18 * (0.6 + 0.4 * Math.sin(m.pulsePhase));
      const ringR = m.r * (1.8 + pulse * 0.4);
      const rg    = ctx.createRadialGradient(m.x, m.y, m.r * 0.55, m.x, m.y, ringR);
      rg.addColorStop(0, `rgba(255,120,20,${ringA * 1.8})`);
      rg.addColorStop(1, 'rgba(180,40,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(m.x, m.y, ringR, 0, Math.PI * 2); ctx.fill();
    }

    // Electric corona for tiny meteors — always visible so players can spot them
    if (isTiny) {
      const elecA = 0.32 * (0.5 + 0.5 * Math.sin(m.pulsePhase * 6));
      const elecR = m.r * 2.8;
      const eg    = ctx.createRadialGradient(m.x, m.y, m.r * 0.7, m.x, m.y, elecR);
      eg.addColorStop(0,   `rgba(0,255,255,${elecA})`);
      eg.addColorStop(0.4, `rgba(0,150,255,${elecA * 0.45})`);
      eg.addColorStop(1,   'rgba(0,0,200,0)');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(m.x, m.y, elecR, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Fire trail — world space, aligned to velocity. Gold trails gold, tiny trails cyan.
  _drawTrail(ctx, m) {
    const spd = Math.hypot(m.vx, m.vy);
    if (spd < 40) return;

    const isGold = m.mtype === 'gold';
    const isTiny = m.mtype === 'tiny';
    const nx = -m.vx / spd;
    const ny = -m.vy / spd;
    const trailLen = Math.min(spd * 0.90, 265);
    const flicker  = 0.74 + 0.26 * Math.sin(m.pulsePhase * 7.4);

    const ex = m.x + nx * trailLen;
    const ey = m.y + ny * trailLen;
    const px =  ny;
    const py = -nx;

    const wideW = m.r * 0.70;
    const tipW  = 0.5;

    // Outer trail — fire, gold sparkle, or electric cyan
    const og = ctx.createLinearGradient(m.x, m.y, ex, ey);
    if (isGold) {
      og.addColorStop(0,    `rgba(255,255,160,${0.90 * flicker})`);
      og.addColorStop(0.15, `rgba(255,220,60,${0.72 * flicker})`);
      og.addColorStop(0.45, `rgba(200,140,0,${0.38 * flicker})`);
      og.addColorStop(0.75, `rgba(120,70,0,${0.15 * flicker})`);
      og.addColorStop(1,    'rgba(60,30,0,0)');
    } else if (isTiny) {
      og.addColorStop(0,    `rgba(200,255,255,${0.84 * flicker})`);
      og.addColorStop(0.15, `rgba(0,220,255,${0.68 * flicker})`);
      og.addColorStop(0.42, `rgba(0,100,220,${0.38 * flicker})`);
      og.addColorStop(0.72, `rgba(0,40,180,${0.14 * flicker})`);
      og.addColorStop(1,    'rgba(0,0,120,0)');
    } else {
      og.addColorStop(0,    `rgba(255,225,80,${0.84 * flicker})`);
      og.addColorStop(0.12, `rgba(255,140,20,${0.70 * flicker})`);
      og.addColorStop(0.40, `rgba(210,50,5,${0.40 * flicker})`);
      og.addColorStop(0.70, `rgba(130,15,0,${0.18 * flicker})`);
      og.addColorStop(1,    'rgba(50,0,0,0)');
    }

    ctx.beginPath();
    ctx.moveTo(m.x + px * wideW, m.y + py * wideW);
    ctx.quadraticCurveTo(
      m.x + nx * trailLen * 0.42 + px * wideW * 0.22,
      m.y + ny * trailLen * 0.42 + py * wideW * 0.22,
      ex + px * tipW, ey + py * tipW
    );
    ctx.lineTo(ex - px * tipW, ey - py * tipW);
    ctx.quadraticCurveTo(
      m.x + nx * trailLen * 0.42 - px * wideW * 0.22,
      m.y + ny * trailLen * 0.42 - py * wideW * 0.22,
      m.x - px * wideW, m.y - py * wideW
    );
    ctx.closePath();
    ctx.fillStyle = og;
    ctx.fill();

    // Inner white-hot core — narrow triangle, 38% of trail length
    const innerLen = trailLen * 0.38;
    const iex = m.x + nx * innerLen;
    const iey = m.y + ny * innerLen;
    const iw  = m.r * 0.19;

    const ig = ctx.createLinearGradient(m.x, m.y, iex, iey);
    if (isGold) {
      ig.addColorStop(0,    `rgba(255,255,200,${0.98 * flicker})`);
      ig.addColorStop(0.25, `rgba(255,240,100,${0.82 * flicker})`);
      ig.addColorStop(0.6,  `rgba(220,160,0,${0.40 * flicker})`);
      ig.addColorStop(1,    'rgba(160,100,0,0)');
    } else if (isTiny) {
      ig.addColorStop(0,    `rgba(255,255,255,${0.96 * flicker})`);
      ig.addColorStop(0.22, `rgba(200,255,255,${0.85 * flicker})`);
      ig.addColorStop(0.58, `rgba(0,200,255,${0.42 * flicker})`);
      ig.addColorStop(1,    'rgba(0,100,200,0)');
    } else {
      ig.addColorStop(0,    `rgba(255,255,235,${0.98 * flicker})`);
      ig.addColorStop(0.22, `rgba(255,240,140,${0.82 * flicker})`);
      ig.addColorStop(0.58, `rgba(255,160,40,${0.40 * flicker})`);
      ig.addColorStop(1,    'rgba(220,80,0,0)');
    }

    ctx.beginPath();
    ctx.moveTo(m.x + px * iw, m.y + py * iw);
    ctx.lineTo(iex, iey);
    ctx.lineTo(m.x - px * iw, m.y - py * iw);
    ctx.closePath();
    ctx.fillStyle = ig;
    ctx.fill();
  }
}
