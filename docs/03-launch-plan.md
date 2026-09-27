# HUE & CLAIM — Release- & Marketing-Plan

Ziel: **≥ 30.000 Wishlists vor Launch** (Top-Quartil für 10-€-Indies), 50k+ Kopien im ersten Quartal.
Kernbotschaft in *jedem* Asset: **„Ein Strich. Achtzig Monster.“** — der Horde-Fang als 3-Sekunden-Clip.

## Zeitplan (T = Launch)

| Wann | Meilenstein | Konkrete Schritte |
|---|---|---|
| **T−9 Monate** | Steam-Seite live („Coming Soon“) | App anlegen (100 $), Capsules aus `steam/assets/`, Texte aus `steam/store-page-*.md`, 8 Screenshots, Teaser-GIF. Tags setzen (Roguelite, Bullet Heaven, Arcade, Casual …). |
| T−9 bis T−6 | GIF-Offensive | 3 Clips/Woche: r/roguelites, r/incremental_games, r/IndieGaming, r/gamedev (Screenshot Saturday), X/Bluesky, TikTok/Shorts. Formel: *Hook in Frame 1* (Schleife schließt sich über Horde). |
| T−6 | Öffentliche Demo | `npm run build:demo` → separate Demo-App; Web-Demo auf itch.io (`npm run build:single`). Feedback-Link im Titelmenü. |
| T−5 | Creator-Seeding | 150 Keys an Roguelite-/Cozy-/Bullet-Heaven-YouTuber (Wanderbots, Retromation, Olexa, Splattercat, Aliensrock, NorthernLion-Umfeld), deutschsprachig: Gronkh-/PietSmiet-Umfeld, Maxim, Dhalucard. Keymailer + persönliche Mails. |
| **T−4** | **Steam Next Fest** | Demo + Livestream (Dev spielt Firnis 5). Capsule 3 Wochen vorher einfrieren; Presse 4–6 Wochen vorher anschreiben. |
| T−3 | Festival-Runde | Wholesome Direct / Day of the Devs / LudoNarraCon-ähnliche Showcases (Einreichung 2–3 Monate vorher), Roguelike Celebration. |
| T−2 | Chinesische Lokalisierung fertig | zh-Hans Store-Seite + Bilibili-Clips (22–55 % der Steam-Nutzer!). |
| T−1 | Presse-Embargo-Keys | Press-Kit (`docs/05-presskit.md`), Review-Keys an PC Gamer, Rock Paper Shotgun, GameStar, PC Games, Eurogamer.de, Nintendo-Life-ähnliche Portale für spätere Ports. |
| **T** | **Launch** | −15 % Launch-Rabatt, Launch-Trailer, Daily-Canvas-Event „Erste Woche“, Discord-Community-Challenge (größte Schleife). |
| T+2 Wochen | Update 1.1 | Balancing aus Telemetrie/Reviews, QoL. |
| T+3 Monate | Content-Update „Frostsee“ | neues Biom + Figur (kostenlos) → Steam-Sichtbarkeitspuls. |
| T+6 Monate | **„Duett“-Koop-Update** | Remote Play Together / Online-Koop → Friendslop-Welle mitnehmen. |
| T+9 Monate | Konsolen-Ports | Switch 2 / Xbox (Publisher-Partner). |

## Kanäle & Taktiken

1. **Steam-Algorithmus:** Wishlists, Follower und Klickrate der Capsule sind das Spiel. Capsule-A/B-Test (2 Varianten) auf r/IndieDev vor Next Fest.
2. **GIF-first:** Jeder Clip 3–8 s, Loop-fähig, ohne UI-Text-Wände. Top-Motive: (a) Horde-Fang, (b) Boss-Lasso, (c) Funke rast — knapp geschafft, (d) Karte flutet nach Boss-Sieg.
3. **Streamer-Tauglichkeit:** Tägliche Leinwand = gemeinsamer Seed → Community-Wettbewerbe; „Größte Schleife“-Challenges; Achievement *Massenausstellung* (150 in einer Schleife) als Clip-Magnet.
4. **Demo-Design:** Die spannendsten 3 Sekunden an den Anfang (Tutorial führt in < 20 s zur ersten Schleife), endet nach dem ersten Boss mit Wishlist-CTA (bereits implementiert: `DEMO_CTA`).
5. **Preis-Psychologie:** 9,99 € = Impulskauf; Ball x Pit ($14.99) und Nodebuster zeigen, dass kleine, dichte Spiele in dieser Zone viral gehen.

## KPIs

| Phase | KPI | Ziel |
|---|---|---|
| Coming Soon | Capsule-CTR (Impressions → Visits) | ≥ 4 % |
| Coming Soon | Visit → Wishlist | ≥ 15 % |
| Next Fest | Demo-Spieler / Median-Spielzeit | 15k / ≥ 25 min |
| Launch-Woche | Wishlist-Conversion | ≥ 12 % |
| Launch-Monat | Review-Score | ≥ 90 % positiv („Äußerst positiv“) |

## Budget (Indie-Minimal)

| Posten | Kosten |
|---|---|
| Steam Direct | 100 $ |
| Professionelle Capsule-Überarbeitung (Artist, optional auf Basis der generierten Assets) | 800–1.500 € |
| Trailer-Schnitt | 500–1.000 € |
| Lokalisierung zh-Hans (≈ 3.500 Wörter) | 400–700 € |
| Keymailer / PR-Tools | 0–300 € |
| **Summe** | **≈ 2.000–3.600 €** |

## Checkliste vor Veröffentlichung

- [ ] Steamworks-App-ID in `steam_appid.txt` und `electron/main.cjs` (ENV `HUE_STEAM_APPID`) eintragen
- [ ] Erfolge aus `steam/achievements/achievements.json` + Icons hochladen
- [ ] Steam Auto-Cloud: Pfad `%APPDATA%/HUE & CLAIM/save.json` (Win) bzw. `~/.config/HUE & CLAIM/save.json` (Linux)
- [ ] Depots bauen: `npm run dist:win` / `npm run dist:linux`, dann `steamcmd +run_app_build steam/steamworks/app_build.vdf`
- [ ] Steam-Deck-Verifizierung: 1280×800, Controller-Glyphen, Text ≥ 9 px, kein Launcher
- [ ] KI-Offenlegung im Steamworks-Fragebogen (Text in `steam/store-page-en.md`)
- [ ] Altersfreigabe-Fragebogen (IARC)
- [ ] Datenschutz: keine Telemetrie ohne Opt-in
