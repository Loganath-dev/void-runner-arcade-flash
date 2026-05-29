// engine/ship.js — Classic UFO saucer with 5 unlockable skins
// Physics: thrust-based, gravity, drag. Visuals: 10-layer render, dynamic scale.

// ── Skin colour profiles ─────────────────────────────────────────────
// rim[0..7]: RGB arrays for the 8 rotating equatorial lights
// dome / core / beam / bcn / halo / eng: CSS-ready "R,G,B" strings
const SHIP_SKINS = {
  default: {
    rim: [[0,255,180],[80,200,255],[200,100,255],[70,210,255],[255,200,0],[100,220,255],[255,80,180],[160,80,255]],
    dome:'200,80,255', core:'160,60,255', beam:'140,60,255',
    bcn:'0,220,255', halo:'0,200,255', eng:'100,50,255',
  },
  fire: {
    rim: [[255,50,0],[255,150,0],[255,220,50],[255,80,20],[255,120,0],[200,50,0],[255,180,0],[255,100,0]],
    dome:'255,80,0', core:'255,80,0', beam:'255,80,0',
    bcn:'255,120,0', halo:'255,100,0', eng:'255,60,0',
  },
  neon: {
    rim: [[255,0,100],[0,255,100],[255,255,0],[0,100,255],[255,0,255],[100,255,0],[255,100,0],[0,255,255]],
    dome:'255,0,200', core:'255,0,200', beam:'200,0,255',
    bcn:'255,0,255', halo:'200,0,255', eng:'255,0,200',
  },
  shadow: {
    rim: [[60,60,160],[40,40,120],[80,80,200],[20,20,80],[60,60,180],[30,30,100],[80,80,160],[40,40,120]],
    dome:'40,40,120', core:'80,80,200', beam:'60,60,160',
    bcn:'80,80,180', halo:'40,40,160', eng:'40,40,120',
  },
  chaos: {
    rim: [[255,0,0],[255,255,255],[255,0,0],[255,255,255],[255,80,0],[255,255,255],[255,0,0],[255,200,0]],
    dome:'255,0,0', core:'255,0,0', beam:'255,0,0',
    bcn:'255,20,0', halo:'255,0,0', eng:'255,0,0',
  },
  rainbow: {
    rim: [[255,0,0],[255,120,0],[255,255,0],[0,255,80],[0,220,255],[60,80,255],[180,0,255],[255,0,160]],
    dome:'255,100,200', core:'0,255,180', beam:'120,0,255',
    bcn:'255,220,0', halo:'0,200,255', eng:'255,0,120',
  },
};

export class Ship {
  constructor(x, y, W, H) {
    this.x = x; this.y = y; this.W = W; this.H = H;
    this.vx = 0; this.vy = 0;
    this.r  = Math.min(22, W * 0.055);
    this.hue        = 200;
    this.angle      = 0;
    this.thrustGlow = 0;
    this.trail      = [];
    this.alive      = true;
    this._idleT     = 0;
    this._baseY     = y;
    this.onFire     = false;  // ON FIRE combo (game.js sets this)
    this.drawScale  = 1.0;    // 0.80→1.75, set by game.js each frame
    this.powerLevel = 0;      // 0..1 charge ring, set by game.js
    this.skinId     = 'default'; // active skin, set by game.js
  }

  update(dt, thrustUp, goLeft, goRight, goDown) {
    if (!this.alive) return;

    const GRAV = 300, THRUST_U = 540, THRUST_H = 180, THRUST_D = 360;
    const DRAG_V = 0.94, DRAG_H = 0.86, MAX_VY = 460, MAX_VX = 210;

    if (thrustUp) {
      this.vy -= THRUST_U * dt;
      this.thrustGlow = Math.min(1, this.thrustGlow + dt * 7);
    } else {
      this.thrustGlow = Math.max(0, this.thrustGlow - dt * 4);
    }
    if (goDown) this.vy += THRUST_D * dt;

    this.vy += GRAV * dt;
    this.vy *= DRAG_V;
    this.vy  = Math.max(-MAX_VY, Math.min(MAX_VY, this.vy));

    if (goLeft)       this.vx -= THRUST_H * dt * 3;
    else if (goRight) this.vx += THRUST_H * dt * 3;
    this.vx *= DRAG_H;
    this.vx  = Math.max(-MAX_VX, Math.min(MAX_VX, this.vx));

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const targetAngle = this.vx * 0.0018 + this.vy * 0.0005;
    this.angle += (targetAngle - this.angle) * dt * 9;
    this.hue = (this.hue + dt * 8) % 360;
    this._idleT += dt;

    this.trail.unshift({ x: this.x, y: this.y, hue: this.hue, tg: this.thrustGlow });
    if (this.trail.length > 22) this.trail.pop();

    const mg = this.r * 0.6;
    if (this.x < mg)          this.vx += 500 * dt;
    if (this.x > this.W - mg) this.vx -= 500 * dt;
    if (this.y < mg)          this.vy += 400 * dt;
    if (this.y > this.H - mg) this.vy -= 400 * dt;
  }

  kill()     { this.alive = false; this.trail = []; }
  getColor() { return 'hsl(200,90%,70%)'; }

  getBounds() {
    const HB = 0.52; // hitbox fixed — only visual scale changes
    return { left:this.x-this.r*HB, right:this.x+this.r*HB, top:this.y-this.r*HB, bottom:this.y+this.r*HB };
  }

  animateIdle(dt, T) {
    this._idleT += dt;
    this.y          = this._baseY + Math.sin(this._idleT * 1.6) * 10;
    this.thrustGlow = 0.12 + 0.08 * Math.sin(this._idleT * 1.8);
    this.hue        = (this.hue + dt * 8) % 360;
    this.drawScale  = 1.0 + 0.06 * Math.sin(this._idleT * 1.2);
  }

  draw(ctx, T) {
    if (!this.alive) return;
    const r  = this.r;
    const vs = this.drawScale || 1.0;
    const sk = SHIP_SKINS[this.skinId] || SHIP_SKINS.default;

    // ── World-space layers ────────────────────────────────────────────

    // Persistent position beacon (scales with UFO, never fades out)
    const beaconA = 0.25 + 0.13 * Math.sin(T * 3.1);
    const bR = r * 1.8 * vs;
    const bGrad = ctx.createRadialGradient(this.x, this.y, r * 0.1 * vs, this.x, this.y, bR);
    bGrad.addColorStop(0,   `rgba(${sk.bcn},${beaconA})`);
    bGrad.addColorStop(0.5, `rgba(${sk.bcn},${beaconA * 0.25})`);
    bGrad.addColorStop(1,   'rgba(0,40,120,0)');
    ctx.fillStyle = bGrad;
    ctx.beginPath(); ctx.arc(this.x, this.y, bR, 0, Math.PI * 2); ctx.fill();

    // ON FIRE red aura
    if (this.onFire) {
      const fireA = 0.24 + 0.20 * Math.sin(T * 7.5);
      const fg = ctx.createRadialGradient(this.x, this.y, r * vs, this.x, this.y, r * 3.8 * vs);
      fg.addColorStop(0,   `rgba(255,80,20,${fireA})`);
      fg.addColorStop(0.5, `rgba(255,30,0,${fireA * 0.38})`);
      fg.addColorStop(1,   'rgba(180,0,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(this.x, this.y, r * 3.8 * vs, 0, Math.PI * 2); ctx.fill();
    }

    // Energy trail
    this.trail.forEach((t, i) => {
      const prog = 1 - i / this.trail.length;
      const tg   = t.tg || 0, boost = tg * 0.55;
      const a    = prog * (0.35 + boost);
      const s    = r * prog * (0.70 + boost * 0.55) * vs;
      if (s < 0.4) return;
      ctx.globalAlpha = a;
      ctx.fillStyle   = tg > 0.35
        ? `rgba(${sk.bcn},${a})`
        : `hsl(${190 + Math.sin(t.hue * 0.05) * 35},80%,65%)`;
      ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(0.4, s), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Afterburner streak
    if (this.thrustGlow > 0.25) {
      const spd = Math.hypot(this.vx, this.vy);
      if (spd > 60) {
        const sLen = Math.min(spd * 0.28, r * 3.5) * vs;
        const nx = -this.vx / spd, ny = -this.vy / spd;
        const sg = ctx.createLinearGradient(this.x, this.y, this.x + nx * sLen, this.y + ny * sLen);
        sg.addColorStop(0,    `rgba(${sk.bcn},${this.thrustGlow * 0.75})`);
        sg.addColorStop(0.35, `rgba(${sk.bcn},${this.thrustGlow * 0.40})`);
        sg.addColorStop(1,    'rgba(0,20,80,0)');
        ctx.lineWidth = 2.2 * vs; ctx.strokeStyle = sg;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + nx * sLen, this.y + ny * sLen); ctx.stroke();
      }
    }

    // ── Local-space layers (all scale via ctx.scale) ─────────────────

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.scale(vs, vs);

    const p = 0.65 + 0.35 * Math.sin(T * 3.8);

    // Layer 1: Outer EM field glow
    const halo = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.9);
    halo.addColorStop(0,    `rgba(${sk.halo},${0.10 * p})`);
    halo.addColorStop(0.45, `rgba(${sk.halo},${0.05 * p})`);
    halo.addColorStop(1,    'transparent');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.9, 0, Math.PI * 2); ctx.fill();

    // Layer 2: Anti-grav engine glow (underside)
    if (this.thrustGlow > 0.05) {
      const eg = ctx.createRadialGradient(0, r * 0.26, 0, 0, r * 0.26, r * 2.4);
      eg.addColorStop(0,    `rgba(${sk.eng},${this.thrustGlow * 0.65})`);
      eg.addColorStop(0.35, `rgba(${sk.eng},${this.thrustGlow * 0.22})`);
      eg.addColorStop(1,    'transparent');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(0, r * 0.26, r * 2.4, 0, Math.PI * 2); ctx.fill();
    }

    // Layer 3: Main saucer disc
    const discG = ctx.createLinearGradient(0, -r * 0.42, 0, r * 0.42);
    discG.addColorStop(0,   '#1E2E48');
    discG.addColorStop(0.38,'#0E1828');
    discG.addColorStop(1,   '#070F1C');
    ctx.fillStyle   = discG;
    ctx.strokeStyle = `rgba(${sk.bcn},0.52)`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.60, r * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Chrome sheen
    const sheen = ctx.createLinearGradient(-r, -r * 0.28, r, -r * 0.18);
    sheen.addColorStop(0,   'rgba(120,180,255,0)');
    sheen.addColorStop(0.5, 'rgba(220,240,255,0.18)');
    sheen.addColorStop(1,   'rgba(120,180,255,0)');
    ctx.fillStyle = sheen;
    ctx.beginPath(); ctx.ellipse(0, -r * 0.12, r * 1.60, r * 0.20, 0, 0, Math.PI * 2); ctx.fill();

    // Layer 4: Dome / cockpit canopy
    const domePulse = 0.55 + 0.45 * Math.sin(T * 2.5);
    const domeG = ctx.createRadialGradient(-r * 0.20, -r * 0.52, 0, 0, -r * 0.32, r * 0.92);
    domeG.addColorStop(0,   `rgba(${sk.dome},${0.82 * domePulse})`);
    domeG.addColorStop(0.35,`rgba(${sk.dome},${0.45 * domePulse})`);
    domeG.addColorStop(0.75,`rgba(${sk.dome},${0.18 * domePulse})`);
    domeG.addColorStop(1,   `rgba(0,20,60,${0.06 * domePulse})`);
    ctx.fillStyle   = domeG;
    ctx.strokeStyle = `rgba(${sk.dome},${0.55 * domePulse})`;
    ctx.lineWidth   = 1.2;
    ctx.beginPath(); ctx.ellipse(0, -r * 0.32, r * 0.84, r * 0.56, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Glass specular
    const specG = ctx.createRadialGradient(-r * 0.28, -r * 0.60, 0, -r * 0.18, -r * 0.52, r * 0.38);
    specG.addColorStop(0, `rgba(255,255,255,${0.22 * domePulse})`);
    specG.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specG;
    ctx.beginPath(); ctx.ellipse(-r * 0.18, -r * 0.52, r * 0.38, r * 0.22, -0.5, 0, Math.PI * 2); ctx.fill();

    // Layer 5: Alien pilot silhouette (barely visible — eerie)
    const alienA = 0.14 + 0.06 * Math.sin(T * 1.2);
    ctx.fillStyle = `rgba(0,0,0,${alienA})`;
    ctx.beginPath(); ctx.ellipse(0, -r * 0.48, r * 0.20, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -r * 0.30, r * 0.10, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(0,0,0,${alienA * 0.6})`;
    ctx.beginPath(); ctx.ellipse(-r*0.07, -r*0.50, r*0.05, r*0.03, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( r*0.07, -r*0.50, r*0.05, r*0.03,  0.3, 0, Math.PI*2); ctx.fill();

    // Layer 6: Equatorial rim band
    const rimG = ctx.createLinearGradient(0, -r * 0.14, 0, r * 0.14);
    rimG.addColorStop(0,   '#243550');
    rimG.addColorStop(0.5, '#1A2840');
    rimG.addColorStop(1,   '#0F1B30');
    ctx.fillStyle   = rimG;
    ctx.strokeStyle = `rgba(${sk.bcn},0.28)`;
    ctx.lineWidth   = 0.9;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.60, r * 0.14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Layer 7: Rotating rim lights — 8 skin-coloured UFO lights
    for (let i = 0; i < 8; i++) {
      const lt = (i / 8) * Math.PI * 2 + T * 1.5;
      const lx = Math.cos(lt) * r * 1.42;
      const ly = Math.sin(lt) * r * 0.235;
      const blink = 0.4 + 0.6 * Math.sin(T * 5.5 + i * 1.2);
      const [lr, lg, lb] = sk.rim[i];
      const lGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.28);
      lGrad.addColorStop(0, `rgba(${lr},${lg},${lb},${blink * 0.88})`);
      lGrad.addColorStop(1, `rgba(${lr},${lg},${lb},0)`);
      ctx.fillStyle = lGrad;
      ctx.beginPath(); ctx.arc(lx, ly, r * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${Math.min(lr+60,255)},${Math.min(lg+40,255)},${Math.min(lb+40,255)},${blink})`;
      ctx.beginPath(); ctx.arc(lx, ly, r * 0.09, 0, Math.PI * 2); ctx.fill();
    }

    // Layer 8: Underside engine housing
    const uhG = ctx.createRadialGradient(0, r * 0.25, 0, 0, r * 0.25, r * 0.72);
    uhG.addColorStop(0, '#0A1220'); uhG.addColorStop(1, '#111E30');
    ctx.fillStyle   = uhG;
    ctx.strokeStyle = `rgba(${sk.eng},0.40)`;
    ctx.lineWidth   = 1.1;
    ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.72, r * 0.18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Layer 9: Anti-grav core — pulsing energy emitter (skin-colored)
    const ecp = 0.55 + 0.45 * Math.sin(T * 6.8);
    const ecG = ctx.createRadialGradient(0, r * 0.25, 0, 0, r * 0.25, r * 0.62);
    ecG.addColorStop(0,   `rgba(${sk.core},${0.92 * ecp})`);
    ecG.addColorStop(0.30,`rgba(${sk.core},${0.50 * ecp})`);
    ecG.addColorStop(1,   'rgba(0,20,80,0)');
    ctx.fillStyle = ecG;
    ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${sk.core},${0.45 * ecp})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.38, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(220,200,255,${0.90 * ecp})`;
    ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.70 * ecp})`;
    ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.055, 0, Math.PI * 2); ctx.fill();

    // Layer 10: Anti-grav beam / tractor beam (skin-colored)
    if (this.thrustGlow > 0.05) {
      const fh = r * this.thrustGlow * (1.20 + Math.random() * 0.40);
      const bw = r * 0.34 * (0.6 + this.thrustGlow * 0.4);
      const bG = ctx.createLinearGradient(0, r * 0.34, 0, r * 0.34 + fh);
      bG.addColorStop(0,   `rgba(${sk.beam},${this.thrustGlow * 0.92})`);
      bG.addColorStop(0.4, `rgba(${sk.beam},${this.thrustGlow * 0.55})`);
      bG.addColorStop(1,   'rgba(0,20,80,0)');
      ctx.fillStyle = bG;
      ctx.beginPath();
      ctx.moveTo(-bw, r * 0.34); ctx.lineTo(bw, r * 0.34);
      ctx.lineTo(bw * 0.18, r * 0.34 + fh); ctx.lineTo(-bw * 0.18, r * 0.34 + fh);
      ctx.closePath(); ctx.fill();
      // Electric crackle
      if (Math.random() < 0.45) {
        ctx.strokeStyle = `rgba(220,200,255,${this.thrustGlow * 0.50})`;
        ctx.lineWidth = 0.7; ctx.lineCap = 'round';
        ctx.beginPath();
        let py = r * 0.34; ctx.moveTo((Math.random()-0.5) * bw * 1.6, py);
        for (let j = 0; j < 5; j++) { py += fh/5; ctx.lineTo((Math.random()-0.5) * bw * (1.5-j*0.22), py); }
        ctx.stroke(); ctx.lineCap = 'butt';
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
