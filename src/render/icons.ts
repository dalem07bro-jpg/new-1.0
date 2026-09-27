// Tiny stroke icon set (24×24 viewBox). Used as inline SVG in menus and as Path2D on the HUD.
export const ICONS: Record<string, string> = {
  brush: 'M4 20c3 0 5-1 5-4l9-9a2 2 0 0 0-3-3l-9 9c-3 0-4 2-4 5z M13 7l4 4',
  bolt: 'M13 2 5 14h6l-1 8 8-12h-6z',
  orbit: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M3 12a9 4 0 1 0 18 0a9 4 0 1 0-18 0',
  thorn: 'M3 19c5-2 8-6 9-14 M7 15l-3-2 M10 11l-3-3 M12 7l-2-3 M10 13l3 1 M12 9l3 0',
  splash: 'M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z M4 20l-2 1 M20 20l2 1 M12 22v1',
  mine: 'M12 13m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M12 7V3 M16 5l2-2 M14 3h4',
  easel: 'M6 3h12v10H6z M9 13l-3 8 M15 13l3 8 M12 13v5',
  beam: 'M3 12h13 M16 8l5 4-5 4 M3 8h6 M3 16h6',
  golem: 'M8 4h8v6H8z M6 10h12v7H6z M8 17v4 M16 17v4 M10 7h0.01 M14 7h0.01',
  rain: 'M7 3v4 M12 2v6 M17 3v4 M6 13a3 3 0 0 0 6 0c0-2-3-4-3-4s-3 2-3 4z M13 18a3 3 0 0 0 6 0c0-2-3-4-3-4s-3 2-3 4z',
  boot: 'M7 3v10l-3 5h14l2-3-6-2V3z M4 21h16',
  heart: 'M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z',
  shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
  hourglass: 'M6 3h12 M6 21h12 M7 3c0 5 10 6 10 9s-10 4-10 9 M17 3c0 5-10 6-10 9s10 4 10 9',
  magnet: 'M6 4v8a6 6 0 0 0 12 0V4 M6 8h4 M14 8h4 M10 4v8a2 2 0 0 0 4 0V4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  flame: 'M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z',
  clock: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3 2',
  prism: 'M12 3l9 17H3z M2 10h6 M16 12l6-2 M16 14l6 1 M16 16l6 4',
  house: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-5h4v5',
  cross: 'M12 3v18 M5 9h14',
  knife: 'M4 20l7-7 M11 13l9-9c1 3-1 7-5 9z',
  drop: 'M12 3c4 5 7 8 7 12a7 7 0 0 1-14 0c0-4 3-7 7-12z',
  coin: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 7v10 M9 9h5a2 2 0 0 1 0 4h-4a2 2 0 0 0 0 4h5',
  net: 'M3 5c6 2 12 2 18 0 M3 5c2 6 2 12 0 16 M21 5c-2 6-2 12 0 16 M3 21c6-2 12-2 18 0 M9 5v16 M15 5v16 M3 11h18 M3 16h18',
  wind: 'M3 8h11a3 3 0 1 0-3-3 M3 12h16a3 3 0 1 1-3 3 M3 16h8',
  guard: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z M9 12l2 2 4-4',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  dice: 'M4 4h16v16H4z M8 8h0.01 M16 16h0.01 M12 12h0.01 M16 8h0.01 M8 16h0.01',
  sun: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5',
  crown: 'M3 18h18 M3 18l2-10 5 5 2-8 2 8 5-5 2 10',
  palette: 'M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 3-2 3-4c0-4-4-8-9-8z M7 12h0.01 M9 7h0.01 M15 7h0.01',
  play: 'M7 4l13 8-13 8z',
  gear: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1 7 17 M17 7l2.1-2.1',
  book: 'M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z M20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 14v4 M8 21h8',
  lock: 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',
  exit: 'M10 4H4v16h6 M14 8l4 4-4 4 M8 12h10',
};

export function iconSvg(name: string, color = 'currentColor', size = 24, stroke = 2) {
  const d = ICONS[name] ?? ICONS.star;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

const pathCache = new Map<string, Path2D>();
export function iconPath(name: string): Path2D {
  let p = pathCache.get(name);
  if (!p) {
    p = new Path2D(ICONS[name] ?? ICONS.star);
    pathCache.set(name, p);
  }
  return p;
}
