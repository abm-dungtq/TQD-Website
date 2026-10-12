// Exposé: lays every open window out in a grid so one can be picked. Transforms only;
// the CSS transition on .is-expose windows animates it (and reduced motion makes it instant).

const TOP = 32 + 24;
const BOTTOM = 96;
const SIDE = 24;
const GAP = 24;
const LABEL = 28;
const EXIT_MS = 400;

export interface Expose {
  readonly active: boolean;
  enter(): void;
  exit(): void;
}

export function createExpose(
  desktop: HTMLElement,
  visibleWindows: () => HTMLElement[],
  pick: (win: HTMLElement) => void,
  onChange: (active: boolean) => void,
): Expose {
  let active = false;
  let laidOut: HTMLElement[] = [];
  const layer = document.createElement('div');
  layer.className = 'expose-layer';
  layer.hidden = true;
  desktop.appendChild(layer);

  const titleOf = (win: HTMLElement) => win.querySelector('h2')?.textContent?.trim() ?? '';

  const onPick = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    const win = event.currentTarget as HTMLElement;
    exit();
    pick(win);
  };

  const enter = () => {
    const wins = visibleWindows();
    if (active || wins.length === 0) return;
    active = true;
    laidOut = wins;
    const cols = Math.ceil(Math.sqrt(wins.length));
    const rows = Math.ceil(wins.length / cols);
    const cellW = (window.innerWidth - SIDE * 2) / cols;
    const cellH = (window.innerHeight - TOP - BOTTOM) / rows;
    layer.replaceChildren();
    desktop.classList.add('is-expose');
    wins.forEach((win, i) => {
      const r = win.getBoundingClientRect();
      const col = i % cols;
      const row = Math.floor(i / cols);
      const scale = Math.min((cellW - GAP * 2) / r.width, (cellH - GAP * 2 - LABEL) / r.height, 1);
      const cx = SIDE + cellW * (col + 0.5);
      const cy = TOP + cellH * (row + 0.5) - LABEL / 2;
      const tx = cx - (r.left + r.width / 2);
      const ty = cy - (r.top + r.height / 2);
      win.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      win.addEventListener('click', onPick, { capture: true });
      const label = document.createElement('span');
      label.className = 'expose-label';
      label.textContent = titleOf(win);
      label.style.left = `${cx}px`;
      label.style.top = `${cy + (r.height * scale) / 2 + 8}px`;
      layer.appendChild(label);
    });
    layer.hidden = false;
    onChange(true);
  };

  const exit = () => {
    if (!active) return;
    active = false;
    laidOut.forEach((win) => {
      win.style.transform = '';
      win.removeEventListener('click', onPick, { capture: true });
    });
    laidOut = [];
    layer.hidden = true;
    onChange(false);
    // The class carries the transition, so keep it until the windows have slid back.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => active || desktop.classList.remove('is-expose'), reduce ? 0 : EXIT_MS);
  };

  layer.addEventListener('click', exit);

  return {
    get active() {
      return active;
    },
    enter,
    exit,
  };
}
