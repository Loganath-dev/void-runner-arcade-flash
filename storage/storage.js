// storage/storage.js — Persistent data layer
// Stores: best score, ghost run, streak, UFO skins, missions, daily score

const K = {
  BEST:'vr_best', BEST_HASH:'vr_best_hash',
  GHOST_PATH:'vr_ghost_path', GHOST_SCORE:'vr_ghost_score',
  SESSIONS:'vr_sessions', FIRST_VISIT:'vr_first_visit',
  STREAK:'vr_streak', LAST_PLAY:'vr_last_play',
  SKINS:'vr_skins', ACTIVE_SKIN:'vr_active_skin',
  MISSIONS:'vr_missions',
  DAILY_PFX:'vr_daily_',
  ONFIRE_HINT:'vr_onfire_hint',
};

export class StorageUtils {
  // djb2 hash with embedded salt — not cryptographic but not trivially reversible from observable values
  static _h(n) {
    const s = 'vr·' + n + '·arcadeflash·2024·xk9m';
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = Math.imul((h << 5) + h, 1) ^ s.charCodeAt(i);
    return (h >>> 0).toString(36);
  }

  // ── Best score ──────────────────────────────────────────────────────
  static getBest() {
    const raw = localStorage.getItem(K.BEST); if (!raw) return 0;
    const s = parseInt(raw, 10);
    if (localStorage.getItem(K.BEST_HASH) !== this._h(s) || s > 9999) { this.clearBest(); return 0; }
    return s;
  }
  static setBest(s) { localStorage.setItem(K.BEST, String(s)); localStorage.setItem(K.BEST_HASH, this._h(s)); }
  static clearBest() { localStorage.removeItem(K.BEST); localStorage.removeItem(K.BEST_HASH); }

  // ── Ghost run (position-based replay) ───────────────────────────────
  static getGhostPath() {
    try {
      const r = localStorage.getItem(K.GHOST_PATH);
      if (!r) return null;
      const path = JSON.parse(r);
      if (!Array.isArray(path)) return null;
      return path.every(p => p && typeof p.x === 'number' && typeof p.y === 'number' && isFinite(p.x) && isFinite(p.y))
        ? path : null;
    } catch { return null; }
  }
  static setGhostPath(p)  { try { localStorage.setItem(K.GHOST_PATH, JSON.stringify(p)); } catch(e) { localStorage.removeItem(K.GHOST_PATH); } }
  static getGhostScore()  { return parseInt(localStorage.getItem(K.GHOST_SCORE) || '0', 10); }
  static setGhostScore(s) { localStorage.setItem(K.GHOST_SCORE, String(s)); }

  // ── Session tracking ────────────────────────────────────────────────
  static incrementSession()   { const n = this.getSessionCount() + 1; localStorage.setItem(K.SESSIONS, String(n)); return n; }
  static getSessionCount()    { return parseInt(localStorage.getItem(K.SESSIONS) || '0', 10); }
  static recordFirstVisit()   { if (!localStorage.getItem(K.FIRST_VISIT)) { localStorage.setItem(K.FIRST_VISIT, new Date().toISOString()); return true; } return false; }
  static isReturningVisitor() { const f = localStorage.getItem(K.FIRST_VISIT); if (!f) return false; return (Date.now() - new Date(f).getTime()) >= 86400000; }

  // ── Daily streak ────────────────────────────────────────────────────
  static getStreak()      { return parseInt(localStorage.getItem(K.STREAK) || '0', 10); }
  static getLastPlayDate(){ return localStorage.getItem(K.LAST_PLAY) || ''; }
  static updateStreak() {
    const today     = new Date().toDateString();
    const last      = this.getLastPlayDate();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (last === today) return this.getStreak(); // already played today
    let streak = this.getStreak();
    streak = (last === yesterday) ? streak + 1 : 1; // consecutive or reset
    localStorage.setItem(K.STREAK, String(streak));
    localStorage.setItem(K.LAST_PLAY, today);
    return streak;
  }

  // ── UFO Skins ───────────────────────────────────────────────────────
  static getUnlockedSkins() { try { const r = localStorage.getItem(K.SKINS); return r ? JSON.parse(r) : ['default']; } catch { return ['default']; } }
  static unlockSkin(id) {
    const s = this.getUnlockedSkins();
    if (!s.includes(id)) { s.push(id); localStorage.setItem(K.SKINS, JSON.stringify(s)); }
  }
  static getActiveSkin()  { return localStorage.getItem(K.ACTIVE_SKIN) || 'default'; }
  static setActiveSkin(id){ localStorage.setItem(K.ACTIVE_SKIN, id); }

  // ── Missions ────────────────────────────────────────────────────────
  static getCompletedMissions() { try { const r = localStorage.getItem(K.MISSIONS); return r ? JSON.parse(r) : []; } catch { return []; } }
  static completeMission(id) {
    const done = this.getCompletedMissions();
    if (!done.includes(id)) { done.push(id); localStorage.setItem(K.MISSIONS, JSON.stringify(done)); }
  }
  static isMissionDone(id) { return this.getCompletedMissions().includes(id); }

  // ── Daily challenge score ───────────────────────────────────────────
  static _dayKey()           { return K.DAILY_PFX + new Date().toDateString().replace(/ /g, '_'); }
  static _yesterdayKey()     { return K.DAILY_PFX + new Date(Date.now() - 86400000).toDateString().replace(/ /g, '_'); }
  static getDailyScore()     { return parseInt(localStorage.getItem(this._dayKey()) || '0', 10); }
  static getYesterdayScore() { return parseInt(localStorage.getItem(this._yesterdayKey()) || '0', 10); }
  static setDailyScore(s)    { const k = this._dayKey(); if (s > (parseInt(localStorage.getItem(k)||'0',10))) localStorage.setItem(k, String(s)); }

  // ── ON FIRE hint (show once) ────────────────────────────────────────
  static hasSeenOnFireHint() { return !!localStorage.getItem(K.ONFIRE_HINT); }
  static setOnFireHintSeen() { localStorage.setItem(K.ONFIRE_HINT, '1'); }
}
