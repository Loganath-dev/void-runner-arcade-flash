// engine/nearmiss.js — NearMissDetector
export class NearMissDetector {
  constructor() { this.active = false; this.timer = 0; this.THRESHOLD = 12; this.SLOW = 0.30; this.DUR = 0.4; }
  check(bounds, walls, score) {
    if (this.active) return null;
    for (const w of walls) {
      if (w.scored) continue;
      const crossing = bounds.right > w.x - 6 && bounds.left < w.x + 10;
      if (!crossing) continue;
      const inGap = bounds.right > w.gapX && bounds.left < w.gapX + w.gapW;
      if (!inGap) continue;
      const cl = bounds.left  - w.gapX;
      const cr = (w.gapX + w.gapW) - bounds.right;
      const minC = Math.min(Math.max(cl, 0), Math.max(cr, 0));
      if (minC < this.THRESHOLD) {
        this.active = true; this.timer = this.DUR;
        return minC < 4 ? 'INSANE!!' : minC < 8 ? 'PERFECT!' : 'CLOSE!';
      }
    }
    return null;
  }
  update(dt) {
    if (!this.active) return 1.0;
    this.timer -= dt;
    if (this.timer <= 0) { this.active = false; return 1.0; }
    return this.SLOW;
  }
}
