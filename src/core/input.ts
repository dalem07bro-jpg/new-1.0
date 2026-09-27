// Unified keyboard / mouse / gamepad input with edge detection and menu navigation repeat.

export type Device = 'kb' | 'pad';
export type NavDir = 'up' | 'down' | 'left' | 'right';

const DEADZONE = 0.22;

class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private padPrev: boolean[] = [];
  private padNow: boolean[] = [];
  private navRepeat: Record<string, number> = {};
  device: Device = 'kb';
  mouseX = 0;
  mouseY = 0;
  mouseDown = false;
  rightDown = false;
  touch = false;
  touchDash = false;
  touchSpecial = false;
  private rightPressed = false;
  padAxes = { x: 0, y: 0 };
  private navQueue: NavDir[] = [];
  private attached = false;

  attach(target: HTMLElement) {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        // allow nav repeat from OS key repeat for arrow keys in menus
        const nav = keyToNav(e.code);
        if (nav) this.navQueue.push(nav);
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
        return;
      }
      this.device = 'kb';
      this.down.add(e.code);
      this.pressed.add(e.code);
      const nav = keyToNav(e.code);
      if (nav) this.navQueue.push(nav);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown = false;
      this.rightDown = false;
    });
    // pointer events cover mouse, pen and touch (touch = hold to move toward the finger)
    let movePointer = -1;
    target.addEventListener('pointermove', (e) => {
      if (movePointer === -1 || e.pointerId === movePointer || e.pointerType === 'mouse') {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      }
    });
    target.addEventListener('pointerdown', (e) => {
      this.device = 'kb';
      if (e.pointerType === 'touch') this.touch = true;
      const onCanvas = (e.target as HTMLElement).tagName === 'CANVAS';
      if (e.button === 0 && onCanvas && movePointer === -1) {
        movePointer = e.pointerId;
        this.mouseDown = true;
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      }
      if (e.button === 2) {
        this.rightDown = true;
        this.rightPressed = true;
      }
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId === movePointer) {
        movePointer = -1;
        this.mouseDown = false;
      }
      if (e.button === 2) this.rightDown = false;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Call once per frame before reading. */
  poll(dt: number) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    this.padPrev = this.padNow;
    this.padNow = [];
    this.padAxes.x = 0;
    this.padAxes.y = 0;
    if (pad) {
      for (let i = 0; i < pad.buttons.length; i++) this.padNow[i] = pad.buttons[i].pressed || pad.buttons[i].value > 0.5;
      let ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
      const mag = Math.hypot(ax, ay);
      if (mag < DEADZONE) { ax = 0; ay = 0; }
      else {
        const k = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE)) / mag;
        ax *= k; ay *= k;
      }
      this.padAxes.x = ax;
      this.padAxes.y = ay;
      if (this.padNow.some((b, i) => b && !this.padPrev[i]) || mag > 0.5) this.device = 'pad';
      // menu nav from dpad / stick with repeat
      const dirs: [NavDir, boolean][] = [
        ['up', !!this.padNow[12] || ay < -0.6],
        ['down', !!this.padNow[13] || ay > 0.6],
        ['left', !!this.padNow[14] || ax < -0.6],
        ['right', !!this.padNow[15] || ax > 0.6],
      ];
      for (const [d, on] of dirs) {
        if (!on) { this.navRepeat[d] = 0; continue; }
        const t = this.navRepeat[d] || 0;
        if (t === 0) this.navQueue.push(d);
        const nt = t + dt;
        if (t < 0.38 && nt >= 0.38) this.navQueue.push(d);
        else if (nt > 0.38 && Math.floor((nt - 0.38) / 0.1) > Math.floor((t - 0.38) / 0.1)) this.navQueue.push(d);
        this.navRepeat[d] = nt;
      }
    }
  }

  /** Call at end of frame. */
  endFrame() {
    this.pressed.clear();
    this.rightPressed = false;
    this.touchDash = false;
    this.touchSpecial = false;
    this.navQueue.length = 0;
  }

  private padPressed(i: number) {
    return !!this.padNow[i] && !this.padPrev[i];
  }
  private padHeld(i: number) {
    return !!this.padNow[i];
  }
  key(code: string) {
    return this.down.has(code);
  }
  keyPressed(code: string) {
    return this.pressed.has(code);
  }

  /** Movement vector from keyboard + stick; magnitude ≤ 1. */
  move(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.key('KeyA') || this.key('ArrowLeft')) x -= 1;
    if (this.key('KeyD') || this.key('ArrowRight')) x += 1;
    if (this.key('KeyW') || this.key('ArrowUp')) y -= 1;
    if (this.key('KeyS') || this.key('ArrowDown')) y += 1;
    if (x !== 0 || y !== 0) {
      const m = Math.hypot(x, y);
      return { x: x / m, y: y / m };
    }
    if (this.padAxes.x !== 0 || this.padAxes.y !== 0) {
      const dx = this.padNow[14] ? -1 : this.padNow[15] ? 1 : 0;
      const dy = this.padNow[12] ? -1 : this.padNow[13] ? 1 : 0;
      if (dx || dy) { const m = Math.hypot(dx, dy); return { x: dx / m, y: dy / m }; }
      return { x: this.padAxes.x, y: this.padAxes.y };
    }
    const dx = this.padNow[14] ? -1 : this.padNow[15] ? 1 : 0;
    const dy = this.padNow[12] ? -1 : this.padNow[13] ? 1 : 0;
    if (dx || dy) { const m = Math.hypot(dx, dy); return { x: dx / m, y: dy / m }; }
    return { x: 0, y: 0 };
  }

  dashPressed() {
    return this.touchDash || this.keyPressed('Space') || this.keyPressed('ShiftLeft') || this.keyPressed('ShiftRight') || this.padPressed(0) || this.padPressed(5) || this.padPressed(7);
  }
  specialPressed() {
    return this.touchSpecial || this.keyPressed('KeyE') || this.keyPressed('KeyQ') || this.rightPressed || this.padPressed(2) || this.padPressed(3) || this.padPressed(4) || this.padPressed(6);
  }
  pausePressed() {
    return this.keyPressed('Escape') || this.keyPressed('KeyP') || this.padPressed(9) || this.padPressed(8);
  }
  confirmPressed() {
    return this.keyPressed('Enter') || this.keyPressed('Space') || this.keyPressed('NumpadEnter') || this.padPressed(0);
  }
  backPressed() {
    return this.keyPressed('Escape') || this.keyPressed('Backspace') || this.padPressed(1);
  }
  rerollPressed() {
    return this.keyPressed('KeyR') || this.padPressed(3);
  }
  banishPressed() {
    return this.keyPressed('KeyB') || this.padPressed(2);
  }
  tabLeftPressed() {
    return this.keyPressed('KeyQ') || this.padPressed(4);
  }
  tabRightPressed() {
    return this.keyPressed('KeyE') || this.padPressed(5);
  }
  navEvents(): NavDir[] {
    return this.navQueue;
  }
  anyPadHeld() {
    return this.padNow.some((b) => b);
  }
  padButtonHeld(i: number) {
    return this.padHeld(i);
  }
}

function keyToNav(code: string): NavDir | null {
  switch (code) {
    case 'ArrowUp': case 'KeyW': return 'up';
    case 'ArrowDown': case 'KeyS': return 'down';
    case 'ArrowLeft': case 'KeyA': return 'left';
    case 'ArrowRight': case 'KeyD': return 'right';
  }
  return null;
}

export const input = new Input();
