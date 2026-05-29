// engine/starfield.js — Deep space background: 269 stars, nebulae, galaxy, Milky Way band
export class StarField {
  constructor(W, H) { this.W = W; this.H = H; this._init(); }

  _init() {
    const W = this.W, H = this.H;
    this.stars = [];

    // Realistic star color helper — blue-white dominant (hottest), then yellow, orange, red
    const starCol = () => {
      const r = Math.random();
      if (r < 0.55) return `hsl(${215 + Math.random()*35},${55+Math.random()*20}%,${90+Math.random()*8}%)`; // B/A — blue-white
      if (r < 0.72) return `hsl(${50  + Math.random()*15},${60+Math.random()*15}%,${88+Math.random()*8}%)`; // G — yellow-white
      if (r < 0.87) return `hsl(${28  + Math.random()*14},${65+Math.random()*15}%,${82+Math.random()*8}%)`; // K — orange
      return            `hsl(${8   + Math.random()*14},${68+Math.random()*12}%,${76+Math.random()*8}%)`;      // M — red
    };

    // Layer 0: Far dim stars — dense background (120)
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 0.10 + Math.random() * 0.42, a: 0.05 + Math.random() * 0.26,
        layer: 0, tw: Math.random() * 6.28, ts: 0.08 + Math.random() * 0.30,
        col: starCol(), cross: false,
      });
    }

    // Layer 1: Mid colored stars (85)
    for (let i = 0; i < 85; i++) {
      this.stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 0.28 + Math.random() * 0.92, a: 0.14 + Math.random() * 0.46,
        layer: 1, tw: Math.random() * 6.28, ts: 0.18 + Math.random() * 0.52,
        col: starCol(), cross: false,
      });
    }

    // Layer 2: Near bright stars (50), some with diffraction spikes
    for (let i = 0; i < 50; i++) {
      this.stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 0.60 + Math.random() * 1.45, a: 0.28 + Math.random() * 0.56,
        layer: 2, tw: Math.random() * 6.28, ts: 0.28 + Math.random() * 0.78,
        col: starCol(), cross: Math.random() < 0.30,
      });
    }

    // Layer 3: Giant glow stars (14) — always with diffraction cross
    for (let i = 0; i < 14; i++) {
      this.stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 1.6 + Math.random() * 2.4, a: 0.48 + Math.random() * 0.46,
        layer: 3, tw: Math.random() * 6.28, ts: 0.16 + Math.random() * 0.32,
        col: starCol(), cross: true,
      });
    }

    // Nebulae — 6 elliptical blobs, colorful but tasteful (not gameplay-obstructing)
    this.nebulae = [
      { x: W * 0.14, y: H * 0.18, rx: 170, ry:  95, col: 'rgba(85,18,165,',  a: 0.052 }, // purple
      { x: W * 0.80, y: H * 0.44, rx: 195, ry: 118, col: 'rgba(12,55,185,',  a: 0.046 }, // deep blue
      { x: W * 0.42, y: H * 0.80, rx: 148, ry:  88, col: 'rgba(165,22,55,',  a: 0.040 }, // red
      { x: W * 0.68, y: H * 0.11, rx: 132, ry:  78, col: 'rgba(12,112,68,',  a: 0.038 }, // teal
      { x: W * 0.22, y: H * 0.64, rx: 178, ry: 102, col: 'rgba(105,12,135,', a: 0.048 }, // violet
      { x: W * 0.56, y: H * 0.34, rx: 112, ry:  68, col: 'rgba(185,95,8,',   a: 0.030 }, // amber
    ];

    // Distant spiral galaxy — faint elliptical smudge
    this.galaxy = { x: W * 0.73, y: H * 0.21, rx: 58, ry: 26, angle: 0.55, a: 0.036 };

    // Star cluster — dense knot of dim stars in one corner
    this.cluster = [];
    const cx = W * 0.18, cy = H * 0.82;
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = Math.pow(Math.random(), 0.5) * 38;
      this.cluster.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        r: 0.08 + Math.random() * 0.28,
        a: 0.08 + Math.random() * 0.22,
        col: `hsl(${200 + Math.random()*40},60%,90%)`,
      });
    }
  }

  resize(W, H) { this.W = W; this.H = H; this._init(); }

  draw(ctx, T) {
    // 1. Milky Way band — very faint diagonal diffuse glow (diagonal, top-left to bottom-right)
    const mwG = ctx.createLinearGradient(0, 0, this.W, this.H);
    mwG.addColorStop(0,    'rgba(200,210,255,0)');
    mwG.addColorStop(0.28, 'rgba(200,210,255,0)');
    mwG.addColorStop(0.40, 'rgba(200,210,255,0.014)');
    mwG.addColorStop(0.50, 'rgba(200,215,255,0.026)');
    mwG.addColorStop(0.60, 'rgba(200,210,255,0.014)');
    mwG.addColorStop(0.72, 'rgba(200,210,255,0)');
    mwG.addColorStop(1,    'rgba(200,210,255,0)');
    ctx.fillStyle = mwG;
    ctx.fillRect(0, 0, this.W, this.H);

    // 2. Star cluster — static dense knot
    this.cluster.forEach(s => {
      ctx.globalAlpha = s.a;
      ctx.fillStyle   = s.col;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });

    // 3. Nebulae — elliptical, use ctx.scale for ellipse shape
    this.nebulae.forEach(n => {
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.scale(1, n.ry / n.rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, n.rx);
      g.addColorStop(0,    n.col + (n.a * 2.0).toFixed(3) + ')');
      g.addColorStop(0.38, n.col + n.a.toFixed(3)          + ')');
      g.addColorStop(0.72, n.col + (n.a * 0.38).toFixed(3)+ ')');
      g.addColorStop(1,    n.col + '0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, n.rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // 4. Distant galaxy smudge — tiny oval with bright core
    const gl = this.galaxy;
    ctx.save();
    ctx.translate(gl.x, gl.y);
    ctx.rotate(gl.angle);
    ctx.scale(1, gl.ry / gl.rx);
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, gl.rx);
    gg.addColorStop(0,   `rgba(255,242,200,${gl.a * 3.0})`);
    gg.addColorStop(0.25,`rgba(225,205,160,${gl.a * 1.8})`);
    gg.addColorStop(0.60,`rgba(185,165,120,${gl.a * 0.7})`);
    gg.addColorStop(1,   'rgba(140,120,80,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(0, 0, gl.rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 5. Stars — parallax scroll, twinkle, diffraction spikes on bright ones
    const pax = [0.0, 0.06, 0.16, 0.28];
    this.stars.forEach(s => {
      const sc = T * 14 * pax[s.layer];
      const y  = ((s.y + sc) % (this.H * 1.05) + this.H * 1.05) % (this.H * 1.05);
      const a  = s.a * (0.48 + 0.52 * Math.sin(s.tw + T * s.ts));

      // Glow halo on bigger stars
      if (s.r > 1.0 && s.layer >= 2) {
        const hg = ctx.createRadialGradient(s.x, y, 0, s.x, y, s.r * 3.5);
        hg.addColorStop(0,   `rgba(255,255,255,${(a * 0.20).toFixed(3)})`);
        hg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(s.x, y, s.r * 3.5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.globalAlpha = a;
      ctx.fillStyle   = s.col;
      ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, Math.PI * 2); ctx.fill();

      if (s.cross && s.r > 0.9) {
        ctx.strokeStyle = s.col;
        ctx.lineWidth   = 0.5;
        ctx.globalAlpha = a * 0.42;
        const cl = s.r * 4.2;
        ctx.beginPath(); ctx.moveTo(s.x - cl, y); ctx.lineTo(s.x + cl, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s.x, y - cl); ctx.lineTo(s.x, y + cl); ctx.stroke();
        // Diagonal spikes on giant stars
        if (s.layer === 3) {
          ctx.globalAlpha = a * 0.18;
          const dl = cl * 0.65;
          ctx.beginPath(); ctx.moveTo(s.x - dl, y - dl); ctx.lineTo(s.x + dl, y + dl); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(s.x + dl, y - dl); ctx.lineTo(s.x - dl, y + dl); ctx.stroke();
        }
      }
    });
    ctx.globalAlpha = 1;
  }
}
