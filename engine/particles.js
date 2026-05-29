// engine/particles.js — ParticleSystem with hard pool of 200
const MAX = 200;
export class ParticleSystem {
  constructor() { this.pool = []; this.active = []; }
  reset() { while (this.active.length) this.pool.push(this.active.pop()); }
  _get() { return this.pool.pop() || {}; }
  _spawn(x, y, vx, vy, life, col, r) {
    if (this.active.length >= MAX) return;
    const p = this._get();
    p.x=x; p.y=y; p.vx=vx; p.vy=vy; p.life=life; p.maxLife=life; p.col=col; p.r=r;
    this.active.push(p);
  }
  thrustBurst(x, y, gravDir) {
    for (let i = 0; i < 3; i++) {
      this._spawn(x+(Math.random()-.5)*6, y, (Math.random()-.5)*1.5, gravDir*( 1.5+Math.random()*2),
        .4+Math.random()*.3, Math.random()<.5?'#FF6B00':'#FFB800', 1.5+Math.random()*1.5);
    }
  }
  deathExplosion(x, y, col) {
    for (let i = 0; i < 14; i++) {
      const a = Math.PI*2*i/14+Math.random()*.5, s = 4+Math.random()*3;
      this._spawn(x, y, Math.cos(a)*s, Math.sin(a)*s, .8+Math.random()*.4, col, 2+Math.random()*2.5);
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.PI*2*i/8+Math.random()*.5, s = 2.5+Math.random()*2;
      this._spawn(x, y, Math.cos(a)*s, Math.sin(a)*s, .6+Math.random()*.3, '#FF6B00', 1.5+Math.random()*2);
    }
  }
  gapSparkle(x, y, col) {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI*2*i/7+Math.random()*.5, s = 2+Math.random()*2;
      this._spawn(x, y, Math.cos(a)*s, Math.sin(a)*s-.5, .5+Math.random()*.4, col, 1.5+Math.random()*1.5);
    }
  }
  nearMissBurst(x, y, col) {
    for (let i = 0; i < 10; i++) {
      const a = Math.PI*2*i/10+Math.random()*.5, s = 2+Math.random()*2.5;
      this._spawn(x, y, Math.cos(a)*s, Math.sin(a)*s, .6+Math.random()*.4, col, 1.5+Math.random()*2);
    }
  }
  perfectBurst(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI*2*i/12+Math.random()*.3, s = 3+Math.random()*2;
      this._spawn(x, y, Math.cos(a)*s, Math.sin(a)*s-.5, .7+Math.random()*.3, '#FFD700', 2+Math.random()*2);
    }
  }
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.97;
      p.life -= dt * 1.6;
      if (p.life <= 0) { this.pool.push(this.active.splice(i, 1)[0]); }
    }
  }
  draw(ctx) {
    this.active.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle   = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * Math.max(0, p.life / p.maxLife), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}
