// engine/walls.js — WallManager with object pool + handcrafted pattern pools
const GAP_W   = [0.38, 0.30, 0.24, 0.20, 0.17];
const SPEEDS  = [175,  230,  290,  360,  430 ];
const WALL_H  = 12;
const SECTOR_COLS = ['#22D3EE','#4ADE80','#FB923C','#F472B6','#A78BFA','#FF6B6B','#FFD700','#00FFC8'];

// Handcrafted gap sequences — each value is gapX as fraction of canvas width.
// All tested survivable at max speed. Active from tier 2+.
const WALL_PATTERNS = {
  standard:    [[0.15],[0.25],[0.35],[0.45],[0.55],[0.65],[0.70]],
  zigzag:      [[0.10],[0.60],[0.12],[0.58],[0.14],[0.56]],
  tunnel:      [[0.35],[0.38],[0.40],[0.38],[0.35]],
  fakeout:     [[0.15],[0.18],[0.62],[0.60],[0.20]],
  center_run:  [[0.36],[0.37],[0.38],[0.38],[0.37],[0.36]],
};
const PATTERN_KEYS = Object.keys(WALL_PATTERNS);

export class WallManager {
  constructor(W, H, tier) {
    this.W = W; this.H = H;
    this.walls   = [];
    this.pool    = [];
    this.tier    = tier;
    this.spacing = W * 0.44;
    // Pattern state
    this._currentPattern  = null;
    this._patternIndex    = 0;
    this._patternCooldown = 0;
    this._seed(5);
  }

  _get()       { return this.pool.pop() || {}; }
  _release(w)  { this.pool.push(w); }

  _selectPattern(tier) {
    if (tier < 2) return null; // pure random in early tiers
    return WALL_PATTERNS[PATTERN_KEYS[Math.floor(Math.random() * PATTERN_KEYS.length)]];
  }

  _spawn(x) {
    let gapFraction;
    if (this._currentPattern && this._patternIndex < this._currentPattern.length) {
      gapFraction = this._currentPattern[this._patternIndex][0];
      this._patternIndex++;
      if (this._patternIndex >= this._currentPattern.length) {
        this._currentPattern  = null;
        this._patternCooldown = 3; // 3 random walls before next pattern
      }
    } else if (this._patternCooldown > 0) {
      this._patternCooldown--;
      gapFraction = 0.12 + Math.random() * 0.62;
    } else {
      this._currentPattern = this._selectPattern(this.tier);
      this._patternIndex   = 0;
      gapFraction = 0.12 + Math.random() * 0.62;
    }

    const gw  = this.W * GAP_W[Math.min(this.tier, 4)];
    const mg  = this.W * 0.10;
    // Clamp gap to safe margins
    const gx  = Math.max(mg, Math.min(this.W - gw - mg, this.W * gapFraction));
    const mv  = this.tier > 1 && Math.random() < (0.10 + this.tier * 0.06);
    const w   = this._get();
    w.x = x; w.gapX = gx; w.gapW = gw;
    w.mv = mv; w.oscY = 0; w.oscDir = Math.random() < 0.5 ? 1 : -1;
    w.oscS = 48 + Math.random() * 36; w.oscA = 34;
    w.passed = false; w.scored = false;
    this.walls.push(w);
  }

  _seed(n) { for (let i = 0; i < n; i++) this._spawn(this.W * 0.7 + i * this.spacing); }

  setTier(t) { this.tier = t; }

  update(dt, tier) {
    this.tier = tier;
    const spd = SPEEDS[Math.min(tier, 4)];
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      w.x -= spd * dt;
      if (w.mv) {
        w.oscY += w.oscDir * w.oscS * dt;
        if (Math.abs(w.oscY) > w.oscA) w.oscDir *= -1;
      }
      if (w.x < -this.W * 0.15) { this._release(w); this.walls.splice(i, 1); }
    }
    const last = this.walls.length ? Math.max(...this.walls.map(w => w.x)) : this.W;
    if (last < this.W * 1.2) this._spawn(last + this.spacing);
  }

  getActive() { return this.walls; }

  checkCollision(bounds) {
    for (const w of this.walls) {
      const by = this.H * 0.5 + w.oscY;
      const ax = w.gapX + w.gapW;
      // Left wall panel collision
      if (bounds.right > w.x && bounds.left < w.gapX &&
          bounds.bottom > by && bounds.top < by + WALL_H) return true;
      // Right wall panel collision
      if (bounds.right > ax && bounds.left < ax + this.W &&
          bounds.bottom > by && bounds.top < by + WALL_H) return true;
    }
    return false;
  }

  // Returns { x: gapCenterX, perfect: bool } or null
  checkGapPass(bounds) {
    for (const w of this.walls) {
      if (w.scored) continue;
      const inGap = bounds.right > w.gapX + 3 && bounds.left < w.gapX + w.gapW - 3;
      const cross = bounds.left > w.x && bounds.right > w.gapX + w.gapW * 0.5;
      if (cross && inGap) {
        w.scored = true;
        const gapCenter  = w.gapX + w.gapW / 2;
        const shipCenter = (bounds.left + bounds.right) / 2;
        const offset     = Math.abs(shipCenter - gapCenter);
        const isPerfect  = offset < w.gapW * 0.08;
        return { x: gapCenter, perfect: isPerfect };
      }
      // Wall passed ship but no gap — mark so we don't recheck
      if (cross && !w.scored) w.scored = true;
    }
    return null;
  }

  draw(ctx, tier) {
    const col  = SECTOR_COLS[Math.min(tier, SECTOR_COLS.length - 1)];
    const fill = col + '18';
    this.walls.forEach(w => {
      const by = this.H * 0.5 + w.oscY;
      const ax = w.gapX + w.gapW;
      ctx.fillStyle = fill;
      if (w.gapX > w.x) ctx.fillRect(w.x, 0, w.gapX - w.x, by);
      ctx.fillRect(ax, 0, this.W - ax + 10, by);
      ctx.fillRect(w.x, by + WALL_H, w.gapX - w.x, this.H);
      ctx.fillRect(ax, by + WALL_H, this.W - ax + 10, this.H);
      for (let lw = 0; lw < 3; lw++) {
        ctx.strokeStyle = col;
        ctx.lineWidth   = lw === 0 ? 1.5 : lw === 1 ? 4 : 8;
        ctx.globalAlpha = lw === 0 ? 0.9  : lw === 1 ? 0.35 : 0.15;
        if (w.gapX > w.x) ctx.strokeRect(w.x, 0, w.gapX - w.x, by + WALL_H);
        ctx.strokeRect(ax, 0, this.W - ax + 8, by + WALL_H);
      }
      ctx.globalAlpha = 1;
      // Gap edge markers
      ctx.fillStyle = col;
      ctx.fillRect(w.gapX - 2, by, 2, WALL_H);
      ctx.fillRect(ax, by, 2, WALL_H);
    });
  }
}
