// Holt alle Daten für die Troopers-Seite und speichert sie als JSON in public/data/.
// Läuft alle 30 Minuten per GitHub Actions (siehe .github/workflows/seite.yml) oder lokal: node scripts/build-data.mjs
// Keine Abhängigkeiten, Node 18+.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data');
loadEnv(path.join(ROOT, '.env'));

const API_KEY = process.env.BS_API_KEY || '';
const CLUB_TAG = process.env.CLUB_TAG || '';
const YT_CHANNEL_ID = process.env.YT_CHANNEL_ID || '';
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');   // live-Seite, um alte Ranglisten wiederzuverwenden
const API_BASE = process.env.USE_ROYALEAPI_PROXY === 'true' ? 'https://bsproxy.royaleapi.dev/v1' : 'https://api.brawlstars.com/v1';
const RANKING_REGIONS = ['global', 'de', 'at', 'ch'];
const RANKING_MAX_AGE_H = Number(process.env.RANKING_MAX_AGE_H || 6);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

async function bs(endpoint, tries = 3) {
  for (let i = 1; ; i++) {
    const res = await fetch(API_BASE + endpoint, { headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' } });
    if (res.ok) return res.json();
    if (i >= tries || ![429, 500, 502, 503].includes(res.status)) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`${endpoint}: ${res.status} ${body.message || body.reason || ''}`);
    }
    await new Promise((r) => setTimeout(r, 1500 * i));
  }
}
const enc = (tag) => encodeURIComponent('#' + String(tag).replace(/^#/, '').toUpperCase());

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch (e) { console.warn('  ⚠', e.message); out[idx] = null; }
    }
  }));
  return out;
}

function findSelf(battle, tag) {
  return [...(battle.teams || []).flat(), ...(battle.players || [])].find((p) => p.tag === tag);
}

// Club + Profile + Battlelogs aller Mitglieder, zu Statistiken verdichtet.
async function clubStats(tag) {
  const club = await bs(`/clubs/${enc(tag)}`);
  const members = club.members || [];
  const [players, logs] = await Promise.all([
    mapLimit(members, 6, (m) => bs(`/players/${enc(m.tag)}`)),
    mapLimit(members, 6, (m) => bs(`/players/${enc(m.tag)}/battlelog`)),
  ]);

  const usage = {};
  const form = {};
  members.forEach((m, i) => {
    const f = { games: 0, wins: 0, trophyDelta: 0, rankedGames: 0, rankedWins: 0, starPlayer: 0 };
    for (const item of logs[i]?.items || []) {
      const b = item.battle || {};
      const me = findSelf(b, m.tag);
      if (!me) continue;
      const won = b.result === 'victory' || (b.rank && b.rank <= (b.mode === 'duoShowdown' ? 2 : 4));
      f.games++;
      if (won) f.wins++;
      f.trophyDelta += b.trophyChange || 0;
      if (b.type === 'soloRanked') { f.rankedGames++; if (won) f.rankedWins++; }
      if (b.starPlayer && b.starPlayer.tag === m.tag) f.starPlayer++;
      for (const br of me.brawlers || [me.brawler]) {
        if (!br) continue;
        const u = usage[br.id] ||= { id: br.id, name: br.name, picks: 0, wins: 0 };
        u.picks++;
        if (won) u.wins++;
      }
    }
    form[m.tag] = f;
  });

  const enriched = members.map((m, i) => {
    const p = players[i];
    const brawlers = p?.brawlers || [];
    const best = brawlers.slice().sort((a, b) => b.trophies - a.trophies)[0] || null;
    return {
      ...m,
      expLevel: p?.expLevel ?? null,
      highestTrophies: p?.highestTrophies ?? null,
      soloVictories: p?.soloVictories ?? null,
      duoVictories: p?.duoVictories ?? null,
      trioVictories: p?.['3vs3Victories'] ?? null,
      brawlerCount: brawlers.length,
      bestBrawler: best && { id: best.id, name: best.name, trophies: best.trophies, rank: best.rank, power: best.power },
      brawlers: brawlers.map((b) => ({ id: b.id, name: b.name, trophies: b.trophies, highestTrophies: b.highestTrophies, rank: b.rank, power: b.power })),
      form: form[m.tag],
    };
  });

  const topBrawlers = {};
  for (const m of enriched) for (const b of m.brawlers) {
    const cur = topBrawlers[b.id];
    if (!cur || b.trophies > cur.trophies) topBrawlers[b.id] = { ...b, owner: m.name, ownerTag: m.tag };
  }

  // Brawler-Sammlung des Clubs: wie viele Mitglieder besitzen welchen Brawler, auf welcher Stufe
  const coll = {};
  for (const m of enriched) for (const b of m.brawlers) {
    const c = coll[b.id] ||= { id: b.id, name: b.name, owners: 0, p11: 0, maxTrophies: 0, sumTrophies: 0 };
    c.owners++; if (b.power >= 11) c.p11++; c.maxTrophies = Math.max(c.maxTrophies, b.trophies); c.sumTrophies += b.trophies;
  }
  const brawlerStats = Object.values(coll).map(({ sumTrophies, ...c }) => ({ ...c, avgTrophies: Math.round(sumTrophies / c.owners) }))
    .sort((a, b) => b.owners - a.owners || b.maxTrophies - a.maxTrophies);
  const totals = {
    trio: enriched.reduce((s, m) => s + (m.trioVictories || 0), 0),
    solo: enriched.reduce((s, m) => s + (m.soloVictories || 0), 0),
    duo: enriched.reduce((s, m) => s + (m.duoVictories || 0), 0),
    highest: enriched.reduce((s, m) => Math.max(s, m.highestTrophies || 0), 0),
    brawlers: enriched.reduce((s, m) => s + (m.brawlerCount || 0), 0),
  };

  return {
    club: { ...club, members: undefined },
    brawlerStats, totals,
    members: enriched.map(({ brawlers, ...rest }) => rest),
    usage: Object.values(usage).sort((a, b) => b.picks - a.picks),
    topBrawlers: Object.values(topBrawlers).sort((a, b) => b.trophies - a.trophies).slice(0, 30),
    updatedAt: new Date().toISOString(),
  };
}

// YouTube-Kanal: 1) YouTube Data API (Key YT_API_KEY), 2) öffentlicher RSS-Feed, 3) letzter Stand der Live-Seite
const YT_API_KEY = process.env.YT_API_KEY || '';
const isoSeconds = (iso) => { const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };

async function youtubeApi() {
  const api = (p) => fetch(`https://www.googleapis.com/youtube/v3/${p}&key=${YT_API_KEY}`).then(async (r) => {
    const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status); return j;
  });
  const uploads = 'UU' + YT_CHANNEL_ID.slice(2);
  const [ch, pl] = await Promise.all([
    api(`channels?part=snippet&id=${YT_CHANNEL_ID}`),
    api(`playlistItems?part=contentDetails&maxResults=20&playlistId=${uploads}`),
  ]);
  const ids = pl.items.map((i) => i.contentDetails.videoId).join(',');
  const vs = ids ? await api(`videos?part=snippet,statistics,contentDetails&id=${ids}`) : { items: [] };
  const videos = vs.items.map((v) => ({
    id: v.id, title: v.snippet.title, published: v.snippet.publishedAt,
    // Shorts: bis 45 s oder #shorts im Titel (lange Videos sind bei uns immer länger)
    short: isoSeconds(v.contentDetails.duration) <= 45 || /#shorts/i.test(v.snippet.title),
    views: +v.statistics.viewCount || 0,
  })).sort((a, b) => b.published.localeCompare(a.published));
  return { channelId: YT_CHANNEL_ID, channelTitle: ch.items?.[0]?.snippet?.title || 'TroopersTV', videos, updatedAt: new Date().toISOString(), quelle: 'api' };
}

async function youtubeRss() {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`);
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();
  const tag = (s, t) => (s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || '';
  const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const videos = (xml.match(/<entry>[\s\S]*?<\/entry>/g) || []).map((e) => {
    const link = (e.match(/<link rel="alternate" href="([^"]+)"/) || [])[1] || '';
    const views = (e.match(/<media:statistics views="(\d+)"/) || [])[1];
    return { id: tag(e, 'yt:videoId'), title: decode(tag(e, 'title')), published: tag(e, 'published'), short: link.includes('/shorts/'), views: views ? Number(views) : null };
  });
  return { channelId: YT_CHANNEL_ID, channelTitle: decode(tag(xml, 'title')), videos, updatedAt: new Date().toISOString(), quelle: 'rss' };
}

async function youtubeFeed() {
  const errors = [];
  console.log(`  YouTube: API-Key ${YT_API_KEY ? 'vorhanden (' + YT_API_KEY.slice(0, 6) + '…)' : 'FEHLT – Secret YT_API_KEY prüfen'}`);
  if (YT_API_KEY) { try { return await youtubeApi(); } catch (e) { errors.push('API: ' + e.message); } }
  try { return await youtubeRss(); } catch (e) { errors.push(e.message); }
  // Letzter guter Stand (lokal oder von der Live-Seite), damit der Bereich nicht leer wird
  const local = path.join(OUT, 'youtube.json');
  const prev = fs.existsSync(local) ? JSON.parse(fs.readFileSync(local, 'utf8'))
    : SITE_URL ? await fetch(`${SITE_URL}/data/youtube.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
  if (prev?.videos?.length) { console.warn('  ⚠ YouTube nicht erreichbar (' + errors.join('; ') + ') – letzter Stand wird verwendet'); meldungen.push('youtube.json: ' + errors.join('; ').slice(0, 300)); return prev; }
  throw new Error(errors.join('; '));
}

// Weltrangliste je Brawler und Region – teuer (≈ Brawler × Regionen Abfragen), daher nur alle RANKING_MAX_AGE_H Stunden neu.
async function rankings(region, brawlers) {
  const file = path.join(OUT, `rankings-${region}.json`);
  let prev = null;
  if (fs.existsSync(file)) prev = JSON.parse(fs.readFileSync(file, 'utf8'));
  else if (SITE_URL) prev = await fetch(`${SITE_URL}/data/rankings-${region}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const ageH = prev ? (Date.now() - Date.parse(prev.updatedAt)) / 3.6e6 : Infinity;
  if (prev && ageH < RANKING_MAX_AGE_H && brawlers.every((b) => prev.brawlers[b.id])) {
    console.log(`  Rangliste ${region}: aktuell (${ageH.toFixed(1)} h alt)`);
    return prev;
  }
  const lists = await mapLimit(brawlers, 6, (b) => bs(`/rankings/${region}/brawlers/${b.id}?limit=10`));
  const out = { region, updatedAt: new Date().toISOString(), brawlers: {} };
  brawlers.forEach((b, i) => {
    out.brawlers[b.id] = (lists[i]?.items || prev?.brawlers?.[b.id] || []).map((p) => ({
      tag: p.tag, name: p.name, nameColor: p.nameColor, icon: p.icon, trophies: p.trophies, rank: p.rank, club: p.club ? { name: p.club.name } : undefined,
    }));
  });
  console.log(`  Rangliste ${region}: neu erzeugt`);
  return out;
}

// Top-Clubs und Top-Spieler (Deutschland + weltweit), dazu die Platzierung unseres Clubs in Deutschland
async function tops() {
  const slim = (p) => ({ tag: p.tag, name: p.name, nameColor: p.nameColor, icon: p.icon, badgeId: p.badgeId, trophies: p.trophies, rank: p.rank,
    memberCount: p.memberCount, club: p.club ? { name: p.club.name } : undefined });
  const [deClubs, glClubs, dePlayers, glPlayers] = await Promise.all([
    bs('/rankings/de/clubs?limit=200'), bs('/rankings/global/clubs?limit=20'),
    bs('/rankings/de/players?limit=20'), bs('/rankings/global/players?limit=20'),
  ]);
  const own = (deClubs.items || []).find((c) => c.tag === '#' + CLUB_TAG.replace(/^#/, '').toUpperCase());
  return {
    updatedAt: new Date().toISOString(),
    clubRankDE: own ? own.rank : null,
    clubs: { de: (deClubs.items || []).slice(0, 20).map(slim), global: (glClubs.items || []).map(slim) },
    players: { de: (dePlayers.items || []).map(slim), global: (glPlayers.items || []).map(slim) },
  };
}

// Echte News: Artikel der offiziellen Supercell-Seite + neueste Videos des offiziellen Brawl-Stars-Kanals (Brawl Talk = anstehende Updates)
const BS_OFFICIAL_UPLOADS = 'UUooVYzDxdwTtGYAkcPmOgOw';
async function blog(locale) {
  const res = await fetch(`https://supercell.com/${locale}/games/brawlstars/blog/`, { headers: { 'User-Agent': 'Mozilla/5.0 (troopers.tv news)' } });
  if (!res.ok) throw new Error(`Blog ${locale} ${res.status}`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Blog: keine Daten');
  const arts = JSON.parse(m[1])?.props?.pageProps?.articles || [];
  return arts.map((a) => ({
    title: a.title, date: a.publishDate, image: a.thumbnail?.imgUrl || null, category: a.category || 'Brawl Stars',
    url: a.linkUrl?.startsWith('http') ? a.linkUrl : 'https://supercell.com' + a.linkUrl,
  })).filter((a) => a.title && a.url);
}
async function news() {
  const out = { updatedAt: new Date().toISOString(), articles: [], videos: [] };
  const errs = [];
  for (const loc of ['de', 'en']) { try { out.articles = await blog(loc); if (out.articles.length) { out.locale = loc; break; } } catch (e) { errs.push(e.message); } }
  if (!out.articles.length) meldungen.push('news: ' + errs.join('; '));
  if (YT_API_KEY) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=15&playlistId=${BS_OFFICIAL_UPLOADS}&key=${YT_API_KEY}`);
    const j = await r.json();
    if (!r.ok) throw new Error('YouTube offiziell: ' + (j.error?.message || r.status));
    out.videos = (j.items || []).map((i) => ({ id: i.snippet.resourceId?.videoId, title: i.snippet.title, date: i.snippet.publishedAt,
      brawlTalk: /brawl\s*talk/i.test(i.snippet.title) })).filter((v) => v.id);
  }
  if (!out.articles.length && !out.videos.length) throw new Error('keine News gefunden');
  return out;
}

// Brawler-Lexikon (Klasse, Seltenheit, Beschreibung, Gadgets, Star Powers) von BrawlAPI – Platzhalter wie „x%“ werden entfernt
async function brawlerInfo() {
  const r = await fetch('https://api.brawlapi.com/v1/brawlers', { headers: { 'User-Agent': 'TroopersTV (troopers.tv)' } });
  if (!r.ok) throw new Error('BrawlAPI ' + r.status);
  const j = await r.json();
  const clean = (t) => String(t || '').replace(/<[^>]*>/g, 'X').replace(/\s*by\s+X?x?\s*%/gi, '')
    .replace(/Every\s+(x|X)\s+seconds?/gi, 'Periodically').replace(/\b(restore|restores|heals?)\s+(x|X)\s+health/gi, '$1 health')
    .replace(/Deals\s+(x|X)\s+damage/gi, 'Deals damage').replace(/\s(x|X)(\s|%)/g, ' ').replace(/\s+([.,])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  const out = {};
  for (const b of j.list || []) {
    if (!b.released) continue;
    out[b.id] = { name: b.name, cls: b.class?.name || '', rarity: b.rarity?.name || '', color: b.rarity?.color || '#fff', description: clean(b.description),
      gadgets: (b.gadgets || []).map((g) => ({ name: g.name, text: clean(g.description) })),
      starPowers: (b.starPowers || []).map((g) => ({ name: g.name, text: clean(g.description) })) };
  }
  if (!Object.keys(out).length) throw new Error('BrawlAPI leer');
  return { updatedAt: new Date().toISOString(), brawlers: out };
}

function write(name, data) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data));
  console.log(`✔ ${name} (${(fs.statSync(path.join(OUT, name)).size / 1024).toFixed(0)} KB)`);
}

/** Letzten Stand einer Datei von der Live-Seite holen (falls ein Abruf scheitert). */
async function previous(name) {
  if (!SITE_URL) return null;
  return fetch(`${SITE_URL}/data/${name}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
}
/** Teil erzeugen; bei Fehler letzten Stand verwenden und weitermachen. */
async function part(name, fn) {
  try { const d = await fn(); if (d) write(name, d); return d; }
  catch (e) {
    console.warn(`  ⚠ ${name} fehlgeschlagen: ${e.message}`);
    meldungen.push(`${name}: ${String(e.message).replace(/key=[^&\s]+/g, 'key=…').slice(0, 300)}`);
    const prev = await previous(name);
    if (prev) { write(name, prev); console.warn(`    → letzter Stand von ${SITE_URL} übernommen`); return prev; }
    fehler.push(name); return null;
  }
}
const fehler = [], meldungen = [];

async function main() {
  if (!API_KEY || !CLUB_TAG) throw new Error('BS_API_KEY und CLUB_TAG müssen gesetzt sein');
  fs.mkdirSync(OUT, { recursive: true });
  const started = Date.now();
  await part('club.json', () => clubStats(CLUB_TAG));
  const brawlers = await part('brawlers.json', async () => ({ items: (await bs('/brawlers')).items.map((b) => ({
    id: b.id, name: b.name, gadgets: (b.gadgets || []).map((g) => g.name), starPowers: (b.starPowers || []).map((g) => g.name) })) }));
  await part('tops.json', () => tops());
  await part('news.json', () => news());
  await part('brawlerinfo.json', () => brawlerInfo());
  await part('events.json', () => bs('/events/rotation'));
  if (YT_CHANNEL_ID) await part('youtube.json', () => youtubeFeed());
  if (brawlers) for (const region of RANKING_REGIONS) await part(`rankings-${region}.json`, () => rankings(region, brawlers.items));
  write('stand.json', { updatedAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), fehler, meldungen, youtubeKey: Boolean(YT_API_KEY) });
  // Nur abbrechen, wenn die Club-Daten komplett fehlen (dann wäre die Seite leer)
  if (fehler.includes('club.json')) throw new Error('Club-Daten fehlen: ' + fehler.join(', '));
  if (fehler.length) console.warn('⚠ Ohne Daten: ' + fehler.join(', '));
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
