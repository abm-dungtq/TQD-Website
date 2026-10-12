// Dock magnification: icons near the pointer grow (scale = 1 + 0.55·cos(d/150·π/2) within 150 px)
// and lift by (scale − 1)·20 px. Transform only; neighbours slide apart so icons never overlap,
// and the dock background widens by the same amount. Fine pointers only, never under reduced motion.

const RANGE = 150;
const BOOST = 0.55;
const LIFT = 20;

export function enableDockMagnify(dock: HTMLElement): void {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const items = [...dock.querySelectorAll<HTMLElement>('.desktop-dock-item')];
  let centers: number[] = [];
  let width = 0;
  let pointerX: number | null = null;
  let frame = 0;

  const measure = () => {
    const box = dock.getBoundingClientRect();
    centers = items.map((item) => box.left + item.offsetLeft + item.offsetWidth / 2);
    width = items[0]?.offsetWidth ?? 0;
  };

  const render = () => {
    frame = 0;
    if (pointerX === null) return;
    const x = pointerX;
    const scales = centers.map((c) => {
      const d = Math.abs(x - c);
      return d < RANGE ? 1 + BOOST * Math.cos(((d / RANGE) * Math.PI) / 2) : 1;
    });
    const extra = scales.map((s) => (s - 1) * width);
    const total = extra.reduce((a, b) => a + b, 0);
    let before = 0;
    items.forEach((item, i) => {
      const shift = before + extra[i] / 2 - total / 2;
      before += extra[i];
      item.style.transform = `translate(${shift}px, ${-(scales[i] - 1) * LIFT}px) scale(${scales[i]})`;
      item.style.setProperty('--s', String(scales[i]));
    });
    dock.style.setProperty('--dock-grow', `${total / 2}px`);
  };

  dock.addEventListener('pointerenter', (e) => {
    if (reduce.matches || e.pointerType !== 'mouse') return;
    measure();
    dock.classList.add('is-magnify');
  });
  dock.addEventListener('pointermove', (e) => {
    if (reduce.matches || e.pointerType !== 'mouse') return;
    pointerX = e.clientX;
    if (!frame) frame = requestAnimationFrame(render);
  });
  dock.addEventListener('pointerleave', () => {
    pointerX = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    dock.classList.remove('is-magnify');
    items.forEach((item) => {
      item.style.transform = '';
      item.style.removeProperty('--s');
    });
    dock.style.setProperty('--dock-grow', '0px');
  });
}
