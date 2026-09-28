gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

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

// ---------- Aufklappen („Alle anzeigen“) ----------
const isMobile = () => matchMedia('(max-width: 640px)').matches;
/** Zeigt nur die ersten `keep` Einträge; der Rest klappt per Knopf animiert auf. */
function collapsible(listSel, btnSel, keep, noun) {
  const list = $(listSel), btn = $(btnSel);
  const items = [...list.children].filter((el) => !el.classList.contains('muted'));
  items.forEach((el, i) => el.classList.toggle('more', i >= keep));
  const extra = items.length - keep;
  list.classList.add('is-collapsed');
  btn.hidden = extra <= 0;
  const label = (open) => open ? 'Weniger anzeigen ▴' : `${keep === 0 ? 'Alle' : 'Weitere'} ${extra} ${noun} anzeigen ▾`;
  btn.textContent = label(false); btn.setAttribute('aria-expanded', 'false');
  btn.onclick = () => {
    const opening = list.classList.contains('is-collapsed');
    list.classList.toggle('is-collapsed', !opening);
    btn.textContent = label(opening); btn.setAttribute('aria-expanded', String(opening));
    if (opening) {
      gsap.fromTo(list.querySelectorAll('.more'), { opacity: 0, y: -18, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.03, ease: 'back.out(1.7)' });
    } else {
      list.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    ScrollTrigger.refresh();
  };
}

// ---------- Club ----------
function renderClub() {
  const { club, members } = state.data;
  const total = members.reduce((s, m) => s + m.trophies, 0);
  const games = members.reduce((s, m) => s + (m.form?.games || 0), 0);
  const wins = members.reduce((s, m) => s + (m.form?.wins || 0), 0);
  const ranked = members.reduce((s, m) => s + (m.form?.rankedWins || 0), 0);

  $('#clubName').innerHTML = [...String(club.name).toUpperCase()].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
  $('#clubTag').textContent = club.tag;
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
  collapsible('#metaGrid', '#metaMore', isMobile() ? 4 : 9, 'Brawler');
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
  collapsible('#rankList', '#rankMore', 0, 'Plätze');
  if (animate) {
    gsap.from('.podium-step', { y: 120, opacity: 0, duration: 0.6, stagger: { each: 0.1, from: 'center' }, ease: 'back.out(1.6)' });
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
  collapsible('#topBrawlers', '#brawlerMore', isMobile() ? 6 : 12, 'Brawler');
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
    collapsible('#globalList', '#globalMore', isMobile() ? 5 : 10, 'Spieler');
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
    // Beim Suchen alle Treffer zeigen, sonst die ersten 6 (Handy) bzw. 12
    collapsible('#memberGrid', '#memberMore', q ? 999 : (isMobile() ? 6 : 12), 'Mitglieder');
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
  const channelUrl = 'https://www.youtube.com/@BS-TroopersTV';
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
  collapsible('#eventGrid', '#eventMore', isMobile() ? 4 : 12, 'Events');
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
    .from('.hero .btn', { scale: 0, duration: 0.6, stagger: 0.12, ease: 'elastic.out(1, 0.5)' }, '-=0.2')
    .from('.hero-model.m1', { x: -400, rotation: -20, opacity: 0, duration: 0.9 }, 0.3)
    .from('.hero-model.m2', { x: 400, rotation: 20, opacity: 0, duration: 0.9 }, 0.45);
  gsap.to('.hero-model.m1', { y: -18, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.3 });
  gsap.to('.hero-model.m2', { y: -24, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.5 });
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
    sel = sel.split(',').map((x) => x.trim() + ':not(.more)').join(', ');
    gsap.set(sel, { opacity: 0, y: 50, scale: 0.9 });
    ScrollTrigger.batch(sel, {
      start: 'top 92%', once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.06, ease: 'back.out(1.7)', ...vars }),
    });
  };
  ['.stat', '.join-box', '.meta-card', '.brawler', '.member', '.event', '.info', '.panel', '.rank-list li', '.tv-player', '.tv-list li', '.tv-short'].forEach((s) => pop(s));
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
  sectionFigures();
  sectionSnap();
  ScrollTrigger.refresh();
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const navH = () => document.querySelector('.nav')?.offsetHeight || 0;
const sectionTop = (el) => el.getBoundingClientRect().top + scrollY - navH();

// Pro Bereich eine Brawler-Figur: fliegt beim Hereinscrollen von der Seite ein, schwebt, dreht sich mit dem Scrollen und fliegt wieder hinaus
function sectionFigures() {
  document.querySelectorAll('.sec-fig').forEach((wrap) => {
    const im = wrap.querySelector('img');
    im.src = img.model(im.dataset.id);
    im.onerror = () => (wrap.style.display = 'none');
    if (reduceMotion()) return;
    const dir = wrap.classList.contains('l') ? -1 : 1;
    const sec = wrap.closest('.section');
    const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 90%', end: 'bottom 10%', scrub: 0.8 } });
    tl.fromTo(wrap, { xPercent: dir * 140, rotation: dir * 35, scale: 0.4, opacity: 0 },
                    { xPercent: 0, rotation: dir * -6, scale: 1, opacity: 1, ease: 'back.out(1.6)', duration: 0.25 })
      .to(wrap, { yPercent: -35, rotation: dir * 6, ease: 'none', duration: 0.55 })
      .to(wrap, { xPercent: dir * 120, rotation: dir * 30, scale: 0.6, opacity: 0, ease: 'power2.in', duration: 0.2 });
    gsap.to(im, { y: -12, rotation: dir * -3, duration: 1.6 + Math.random() * 0.6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    // kleiner Hüpfer, sobald der Bereich einrastet
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', onEnter: () => gsap.fromTo(im, { scale: 1 }, { scale: 1.15, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }) });
  });
}

// Einrasten: Nach dem Scrollen gleitet die Seite an den Anfang des nächstgelegenen Bereichs –
// aber nur, wenn er nah ist. Mitten in langen Bereichen (z. B. Mitglieder) bleibt die Seite, wo sie ist.
function sectionSnap() {
  const secs = gsap.utils.toArray('.hero, main .section');
  // Menü: aktiven Bereich markieren, Klicks weich scrollen
  secs.forEach((sec) => {
    if (!sec.id) return;
    const link = document.querySelector(`.nav-links a[href="#${sec.id}"]`);
    if (link) ScrollTrigger.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', toggleClass: { targets: link, className: 'active' } });
  });
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const t = document.querySelector(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    gsap.to(window, { scrollTo: { y: a.getAttribute('href') === '#top' ? 0 : sectionTop(t) }, duration: reduceMotion() ? 0 : 0.8, ease: 'power3.inOut' });
  }));
  if (reduceMotion()) return;
  let snapping = false, touching = false, timer = 0;
  addEventListener('touchstart', () => (touching = true), { passive: true });
  addEventListener('touchend', () => { touching = false; clearTimeout(timer); timer = setTimeout(settle, 220); }, { passive: true });
  addEventListener('scroll', () => { clearTimeout(timer); if (!snapping) timer = setTimeout(settle, 220); }, { passive: true });
  function settle() {
    if (snapping || touching) return;
    const y = scrollY, zone = innerHeight * 0.28;
    let best = null;
    for (const s of secs) {
      const top = s.classList.contains('hero') ? 0 : sectionTop(s);
      if (Math.abs(top - y) > 2 && Math.abs(top - y) < zone && (best === null || Math.abs(top - y) < Math.abs(best - y))) best = top;
    }
    if (best === null) return;
    snapping = true;
    gsap.to(window, { scrollTo: { y: best, autoKill: true }, duration: Math.min(0.7, 0.25 + Math.abs(best - y) / 900), ease: 'power2.inOut',
      onComplete: () => (snapping = false), onInterrupt: () => (snapping = false) });
  }
}
