// DOM menus & overlays with full keyboard / gamepad / mouse navigation.
import { audio } from '../core/audio';
import { getLang, t, tr } from '../core/i18n';
import { input, type NavDir } from '../core/input';
import { fmtNum, fmtTime } from '../core/math';
import { PRIMARY, SECONDARY, type PigmentKey, type SaveData } from '../core/storage';
import {
  ACHIEVEMENTS, ATELIER, BIOMES, CHALLENGES, CHARS, ENEMIES, PASSIVES, RELICS, VARNISH, WEAPONS,
  type CharDef, type Cost,
} from '../data/content';
import { atelierCost, buyAtelier, canAfford, mix, pay, starBonus, starCount, STAR_TOTAL, todayKey, type RunSummary } from '../game/meta';
import { Run, type Mode } from '../game/run';
import type { Card } from '../game/types';
import { iconSvg } from '../render/icons';

export interface App {
  save: SaveData;
  isDesktop: boolean;
  startRun(mode: Mode, charId: string, varnish: number): void;
  resume(): void;
  abandon(): void;
  toTitle(): void;
  quit(): void;
  persist(): void;
  applySettings(): void;
  wipe(): void;
  dailyChar(): string;
}

interface Screen {
  el: HTMLElement;
  onBack?: () => void;
  onTab?: (d: number) => void;
  onKey?: () => void;
  modal: boolean; // blocks the game
  openedAt: number;
}

export const PIG_COL: Record<PigmentKey, string> = {
  crimson: '#ef233c', azure: '#3a86ff', ochre: '#ffb627', violet: '#9b5de5', verdant: '#38b000', amber: '#fb8500',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function fmtVal(v: number, fmt: 'pct' | 'flat' | 'int') {
  if (fmt === 'pct') return `${Math.round(v * 100)}%`;
  if (fmt === 'flat') return `${Math.round(v * 10) / 10}`;
  return `${v}`;
}

export function charSvg(c: CharDef, size = 96) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <ellipse cx="50" cy="88" rx="26" ry="7" fill="rgba(0,0,0,.35)"/>
    <line x1="58" y1="62" x2="88" y2="30" stroke="#8d5524" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="90" cy="26" rx="10" ry="6" transform="rotate(-45 90 26)" fill="${c.color2}"/>
    <circle cx="48" cy="58" r="28" fill="#1b1a22"/>
    <circle cx="48" cy="58" r="24" fill="#fff8e7"/>
    <path d="M22 52 Q24 26 50 24 Q76 26 76 50 Z" fill="${c.color}"/>
    <circle cx="28" cy="30" r="8" fill="${c.color}"/>
    <circle cx="44" cy="60" r="3.6" fill="#1b1a22"/><circle cx="58" cy="60" r="3.6" fill="#1b1a22"/>
    <path d="M44 70 Q51 75 58 70" stroke="#1b1a22" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function costHtml(save: SaveData, cost: Cost) {
  return `<span class="cost">${(Object.entries(cost) as [PigmentKey, number][])
    .map(([k, v]) => `<span class="${save.pigments[k] >= v ? '' : 'no'}"><i class="dot" style="background:${PIG_COL[k]}"></i>${v}</span>`)
    .join('')}</span>`;
}

function walletHtml(save: SaveData) {
  return `<div class="wallet">${[...PRIMARY, ...SECONDARY]
    .map((k) => `<span title="${t(('PIG_' + k) as 'PIG_crimson')}"><i class="dot" style="background:${PIG_COL[k]}"></i>${t(('PIG_' + k) as 'PIG_crimson')} ${fmtNum(save.pigments[k])}</span>`)
    .join('')}</div>`;
}

export class UI {
  root: HTMLElement;
  app: App;
  private stack: Screen[] = [];
  private focusEl: HTMLElement | null = null;
  private toasts: HTMLElement;
  private selectedChar = 'pip';
  private varnish = 0;

  constructor(root: HTMLElement, app: App) {
    this.root = root;
    this.app = app;
    this.toasts = document.createElement('div');
    this.toasts.id = 'toasts';
    document.getElementById('app')!.appendChild(this.toasts);
    this.selectedChar = app.save.lastChar;
    this.varnish = app.save.lastVarnish;
  }

  get active(): Screen | null {
    return this.stack[this.stack.length - 1] ?? null;
  }
  get blocking() {
    return this.stack.some((s) => s.modal);
  }
  get open() {
    return this.stack.length > 0;
  }

  // ------------------------------------------------------------------ core
  private push(html: string, opts: { cls?: string; onBack?: () => void; onTab?: (d: number) => void; modal?: boolean; replace?: boolean; onKey?: () => void } = {}) {
    if (opts.replace) this.popAll();
    const el = document.createElement('div');
    el.className = 'screen ' + (opts.cls ?? 'dim');
    el.innerHTML = html;
    for (const s of this.stack) s.el.style.display = 'none';
    this.root.appendChild(el);
    const scr: Screen = { el, onBack: opts.onBack, onTab: opts.onTab, onKey: opts.onKey, modal: opts.modal ?? true, openedAt: performance.now() };
    this.stack.push(scr);
    this.bindFocus(el);
    this.autoFocus(el);
    return el;
  }

  pop() {
    const s = this.stack.pop();
    s?.el.remove();
    const top = this.active;
    if (top) {
      top.el.style.display = '';
      this.autoFocus(top.el);
    }
    this.focusEl = top ? this.focusEl : null;
  }

  popAll() {
    while (this.stack.length) this.stack.pop()!.el.remove();
    this.focusEl = null;
  }

  private bindFocus(el: HTMLElement) {
    el.querySelectorAll<HTMLElement>('.f').forEach((f) => {
      f.addEventListener('mouseenter', () => this.setFocus(f, false));
      if (!f.hasAttribute('tabindex')) f.tabIndex = -1;
    });
  }

  private autoFocus(el: HTMLElement) {
    const f = el.querySelector<HTMLElement>('.f[data-auto]') ?? el.querySelector<HTMLElement>('.f:not(.disabled)') ?? el.querySelector<HTMLElement>('.f');
    if (f) this.setFocus(f, false);
  }

  private setFocus(f: HTMLElement, sound = true) {
    if (this.focusEl === f) return;
    this.focusEl?.classList.remove('focus');
    this.focusEl = f;
    f.classList.add('focus');
    if (sound) audio.uiMove();
    f.scrollIntoView?.({ block: 'nearest' });
  }

  private move(dir: NavDir) {
    const scr = this.active;
    if (!scr) return;
    const cur = this.focusEl;
    if (cur && cur.dataset.adjust && (dir === 'left' || dir === 'right')) {
      cur.dispatchEvent(new CustomEvent('adjust', { detail: dir === 'left' ? -1 : 1 }));
      return;
    }
    const all = [...scr.el.querySelectorAll<HTMLElement>('.f')].filter((e) => e.offsetParent !== null);
    if (!cur || !all.includes(cur)) {
      if (all[0]) this.setFocus(all[0]);
      return;
    }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best: HTMLElement | null = null, bestScore = Infinity;
    for (const e of all) {
      if (e === cur) continue;
      const b = e.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const dx = bx - ax, dy = by - ay;
      let main = 0, cross = 0;
      if (dir === 'left') { main = -dx; cross = Math.abs(dy); }
      if (dir === 'right') { main = dx; cross = Math.abs(dy); }
      if (dir === 'up') { main = -dy; cross = Math.abs(dx); }
      if (dir === 'down') { main = dy; cross = Math.abs(dx); }
      if (main <= 4) continue;
      const score = main + cross * 2.2;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (best) this.setFocus(best);
  }

  /** Per-frame input processing. Returns true when UI consumed input. */
  update() {
    const scr = this.active;
    if (!scr) return false;
    const grace = performance.now() - scr.openedAt < 380;
    for (const d of input.navEvents()) this.move(d);
    if (!grace && input.confirmPressed() && this.focusEl && !this.focusEl.classList.contains('disabled')) {
      this.focusEl.click();
    } else if (!grace && input.backPressed() && scr.onBack) {
      audio.uiBack();
      scr.onBack();
    } else if (scr.onTab && input.tabLeftPressed()) scr.onTab(-1);
    else if (scr.onTab && input.tabRightPressed()) scr.onTab(1);
    else if (!grace && scr.onKey) scr.onKey();
    return true;
  }

  toast(title: string, name: string, icon = 'trophy', color = '#ffd166') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div style="color:${color}">${iconSvg(icon, color, 30)}</div><div><div class="t">${esc(title)}</div><div class="n">${esc(name)}</div></div>`;
    this.toasts.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4100);
  }

  achievementToast(id: string) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) this.toast(t('ACH_UNLOCKED'), tr(a.name), 'trophy');
  }

  // ------------------------------------------------------------------ title
  title() {
    const s = this.app.save;
    const html = `
      <div class="logo">
        <div class="word"><span class="hue"><span>H</span><span>U</span><span>E</span></span><span class="amp">&amp;</span><span class="claim">CLAIM</span></div>
        <div class="tag">${t('TAGLINE')}</div>
      </div>
      <div class="menu">
        <button class="btn primary f" data-auto data-a="play">${iconSvg('play')}${t('PLAY')}</button>
        <button class="btn f" data-a="atelier">${iconSvg('palette')}${t('ATELIER')}</button>
        <button class="btn f" data-a="atlas">${iconSvg('map')}${t('ATLAS')} <small style="opacity:.7">★ ${starCount(s)}/${STAR_TOTAL}</small></button>
        <button class="btn f" data-a="codex">${iconSvg('book')}${t('CODEX')}</button>
        <button class="btn f" data-a="settings">${iconSvg('gear')}${t('SETTINGS')}</button>
        ${this.app.isDesktop ? `<button class="btn f" data-a="quit">${iconSvg('exit')}${t('QUIT')}</button>` : ''}
      </div>
      <div class="corner">v1.0.0 · ${t('CONTROLS_TEXT')}</div>`;
    const el = this.push(html, { cls: 'dim', replace: true, modal: false });
    el.style.background = 'radial-gradient(ellipse at center, rgba(11,10,16,.25), rgba(11,10,16,.85))';
    el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        audio.select();
        const a = b.dataset.a;
        if (a === 'play') this.modeSelect();
        if (a === 'atelier') this.atelier(0);
        if (a === 'atlas') this.atlas();
        if (a === 'codex') this.codex(0);
        if (a === 'settings') this.settings();
        if (a === 'quit') this.app.quit();
      }),
    );
  }

  // ------------------------------------------------------------------ mode & character
  modeSelect() {
    const s = this.app.save;
    const endless = s.stats.wins > 0;
    const daily = s.daily.date === todayKey() ? s.daily.best : 0;
    const html = `
      <h2>${t('MODE_TITLE')}</h2>
      <div class="cards">
        <div class="card f r1" data-m="journey" data-auto><div class="ic" style="color:#06d6a0">${iconSvg('map', '#06d6a0', 34)}</div>
          <div class="name">${t('MODE_JOURNEY')}</div><div class="desc">${t('MODE_JOURNEY_DESC')}</div></div>
        <div class="card f r2 ${endless ? '' : 'locked disabled'}" data-m="endless"><div class="ic" style="color:#c77dff">${iconSvg(endless ? 'orbit' : 'lock', '#c77dff', 34)}</div>
          <div class="name">${t('MODE_ENDLESS')}</div><div class="desc">${endless ? t('MODE_ENDLESS_DESC') : t('MODE_ENDLESS_LOCK')}</div></div>
        <div class="card f r3" data-m="daily"><div class="ic" style="color:#ffd166">${iconSvg('sun', '#ffd166', 34)}</div>
          <div class="name">${t('MODE_DAILY')}</div><div class="desc">${t('MODE_DAILY_DESC')}</div>
          <div class="rar">${todayKey()} · ${t('DAILY_BEST', { v: fmtNum(daily) })}</div></div>
      </div>
      <div class="spacer"></div>
      <button class="btn f small" data-back>${t('BACK')}</button>`;
    const el = this.push(html, { onBack: () => this.pop(), modal: false });
    el.querySelectorAll<HTMLElement>('[data-m]').forEach((c) =>
      c.addEventListener('click', () => {
        if (c.classList.contains('disabled')) return audio.deny();
        audio.select();
        const m = c.dataset.m as Mode;
        if (m === 'daily') {
          this.popAll();
          this.app.startRun('daily', this.app.dailyChar(), 2);
        } else this.charSelect(m);
      }),
    );
    el.querySelector('[data-back]')!.addEventListener('click', () => this.pop());
  }

  charSelect(mode: Mode) {
    const s = this.app.save;
    if (!s.unlocked.chars.includes(this.selectedChar)) this.selectedChar = 'pip';
    this.varnish = Math.min(this.varnish, s.varnishUnlocked);
    const render = () => {
      const cards = CHARS.map((c) => {
        const locked = !s.unlocked.chars.includes(c.id);
        const w = WEAPONS.find((x) => x.id === c.weapon)!;
        const sel = c.id === this.selectedChar;
        return `<div class="card char f ${locked ? 'locked' : ''} ${sel ? 'r3' : ''}" data-c="${c.id}" ${sel ? 'data-auto' : ''}>
          <div class="portrait">${charSvg(c)}</div>
          <div class="name" style="color:${c.color}">${c.name}</div>
          <div class="tag">${tr(c.title)}</div>
          ${locked ? `<div class="desc">${iconSvg('lock', '#fff', 18)}<br>${tr(c.unlock)}</div>` : `
          <div class="desc">${tr(c.desc)}</div>
          <div class="stats"><span>${t('HP')}</span><b>${c.hp}</b><span>${t('SPEED')}</span><b>${c.speed}</b><span>${t('WEAPON')}</span><b>${tr(w.name)}</b></div>
          <div class="sp"><b>${tr(c.special.name)}</b> — ${tr(c.special.desc)}</div>`}
        </div>`;
      }).join('');
      const v = this.varnish;
      return `
        <h2>${t('CHOOSE_PAINTER')}</h2>
        <div class="cards">${cards}</div>
        <div class="spacer"></div>
        <div class="setting f panel" data-adjust="1" style="min-width:min(560px,90vw)">
          <div><b>${t('VARNISH')} ${v}</b><div class="hint" style="text-align:left;margin:2px 0 0">${tr(VARNISH[v])}${v > 0 ? ' · +' + v * 15 + '% ' + t('PIG_ochre').toLowerCase() : ''}</div></div>
          <div class="val"><button data-v="-1">◀</button><span>${v} / ${s.varnishUnlocked}</span><button data-v="1">▶</button></div>
        </div>
        <div class="hint">${s.varnishUnlocked < 10 ? t('VARNISH_LOCKED', { v: s.varnishUnlocked }) : t('VARNISH_HINT')}</div>
        <div class="spacer"></div>
        <div class="row">
          <button class="btn f small" data-back>${t('BACK')}</button>
          <button class="btn primary f" data-start>${iconSvg('play')}${t('START')}</button>
        </div>`;
    };
    const el = this.push(render(), { onBack: () => this.pop(), modal: false });
    const rebind = (focusSel?: string) => {
      el.innerHTML = render();
      this.bindFocus(el);
      const f = focusSel ? el.querySelector<HTMLElement>(focusSel) : null;
      if (f) { this.focusEl = null; this.setFocus(f, false); } else this.autoFocus(el);
      el.querySelectorAll<HTMLElement>('[data-c]').forEach((c) =>
        c.addEventListener('click', () => {
          if (!s.unlocked.chars.includes(c.dataset.c!)) return audio.deny();
          const again = this.selectedChar === c.dataset.c;
          this.selectedChar = c.dataset.c!;
          audio.select();
          if (again) return start();
          rebind('[data-start]');
        }),
      );
      const adj = el.querySelector<HTMLElement>('[data-adjust]')!;
      const change = (d: number) => {
        const nv = Math.max(0, Math.min(s.varnishUnlocked, this.varnish + d));
        if (nv === this.varnish) return audio.deny();
        this.varnish = nv;
        audio.uiMove();
        rebind('[data-adjust]');
      };
      adj.addEventListener('adjust', (e) => change((e as CustomEvent).detail));
      adj.querySelectorAll<HTMLElement>('[data-v]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); change(Number(b.dataset.v)); }));
      el.querySelector('[data-back]')!.addEventListener('click', () => this.pop());
      el.querySelector('[data-start]')!.addEventListener('click', start);
    };
    const start = () => {
      audio.select();
      s.lastChar = this.selectedChar;
      s.lastVarnish = this.varnish;
      this.app.persist();
      this.popAll();
      this.app.startRun(mode, this.selectedChar, this.varnish);
    };
    rebind();
  }

  // ------------------------------------------------------------------ level-up
  private cardHtml(card: Card, run: Run) {
    let icon = 'star', color = '#fff', tag = '', name = '', lvl = '', desc = '', extra = '';
    const rar = card.rarity;
    switch (card.kind) {
      case 'weapon': {
        const d = WEAPONS.find((w) => w.id === card.id)!;
        icon = d.icon; color = d.color; tag = t('WEAPON_TAG'); name = tr(d.name); desc = tr(d.desc);
        const cur = run.weapon(card.id)?.level ?? 0;
        const inc = rar >= 2 ? 2 : 1;
        lvl = card.isNew ? t('NEW') : t('LEVEL_N', { n: Math.min(5, cur + inc) }) + (rar >= 2 ? ` · ${t('EPIC_WEAPON')}` : '');
        extra = `<div class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= cur ? 'on' : i <= cur + inc ? 'new' : ''}"></i>`).join('')}</div>`;
        const p = PASSIVES.find((x) => x.id === d.evo.passive)!;
        desc += `<br><small style="opacity:.65">${t('REQUIRES', { p: tr(p.name) })}</small>`;
        break;
      }
      case 'passive': {
        const d = PASSIVES.find((p) => p.id === card.id)!;
        icon = d.icon; color = d.color; tag = t('PASSIVE_TAG'); name = tr(d.name);
        desc = tr(d.desc, { v: fmtVal(Run.passiveAmount(card.id, rar), d.fmt) });
        const cur = run.pl(card.id);
        lvl = card.isNew ? t('NEW') : t('LEVEL_N', { n: cur + 1 });
        extra = `<div class="pips">${Array.from({ length: d.max }, (_, i) => `<i class="${i < cur ? 'on' : i === cur ? 'new' : ''}"></i>`).join('')}</div>`;
        break;
      }
      case 'evo': {
        const d = WEAPONS.find((w) => w.id === card.id)!;
        icon = d.icon; color = '#ffd166'; tag = t('EVOLUTION'); name = tr(d.evo.name); desc = tr(d.evo.desc); lvl = tr(d.name) + ' ★';
        break;
      }
      case 'heal':
        icon = 'heart'; color = '#ff5d8f'; tag = ''; name = t('HEAL_CARD'); desc = t('HEAL_DESC');
        break;
      case 'pigment':
        icon = 'coin'; color = '#ffb627'; tag = ''; name = t('PIGMENT_CARD'); desc = t('PIGMENT_DESC');
        break;
    }
    const rarLabel = card.kind === 'evo' ? t('RARITY_3') : card.kind === 'weapon' || card.kind === 'passive' ? t(('RARITY_' + rar) as 'RARITY_0') : '';
    return `<div class="ic" style="color:${color}">${iconSvg(icon, color, 34)}</div>
      <div class="tag">${tag}</div><div class="name">${esc(name)}</div><div class="lvl">${lvl}</div>${extra}
      <div class="desc">${desc}</div><div class="rar">${rarLabel}</div>`;
  }

  private buildHtml(run: Run) {
    const ws = run.weapons.map((w) => {
      const d = WEAPONS.find((x) => x.id === w.id)!;
      return `<span title="${esc(tr(d.name))}" style="color:${w.evolved ? '#ffd166' : d.color}">${iconSvg(d.icon, 'currentColor', 20)}<small>${w.evolved ? '★' : w.level}</small></span>`;
    });
    const ps = [...run.passives].map(([id, v]) => {
      const d = PASSIVES.find((x) => x.id === id)!;
      return `<span title="${esc(tr(d.name))}" style="color:${d.color}">${iconSvg(d.icon, 'currentColor', 18)}<small>${v.level}</small></span>`;
    });
    const rs = run.relics.map((id) => {
      const d = RELICS.find((x) => x.id === id)!;
      return `<span title="${esc(tr(d.name))}: ${esc(tr(d.desc))}" style="color:${d.color}">${iconSvg(d.icon, 'currentColor', 18)}</span>`;
    });
    return `<div class="row" style="gap:10px;opacity:.9">${[...ws, ...ps, ...rs].join('')}</div>`;
  }

  levelUp(run: Run, cards: Card[], kind: 'level' | 'chest', onPick: (c: Card) => void) {
    let banishing = false;
    let current = cards;
    const render = () => `
      <h2>${kind === 'chest' ? t('TREASURE') : t('LEVEL_UP')}</h2>
      <p class="sub">${banishing ? t('BANISH_MODE') : t('CHOOSE_ONE')}</p>
      <div class="cards ${banishing ? 'banishing' : ''}">${current.map((c, i) => `<div class="card f r${c.kind === 'evo' ? 3 : c.rarity} ${banishing ? 'banish' : ''}" data-i="${i}" ${i === 0 ? 'data-auto' : ''}><span class="key">${i + 1}</span>${this.cardHtml(c, run)}</div>`).join('')}</div>
      <div class="spacer"></div>
      <div class="row">
        <button class="btn small f ${run.rerolls > 0 ? '' : 'disabled'}" data-reroll>${iconSvg('dice', 'currentColor', 18)}${t('REROLL', { n: run.rerolls })} <span class="kbd">R</span></button>
        <button class="btn small f ${run.banishes > 0 ? '' : 'disabled'}" data-banish>${iconSvg('cross', 'currentColor', 18)}${t('BANISH', { n: run.banishes })} <span class="kbd">B</span></button>
      </div>
      <div class="spacer"></div>
      ${this.buildHtml(run)}`;
    const el = this.push(render(), { modal: true });
    audio.muffle(true);
    const reroll = () => {
      if (run.rerolls <= 0) return audio.deny();
      run.rerolls--;
      audio.select();
      current = run.offer(current.length, kind === 'chest' ? 1 : 0);
      bind();
    };
    const toggleBanish = () => {
      if (run.banishes <= 0) return audio.deny();
      banishing = !banishing;
      audio.uiMove();
      bind();
    };
    const bind = () => {
      el.innerHTML = render();
      this.bindFocus(el);
      this.focusEl = null;
      this.autoFocus(el);
      el.querySelectorAll<HTMLElement>('[data-i]').forEach((c) =>
        c.addEventListener('click', () => {
          if (performance.now() - this.active!.openedAt < 300) return;
          const card = current[Number(c.dataset.i)];
          if (banishing) {
            if (card.kind === 'heal' || card.kind === 'pigment' || card.kind === 'evo') return audio.deny();
            run.banished.add(card.id);
            run.banishes--;
            banishing = false;
            audio.uiBack();
            current = run.offer(current.length, kind === 'chest' ? 1 : 0);
            bind();
            return;
          }
          audio.select();
          audio.muffle(false);
          this.pop();
          onPick(card);
        }),
      );
      el.querySelector('[data-reroll]')!.addEventListener('click', reroll);
      el.querySelector('[data-banish]')!.addEventListener('click', toggleBanish);
    };
    bind();
    this.active!.onKey = () => {
      if (input.rerollPressed()) reroll();
      else if (input.banishPressed()) toggleBanish();
      for (let k = 1; k <= current.length; k++) {
        if (input.keyPressed('Digit' + k)) (el.querySelector(`[data-i="${k - 1}"]`) as HTMLElement)?.click();
      }
    };
  }

  // ------------------------------------------------------------------ stage clear / relic
  stageClear(run: Run, newStars: number[], relics: string[], nextBiome: string | null, onPick: (id: string | null) => void) {
    const starsHtml = newStars.map((i) => `<div class="unlock">★ ${t('STAR_EARNED', { c: tr(CHALLENGES[i]) })}</div>`).join('');
    const next = nextBiome ? BIOMES.find((b) => b.id === nextBiome)! : null;
    const cards = relics.map((id, i) => {
      const d = RELICS.find((r) => r.id === id)!;
      return `<div class="card f r2" data-r="${id}" ${i === 0 ? 'data-auto' : ''}><div class="ic" style="color:${d.color}">${iconSvg(d.icon, d.color, 34)}</div>
        <div class="tag">Relic</div><div class="name">${esc(tr(d.name))}</div><div class="desc">${tr(d.desc)}</div></div>`;
    }).join('');
    const html = `
      <h2 style="color:#fff3b0">${t('STAGE_CLEAR')}</h2>
      ${starsHtml}
      ${relics.length ? `<p class="sub" style="margin-top:8px">${t('RELIC_SUB')} ${t('CHOOSE_RELIC')}.</p><div class="cards">${cards}</div>` : `<div class="spacer"></div><button class="btn primary f" data-skip data-auto>${t('CONTINUE')}</button>`}
      ${next ? `<div class="spacer"></div><div class="biome panel"><div class="sw" style="background:linear-gradient(135deg,${next.pal.land.join(',')})"></div><div><h3>${t('NEXT_STAGE', { b: tr(next.name) })}</h3><div class="hint" style="text-align:left">${tr(next.mechanic)}</div></div></div>` : ''}
      <div class="spacer"></div>${this.buildHtml(run)}`;
    const el = this.push(html, { modal: true });
    audio.muffle(true);
    el.querySelectorAll<HTMLElement>('[data-r]').forEach((c) =>
      c.addEventListener('click', () => {
        if (performance.now() - this.active!.openedAt < 300) return;
        audio.select();
        audio.muffle(false);
        this.pop();
        onPick(c.dataset.r!);
      }),
    );
    el.querySelector('[data-skip]')?.addEventListener('click', () => {
      audio.muffle(false);
      this.pop();
      onPick(null);
    });
  }

  // ------------------------------------------------------------------ pause
  pause(run: Run) {
    const html = `
      <h2>${t('PAUSED')}</h2>
      <div class="menu">
        <button class="btn primary f" data-auto data-a="resume">${iconSvg('play')}${t('RESUME')}</button>
        <button class="btn f" data-a="settings">${iconSvg('gear')}${t('SETTINGS')}</button>
        <button class="btn f" data-a="abandon">${iconSvg('exit')}${t('ABANDON')}</button>
      </div>
      <div class="spacer"></div>
      <p class="sub">${t('BUILD')}</p>
      ${this.buildHtml(run)}
      <div class="corner">${t('CONTROLS_TEXT')}</div>`;
    const resume = () => {
      audio.muffle(false);
      this.pop();
      this.app.resume();
    };
    const el = this.push(html, { modal: true, onBack: resume });
    audio.muffle(true);
    el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        audio.select();
        if (b.dataset.a === 'resume') resume();
        if (b.dataset.a === 'settings') this.settings();
        if (b.dataset.a === 'abandon') this.confirm(t('CONFIRM_ABANDON'), () => {
          audio.muffle(false);
          this.popAll();
          this.app.abandon();
        });
      }),
    );
  }

  confirm(text: string, onYes: () => void) {
    const html = `<div class="panel" style="text-align:center;max-width:520px"><h3>${esc(text)}</h3><div class="spacer"></div>
      <div class="row"><button class="btn f" data-no data-auto>${t('NO')}</button><button class="btn primary f" data-yes>${t('YES')}</button></div></div>`;
    const el = this.push(html, { modal: true, onBack: () => this.pop() });
    el.querySelector('[data-no]')!.addEventListener('click', () => this.pop());
    el.querySelector('[data-yes]')!.addEventListener('click', () => {
      this.pop();
      onYes();
    });
  }

  // ------------------------------------------------------------------ results
  results(run: Run, sum: RunSummary, onRetry: () => void) {
    const st = run.stats;
    const unlocks: string[] = [];
    if (sum.endlessUnlocked) unlocks.push(t('ENDLESS_UNLOCKED'));
    if (sum.varnishUnlocked !== null) unlocks.push(t('VARNISH_UNLOCKED', { v: sum.varnishUnlocked }));
    for (const c of sum.unlockedChars) unlocks.push(t('CHAR_UNLOCKED', { c: CHARS.find((x) => x.id === c)!.name }));
    const html = `
      <div class="result-title" style="color:${sum.victory ? '#ffd166' : '#adb5bd'};font-weight:700">${sum.victory ? t('VICTORY') : t('DEFEAT')}</div>
      <p class="sub">${sum.victory ? t('VICTORY_SUB') : t('DEFEAT_SUB')}</p>
      <div class="spacer"></div>
      <div class="panel"><div class="stats-table">
        <div>${t('TIME')}</div><div>${fmtTime(st.time)}</div>
        <div>${t('STAGES')}</div><div>${st.stagesCleared}${run.mode === 'endless' ? ` (${t('CYCLE')} ${run.cycle + 1})` : ''}</div>
        <div>${t('LEVEL')}</div><div>${run.level}</div>
        <div>${t('CELLS')}</div><div>${fmtNum(st.cells)}</div>
        <div>${t('CAPTURES')}</div><div>${fmtNum(st.captures)}</div>
        <div>${t('KILLS')}</div><div>${fmtNum(st.kills)}</div>
        <div>${t('BEST_LOOP')}</div><div>×${st.maxLoopCaptures} · ${(st.maxLoopPct * 100).toFixed(1)}%</div>
        <div>${t('BOSSES')}</div><div>${st.bosses}</div>
        <div>${t('SCORE')}</div><div>${fmtNum(sum.score)}${sum.dailyBest ? ' ★' : ''}</div>
      </div></div>
      <div class="spacer"></div>
      <h3>${t('PIGMENTS_EARNED')}</h3>
      <div class="wallet">${(['crimson', 'azure', 'ochre'] as PigmentKey[]).map((k) => `<span><i class="dot" style="background:${PIG_COL[k]}"></i>+${sum.pigments[k as 'crimson']} ${t(('PIG_' + k) as 'PIG_crimson')}</span>`).join('')}</div>
      ${unlocks.map((u) => `<div class="unlock" style="margin-top:6px">✦ ${esc(u)}</div>`).join('')}
      <div class="spacer"></div>
      <div class="row">
        <button class="btn primary f" data-auto data-a="retry">${iconSvg('play')}${t('RETRY')}</button>
        <button class="btn f" data-a="atelier">${iconSvg('palette')}${t('ATELIER')}</button>
        <button class="btn f" data-a="title">${t('TO_TITLE')}</button>
      </div>`;
    const el = this.push(html, { cls: 'dim', replace: true, modal: true });
    el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        audio.select();
        const a = b.dataset.a;
        if (a === 'retry') { this.popAll(); onRetry(); }
        if (a === 'title') this.app.toTitle();
        if (a === 'atelier') { this.app.toTitle(); this.atelier(0); }
      }),
    );
  }

  // ------------------------------------------------------------------ atelier
  atelier(tab: number) {
    const s = this.app.save;
    const tabs = [t('TAB_UPGRADES'), t('TAB_WEAPONS'), t('TAB_RELICS'), t('TAB_MIX')];
    let body = '';
    if (tab === 0) {
      body = ATELIER.map((a) => {
        const lvl = s.atelier[a.id] ?? 0;
        const max = lvl >= a.max;
        const cost = atelierCost(a, lvl);
        const ok = !max && canAfford(s, cost);
        return `<div class="item f ${max ? 'dim' : ''}" data-buy="${a.id}">
          <div class="ic" style="color:#fff3b0">${iconSvg(a.icon, '#fff3b0', 26)}</div>
          <div><div class="t">${tr(a.name)}</div><div class="d">${tr(a.desc, { v: fmtVal(a.per, a.fmt) })}</div>
          <div class="lvbar">${Array.from({ length: a.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
          <div class="c">${max ? t('MAXED') : costHtml(s, cost)}<br><small style="opacity:${ok ? 1 : 0.5}">${max ? '' : t('BUY')}</small></div></div>`;
      }).join('');
    } else if (tab === 1) {
      body = WEAPONS.map((w) => {
        const owned = !w.unlockCost || s.unlocked.weapons.includes(w.id);
        const evoSeen = s.stats.evolutions.includes(w.id);
        return `<div class="item f ${owned ? '' : ''}" data-w="${w.id}">
          <div class="ic" style="color:${w.color}">${iconSvg(w.icon, w.color, 26)}</div>
          <div><div class="t">${tr(w.name)}</div><div class="d">${tr(w.desc)}</div>
          <div class="d" style="color:${evoSeen ? '#ffd166' : ''}">★ ${evoSeen ? tr(w.evo.name) : '???'} (+ ${tr(PASSIVES.find((p) => p.id === w.evo.passive)!.name)})</div></div>
          <div class="c">${owned ? t('OWNED') : costHtml(s, w.unlockCost!) + '<br><small>' + t('UNLOCK') + '</small>'}</div></div>`;
      }).join('');
    } else if (tab === 2) {
      body = RELICS.map((r) => {
        const owned = !r.cost || s.unlocked.relics.includes(r.id);
        return `<div class="item f" data-rel="${r.id}">
          <div class="ic" style="color:${r.color}">${iconSvg(r.icon, r.color, 26)}</div>
          <div><div class="t">${tr(r.name)}</div><div class="d">${tr(r.desc)}</div></div>
          <div class="c">${owned ? t('OWNED') : costHtml(s, r.cost!) + '<br><small>' + t('UNLOCK') + '</small>'}</div></div>`;
      }).join('');
    } else {
      body = (['violet', 'verdant', 'amber'] as PigmentKey[]).map((k) => {
        const rec = { violet: ['crimson', 'azure'], verdant: ['azure', 'ochre'], amber: ['crimson', 'ochre'] }[k as 'violet'] as PigmentKey[];
        return `<div class="item">
          <div class="ic"><i class="dot" style="width:26px;height:26px;background:${PIG_COL[k]}"></i></div>
          <div><div class="t">${t(('PIG_' + k) as 'PIG_violet')}</div><div class="d">5 ${t(('PIG_' + rec[0]) as 'PIG_crimson')} + 5 ${t(('PIG_' + rec[1]) as 'PIG_crimson')} → 2</div></div>
          <div class="c row" style="gap:6px"><button class="btn small f" data-mix="${k}" data-n="1">${t('MIX_BTN')}</button><button class="btn small f" data-mix="${k}" data-n="10">${t('MIX_MAX')}</button></div></div>`;
      }).join('') + `<p class="hint" style="grid-column:1/-1">${t('MIX_DESC')}<br>${t('PIG_SOURCES')}</p>`;
    }
    const html = `
      <h2>${t('ATELIER_TITLE')}</h2>
      <p class="sub">${t('ATELIER_SUB')}</p>
      ${walletHtml(s)}
      <div class="tabs">${tabs.map((n, i) => `<button class="tab f ${i === tab ? 'on' : ''}" data-tab="${i}">${n}</button>`).join('')}</div>
      <div class="panel wide"><div class="grid">${body}</div></div>
      <div class="hint">${t('TAB_HINT')}</div>
      <div class="spacer"></div>
      <button class="btn f small" data-back>${t('BACK')}</button>`;
    const prevFocus = this.focusEl?.dataset;
    if (this.active?.el.dataset.screen === 'atelier') this.pop();
    const el = this.push(html, { cls: 'solid', modal: false, onBack: () => this.pop(), onTab: (d) => this.atelier((tab + d + 4) % 4) });
    el.dataset.screen = 'atelier';
    const refocus = (sel: string) => {
      const f = el.querySelector<HTMLElement>(sel);
      if (f) { this.focusEl = null; this.setFocus(f, false); }
    };
    if (prevFocus) {
      if (prevFocus.buy) refocus(`[data-buy="${prevFocus.buy}"]`);
      else if (prevFocus.w) refocus(`[data-w="${prevFocus.w}"]`);
      else if (prevFocus.rel) refocus(`[data-rel="${prevFocus.rel}"]`);
      else if (prevFocus.mix) refocus(`[data-mix="${prevFocus.mix}"][data-n="${prevFocus.n}"]`);
      else if (prevFocus.tab) refocus(`[data-tab="${tab}"]`);
    }
    el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { audio.uiMove(); this.atelier(Number(b.dataset.tab)); }));
    el.querySelector('[data-back]')!.addEventListener('click', () => this.pop());
    el.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        if (buyAtelier(s, b.dataset.buy!)) {
          audio.levelUp();
          this.app.persist();
          this.atelier(tab);
        } else audio.deny();
      }),
    );
    el.querySelectorAll<HTMLElement>('[data-w]').forEach((b) =>
      b.addEventListener('click', () => {
        const w = WEAPONS.find((x) => x.id === b.dataset.w)!;
        if (!w.unlockCost || s.unlocked.weapons.includes(w.id)) return;
        if (!canAfford(s, w.unlockCost)) return audio.deny();
        pay(s, w.unlockCost);
        s.unlocked.weapons.push(w.id);
        s.stats.atelierBought++;
        audio.levelUp();
        this.app.persist();
        this.atelier(tab);
      }),
    );
    el.querySelectorAll<HTMLElement>('[data-rel]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = RELICS.find((x) => x.id === b.dataset.rel)!;
        if (!r.cost || s.unlocked.relics.includes(r.id)) return;
        if (!canAfford(s, r.cost)) return audio.deny();
        pay(s, r.cost);
        s.unlocked.relics.push(r.id);
        s.stats.atelierBought++;
        audio.levelUp();
        this.app.persist();
        this.atelier(tab);
      }),
    );
    el.querySelectorAll<HTMLElement>('[data-mix]').forEach((b) =>
      b.addEventListener('click', () => {
        const n = mix(s, b.dataset.mix as PigmentKey, Number(b.dataset.n));
        if (n > 0) {
          audio.pigment();
          this.app.persist();
          this.atelier(tab);
        } else audio.deny();
      }),
    );
  }

  // ------------------------------------------------------------------ atlas
  atlas() {
    const s = this.app.save;
    const n = starCount(s);
    const rows = BIOMES.map((b) => {
      const st = s.stars[b.id] ?? [];
      const got = st.filter(Boolean).length;
      return `<div class="biome f" tabindex="-1">
        <div class="sw" style="background:${got ? `linear-gradient(135deg,${b.pal.land.join(',')})` : `linear-gradient(135deg,${b.pal.void},${b.pal.void2})`}"></div>
        <div style="flex:1"><h3>${tr(b.name)}</h3><div class="hint" style="text-align:left;margin:0">${tr(b.desc)} · ${t('RESTORED', { p: got * 20 })}</div>
        <ul>${CHALLENGES.map((c, i) => `<li class="${st[i] ? 'done' : ''}">${st[i] ? '★' : '☆'} ${tr(c)}</li>`).join('')}</ul></div>
        <div class="stars">${[0, 1, 2, 3, 4].map((i) => `<span class="${st[i] ? '' : 'off'}">★</span>`).join('')}</div></div>`;
    }).join('');
    const html = `
      <h2>${t('ATLAS_TITLE')}</h2>
      <p class="sub">${t('ATLAS_SUB')}</p>
      <div class="wallet"><span>★ ${t('STARS', { n, m: STAR_TOTAL })}</span><span>${t('STAR_BONUS', { p: Math.round(starBonus(s) * 100) })}</span></div>
      <div class="spacer"></div>
      <div class="wide" style="display:flex;flex-direction:column;gap:10px;max-height:62vh;overflow-y:auto">${rows}</div>
      <div class="spacer"></div>
      <button class="btn f small" data-back data-auto>${t('BACK')}</button>`;
    const el = this.push(html, { cls: 'solid', modal: false, onBack: () => this.pop() });
    el.querySelector('[data-back]')!.addEventListener('click', () => this.pop());
  }

  // ------------------------------------------------------------------ codex
  codex(tab: number) {
    const s = this.app.save;
    const tabs = [t('TAB_BESTIARY'), t('TAB_ARSENAL'), t('TAB_ACH'), t('TAB_STATS')];
    let body = '';
    if (tab === 0) {
      body = ENEMIES.map((e) => {
        const seen = s.codex.enemies.includes(e.id);
        return `<div class="item f ${seen ? '' : 'dim'}"><div class="ic"><svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="${e.ai === 'boss' ? 13 : 10}" fill="#17151f" stroke="${seen ? e.color : '#555'}" stroke-width="2"/><circle cx="11" cy="13" r="2.5" fill="#fff"/><circle cx="19" cy="13" r="2.5" fill="#fff"/></svg></div>
          <div><div class="t">${seen ? tr(e.name) : t('UNKNOWN')}${e.ai === 'boss' ? ' ♛' : ''}</div><div class="d">${seen ? tr(e.desc) : t('NOT_SEEN')}</div></div></div>`;
      }).join('');
    } else if (tab === 1) {
      body = WEAPONS.map((w) => {
        const seen = s.codex.weapons.includes(w.id);
        const evo = s.stats.evolutions.includes(w.id);
        return `<div class="item f ${seen ? '' : 'dim'}"><div class="ic" style="color:${w.color}">${iconSvg(w.icon, w.color, 26)}</div>
          <div><div class="t">${tr(w.name)}</div><div class="d">${tr(w.desc)}</div><div class="d" style="color:${evo ? '#ffd166' : ''}">★ ${evo ? tr(w.evo.name) + ' — ' + tr(w.evo.desc) : '???'}</div></div></div>`;
      }).join('') + RELICS.map((r) => {
        const seen = s.codex.relics.includes(r.id);
        return `<div class="item f ${seen ? '' : 'dim'}"><div class="ic" style="color:${r.color}">${iconSvg(r.icon, r.color, 24)}</div>
          <div><div class="t">${seen ? tr(r.name) : t('UNKNOWN')}</div><div class="d">${seen ? tr(r.desc) : t('NOT_SEEN')}</div></div></div>`;
      }).join('');
    } else if (tab === 2) {
      body = ACHIEVEMENTS.map((a) => {
        const got = s.achievements.includes(a.id);
        return `<div class="item f ${got ? '' : 'dim'}"><div class="ic" style="color:${got ? '#ffd166' : '#777'}">${iconSvg(got ? 'trophy' : 'lock', 'currentColor', 24)}</div>
          <div><div class="t">${tr(a.name)}</div><div class="d">${tr(a.desc)}</div></div></div>`;
      }).join('');
    } else {
      const st = s.stats;
      const rows: [string, string][] = [
        [t('ST_RUNS'), fmtNum(st.runs)], [t('ST_WINS'), fmtNum(st.wins)], [t('ST_CAPTURES'), fmtNum(st.captures)],
        [t('ST_KILLS'), fmtNum(st.kills)], [t('ST_CELLS'), fmtNum(st.cells)], [t('ST_BOSSES'), fmtNum(st.bosses)],
        [t('ST_TIME'), fmtTime(st.playTime)], [t('ST_BEST'), fmtNum(st.bestScore)], [t('ST_SNAPS'), fmtNum(st.snaps)],
        [t('ST_LOOP'), '×' + st.maxLoopCaptures], [t('ST_LOOPPCT'), (st.maxLoopPct * 100).toFixed(1) + '%'], [t('ST_ENDLESS'), String(st.bestEndless)],
        [t('TAB_ACH'), `${s.achievements.length} / ${ACHIEVEMENTS.length}`],
      ];
      body = `<div class="stats-table f" style="grid-column:1/-1;margin:auto">${rows.map(([a, b]) => `<div>${a}</div><div>${b}</div>`).join('')}</div>`;
    }
    if (this.active?.el.dataset.screen === 'codex') this.pop();
    const html = `
      <h2>${t('CODEX_TITLE')}</h2>
      <div class="tabs">${tabs.map((n, i) => `<button class="tab f ${i === tab ? 'on' : ''}" data-tab="${i}" ${i === tab ? 'data-auto' : ''}>${n}</button>`).join('')}</div>
      <div class="panel wide"><div class="grid">${body}</div></div>
      <div class="hint">${t('TAB_HINT')}</div>
      <div class="spacer"></div>
      <button class="btn f small" data-back>${t('BACK')}</button>`;
    const el = this.push(html, { cls: 'solid', modal: false, onBack: () => this.pop(), onTab: (d) => this.codex((tab + d + 4) % 4) });
    el.dataset.screen = 'codex';
    el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { audio.uiMove(); this.codex(Number(b.dataset.tab)); }));
    el.querySelector('[data-back]')!.addEventListener('click', () => this.pop());
  }

  // ------------------------------------------------------------------ settings
  settings() {
    const s = this.app.save.settings;
    type Row = { key: string; label: string; kind: 'vol' | 'bool' | 'lang' | 'speed' | 'action'; get: () => string; adj: (d: number) => void };
    const vol = (k: 'master' | 'music' | 'sfx') => ({
      get: () => `<div class="meter"><i style="width:${s[k] * 100}%"></i></div>${Math.round(s[k] * 100)}%`,
      adj: (d: number) => { s[k] = Math.max(0, Math.min(1, Math.round((s[k] + d * 0.1) * 10) / 10)); },
    });
    const bool = (k: 'flashes' | 'damageNumbers' | 'mouseMove') => ({
      get: () => (s[k] ? t('ON') : t('OFF')),
      adj: () => { s[k] = !s[k]; },
    });
    const rows: Row[] = [
      { key: 'master', label: t('S_MASTER'), kind: 'vol', ...vol('master') },
      { key: 'music', label: t('S_MUSIC'), kind: 'vol', ...vol('music') },
      { key: 'sfx', label: t('S_SFX'), kind: 'vol', ...vol('sfx') },
      { key: 'shake', label: t('S_SHAKE'), kind: 'vol', get: () => `<div class="meter"><i style="width:${s.shake * 100}%"></i></div>${Math.round(s.shake * 100)}%`, adj: (d) => { s.shake = Math.max(0, Math.min(1, Math.round((s.shake + d * 0.25) * 4) / 4)); } },
      { key: 'flashes', label: t('S_FLASHES'), kind: 'bool', ...bool('flashes') },
      { key: 'dmg', label: t('S_DMGNUM'), kind: 'bool', ...bool('damageNumbers') },
      { key: 'mouse', label: t('S_MOUSE'), kind: 'bool', ...bool('mouseMove') },
      { key: 'speed', label: t('S_SPEED'), kind: 'speed', get: () => `${Math.round(s.gameSpeed * 100)}%`, adj: (d) => { s.gameSpeed = Math.max(0.6, Math.min(1, Math.round((s.gameSpeed + d * 0.1) * 10) / 10)); } },
      { key: 'lang', label: t('S_LANG'), kind: 'lang', get: () => (s.lang === 'de' ? 'Deutsch' : 'English'), adj: () => { s.lang = s.lang === 'de' ? 'en' : 'de'; } },
      { key: 'fs', label: t('S_FULLSCREEN'), kind: 'action', get: () => (document.fullscreenElement ? t('ON') : t('OFF')), adj: () => { toggleFullscreen(); } },
    ];
    const render = () => `
      <h2>${t('SETTINGS_TITLE')}</h2>
      <div class="spacer"></div>
      <div class="panel" style="width:min(640px,94vw);display:flex;flex-direction:column;gap:8px">
        ${rows.map((r, i) => `<div class="setting f" data-adjust="1" data-k="${r.key}" ${i === 0 ? 'data-auto' : ''}><span>${r.label}</span><div class="val"><button data-d="-1">◀</button><span style="display:inline-flex;gap:8px;align-items:center">${r.get()}</span><button data-d="1">▶</button></div></div>`).join('')}
        <div class="row" style="margin-top:6px"><button class="btn small f" data-reset>${t('S_RESET')}</button></div>
      </div>
      <p class="hint">${t('CONTROLS')}: ${t('CONTROLS_TEXT')}</p>
      <div class="spacer"></div>
      <button class="btn f small" data-back>${t('BACK')}</button>`;
    const close = () => {
      this.app.persist();
      this.pop();
    };
    const el = this.push(render(), { cls: 'solid', modal: true, onBack: close });
    const bind = (focusKey?: string) => {
      el.innerHTML = render();
      this.bindFocus(el);
      this.focusEl = null;
      const f = focusKey ? el.querySelector<HTMLElement>(`[data-k="${focusKey}"]`) : null;
      if (f) this.setFocus(f, false);
      else this.autoFocus(el);
      el.querySelectorAll<HTMLElement>('[data-k]').forEach((row) => {
        const r = rows.find((x) => x.key === row.dataset.k)!;
        const apply = (d: number) => {
          r.adj(d);
          this.app.applySettings();
          audio.uiMove();
          bind(r.key);
        };
        row.addEventListener('adjust', (e) => apply((e as CustomEvent).detail));
        row.addEventListener('click', () => { if (r.kind !== 'vol' && r.kind !== 'speed') apply(1); });
        row.querySelectorAll<HTMLElement>('[data-d]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); apply(Number(b.dataset.d)); }));
      });
      el.querySelector('[data-back]')!.addEventListener('click', close);
      el.querySelector('[data-reset]')!.addEventListener('click', () => this.confirm(t('S_RESET_CONFIRM'), () => this.app.wipe()));
    };
    bind();
    void getLang;
  }
}

export function toggleFullscreen() {
  const native = (window as any).hueNative;
  if (native?.toggleFullscreen) {
    native.toggleFullscreen();
    return;
  }
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
