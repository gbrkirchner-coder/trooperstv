gsap.registerPlugin(ScrollTrigger);

const CDN = 'https://cdn.brawlify.com';
const img = {
  model: (id) => `${CDN}/brawlers/model/${id}.png`,
  portrait: (id) => `${CDN}/brawlers/borderless/${id}.png`,
  icon: (id) => `${CDN}/profile-icons/regular/${id}.png`,
  badge: (id) => `${CDN}/club-badges/regular/${id}.png`,
  map: (id) => `${CDN}/maps/regular/${id}.png`,
};
const ROLE = { president: 'Präsident', vicePresident: 'Vize', senior: 'Senior', member: 'Mitglied' };
const ROLE_ORDER = { president: 0, vicePresident: 1, senior: 2, member: 3 };
const MODE = {
  gemGrab: 'Juwelenjagd', brawlBall: 'Brawl Ball', heist: 'Tresorraub', bounty: 'Kopfgeld', knockout: 'Knockout',
  hotZone: 'Heiße Zone', soloShowdown: 'Solo-Showdown', duoShowdown: 'Duo-Showdown', trioShowdown: 'Trio-Showdown',
  wipeout: 'Wipeout', duels: 'Duelle', basketBrawl: 'Basket Brawl', volleyBrawl: 'Volley Brawl', payload: 'Payload',
};
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('de-DE');
const color = (c) => (c ? '#' + c.slice(-6) : '#fff');
const cap = (s) => String(s || '').toLowerCase().replace(/(^|[\s-])\S/g, (m) => m.toUpperCase());
const trophy = '<i class="ico-trophy"></i>';
const fallback = (el, id) => { el.onerror = null; el.src = img.portrait(id); };
window.fallback = fallback;

async function api(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

const state = { data: null, demo: false, category: 'trophies' };

(async function init() {
  heroIntro();
  try {
    state.data = await api('data/club.json');
  } catch (e) {
    state.data = TroopersDemo;
    state.demo = true;
    const b = $('#dataBanner');
    b.hidden = false;
    b.innerHTML = `⚠️ Demo-Daten – die Club-Daten konnten nicht geladen werden (${esc(e.message)}). Lokal zuerst <code>npm run daten</code> ausführen.`;
  }
  renderClub();
  renderMeta();
  renderTabs();
  renderRanking(false);
  renderTopBrawlers();
  renderMembers();
  await Promise.all([renderEvents(), setupGlobal(), renderTV()]);
  scrollAnimations();
})();

// ---------- Club ----------
function renderClub() {
  const { club, members } = state.data;
  const total = members.reduce((s, m) => s + m.trophies, 0);
  const games = members.reduce((s, m) => s + (m.form?.games || 0), 0);
  const wins = members.reduce((s, m) => s + (m.form?.wins || 0), 0);
  const ranked = members.reduce((s, m) => s + (m.form?.rankedWins || 0), 0);

  $('#clubName').innerHTML = [...String(club.name).toUpperCase()].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
  $('#clubTag').textContent = club.tag;
  $('#heroBadge').src = $('#navBadge').src = img.badge(club.badgeId);
  $('#heroType').textContent = { open: 'Offen', inviteOnly: 'Nur mit Einladung', closed: 'Geschlossen' }[club.type] || club.type;
  $('#clubDesc').textContent = club.description || '';
  $('#updatedAt').textContent = new Date(state.data.updatedAt).toLocaleString('de-DE') + (state.demo ? ' (Demo)' : '');

  countUp($('#heroTrophies'), club.trophies ?? total, 0.4);
  countUp($('#heroMembers'), members.length, 0.4);
  const counters = { stTotal: club.trophies ?? total, stAvg: Math.round(total / (members.length || 1)), stReq: club.requiredTrophies,
    stWin: games ? Math.round((wins / games) * 100) : 0, stRanked: ranked, stFree: 30 - members.length };
  for (const [id, v] of Object.entries(counters)) $('#' + id).dataset.value = v;

  const counts = members.reduce((o, m) => ((o[m.role] = (o[m.role] || 0) + 1), o), {});
  $('#roles').innerHTML = Object.keys(ROLE_ORDER).filter((r) => counts[r])
    .map((r) => `<span class="role r-${r}">${counts[r]}× ${ROLE[r]}</span>`).join('');
}

// ---------- Meta ----------
function renderMeta() {
  const usage = state.data.usage.slice(0, 9);
  const total = state.data.usage.reduce((s, u) => s + u.picks, 0) || 1;
  const max = usage[0]?.picks || 1;
  $('#metaGrid').innerHTML = usage.length ? usage.map((u, i) => `
    <article class="meta-card">
      <span class="pos">#${i + 1}</span>
      <img src="${img.model(u.id)}" onerror="fallback(this, ${u.id})" alt="" loading="lazy">
      <div style="flex:1;min-width:0">
        <div class="meta-name">${esc(cap(u.name))}</div>
        <div class="bar"><i data-w="${(u.picks / max) * 100}"></i></div>
        <small>${u.picks} Picks · ${((u.picks / total) * 100).toFixed(1)}% · ${Math.round((u.wins / u.picks) * 100)}% Siege</small>
      </div>
    </article>`).join('') : '<p class="muted">Noch keine Kämpfe gefunden.</p>';
}

// ---------- Kategorie-Ranking ----------
const CATEGORIES = [
  { id: 'trophies', label: 'Trophäen', get: (m) => m.trophies },
  { id: 'highest', label: 'Rekord', get: (m) => m.highestTrophies },
  { id: 'trio', label: '3v3-Siege', get: (m) => m.trioVictories },
  { id: 'solo', label: 'Solo-Siege', get: (m) => m.soloVictories },
  { id: 'duo', label: 'Duo-Siege', get: (m) => m.duoVictories },
  { id: 'ranked', label: 'Ranked', get: (m) => m.form?.rankedWins, hint: 'Ranked-Siege in den letzten Kämpfen' },
  { id: 'form', label: 'Form', get: (m) => m.form?.trophyDelta, signed: true, hint: 'Trophäen +/− in den letzten Kämpfen' },
  { id: 'winrate', label: 'Siegquote', get: (m) => (m.form?.games ? Math.round((m.form.wins / m.form.games) * 100) : null), suffix: '%' },
  { id: 'star', label: 'Star Player', get: (m) => m.form?.starPlayer },
  { id: 'level', label: 'Level', get: (m) => m.expLevel },
];

function renderTabs() {
  $('#rankTabs').innerHTML = CATEGORIES.map((c) =>
    `<button class="tab ${c.id === state.category ? 'active' : ''}" data-id="${c.id}" title="${esc(c.hint || c.label)}">${c.label}</button>`).join('');
  $('#rankTabs').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t || t.dataset.id === state.category) return;
    state.category = t.dataset.id;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === t));
    gsap.fromTo(t, { scale: 0.85 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
    renderRanking(true);
  });
}

function renderRanking(animate) {
  const cat = CATEGORIES.find((c) => c.id === state.category);
  const val = (m) => {
    const v = cat.get(m);
    return (cat.signed && v > 0 ? '+' : '') + fmt(v) + (cat.suffix || '');
  };
  const list = state.data.members.filter((m) => cat.get(m) != null).sort((a, b) => cat.get(b) - cat.get(a));
  const top = list.slice(0, 3);
  $('#podium').innerHTML = top.map((m, i) => `
    <div class="podium-step p${i + 1}">
      <img src="${img.icon(m.icon?.id)}" alt="">
      <div class="podium-rank">${i + 1}</div>
      <div class="podium-name">${esc(m.name)}</div>
      <div class="podium-val">${val(m)}</div>
    </div>`).join('');
  $('#rankList').innerHTML = list.slice(3).map((m, i) => `
    <li><span class="n">${i + 4}</span><img src="${img.icon(m.icon?.id)}" alt="" loading="lazy">
      <span style="color:${color(m.nameColor)}">${esc(m.name)} <span class="role r-${m.role}">${ROLE[m.role] || m.role}</span></span>
      <span class="v ${cat.signed ? (cat.get(m) >= 0 ? 'up' : 'down') : ''}">${val(m)}</span></li>`).join('');
  if (animate) {
    gsap.from('.podium-step', { y: 120, opacity: 0, duration: 0.6, stagger: { each: 0.1, from: 'center' }, ease: 'back.out(1.6)' });
    gsap.from('.rank-list li', { x: -40, opacity: 0, duration: 0.35, stagger: 0.03, ease: 'power2.out' });
  }
}

// ---------- Top Brawler ----------
function renderTopBrawlers() {
  $('#topBrawlers').innerHTML = state.data.topBrawlers.slice(0, 12).map((b, i) => `
    <article class="brawler ${i < 3 ? 'r' + (i + 1) : ''}">
      <img src="${img.model(b.id)}" onerror="fallback(this, ${b.id})" alt="" loading="lazy">
      <div class="brawler-name">${esc(cap(b.name))}</div>
      <div class="tro">${trophy}${fmt(b.trophies)}</div>
      <div class="owner">von ${esc(b.owner)} · Rang ${b.rank ?? '–'}</div>
    </article>`).join('');
}

const rankingCache = {};
async function setupGlobal() {
  let brawlers;
  try { brawlers = (await api('data/brawlers.json')).items; } catch { brawlers = TroopersDemo.brawlers; }
  brawlers = brawlers.slice().sort((a, b) => a.name.localeCompare(b.name));
  const sel = $('#globalBrawler');
  const start = state.data.usage[0]?.id || brawlers[0]?.id;
  sel.innerHTML = brawlers.map((b) => `<option value="${b.id}" ${b.id === start ? 'selected' : ''}>${esc(cap(b.name))}</option>`).join('');
  const load = async () => {
    const list = $('#globalList');
    list.innerHTML = '<li class="muted">Lade…</li>';
    let data;
    try {
      const region = $('#globalCountry').value;
      rankingCache[region] ||= api(`data/rankings-${region}.json`);
      data = { items: (await rankingCache[region]).brawlers[sel.value] || [] };
    } catch { data = TroopersDemo.ranking(Number(sel.value)); }
    list.innerHTML = (data.items || []).map((p) => `
      <li><span class="n">${p.rank}</span><img src="${img.icon(p.icon?.id)}" alt="" loading="lazy">
        <span><span style="color:${color(p.nameColor)}">${esc(p.name)}</span><span class="c">${esc(p.club?.name || 'Kein Club')}</span></span>
        <span class="t">${fmt(p.trophies)}</span></li>`).join('') || '<li class="muted">Keine Einträge.</li>';
    gsap.from('#globalList li', { y: 20, opacity: 0, duration: 0.3, stagger: 0.04 });
  };
  sel.addEventListener('change', load);
  $('#globalCountry').addEventListener('change', load);
  await load();
}

// ---------- Mitglieder ----------
function renderMembers() {
  const draw = () => {
    const q = $('#search').value.trim().toLowerCase();
    const sort = $('#sortBy').value;
    const key = {
      trophies: (m) => -m.trophies, expLevel: (m) => -(m.expLevel || 0),
      form: (m) => -(m.form?.trophyDelta || 0), role: (m) => ROLE_ORDER[m.role] * 1e7 - m.trophies,
    }[sort];
    const list = state.data.members.filter((m) => m.name.toLowerCase().includes(q)).sort((a, b) => key(a) - key(b));
    $('#memberGrid').innerHTML = list.map((m) => {
      const f = m.form || {};
      const wr = f.games ? Math.round((f.wins / f.games) * 100) : null;
      return `
      <article class="member">
        <img src="${img.icon(m.icon?.id)}" alt="" loading="lazy">
        <div style="min-width:0">
          <div class="name" style="color:${color(m.nameColor)}">${esc(m.name)}</div>
          <div class="line"><span class="role r-${m.role}">${ROLE[m.role] || m.role}</span><span class="tro">${trophy}${fmt(m.trophies)}</span></div>
          <div class="line">Lvl ${m.expLevel ?? '–'} · ${m.brawlerCount || '–'} Brawler · ${esc(m.tag)}</div>
        </div>
        ${m.bestBrawler ? `<div class="best"><img src="${img.portrait(m.bestBrawler.id)}" alt="" loading="lazy">
          <span>Bester: <b>${esc(cap(m.bestBrawler.name))}</b><br>${fmt(m.bestBrawler.trophies)} 🏆</span>
          <span class="form ${f.trophyDelta >= 0 ? 'up' : 'down'}" title="Letzte ${f.games || 0} Kämpfe">${f.trophyDelta > 0 ? '+' : ''}${f.trophyDelta ?? 0}${wr != null ? `<br><small>${wr}% Siege</small>` : ''}</span></div>` : ''}
      </article>`;
    }).join('') || '<p class="muted">Kein Mitglied gefunden.</p>';
  };
  draw();
  $('#search').addEventListener('input', draw);
  $('#sortBy').addEventListener('change', () => {
    draw();
    gsap.from('.member', { scale: 0.9, opacity: 0, duration: 0.35, stagger: 0.015, ease: 'back.out(2)' });
  });
}

// ---------- Troopers TV ----------
async function renderTV() {
  let data;
  try { data = await api('data/youtube.json'); } catch { data = null; }
  const channelUrl = data ? `https://www.youtube.com/channel/${data.channelId}` : 'https://www.youtube.com/';
  $('#tvSubscribe').href = channelUrl + '?sub_confirmation=1';
  if (data) $('#tvChannel').textContent = data.channelTitle;
  const videos = (data?.videos || []).filter((v) => !v.short);
  const shorts = (data?.videos || []).filter((v) => v.short);
  const date = (d) => new Date(d).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const clean = (t) => t.replace(/\s*\|\s*Brawl Stars.*$/i, '');

  if (!videos.length) {
    $('#tvPlayer').outerHTML = '<p class="tv-empty">Noch keine Videos – bald geht’s los! 🎬</p>';
    $('#tvList').innerHTML = '';
  } else {
    // Vorschau erst beim Klick durch den (datensparsamen) YouTube-Player ersetzen
    const show = (v, autoplay) => {
      const p = $('#tvPlayer');
      p.innerHTML = autoplay
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
        : `<img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt=""><span class="tv-play"></span><div class="tv-caption">${esc(clean(v.title))}</div>`;
      p.onclick = autoplay ? null : () => show(v, true);
      document.querySelectorAll('.tv-list li').forEach((li) => li.classList.toggle('active', li.dataset.id === v.id));
      if (!autoplay) gsap.from('#tvPlayer img', { scale: 1.08, duration: 0.5, ease: 'power2.out' });
    };
    $('#tvList').innerHTML = videos.slice(0, 5).map((v) => `
      <li data-id="${v.id}"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy">
        <span>${esc(clean(v.title))}<small>${date(v.published)}${v.views != null ? ` · ${fmt(v.views)} Aufrufe` : ''}</small></span></li>`).join('');
    $('#tvList').addEventListener('click', (e) => {
      const li = e.target.closest('li'); if (!li) return;
      show(videos.find((v) => v.id === li.dataset.id), true);
    });
    show(videos[0], false);
  }
  if (shorts.length) {
    $('#tvShortsWrap').hidden = false;
    $('#tvShorts').innerHTML = shorts.slice(0, 8).map((v) => `
      <a class="tv-short" href="https://www.youtube.com/shorts/${v.id}" target="_blank" rel="noopener">
        <img src="https://i.ytimg.com/vi/${v.id}/hq720.jpg" onerror="this.src='https://i.ytimg.com/vi/${v.id}/hqdefault.jpg'" alt="" loading="lazy">
        <span>${esc(v.title.replace(/#\S+/g, '').trim())}</span></a>`).join('');
  }
}

// ---------- Events ----------
async function renderEvents() {
  let events;
  try { events = await api('data/events.json'); } catch { events = TroopersDemo.events; }
  $('#eventGrid').innerHTML = events.slice(0, 12).map(({ event: e, endTime }) => `
    <article class="event">
      <div class="event-head"><h4>${esc(MODE[e.mode] || cap(e.mode))}</h4><small>${esc(e.map || '')}${endTime ? ' · endet ' + parseTime(endTime) : ''}</small></div>
      <img src="${img.map(e.id)}" alt="${esc(e.map || '')}" loading="lazy" onerror="this.style.display='none'">
    </article>`).join('');
}
function parseTime(t) {
  const m = t.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  return m ? new Date(Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5])).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

// ---------- GSAP ----------
function countUp(el, value, delay = 0) {
  const o = { v: 0 };
  gsap.to(o, { v: Number(value) || 0, duration: 1.6, delay, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(Math.round(o.v))) });
}

function heroIntro() {
  document.querySelectorAll('.hero-model').forEach((m) => (m.src = img.model(m.dataset.id)));
  gsap.to('.hero-burst', { rotation: 360, duration: 60, repeat: -1, ease: 'none' });
  gsap.to('.bg-rays', { rotation: -360, duration: 240, repeat: -1, ease: 'none' });
  const tl = gsap.timeline({ defaults: { ease: 'back.out(1.7)' } });
  tl.from('.hero-badge', { scale: 0, rotation: -200, duration: 0.9 })
    .from('.hero-kicker', { y: 20, opacity: 0, duration: 0.4 }, '-=0.4')
    .from('.hero-title', { scale: 2.4, opacity: 0, duration: 0.6, ease: 'power4.in' }, '-=0.2')
    .to('.hero-title', { x: '+=6', yoyo: true, repeat: 5, duration: 0.04, ease: 'none' })
    .from('.hero-tag, .hero-chips .chip', { y: 30, opacity: 0, stagger: 0.08, duration: 0.5 }, '-=0.1')
    .from('.hero .btn', { scale: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' }, '-=0.2')
    .from('.hero-model.m1', { x: -400, rotation: -20, opacity: 0, duration: 0.9 }, 0.3)
    .from('.hero-model.m2', { x: 400, rotation: 20, opacity: 0, duration: 0.9 }, 0.45);
  gsap.to('.hero-model.m1', { y: -18, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.3 });
  gsap.to('.hero-model.m2', { y: -24, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.5 });
  gsap.to('.hero .btn', { scale: 1.06, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2 });
  gsap.to('.hero-model.m1', { yPercent: 40, xPercent: -30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-model.m2', { yPercent: 40, xPercent: 30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-inner', { yPercent: 30, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
}

function scrollAnimations() {
  // Titel knallen rein
  gsap.utils.toArray('.title').forEach((t) =>
    gsap.from(t, { scale: 0.4, rotation: -8, opacity: 0, duration: 0.7, ease: 'back.out(2.2)', scrollTrigger: { trigger: t, start: 'top 88%' } }));

  // Zähler
  gsap.utils.toArray('.stat .count').forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => countUp(el, el.dataset.value) });
  });

  // Balken der Meta-Karten
  ScrollTrigger.create({
    trigger: '#metaGrid', start: 'top 80%', once: true,
    onEnter: () => gsap.to('#metaGrid .bar i', { width: (i, el) => el.dataset.w + '%', duration: 1.1, stagger: 0.07, ease: 'power3.out' }),
  });

  // Karten-Gruppen per Batch
  const pop = (sel, vars = {}) => {
    gsap.set(sel, { opacity: 0, y: 50, scale: 0.9 });
    ScrollTrigger.batch(sel, {
      start: 'top 92%', once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.06, ease: 'back.out(1.7)', ...vars }),
    });
  };
  ['.stat', '.meta-card', '.brawler', '.member', '.event', '.info', '.panel', '.rank-list li', '.tv-player', '.tv-list li', '.tv-short'].forEach((s) => pop(s));
  gsap.set('.podium-step', { y: 140, opacity: 0 });
  ScrollTrigger.create({ trigger: '#podium', start: 'top 85%', once: true,
    onEnter: () => gsap.to('.podium-step', { y: 0, opacity: 1, duration: 0.7, stagger: { each: 0.12, from: 'center' }, ease: 'back.out(1.6)' }) });

  // Top-3 Brawler leicht schweben lassen
  gsap.to('.brawler.r1 img, .brawler.r2 img, .brawler.r3 img', { y: -8, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.2 });

  // Hover-Wackeln
  document.querySelectorAll('.brawler, .meta-card').forEach((c) => {
    const im = c.querySelector('img');
    c.addEventListener('mouseenter', () => gsap.to(im, { scale: 1.12, rotation: -4, duration: 0.3, ease: 'back.out(3)' }));
    c.addEventListener('mouseleave', () => gsap.to(im, { scale: 1, rotation: 0, duration: 0.3 }));
  });
  ScrollTrigger.refresh();
}
