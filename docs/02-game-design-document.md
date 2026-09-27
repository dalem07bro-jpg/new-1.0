# HUE & CLAIM — Game Design Document

**Genre:** Territorium-Roguelite („Bullet Heaven × Qix/Paper.io“) · **Plattform:** Steam (Win/Linux/Steam Deck), Web-Demo
**Spielzeit:** Runs 20–30 min · 30–60 h bis 100 % · **Preis:** 9,99 € · **Sprachen:** EN, DE (zh-Hans geplant)

> **Elevator Pitch:** Die Welt Chromara wurde vom Grau entfärbt. Du bist Pip, die letzte Malerin. Verlasse dein Land, zieh eine Farbspur durchs Grau und kehre zurück: Alles, was du umschlossen hast, erblüht in Farbe — und jedes Monster darin wird *gefangen*. Aber berührt ein Gegner deine Spur, rast ein Funke auf dich zu. Schaffst du es nach Hause, bevor er dich erreicht?

---

## 1. Design-Säulen

1. **Jeder Strich ist eine Wette.** Größere Schleifen = mehr Land, mehr Fänge, mehr Beute — aber länger verwundbar. Das Risiko entscheidet der Spieler in jeder Sekunde selbst.
2. **Fortschritt, den man sieht.** Das Grau wird bunt, je besser du spielst. Farbe *ist* das Score-Display, der Screenshot erklärt das Spiel.
3. **Grind, der Optionen freischaltet.** Meta-Progression bringt neue Figuren, Techniken, Relikte, Herausforderungen und Schwierigkeitsstufen — Stat-Upgrades sind gedeckelt und günstig.
4. **Lesbares Chaos.** Hunderte Gegner, aber klare Silhouetten, Farbcodes, Telegrafie (Funken-Vignette, Heim-Pfeil, „?“/„!“-Anzeigen).

## 2. Spielschleifen

| Ebene | Dauer | Inhalt |
|---|---|---|
| **Moment** | 3–10 s | Raus ins Grau → Schleife ziehen → heim → Land flutet in Farbe, Gegner platzen |
| **Etappe** | 3–6 min | Biom-Ziel (55–62 % Land) erreichen → Boss erscheint → Boss einkreisen/besiegen → ganze Karte flutet |
| **Run** | 20–30 min | 5 Biome (Wiesen → 3 zufällige Mittelbiome → Die Leere), Level-ups, Truhen, Relikte, Evolutionen |
| **Meta** | Wochen | Pigmente → Atelier, Farbmischung, Charaktere, Atlas-Sterne, Firnis 1–10, Endlos, Tägliche Leinwand |

## 3. Steuerung

| Aktion | Tastatur/Maus | Gamepad |
|---|---|---|
| Bewegen | WASD / Pfeile / linke Maustaste halten | Linker Stick / D-Pad |
| Sprint (unverwundbar) | Leertaste / Shift | A / RB / RT |
| Spezialfähigkeit | E / Q / Rechtsklick | X / Y / LB / LT |
| Pause | Esc / P | Start / Back |
| Level-up: Neu würfeln / Verbannen / Karte 1–4 | R / B / 1–4 | Y / X / D-Pad + A |

Vollständige Gamepad-Navigation in allen Menüs (Steam-Deck-tauglich).

## 4. Kernmechaniken

### 4.1 Territorium & Spur
- Die Karte ist ein Raster (10 Welteinheiten/Feld, 150×100 bis 170×112 Felder).
- Außerhalb deines Landes hinterlässt du eine **Spur** (8-verbundene Rasterlinie, damit keine Diagonal-Lücken entstehen).
- Betrittst du wieder eigenes Land, wird die Spur zu Land und jede **4-verbundene Region**, die an die Spur grenzt und **nicht den Kartenrand berührt**, wird beansprucht (Flood-Fill). Felsen gelten als Wände — in den Kreide-Ruinen nimmt man ganze Räume, indem man nur kurz in die Tür eintaucht.
- Die Spur darf sich selbst kreuzen: ein „Lasso“ im offenen Grau zählt, sobald du damit nach Hause kommst.

### 4.2 Fangen (Capture)
- Die Farbe breitet sich als **Welle** von der Spur aus (BFS-Distanz → Zeit). Eingeschlossene Gegner erstarren, zittern und **platzen**, wenn die Welle sie erreicht (Pentatonik-Pops, steigende Tonhöhe im Combo).
- Gefangene Gegner geben **1,5× EP** (+Meisterstreich), höhere Pigment-Chance, **Spalter teilen sich nicht**, **Phantome** sind *nur* so zu besiegen.
- Elite-Gegner verlieren 55 % LP und brechen aus dem Land aus; **Bosse** erleiden Schaden proportional zur *Enge* der Schleife: `30 % · √(110 / Schleifengröße)`, 6–30 % max. LP — enge Schleifen lohnen sich. Danach reißen sie das Land um sich herum wieder auf.

### 4.3 Funken & Riss (Qix-Zündschnur)
- Berührt ein Gegner, ein Tintengeschoss, eine Lavaspalte oder ein Blitz die Spur, entzündet sich ein **Funke**, der die Spur entlang **auf dich zu** rast (19,5 Felder/s, schneller als du!).
- Erreichst du dein Land zuerst: Schleife gilt. Holt er dich ein: **Riss** — Spur weg, 20 % max. LP Schaden.
- Gegenmittel: Nasser Firnis/Spiegel/Dornenspur (ignorieren die ersten N Funken pro Schleife), Schnelltrocknend/Sanduhr (langsamere Funken), Pips *Kühner Strich*, Monas *Heimblitz*.
- UI: rote Puls-Vignette, Warntext, brennendes Spursegment, Heim-Pfeil blinkt.

### 4.4 Herden & Aufmerksamkeit
- Kleckslinge, Tropfer und Spalter spawnen teilweise als **grasende Herden**. Bist du nah, steigt ihre Aufmerksamkeit (**„?“**); nach ~1,6 s greifen sie an (**„!“**). Mit Spur bemerken sie dich früher.
- → Taktik: Herden schnell umkreisen, bevor sie reagieren — oder sie absichtlich in eine Falle locken.
- Jäger (steigender Anteil über Zeit), Fluten („Graue Flut“ als Ring alle 55 s), Nester und Wächter sorgen für Druck.

### 4.5 Bemaltes Land
- Gegner auf deinem Land sind um 15 % verlangsamt. Pickups auf deinem Land fliegen dir aus doppelter Reichweite zu.
- Upgrades machen dein Land gefährlich: Heiliger Boden, Frische Farbe, Kräftige Kontur, Brunos Putzwand, Fresko-Golems (leben nur auf deinem Land), Wächter-Staffeleien.

## 5. Biome & Etappen

| # | Biom | Einzigartige Mechanik | Gegner-Pool | Boss |
|---|---|---|---|---|
| 1 | **Graufeld-Wiesen** | Offene Felder, Tutorial-Hinweise | Klecksling, Tropfer, Schnipsler, Spalter | **Schmierkönig** — ruft Hofstaat, springt & reißt Land auf |
| 2–4 | **Tintenwasser-Moor** | Moor bremst (unbemalt) — übermalen hebt es auf | + Spucker, Egel (saugen Land aus) | **Moormutter** — taucht ab (unverwundbar), taucht mit Egeln auf |
| 2–4 | **Kreide-Ruinen** | Räume mit Türen: Felsen = Wände | + Rammer, Wächter (fangen = Truhe) | **Der Radierer** — rast in Linien und radiert Land aus |
| 2–4 | **Glut-Schlucht** | Lavaspalten brechen aus, zünden Spuren, verletzen alle; bemalte Spalten kühlen ab | Glutirrlicht, Rammer, Spalter | **Glutwurm** — 20-teiliger Leib entzündet Spuren; nur der Kopf zählt |
| 5 | **Die Leere** | Land verblasst an den Rändern; Phantome nur fangbar | Phantom + Mix | **Das Leere** — 3 Phasen: Phantome, Radialschüsse, Ring-Radierung |

- Mittelbiome werden pro Run gemischt (Seed). Endlos-Modus mischt jeden Zyklus neu, +160 % LP/Zyklus.
- **Anomalien** (ab Etappe 2, 60 %; Endlos 85 %): Schwarm, Goldene Stunde, Vergrabener Schatz, Tintensturm, Blütezeit, Riesen — jede ändert Risiko/Belohnung der Etappe.
- **Kartenobjekte** (im Grau, per Schleife einsammeln): Pigmentschätze (Ocker), Truhen (Upgrade-Wahl, mind. selten), Schreine (45-s-Segen: Raserei/Eile/Weisheit/Ägide), Heilblumen, Leerennester (Spawner → Truhe).

## 6. Gegner

| Gegner | Verhalten | Konter |
|---|---|---|
| Klecksling | Herde/Jäger, Masse | Schleifen, Flächenschaden |
| Tropfer | langsam, zäh | fangen statt prügeln |
| Schnipsler | ignoriert dich, jagt deine Spur | kurze Schleifen, Dornenspur, Firnis |
| Spucker | hält Abstand, Tinte zündet Spuren | Geschosse ausweichen, Spur kurz halten |
| Egel | saugt dein Land aus | durch die Lücke laufen = zurückerobern & fangen |
| Rammer | lädt auf (Telegraf-Linie), rammt | seitlich ausweichen, sprinten |
| Wächter | stationäres Geschütz | fangen → Truhe |
| Spalter | teilt sich beim Tod | **fangen** (teilt sich dann nicht) |
| Glutirrlicht | schnell, zickzack | Kugeln, Swipe |
| Phantom | immun gegen Schaden | **nur fangen** |
| Leerennest | spawnt Kleckslinge | fangen/zerstören → Truhe, Erfolg „alle Nester“ |

Elite-Varianten (Krone, Glow): 3,2× LP, 1,4× Schaden, 45 % Truhen-Chance, widerstehen dem ersten Fang.

## 7. Build-System

### 7.1 Waffen (max. 5, je Stufe 1–5 → Evolution)
| Waffe | Beschreibung | Evolution (+ Passiv) |
|---|---|---|
| Pinselhieb | Radial-Splash | Meisterstrich-Zyklon (+Leuchtkraft) |
| Farbgeschoss | zielsuchend | Prismen-Salve (+Prisma) |
| Chroma-Kugeln | Orbit | Farbkreis (+Tempo) |
| Dornenspur | Spur verletzt, ignoriert Funken | Dornenwall (+Firnis) |
| Landnahme-Welle | Explosionen entlang geschlossener Schleifen | Farbflut (+Kleckser) |
| Tintenminen* | Minen entlang der Spur | Minenfeld (+Schnelltrocknend) |
| Wächter-Staffelei* | Geschütze auf deinem Land | Große Galerie (+Herdwärme) |
| Prismenstrahl* | durchdringender Strahl | Spektrallanze (+Palettenmesser) |
| Fresko-Golems* | Verbündete, skalieren mit Landanteil | Lebendes Wandbild (+Meisterstreich) |
| Pigmentregen* | verzögerte Einschläge | Monsun (+Goldrahmen) |

\* im Atelier mit Sekundärpigmenten freischaltbar.

### 7.2 Passive (max. 6, je bis Stufe 3–5)
Flinke Borsten, Dicke Schicht, Firnis, Schnelltrocknend, Langer Stiel, Muse, Leuchtkraft, Tempo, Prisma, Herdwärme, Heiliger Boden, Palettenmesser, Kleckser, Goldrahmen, Meisterstreich, Nachbild, Nasser Firnis (17).

### 7.3 Seltenheit
Gewöhnlich / Selten / Episch / Legendär (1× / 1,4× / 1,8× / 2,5× Passivwert; Waffen ab Episch +2 Stufen). Glück (Atelier, Goldrahmen, Glücksmünze) verschiebt die Verteilung. Truhen garantieren „Selten+“. Neu würfeln & Verbannen als knappe Ressourcen.

### 7.4 Relikte (22, nach jedem Boss 1 aus 3)
Regelbrecher statt Zahlen: z. B. *Magnum Opus* (Schleifen ≥4 % zählen doppelt), *Stillleben* (Schleife friert Gegner ein), *Zwillingsleinwand* (jeder Fang feuert ein Geschoss), *Pigmentbombe* (jede 6. Schleife = Bildschirm-Explosion), *Frische Farbe*, *Kräftige Kontur*, *Glutfeder* (Riss → Feuernova) … 10 zu Beginn verfügbar, 12 in der Atelier-Galerie freischaltbar.

## 8. Meta-Progression (der Grind)

### 8.1 Pigmente & Farbenlehre
- **Karmin** (Gegner), **Azur** (bemaltes Land), **Ocker** (Schätze, Bosse) — werden auch bei Niederlage voll gutgeschrieben.
- **Mischen:** 5 + 5 Grundfarben → 2 Sekundärfarben (**Violett** = Karmin+Azur, **Grün** = Azur+Ocker, **Bernstein** = Karmin+Ocker). Sekundärfarben bezahlen Freischaltungen und Top-Upgrades → echte Entscheidungen, welche Farbe man farmt.

### 8.2 Atelier
- **Studio** (14 Upgrades, gedeckelt): Vitalität, Borstentempo, Leuchtkraft, Langsame Lunte, Inspiration, Fortuna, Grundierung, Reichweite, Zweite Gedanken (Reroll), Leere Leinwand (Banish), Glück, Versiegelung, Vorsprung, Zweiter Anstrich (Revive).
- **Techniken:** 5 Waffen freischalten. **Galerie:** 12 Relikte freischalten.

### 8.3 Charaktere (4)
| Figur | Stil | Spezial | Freischaltung |
|---|---|---|---|
| **Pip** | ausgewogen | Kühner Strich: 3 s Tempo + Spur unzündbar | Start |
| **Vera** | Glaskanone, Dornenspur | Hexenkreis: sofortiger Kreis-Claim inkl. Fang | 300 Fänge gesamt |
| **Bruno** | Tank, riesige Hiebe | Putzwand: Landrand brennt & bremst | 2 Bosse gesamt |
| **Mona** | Speedrunner, Sprint-CD −30 % | Heimblitz: Teleport heim, schließt Spur mit gerader Linie | 15 % Karte in einer Schleife |

### 8.4 Atlas (25 Sterne)
Pro Biom 5 Herausforderungen: Boss besiegen · auf Firnis 3+ · unter 5:00 · 60 Fänge in einer Schleife · ohne Riss. **Jeder Stern: dauerhaft +2 % Pigment.**

### 8.5 Firnis 0–10 (Schwierigkeitsleiter)
Freischaltung durch Sieg auf der höchsten Stufe. Kumulativ: +25 % Gegner-LP · Funken +15 % · Elite ×2 · +25 % Gegner · −20 % LP · Ziele +5 % · Gegner +12 % Tempo · Bosse +40 % LP · Herzen halb · „Der graue Hunger“. Jede Stufe +15 % Pigment.

### 8.6 Modi
- **Reise** (5 Etappen) · **Unendliche Leinwand** (ab erstem Sieg, Zyklen) · **Tägliche Leinwand** (globaler Seed + Figur + Firnis 2, Tagesrekord).

### 8.7 Erfolge & Kodex
36 Steam-Erfolge (inkl. Skill-Erfolgen wie *Knapp daneben*, *Enge Kiste*, *Massenausstellung ×150*), Bestiarium, Arsenal (Evolutionen), Statistiken.

## 9. Anti-Repetition — warum sich Run 50 anders anfühlt als Run 5

| Achse | Varianz |
|---|---|
| Karte | prozedural (Felsen, Moor, Räume, Spalten, Objekte, Nester) |
| Reihenfolge | 3 Mittelbiome gemischt |
| Etappe | 6 Anomalien, Fluten, Schreinsegen |
| Build | 10 Waffen × 17 Passive × 10 Evolutionen × 22 Relikte × 4 Seltenheiten |
| Figur | 4 Spezialfähigkeiten, die die Kernmechanik verändern (Teleport-Schließen, Instant-Claim …) |
| Ziel | Atlas-Herausforderungen zwingen neue Spielweisen (Speed, No-Snap, Riesenschleifen) |
| Schwierigkeit | 11 Firnis-Stufen mit neuen Regeln (nicht nur Zahlen) |
| Modi | Endlos, Daily Seed |

## 10. Pacing & Grind-Zahlen (Zielwerte)

- Erster Run: Tod in Etappe 1–2 nach ~6–10 min, ~60 Karmin / 90 Azur / 20 Ocker → 1–3 Atelier-Käufe.
- Erster Sieg: nach ~8–15 Runs (4–6 h).
- Alle Charaktere: ~8 h. Alle Techniken/Relikte: ~15 h. 25 Sterne + Firnis 10: 30–60 h.
- EP-Kurve: `5 + 4L + 0,5·L^1,75`; Level 15 am ersten Boss, Level 35–45 am Ende eines Sieges.

## 11. Barrierefreiheit & Optionen
Spieltempo 60–100 %, Bildschirmwackeln 0–100 %, Blitze aus, Schadenszahlen aus, Maus- oder Tastatur-/Pad-Bewegung, Sprache EN/DE, Vollbild. Kein Präzisions-Timing nötig; Funken lassen immer Reaktionszeit.

## 12. Art & Audio
- **Art:** „Malerei-Vektor“: bemaltes Land aus überlappenden Farbklecksen (Schatten → heller Rand → 9-Ton-Palette + Blumen/Grasbüschel), Grau als Leinwand mit Webstruktur. Gegner = Tintenkleckse mit Augen (Silhouette + Farbrand). Alles prozedural → 0 Asset-Pipeline, Mod-freundlich.
- **Audio:** vollständig mit WebAudio synthetisiert: Schleifen spielen Akkord-Arpeggios (mehr Noten = größere Schleife), Fänge als Pentatonik-Combo, adaptive Musik pro Biom (Intensität schaltet Layer), Boss-Theme.

## 13. Technik
- TypeScript + Canvas 2D + WebAudio, Vite-Build (~200 KB JS). Territorium als inkrementell bemalte Offscreen-Canvas (nur geänderte Zellen), Spatial Hash für Gegner, Partikel als Struct-of-Arrays.
- Desktop: Electron + `steamworks.js` (Erfolge, Overlay), Speicherstand als JSON in `userData` (atomar geschrieben) → Steam Auto-Cloud.
- Tests: Vitest (Flood-Fill/Claim-Logik), Playwright-Bot-Playtests (voller Run durch alle 5 Bosse), Screenshot-Pipeline, prozedurale Capsule-Generierung.

## 14. Post-Launch-Roadmap
1. **Duett** — lokaler & Remote-Play-Together-Koop (geteiltes Land, getrennte Spuren) → „Friendslop“-Trend.
2. **Biom-Updates:** Frostsee (Eis = Rutschen), Uhrwerk-Stadt (rotierende Karte), Druckerei (Muster-Stempel).
3. **Neue Figuren:** Aquarellistin (Spur trocknet/verblasst), Graffiti-Zwillinge (zwei Spuren).
4. **Workshop-Paletten** & Seed-Sharing, globale Daily-Leaderboards (Steam Leaderboards).
5. Konsolen-Ports (Switch 2, Xbox) — Canvas/Electron → Wrapper/Engine-Port.
