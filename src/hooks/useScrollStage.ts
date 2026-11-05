import { useEffect, type RefObject } from 'react';

/**
 * THE SCROLL EXPERIENCE (one small controller, no animation library)
 *
 *   1. The hero stays fixed in the background.
 *   2. The portfolio panel rises over it with the page's own native scroll. It is never
 *      moved by JS, so how far it travels depends only on the real content height and
 *      the viewport — never on a hard-coded pixel value. (The old build added an extra
 *      `y: -900px`, which is why large screens never fully cleared the portfolio and
 *      small screens cleared it too early.)
 *   3. While it rises (exactly one viewport of scroll) the figure layers drift slightly
 *      downward — the parallax. Progress is tied to that cover distance, so the effect is
 *      the same on every screen size.
 *   4. Once the panel has fully covered the hero, the hero is switched off (visibility)
 *      and the fixed contact section behind the panel is switched on. A runway of one
 *      viewport after the panel (see App) lets it lift away completely, revealing the
 *      contact section in full.
 *
 * The parallax is written straight onto the `.hero-parallax` layers as a transform. (Not
 * as a CSS variable on a wrapper: changing an inherited custom property near the root makes
 * the browser re-evaluate styles for the whole page subtree on every scroll frame.)
 * The "covered" state is a data-covered attribute on the stage (CSS decides what that
 * shows/hides); it only changes twice per visit.
 */

/** parallax travel, as a share of viewport height, clamped to a sensible pixel range */
const PARALLAX = { vh: 0.12, minPx: 60, maxPx: 200 };
/** how quickly the parallax catches up with the scroll position (seconds; lower = tighter) */
const FOLLOW_SECONDS = 0.3;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

interface Options {
  stageRef: RefObject<HTMLElement>;
  heroRef: RefObject<HTMLElement>;
  /** desktop composition only — the mobile composition keeps its figure static */
  parallax: boolean;
}

export function useScrollStage({ stageRef, heroRef, parallax }: Options) {
  useEffect(() => {
    const stage = stageRef.current;
    const hero = heroRef.current;
    if (!stage || !hero) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const useParallax = parallax && !reduceMotion;

    let heroHeight = hero.offsetHeight || window.innerHeight;
    let covered = false;
    let target = 0;
    let current = 0;
    let frame = 0;
    let last = 0;

    let layers: HTMLElement[] = [];
    const findLayers = () => {
      layers = Array.from(stage.querySelectorAll<HTMLElement>('.hero-parallax'));
    };
    findLayers();

    const write = () => {
      if (layers.length === 0 || !layers[0].isConnected) findLayers();
      const t = current === 0 ? '' : `translate3d(0, ${current.toFixed(2)}px, 0)`;
      for (const layer of layers) layer.style.transform = t;
    };

    const step = (now: number) => {
      const dt = Math.min(0.064, (now - last) / 1000);
      last = now;
      current += (target - current) * (1 - Math.exp(-dt / FOLLOW_SECONDS));
      if (Math.abs(target - current) < 0.1) {
        current = target;
        frame = 0;
        write();
        return;
      }
      write();
      frame = requestAnimationFrame(step);
    };

    const update = () => {
      const y = window.scrollY;

      if (useParallax) {
        const p = clamp01(y / heroHeight);
        const travel = Math.min(PARALLAX.maxPx, Math.max(PARALLAX.minPx, window.innerHeight * PARALLAX.vh));
        target = travel * (1 - (1 - p) * (1 - p)); // ease-out, as the original
        if (!frame && Math.abs(target - current) > 0.1) {
          last = performance.now();
          frame = requestAnimationFrame(step);
        }
      }

      // the panel's top edge reaches the top of the screen at exactly `heroHeight`
      const nowCovered = y >= heroHeight - 1;
      if (nowCovered !== covered) {
        covered = nowCovered;
        if (covered) stage.setAttribute('data-covered', '');
        else stage.removeAttribute('data-covered');
      }
    };

    const onResize = () => {
      heroHeight = hero.offsetHeight || window.innerHeight;
      update();
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(hero);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    update();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', onResize);
      stage.removeAttribute('data-covered');
      for (const layer of layers) layer.style.transform = '';
    };
  }, [stageRef, heroRef, parallax]);
}
