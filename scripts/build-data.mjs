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

  return {
    club: { ...club, members: undefined },
    members: enriched.map(({ brawlers, ...rest }) => rest),
    usage: Object.values(usage).sort((a, b) => b.picks - a.picks),
    topBrawlers: Object.values(topBrawlers).sort((a, b) => b.trophies - a.trophies).slice(0, 30),
    updatedAt: new Date().toISOString(),
  };
}

// YouTube-Kanal über den öffentlichen RSS-Feed (kein API-Key nötig)
async function youtubeFeed() {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`);
  if (!res.ok) throw new Error(`YouTube ${res.status}`);
  const xml = await res.text();
  const tag = (s, t) => (s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || '';
  const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const videos = (xml.match(/<entry>[\s\S]*?<\/entry>/g) || []).map((e) => {
    const link = (e.match(/<link rel="alternate" href="([^"]+)"/) || [])[1] || '';
    const views = (e.match(/<media:statistics views="(\d+)"/) || [])[1];
    return { id: tag(e, 'yt:videoId'), title: decode(tag(e, 'title')), published: tag(e, 'published'), short: link.includes('/shorts/'), views: views ? Number(views) : null };
  });
  return { channelId: YT_CHANNEL_ID, channelTitle: decode(tag(xml, 'title')), videos, updatedAt: new Date().toISOString() };
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

function write(name, data) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data));
  console.log(`✔ ${name} (${(fs.statSync(path.join(OUT, name)).size / 1024).toFixed(0)} KB)`);
}

async function main() {
  if (!API_KEY || !CLUB_TAG) throw new Error('BS_API_KEY und CLUB_TAG müssen gesetzt sein');
  fs.mkdirSync(OUT, { recursive: true });
  const started = Date.now();

  const [club, brawlers, events, yt] = await Promise.all([
    clubStats(CLUB_TAG),
    bs('/brawlers'),
    bs('/events/rotation'),
    YT_CHANNEL_ID ? youtubeFeed().catch((e) => (console.warn('  ⚠ YouTube:', e.message), null)) : null,
  ]);
  write('club.json', club);
  write('brawlers.json', { items: brawlers.items.map((b) => ({ id: b.id, name: b.name })) });
  write('events.json', events);
  if (yt) write('youtube.json', yt);

  for (const region of RANKING_REGIONS) write(`rankings-${region}.json`, await rankings(region, brawlers.items));

  write('stand.json', { updatedAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000) });
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
