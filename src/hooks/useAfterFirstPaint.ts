import { useEffect, useState } from 'react';

/**
 * false for the first render, true shortly after the browser has painted it.
 * Lets heavy below-the-fold content wait until the hero is already on screen.
 */
export function useAfterFirstPaint(maxWaitMs = 400): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let handle = 0;
    let idle = false;
    const go = () => {
      if (!cancelled) setReady(true);
    };
    // requestAnimationFrame fires before the first paint, so hop over one frame
    const frame = requestAnimationFrame(() => {
      const w = window as Window & { requestIdleCallback?: Window['requestIdleCallback'] };
      if (w.requestIdleCallback) {
        idle = true;
        handle = w.requestIdleCallback(go, { timeout: maxWaitMs });
      } else {
        handle = window.setTimeout(go, 120); // Safari has no requestIdleCallback
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (handle && idle) window.cancelIdleCallback(handle);
      else if (handle) window.clearTimeout(handle);
    };
  }, [maxWaitMs]);

  return ready;
}
