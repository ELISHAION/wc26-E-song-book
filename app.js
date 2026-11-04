(() => {
'use strict';
/* ---------- storage ---------- */
const LS = {
  g(k, d) { try { const v = localStorage.getItem('wc26_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  s(k, v) { try { localStorage.setItem('wc26_' + k, JSON.stringify(v)); } catch {} }
};
/* ---------- state ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const main = $('#main');
let songs = [], by = {}, index = [], DATES = {};
let favs = LS.g('favs', []), recent = LS.g('recent', []);
const LABEL = { te: 'తెలుగు', rom: 'English', en: 'Lyrics' };

/* ---------- song data layer (only place that knows about songs.json) ---------- */
async function loadSongs() {
  const r = await fetch('songs.json');
  const all = await r.json();
  try { DATES = (await (await fetch('days.json')).json()).dates || {}; } catch { DATES = {}; }
  songs = all;
  by = Object.fromEntries(songs.map(s => [s.id, s]));
  index = songs.map(s => ({
    s, h: [s.title, s.artist, s.album, s.category, s.language, (s.tags || []).join(' '), Object.values(s.lyrics).join(' ')].join(' ').toLowerCase()
  }));
}
function search(q) {
  const t = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!t.length) return [];
  return index.filter(x => t.every(w => x.h.includes(w)))
    .map(x => ({ s: x.s, k: t.some(w => x.s.title.toLowerCase().includes(w)) ? 0 : 1 }))
    .sort((a, b) => a.k - b.k).map(x => x.s);
}

/* ---------- ui helpers ---------- */
const heart = '<svg viewBox="0 0 24 24"><path d="M12 21C5 16.500 2 13 2 9a5 5 0 0 1 10-1.500A5 5 0 0 1 22 9c0 4-3 7.500-10 12z"/></svg>';
const isFav = id => favs.includes(id);
const cover = s => `background:radial-gradient(circle at 25% 20%,hsl(45 85% 72%/.45),transparent 55%),linear-gradient(145deg,hsl(${34 + s.cover % 18} 60% 42%),hsl(${22 + s.cover % 14} 55% 15%))`;
const favBtn = id => `<button class="fav${isFav(id) ? ' on' : ''}" data-fav="${id}" aria-pressed="${isFav(id)}" aria-label="Favorite">${heart}</button>`;
const card = (s, i = 0) => `<article class="card" style="--i:${Math.min(i, 12)}"><a href="#/song/${s.id}" class="art" style="${cover(s)}" aria-hidden="true" tabindex="-1">${esc([...s.title][0])}</a><a href="#/song/${s.id}" class="meta"><b>${esc(s.title)}</b><small>${esc(s.artist)}</small><i>Day ${s.day || 1} · ${esc(s.category)}</i></a>${favBtn(s.id)}</article>`;
const grid = a => `<div class="grid">${a.map((s, i) => card(s, i)).join('')}</div>`;
const empty = (em, t, d) => `<div class="empty"><span class="em" aria-hidden="true">${em}</span><b>${t}</b>${d}</div>`;
const searchBox = v => `<label class="sb"><span aria-hidden="true">⌕</span><input id="q" type="search" autocomplete="off" placeholder="Search songs, artists..." aria-label="Search songs" value="${esc(v)}">${v ? '<button id="clr" aria-label="Clear search">✕</button>' : ''}</label>`;
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2200); }

/* ---------- favorites / recent ---------- */
function toggleFav(id) {
  favs = isFav(id) ? favs.filter(x => x !== id) : [id, ...favs];
  LS.s('favs', favs);
  document.querySelectorAll(`[data-fav="${id}"]`).forEach(b => { b.classList.toggle('on', isFav(id)); b.setAttribute('aria-pressed', isFav(id)); });
  if (location.hash === '#/favs') route();
}
function pushRecent(id) { recent = [id, ...recent.filter(x => x !== id)].slice(0, 20); LS.s('recent', recent); }

/* ---------- day helpers ---------- */
const dayN = d => songs.filter(s => (s.day || 1) === d).length;
const dayHead = d => `Day ${d}${DATES[d] ? ` <small>· ${esc(DATES[d])}</small>` : ''} <small>${dayN(d) ? dayN(d) + ' songs' : 'Not started yet'}</small>`;
const dayEmpty = d => empty('♪', `Day ${d} hasn't started yet`, 'Songs will appear here when this day begins. Please check back soon!');
function wireDays() {
  const box = $('.days'); if (!box) return;
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    const d = +b.dataset.d, prev = LS.g('day', 1); if (d === prev) return;
    LS.s('day', d);
    box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    $('.ind').style.transform = `translateX(${(d - 1) * 100}%)`;
    const l = songs.filter(s => (s.day || 1) === d), dl = $('#dl');
    $('#dh').innerHTML = dayHead(d);
    dl.classList.remove('sl', 'sr'); void dl.offsetWidth;
    dl.innerHTML = l.length ? grid(l) : dayEmpty(d);
    dl.classList.add(d > prev ? 'sl' : 'sr');
  });
}
/* ---------- views ---------- */
const views = {
  home() {
    const N = Math.max(5, ...songs.map(s => s.day || 1)), cur = Math.min(LS.g('day', 1), N);
    const l = songs.filter(s => (s.day || 1) === cur);
    return `<section class="hero"><div class="panel"><img src="worship-conference.png" alt="Worship Conference 2026"><p class="yr">2026 · SONGBOOK</p><p class="sub">Lyrics. Anywhere. Even offline.</p></div>
<a href="#/search" class="sb" aria-label="Search songs"><span aria-hidden="true">⌕</span><span style="color:var(--mut);font-size:17px">Search songs, artists...</span></a></section>
<div class="days" role="tablist" aria-label="Conference days"><span class="ind" style="transform:translateX(${(cur - 1) * 100}%)"></span>${Array.from({ length: N }, (_, i) => `<button role="tab" data-d="${i + 1}" class="${i + 1 === cur ? 'on' : ''}${dayN(i + 1) ? '' : ' soon'}"><small>DAY</small><b>${i + 1}</b>${DATES[i + 1] ? `<em>${esc(DATES[i + 1])}</em>` : ''}</button>`).join('')}</div>
<h2 id="dh">${dayHead(cur)}</h2><div id="dl">${l.length ? grid(l) : dayEmpty(cur)}</div>`;
  },
  search() {
    return `<div style="padding-top:24px">${searchBox('')}</div><div id="res"></div>`;
  },
  favs() {
    const a = favs.map(i => by[i]).filter(Boolean);
    return `<h2 style="margin-top:28px">Your Favorites</h2>` + (a.length ? grid(a) : empty('♡', 'No favorites yet', 'Tap the heart on any song and it will be saved here — even offline.'));
  },
  recent() {
    const a = recent.map(i => by[i]).filter(Boolean);
    return `<h2 style="margin-top:28px">Recently Viewed</h2>` + (a.length ? grid(a) : empty('◷', 'Nothing viewed yet', 'Songs you open will show up here for quick access.'));
  },
  song(id) {
    const s = by[id];
    if (!s) return empty('♪', 'Song not found', '<a href="#/" style="color:var(--ac)">Back to home</a>');
    pushRecent(id);
    const keys = Object.keys(s.lyrics);
    const sib = songs.filter(x => (x.day || 1) === (s.day || 1)), si = sib.findIndex(x => x.id === id), pv = sib[si - 1], nx = sib[si + 1];
    let k = LS.g('lang', keys[0]); if (!keys.includes(k)) k = keys[0];
    const body = k => s.lyrics[k].split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    setTimeout(() => {
      const ly = $('#ly');
      document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { LS.s('lang', b.dataset.k); ly.innerHTML = body(b.dataset.k); document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); });
    });
    return `<div class="rh"><button class="ib" onclick="history.length>1?history.back():location.hash='#/'" aria-label="Back">←</button><div class="t"><h1>${esc(s.title)}</h1><small>Day ${s.day || 1} · ${esc(s.artist)}</small></div>${favBtn(id).replace('class="fav', 'class="ib fav').replace(/position:absolute/, '')}</div>
${keys.length > 1 ? `<div class="tabs" role="tablist">${keys.map(x => `<button data-k="${x}" role="tab" class="${x === k ? 'on' : ''}">${LABEL[x] || x}</button>`).join('')}</div>` : ''}
<div class="ly" id="ly">${body(k)}</div>
<nav class="pn" aria-label="Songs on this day">${pv ? `<a href="#/song/${pv.id}">← ${esc(pv.title)}</a>` : '<span></span>'}${nx ? `<a href="#/song/${nx.id}">${esc(nx.title)} →</a>` : ''}</nav>`;
  }
};

/* ---------- search wiring ---------- */
function wireSearch() {
  const q = $('#q'); if (!q) return;
  const res = $('#res');
  const run = () => {
    const v = q.value.trim();
    const sb = $('.sb'); const c = $('#clr');
    if (v && !c) sb.insertAdjacentHTML('beforeend', '<button id="clr" aria-label="Clear search">✕</button>');
    if (!v && c) c.remove();
    if (!v) {
      const tags = [...new Set(songs.flatMap(s => [s.category, ...(s.tags || [])]))].slice(0, 12);
      res.innerHTML = `<div class="chips" aria-label="Suggestions">${tags.map(t => `<button class="chip" data-s="${esc(t)}">${esc(t)}</button>`).join('')}</div>` + empty('⌕', 'Find your song', 'Search by title, artist, album, tag or a line of lyrics.');
      return;
    }
    const r = search(v);
    res.innerHTML = r.length ? `<h2>${r.length} result${r.length > 1 ? 's' : ''}</h2>${grid(r)}` : empty('🎧', 'No matches found', 'Try a different title, artist or word.');
  };
  q.addEventListener('input', run); run(); q.focus({ preventScroll: true });
}
document.addEventListener('click', e => {
  const f = e.target.closest('[data-fav]'); if (f) { e.preventDefault(); toggleFav(f.dataset.fav); return; }
  const c = e.target.closest('#clr'); if (c) { const q = $('#q'); q.value = ''; q.dispatchEvent(new Event('input')); q.focus(); return; }
  const ch = e.target.closest('[data-s]'); if (ch) { const q = $('#q'); q.value = ch.dataset.s; q.dispatchEvent(new Event('input')); }
});

/* ---------- router ---------- */
function render() {
  const [, r = '', id] = location.hash.slice(1).split('/');
  const name = r || 'home';
  const v = views[name] || views.home;
  main.style.animation = 'none'; main.offsetHeight; main.style.animation = '';
  main.innerHTML = v(id ? decodeURIComponent(id) : undefined);
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.r === (name === 'song' ? 'home' : name)));
  $('#prog').style.width = 0;
  if (name !== 'search' || !$('#q')) window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'search') wireSearch();
  if (name === 'home') wireDays();
  renderGreet();
}
function route() { render(); }
addEventListener('scroll', () => {
  if (!location.hash.startsWith('#/song/')) return;
  const h = document.documentElement; const m = h.scrollHeight - innerHeight;
  $('#prog').style.width = (m > 0 ? Math.min(100, scrollY / m * 100) : 0) + '%';
}, { passive: true });
addEventListener('hashchange', route);

/* ---------- theme, share, install, offline ---------- */
$('#theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; LS.s('theme', t);
  $('meta[name=theme-color]').content = t === 'dark' ? '#0a0907' : '#f7f2e8';
};
$('#share').onclick = async () => {
  const url = location.origin + location.pathname;
  const data = { title: 'WC 2026 Songs', text: "The Lord's Church Worship Conference 2026 songs — works offline.", url };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Link copied — send it to a friend'); } catch { prompt('Copy this link', url); }
};
let dip; addEventListener('beforeinstallprompt', e => { e.preventDefault(); dip = e; $('#inst').hidden = false; });
$('#inst').onclick = async () => { if (!dip) return; dip.prompt(); await dip.userChoice; dip = null; $('#inst').hidden = true; };
const net = () => { $('#off').hidden = navigator.onLine; };
addEventListener('online', net); addEventListener('offline', net); net();

/* ---------- sign-in (Google Sheet via Apps Script) + greeting ---------- */
const API = (window.WC_API || '').trim();
let user = LS.g('user', null);
const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
function renderGreet() {
  const g = $('#greet'); if (!g) return;
  if (!user) { g.hidden = true; return; }
  g.hidden = false;
  g.innerHTML = `<div><b>Hi ${esc(user.username)}, ${hello()}</b><span>Praise the Lord 🙏</span></div><button id="out" type="button">Sign out</button>`;
}
async function signIn(d) {
  if (!API) return { ok: true, username: d.username, local: true };
  if (!navigator.onLine) return { ok: false, error: 'offline' };
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(d), signal: ac.signal });
    return await r.json();
  } catch { return { ok: false, error: 'network' }; } finally { clearTimeout(tm); }
}
const MSG = { invalid: 'Please check your details.', email_used: 'This email is already registered with a different phone number.', offline: 'Connect to the internet once to sign in.', network: 'Could not reach the server. Please try again.', server: 'Something went wrong. Please try again.' };
function showLogin() {
  if ($('#login')) return;
  const el = document.createElement('div'); el.id = 'login';
  el.innerHTML = `<form class="lg" novalidate><img src="lords-church.png" alt=""><h1>Welcome</h1><p class="lead">Praise the Lord! Sign in once to open the Worship Conference 2026 songbook.</p>
<label>Username<input name="u" autocomplete="username" maxlength="40" required></label>
<label>Phone number<input name="p" type="tel" inputmode="numeric" autocomplete="tel" maxlength="15" placeholder="10-digit mobile number" required></label>
<label>Email<input name="e" type="email" inputmode="email" autocomplete="email" maxlength="80" placeholder="you@example.com" required></label>
<p class="err" role="alert"></p><button class="go" type="submit">Continue</button></form>`;
  document.body.append(el);
  const f = $('form', el), err = $('.err', el), go = $('.go', el);
  f.onsubmit = async e => {
    e.preventDefault();
    const v = n => f.elements[n].value.trim();
    const d = { username: v('u'), phone: v('p').replace(/\D/g, '').slice(-10), email: v('e').toLowerCase() };
    if (d.username.length < 2) return err.textContent = 'Enter your name.';
    if (d.phone.length < 10) return err.textContent = 'Enter a valid 10-digit phone number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return err.textContent = 'Enter a valid email address.';
    err.textContent = ''; go.disabled = true; go.textContent = 'Please wait…';
    const r = await signIn(d);
    if (!r.ok) { err.textContent = MSG[r.error] || MSG.server; go.disabled = false; go.textContent = 'Continue'; return; }
    user = { username: r.username || d.username, phone: d.phone }; LS.s('user', user);
    el.remove(); renderGreet(); toast('Praise the Lord, ' + user.username + '!');
  };
}
document.addEventListener('click', e => { if (e.target.id === 'out' && confirm('Sign out from this device?')) { user = null; LS.s('user', null); renderGreet(); showLogin(); } });
setInterval(renderGreet, 300000);
/* ---------- splash ---------- */
let ready; const loaded = new Promise(r => ready = r);
const sp = $('#splash');
if (sp && !document.documentElement.classList.contains('nosplash')) {
  document.documentElement.classList.add('ready');
  const hide = () => { sp.classList.add('out'); setTimeout(() => sp.remove(), 900); try { sessionStorage.setItem('wc26_splash', 1); } catch {} };
  sp.onclick = hide; setTimeout(() => loaded.then(hide), 3300);
}
/* ---------- boot ---------- */
if (!user) showLogin(); else renderGreet();
loadSongs().then(route).finally(ready).catch(() => { main.innerHTML = location.protocol === 'file:' ? empty('♪', 'Start a local server', 'This page was opened as a file. Run <code>python -m http.server 8000</code> in this folder, then open http://localhost:8000') : empty('♪', 'Lyrics unavailable', 'Open this app once while online to save your library.'); });
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
