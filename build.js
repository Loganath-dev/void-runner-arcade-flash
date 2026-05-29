// build.js — Cloudflare Pages build script
// 1. Validates env vars  2. Generates config.js  3. Copies game files → dist/
import { writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// ── 1. Validate environment variables ────────────────────────────
const required = [
  'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID', 'FIREBASE_MEASUREMENT_ID',
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing environment variables:', missing.join(', '));
  process.exit(1);
}

// ── 2. Generate config.js ─────────────────────────────────────────
const configContent = `// AUTO-GENERATED — do not edit
export const FIREBASE_CONFIG = {
  apiKey:            '${process.env.FIREBASE_API_KEY}',
  authDomain:        '${process.env.FIREBASE_AUTH_DOMAIN}',
  projectId:         '${process.env.FIREBASE_PROJECT_ID}',
  storageBucket:     '${process.env.FIREBASE_STORAGE_BUCKET}',
  messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID}',
  appId:             '${process.env.FIREBASE_APP_ID}',
  measurementId:     '${process.env.FIREBASE_MEASUREMENT_ID}',
};
`;

// ── 3. Copy game files into dist/ ─────────────────────────────────
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry), d = join(dest, entry);
    statSync(s).isDirectory() ? copyDir(s, d) : copyFileSync(s, d);
  }
}

mkdirSync('dist', { recursive: true });

// Root files
for (const f of ['index.html', 'style.css', 'game.js']) copyFileSync(f, join('dist', f));

// Sub-directories
for (const dir of ['engine', 'audio', 'storage']) copyDir(dir, join('dist', dir));

// public/ contents go to dist root (Cloudflare _headers, _redirects, robots.txt)
for (const entry of readdirSync('public')) copyFileSync(join('public', entry), join('dist', entry));

// Write generated config last
writeFileSync(join('dist', 'config.js'), configContent);

console.log('Build complete → dist/ ready for deployment.');
