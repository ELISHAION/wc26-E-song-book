// Vercel build step: copies the site into dist/ and writes dist/config.js from the WC_API_URL environment variable.
const fs = require('fs'), path = require('path');
const FILES = ['index.html', 'app.js', 'sw.js', 'config.js', 'songs.json', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'icon-maskable-512.png', 'favicon.png', 'lords-church.png', 'worship-conference.png', 'cormorant-garamond-italic.woff2'];
const url = (process.env.WC_API_URL || '').trim();
if (process.env.VERCEL && !/^https:\/\/script\.google\.com\/.+/.test(url)) {
  console.error('\nERROR: set the WC_API_URL environment variable in Vercel (Project → Settings → Environment Variables) to your Apps Script Web app URL, then redeploy.\n');
  process.exit(1);
}
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');
for (const f of FILES) fs.copyFileSync(f, path.join('dist', f));
fs.writeFileSync('dist/config.js', `window.WC_API = ${JSON.stringify(url)};\n`);
console.log('Built dist/ —', url ? 'sign-in connected to Google Sheet' : 'LOCAL MODE (no WC_API_URL set)');
