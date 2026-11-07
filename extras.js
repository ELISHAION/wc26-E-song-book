/* Extras: (1) colour palettes on the ◐ button  (2) Worship mode on every song page.  Self-contained: needs only extras.css + app.js. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const LSg = (k, d) => { try { const v = localStorage.getItem('wc26_' + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const LSs = (k, v) => { try { localStorage.setItem('wc26_' + k, JSON.stringify(v)); } catch {} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = m => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2200); };

/* ===== 1. colour palettes: tap ◐ to cycle ===== */
const THEMES = [['dark', 'Ruby & Gold', '#12060a'], ['sapphire', 'Midnight Sapphire', '#050a17'], ['emerald', 'Emerald Night', '#030f0b'], ['light', 'Ivory Rose', '#fbf3ea']];
const meta = $('meta[name=theme-color]');
const applyTheme = k => { const t = THEMES.find(x => x[0] === k) || THEMES[0]; document.documentElement.dataset.theme = t[0]; if (meta) meta.content = t[2]; return t; };
const tb = $('#theme');
if (tb) {
  tb.innerHTML = '<span class="pal" aria-hidden="true"></span>';
  tb.setAttribute('aria-label', 'Change colours');
  applyTheme(document.documentElement.dataset.theme);
  tb.onclick = () => {
    const i = THEMES.findIndex(x => x[0] === document.documentElement.dataset.theme);
    const t = applyTheme(THEMES[(i + 1) % THEMES.length][0]);
    LSs('theme', t[0]); toast(t[1]);
  };
}

/* ===== 2. worship mode ===== */
const LABEL = { te: 'తెలుగు', rom: 'English', en: 'Lyrics' };
let songs = null, wm = null, wake = null, hideT = 0;
const parse = t => {   // same forgiving reader as the app (raw line breaks, trailing commas)
  try { return JSON.parse(t); } catch {}
  let o = '', s = false, e = false;
  for (const c of t.replace(/^\uFEFF/, '')) {
    if (!s) { if (c === '"') s = true; o += c; continue; }
    if (e) { o += c; e = false; } else if (c === '\\') { o += c; e = true; } else if (c === '"') { o += c; s = false; }
    else if (c === '\n') o += '\\n'; else if (c === '\r') { /* drop */ } else if (c === '\t') o += '\\t'; else if (c < ' ') o += ' '; else o += c;
  }
  return JSON.parse(o.replace(/,(\s*[\]}])/g, '$1'));
};
const loadSongs = async () => songs || (songs = parse(await (await fetch('songs.json')).text()));
const keepAwake = async () => { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch {} return !!wake; };
const letGo = () => { try { wake && wake.release(); } catch {} wake = null; };
document.addEventListener('visibilitychange', () => { if (wm && document.visibilityState === 'visible') keepAwake(); });

async function openWorship(id) {
  if (wm) return;
  let all; try { all = await loadSongs(); } catch { toast('Songs could not be loaded'); return; }
  const day = (all.find(s => s.id === id) || {}).day || 1;
  const list = all.filter(s => (s.day || 1) === day);
  let i = Math.max(0, list.findIndex(s => s.id === id)), size = LSg('wm_size', 30);
  const el = wm = document.createElement('div');
  el.id = 'wm'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Worship mode');
  el.innerHTML = `<div class="wm-stage" tabindex="0"><div class="wm-ly"></div></div>
<div class="wm-bar wm-top"><button class="wm-b" data-a="close" type="button" aria-label="Close worship mode">✕</button><div class="wm-t"><b></b><small></small></div><div class="wm-ctl"><button class="wm-b" data-a="lang" type="button" aria-label="Change language"></button><button class="wm-b" data-a="smaller" type="button" aria-label="Smaller text">A−</button><button class="wm-b" data-a="bigger" type="button" aria-label="Bigger text">A+</button></div></div>
<div class="wm-bar wm-bot"><button class="wm-b" data-a="prev" type="button" aria-label="Previous song">‹</button><span class="wm-n"></span><button class="wm-b" data-a="next" type="button" aria-label="Next song">›</button></div>`;
  document.body.append(el);
  const lock = v => ['.col', '.nav'].forEach(s => { const n = $(s); if (n) n.inert = v; });
  lock(true);
  const stage = $('.wm-stage', el), ly = $('.wm-ly', el), q = a => $(`[data-a=${a}]`, el);
  const keyOf = s => { const ks = Object.keys(s.lyrics), k = LSg('lang', ks[0]); return ks.includes(k) ? k : ks[0]; };
  const poke = () => { el.classList.remove('hide'); clearTimeout(hideT); hideT = setTimeout(() => el.classList.add('hide'), 5000); };
  const render = dir => {
    const s = list[i], ks = Object.keys(s.lyrics), k = keyOf(s);
    $('.wm-t b', el).textContent = s.title; $('.wm-t small', el).textContent = `Day ${s.day || 1} · ${s.artist}`;
    q('lang').textContent = LABEL[k] || k; q('lang').hidden = ks.length < 2;
    ly.style.fontSize = size + 'px';
    ly.innerHTML = s.lyrics[k].split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    stage.scrollTop = 0; $('.wm-n', el).textContent = `${i + 1} / ${list.length}`;
    ly.classList.remove('wm-l', 'wm-r'); void ly.offsetWidth; if (dir) ly.classList.add(dir > 0 ? 'wm-l' : 'wm-r');
    q('prev').disabled = i === 0; q('next').disabled = i === list.length - 1;
  };
  const go = d => { const n = i + d; if (n >= 0 && n < list.length) { i = n; render(d); poke(); } };
  const resize = d => { size = Math.max(20, Math.min(56, size + d)); LSs('wm_size', size); ly.style.fontSize = size + 'px'; poke(); };
  const close = () => {
    document.removeEventListener('keydown', onKey); clearTimeout(hideT); letGo(); lock(false);
    const goto = list[i].id; wm = null; el.classList.add('out'); setTimeout(() => el.remove(), 260);
    if (goto !== id) location.hash = '#/song/' + encodeURIComponent(goto);
  };
  const onKey = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === '+' || e.key === '=') resize(3); else if (e.key === '-') resize(-3); };
  const act = { close, prev: () => go(-1), next: () => go(1), bigger: () => resize(3), smaller: () => resize(-3),
    lang: () => { const s = list[i], ks = Object.keys(s.lyrics); LSs('lang', ks[(ks.indexOf(keyOf(s)) + 1) % ks.length]); render(); poke(); } };
  el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) act[b.dataset.a](); });
  stage.addEventListener('click', () => { if (el.classList.toggle('hide')) clearTimeout(hideT); else poke(); });   // tap the lyrics to show / hide the buttons
  let sx = 0, sy = 0;
  stage.addEventListener('touchstart', e => { sx = e.changedTouches[0].clientX; sy = e.changedTouches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); }, { passive: true });
  document.addEventListener('keydown', onKey);
  render(); poke(); stage.focus({ preventScroll: true });
  keepAwake().then(ok => { if (ok) toast('Screen will stay on'); });
}

/* add the "Aa Worship" button to the song page header */
const addBtn = () => {
  const rh = $('.rh'); if (!rh || $('#wmBtn')) return;
  const b = document.createElement('button');
  b.id = 'wmBtn'; b.type = 'button'; b.className = 'ib'; b.setAttribute('aria-label', 'Worship mode: big lyrics, swipe between songs');
  b.innerHTML = '<span aria-hidden="true">Aa</span><span class="wl">Worship</span>';
  rh.insertBefore(b, $('.fav', rh));
};
const main = $('#main');
if (main) { new MutationObserver(addBtn).observe(main, { childList: true }); addBtn(); }
document.addEventListener('click', e => { if (e.target.closest('#wmBtn')) { const id = decodeURIComponent((location.hash.split('/')[2] || '')); if (id) openWorship(id); } });
})();
