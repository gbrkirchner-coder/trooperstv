# Troopers – Brawl Stars Club-Seite

Statische Website (GSAP-Animationen, Brawl-Stars-Look) für den Club **TROOPERS** (#2VRLRP9PU),
gehostet kostenlos auf **GitHub Pages** unter **troopers.tv**.

## So funktioniert's
- `public/` – die Seite (HTML, CSS, JS). Sie liest nur Dateien aus `public/data/`.
- `scripts/build-data.mjs` – holt Club, Mitglieder, Battlelogs, Events, Ranglisten (Brawl Stars API)
  und die neuesten Videos (YouTube-RSS) und schreibt sie nach `public/data/`.
- `.github/workflows/seite.yml` – führt das alle 30 Minuten bei GitHub aus und veröffentlicht die Seite.
  Die Weltranglisten (≈ 430 Abfragen) werden nur alle 6 Stunden neu erzeugt.

Der API-Key liegt als GitHub-Secret `BS_API_KEY` (Key für die RoyaleAPI-Proxy-IP 45.79.218.79).

## Lokal
```bash
cp .env.example .env      # BS_API_KEY, CLUB_TAG, USE_ROYALEAPI_PROXY=true, YT_CHANNEL_ID eintragen
npm run daten             # Daten holen
npm run vorschau          # http://localhost:3000
```

Unofficial fan content, not endorsed by Supercell (Fan Content Policy).
