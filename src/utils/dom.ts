/** small expanding circle where the visitor clicked (visual feedback only) */
export function spawnRipple(container: HTMLElement, clientX: number, clientY: number, color: string) {
  const rect = container.getBoundingClientRect();
  const el = document.createElement('span');
  el.style.cssText = `
    position: absolute;
    border-radius: 50%;
    background: ${color};
    transform: scale(0);
    animation: click-ripple 0.6s ease-out;
    pointer-events: none;
    width: 20px;
    height: 20px;
    left: ${clientX - rect.left - 10}px;
    top: ${clientY - rect.top - 10}px;
    z-index: 999;
  `;
  container.appendChild(el);
  window.setTimeout(() => el.remove(), 600);
}

/** ease-in-out-cubic — accelerates gently, decelerates softly, never feels mechanical */
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

let scrollAnim = 0;

/** animated scroll to a vertical position (desktop only; mobile jumps instantly) */
function animatedScrollTo(target: number, duration: number) {
  window.cancelAnimationFrame(scrollAnim);
  const start = window.scrollY;
  const distance = target - start;
  if (distance === 0) return;
  const startTime = performance.now();

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));
    if (progress < 1) scrollAnim = window.requestAnimationFrame(step);
  };
  scrollAnim = window.requestAnimationFrame(step);
}

export function scrollToSelector(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return;

  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  if (isMobile) {
    el.scrollIntoView({ behavior: 'auto' });
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    el.scrollIntoView({ behavior: 'auto' });
    return;
  }

  const target = el.getBoundingClientRect().top + window.scrollY;
  const distance = Math.abs(target - window.scrollY);
  // 800–1400 ms depending on how far we travel — short hops feel snappy, long ones feel grand
  const duration = Math.min(1400, Math.max(600, distance * 0.6));
  animatedScrollTo(target, duration);
}
