// Vercel build step: copies the site into dist/ and writes dist/config.js from the WC_API_URL environment variable.
const fs = require('fs'), path = require('path');
const FILES = ['index.html', 'app.js', 'sw.js', 'config.js', 'songs.json', 'days.json', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'icon-maskable-512.png', 'favicon.png', 'lords-church.png', 'worship-conference.png', 'cormorant-garamond-italic.woff2'];
const url = (process.env.WC_API_URL || '').trim();
if (process.env.VERCEL && !/^https:\/\/script\.google\.com\/.+/.test(url)) {
  console.error('\nERROR: set the WC_API_URL environment variable in Vercel (Project → Settings → Environment Variables) to your Apps Script Web app URL, then redeploy.\n');
  process.exit(1);
}
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');
const OPTIONAL = ['days.json', 'config.js', 'icon-maskable-512.png', 'cormorant-garamond-italic.woff2'];
try {
  const s = JSON.parse(fs.readFileSync('songs.json', 'utf8'));
  if (!Array.isArray(s) || !s.length) throw new Error('songs.json must be a list with at least one song');
  s.forEach((x, i) => { if (!x.id || !x.title || !x.lyrics) throw new Error(`song #${i + 1} (${x.title || x.id || 'no title'}) is missing id, title or lyrics`); });
  console.log(`songs.json OK: ${s.length} songs`);
} catch (e) { console.error('\nERROR: songs.json is not valid -> ' + e.message + '\n(Tip: paste the file into jsonlint.com to find the broken line. A comma after the last song is the usual cause.)\n'); process.exit(1); }
for (const f of FILES) {
  if (!fs.existsSync(f)) { if (OPTIONAL.includes(f)) { console.warn('skipped missing optional file: ' + f); continue; } console.error('\nERROR: required file missing from the repo: ' + f + '\n'); process.exit(1); }
  fs.copyFileSync(f, path.join('dist', f));
}
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/config.js', `window.WC_API = ${JSON.stringify(url)};\n`);
console.log('Built dist/ —', url ? 'sign-in connected to Google Sheet' : 'LOCAL MODE (no WC_API_URL set)');
