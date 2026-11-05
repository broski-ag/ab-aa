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

export function scrollToSelector(selector: string) {
  document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
}
