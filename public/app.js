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
  await Promise.all([renderEvents(), setupGlobal(), renderTV(), renderNews(), renderTops(), renderLexikon()]);
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
  const clean = (t) => t.replace(/\s*\|\s*Brawl Stars.*$/i, '').replace(/#\S+/g, '').trim();
  const embed = (id, title) => `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;

  if (!videos.length) {
    $('#tvPlayer').outerHTML = '<p class="tv-empty">Noch keine Videos – bald geht’s los! 🎬</p>';
    $('#tvList').remove();
  } else {
    // Vorschau erst beim Klick durch den (datensparsamen) YouTube-Player ersetzen
    const show = (v, autoplay) => {
      const p = $('#tvPlayer');
      p.innerHTML = autoplay ? embed(v.id, v.title)
        : `<img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt=""><span class="tv-play"></span><div class="tv-caption">${esc(clean(v.title))}</div>`;
      p.onclick = autoplay ? null : () => show(v, true);
      document.querySelectorAll('.tv-list li').forEach((li) => li.classList.toggle('active', li.dataset.id === v.id));
    };
    $('#tvList').innerHTML = videos.map((v) => `
      <li data-id="${v.id}"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy">
        <span>${esc(clean(v.title))}<small>${date(v.published)}${v.views != null ? ` · ${fmt(v.views)} Aufrufe` : ''}</small></span></li>`).join('');
    $('#tvList').addEventListener('click', (e) => {
      const li = e.target.closest('li'); if (!li) return;
      show(videos.find((v) => v.id === li.dataset.id), true);
    });
    show(videos[0], false);
  }
  // Shorts: Handy-Rahmen, vertikal wischen wie in der YouTube-App; Tippen spielt den Short im Rahmen ab
  if (shorts.length) {
    $('#tvShortsWrap').hidden = false;
    const feed = $('#tvShorts');
    feed.innerHTML = shorts.map((v) => `
      <div class="short-card" data-id="${v.id}">
        <!-- maxresdefault = eigenes Thumbnail (hochkant in der Mitte, per object-fit mittig zugeschnitten); oar2 wäre nur ein Videobild -->
        <img src="https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${v.id}/hqdefault.jpg'" alt="" loading="lazy">
        <span class="tv-play small"></span>
        <div class="short-meta"><b>${esc(clean(v.title))}</b><small>${date(v.published)}${v.views != null ? ` · ${fmt(v.views)} Aufrufe` : ''}</small></div>
      </div>`).join('');
    feed.addEventListener('click', (e) => {
      const c = e.target.closest('.short-card'); if (!c || c.querySelector('iframe')) return;
      feed.querySelectorAll('.short-card iframe').forEach((f) => { const card = f.closest('.short-card'); f.remove(); card.classList.remove('playing'); });
      c.insertAdjacentHTML('beforeend', embed(c.dataset.id, ''));
      c.classList.add('playing');
    });
  }
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
    <div class="lex-cell ${b.owners ? '' : 'none'}" title="${esc(cap(b.name))}: ${b.owners}/${n} besitzen ihn, ${b.p11} auf Stufe 11, bester ${fmt(b.maxTrophies)} Trophäen">
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
    .fromTo('.hero-buttons', { scale: 0 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' }, '-=0.2')
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
  ['.stat', '.join-box', '.meta-card', '.brawler', '.member', '.event', '.info', '.panel', '.news-feature', '.news-article', '.lex-new article'].forEach((s) => pop(s));
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
  navActive();
  ScrollTrigger.refresh();
}

// Menü: aktuellen Bereich markieren
function navActive() {
  document.querySelectorAll('main .section[id]').forEach((sec) => {
    const link = document.querySelector(`.nav-links a[href="#${sec.id}"]`);
    if (link) ScrollTrigger.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', toggleClass: { targets: link, className: 'active' } });
  });
}
