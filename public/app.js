gsap.registerPlugin(ScrollTrigger);
gsap.ticker.lagSmoothing(0);   // Animationen nach echter Zeit – auch in Hintergrund-Tabs oder bei niedriger Bildrate fertig

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
// Bild fehlt (z. B. ganz neuer Brawler): erst Porträt, dann Platzhalter-Icon
const fallback = (el, id) => { el.onerror = () => { el.onerror = null; el.src = 'maskottchen.png'; el.style.opacity = '.5'; }; el.src = img.portrait(id); };
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
  await Promise.all([renderEvents(), setupGlobal(), renderTV(), renderNews(), renderTops(), renderLexikon(), loadBrawlerData()]);
  renderGuides();
  setupStatSearch();
  setupStudio();
  scrollAnimations();
  router();
  addEventListener('hashchange', router);
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

  if ($('#joinFree')) $('#joinFree').textContent = Math.max(0, 30 - members.length) + ' freie';
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
  const usage = state.data.usage.slice(0, 40);
  const total = state.data.usage.reduce((s, u) => s + u.picks, 0) || 1;
  const max = usage[0]?.picks || 1;
  $('#metaGrid').innerHTML = usage.length ? usage.map((u, i) => `
    <article class="meta-card" data-name="${esc(u.name)}">
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
  $('#topBrawlers').innerHTML = state.data.topBrawlers.map((b, i) => `
    <article class="brawler ${i < 3 ? 'r' + (i + 1) : ''}" data-name="${esc(b.name)}">
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

// ---------- Troopers TV: Videos im TV-Rahmen, Shorts im Handy-Rahmen ----------
async function renderTV() {
  let data;
  try { data = await api('data/youtube.json'); } catch { data = null; }
  const channelUrl = 'https://www.youtube.com/@BS-TroopersTV';
  $('#tvSubscribe').href = channelUrl + '?sub_confirmation=1';
  if (data) $('#tvChannel').textContent = data.channelTitle;
  const videos = (data?.videos || []).filter((v) => !v.short);
  const shorts = (data?.videos || []).filter((v) => v.short);
  const date = (d) => new Date(d).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const clean = (t) => t.replace(/\s*\|\s*Brawl Stars.*$/i, '').replace(/#\S+/g, '').trim();
  const embed = (id, title) => `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  const meta = (v) => `${date(v.published)}${v.views != null ? ` · ${fmt(v.views)} Aufrufe` : ''}`;

  // Horizontales Wisch-Band (TV und Handy): Position, Springen, Pfeiltasten
  const hFeed = (feed, onSettle) => {
    const n = () => feed.children.length;
    const idx = () => Math.max(0, Math.min(n() - 1, Math.round(feed.scrollLeft / (feed.clientWidth || 1))));
    let settle, target = null;
    const go = (i, smooth = true) => {
      const k = Math.max(0, Math.min(n() - 1, i));
      target = k; feed.scrollTo({ left: k * feed.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
      onSettle(k);
    };
    feed.addEventListener('scroll', () => {
      clearTimeout(settle);
      settle = setTimeout(() => { const i = idx(); if (target === null || i === target) { target = null; onSettle(i); } }, 160);
    }, { passive: true });
    ['pointerdown', 'touchstart', 'wheel'].forEach((ev) => feed.addEventListener(ev, () => { target = null; }, { passive: true }));   // Nutzer wischt selbst
    feed.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx() - 1); }
    });
    return { idx: () => target ?? idx(), go };
  };
  // Leiste unter den Playern: aktive Karte markieren und mittig ins Bild holen
  const markStrip = (strip, i) => strip.querySelectorAll('.strip-card').forEach((c) => {
    const on = +c.dataset.i === i; c.classList.toggle('active', on);
    if (on && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: c.offsetLeft - (strip.clientWidth - c.offsetWidth) / 2, behavior: 'smooth' });
  });

  // --- TV (lange Videos): horizontal wischen oder ◀ ▶, Tippen spielt ab ---
  if (!videos.length) { $('#tvPlayer').innerHTML = '<p class="tv-empty">Noch keine Videos – bald geht’s los! 🎬</p>'; }
  else {
    const tv = $('#tvPlayer');
    tv.innerHTML = videos.map((v, i) => `
      <div class="long-card" data-i="${i}" data-id="${v.id}">
        <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" loading="${i < 2 ? 'eager' : 'lazy'}"><span class="tv-play"></span><div class="tv-caption">${esc(clean(v.title))}</div>
      </div>`).join('');
    const stopTV = () => tv.querySelectorAll('.long-card iframe').forEach((f) => f.remove());
    const label = (i) => { $('#tvNow').textContent = `${i + 1} / ${videos.length} · ${clean(videos[i].title)}`; markStrip($('#tvList'), i); };
    const feed = hFeed(tv, (i) => { if (!tv.children[i].querySelector('iframe')) stopTV(); label(i); });
    const play = (i) => { stopTV(); tv.children[i].insertAdjacentHTML('beforeend', embed(videos[i].id, videos[i].title)); };
    tv.addEventListener('click', (e) => { const c = e.target.closest('.long-card'); if (c && !c.querySelector('iframe')) play(+c.dataset.i); });
    $('#tvList').innerHTML = videos.map((v, i) => `
      <button class="strip-card" data-i="${i}"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy">
        <span>${esc(clean(v.title))}<small>${meta(v)}</small></span></button>`).join('');
    $('#tvList').addEventListener('click', (e) => {
      const c = e.target.closest('.strip-card'); if (!c) return;
      const i = +c.dataset.i; feed.go(i, false); play(i); $('#tv').scrollIntoView({ behavior: 'smooth' });
    });
    $('#tvPrev').onclick = () => feed.go(feed.idx() - 1);
    $('#tvNext').onclick = () => feed.go(feed.idx() + 1);
    label(0);
  }

  // --- Handy (Shorts): horizontal wischen oder ◀ ▶ ---
  if (!shorts.length) return;
  $('#tvShortsWrap').hidden = false;
  const feed = $('#tvShorts');
  feed.innerHTML = shorts.map((v, i) => `
    <div class="short-card" data-i="${i}" data-id="${v.id}">
      <img src="https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${v.id}/hqdefault.jpg'" alt="" loading="lazy">
      <span class="tv-play small"></span>
      <div class="short-meta"><b>${esc(clean(v.title))}</b><small>${meta(v)}</small></div>
    </div>`).join('');
  const cards = [...feed.children];
  // Autoplay (Desktop + Handy): sichtbarer Short läuft stumm in Schleife; Ton-Knopf schaltet per IFrame-API um.
  let soundOn = false;
  const cmd = (f, func) => f?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
  const autoEmbed = (id) => `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1" title="TroopersTV Short" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  const stop = () => feed.querySelectorAll('.short-card iframe').forEach((f) => { f.closest('.short-card').classList.remove('playing'); f.remove(); });
  const play = (c) => {
    if (c.querySelector('iframe')) return;
    stop(); c.insertAdjacentHTML('beforeend', autoEmbed(c.dataset.id)); c.classList.add('playing');
    const f = c.querySelector('iframe');
    f.addEventListener('load', () => {
      f.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
      [400, 1200].forEach((ms) => setTimeout(() => { cmd(f, 'playVideo'); if (soundOn) cmd(f, 'unMute'); }, ms));
    });
  };
  let visible = false;
  const label = (i = idx()) => { $('#shortNow').textContent = `${i + 1} / ${cards.length}`; markStrip($('#shortStrip'), i); };
  const playCurrent = (i = idx()) => { if (visible) play(cards[Math.min(cards.length - 1, i)]); };
  const { idx, go } = hFeed(feed, (i) => { label(i); playCurrent(i); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? playCurrent() : stop(); }, { threshold: 0.5 }).observe(feed);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else playCurrent(); });
  const snd = $('#shortSound');
  if (snd) snd.onclick = () => {
    soundOn = !soundOn; snd.textContent = soundOn ? '🔊' : '🔇'; snd.setAttribute('aria-pressed', soundOn);
    cmd(feed.querySelector('.short-card iframe'), soundOn ? 'unMute' : 'mute');
  };
  $('#shortPrev').onclick = () => go(idx() - 1);
  $('#shortNext').onclick = () => go(idx() + 1);
  feed.tabIndex = 0;
  $('#shortStrip').innerHTML = shorts.map((v, i) => `
    <button class="strip-card short" data-i="${i}"><img src="https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${v.id}/hqdefault.jpg'" alt="" loading="lazy">
      <span>${esc(clean(v.title))}<small>${meta(v)}</small></span></button>`).join('');
  $('#shortStrip').addEventListener('click', (e) => { const c = e.target.closest('.strip-card'); if (!c) return; go(+c.dataset.i, false); $('#tv').scrollIntoView({ behavior: 'smooth' }); });
  label();
}

// ---------- News ----------
async function renderNews() {
  let n;
  try { n = await api('data/news.json'); } catch { $('#news').hidden = true; return; }
  const date = (d) => new Date(d).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  const vids = n.videos || [];
  const feat = vids.find((v) => v.brawlTalk) || vids[0];
  const f = $('#newsFeature');
  if (feat) {
    f.href = `https://www.youtube.com/watch?v=${feat.id}`;
    f.innerHTML = `<img src="https://i.ytimg.com/vi/${feat.id}/hqdefault.jpg" alt="" loading="lazy"><span class="tv-play small"></span>
      <div class="news-feature-text"><span class="tag">${feat.brawlTalk ? 'BRAWL TALK · UPDATE' : 'NEU'}</span><b>${esc(feat.title)}</b><small>${date(feat.date)}</small></div>`;
  } else f.remove();
  $('#newsVideos').innerHTML = vids.filter((v) => v !== feat).slice(0, 8).map((v) => `
    <li><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">
      <img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy"><span>${esc(v.title)}<small>${date(v.date)}${v.brawlTalk ? ' · Brawl Talk' : ''}</small></span></a></li>`).join('');
  $('#newsArticles').innerHTML = (n.articles || []).slice(0, 8).map((a) => `
    <a class="news-article" href="${esc(a.url)}" target="_blank" rel="noopener">
      ${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : ''}
      <div><small>${date(a.date)}</small><b>${esc(a.title)}</b></div></a>`).join('') || '<p class="muted">Keine Artikel gefunden.</p>';
}

// ---------- Ranglisten (Clubs/Spieler DE + Welt) ----------
async function renderTops() {
  let t;
  try { t = await api('data/tops.json'); } catch { $('#ranglisten').hidden = true; return; }
  $('#clubRankLine').innerHTML = t.clubRankDE
    ? `TROOPERS steht in Deutschland auf <b>Platz ${t.clubRankDE}</b>.`
    : 'TROOPERS ist noch nicht in den deutschen Top 200 – gemeinsam pushen! 💪';
  const draw = (key) => {
    const [kind, region] = key.split('.');
    const list = t[kind]?.[region] || [];
    $('#topList').innerHTML = list.map((p) => `
      <li><span class="n">${p.rank}</span>
        <img src="${kind === 'clubs' ? img.badge(p.badgeId) : img.icon(p.icon?.id)}" alt="" loading="lazy">
        <span class="nm"><span style="color:${color(p.nameColor)}">${esc(p.name)}</span>
          <small>${kind === 'clubs' ? `${p.memberCount ?? '–'}/30 Mitglieder` : esc(p.club?.name || 'Kein Club')}</small></span>
        <span class="t">${trophy}${fmt(p.trophies)}</span></li>`).join('') || '<li class="muted">Keine Daten.</li>';
    collapsible('#topList', '#topMore', isMobile() ? 5 : 10, 'Plätze');
  };
  $('#topTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b) return;
    $('#topTabs').querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
    draw(b.dataset.k);
  });
  draw('clubs.de');
}

// ---------- Brawler-Sammlung des Clubs ----------
async function renderLexikon() {
  const stats = state.data.brawlerStats || [];
  let all = [];
  try { all = (await api('data/brawlers.json')).items || []; } catch {}
  if (!stats.length && !all.length) { $('#lexikon').hidden = true; return; }
  const n = state.data.members.length || 1, tot = state.data.totals || {};
  const gadgets = all.reduce((s, b) => s + (b.gadgets?.length || 0), 0), sps = all.reduce((s, b) => s + (b.starPowers?.length || 0), 0);
  $('#lexStats').innerHTML = [
    ['Brawler im Spiel', all.length || '–'], ['Gadgets', gadgets || '–'], ['Star Powers', sps || '–'],
    ['Brawler im Club', fmt(tot.brawlers)], ['3v3-Siege Club', fmt(tot.trio)], ['Showdown-Siege', fmt((tot.solo || 0) + (tot.duo || 0))],
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  const byId = Object.fromEntries(stats.map((s) => [s.id, s]));
  const rows = (all.length ? all : stats).map((b) => ({ ...b, ...(byId[b.id] || { owners: 0, p11: 0, maxTrophies: 0 }) }))
    .sort((a, b) => b.owners - a.owners || b.maxTrophies - a.maxTrophies);
  $('#lexGrid').innerHTML = rows.map((b) => `
    <div class="lex-cell ${b.owners ? '' : 'none'}" data-name="${esc(b.name)}" title="${esc(cap(b.name))}: ${b.owners}/${n} besitzen ihn, ${b.p11} auf Stufe 11, bester ${fmt(b.maxTrophies)} Trophäen">
      <img src="${img.portrait(b.id)}" onerror="this.onerror=null;this.src='maskottchen.png';this.style.opacity='.5'" alt="" loading="lazy"><span class="nm">${esc(cap(b.name))}</span>
      <span class="own"><i style="width:${Math.round((b.owners / n) * 100)}%"></i></span><small>${b.owners}/${n} · ${b.p11}× P11</small></div>`).join('');
  collapsible('#lexGrid', '#lexMore', isMobile() ? 12 : 24, 'Brawler');
  const newest = all.slice().sort((a, b) => b.id - a.id).slice(0, 3);
  $('#lexNew').innerHTML = newest.map((b) => `
    <article><img src="${img.model(b.id)}" onerror="fallback(this, ${b.id})" alt="" loading="lazy">
      <div><b>${esc(cap(b.name))}</b>
        <small>Gadgets: ${esc((b.gadgets || []).map(cap).join(', ') || '–')}</small>
        <small>Star Powers: ${esc((b.starPowers || []).map(cap).join(', ') || '–')}</small>
        <small>Im Club: ${byId[b.id]?.owners || 0} von ${n}</small></div></article>`).join('');
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
  collapsible('#eventGrid', '#eventMore', isMobile() ? 4 : 8, 'Maps');
}
function parseTime(t) {
  const m = t.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  return m ? new Date(Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5])).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

// ---------- Brawler-Daten (Namen, Fähigkeiten) ----------
const store = { brawlers: [], info: {}, guides: [], byName: {} };
async function loadBrawlerData() {
  try { store.brawlers = (await api('data/brawlers.json')).items || []; } catch { store.brawlers = []; }
  try { store.info = (await api('data/brawlerinfo.json')).brawlers || {}; } catch { store.info = {}; }
  try { store.guides = (await api('guides.json')).guides || []; } catch { store.guides = []; }
  for (const b of store.brawlers) store.byName[b.name.toLowerCase()] = b;
  $('#brawlerNames').innerHTML = store.brawlers.map((b) => `<option value="${esc(cap(b.name))}">`).join('');
}
const findBrawler = (q) => {
  q = String(q || '').trim().toLowerCase();
  if (!q) return null;
  return store.byName[q] || store.brawlers.find((b) => b.name.toLowerCase().startsWith(q)) || null;
};
const clubStat = (id) => (state.data.brawlerStats || []).find((s) => s.id === id);
const usageOf = (id) => (state.data.usage || []).find((u) => u.id === id);
const topOf = (id) => (state.data.topBrawlers || []).find((t) => t.id === id);
const guideFor = (id) => store.guides.find((g) => g.brawlerId === id);
const ytEmbed = (id, start = 0) => `<iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${id}?start=${start}&rel=0&playsinline=1" title="TroopersTV" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>`;

// ---------- Guides ----------
function renderGuides() {
  const list = $('#guideList');
  const draw = (q) => {
    const b = findBrawler(q);
    const qs = String(q || '').trim().toLowerCase();
    const hits = store.guides.filter((g) => !qs || g.title.toLowerCase().includes(qs) || (store.info[g.brawlerId]?.name || '').toLowerCase().includes(qs));
    let html = hits.map((g) => {
      const inf = store.info[g.brawlerId] || {};
      return `<a class="guide-card" href="#guides/${g.id}" style="--rc:${inf.color || '#ffd21f'}">
        <img src="${img.model(g.brawlerId)}" onerror="fallback(this, ${g.brawlerId})" alt="" loading="lazy">
        <div><small>${esc(inf.rarity || '')} · ${esc(g.level)}</small><b>${esc(g.title)}</b><span>${esc(g.tagline)}</span></div></a>`;
    }).join('');
    if (qs && !hits.length) {
      html = `<div class="guide-empty">${b ? `Für <b>${esc(cap(b.name))}</b> gibt es noch keinen Guide.
        <a class="more-btn" href="#statistik/${encodeURIComponent(b.name.toLowerCase())}">📊 ${esc(cap(b.name))} in der Statistik ansehen</a>` : 'Kein Brawler gefunden.'}</div>`;
    }
    list.innerHTML = html || '<p class="muted">Noch keine Guides.</p>';
  };
  $('#guideSearch').addEventListener('input', (e) => {
    const b = findBrawler(e.target.value);
    const g = b && guideFor(b.id);
    if (g && b.name.toLowerCase() === e.target.value.trim().toLowerCase()) { location.hash = `guides/${g.id}`; return; }
    draw(e.target.value);
  });
  draw('');
}

function showGuide(id) {
  const g = store.guides.find((x) => x.id === id);
  const v = $('#guideView');
  if (!g) { v.hidden = true; $('#guideList').hidden = false; return; }
  const inf = store.info[g.brawlerId] || {}, cs = clubStat(g.brawlerId), us = usageOf(g.brawlerId), tp = topOf(g.brawlerId);
  const n = state.data.members.length || 1;
  const bar = (k, val) => `<div class="rate"><span>${esc(k)}</span><i>${'<b></b>'.repeat(val)}${'<u></u>'.repeat(5 - val)}</i></div>`;
  const abil = (x, kind) => `<div class="abil ${kind}"><small>${esc(x.type || kind)}</small><b>${esc(x.name)}</b><p>${esc(x.text)}</p></div>`;
  const apiList = (arr, kind) => (arr || []).map((x) => abil({ type: kind, name: x.name, text: x.text }, kind.toLowerCase().replace(' ', ''))).join('');
  v.innerHTML = `
    <a class="back" href="#guides">← Alle Guides</a>
    <header class="guide-head" style="--rc:${inf.color || '#ffd21f'}">
      <img src="${img.model(g.brawlerId)}" onerror="fallback(this, ${g.brawlerId})" alt="">
      <div>
        <small>${esc(inf.rarity || '')}${inf.cls ? ' · ' + esc(inf.cls) : ''}</small>
        <h2>${esc(g.title)}</h2><p class="tagline">${esc(g.tagline)}</p>
        <p>${esc(g.summary)}</p>
        <div class="rates">${Object.entries(g.rating || {}).map(([k, val]) => bar(k, val)).join('')}<small class="muted-note">Einschätzung TroopersTV</small></div>
      </div>
    </header>
    <div class="guide-grid">
      <section class="g-box"><h3>Fähigkeiten</h3>${(g.abilities || []).map((x) => abil(x, x.type === 'Super' ? 'super' : 'attack')).join('')}
        ${apiList(inf.gadgets, 'Gadget')}${apiList(inf.starPowers, 'Star Power')}
        ${inf.gadgets?.length ? '<small class="muted-note">Gadget- und Star-Power-Texte aus BrawlAPI (englisch).</small>' : ''}</section>
      <section class="g-box"><h3>Empfohlener Build</h3>
        <div class="build"><span>🔧 ${esc(g.build.gadget)}</span><span>⭐ ${esc(g.build.starPower)}</span></div><p>${esc(g.build.why)}</p>
        <h3>Beste Modi</h3><div class="build">${g.modes.map((m) => `<span>${esc(m)}</span>`).join('')}</div>
        <h3>Stärken &amp; Schwächen</h3><p>👍 ${esc(g.counters.strongVs)}</p><p>👎 ${esc(g.counters.weakVs)}</p></section>
      <section class="g-box"><h3>Im Club</h3>
        <div class="g-stats">
          <div><small>Besitzen</small><b>${cs ? cs.owners : 0}/${n}</b></div><div><small>Stufe 11</small><b>${cs ? cs.p11 : 0}</b></div>
          <div><small>Bester</small><b>${cs ? fmt(cs.maxTrophies) : '–'}</b></div><div><small>Ø Trophäen</small><b>${cs ? fmt(cs.avgTrophies) : '–'}</b></div>
          <div><small>Picks (Meta)</small><b>${us ? us.picks : 0}</b></div><div><small>Siegquote</small><b>${us && us.picks ? Math.round((us.wins / us.picks) * 100) + '%' : '–'}</b></div>
        </div>
        ${tp ? `<p>Bester im Club: <b>${esc(tp.owner)}</b> mit ${fmt(tp.trophies)} 🏆</p>` : ''}
        <a class="more-btn" href="#statistik/${encodeURIComponent((inf.name || '').toLowerCase())}">📊 Weltrangliste &amp; mehr</a></section>
    </div>
    <section class="g-box wide"><h3>Spielstil – mit Szenen aus unseren Videos</h3>
      <div class="play-steps">${g.playstyle.map((p, i) => `
        <div class="step"><div class="step-video">${p.video ? ytEmbed(p.video.id, p.video.start) : ''}</div>
          <div><small>Tipp ${i + 1}</small><b>${esc(p.title)}</b><p>${esc(p.text)}</p></div></div>`).join('')}</div></section>`;
  $('#guideList').hidden = true; v.hidden = false;
  v.scrollIntoView({ block: 'start' });
}

// ---------- Statistik: Brawler-Suche ----------
function setupStatSearch() {
  const input = $('#statSearch');
  const apply = (b) => {
    const prof = $('#brawlerProfile');
    const want = b ? b.name.toLowerCase() : '';
    // Karten filtern
    for (const sel of ['#metaGrid .meta-card', '#topBrawlers .brawler', '#lexGrid .lex-cell']) {
      document.querySelectorAll(sel).forEach((c) => { const n = (c.dataset.name || '').toLowerCase(); c.classList.toggle('filtered-out', !!want && n !== want); });
    }
    document.querySelectorAll('#metaGrid, #topBrawlers, #lexGrid').forEach((l) => {
      l.classList.toggle('filtering', !!want);
      l.toggleAttribute('data-none', !!want && ![...l.children].some((c) => (c.dataset.name || '').toLowerCase() === want));
    });
    $('#statClear').hidden = !want;
    if (!b) { prof.hidden = true; return; }
    const sel = $('#globalBrawler');
    if (sel && [...sel.options].some((o) => +o.value === b.id)) { sel.value = b.id; sel.dispatchEvent(new Event('change')); }
    const inf = store.info[b.id] || {}, cs = clubStat(b.id), us = usageOf(b.id), tp = topOf(b.id), g = guideFor(b.id);
    const n = state.data.members.length || 1;
    prof.innerHTML = `
      <img src="${img.model(b.id)}" onerror="fallback(this, ${b.id})" alt="">
      <div class="bp-main">
        <small style="color:${inf.color || '#fff'}">${esc(inf.rarity || '')}${inf.cls ? ' · ' + esc(inf.cls) : ''}</small>
        <h3>${esc(cap(b.name))}</h3>
        <p>${esc(inf.description || '')}</p>
        <div class="g-stats">
          <div><small>Im Club</small><b>${cs ? cs.owners : 0}/${n}</b></div><div><small>Stufe 11</small><b>${cs ? cs.p11 : 0}</b></div>
          <div><small>Bester</small><b>${cs ? fmt(cs.maxTrophies) : '–'}</b></div><div><small>Picks</small><b>${us ? us.picks : 0}</b></div>
          <div><small>Siegquote</small><b>${us && us.picks ? Math.round((us.wins / us.picks) * 100) + '%' : '–'}</b></div>
          <div><small>Gadgets / SP</small><b>${(inf.gadgets || b.gadgets || []).length} / ${(inf.starPowers || b.starPowers || []).length}</b></div>
        </div>
        ${tp ? `<p>Bester im Club: <b>${esc(tp.owner)}</b> · ${fmt(tp.trophies)} 🏆</p>` : ''}
        <div class="bp-links">${g ? `<a class="more-btn" href="#guides/${g.id}">📘 Zum ${esc(g.title)}</a>` : '<span class="muted">Noch kein Guide</span>'}
          <a class="more-btn" href="#statistik" onclick="document.querySelector('.panel.global').scrollIntoView({behavior:'smooth'});return false;">🌍 Weltrangliste</a></div>
      </div>`;
    prof.hidden = false;
  };
  input.addEventListener('input', () => {
    const b = findBrawler(input.value);
    if (b && (b.name.toLowerCase() === input.value.trim().toLowerCase())) { history.replaceState(null, '', `#statistik/${encodeURIComponent(b.name.toLowerCase())}`); apply(b); }
    else if (!input.value.trim()) { history.replaceState(null, '', '#statistik'); apply(null); }
  });
  $('#statClear').onclick = () => { input.value = ''; history.replaceState(null, '', '#statistik'); apply(null); };
  store.applyStat = (name) => { const b = findBrawler(name); if (b) { input.value = cap(b.name); apply(b); } else { input.value = ''; apply(null); } };
}

// ---------- Navigation: #videos · #guides[/id] · #statistik[/brawler] · #clan ----------
function router() {
  const [view0, arg] = decodeURIComponent(location.hash.replace(/^#/, '')).split('/');
  const view = ['videos', 'guides', 'statistik', 'clan'].includes(view0) ? view0 : 'videos';
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.dataset.view !== view));
  document.querySelectorAll('.nav-links a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  if (view === 'guides') showGuide(arg);
  if (view === 'statistik' && arg === 'freigabe') { store.applyStat?.(''); setTimeout(() => $('#freigabe').scrollIntoView(), 50); return; }
  if (view === 'statistik') store.applyStat?.(arg || '');
  if (!(view === 'guides' && arg)) scrollTo({ top: 0 });
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

// ---------- GSAP ----------
function countUp(el, value, delay = 0) {
  const o = { v: 0 };
  gsap.to(o, { v: Number(value) || 0, duration: 1.6, delay, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(Math.round(o.v))) });
}

function heroIntro() {
  gsap.from('.hero-card', { y: 40, opacity: 0, duration: 0.7, ease: 'back.out(1.6)', clearProps: 'all' });
  gsap.from('.hero-primo', { x: 120, rotation: 12, opacity: 0, duration: 0.8, delay: 0.2, ease: 'back.out(1.7)', clearProps: 'all' });
  gsap.from('.hero-card .pill-btn.big', { scale: 0.6, opacity: 0, duration: 0.5, delay: 0.5, ease: 'back.out(3)', clearProps: 'all' });
  pitchAnimation();
  heroVideo();
  // Beitreten-Leiste erscheint, sobald der Kopfbereich aus dem Bild gescrollt ist
  const bar = $('#joinBar');
  if (bar) new IntersectionObserver(([e]) => bar.classList.toggle('show', !e.isIntersecting), { threshold: 0 }).observe($('.hero-card'));
}

// Brawl-Ball-Szene im Kopfbereich: Dribbeln, Doppelpass, Schuss, Tor – Seiten wechseln sich ab
function pitchAnimation() {
  const pitch = $('#pitch');
  if (!pitch) return;
  const $p = (id) => $('#' + id);
  const ball = $p('ball'), shadow = $p('ballShadow'), txt = $p('goalText');
  const B = ['plB1', 'plB2', 'plB3'].map($p), R = ['plR1', 'plR2', 'plR3'].map($p);
  const S = { x: 50, y: 50, h: 0 };
  const rings = [...pitch.querySelectorAll('.ring')].map((r) => [r, $p(r.dataset.for)]);
  const draw = () => {
    for (const [r, el] of rings) { r.style.left = el.style.left; r.style.top = el.style.top; }
    ball.style.left = S.x + '%'; ball.style.top = S.y + '%'; ball.style.transform = `translate(-50%, calc(-50% - ${S.h}px)) rotate(${S.x * 12}deg)`;
    shadow.style.left = S.x + '%'; shadow.style.top = S.y + '%'; shadow.style.transform = `translate(-50%, -50%) scale(${1 - Math.min(0.6, S.h / 90)})`;
  };
  const place = (el, x, y) => gsap.set(el, { left: x + '%', top: y + '%' });
  const face = (el, dx) => { if (dx) gsap.set(el, { scaleX: dx < 0 ? -1 : 1 }); };
  const score = { b: 0, r: 0 };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    [[B[0], 40, 50], [B[1], 30, 25], [B[2], 30, 78], [R[0], 62, 48], [R[1], 72, 72], [R[2], 75, 26]].forEach(([e, x, y]) => place(e, x, y));
    Object.assign(S, { x: 44, y: 52 }); draw(); return;
  }
  // m = Spiegelung für die Gegenseite (x → 100 − x)
  const seq = (att, def, mirror, onGoal) => {
    const X = (x) => (mirror ? 100 - x : x);
    const Y = (y) => 12 + y * 0.62;   // Spielzüge im sichtbaren oberen Teil (die Karte überdeckt den unteren Rand)
    const tl = gsap.timeline({ defaults: { ease: 'power1.inOut' }, onUpdate: draw });
    const run = (el, x, y, d, at) => {
      tl.call(() => face(el, (X(x) - parseFloat(el.style.left || 50)) * 1), null, at);
      tl.to(el, { left: X(x) + '%', top: Y(y) + '%', duration: d }, at);
      tl.to(el, { y: -6, duration: d / 6, repeat: 5, yoyo: true, ease: 'sine.inOut' }, at);
    };
    const kick = (x, y, d, at, hMax = 40) => {
      tl.to(S, { x: X(x), y: Y(y), duration: d, ease: 'none' }, at);
      tl.to(S, { keyframes: [{ h: hMax, duration: d / 2, ease: 'power2.out' }, { h: 0, duration: d / 2, ease: 'power2.in' }] }, at);
    };
    tl.call(() => {
      [[att[0], 32, 50], [att[1], 38, 24], [att[2], 26, 76], [def[0], 60, 48], [def[1], 70, 72], [def[2], 80, 28]].forEach(([e, x, y]) => { place(e, X(x), Y(y)); face(e, mirror ? -1 : 1); });
      [def[0], def[1], def[2]].forEach((e) => face(e, mirror ? 1 : -1));
      Object.assign(S, { x: X(35), y: Y(52), h: 0 }); draw();
      gsap.set(txt, { scale: 0, opacity: 0 });
    });
    // 1) Dribbling, Verteidiger presst
    run(att[0], 48, 50, 1.3, 0.2); tl.to(S, { x: X(51), y: Y(52), duration: 1.3 }, 0.2);
    run(def[0], 56, 47, 1.1, 0.4);
    // 2) Pass auf den Flügel
    run(att[1], 60, 22, 1.4, 0.8); kick(60, 24, 0.7, 1.5, 55);
    run(att[0], 58, 60, 1.2, 1.6); run(def[2], 68, 30, 1.0, 1.7);
    // 3) Dribbling + Querpass in die Mitte
    run(att[1], 72, 26, 0.9, 2.3); tl.to(S, { x: X(74), y: Y(28), duration: 0.9 }, 2.3);
    run(att[2], 76, 62, 1.8, 1.4); run(def[1], 82, 60, 1.2, 2.2);
    kick(78, 60, 0.6, 3.25, 30);
    // 4) Schuss aufs Tor, Keeper-Sprung zu spät
    tl.to(S, { x: X(97), y: Y(50), duration: 0.45, ease: 'power2.in' }, 3.95);
    tl.to(S, { keyframes: [{ h: 22, duration: 0.22 }, { h: 0, duration: 0.23 }] }, 3.95);
    run(def[1], 90, 48, 0.4, 3.95);
    // 5) Tor!
    tl.call(() => { onGoal(); pitch.classList.add('flash'); setTimeout(() => pitch.classList.remove('flash'), 350); }, null, 4.4);
    tl.fromTo(txt, { scale: 0, opacity: 0, rotation: -12 }, { scale: 1, opacity: 1, rotation: -6, duration: 0.5, ease: 'back.out(3)' }, 4.4);
    att.forEach((e, i) => tl.to(e, { y: -22, duration: 0.25, repeat: 3, yoyo: true, ease: 'power2.out' }, 4.45 + i * 0.08));
    tl.to(txt, { scale: 0.6, opacity: 0, duration: 0.3 }, 6.2);
    tl.to([...att, ...def, ball, shadow], { opacity: 0, duration: 0.3 }, 6.3);
    tl.set([...att, ...def, ball, shadow], { opacity: 1 }, 6.65);
    return tl;
  };
  const scoreEl = pitch.querySelector('.score');
  const upd = () => { scoreEl.querySelector('.sb').textContent = score.b; scoreEl.querySelector('.sr').textContent = score.r; gsap.fromTo(scoreEl, { scale: 1.4 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }); };
  const master = gsap.timeline({ repeat: -1, onRepeat: () => { if (score.b + score.r >= 10) { score.b = 0; score.r = 0; upd(); } } });
  master.add(seq(B, R, false, () => { score.b++; upd(); }));
  master.add(seq(R, B, true, () => { score.r++; upd(); }));
  // Nur animieren, wenn sichtbar (spart Akku)
  new IntersectionObserver(([e]) => (e.isIntersecting ? master.play() : master.pause()), { threshold: 0.05 }).observe(pitch);
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

// Menü: aktuellen Bereich markieren
function navActive() {
  document.querySelectorAll('main .section[id]').forEach((sec) => {
    const link = document.querySelector(`.nav-links a[href="#${sec.id}"]`);
    if (link) ScrollTrigger.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', toggleClass: { targets: link, className: 'active' } });
  });
}

// Kopf-Video: nur abspielen, wenn sichtbar; bei "weniger Bewegung" Standbild zeigen
function heroVideo() {
  const v = $('#heroVideo');
  if (!v) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { v.removeAttribute('autoplay'); v.pause(); return; }
  new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.05 }).observe(v);
}

// ---------- Shorts-Freigabe (Team) ----------
// trooperscut lädt neue Shorts "nicht gelistet" mit dem Tag FREIGABE_TAG hoch. Hier sieht das Team sie,
// spielt sie ab und stellt sie auf öffentlich oder löscht sie. Alles läuft im Browser über die YouTube Data API;
// die Anmeldung (Google) klappt nur mit Konten, die den Kanal verwalten.
const STUDIO_CLIENT_ID = '';   // OAuth-Client-ID (Webanwendung, Ursprung https://troopers.tv) aus der Google Cloud Console
const FREIGABE_TAG = 'troopers-freigabe';
const YT = 'https://www.googleapis.com/youtube/v3/';

function setupStudio() {
  if (!STUDIO_CLIENT_ID) return;   // erst sichtbar, wenn die Google-Anmeldung eingerichtet ist
  $('#freigabe').hidden = false;
  const msg = (t) => ($('#studioMsg').innerHTML = t);
  const grid = $('#studioGrid'), login = $('#studioLogin'), reload = $('#studioReload');
  let token = null, items = [];

  const yt = async (path, opt = {}) => {
    const res = await fetch(YT + path, { ...opt, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (res.status === 401) { token = null; login.hidden = false; reload.hidden = true; throw new Error('Anmeldung abgelaufen – bitte neu anmelden.'); }
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `YouTube-Fehler ${res.status}`); }
    return res.status === 204 ? null : res.json();
  };
  const secs = (d) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || '') || []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };

  async function load() {
    msg('Lade wartende Shorts…'); grid.innerHTML = '';
    const ch = await yt('channels?part=contentDetails,snippet&mine=true');
    const c = ch.items?.[0];
    if (!c) throw new Error('Mit diesem Konto ist kein YouTube-Kanal verbunden.');
    $('#studioHead').textContent = `🎬 ${c.snippet.title}`;
    const ids = []; let page = '';
    for (let i = 0; i < 4; i++) {   // die neuesten 200 Uploads reichen
      const pl = await yt(`playlistItems?part=contentDetails&maxResults=50&playlistId=${c.contentDetails.relatedPlaylists.uploads}${page ? '&pageToken=' + page : ''}`);
      ids.push(...pl.items.map((x) => x.contentDetails.videoId));
      if (!(page = pl.nextPageToken)) break;
    }
    items = [];
    for (let i = 0; i < ids.length; i += 50) {
      const v = await yt(`videos?part=snippet,status,contentDetails&id=${ids.slice(i, i + 50).join(',')}`);
      items.push(...v.items.filter((x) => x.status.privacyStatus === 'unlisted' && (x.snippet.tags || []).includes(FREIGABE_TAG)));
    }
    render();
  }

  function render() {
    if (!items.length) { grid.innerHTML = ''; msg('✅ Keine Shorts warten auf Freigabe.'); return; }
    msg(`${items.length} ${items.length === 1 ? 'Short wartet' : 'Shorts warten'} auf Freigabe. Antippen zum Abspielen.`);
    grid.innerHTML = items.map((v) => `
      <article class="studio-card" data-id="${v.id}">
        <div class="studio-player"><img src="${esc(v.snippet.thumbnails?.high?.url || '')}" alt=""><span class="tv-play small"></span>
          <span class="studio-len">${secs(v.contentDetails.duration)} s</span></div>
        <input class="studio-title" value="${esc(v.snippet.title)}" maxlength="100" aria-label="Titel">
        <small>${new Date(v.snippet.publishedAt).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
        <div class="studio-btns"><button class="more-btn ok">✔ Freigeben</button><button class="more-btn no">✖ Verwerfen</button></div>
      </article>`).join('');
  }

  grid.addEventListener('click', async (e) => {
    const card = e.target.closest('.studio-card'); if (!card) return;
    const v = items.find((x) => x.id === card.dataset.id);
    if (e.target.closest('.studio-player')) {
      grid.querySelectorAll('.studio-player iframe').forEach((f) => f.remove());
      card.querySelector('.studio-player').insertAdjacentHTML('beforeend',
        `<iframe src="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&playsinline=1" title="${esc(v.snippet.title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`);
      return;
    }
    const ok = e.target.closest('.ok'), no = e.target.closest('.no');
    if (!ok && !no) return;
    const title = card.querySelector('.studio-title').value.trim() || v.snippet.title;
    if (no && !confirm(`„${title}“ endgültig von YouTube löschen?`)) return;
    card.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      if (ok) {
        const { categoryId, description, defaultLanguage, defaultAudioLanguage } = v.snippet;
        const tags = (v.snippet.tags || []).filter((t) => t !== FREIGABE_TAG);
        const st = v.status;
        await yt('videos?part=snippet,status', { method: 'PUT', body: JSON.stringify({ id: v.id,
          snippet: { title, categoryId, description, tags, defaultLanguage, defaultAudioLanguage },
          status: { privacyStatus: 'public', embeddable: st.embeddable, license: st.license, publicStatsViewable: st.publicStatsViewable, selfDeclaredMadeForKids: st.madeForKids } }) });
      } else {
        await yt(`videos?id=${v.id}`, { method: 'DELETE' });
      }
      items = items.filter((x) => x !== v);
      render();
      msg(`${ok ? '🚀 Freigegeben: ' : '🗑️ Gelöscht: '}„${esc(title)}“. ${$('#studioMsg').innerHTML}`);
    } catch (err) {
      card.querySelectorAll('button').forEach((b) => (b.disabled = false));
      msg(`⚠️ ${esc(err.message)}`);
    }
  });

  const run = () => load().then(() => { login.hidden = true; reload.hidden = false; }).catch((err) => msg(`⚠️ ${esc(err.message)}`));
  reload.onclick = run;
  login.onclick = () => {
    if (!STUDIO_CLIENT_ID) { msg('⚠️ Die Anmeldung ist noch nicht eingerichtet (Google-Client-ID fehlt).'); return; }
    const start = () => google.accounts.oauth2.initTokenClient({
      client_id: STUDIO_CLIENT_ID, scope: 'https://www.googleapis.com/auth/youtube',
      callback: (r) => { if (r.error) { msg(`⚠️ Anmeldung abgebrochen (${esc(r.error)}).`); return; } token = r.access_token; run(); },
    }).requestAccessToken();
    if (window.google?.accounts?.oauth2) return start();
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client'; sc.onload = start;
    sc.onerror = () => msg('⚠️ Google-Anmeldung konnte nicht geladen werden.');
    document.head.append(sc);
  };
}
