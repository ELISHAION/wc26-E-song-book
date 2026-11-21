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
let songs = [], by = {}, index = [], weeks = [];
let favs = LS.g('favs', []), recent = LS.g('recent', []);
const LABEL = { te: 'తెలుగు', rom: 'English', en: 'Lyrics' };

/* ---------- song library (songs.json) ---------- */
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
async function loadSongs() {
  const r = await fetch('songs.json');
  songs = parseSongs(await r.text());
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

/* ---------- Sunday sheet (sunday.txt): songs of the week + sermon summary ---------- */
const WKEYS = ['date', 'title', 'sermon', 'speaker', 'scripture', 'summary', 'points', 'songs', 'intro', 'image', 'youtube'];
function parseWeeks(t) {
  return t.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/^\s*---+\s*$/m).map(block => {
    const w = { date: '', title: '', sermon: '', speaker: '', scripture: '', summary: '', points: [], songs: [], intro: '', image: '', youtube: '' };
    let k = null, any = false;
    for (const raw of block.split('\n')) {
      const l = raw.trim();
      if (l.startsWith('#')) continue;                                   // comment line
      const m = /^([a-z]+)\s*:\s*(.*)$/i.exec(l);
      if (m && WKEYS.includes(m[1].toLowerCase())) {
        k = m[1].toLowerCase(); any = true; const v = m[2].trim();
        if (k === 'points' || k === 'songs') { if (v) w[k].push(v.replace(/^[-•*]\s*/, '')); } else w[k] = v;
        continue;
      }
      if (!k) continue;
      if (k === 'points' || k === 'songs') { if (l) w[k].push(l.replace(/^[-•*]\s*/, '')); }
      else if (k === 'summary') {
        if (l) w.summary += (w.summary === '' || w.summary.endsWith('\n\n') ? '' : ' ') + l;
        else if (w.summary && !w.summary.endsWith('\n\n')) w.summary += '\n\n';
      }
    }
    w.summary = w.summary.trim();
    return any && (w.date || w.songs.length || w.sermon || w.summary) ? w : null;
  }).filter(Boolean);
}
async function loadWeeks() {
  weeks = [];
  try {
    const r = await fetch('sunday.txt', { cache: 'no-cache' });
    if (!r.ok) return;
    const find = n => { const k = String(n).trim().toLowerCase(); return by[n] || songs.find(s => s.id.toLowerCase() === k || s.title.toLowerCase() === k); };
    weeks = parseWeeks(await r.text()).map(w => ({ ...w, list: w.songs.map(find).filter(Boolean) })).sort((a, b) => b.date.localeCompare(a.date));
  } catch {}
}
const contextList = id => { for (const w of weeks) if (w.list.some(s => s.id === id)) return w.list; return songs; };   // prev / next follows the Sunday list
window.TLC = { get songs() { return songs; }, contextList };                                                              // used by extras.js (worship mode)
const fmtDate = d => { const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };

/* ---------- ui helpers ---------- */
const heart = '<svg viewBox="0 0 24 24"><path d="M12 21C5 16.5 2 13 2 9a5 5 0 0 1 10-1.5A5 5 0 0 1 22 9c0 4-3 7.5-10 12z"/></svg>';
const isFav = id => favs.includes(id);
const cover = s => `background:radial-gradient(circle at 25% 20%,hsl(45 85% 72%/.45),transparent 55%),linear-gradient(145deg,hsl(${34 + s.cover % 18} 60% 42%),hsl(${22 + s.cover % 14} 55% 15%))`;
const favBtn = id => `<button class="fav${isFav(id) ? ' on' : ''}" data-fav="${id}" aria-pressed="${isFav(id)}" aria-label="Favorite">${heart}</button>`;
const card = (s, i = 0) => `<article class="card" style="--i:${Math.min(i, 12)}"><a href="#/song/${s.id}" class="art" style="${cover(s)}" aria-hidden="true" tabindex="-1">${esc([...s.title][0])}</a><a href="#/song/${s.id}" class="meta"><b>${esc(s.title)}</b><small>${esc(s.artist)}</small><i>${esc(s.category)}</i></a>${favBtn(s.id)}</article>`;
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

/* ---------- Sunday sheet views ---------- */
const hasSermon = w => !!(w.sermon || w.summary || w.points.length);
const ICON_CHURCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1.5v4M10.2 3.2h3.6"/><path d="M12 5.8l4.2 2.6V21H7.8V8.4z"/><path d="M7.8 11.5H3.5V21h4.3M16.2 11.5h4.3V21h-4.3"/><path d="M10.3 21v-4a1.7 1.7 0 0 1 3.4 0v4M12 9.6v2.4M10.9 10.7h2.2"/></svg>';
const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg>';
const fmtUS = d => { const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(); };
const introOf = w => { if (w.intro) return w.intro; const t = (w.summary || '').split('\n\n')[0], m = /^.*?[.!?।](\s|$)/.exec(t); return (m ? m[0].trim() : t).slice(0, 140) || w.scripture; };
function sermonCard(w, latest, inPage) {   // the "Sunday Service" card
  const age = (Date.now() - new Date(w.date + 'T00:00:00')) / 864e5, isNew = latest && age <= 7;
  const yt = /^https?:\/\//i.test(w.youtube) ? esc(w.youtube) : '', intro = introOf(w);
  const btn = inPage ? '<button class="sc-btn" type="button" data-goto="smBody">Read Sermon Summary</button>' : `<a class="sc-btn" href="#/sermon${latest ? '' : '/' + esc(w.date)}">Read Sermon Summary</a>`;
  return `<article class="sc"><div class="sc-top"><span class="sc-ico">${ICON_CHURCH}</span><span class="sc-kind">Sunday Service</span>${isNew ? '<span class="sc-new">NEW</span>' : ''}</div>
<div class="sc-date">${esc(fmtUS(w.date))}</div><h3 class="sc-t">${esc(w.sermon || 'Sunday Message')}</h3>${intro ? `<p class="sc-i">${esc(intro)}</p>` : ''}
<div class="sc-img"><img src="${esc(w.image || 'sermon-default.svg')}" alt="" loading="lazy" onerror="this.onerror=null;this.src='sermon-default.svg'"><span class="sc-chip">${esc(w.speaker || "The Lord's Church")}</span></div>
${yt ? `<a class="sc-mic" href="${yt}" target="_blank" rel="noopener noreferrer"><span class="mic">${ICON_MIC}</span><span>Pastor's Sunday Message</span><span class="go" aria-hidden="true">↗</span></a>` : ''}${btn}</article>`;
}
const sermonHtml = w => hasSermon(w) ? `<section class="sm" id="smBody"><small class="wk-k">SERMON SUMMARY</small>${(w.speaker || w.scripture) ? `<p class="sm-m">${[w.speaker, w.scripture].filter(Boolean).map(esc).join(' · ')}</p>` : ''}${w.summary ? `<div class="sm-s">${w.summary.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('')}</div>` : ''}${w.points.length ? `<div class="sm-p"><b>Key points</b><ol>${w.points.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>` : ''}</section>` : '';
const weekHtml = (w, latest) => (hasSermon(w) ? sermonCard(w, latest, false) : `<div class="wk"><small class="wk-k">${latest ? 'THIS SUNDAY' : 'SUNDAY SHEET'}</small><div class="wk-d">${esc(fmtDate(w.date))}</div>${w.title ? `<p class="wk-t">${esc(w.title)}</p>` : ''}</div>`)
+ `\n<h2>${latest ? 'Songs for this Sunday' : 'Songs'} <small>${w.list.length} ${w.list.length === 1 ? 'song' : 'songs'}</small></h2>${w.list.length ? grid(w.list) : empty('♪', 'Song list coming soon', 'The songs for this Sunday will appear here.')}`;

function wireVideo() {
  const t = $('#vtoggle'), w = $('#vwrap'), v = $('#wcv'); if (!t || !w || !v) return;
  const set = open => {
    w.classList.toggle('open', open); w.inert = !open;
    t.setAttribute('aria-expanded', open);
    t.innerHTML = open ? 'Hide video <span aria-hidden="true">✕</span>' : '<span aria-hidden="true">▶</span> Watch video';
    if (open) { if (!v.getAttribute('src')) v.src = v.dataset.src; } else v.pause();   // the video only downloads when it is opened
  };
  t.onclick = () => set(!w.classList.contains('open'));
  $('#vhide').onclick = () => { set(false); t.focus({ preventScroll: true }); };
}

/* ---------- Bible ---------- */
const BOOKS = [ // id, English, Telugu, chapters
['GEN','Genesis','ఆదికాండము',50],['EXO','Exodus','నిర్గమకాండము',40],['LEV','Leviticus','లేవీయకాండము',27],['NUM','Numbers','సంఖ్యాకాండము',36],['DEU','Deuteronomy','ద్వితీయోపదేశకాండము',34],['JOS','Joshua','యెహోషువ',24],['JDG','Judges','న్యాయాధిపతులు',21],['RUT','Ruth','రూతు',4],['1SA','1 Samuel','1 సమూయేలు',31],['2SA','2 Samuel','2 సమూయేలు',24],['1KI','1 Kings','1 రాజులు',22],['2KI','2 Kings','2 రాజులు',25],['1CH','1 Chronicles','1 దినవృత్తాంతములు',29],['2CH','2 Chronicles','2 దినవృత్తాంతములు',36],['EZR','Ezra','ఎజ్రా',10],['NEH','Nehemiah','నెహెమ్యా',13],['EST','Esther','ఎస్తేరు',10],['JOB','Job','యోబు',42],['PSA','Psalms','కీర్తనలు',150],['PRO','Proverbs','సామెతలు',31],['ECC','Ecclesiastes','ప్రసంగి',12],['SNG','Song of Solomon','పరమగీతము',8],['ISA','Isaiah','యెషయా',66],['JER','Jeremiah','యిర్మీయా',52],['LAM','Lamentations','విలాపవాక్యములు',5],['EZK','Ezekiel','యెహెజ్కేలు',48],['DAN','Daniel','దానియేలు',12],['HOS','Hosea','హోషేయ',14],['JOL','Joel','యోవేలు',3],['AMO','Amos','ఆమోసు',9],['OBA','Obadiah','ఓబద్యా',1],['JON','Jonah','యోనా',4],['MIC','Micah','మీకా',7],['NAM','Nahum','నహూము',3],['HAB','Habakkuk','హబక్కూకు',3],['ZEP','Zephaniah','జెఫన్యా',3],['HAG','Haggai','హగ్గయి',2],['ZEC','Zechariah','జెకర్యా',14],['MAL','Malachi','మలాకీ',4],
['MAT','Matthew','మత్తయి',28],['MRK','Mark','మార్కు',16],['LUK','Luke','లూకా',24],['JHN','John','యోహాను',21],['ACT','Acts','అపొస్తలుల కార్యములు',28],['ROM','Romans','రోమీయులకు',16],['1CO','1 Corinthians','1 కొరింథీయులకు',16],['2CO','2 Corinthians','2 కొరింథీయులకు',13],['GAL','Galatians','గలతీయులకు',6],['EPH','Ephesians','ఎఫెసీయులకు',6],['PHP','Philippians','ఫిలిప్పీయులకు',4],['COL','Colossians','కొలొస్సయులకు',4],['1TH','1 Thessalonians','1 థెస్సలొనీకయులకు',5],['2TH','2 Thessalonians','2 థెస్సలొనీకయులకు',3],['1TI','1 Timothy','1 తిమోతికి',6],['2TI','2 Timothy','2 తిమోతికి',4],['TIT','Titus','తీతుకు',3],['PHM','Philemon','ఫిలేమోనుకు',1],['HEB','Hebrews','హెబ్రీయులకు',13],['JAS','James','యాకోబు',5],['1PE','1 Peter','1 పేతురు',5],['2PE','2 Peter','2 పేతురు',3],['1JN','1 John','1 యోహాను',5],['2JN','2 John','2 యోహాను',1],['3JN','3 John','3 యోహాను',1],['JUD','Jude','యూదా',1],['REV','Revelation','ప్రకటన గ్రంథము',22]
].map(([id, en, te, n]) => ({ id, en, te, n }));
const BK = Object.fromEntries(BOOKS.map(b => [b.id, b]));
const bcache = {};
let btok = 0;
function bookData(lang, id) {   // each book downloads once; the service worker keeps it for offline
  const k = lang + id;
  return bcache[k] || (bcache[k] = fetch(`bible/${lang}/${id}.json`).then(r => { if (!r.ok) throw 0; return r.json(); }).catch(e => { delete bcache[k]; throw e; }));
}
const bName = (b, l) => l === 'en' ? b.en : b.te;
function bibleNav(id, c) {
  const i = BOOKS.findIndex(b => b.id === id), b = BOOKS[i];
  const prev = c > 1 ? [id, c - 1] : i > 0 ? [BOOKS[i - 1].id, BOOKS[i - 1].n] : null;
  const next = c < b.n ? [id, c + 1] : i < BOOKS.length - 1 ? [BOOKS[i + 1].id, 1] : null;
  const lbl = (p, ar) => { const x = BK[p[0]]; const t = `${x.te} ${p[1]}`; return `<a href="#/bible/${p[0]}/${p[1]}">${ar ? '' : '← '}${esc(t)}${ar ? ' →' : ''}</a>`; };
  return `<nav class="pn" aria-label="Previous and next chapter">${prev ? lbl(prev) : '<span></span>'}${next ? lbl(next, 1) : ''}</nav>`;
}
function loadChapter(id, c, lang) {
  const tok = ++btok, box = $('#bv'); if (!box) return;
  bookData(lang, id).then(ch => {
    if (tok !== btok || !$('#bv')) return;
    const vs = ch[c - 1];
    box.innerHTML = vs && vs.length ? vs.map((t, i) => `<p><sup>${i + 1}</sup>${esc(t)}</p>`).join('') : '<div class="bmsg">This chapter is not available.</div>';
  }).catch(() => { if (tok === btok && $('#bv')) $('#bv').innerHTML = `<div class="bmsg">${navigator.onLine ? 'Could not load this book.' : 'Offline. Open this book once while online to save it.'}</div>`; });
}

/* ---------- views ---------- */
const views = {
  home() {
    const w = weeks[0];
    return `<section class="hero"><div class="panel"><img src="lords-church.png" alt="The Lord's Church"><div class="nm">TLC Songs Book</div><p class="yr">THE LORD'S CHURCH</p><p class="sub">Lyrics. Anywhere. Even offline.</p></div>
<div class="vb"><button id="vtoggle" class="vlink" type="button" aria-expanded="false" aria-controls="vwrap"><span aria-hidden="true">▶</span> Watch video</button></div>
<div id="vwrap" class="vwrap" inert><div class="vin"><video id="wcv" controls playsinline preload="none" poster="wc-video-poster.jpeg" data-src="wc-video.mp4" aria-label="The Lord's Church video"></video><div class="vfoot"><button id="vhide" class="vlink" type="button">Hide video ✕</button></div></div></div>
<a href="#/search" class="sb" aria-label="Search songs"><span aria-hidden="true">⌕</span><span style="color:var(--mut);font-size:17px">Search songs, artists...</span></a></section>
${w ? weekHtml(w, true) : empty('♪', 'No Sunday list yet', 'Open the Songs tab to browse every song.')}
<div class="more"><a href="#/search">All songs (${songs.length}) →</a>${weeks.length > 1 ? '<a href="#/weeks">Past Sundays →</a>' : ''}<a href="#/recent">Recently viewed →</a></div>`;
  },
  weeks() {
    return `<h2 style="margin-top:28px">Past Sundays</h2>` + (weeks.length ? weeks.map(w => `<a class="wk-c" href="#/week/${esc(w.date)}"><b>${esc(fmtDate(w.date))}</b><small>${esc(w.sermon || w.title || 'Sunday Worship')}</small><i>${w.list.length} songs</i></a>`).join('') : empty('◷', 'Nothing here yet', 'Sunday sheets will be listed here.'));
  },
  week(d) {
    const w = weeks.find(x => x.date === d);
    return w ? `<a class="back" href="#/weeks">← Past Sundays</a>` + weekHtml(w, w === weeks[0]) : empty('♪', 'Sunday not found', '<a href="#/" style="color:var(--ac)">Back to home</a>');
  },
  sermon(d) {
    const withS = weeks.filter(w => w.sermon || w.summary || w.points.length);
    const head = (w, latest) => sermonCard(w, latest, true) + sermonHtml(w) + `<div class="more"><a href="#/week/${esc(w.date)}">Songs of that Sunday →</a></div>`;
    if (d) { const w = withS.find(x => x.date === d); return w ? `<a class="back" href="#/sermon">← All messages</a>` + head(w, w === withS[0]) : empty('✝', 'Message not found', '<a href="#/sermon" style="color:var(--ac)">Back to messages</a>'); }
    if (!withS.length) return `<h2 style="margin-top:28px">Sermon</h2>` + empty('✝', 'No message summary yet', 'The sermon summary and key points will appear here after each Sunday.');
    const [w, ...past] = withS;
    return head(w, true) + (past.length ? `<h2>Previous messages <small>${past.length}</small></h2>` + past.map(p => `<a class="wk-c" href="#/sermon/${esc(p.date)}"><b>${esc(p.sermon || 'Sermon message')}</b><small>${esc(fmtDate(p.date))}${p.speaker ? ' · ' + esc(p.speaker) : ''}</small><i>${p.points.length ? p.points.length + ' key points' : 'Summary'}</i></a>`).join('') : '');
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
  bible(id, c) {
    const lang = LS.g('blang', 'te'), b = BK[id];
    if (!b) {   // book list
      const last = LS.g('blast', null), lb = last && BK[last[0]];
      const sec = (t, a) => `<div class="bk-h">${t}</div><div class="bks">${a.map(x => `<a class="bk" href="#/bible/${x.id}">${esc(x.te)}<small>${esc(x.en)}</small></a>`).join('')}</div>`;
      return `<h2 style="margin-top:28px">Bible</h2>${lb ? `<a class="bcont" href="#/bible/${last[0]}/${last[1]}"><small>CONTINUE READING</small><b>${esc(lb.te)} ${last[1]}</b></a>` : ''}${sec('OLD TESTAMENT', BOOKS.slice(0, 39))}${sec('NEW TESTAMENT', BOOKS.slice(39))}`;
    }
    const n = parseInt(c, 10);
    if (!n || n < 1 || n > b.n) {   // chapter grid
      return `<a class="back" href="#/bible">← All books</a><h2 style="margin-top:8px">${esc(b.te)} <small>${esc(b.en)}</small></h2><div class="chs">${Array.from({ length: b.n }, (_, i) => `<a class="bch" href="#/bible/${id}/${i + 1}">${i + 1}</a>`).join('')}</div>`;
    }
    LS.s('blast', [id, n]);   // reader
    setTimeout(() => {
      loadChapter(id, n, lang);
      document.querySelectorAll('.tabs [data-bl]').forEach(x => x.onclick = () => {
        LS.s('blang', x.dataset.bl);
        document.querySelectorAll('.tabs [data-bl]').forEach(y => y.classList.toggle('on', y === x));
        const bv = $('#bv'); if (bv) bv.innerHTML = '<div class="bmsg">Loading…</div>';
        loadChapter(id, n, x.dataset.bl);
        const bt = $('#bt'); if (bt) bt.textContent = bName(b, x.dataset.bl) + ' ' + n;
      });
    });
    return `<div class="rh"><a class="ib" href="#/bible/${id}" aria-label="Chapters">←</a><div class="t"><h1 id="bt">${esc(bName(b, lang))} ${n}</h1></div></div>
<div class="tabs" role="tablist"><button data-bl="te" role="tab" class="${lang === 'te' ? 'on' : ''}">తెలుగు</button><button data-bl="en" role="tab" class="${lang === 'en' ? 'on' : ''}">English</button></div>
<div class="bv" id="bv"><div class="bmsg">Loading…</div></div>${bibleNav(id, n)}`;
  },
  song(id) {
    const s = by[id];
    if (!s) return empty('♪', 'Song not found', '<a href="#/" style="color:var(--ac)">Back to home</a>');
    pushRecent(id);
    const keys = Object.keys(s.lyrics);
    const sib = contextList(id), si = sib.findIndex(x => x.id === id), pv = sib[si - 1], nx = sib[si + 1];
    let k = LS.g('lang', keys[0]); if (!keys.includes(k)) k = keys[0];
    const body = k => s.lyrics[k].split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    setTimeout(() => {
      const ly = $('#ly');
      document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { LS.s('lang', b.dataset.k); ly.innerHTML = body(b.dataset.k); document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); });
    });
    return `<div class="rh"><button class="ib" onclick="history.length>1?history.back():location.hash='#/'" aria-label="Back">←</button><div class="t"><h1>${esc(s.title)}</h1><small>${esc(s.artist)}</small></div>${favBtn(id).replace('class="fav', 'class="ib fav').replace(/position:absolute/, '')}</div>
${keys.length > 1 ? `<div class="tabs" role="tablist">${keys.map(x => `<button data-k="${x}" role="tab" class="${x === k ? 'on' : ''}">${LABEL[x] || x}</button>`).join('')}</div>` : ''}
<div class="ly" id="ly">${body(k)}</div>
<nav class="pn" aria-label="Next and previous song">${pv ? `<a href="#/song/${pv.id}">← ${esc(pv.title)}</a>` : '<span></span>'}${nx ? `<a href="#/song/${nx.id}">${esc(nx.title)} →</a>` : ''}</nav>`;
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
      const all = [...songs].sort((a, b) => a.title.localeCompare(b.title));
      res.innerHTML = `<div class="chips" aria-label="Suggestions">${tags.map(t => `<button class="chip" data-s="${esc(t)}">${esc(t)}</button>`).join('')}</div><h2>All songs <small>${all.length}</small></h2>${grid(all)}`;
      return;
    }
    const r = search(v);
    res.innerHTML = r.length ? `<h2>${r.length} result${r.length > 1 ? 's' : ''}</h2>${grid(r)}` : empty('🎧', 'No matches found', 'Try a different title, artist or word.');
  };
  q.addEventListener('input', run); run(); q.focus({ preventScroll: true });
}
document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) { const t = document.getElementById(g.dataset.goto); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
document.addEventListener('click', e => {
  const f = e.target.closest('[data-fav]'); if (f) { e.preventDefault(); toggleFav(f.dataset.fav); return; }
  const c = e.target.closest('#clr'); if (c) { const q = $('#q'); q.value = ''; q.dispatchEvent(new Event('input')); q.focus(); return; }
  const ch = e.target.closest('[data-s]'); if (ch) { const q = $('#q'); q.value = ch.dataset.s; q.dispatchEvent(new Event('input')); }
});

/* ---------- router ---------- */
function render() {
  const [, r = '', id, id2] = location.hash.slice(1).split('/');
  const name = r || 'home';
  const v = views[name] || views.home;
  main.style.animation = 'none'; main.offsetHeight; main.style.animation = '';
  main.innerHTML = v(id ? decodeURIComponent(id) : undefined, id2 ? decodeURIComponent(id2) : undefined);
  const tab = { song: 'home', week: 'home', weeks: 'home', recent: 'home' }[name] || name;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.r === tab));
  $('#prog').style.width = 0;
  if (name !== 'search' || !$('#q')) window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'search') wireSearch();
  if (name === 'home') wireVideo();
  renderGreet();
}
function route() { render(); }
addEventListener('scroll', () => {
  if (!location.hash.startsWith('#/song/') && !location.hash.startsWith('#/bible/')) return;
  const h = document.documentElement; const m = h.scrollHeight - innerHeight;
  $('#prog').style.width = (m > 0 ? Math.min(100, scrollY / m * 100) : 0) + '%';
}, { passive: true });
addEventListener('hashchange', route);

/* ---------- theme, share, install, offline ---------- */
$('#theme').onclick = () => {   // extras.js replaces this with the palette picker
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; LS.s('theme', t);
};
$('#share').onclick = async () => {
  const url = location.origin + location.pathname;
  const data = { title: 'TLC Songs Book', text: "TLC Songs Book — The Lord's Church lyrics that work offline.", url };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Link copied — send it to a friend'); } catch { prompt('Copy this link', url); }
};
let dip; addEventListener('beforeinstallprompt', e => { e.preventDefault(); dip = e; $('#inst').hidden = false; });
$('#inst').onclick = async () => { if (!dip) return; dip.prompt(); await dip.userChoice; dip = null; $('#inst').hidden = true; };
const net = () => { $('#off').hidden = navigator.onLine; };
addEventListener('online', net); addEventListener('offline', net); net();

/* ---------- sign-in (Google Sheet via Apps Script) + greeting ---------- */
const API = (window.WC_API || '').trim();   // your Apps Script link (set in Vercel as WC_API_URL)
let user = LS.g('user', null);
const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
let music = null;
const isPlaying = () => !!music && !music.paused;
const DISC = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width=".8" opacity=".6"/><path d="M12 3.4a8.6 8.6 0 0 1 6.1 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="3.1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="var(--bg)"/></svg>';
function syncDisc() { const b = $('#disc'); if (!b) return; const on = isPlaying(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Pause music' : 'Play music'); }
const MUSIC_FILES = ['music.mp3', 'music.m4a', 'music.mpeg'];   // the first one that exists and plays is used
let mIdx = 0;
function makeMusic() {
  const a = new Audio(MUSIC_FILES[mIdx]); a.loop = true; a.volume = .7; a.preload = 'none';
  a.addEventListener('play', syncDisc); a.addEventListener('pause', syncDisc);
  a.addEventListener('error', async () => {
    if (music !== a) return;
    if (mIdx < MUSIC_FILES.length - 1) { mIdx++; music = makeMusic(); music.play().catch(() => {}); return; }   // try the next file name
    mIdx = 0; music = null; syncDisc();
    const found = (await Promise.all(MUSIC_FILES.map(f => fetch(f, { method: 'HEAD' }).then(r => r.ok).catch(() => false)))).some(Boolean);
    toast(found ? "This music file can't be played on phones. Please use an MP3 file." : 'Music file not found. Upload music.mp3');
  });
  return a;
}
function toggleMusic() {
  if (!music) {
    music = makeMusic();
    try { navigator.mediaSession && (navigator.mediaSession.metadata = new MediaMetadata({ title: 'Worship music', artist: "The Lord's Church", artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] })); } catch {}
  }
  if (music.paused) music.play().then(() => toast('♪ Worship music on')).catch(e => { if (e && e.name === 'NotAllowedError') toast('Tap the disc again to play'); });   // other errors are reported by the "error" handler above
  else music.pause();
}
document.addEventListener('click', e => { if (e.target.closest('#disc')) toggleMusic(); });
function renderGreet() {
  const g = $('#greet'); if (!g) return;
  if (!user) { g.hidden = true; return; }
  g.hidden = false;
  g.innerHTML = `<div><b>Hi ${esc(user.username)}, ${hello()}</b><span>Praise the Lord 🙏</span></div><div class="gb"><button id="disc" class="disc${isPlaying() ? ' on' : ''}" type="button" aria-pressed="${isPlaying()}" aria-label="${isPlaying() ? 'Pause music' : 'Play music'}">${DISC}</button><button id="out" type="button">Sign out</button></div>`;
}
async function signInSheet(d, tries = 2) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(d), signal: ac.signal });
    try { return await r.json(); } catch { return { ok: false, error: 'server' }; }
  } catch (e) {
    if (tries > 1 && e.name !== 'AbortError') { await new Promise(res => setTimeout(res, 1500)); return signInSheet(d, tries - 1); }   // one quiet retry
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : (navigator.onLine ? 'network' : 'offline') };
  } finally { clearTimeout(tm); }
}
async function signIn(d) {
  if (!API) return { ok: true, username: d.username, local: true };    // not configured = local test mode only
  if (!navigator.onLine) return { ok: false, error: 'offline' };
  return signInSheet(d);
}
const MSG = {
  invalid: 'Please check your details.',
  invalid_name: 'Please enter your name (at least 2 letters).',
  invalid_phone: 'Please enter a valid 10-digit phone number.',
  invalid_email: 'Please enter a valid email address.',
  offline: 'No internet connection. Please turn on Wi-Fi or mobile data and try again.',
  network: 'Network problem. Please check your internet connection (Wi-Fi or mobile data) and try again.',
  timeout: 'Your connection is slow. Please wait a moment and try again.',
  server: 'Our server is busy right now. Please try again in a minute.'
};
addEventListener('online', () => { const e = $('#login .err'); if (e) e.textContent = ''; });
function showLogin() {
  if ($('#login')) return;
  const el = document.createElement('div'); el.id = 'login';
  el.innerHTML = `<form class="lg" novalidate><img src="lords-church.png" alt=""><h1>Welcome</h1><p class="lead">Praise the Lord! Sign in once to open TLC Songs Book.</p>
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
  sp.onclick = hide; setTimeout(() => loaded.then(hide), 2600);
}
/* ---------- boot ---------- */
if (!user) showLogin(); else renderGreet();
loadSongs().then(loadWeeks).then(route).finally(ready).catch(e => { const why = esc((e && e.message) || 'unknown error'); main.innerHTML = location.protocol === 'file:' ? empty('♪', 'Start a local server', 'This page was opened as a file. Run <code>python -m http.server 8000</code> in this folder, then open http://localhost:8000') : empty('♪', 'Songs unavailable', 'Open this app once while online to save your library.<br><small style="opacity:.6">Reason: ' + why + '</small>'); });
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();(() => {
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
let songs = [], by = {}, index = [], weeks = [];
let favs = LS.g('favs', []), recent = LS.g('recent', []);
const LABEL = { te: 'తెలుగు', rom: 'English', en: 'Lyrics' };

/* ---------- song library (songs.json) ---------- */
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
async function loadSongs() {
  const r = await fetch('songs.json');
  songs = parseSongs(await r.text());
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

/* ---------- Sunday sheet (sunday.txt): songs of the week + sermon summary ---------- */
const WKEYS = ['date', 'title', 'sermon', 'speaker', 'scripture', 'summary', 'points', 'songs', 'intro', 'image', 'youtube'];
function parseWeeks(t) {
  return t.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/^\s*---+\s*$/m).map(block => {
    const w = { date: '', title: '', sermon: '', speaker: '', scripture: '', summary: '', points: [], songs: [], intro: '', image: '', youtube: '' };
    let k = null, any = false;
    for (const raw of block.split('\n')) {
      const l = raw.trim();
      if (l.startsWith('#')) continue;                                   // comment line
      const m = /^([a-z]+)\s*:\s*(.*)$/i.exec(l);
      if (m && WKEYS.includes(m[1].toLowerCase())) {
        k = m[1].toLowerCase(); any = true; const v = m[2].trim();
        if (k === 'points' || k === 'songs') { if (v) w[k].push(v.replace(/^[-•*]\s*/, '')); } else w[k] = v;
        continue;
      }
      if (!k) continue;
      if (k === 'points' || k === 'songs') { if (l) w[k].push(l.replace(/^[-•*]\s*/, '')); }
      else if (k === 'summary') {
        if (l) w.summary += (w.summary === '' || w.summary.endsWith('\n\n') ? '' : ' ') + l;
        else if (w.summary && !w.summary.endsWith('\n\n')) w.summary += '\n\n';
      }
    }
    w.summary = w.summary.trim();
    return any && (w.date || w.songs.length || w.sermon || w.summary) ? w : null;
  }).filter(Boolean);
}
async function loadWeeks() {
  weeks = [];
  try {
    const r = await fetch('sunday.txt', { cache: 'no-cache' });
    if (!r.ok) return;
    const find = n => { const k = String(n).trim().toLowerCase(); return by[n] || songs.find(s => s.id.toLowerCase() === k || s.title.toLowerCase() === k); };
    weeks = parseWeeks(await r.text()).map(w => ({ ...w, list: w.songs.map(find).filter(Boolean) })).sort((a, b) => b.date.localeCompare(a.date));
  } catch {}
}
const contextList = id => { for (const w of weeks) if (w.list.some(s => s.id === id)) return w.list; return songs; };   // prev / next follows the Sunday list
window.TLC = { get songs() { return songs; }, contextList };                                                              // used by extras.js (worship mode)
const fmtDate = d => { const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };

/* ---------- ui helpers ---------- */
const heart = '<svg viewBox="0 0 24 24"><path d="M12 21C5 16.5 2 13 2 9a5 5 0 0 1 10-1.5A5 5 0 0 1 22 9c0 4-3 7.5-10 12z"/></svg>';
const isFav = id => favs.includes(id);
const cover = s => `background:radial-gradient(circle at 25% 20%,hsl(45 85% 72%/.45),transparent 55%),linear-gradient(145deg,hsl(${34 + s.cover % 18} 60% 42%),hsl(${22 + s.cover % 14} 55% 15%))`;
const favBtn = id => `<button class="fav${isFav(id) ? ' on' : ''}" data-fav="${id}" aria-pressed="${isFav(id)}" aria-label="Favorite">${heart}</button>`;
const card = (s, i = 0) => `<article class="card" style="--i:${Math.min(i, 12)}"><a href="#/song/${s.id}" class="art" style="${cover(s)}" aria-hidden="true" tabindex="-1">${esc([...s.title][0])}</a><a href="#/song/${s.id}" class="meta"><b>${esc(s.title)}</b><small>${esc(s.artist)}</small><i>${esc(s.category)}</i></a>${favBtn(s.id)}</article>`;
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

/* ---------- Sunday sheet views ---------- */
const hasSermon = w => !!(w.sermon || w.summary || w.points.length);
const ICON_CHURCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1.5v4M10.2 3.2h3.6"/><path d="M12 5.8l4.2 2.6V21H7.8V8.4z"/><path d="M7.8 11.5H3.5V21h4.3M16.2 11.5h4.3V21h-4.3"/><path d="M10.3 21v-4a1.7 1.7 0 0 1 3.4 0v4M12 9.6v2.4M10.9 10.7h2.2"/></svg>';
const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg>';
const fmtUS = d => { const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(); };
const introOf = w => { if (w.intro) return w.intro; const t = (w.summary || '').split('\n\n')[0], m = /^.*?[.!?।](\s|$)/.exec(t); return (m ? m[0].trim() : t).slice(0, 140) || w.scripture; };
function sermonCard(w, latest, inPage) {   // the "Sunday Service" card
  const age = (Date.now() - new Date(w.date + 'T00:00:00')) / 864e5, isNew = latest && age <= 7;
  const yt = /^https?:\/\//i.test(w.youtube) ? esc(w.youtube) : '', intro = introOf(w);
  const btn = inPage ? '<button class="sc-btn" type="button" data-goto="smBody">Read Sermon Summary</button>' : `<a class="sc-btn" href="#/sermon${latest ? '' : '/' + esc(w.date)}">Read Sermon Summary</a>`;
  return `<article class="sc"><div class="sc-top"><span class="sc-ico">${ICON_CHURCH}</span><span class="sc-kind">Sunday Service</span>${isNew ? '<span class="sc-new">NEW</span>' : ''}</div>
<div class="sc-date">${esc(fmtUS(w.date))}</div><h3 class="sc-t">${esc(w.sermon || 'Sunday Message')}</h3>${intro ? `<p class="sc-i">${esc(intro)}</p>` : ''}
<div class="sc-img"><img src="${esc(w.image || 'sermon-default.svg')}" alt="" loading="lazy" onerror="this.onerror=null;this.src='sermon-default.svg'"><span class="sc-chip">${esc(w.speaker || "The Lord's Church")}</span></div>
${yt ? `<a class="sc-mic" href="${yt}" target="_blank" rel="noopener noreferrer"><span class="mic">${ICON_MIC}</span><span>Pastor's Sunday Message</span><span class="go" aria-hidden="true">↗</span></a>` : ''}${btn}</article>`;
}
const sermonHtml = w => hasSermon(w) ? `<section class="sm" id="smBody"><small class="wk-k">SERMON SUMMARY</small>${(w.speaker || w.scripture) ? `<p class="sm-m">${[w.speaker, w.scripture].filter(Boolean).map(esc).join(' · ')}</p>` : ''}${w.summary ? `<div class="sm-s">${w.summary.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('')}</div>` : ''}${w.points.length ? `<div class="sm-p"><b>Key points</b><ol>${w.points.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>` : ''}</section>` : '';
const weekHtml = (w, latest) => (hasSermon(w) ? sermonCard(w, latest, false) : `<div class="wk"><small class="wk-k">${latest ? 'THIS SUNDAY' : 'SUNDAY SHEET'}</small><div class="wk-d">${esc(fmtDate(w.date))}</div>${w.title ? `<p class="wk-t">${esc(w.title)}</p>` : ''}</div>`)
+ `\n<h2>${latest ? 'Songs for this Sunday' : 'Songs'} <small>${w.list.length} ${w.list.length === 1 ? 'song' : 'songs'}</small></h2>${w.list.length ? grid(w.list) : empty('♪', 'Song list coming soon', 'The songs for this Sunday will appear here.')}`;

function wireVideo() {
  const t = $('#vtoggle'), w = $('#vwrap'), v = $('#wcv'); if (!t || !w || !v) return;
  const set = open => {
    w.classList.toggle('open', open); w.inert = !open;
    t.setAttribute('aria-expanded', open);
    t.innerHTML = open ? 'Hide video <span aria-hidden="true">✕</span>' : '<span aria-hidden="true">▶</span> Watch video';
    if (open) { if (!v.getAttribute('src')) v.src = v.dataset.src; } else v.pause();   // the video only downloads when it is opened
  };
  t.onclick = () => set(!w.classList.contains('open'));
  $('#vhide').onclick = () => { set(false); t.focus({ preventScroll: true }); };
}
/* ---------- views ---------- */
const views = {
  home() {
    const w = weeks[0];
    return `<section class="hero"><div class="panel"><img src="lords-church.png" alt="The Lord's Church"><div class="nm">TLC Songs Book</div><p class="yr">THE LORD'S CHURCH</p><p class="sub">Lyrics. Anywhere. Even offline.</p></div>
<div class="vb"><button id="vtoggle" class="vlink" type="button" aria-expanded="false" aria-controls="vwrap"><span aria-hidden="true">▶</span> Watch video</button></div>
<div id="vwrap" class="vwrap" inert><div class="vin"><video id="wcv" controls playsinline preload="none" poster="wc-video-poster.jpeg" data-src="wc-video.mp4" aria-label="The Lord's Church video"></video><div class="vfoot"><button id="vhide" class="vlink" type="button">Hide video ✕</button></div></div></div>
<a href="#/search" class="sb" aria-label="Search songs"><span aria-hidden="true">⌕</span><span style="color:var(--mut);font-size:17px">Search songs, artists...</span></a></section>
${w ? weekHtml(w, true) : empty('♪', 'No Sunday list yet', 'Open the Songs tab to browse every song.')}
<div class="more"><a href="#/search">All songs (${songs.length}) →</a>${weeks.length > 1 ? '<a href="#/weeks">Past Sundays →</a>' : ''}</div>`;
  },
  weeks() {
    return `<h2 style="margin-top:28px">Past Sundays</h2>` + (weeks.length ? weeks.map(w => `<a class="wk-c" href="#/week/${esc(w.date)}"><b>${esc(fmtDate(w.date))}</b><small>${esc(w.sermon || w.title || 'Sunday Worship')}</small><i>${w.list.length} songs</i></a>`).join('') : empty('◷', 'Nothing here yet', 'Sunday sheets will be listed here.'));
  },
  week(d) {
    const w = weeks.find(x => x.date === d);
    return w ? `<a class="back" href="#/weeks">← Past Sundays</a>` + weekHtml(w, w === weeks[0]) : empty('♪', 'Sunday not found', '<a href="#/" style="color:var(--ac)">Back to home</a>');
  },
  sermon(d) {
    const withS = weeks.filter(w => w.sermon || w.summary || w.points.length);
    const head = (w, latest) => sermonCard(w, latest, true) + sermonHtml(w) + `<div class="more"><a href="#/week/${esc(w.date)}">Songs of that Sunday →</a></div>`;
    if (d) { const w = withS.find(x => x.date === d); return w ? `<a class="back" href="#/sermon">← All messages</a>` + head(w, w === withS[0]) : empty('✝', 'Message not found', '<a href="#/sermon" style="color:var(--ac)">Back to messages</a>'); }
    if (!withS.length) return `<h2 style="margin-top:28px">Sermon</h2>` + empty('✝', 'No message summary yet', 'The sermon summary and key points will appear here after each Sunday.');
    const [w, ...past] = withS;
    return head(w, true) + (past.length ? `<h2>Previous messages <small>${past.length}</small></h2>` + past.map(p => `<a class="wk-c" href="#/sermon/${esc(p.date)}"><b>${esc(p.sermon || 'Sermon message')}</b><small>${esc(fmtDate(p.date))}${p.speaker ? ' · ' + esc(p.speaker) : ''}</small><i>${p.points.length ? p.points.length + ' key points' : 'Summary'}</i></a>`).join('') : '');
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
    const sib = contextList(id), si = sib.findIndex(x => x.id === id), pv = sib[si - 1], nx = sib[si + 1];
    let k = LS.g('lang', keys[0]); if (!keys.includes(k)) k = keys[0];
    const body = k => s.lyrics[k].split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    setTimeout(() => {
      const ly = $('#ly');
      document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { LS.s('lang', b.dataset.k); ly.innerHTML = body(b.dataset.k); document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); });
    });
    return `<div class="rh"><button class="ib" onclick="history.length>1?history.back():location.hash='#/'" aria-label="Back">←</button><div class="t"><h1>${esc(s.title)}</h1><small>${esc(s.artist)}</small></div>${favBtn(id).replace('class="fav', 'class="ib fav').replace(/position:absolute/, '')}</div>
${keys.length > 1 ? `<div class="tabs" role="tablist">${keys.map(x => `<button data-k="${x}" role="tab" class="${x === k ? 'on' : ''}">${LABEL[x] || x}</button>`).join('')}</div>` : ''}
<div class="ly" id="ly">${body(k)}</div>
<nav class="pn" aria-label="Next and previous song">${pv ? `<a href="#/song/${pv.id}">← ${esc(pv.title)}</a>` : '<span></span>'}${nx ? `<a href="#/song/${nx.id}">${esc(nx.title)} →</a>` : ''}</nav>`;
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
      const all = [...songs].sort((a, b) => a.title.localeCompare(b.title));
      res.innerHTML = `<div class="chips" aria-label="Suggestions">${tags.map(t => `<button class="chip" data-s="${esc(t)}">${esc(t)}</button>`).join('')}</div><h2>All songs <small>${all.length}</small></h2>${grid(all)}`;
      return;
    }
    const r = search(v);
    res.innerHTML = r.length ? `<h2>${r.length} result${r.length > 1 ? 's' : ''}</h2>${grid(r)}` : empty('🎧', 'No matches found', 'Try a different title, artist or word.');
  };
  q.addEventListener('input', run); run(); q.focus({ preventScroll: true });
}
document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) { const t = document.getElementById(g.dataset.goto); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
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
  const tab = { song: 'home', week: 'home', weeks: 'home' }[name] || name;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.r === tab));
  $('#prog').style.width = 0;
  if (name !== 'search' || !$('#q')) window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'search') wireSearch();
  if (name === 'home') wireVideo();
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
$('#theme').onclick = () => {   // extras.js replaces this with the palette picker
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; LS.s('theme', t);
};
$('#share').onclick = async () => {
  const url = location.origin + location.pathname;
  const data = { title: 'TLC Songs Book', text: "TLC Songs Book — The Lord's Church lyrics that work offline.", url };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Link copied — send it to a friend'); } catch { prompt('Copy this link', url); }
};
let dip; addEventListener('beforeinstallprompt', e => { e.preventDefault(); dip = e; $('#inst').hidden = false; });
$('#inst').onclick = async () => { if (!dip) return; dip.prompt(); await dip.userChoice; dip = null; $('#inst').hidden = true; };
const net = () => { $('#off').hidden = navigator.onLine; };
addEventListener('online', net); addEventListener('offline', net); net();

/* ---------- sign-in (Google Sheet via Apps Script) + greeting ---------- */
const API = (window.WC_API || '').trim();   // your Apps Script link (set in Vercel as WC_API_URL)
let user = LS.g('user', null);
const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
let music = null;
const isPlaying = () => !!music && !music.paused;
const DISC = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width=".8" opacity=".6"/><path d="M12 3.4a8.6 8.6 0 0 1 6.1 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="3.1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="var(--bg)"/></svg>';
function syncDisc() { const b = $('#disc'); if (!b) return; const on = isPlaying(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Pause music' : 'Play music'); }
const MUSIC_FILES = ['music.mp3', 'music.m4a', 'music.mpeg'];   // the first one that exists and plays is used
let mIdx = 0;
function makeMusic() {
  const a = new Audio(MUSIC_FILES[mIdx]); a.loop = true; a.volume = .7; a.preload = 'none';
  a.addEventListener('play', syncDisc); a.addEventListener('pause', syncDisc);
  a.addEventListener('error', async () => {
    if (music !== a) return;
    if (mIdx < MUSIC_FILES.length - 1) { mIdx++; music = makeMusic(); music.play().catch(() => {}); return; }   // try the next file name
    mIdx = 0; music = null; syncDisc();
    const found = (await Promise.all(MUSIC_FILES.map(f => fetch(f, { method: 'HEAD' }).then(r => r.ok).catch(() => false)))).some(Boolean);
    toast(found ? "This music file can't be played on phones. Please use an MP3 file." : 'Music file not found. Upload music.mp3');
  });
  return a;
}
function toggleMusic() {
  if (!music) {
    music = makeMusic();
    try { navigator.mediaSession && (navigator.mediaSession.metadata = new MediaMetadata({ title: 'Worship music', artist: "The Lord's Church", artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] })); } catch {}
  }
  if (music.paused) music.play().then(() => toast('♪ Worship music on')).catch(e => { if (e && e.name === 'NotAllowedError') toast('Tap the disc again to play'); });   // other errors are reported by the "error" handler above
  else music.pause();
}
document.addEventListener('click', e => { if (e.target.closest('#disc')) toggleMusic(); });
function renderGreet() {
  const g = $('#greet'); if (!g) return;
  if (!user) { g.hidden = true; return; }
  g.hidden = false;
  g.innerHTML = `<div><b>Hi ${esc(user.username)}, ${hello()}</b><span>Praise the Lord 🙏</span></div><div class="gb"><button id="disc" class="disc${isPlaying() ? ' on' : ''}" type="button" aria-pressed="${isPlaying()}" aria-label="${isPlaying() ? 'Pause music' : 'Play music'}">${DISC}</button><button id="out" type="button">Sign out</button></div>`;
}
async function signInSheet(d, tries = 2) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(d), signal: ac.signal });
    try { return await r.json(); } catch { return { ok: false, error: 'server' }; }
  } catch (e) {
    if (tries > 1 && e.name !== 'AbortError') { await new Promise(res => setTimeout(res, 1500)); return signInSheet(d, tries - 1); }   // one quiet retry
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : (navigator.onLine ? 'network' : 'offline') };
  } finally { clearTimeout(tm); }
}
async function signIn(d) {
  if (!API) return { ok: true, username: d.username, local: true };    // not configured = local test mode only
  if (!navigator.onLine) return { ok: false, error: 'offline' };
  return signInSheet(d);
}
const MSG = {
  invalid: 'Please check your details.',
  invalid_name: 'Please enter your name (at least 2 letters).',
  invalid_phone: 'Please enter a valid 10-digit phone number.',
  invalid_email: 'Please enter a valid email address.',
  offline: 'No internet connection. Please turn on Wi-Fi or mobile data and try again.',
  network: 'Network problem. Please check your internet connection (Wi-Fi or mobile data) and try again.',
  timeout: 'Your connection is slow. Please wait a moment and try again.',
  server: 'Our server is busy right now. Please try again in a minute.'
};
addEventListener('online', () => { const e = $('#login .err'); if (e) e.textContent = ''; });
function showLogin() {
  if ($('#login')) return;
  const el = document.createElement('div'); el.id = 'login';
  el.innerHTML = `<form class="lg" novalidate><img src="lords-church.png" alt=""><h1>Welcome</h1><p class="lead">Praise the Lord! Sign in once to open TLC Songs Book.</p>
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
  sp.onclick = hide; setTimeout(() => loaded.then(hide), 2600);
}
/* ---------- boot ---------- */
if (!user) showLogin(); else renderGreet();
loadSongs().then(loadWeeks).then(route).finally(ready).catch(e => { const why = esc((e && e.message) || 'unknown error'); main.innerHTML = location.protocol === 'file:' ? empty('♪', 'Start a local server', 'This page was opened as a file. Run <code>python -m http.server 8000</code> in this folder, then open http://localhost:8000') : empty('♪', 'Songs unavailable', 'Open this app once while online to save your library.<br><small style="opacity:.6">Reason: ' + why + '</small>'); });
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
