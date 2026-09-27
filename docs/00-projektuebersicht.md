# HUE & CLAIM — Projektübersicht

**Was ist das?** Ein komplettes, spielbares Steam-Spiel: ein Territorium-Roguelite („Paper.io/Qix × Vampire Survivors × Meta-Grind“). Du ziehst Farbspuren durch eine entfärbte Welt, schließt Schleifen, färbst Land zurück und fängst ganze Monsterhorden mit einem Strich. Berührt ein Gegner deine Spur, rast ein Funke auf dich zu.

## Was fertig ist

| Bereich | Stand |
|---|---|
| **Spiel** | 5 Biome mit eigenen Mechaniken, 5 Bosse, 11 Gegnertypen, 4 spielbare Figuren mit Spezialfähigkeiten, 10 Waffen + 10 Evolutionen, 17 Passive, 22 Relikte, 6 Anomalien, Truhen, Schreine, Nester, Herden-KI mit Aufmerksamkeit |
| **Meta/Grind** | Pigmente + Farbmischung, Atelier (14 Upgrades), Techniken- & Galerie-Freischaltungen, Atlas (25 Sterne), Firnis 0–10, Endlos-Modus, Tägliche Leinwand, 36 Erfolge, Kodex, Statistiken |
| **Technik** | TypeScript/Canvas/WebAudio, prozedurale Grafik & Musik, Speichern (lokal + Steam-Cloud-fähig), Gamepad + Tastatur + Maus + Touch, EN/DE, Barrierefreiheits-Optionen |
| **Steam** | Electron-Hülle mit Steamworks (Erfolge, Overlay), SteamPipe-Build-Skripte, alle Capsules/Library-Grafiken in Pflichtgrößen, 9 Screenshots (+DE), 36 Erfolgs-Icons + Metadaten, Shop-Texte EN/DE, Teaser-Video |
| **Doku** | Marktrecherche, GDD, Launch-Plan, Trailer-Storyboard, Presskit |
| **Qualität** | 12 Unit-Tests, automatischer Bot-Durchlauf durch alle 5 Bosse, Menü-Tour, Balance-Probe, CI-Workflow |

## Sofort ausprobieren

```bash
npm install
npm run dev     # → http://localhost:5173
```

## Nächste Schritte bis zum Steam-Release

1. **Steamworks-Konto** anlegen (steampartner.valvesoftware.com), 100 $ App-Gebühr zahlen → App-ID erhalten.
2. App-ID eintragen: `steam_appid.txt`, `steam/steamworks/app_build.vdf` (+ Depot-IDs).
3. Store-Seite befüllen mit `steam/store-page-en.md` / `-de.md`, Grafiken aus `steam/assets/`, Screenshots aus `steam/screenshots/`.
4. Erfolge anlegen (`steam/achievements/achievements.json` + Icons aus `steam/achievements/icons/`).
5. Build: `npm install` (lädt Electron), `npm run dist:win` und `npm run dist:linux`, Upload mit `steamcmd` (siehe README).
6. Steam-Cloud (Auto-Cloud) auf `save.json` im Benutzerdatenordner konfigurieren.
7. Demo-App anlegen (`npm run build:demo`) für Steam Next Fest.
8. **Menschliches Playtesting:** Die Balance wurde mit einem Autopilot-Bot geprüft; vor dem Launch unbedingt echte Spieler testen lassen (Discord/Reddit-Playtest).
9. Empfehlung: professionelle Überarbeitung der Capsule-Art und ein mit OBS in 60 fps geschnittener Trailer (Storyboard liegt bei).
10. Chinesische Lokalisierung ergänzen (größte Sprachgruppe auf Steam).

## Links (Claude-Artifacts, privat bis zum Teilen)
- Spielbare Web-Version: https://claude.ai/artifact/Vm5pkVZFKtQtTStzWnPzNN
- Store-Page-Vorschau: https://claude.ai/artifact/5YUk1CXC8nRhRWgFXSgu6m
