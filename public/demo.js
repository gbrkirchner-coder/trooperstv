// Beispieldaten im Format von /api/club – werden nur angezeigt, wenn der Server
// keine Live-Daten liefern kann (kein API-Key, falscher Tag, offline).
window.TroopersDemo = (() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));

  const BRAWLERS = [
    [16000000, 'SHELLY'], [16000001, 'COLT'], [16000002, 'BULL'], [16000003, 'BROCK'], [16000004, 'RICO'],
    [16000005, 'SPIKE'], [16000006, 'BARLEY'], [16000007, 'JESSIE'], [16000008, 'NITA'], [16000010, 'EL PRIMO'],
    [16000011, 'MORTIS'], [16000012, 'CROW'], [16000013, 'POCO'], [16000015, 'PIPER'], [16000017, 'TARA'],
    [16000021, 'GENE'], [16000023, 'LEON'], [16000029, 'BEA'], [16000032, 'MAX'], [16000035, 'GALE'],
    [16000043, 'EDGAR'], [16000046, 'BELLE'], [16000049, 'BUZZ'], [16000052, 'MEG'], [16000054, 'FANG'],
  ];
  const NAMES = ['TrooperKing', 'Blitz⚡', 'LeonMain', 'xXSnipeXx', 'Mortis4Life', 'Käptn Kaboom', 'NitaBär', 'Sturmtruppe',
    'Pixelpanzer', 'Crowley', 'Frosti', 'GemGrabber', 'Brocky', 'HeistHero', 'Knockout', 'SpikeySpike', 'Duo_Dani',
    'Shelly Queen', 'ElPrimoTaco', 'Bounty Jäger', 'Rookie', 'Ninja Nico', 'Pam Pam', 'Belle-Ami', 'Fang Fan', 'Zocker Zoe',
    'MaxSpeed', 'Gale Force'];
  const COLORS = ['0xffffffff', '0xff1ba5f5', '0xfff9c908', '0xffcb5aff', '0xff4ddba2', '0xffff8afb', '0xfff05637'];
  const ROLES = ['president', 'vicePresident', 'vicePresident', 'senior', 'senior', 'senior', 'senior'];

  const members = NAMES.map((name, i) => {
    const trophies = Math.round(52000 - i * 1450 + int(-600, 600));
    const games = 25, wins = int(9, 19), rankedGames = int(0, 12);
    const best = BRAWLERS[int(0, BRAWLERS.length - 1)];
    return {
      tag: '#DEMO' + (100 + i), name, nameColor: COLORS[i % COLORS.length], role: ROLES[i] || 'member',
      trophies, icon: { id: 28000000 + int(0, 60) },
      expLevel: int(120, 330), highestTrophies: trophies + int(200, 4000),
      trioVictories: int(4000, 22000), soloVictories: int(300, 3500), duoVictories: int(300, 3000),
      brawlerCount: int(70, 92),
      bestBrawler: { id: best[0], name: best[1], trophies: int(1000, 2000), rank: 51, power: 11 },
      form: { games, wins, trophyDelta: int(-40, 160), rankedGames, rankedWins: Math.min(rankedGames, int(0, 9)), starPlayer: int(0, 8) },
    };
  }).sort((a, b) => b.trophies - a.trophies);

  const usage = BRAWLERS.map(([id, name]) => {
    const picks = int(4, 70);
    return { id, name, picks, wins: Math.round(picks * (0.4 + rnd() * 0.3)) };
  }).sort((a, b) => b.picks - a.picks);

  const topBrawlers = BRAWLERS.map(([id, name]) => {
    const m = members[int(0, members.length - 1)];
    const trophies = int(1100, 2000);
    return { id, name, trophies, highestTrophies: trophies + int(0, 150), rank: 51, power: 11, owner: m.name, ownerTag: m.tag };
  }).sort((a, b) => b.trophies - a.trophies);

  return {
    club: {
      tag: '#DEMO', name: 'Troopers', type: 'open', badgeId: 8000010, requiredTrophies: 30000,
      description: 'Willkommen bei den Troopers! 🪖 Aktiv spielen, Club-Liga mitmachen, gemeinsam pushen.',
      trophies: members.reduce((s, m) => s + m.trophies, 0),
    },
    members, usage, topBrawlers, updatedAt: new Date().toISOString(), demo: true,
    brawlers: BRAWLERS.map(([id, name]) => ({ id, name })),
    ranking(id) {
      seed = id % 997 + 3;
      const pool = ['Tensai', 'Hyra', 'Moya', 'Sitetampo', 'Symantec', 'Lukii', 'BosS', 'Nuvola', 'Angelboy', 'Tom'];
      return { items: pool.map((name, i) => ({ tag: '#X' + i, name, rank: i + 1, trophies: 2400 - i * int(8, 30), club: { name: 'Pro Club' }, nameColor: '0xffffffff', icon: { id: 28000000 + int(0, 60) } })) };
    },
    events: [
      { event: { mode: 'gemGrab', map: 'Hard Rock Mine', id: 15000026 }, endTime: '' },
      { event: { mode: 'brawlBall', map: 'Backyard Bowl', id: 15000010 }, endTime: '' },
      { event: { mode: 'heist', map: 'Safe Zone', id: 15000019 }, endTime: '' },
      { event: { mode: 'knockout', map: 'Goldarm Gulch', id: 15000443 }, endTime: '' },
      { event: { mode: 'soloShowdown', map: 'Skull Creek', id: 15000005 }, endTime: '' },
      { event: { mode: 'bounty', map: 'Shooting Star', id: 15000052 }, endTime: '' },
    ],
  };
})();
