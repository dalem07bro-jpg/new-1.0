// All game content definitions (data-driven). Behaviour lives in src/game/*, keyed by these ids.
import type { L } from '../core/i18n';
import type { PigmentKey } from '../core/storage';

export type Cost = Partial<Record<PigmentKey, number>>;

// ------------------------------------------------------------------ Characters
export interface CharDef {
  id: string;
  name: string;
  title: L;
  desc: L;
  color: string;
  color2: string;
  hp: number;
  speed: number;
  armor: number;
  weapon: string;
  special: { name: L; desc: L; cd: number };
  unlock: L;
  mods?: { area?: number; dashCd?: number; damage?: number };
}

export const CHARS: CharDef[] = [
  {
    id: 'pip', name: 'Pip', color: '#ff5d8f', color2: '#ffd166',
    title: { en: 'The Last Painter', de: 'Die letzte Malerin' },
    desc: { en: 'Balanced and brave. Her brush never dries.', de: 'Ausgewogen und mutig. Ihr Pinsel trocknet nie.' },
    hp: 100, speed: 150, armor: 0, weapon: 'swipe',
    special: { name: { en: 'Bold Stroke', de: 'Kühner Strich' }, desc: { en: '3s: +35% speed and your trail cannot ignite.', de: '3 s: +35 % Tempo und deine Spur kann nicht entzündet werden.' }, cd: 18 },
    unlock: { en: 'Available from the start.', de: 'Von Anfang an verfügbar.' },
  },
  {
    id: 'vera', name: 'Vera', color: '#9b5de5', color2: '#f15bb5',
    title: { en: 'Ink Witch', de: 'Tintenhexe' },
    desc: { en: 'Her trail bites back. Fragile, but deadly in loops.', de: 'Ihre Spur beißt zurück. Zerbrechlich, aber tödlich in Schleifen.' },
    hp: 80, speed: 155, armor: 0, weapon: 'thorns',
    special: { name: { en: 'Hex Circle', de: 'Hexenkreis' }, desc: { en: 'Instantly claim a circle around you, capturing everything inside.', de: 'Beansprucht sofort einen Kreis um dich und fängt alles darin.' }, cd: 22 },
    unlock: { en: 'Capture 300 enemies in total.', de: 'Fange insgesamt 300 Gegner.' },
  },
  {
    id: 'bruno', name: 'Bruno', color: '#f4a261', color2: '#e76f51',
    title: { en: 'The Plasterer', de: 'Der Stuckateur' },
    desc: { en: 'Slow, sturdy, and his swipes are enormous.', de: 'Langsam, robust – und seine Hiebe sind riesig.' },
    hp: 150, speed: 132, armor: 0.1, weapon: 'swipe', mods: { area: 0.3 },
    special: { name: { en: 'Plaster Wall', de: 'Putzwand' }, desc: { en: '6s: your territory border burns enemies and slows them heavily.', de: '6 s: Der Rand deines Gebiets verbrennt Gegner und bremst sie stark.' }, cd: 20 },
    unlock: { en: 'Defeat 2 bosses in total.', de: 'Besiege insgesamt 2 Bosse.' },
  },
  {
    id: 'mona', name: 'Mona', color: '#00bbf9', color2: '#00f5d4',
    title: { en: 'Spray Runner', de: 'Sprühläuferin' },
    desc: { en: 'Fastest brush alive. Dashes more often.', de: 'Der schnellste Pinsel der Welt. Sprintet öfter.' },
    hp: 90, speed: 176, armor: 0, weapon: 'bolt', mods: { dashCd: -0.3 },
    special: { name: { en: 'Blink Home', de: 'Heimblitz' }, desc: { en: 'Teleport to your territory, sealing your trail with a straight line.', de: 'Teleportiert dich in dein Gebiet und schließt die Spur mit einer geraden Linie.' }, cd: 16 },
    unlock: { en: 'Claim 15% of a map in a single loop.', de: 'Beanspruche 15 % einer Karte mit einer einzigen Schleife.' },
  },
];

// ------------------------------------------------------------------ Weapons
export interface WeaponDef {
  id: string;
  name: L;
  desc: L;
  icon: string;
  color: string;
  evo: { passive: string; name: L; desc: L };
  unlockCost?: Cost;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'swipe', icon: 'brush', color: '#ff5d8f',
    name: { en: 'Brush Swipe', de: 'Pinselhieb' },
    desc: { en: 'A splash of paint bursts around you.', de: 'Ein Farbspritzer explodiert um dich herum.' },
    evo: { passive: 'vibrance', name: { en: 'Masterstroke Cyclone', de: 'Meisterstrich-Zyklon' }, desc: { en: 'Double bursts that hurl enemies away.', de: 'Doppelte Explosionen, die Gegner wegschleudern.' } },
  },
  {
    id: 'bolt', icon: 'bolt', color: '#00bbf9',
    name: { en: 'Paint Bolt', de: 'Farbgeschoss' },
    desc: { en: 'Homing blobs of paint seek the nearest enemy.', de: 'Zielsuchende Farbkleckse jagen den nächsten Gegner.' },
    evo: { passive: 'prism', name: { en: 'Prismatic Barrage', de: 'Prismen-Salve' }, desc: { en: 'Bolts split into three on impact.', de: 'Geschosse teilen sich beim Aufprall in drei.' } },
  },
  {
    id: 'orbit', icon: 'orbit', color: '#ffd166',
    name: { en: 'Chroma Orbs', de: 'Chroma-Kugeln' },
    desc: { en: 'Orbs of pure color circle around you.', de: 'Kugeln aus purer Farbe kreisen um dich.' },
    evo: { passive: 'tempo', name: { en: 'Color Wheel', de: 'Farbkreis' }, desc: { en: 'Orbs breathe in and out in a huge wheel.', de: 'Die Kugeln pulsieren in einem riesigen Rad.' } },
  },
  {
    id: 'thorns', icon: 'thorn', color: '#9b5de5',
    name: { en: 'Thorn Trail', de: 'Dornenspur' },
    desc: { en: 'Your trail damages enemies that touch it and can shrug off sparks.', de: 'Deine Spur verletzt Gegner, die sie berühren, und hält Funken stand.' },
    evo: { passive: 'varnish', name: { en: 'Briar Wall', de: 'Dornenwall' }, desc: { en: 'Trail damage doubled; half of all sparks fizzle out.', de: 'Doppelter Spurschaden; die Hälfte aller Funken verpufft.' } },
  },
  {
    id: 'splash', icon: 'splash', color: '#06d6a0',
    name: { en: 'Claim Splash', de: 'Landnahme-Welle' },
    desc: { en: 'Closing a loop detonates paint along its outline.', de: 'Das Schließen einer Schleife lässt Farbe entlang der Linie explodieren.' },
    evo: { passive: 'spill', name: { en: 'Tidal Flood', de: 'Farbflut' }, desc: { en: 'Explosions are huge and leave slowing puddles.', de: 'Riesige Explosionen, die bremsende Pfützen hinterlassen.' } },
  },
  {
    id: 'mines', icon: 'mine', color: '#ef476f',
    name: { en: 'Ink Mines', de: 'Tintenminen' },
    desc: { en: 'Drop mines along your trail while outside your land.', de: 'Legt Minen entlang deiner Spur, solange du draußen bist.' },
    evo: { passive: 'quickdry', name: { en: 'Minefield', de: 'Minenfeld' }, desc: { en: 'Mines chain-detonate and drop everywhere.', de: 'Minen detonieren in Ketten und fallen überall.' } },
    unlockCost: { violet: 6 },
  },
  {
    id: 'easel', icon: 'easel', color: '#f4a261',
    name: { en: 'Sentry Easel', de: 'Wächter-Staffelei' },
    desc: { en: 'Builds turrets on your territory that fire at intruders.', de: 'Baut Geschütze auf deinem Gebiet, die auf Eindringlinge feuern.' },
    evo: { passive: 'hearth', name: { en: 'Grand Gallery', de: 'Große Galerie' }, desc: { en: 'Turrets last forever and fire twice as fast.', de: 'Geschütze halten ewig und feuern doppelt so schnell.' } },
    unlockCost: { amber: 6 },
  },
  {
    id: 'beam', icon: 'beam', color: '#fee440',
    name: { en: 'Prism Beam', de: 'Prismenstrahl' },
    desc: { en: 'Fires a piercing beam of light where you move.', de: 'Feuert einen durchdringenden Lichtstrahl in Laufrichtung.' },
    evo: { passive: 'palette', name: { en: 'Spectrum Lance', de: 'Spektrallanze' }, desc: { en: 'Fires in four directions; crits cleave.', de: 'Feuert in vier Richtungen; Krits spalten.' } },
    unlockCost: { verdant: 6 },
  },
  {
    id: 'golems', icon: 'golem', color: '#8ac926',
    name: { en: 'Fresco Golems', de: 'Fresko-Golems' },
    desc: { en: 'Your land comes alive: golems guard your territory.', de: 'Dein Land erwacht: Golems bewachen dein Gebiet.' },
    evo: { passive: 'capture', name: { en: 'Living Mural', de: 'Lebendes Wandbild' }, desc: { en: 'Golems grow huge and multiply with your land.', de: 'Golems werden riesig und vermehren sich mit deinem Land.' } },
    unlockCost: { violet: 5, verdant: 5 },
  },
  {
    id: 'rain', icon: 'rain', color: '#4cc9f0',
    name: { en: 'Pigment Rain', de: 'Pigmentregen' },
    desc: { en: 'Drops of paint strike random enemies around you.', de: 'Farbtropfen treffen zufällige Gegner in deiner Nähe.' },
    evo: { passive: 'fortune', name: { en: 'Monsoon', de: 'Monsun' }, desc: { en: 'A downpour: many more, bigger drops.', de: 'Ein Wolkenbruch: viel mehr und größere Tropfen.' } },
    unlockCost: { amber: 5, verdant: 5 },
  },
];

// ------------------------------------------------------------------ Passives
export interface PassiveDef {
  id: string;
  name: L;
  desc: L; // {v} = value for the offered rarity
  icon: string;
  color: string;
  per: number; // base amount per pick
  fmt: 'pct' | 'flat' | 'int';
  max: number;
}

export const PASSIVES: PassiveDef[] = [
  { id: 'swift', icon: 'boot', color: '#00f5d4', per: 0.08, fmt: 'pct', max: 5, name: { en: 'Swift Bristles', de: 'Flinke Borsten' }, desc: { en: '+{v} movement speed.', de: '+{v} Bewegungstempo.' } },
  { id: 'thickcoat', icon: 'heart', color: '#ff5d8f', per: 20, fmt: 'flat', max: 5, name: { en: 'Thick Coat', de: 'Dicke Schicht' }, desc: { en: '+{v} max HP (and heal it).', de: '+{v} max. LP (und heilt sie).' } },
  { id: 'varnish', icon: 'shield', color: '#adb5bd', per: 0.06, fmt: 'pct', max: 5, name: { en: 'Varnish', de: 'Firnis' }, desc: { en: '+{v} damage reduction.', de: '+{v} Schadensreduktion.' } },
  { id: 'quickdry', icon: 'hourglass', color: '#ffbe0b', per: 0.1, fmt: 'pct', max: 5, name: { en: 'Quick-Dry', de: 'Schnelltrocknend' }, desc: { en: 'Sparks travel {v} slower along your trail.', de: 'Funken laufen {v} langsamer entlang deiner Spur.' } },
  { id: 'magnet', icon: 'magnet', color: '#4cc9f0', per: 0.3, fmt: 'pct', max: 5, name: { en: 'Long Handle', de: 'Langer Stiel' }, desc: { en: '+{v} pickup radius.', de: '+{v} Aufsammelradius.' } },
  { id: 'muse', icon: 'eye', color: '#b5179e', per: 0.1, fmt: 'pct', max: 5, name: { en: 'Muse', de: 'Muse' }, desc: { en: '+{v} experience gained.', de: '+{v} Erfahrung.' } },
  { id: 'vibrance', icon: 'flame', color: '#ef476f', per: 0.1, fmt: 'pct', max: 5, name: { en: 'Vibrance', de: 'Leuchtkraft' }, desc: { en: '+{v} damage.', de: '+{v} Schaden.' } },
  { id: 'tempo', icon: 'clock', color: '#fee440', per: 0.07, fmt: 'pct', max: 5, name: { en: 'Tempo', de: 'Tempo' }, desc: { en: '-{v} weapon cooldowns.', de: '-{v} Waffen-Abklingzeit.' } },
  { id: 'prism', icon: 'prism', color: '#f15bb5', per: 1, fmt: 'int', max: 3, name: { en: 'Prism', de: 'Prisma' }, desc: { en: '+{v} projectile(s) for all weapons.', de: '+{v} Projektil(e) für alle Waffen.' } },
  { id: 'hearth', icon: 'house', color: '#f4a261', per: 1, fmt: 'flat', max: 5, name: { en: 'Hearthwarm', de: 'Herdwärme' }, desc: { en: 'Regenerate {v} HP/s on your territory.', de: 'Regeneriere {v} LP/s auf deinem Gebiet.' } },
  { id: 'holy', icon: 'cross', color: '#fff3b0', per: 8, fmt: 'flat', max: 5, name: { en: 'Holy Ground', de: 'Heiliger Boden' }, desc: { en: 'Enemies on your territory take {v} damage/s.', de: 'Gegner auf deinem Gebiet erleiden {v} Schaden/s.' } },
  { id: 'palette', icon: 'knife', color: '#e5e5e5', per: 0.06, fmt: 'pct', max: 5, name: { en: 'Palette Knife', de: 'Palettenmesser' }, desc: { en: '+{v} critical hit chance.', de: '+{v} kritische Trefferchance.' } },
  { id: 'spill', icon: 'drop', color: '#06d6a0', per: 0.12, fmt: 'pct', max: 5, name: { en: 'Spill', de: 'Kleckser' }, desc: { en: '+{v} weapon area.', de: '+{v} Waffenfläche.' } },
  { id: 'fortune', icon: 'coin', color: '#ffd166', per: 0.15, fmt: 'pct', max: 5, name: { en: 'Golden Frame', de: 'Goldrahmen' }, desc: { en: '+{v} pigment found and better luck.', de: '+{v} gefundenes Pigment und mehr Glück.' } },
  { id: 'capture', icon: 'net', color: '#8ac926', per: 0.25, fmt: 'pct', max: 5, name: { en: 'Masterstroke', de: 'Meisterstreich' }, desc: { en: '+{v} XP from captured enemies.', de: '+{v} EP von gefangenen Gegnern.' } },
  { id: 'dash', icon: 'wind', color: '#90e0ef', per: 0.12, fmt: 'pct', max: 5, name: { en: 'Afterimage', de: 'Nachbild' }, desc: { en: '-{v} dash cooldown.', de: '-{v} Sprint-Abklingzeit.' } },
  { id: 'guard', icon: 'guard', color: '#caffbf', per: 1, fmt: 'int', max: 3, name: { en: 'Wet Varnish', de: 'Nasser Firnis' }, desc: { en: 'Your trail ignores the first {v} spark(s) of every loop.', de: 'Deine Spur ignoriert die ersten {v} Funken jeder Schleife.' } },
];

// ------------------------------------------------------------------ Relics
export interface RelicDef {
  id: string;
  name: L;
  desc: L;
  icon: string;
  color: string;
  cost?: Cost; // atelier gallery unlock cost; absent = unlocked by default
}

export const RELICS: RelicDef[] = [
  { id: 'easel', icon: 'easel', color: '#ffd166', name: { en: 'Golden Easel', de: 'Goldene Staffelei' }, desc: { en: '+1 choice on every level-up.', de: '+1 Auswahl bei jedem Levelaufstieg.' } },
  { id: 'mirror', icon: 'guard', color: '#caf0f8', name: { en: 'Cracked Mirror', de: 'Gesprungener Spiegel' }, desc: { en: 'Your trail ignores the first 2 sparks of every loop.', de: 'Deine Spur ignoriert die ersten 2 Funken jeder Schleife.' } },
  { id: 'heart', icon: 'heart', color: '#ff5d8f', name: { en: 'Heart of Hue', de: 'Herz der Farbe' }, desc: { en: 'Revive once with 50% HP.', de: 'Einmalige Wiederbelebung mit 50 % LP.' } },
  { id: 'wetpaint', icon: 'drop', color: '#06d6a0', name: { en: 'Wet Paint', de: 'Frische Farbe' }, desc: { en: 'Freshly claimed land burns enemies for 3s.', de: 'Frisch beanspruchtes Land verbrennt 3 s lang Gegner.' } },
  { id: 'opus', icon: 'star', color: '#fee440', name: { en: 'Magnum Opus', de: 'Magnum Opus' }, desc: { en: 'Loops claiming 4%+ of the map count double.', de: 'Schleifen mit 4 %+ der Karte zählen doppelt.' } },
  { id: 'compass', icon: 'boot', color: '#00f5d4', name: { en: "Cartographer's Ink", de: 'Kartografentinte' }, desc: { en: '+18% speed while outside your territory.', de: '+18 % Tempo außerhalb deines Gebiets.' } },
  { id: 'dice', icon: 'dice', color: '#f15bb5', name: { en: 'Loaded Brush', de: 'Gezinkter Pinsel' }, desc: { en: '+2 rerolls every stage.', de: '+2 Neuwürfe pro Etappe.' } },
  { id: 'twin', icon: 'bolt', color: '#00bbf9', name: { en: 'Twin Canvas', de: 'Zwillingsleinwand' }, desc: { en: 'Each captured enemy fires a paint bolt.', de: 'Jeder gefangene Gegner feuert ein Farbgeschoss.' } },
  { id: 'sun', icon: 'sun', color: '#ffbe0b', name: { en: 'Pocket Sun', de: 'Taschensonne' }, desc: { en: 'Regenerate 3 HP/s on your territory.', de: 'Regeneriere 3 LP/s auf deinem Gebiet.' } },
  { id: 'hourglass', icon: 'hourglass', color: '#e9c46a', name: { en: 'Hourglass', de: 'Sanduhr' }, desc: { en: 'Sparks travel 30% slower.', de: 'Funken laufen 30 % langsamer.' } },
  { id: 'midas', icon: 'coin', color: '#ffd166', name: { en: 'Midas Pigment', de: 'Midas-Pigment' }, desc: { en: '+50% pigment from all sources.', de: '+50 % Pigment aus allen Quellen.' }, cost: { ochre: 60 } },
  { id: 'crit', icon: 'knife', color: '#e5e5e5', name: { en: 'Critical Palette', de: 'Kritische Palette' }, desc: { en: '+15% crit chance, +50% crit damage.', de: '+15 % Kritchance, +50 % Kritschaden.' }, cost: { crimson: 80 } },
  { id: 'rosethorn', icon: 'thorn', color: '#9b5de5', name: { en: 'Rosethorn', de: 'Rosendorn' }, desc: { en: 'Your trail damages enemies that touch it.', de: 'Deine Spur verletzt Gegner, die sie berühren.' }, cost: { violet: 4 } },
  { id: 'lacquer', icon: 'heart', color: '#d00000', name: { en: 'Crimson Lacquer', de: 'Karminlack' }, desc: { en: 'Heal 1 HP for every 2 enemies captured.', de: 'Heile 1 LP pro 2 gefangenen Gegnern.' }, cost: { crimson: 60, ochre: 20 } },
  { id: 'lens', icon: 'eye', color: '#90e0ef', name: { en: 'Lens of Clarity', de: 'Linse der Klarheit' }, desc: { en: '+20% area and +10% experience.', de: '+20 % Fläche und +10 % Erfahrung.' }, cost: { azure: 90 } },
  { id: 'outline', icon: 'cross', color: '#fff3b0', name: { en: 'Bold Outline', de: 'Kräftige Kontur' }, desc: { en: 'Enemies standing on your border take 40 damage/s.', de: 'Gegner auf deinem Rand erleiden 40 Schaden/s.' }, cost: { verdant: 5 } },
  { id: 'stilllife', icon: 'clock', color: '#caffbf', name: { en: 'Still Life', de: 'Stillleben' }, desc: { en: 'Closing a loop freezes nearby enemies for 1s.', de: 'Eine Schleife zu schließen friert Gegner in der Nähe 1 s ein.' }, cost: { amber: 5 } },
  { id: 'bomb', icon: 'mine', color: '#ef476f', name: { en: 'Pigment Bomb', de: 'Pigmentbombe' }, desc: { en: 'Every 6th loop triggers a huge explosion.', de: 'Jede 6. Schleife löst eine riesige Explosion aus.' }, cost: { crimson: 50, azure: 50 } },
  { id: 'emberquill', icon: 'flame', color: '#ff7b3a', name: { en: 'Ember Quill', de: 'Glutfeder' }, desc: { en: 'Snaps hurt 50% less and unleash a fire nova.', de: 'Rissschaden -50 % und löst eine Feuernova aus.' }, cost: { amber: 4, ochre: 30 } },
  { id: 'crown', icon: 'crown', color: '#ffd166', name: { en: "Painter's Crown", de: 'Malerkrone' }, desc: { en: '+15% damage and +1 level to your weakest weapon.', de: '+15 % Schaden und +1 Stufe für deine schwächste Waffe.' }, cost: { violet: 5, amber: 5, verdant: 5 } },
  { id: 'coin', icon: 'coin', color: '#fca311', name: { en: 'Lucky Coin', de: 'Glücksmünze' }, desc: { en: 'Much better odds for rare upgrades.', de: 'Deutlich bessere Chancen auf seltene Upgrades.' }, cost: { ochre: 45 } },
  { id: 'boots', icon: 'wind', color: '#90e0ef', name: { en: 'Seven-League Brush', de: 'Siebenmeilenpinsel' }, desc: { en: '-40% dash cooldown; dashing damages enemies.', de: '-40 % Sprint-Abklingzeit; Sprinten verletzt Gegner.' }, cost: { azure: 70, crimson: 30 } },
];

// ------------------------------------------------------------------ Enemies
export type EnemyAI = 'chase' | 'trail' | 'ranged' | 'leech' | 'charger' | 'turret' | 'wisp' | 'phantom' | 'nest' | 'boss';
export interface EnemyDef {
  id: string;
  name: L;
  desc: L;
  r: number;
  hp: number;
  speed: number;
  dmg: number;
  xp: number;
  color: string;
  ai: EnemyAI;
  splits?: boolean;
  immune?: boolean; // only capture kills
  herd?: boolean; // spawns in groups that graze until aggroed
  bossHp?: number;
}

export const ENEMIES: EnemyDef[] = [
  { id: 'blot', ai: 'chase', herd: true, r: 8, hp: 10, speed: 72, dmg: 8, xp: 1, color: '#8d99ae', name: { en: 'Blotling', de: 'Klecksling' }, desc: { en: 'A hungry drop of grey. Comes in crowds.', de: 'Ein hungriger grauer Tropfen. Kommt in Scharen.' } },
  { id: 'drip', ai: 'chase', herd: true, r: 12, hp: 38, speed: 42, dmg: 12, xp: 3, color: '#6c757d', name: { en: 'Drip', de: 'Tropfer' }, desc: { en: 'Slow and heavy. Soaks up hits.', de: 'Langsam und schwer. Steckt viel ein.' } },
  { id: 'snip', ai: 'trail', r: 8, hp: 14, speed: 98, dmg: 6, xp: 2, color: '#f72585', name: { en: 'Snipper', de: 'Schnipsler' }, desc: { en: 'Ignores you. Hunts your trail.', de: 'Ignoriert dich. Jagt deine Spur.' } },
  { id: 'spit', ai: 'ranged', r: 10, hp: 22, speed: 56, dmg: 10, xp: 3, color: '#4cc9f0', name: { en: 'Spitter', de: 'Spucker' }, desc: { en: 'Lobs ink. Ink ignites trails.', de: 'Spuckt Tinte. Tinte entzündet Spuren.' } },
  { id: 'leech', ai: 'leech', r: 10, hp: 30, speed: 62, dmg: 6, xp: 4, color: '#80ed99', name: { en: 'Leech', de: 'Egel' }, desc: { en: 'Drains the color from your land.', de: 'Saugt die Farbe aus deinem Land.' } },
  { id: 'charge', ai: 'charger', r: 11, hp: 48, speed: 50, dmg: 16, xp: 4, color: '#ff9f1c', name: { en: 'Charger', de: 'Rammer' }, desc: { en: 'Winds up, then rams in a straight line.', de: 'Holt Anlauf und rammt geradeaus.' } },
  { id: 'sentinel', ai: 'turret', r: 13, hp: 90, speed: 0, dmg: 10, xp: 8, color: '#e9c46a', name: { en: 'Sentinel', de: 'Wächter' }, desc: { en: 'A rooted ruin-guard. Capture it for treasure.', de: 'Ein verwurzelter Ruinenwächter. Fang ihn für Schätze.' } },
  { id: 'split', ai: 'chase', herd: true, r: 11, hp: 42, speed: 58, dmg: 10, xp: 3, splits: true, color: '#b5179e', name: { en: 'Splitter', de: 'Spalter' }, desc: { en: 'Splits in two when killed – but not when captured.', de: 'Teilt sich beim Tod – aber nicht, wenn gefangen.' } },
  { id: 'wisp', ai: 'wisp', r: 7, hp: 9, speed: 135, dmg: 7, xp: 1, color: '#ffb627', name: { en: 'Cinder Wisp', de: 'Glutirrlicht' }, desc: { en: 'Fast and erratic.', de: 'Schnell und unberechenbar.' } },
  { id: 'phantom', ai: 'phantom', r: 10, hp: 1, speed: 64, dmg: 12, xp: 7, immune: true, color: '#e0aaff', name: { en: 'Phantom', de: 'Phantom' }, desc: { en: 'Immune to all damage. Only a loop can catch it.', de: 'Immun gegen jeden Schaden. Nur eine Schleife fängt es.' } },
  { id: 'nest', ai: 'nest', r: 17, hp: 160, speed: 0, dmg: 0, xp: 10, color: '#5a189a', name: { en: 'Void Nest', de: 'Leerennest' }, desc: { en: 'Spawns Blotlings. Capture or destroy it.', de: 'Brütet Kleckslinge aus. Fang oder zerstöre es.' } },
  // bosses
  { id: 'smudge', ai: 'boss', r: 40, hp: 1, bossHp: 1400, speed: 55, dmg: 20, xp: 60, color: '#adb5bd', name: { en: 'The Smudge King', de: 'Der Schmierkönig' }, desc: { en: 'Crowned in grime. Summons his court.', de: 'Gekrönt mit Schmutz. Ruft seinen Hofstaat.' } },
  { id: 'mire', ai: 'boss', r: 42, hp: 1, bossHp: 2200, speed: 60, dmg: 22, xp: 80, color: '#52b69a', name: { en: 'Mire Mother', de: 'Moormutter' }, desc: { en: 'Sinks beneath the grey and rises elsewhere.', de: 'Versinkt im Grau und taucht woanders auf.' } },
  { id: 'eraser', ai: 'boss', r: 38, hp: 1, bossHp: 3000, speed: 70, dmg: 26, xp: 100, color: '#f4f1de', name: { en: 'The Eraser', de: 'Der Radierer' }, desc: { en: 'Charges through your land, wiping it blank.', de: 'Rast durch dein Land und radiert es leer.' } },
  { id: 'wyrm', ai: 'boss', r: 30, hp: 1, bossHp: 3800, speed: 115, dmg: 26, xp: 120, color: '#ff4d00', name: { en: 'Cinder Wyrm', de: 'Glutwurm' }, desc: { en: 'Its burning body sets trails alight.', de: 'Sein brennender Leib entzündet Spuren.' } },
  { id: 'blank', ai: 'boss', r: 56, hp: 1, bossHp: 6500, speed: 48, dmg: 30, xp: 200, color: '#ffffff', name: { en: 'The Blank', de: 'Das Leere' }, desc: { en: 'The absence of every color. The end of the canvas.', de: 'Die Abwesenheit aller Farben. Das Ende der Leinwand.' } },
];
export const ENEMY = Object.fromEntries(ENEMIES.map((e) => [e.id, e])) as Record<string, EnemyDef>;

// ------------------------------------------------------------------ Biomes
export interface BiomeDef {
  id: string;
  name: L;
  desc: L;
  mechanic: L;
  w: number;
  h: number;
  goal: number;
  music: string;
  boss: string;
  pal: { void: string; void2: string; land: string[]; edge: string; decor: string[]; rock: string; accent: string };
  pool: { id: string; w: number; from: number }[]; // from = minutes
  root: number;
}

export const BIOMES: BiomeDef[] = [
  {
    id: 'meadows', name: { en: 'Greyfield Meadows', de: 'Graufeld-Wiesen' },
    desc: { en: 'Where the grey began. Gentle hills waiting for color.', de: 'Wo das Grau begann. Sanfte Hügel, die auf Farbe warten.' },
    mechanic: { en: 'Open fields. Learn to loop.', de: 'Offene Felder. Lerne zu umkreisen.' },
    w: 150, h: 100, goal: 0.55, music: 'meadows', boss: 'smudge', root: 60,
    pal: { void: '#26242e', void2: '#33313d', land: ['#7bd88f', '#9be564', '#5cc98a'], edge: '#fff3b0', decor: ['#ff8fab', '#ffd166', '#ffffff', '#c77dff'], rock: '#4a4652', accent: '#ffd166' },
    pool: [{ id: 'blot', w: 10, from: 0 }, { id: 'drip', w: 3, from: 0.6 }, { id: 'snip', w: 3, from: 1.2 }, { id: 'split', w: 2, from: 3 }],
  },
  {
    id: 'marsh', name: { en: 'Inkwater Marsh', de: 'Tintenwasser-Moor' },
    desc: { en: 'A bog of spilled ink that swallows every step.', de: 'Ein Sumpf aus verschütteter Tinte, der jeden Schritt verschluckt.' },
    mechanic: { en: 'Bog slows everything. Leeches drain your land.', de: 'Moor bremst alles. Egel saugen dein Land aus.' },
    w: 160, h: 106, goal: 0.58, music: 'marsh', boss: 'mire', root: 55,
    pal: { void: '#1b2528', void2: '#243236', land: ['#3ecfcf', '#5fa8d3', '#48bfe3'], edge: '#e0fbfc', decor: ['#ff99c8', '#b8f2e6', '#fcf6bd', '#ffffff'], rock: '#3b4a4e', accent: '#ff99c8' },
    pool: [{ id: 'blot', w: 8, from: 0 }, { id: 'spit', w: 3, from: 0.3 }, { id: 'leech', w: 3, from: 0.8 }, { id: 'snip', w: 3, from: 1 }, { id: 'drip', w: 2, from: 2 }],
  },
  {
    id: 'ruins', name: { en: 'Chalk Ruins', de: 'Kreide-Ruinen' },
    desc: { en: 'Crumbling halls of an old academy of art.', de: 'Zerfallende Hallen einer alten Kunstakademie.' },
    mechanic: { en: 'Walls count as borders: dip into a room to claim it whole.', de: 'Mauern zählen als Grenzen: Tauch in einen Raum ein, um ihn ganz zu nehmen.' },
    w: 160, h: 108, goal: 0.6, music: 'ruins', boss: 'eraser', root: 57,
    pal: { void: '#2b2724', void2: '#38322d', land: ['#f4a261', '#e9c46a', '#e76f51'], edge: '#fff1d0', decor: ['#2a9d8f', '#ffffff', '#264653', '#ffd6a5'], rock: '#8a7968', accent: '#2a9d8f' },
    pool: [{ id: 'blot', w: 7, from: 0 }, { id: 'charge', w: 3, from: 0.3 }, { id: 'split', w: 3, from: 1 }, { id: 'snip', w: 2, from: 1.5 }, { id: 'spit', w: 2, from: 2 }],
  },
  {
    id: 'ember', name: { en: 'Ember Canyon', de: 'Glut-Schlucht' },
    desc: { en: 'Molten cracks split the valley. The grey here is hot.', de: 'Glühende Risse spalten das Tal. Das Grau hier ist heiß.' },
    mechanic: { en: 'Fissures erupt and ignite any trail crossing them.', de: 'Spalten brechen aus und entzünden jede Spur, die sie kreuzt.' },
    w: 166, h: 110, goal: 0.6, music: 'ember', boss: 'wyrm', root: 52,
    pal: { void: '#231a1d', void2: '#312226', land: ['#ff7b3a', '#ffb627', '#ff4d6d'], edge: '#fff0a8', decor: ['#ffe8d6', '#720026', '#ffd60a', '#ffffff'], rock: '#4d3035', accent: '#ffd60a' },
    pool: [{ id: 'wisp', w: 8, from: 0 }, { id: 'blot', w: 5, from: 0 }, { id: 'charge', w: 3, from: 0.8 }, { id: 'split', w: 3, from: 1.2 }, { id: 'spit', w: 2, from: 2 }],
  },
  {
    id: 'hollow', name: { en: 'The Hollow', de: 'Die Leere' },
    desc: { en: 'The heart of the grey. Reality is thin here.', de: 'Das Herz des Graus. Die Wirklichkeit ist hier dünn.' },
    mechanic: { en: 'Phantoms can only be caught in loops. Your land slowly fades.', de: 'Phantome lassen sich nur mit Schleifen fangen. Dein Land verblasst langsam.' },
    w: 170, h: 112, goal: 0.62, music: 'hollow', boss: 'blank', root: 50,
    pal: { void: '#14121f', void2: '#1f1b30', land: ['#c77dff', '#9d4edd', '#ff9ecd'], edge: '#ffffff', decor: ['#80ffdb', '#ffffff', '#ffd6ff', '#72efdd'], rock: '#2c2640', accent: '#80ffdb' },
    pool: [{ id: 'phantom', w: 4, from: 0 }, { id: 'blot', w: 6, from: 0 }, { id: 'snip', w: 3, from: 0.5 }, { id: 'leech', w: 2, from: 1 }, { id: 'spit', w: 2, from: 1.5 }, { id: 'charge', w: 2, from: 2 }],
  },
];
export const BIOME = Object.fromEntries(BIOMES.map((b) => [b.id, b])) as Record<string, BiomeDef>;

// ------------------------------------------------------------------ Atelier (meta upgrades)
export interface AtelierDef {
  id: string;
  name: L;
  desc: L; // {v}
  icon: string;
  max: number;
  per: number;
  fmt: 'pct' | 'flat' | 'int';
  base: Cost;
  growth: number;
}

export const ATELIER: AtelierDef[] = [
  { id: 'vitality', icon: 'heart', max: 5, per: 10, fmt: 'flat', base: { crimson: 25 }, growth: 1.7, name: { en: 'Vitality', de: 'Vitalität' }, desc: { en: '+{v} max HP.', de: '+{v} max. LP.' } },
  { id: 'bristles', icon: 'boot', max: 5, per: 0.03, fmt: 'pct', base: { azure: 30 }, growth: 1.7, name: { en: 'Bristle Speed', de: 'Borstentempo' }, desc: { en: '+{v} movement speed.', de: '+{v} Bewegungstempo.' } },
  { id: 'vibrance', icon: 'flame', max: 5, per: 0.05, fmt: 'pct', base: { crimson: 30 }, growth: 1.7, name: { en: 'Vibrance', de: 'Leuchtkraft' }, desc: { en: '+{v} damage.', de: '+{v} Schaden.' } },
  { id: 'quickdry', icon: 'hourglass', max: 5, per: 0.05, fmt: 'pct', base: { azure: 35 }, growth: 1.7, name: { en: 'Slow Fuse', de: 'Langsame Lunte' }, desc: { en: 'Sparks {v} slower.', de: 'Funken {v} langsamer.' } },
  { id: 'muse', icon: 'eye', max: 5, per: 0.05, fmt: 'pct', base: { azure: 30 }, growth: 1.7, name: { en: 'Inspiration', de: 'Inspiration' }, desc: { en: '+{v} experience.', de: '+{v} Erfahrung.' } },
  { id: 'fortune', icon: 'coin', max: 5, per: 0.08, fmt: 'pct', base: { ochre: 15 }, growth: 1.75, name: { en: 'Fortune', de: 'Fortuna' }, desc: { en: '+{v} pigment from runs.', de: '+{v} Pigment aus Läufen.' } },
  { id: 'armor', icon: 'shield', max: 5, per: 0.03, fmt: 'pct', base: { ochre: 18 }, growth: 1.75, name: { en: 'Primer Coat', de: 'Grundierung' }, desc: { en: '+{v} damage reduction.', de: '+{v} Schadensreduktion.' } },
  { id: 'magnet', icon: 'magnet', max: 3, per: 0.15, fmt: 'pct', base: { azure: 25 }, growth: 1.8, name: { en: 'Reach', de: 'Reichweite' }, desc: { en: '+{v} pickup radius.', de: '+{v} Aufsammelradius.' } },
  { id: 'reroll', icon: 'dice', max: 5, per: 1, fmt: 'int', base: { ochre: 20 }, growth: 1.6, name: { en: 'Second Thoughts', de: 'Zweite Gedanken' }, desc: { en: '+{v} reroll per run.', de: '+{v} Neuwurf pro Lauf.' } },
  { id: 'banish', icon: 'cross', max: 3, per: 1, fmt: 'int', base: { violet: 3 }, growth: 1.8, name: { en: 'Blank Canvas', de: 'Leere Leinwand' }, desc: { en: '+{v} banish per run.', de: '+{v} Verbannung pro Lauf.' } },
  { id: 'luck', icon: 'star', max: 5, per: 0.05, fmt: 'pct', base: { verdant: 2 }, growth: 1.6, name: { en: 'Luck', de: 'Glück' }, desc: { en: '+{v} luck (rarer upgrades).', de: '+{v} Glück (seltenere Upgrades).' } },
  { id: 'guard', icon: 'guard', max: 2, per: 1, fmt: 'int', base: { violet: 4 }, growth: 2, name: { en: 'Sealant', de: 'Versiegelung' }, desc: { en: 'Trail ignores +{v} spark per loop.', de: 'Spur ignoriert +{v} Funken pro Schleife.' } },
  { id: 'headstart', icon: 'bolt', max: 2, per: 1, fmt: 'int', base: { verdant: 4 }, growth: 2, name: { en: 'Head Start', de: 'Vorsprung' }, desc: { en: 'Start each run with +{v} free level-up.', de: 'Starte jeden Lauf mit +{v} Gratis-Level.' } },
  { id: 'revive', icon: 'sun', max: 1, per: 1, fmt: 'int', base: { amber: 8, ochre: 60 }, growth: 1, name: { en: 'Second Coat', de: 'Zweiter Anstrich' }, desc: { en: 'Revive once per run.', de: 'Einmal pro Lauf wiederbeleben.' } },
];

// ------------------------------------------------------------------ Anomalies (per-stage twists)
export interface AnomalyDef {
  id: string;
  name: L;
  desc: L;
  color: string;
}
export const ANOMALIES: AnomalyDef[] = [
  { id: 'swarm', color: '#adb5bd', name: { en: 'Swarm', de: 'Schwarm' }, desc: { en: '+50% enemies, +30% experience.', de: '+50 % Gegner, +30 % Erfahrung.' } },
  { id: 'golden', color: '#ffd166', name: { en: 'Golden Hour', de: 'Goldene Stunde' }, desc: { en: 'Double pigment, but elites are twice as common.', de: 'Doppeltes Pigment, aber doppelt so viele Elite-Gegner.' } },
  { id: 'treasure', color: '#f4a261', name: { en: 'Buried Treasure', de: 'Vergrabener Schatz' }, desc: { en: 'Extra chests and pigment caches lie in the grey.', de: 'Zusätzliche Truhen und Pigmentschätze liegen im Grau.' } },
  { id: 'storm', color: '#4cc9f0', name: { en: 'Ink Storm', de: 'Tintensturm' }, desc: { en: 'Lightning sparks your trail. Painted land gives +50% XP.', de: 'Blitze entzünden deine Spur. Bemaltes Land gibt +50 % EP.' } },
  { id: 'bloom', color: '#ff8fab', name: { en: 'Bloom', de: 'Blütezeit' }, desc: { en: 'Every loop heals you a little.', de: 'Jede Schleife heilt dich ein wenig.' } },
  { id: 'giants', color: '#b5179e', name: { en: 'Giants', de: 'Riesen' }, desc: { en: 'Enemies are bigger and tougher, but drop double XP.', de: 'Gegner sind größer und zäher, lassen aber doppelte EP fallen.' } },
];

// ------------------------------------------------------------------ Varnish (difficulty ladder)
export const VARNISH: L[] = [
  { en: 'Standard canvas.', de: 'Standard-Leinwand.' },
  { en: 'Enemies have +25% HP.', de: 'Gegner haben +25 % LP.' },
  { en: 'Sparks travel 15% faster.', de: 'Funken laufen 15 % schneller.' },
  { en: 'Elites appear twice as often.', de: 'Elite-Gegner erscheinen doppelt so oft.' },
  { en: '+25% more enemies.', de: '+25 % mehr Gegner.' },
  { en: 'Start with 20% less max HP.', de: 'Starte mit 20 % weniger max. LP.' },
  { en: 'Stage goals +5%.', de: 'Etappenziele +5 %.' },
  { en: 'Enemies move 12% faster.', de: 'Gegner bewegen sich 12 % schneller.' },
  { en: 'Bosses have +40% HP.', de: 'Bosse haben +40 % LP.' },
  { en: 'Hearts heal half as much.', de: 'Herzen heilen nur halb so viel.' },
  { en: 'The Grey Hunger: your land slowly fades everywhere.', de: 'Der graue Hunger: Dein Land verblasst überall langsam.' },
];

// ------------------------------------------------------------------ Atlas challenges (5 stars per biome)
export const CHALLENGES: L[] = [
  { en: 'Defeat the boss', de: 'Besiege den Boss' },
  { en: 'Defeat the boss on Varnish 3+', de: 'Besiege den Boss auf Firnis 3+' },
  { en: 'Clear the stage in under 5:00', de: 'Schaffe die Etappe in unter 5:00' },
  { en: 'Capture 60 enemies in a single loop', de: 'Fange 60 Gegner mit einer Schleife' },
  { en: 'Clear the stage without a single Snap', de: 'Schaffe die Etappe ohne einen einzigen Riss' },
];

// ------------------------------------------------------------------ Achievements
export interface AchDef {
  id: string;
  name: L;
  desc: L;
}
export const ACHIEVEMENTS: AchDef[] = [
  { id: 'FIRST_LOOP', name: { en: 'First Stroke', de: 'Erster Strich' }, desc: { en: 'Close your first loop.', de: 'Schließe deine erste Schleife.' } },
  { id: 'CAPTURE_10', name: { en: 'Caught Red-Handed', de: 'Auf frischer Tat' }, desc: { en: 'Capture 10 enemies in one loop.', de: 'Fange 10 Gegner mit einer Schleife.' } },
  { id: 'CAPTURE_50', name: { en: 'The Big Net', de: 'Das große Netz' }, desc: { en: 'Capture 50 enemies in one loop.', de: 'Fange 50 Gegner mit einer Schleife.' } },
  { id: 'CAPTURE_150', name: { en: 'Mass Exhibition', de: 'Massenausstellung' }, desc: { en: 'Capture 150 enemies in one loop.', de: 'Fange 150 Gegner mit einer Schleife.' } },
  { id: 'LOOP_10PCT', name: { en: 'Broad Strokes', de: 'Breite Striche' }, desc: { en: 'Claim 10% of a map in one loop.', de: 'Beanspruche 10 % einer Karte mit einer Schleife.' } },
  { id: 'LOOP_25PCT', name: { en: 'Land Baron', de: 'Landbaron' }, desc: { en: 'Claim 25% of a map in one loop.', de: 'Beanspruche 25 % einer Karte mit einer Schleife.' } },
  { id: 'BOSS_SMUDGE', name: { en: 'Dethroned', de: 'Entthront' }, desc: { en: 'Defeat the Smudge King.', de: 'Besiege den Schmierkönig.' } },
  { id: 'BOSS_MIRE', name: { en: 'Drained the Swamp', de: 'Sumpf trockengelegt' }, desc: { en: 'Defeat the Mire Mother.', de: 'Besiege die Moormutter.' } },
  { id: 'BOSS_ERASER', name: { en: 'Undo', de: 'Rückgängig' }, desc: { en: 'Defeat the Eraser.', de: 'Besiege den Radierer.' } },
  { id: 'BOSS_WYRM', name: { en: 'Cooled Down', de: 'Abgekühlt' }, desc: { en: 'Defeat the Cinder Wyrm.', de: 'Besiege den Glutwurm.' } },
  { id: 'WIN', name: { en: 'Masterpiece', de: 'Meisterwerk' }, desc: { en: 'Defeat The Blank and restore the world.', de: 'Besiege das Leere und stelle die Welt wieder her.' } },
  { id: 'WIN_V3', name: { en: 'Glazed', de: 'Glasiert' }, desc: { en: 'Win on Varnish 3 or higher.', de: 'Gewinne auf Firnis 3 oder höher.' } },
  { id: 'WIN_V6', name: { en: 'Lacquered', de: 'Lackiert' }, desc: { en: 'Win on Varnish 6 or higher.', de: 'Gewinne auf Firnis 6 oder höher.' } },
  { id: 'WIN_V10', name: { en: 'Museum Piece', de: 'Museumsstück' }, desc: { en: 'Win on Varnish 10.', de: 'Gewinne auf Firnis 10.' } },
  { id: 'WIN_ALL_CHARS', name: { en: 'The Whole Studio', de: 'Das ganze Atelier' }, desc: { en: 'Win with every character.', de: 'Gewinne mit jedem Charakter.' } },
  { id: 'STAGE_90', name: { en: 'Fully Painted', de: 'Komplett bemalt' }, desc: { en: 'Own 90% of a map.', de: 'Besitze 90 % einer Karte.' } },
  { id: 'NO_SNAP', name: { en: 'Steady Hand', de: 'Ruhige Hand' }, desc: { en: 'Clear a stage without a Snap.', de: 'Schaffe eine Etappe ohne Riss.' } },
  { id: 'FAST_STAGE', name: { en: 'Speedpainter', de: 'Schnellmaler' }, desc: { en: 'Clear a stage in under 3:30.', de: 'Schaffe eine Etappe in unter 3:30.' } },
  { id: 'LEVEL_30', name: { en: 'Old Master', de: 'Alter Meister' }, desc: { en: 'Reach level 30 in a run.', de: 'Erreiche Level 30 in einem Lauf.' } },
  { id: 'EVOLVE', name: { en: 'Evolution', de: 'Evolution' }, desc: { en: 'Evolve a weapon.', de: 'Entwickle eine Waffe weiter.' } },
  { id: 'EVOLVE_5', name: { en: 'Renaissance', de: 'Renaissance' }, desc: { en: 'Discover 5 different evolutions.', de: 'Entdecke 5 verschiedene Evolutionen.' } },
  { id: 'EVOLVE_ALL', name: { en: 'Complete Works', de: 'Gesamtwerk' }, desc: { en: 'Discover every evolution.', de: 'Entdecke alle Evolutionen.' } },
  { id: 'RELICS_6', name: { en: 'Collector', de: 'Sammler' }, desc: { en: 'Hold 6 relics in a single run.', de: 'Halte 6 Relikte in einem Lauf.' } },
  { id: 'CAPTURES_1K', name: { en: 'Curator', de: 'Kurator' }, desc: { en: 'Capture 1,000 enemies in total.', de: 'Fange insgesamt 1.000 Gegner.' } },
  { id: 'CAPTURES_10K', name: { en: 'Grand Curator', de: 'Großkurator' }, desc: { en: 'Capture 10,000 enemies in total.', de: 'Fange insgesamt 10.000 Gegner.' } },
  { id: 'CELLS_1M', name: { en: 'A Million Strokes', de: 'Eine Million Striche' }, desc: { en: 'Claim 1,000,000 cells in total.', de: 'Beanspruche insgesamt 1.000.000 Felder.' } },
  { id: 'MIXER', name: { en: 'Color Theory', de: 'Farblehre' }, desc: { en: 'Mix a secondary pigment.', de: 'Mische ein Sekundärpigment.' } },
  { id: 'ATELIER_20', name: { en: 'Well Equipped', de: 'Gut ausgestattet' }, desc: { en: 'Buy 20 Atelier upgrades.', de: 'Kaufe 20 Atelier-Upgrades.' } },
  { id: 'STARS_10', name: { en: 'Rising Star', de: 'Aufsteigender Stern' }, desc: { en: 'Earn 10 Atlas stars.', de: 'Verdiene 10 Atlas-Sterne.' } },
  { id: 'STARS_25', name: { en: 'Constellation', de: 'Sternbild' }, desc: { en: 'Earn all 25 Atlas stars.', de: 'Verdiene alle 25 Atlas-Sterne.' } },
  { id: 'CLOSE_CALL', name: { en: 'Close Call', de: 'Knapp daneben' }, desc: { en: 'Close a loop while a spark is less than 10 cells away.', de: 'Schließe eine Schleife, während ein Funke weniger als 10 Felder entfernt ist.' } },
  { id: 'TIGHT_LOOP', name: { en: 'Tight Squeeze', de: 'Enge Kiste' }, desc: { en: 'Deal 20% of a boss\'s HP with a single loop.', de: 'Füge einem Boss mit einer Schleife 20 % seiner LP zu.' } },
  { id: 'ENDLESS_2', name: { en: 'Infinite Canvas', de: 'Unendliche Leinwand' }, desc: { en: 'Reach cycle 2 in Endless mode.', de: 'Erreiche Zyklus 2 im Endlosmodus.' } },
  { id: 'DAILY', name: { en: 'Daily Practice', de: 'Tägliche Übung' }, desc: { en: 'Complete a Daily Canvas.', de: 'Schließe eine Tägliche Leinwand ab.' } },
  { id: 'SHRINE_3', name: { en: 'Devotee', de: 'Anhänger' }, desc: { en: 'Capture 3 shrines in one run.', de: 'Fange 3 Schreine in einem Lauf.' } },
  { id: 'NESTS_ALL', name: { en: 'Pest Control', de: 'Schädlingsbekämpfung' }, desc: { en: 'Capture every Void Nest on a map.', de: 'Fange jedes Leerennest einer Karte.' } },
];
