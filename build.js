// Vercel build step: copies the site into dist/ and writes dist/config.js from the WC_API_URL environment variable.
const fs = require('fs'), path = require('path');
const FILES = ['index.html', 'app.js', 'sw.js', 'config.js', 'songs.json', 'days.json', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'icon-maskable-512.png', 'favicon.png', 'lords-church.png', 'worship-conference.png', 'wc-video.mp4', 'wc-video-poster.jpg', 'cormorant-garamond-italic.woff2'];
function repairJson(t) {   // forgives the usual hand-editing slips: raw line breaks/tabs inside lyrics, trailing commas, BOM
  let o = '', inStr = false, esc = false;
  for (const c of t.replace(/^\uFEFF/, '')) {
    if (!inStr) { if (c === '"') inStr = true; o += c; continue; }
    if (esc) { o += c; esc = false; }
    else if (c === '\\') { o += c; esc = true; }
    else if (c === '"') { o += c; inStr = false; }
    else if (c === '\n') o += '\\n';
    else if (c === '\r') { /* drop */ }
    else if (c === '\t') o += '\\t';
    else if (c < ' ') o += ' ';
    else o += c;
  }
  return o;
}
function parseSongs(t) {
  try { return JSON.parse(t); } catch {}
  const fixed = repairJson(t);
  try { return JSON.parse(fixed); } catch {}
  return JSON.parse(fixed.replace(/,(\s*[\]}])/g, '$1'));
}

const url = (process.env.WC_API_URL || '').trim();
let fb = null;
const fbRaw = (process.env.WC_FIREBASE_CONFIG || '').trim();
if (fbRaw) {
  try {
    try { fb = JSON.parse(fbRaw); } catch { fb = Function('"use strict";return (' + fbRaw + ')')(); }   // also accepts the object exactly as Firebase shows it
    if (!fb || !fb.apiKey || !fb.projectId || !fb.appId) throw new Error('it must contain apiKey, projectId and appId');
  } catch (e) { console.error('\nERROR: WC_FIREBASE_CONFIG is not valid (' + e.message + '). Paste the firebaseConfig object from Firebase console → Project settings → Your apps.\n'); process.exit(1); }
}
if (process.env.VERCEL && !fb && !/^https:\/\/script\.google\.com\/.+/.test(url)) {
  console.error('\nERROR: set the WC_FIREBASE_CONFIG environment variable in Vercel (Project → Settings → Environment Variables) to your Firebase web config, then redeploy.\n');
  process.exit(1);
}
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');
const OPTIONAL = ['wc-video.mp4', 'wc-video-poster.jpg', 'days.json', 'config.js', 'icon-maskable-512.png', 'cormorant-garamond-italic.woff2'];
try {
  const raw = fs.readFileSync('songs.json', 'utf8');
  const s = parseSongs(raw);
  try { JSON.parse(raw); } catch { fs.writeFileSync('songs.fixed.json', JSON.stringify(s)); console.warn('WARNING: songs.json had formatting slips (raw line breaks / trailing comma). They were repaired automatically for the live site - please fix the source file.'); }
  if (!Array.isArray(s) || !s.length) throw new Error('songs.json must be a list with at least one song');
  s.forEach((x, i) => { if (!x.id || !x.title || !x.lyrics) throw new Error(`song #${i + 1} (${x.title || x.id || 'no title'}) is missing id, title or lyrics`); });
  console.log(`songs.json OK: ${s.length} songs`);
} catch (e) { console.error('\nERROR: songs.json is not valid -> ' + e.message + '\n(Tip: paste the file into jsonlint.com to find the broken line. A comma after the last song is the usual cause.)\n'); process.exit(1); }
for (const f of FILES) {
  if (!fs.existsSync(f)) { if (OPTIONAL.includes(f)) { console.warn('skipped missing optional file: ' + f); continue; } console.error('\nERROR: required file missing from the repo: ' + f + '\n'); process.exit(1); }
  fs.copyFileSync(f, path.join('dist', f));
}
fs.mkdirSync('dist', { recursive: true });
if (fs.existsSync('songs.fixed.json')) { fs.copyFileSync('songs.fixed.json', 'dist/songs.json'); fs.unlinkSync('songs.fixed.json'); }
fs.writeFileSync('dist/config.js', `window.WC_API = ${JSON.stringify(url)};\nwindow.WC_FIREBASE = ${JSON.stringify(fb)};\n`);
console.log('Built dist/ —', fb ? 'sign-in connected to FIREBASE (' + fb.projectId + ')' : url ? 'sign-in connected to Google Sheet' : 'LOCAL MODE (no WC_FIREBASE_CONFIG / WC_API_URL set)');
