// HUE & CLAIM — application entry: main loop, state machine, run orchestration.
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './ui/ui.css';
import { audio } from './core/audio';
import { detectLang, setLang, t, tr } from './core/i18n';
import { input } from './core/input';
import { seedFromString } from './core/rng';
import { loadSave, wipeSave, writeSave, freshSave, type SaveData } from './core/storage';
import { BIOMES, CHALLENGES, CHARS } from './data/content';
import { Bot } from './game/bot';
import { Game, type GameHooks } from './game/game';
import { awardStars, checkCharUnlocks, checkLifetimeAchievements, finishRun, grantAchievement, todayKey } from './game/meta';
import { Run, type Mode } from './game/run';
import type { Card } from './game/types';
import { Renderer } from './render/renderer';
import { UI, type App } from './ui/ui';

const params = new URLSearchParams(location.search);
const DEBUG = {
  bot: params.has('bot'),
  god: params.has('god'),
  stage: Number(params.get('stage') ?? 0),
  level: Number(params.get('level') ?? 0),
  char: params.get('char'),
  seed: params.get('seed'),
  autostart: params.has('autostart'),
  time: Number(params.get('time') ?? 0),
  varnish: Number(params.get('varnish') ?? 0),
  nohud: params.has('nohud'),
  relics: Number(params.get('relics') ?? 0),
  fill: Number(params.get('fill') ?? 0),
  goal: Number(params.get('goal') ?? 0),
  biome: params.get('biome'),
  fast: Math.max(1, Number(params.get('fast') ?? 1)),
  demo: params.has('demo') || (import.meta as any).env?.VITE_DEMO === '1',
};

class Main implements App {
  save: SaveData;
  isDesktop = !!(window as any).hueNative;
  renderer: Renderer;
  ui: UI;
  run: Run | null = null;
  game: Game | null = null;
  attract: Game | null = null;
  bot = new Bot();
  private last = performance.now();
  private paused = false;
  private modalQueue: (() => void)[] = [];
  private modalOpen = false;

  constructor() {
    setLang(detectLang());
    this.save = loadSave(detectLang());
    setLang(this.save.settings.lang);
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    this.renderer = new Renderer(canvas);
    this.ui = new UI(document.getElementById('ui')!, this);
    input.attach(document.getElementById('app')!);
    const unlockAudio = () => {
      audio.init();
      this.applySettings();
      audio.playMusic(this.game ? this.game.biome.music : 'menu');
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('gamepadconnected', unlockAudio);
    window.addEventListener('beforeunload', () => writeSave(this.save, true));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.game && !this.ui.blocking && !this.game.over) this.pause();
    });
    if (DEBUG.autostart || DEBUG.bot) {
      this.startRun('journey', DEBUG.char ?? 'pip', DEBUG.varnish);
    } else this.toTitle();
    requestAnimationFrame((t0) => this.frame(t0));
  }

  // ------------------------------------------------------------------ App API
  persist() {
    writeSave(this.save);
  }
  applySettings() {
    const s = this.save.settings;
    audio.setVolumes(s.master, s.music, s.sfx);
    setLang(s.lang);
  }
  wipe() {
    wipeSave();
    this.save = freshSave(this.save.settings.lang);
    this.ui.app = this;
    this.persist();
    this.toTitle();
  }
  quit() {
    writeSave(this.save, true);
    (window as any).hueNative?.quit?.();
  }
  dailyChar() {
    const seed = seedFromString('hue-daily-' + todayKey());
    return CHARS[seed % CHARS.length].id;
  }

  toTitle() {
    this.game = null;
    this.run = null;
    this.paused = false;
    this.modalQueue = [];
    this.modalOpen = false;
    audio.fuseStop();
    this.startAttract();
    this.ui.title();
    audio.playMusic('menu');
    this.renderer.hudVisible = false;
  }

  private startAttract() {
    const ids = CHARS.map((c) => c.id);
    const run = new Run(this.save, ids[Math.floor(Math.random() * ids.length)], 0, 'journey', (Math.random() * 1e9) | 0);
    run.stageIdx = Math.floor(Math.random() * 3);
    run.stageOrder = ['meadows', 'marsh', 'ruins', 'ember', 'hollow'];
    run.stageIdx = Math.floor(Math.random() * 5);
    const g = new Game(run, {
      levelUp: (cards) => { run.applyCard(cards[0]); },
      stageClear: () => this.startAttract(),
      gameOver: () => this.startAttract(),
      announce: () => {},
      achievement: () => {},
    });
    g.hp = 99999;
    run.s.maxHp = 99999;
    // give the demo a little power so it looks lively
    for (let k = 0; k < 8; k++) run.applyCard(run.offer(1)[0]);
    run.s.maxHp = 99999;
    g.hp = 99999;
    this.attract = g;
    this.renderer.attach(g);
    this.renderer.hudVisible = false;
  }

  startRun(mode: Mode, charId: string, varnish: number) {
    const seed = mode === 'daily' ? seedFromString('hue-daily-' + todayKey()) : DEBUG.seed ? seedFromString(DEBUG.seed) : (Math.random() * 2 ** 31) | 0;
    this.attract = null;
    this.run = new Run(this.save, charId, varnish, mode, seed);
    if (DEBUG.stage > 0) this.run.stageIdx = Math.min(4, DEBUG.stage - 1);
    if (DEBUG.biome) this.run.stageOrder[this.run.stageIdx] = DEBUG.biome;
    for (let k = 0; k < DEBUG.level; k++) {
      this.run.level++;
      this.run.applyCard(this.run.offer(3)[0]);
    }
    for (let k = 0; k < DEBUG.relics; k++) {
      const r = this.run.relicOffer(1)[0];
      if (r) this.run.addRelic(r);
    }
    this.save.stats.runs; // counted at finish
    const tutorial = !this.save.tutorialDone && mode === 'journey' && !DEBUG.bot;
    this.newStage(tutorial);
    this.ui.popAll();
    this.renderer.hudVisible = !DEBUG.nohud;
  }

  private hooks(): GameHooks {
    return {
      levelUp: (cards, kind) => this.queueModal(() => this.showLevelUp(cards, kind)),
      stageClear: () => this.queueModal(() => this.onStageClear()),
      gameOver: (victory) => this.queueModal(() => this.onGameOver(victory)),
      announce: (text, sub, color) => this.renderer.announce(text, sub, color),
      achievement: (id) => {
        if (grantAchievement(this.save, id)) {
          this.ui.achievementToast(id);
          this.persist();
        }
      },
    };
  }

  private newStage(tutorial = false, prevHp?: number) {
    const run = this.run!;
    const g = new Game(run, this.hooks(), tutorial);
    if (prevHp !== undefined) g.hp = Math.min(run.s.maxHp, prevHp + (run.s.maxHp - prevHp) * 0.5);
    if (DEBUG.time) g.time = DEBUG.time;
    if (DEBUG.goal) g.goal = DEBUG.goal;
    if (DEBUG.fill) {
      const cells = g.grid.claimDisc(g.px / 10, g.py / 10, DEBUG.fill);
      g.pushReveal(cells, cells.map(() => 0), 60);
    }
    this.game = g;
    this.renderer.attach(g);
    audio.playMusic(g.biome.music);
    const goalPct = Math.round(g.goal * 100);
    this.renderer.announce(tr(g.biome.name), tr(g.biome.mechanic), g.biome.pal.edge);
    setTimeout(() => this.game === g && this.renderer.announce(t('GOAL_HINT', { p: goalPct }), '', '#ffffff'), 1600);
    const an = g.anomaly;
    if (an) setTimeout(() => this.game === g && this.renderer.announce('⚠ ' + tr(an.name), tr(an.desc), an.color), 3400);
  }

  // ------------------------------------------------------------------ modals
  private queueModal(fn: () => void) {
    this.modalQueue.push(fn);
    this.pumpModals();
  }
  private pumpModals() {
    if (this.modalOpen || !this.modalQueue.length) return;
    this.modalOpen = true;
    const fn = this.modalQueue.shift()!;
    fn();
  }
  private modalDone() {
    this.modalOpen = false;
    this.pumpModals();
  }

  private showLevelUp(cards: Card[], kind: 'level' | 'chest') {
    const run = this.run!;
    if (DEBUG.bot) {
      this.applyPick(cards[0]);
      this.modalDone();
      return;
    }
    this.ui.levelUp(run, cards, kind, (card) => {
      this.applyPick(card);
      this.modalDone();
    });
  }

  private applyPick(card: Card) {
    const run = this.run!;
    const g = this.game!;
    const before = run.s.maxHp;
    const res = run.applyCard(card);
    if (res.healFrac) g.heal(run.s.maxHp * res.healFrac);
    if (run.s.maxHp > before) g.hp += run.s.maxHp - before;
    g.guardLeft = Math.min(g.guardLeft, run.s.guard);
    if (card.kind === 'evo') {
      g.flash = 0.4;
      this.hooks().achievement('EVOLVE');
      for (const id of checkLifetimeAchievements(this.save)) this.ui.achievementToast(id);
    }
  }

  private onStageClear() {
    const run = this.run!;
    const g = this.game!;
    const conds = [true, run.varnish >= 3, g.time < 300, g.stageMaxLoopCaptures >= 60, g.stageSnaps === 0];
    const newStars = run.mode === 'daily' ? [] : awardStars(this.save, g.biome.id, conds);
    for (const id of checkLifetimeAchievements(this.save)) this.ui.achievementToast(id);
    for (const c of checkCharUnlocks(this.save)) this.ui.toast(t('CHAR_UNLOCKED', { c: CHARS.find((x) => x.id === c)!.name }), '', 'star', '#ffd166');
    if (g.percent >= 0.9) this.hooks().achievement('STAGE_90');
    this.persist();
    const finalStage = run.isFinalStage && run.mode !== 'endless';
    if (finalStage) {
      this.modalDone();
      this.onGameOver(true, newStars);
      return;
    }
    if (DEBUG.demo && run.stageIdx >= 0) {
      this.modalDone();
      this.onGameOver(true, newStars);
      return;
    }
    let nextIdx = run.stageIdx + 1;
    let nextBiome = run.stageOrder[nextIdx % 5];
    if (run.mode === 'endless' && nextIdx >= 5) nextBiome = run.stageOrder[0];
    const relics = run.relicOffer(3);
    const proceed = (id: string | null) => {
      if (id) run.addRelic(id);
      run.stageIdx++;
      if (run.mode === 'endless' && run.stageIdx >= 5) {
        run.stageIdx = 0;
        run.cycle++;
        run.rng.shuffle(run.stageOrder.splice(1, 3)).forEach((b, i) => run.stageOrder.splice(1 + i, 0, b));
        if (run.cycle >= 1) this.hooks().achievement('ENDLESS_2');
      }
      if (run.has('dice')) run.rerolls += 2;
      const hp = g.hp;
      this.newStage(false, hp);
      this.modalDone();
    };
    if (DEBUG.bot) return proceed(relics[0] ?? null);
    this.ui.stageClear(run, newStars, relics, nextBiome, proceed);
    void nextIdx;
  }

  private onGameOver(victory: boolean, _stars: number[] = []) {
    const run = this.run!;
    const dailyKey = run.mode === 'daily' ? todayKey() : undefined;
    const sum = finishRun(this.save, run, victory, dailyKey);
    if (!this.save.tutorialDone) this.save.tutorialDone = true;
    writeSave(this.save, true);
    for (const id of sum.achievements) this.ui.achievementToast(id);
    const mode = run.mode, char = run.char.id, varnish = run.varnish;
    audio.playMusic('menu');
    audio.fuseStop();
    this.renderer.hudVisible = false;
    if (DEBUG.bot) {
      (window as any).__lastResult = { victory, stats: run.stats, level: run.level, stage: run.stageIdx };
      console.log('RUN_END', JSON.stringify((window as any).__lastResult));
      this.modalDone();
      return;
    }
    this.ui.results(run, sum, () => this.startRun(mode, mode === 'daily' ? this.dailyChar() : char, varnish));
    this.modalDone();
  }

  pause() {
    if (!this.game || this.paused || this.ui.blocking) return;
    this.paused = true;
    audio.fuseStop();
    this.ui.pause(this.run!);
  }
  resume() {
    this.paused = false;
    if (this.game && this.game.fuse >= 0) audio.fuseStart();
  }
  abandon() {
    const g = this.game;
    this.paused = false;
    if (!g) return this.toTitle();
    g.over = true;
    this.onGameOver(false);
  }

  // ------------------------------------------------------------------ loop
  private frame(now: number) {
    requestAnimationFrame((t0) => this.frame(t0));
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (dt <= 0) dt = 1 / 60;
    input.poll(dt);
    const uiActive = this.ui.update();
    const g = this.game ?? this.attract;
    if (g) {
      const blocked = this.ui.blocking || this.paused;
      if (this.game && !blocked && !uiActive && input.pausePressed() && !g.over) this.pause();
      else if (this.game && !blocked && input.pausePressed() && !g.over) this.pause();
      if (!blocked) {
        const speed = this.game ? this.save.settings.gameSpeed : 1;
        const steps = this.game ? DEBUG.fast : 1;
        for (let k = 0; k < steps && !this.ui.blocking && !this.modalOpen; k++) {
          if (g === this.attract || DEBUG.bot) {
            g.botMove = this.bot.update(g, dt);
            if (DEBUG.god) g.hp = g.run.s.maxHp;
          }
          g.update(dt * speed);
        }
      }
      this.renderer.render(g, blocked ? 0 : dt);
    }
    input.endFrame();
  }
}

// global error surface for players (and tests)
window.addEventListener('error', (e) => console.error('ERR', e.message));
const main = new Main();
(window as any).__hue = main;
void BIOMES;
void CHALLENGES;
