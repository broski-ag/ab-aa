import { useEffect, useState } from 'react';
import { computeLayout, currentLayout, type LayoutMode } from '../utils/layout';

/**
 * Current hero composition. Re-evaluated (once per frame at most) on resize and rotation,
 * and only triggers a re-render when the answer actually changes. Also mirrors the result
 * onto <html data-layout> so CSS can react to it.
 */
export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(currentLayout);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = computeLayout(window.innerWidth, window.innerHeight);
      document.documentElement.dataset.layout = next;
      setMode((prev) => (prev === next ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, []);

  return mode;
}
