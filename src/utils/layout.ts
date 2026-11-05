/**
 * Which hero composition to show.
 *
 *  - 'mobile'  : the 9:16 portrait composition (mbbg / mbme / hero/mobile.html)
 *  - 'desktop' : the landscape composition (bg / me / me2 / hero/desktop.html),
 *                which morphs towards its "tablet" state via useHeroMorph
 *
 * The old rule was `innerWidth < 768`, which broke on two kinds of screen:
 *   - vertical monitors (1080x1920, 1440x2560 …) are wider than 768px, so they got the
 *     landscape composition squeezed into a thin band in the middle of a tall screen;
 *   - landscape phones / short windows (844x390, 1024x600 …) got the portrait-tablet state.
 *
 * Aspect ratio is what actually decides which composition fits, so it drives the choice.
 * NOTE: index.html repeats these numbers in its <link rel="preload"> / <picture> media
 * queries — keep the two in sync (see the comment there).
 */
export type LayoutMode = 'mobile' | 'desktop';

/** viewport width / height at or below which ANY screen gets the portrait composition (9:16 and taller) */
export const PORTRAIT_MAX_ASPECT = 0.62;
/**
 * Wide-and-tall screens (vertical monitors: 16:10 rotated = 0.625, 2:3 = 0.667 …) also get it.
 * Tablets in that aspect range (iPad, Galaxy Tab …) are all under ~920px wide and keep the
 * "tablet" state of the landscape composition, which was designed for them.
 */
export const MONITOR_MIN_WIDTH = 960;
export const MONITOR_PORTRAIT_MAX_ASPECT = 0.72;
/** below this width a portrait-ish window is treated as a phone */
export const PHONE_MAX_WIDTH = 767;
/** …as long as it is not landscape (a landscape phone keeps the landscape composition) */
export const PHONE_MAX_ASPECT = 0.99;

export function computeLayout(width: number, height: number): LayoutMode {
  const aspect = width / Math.max(1, height);
  if (aspect <= PORTRAIT_MAX_ASPECT) return 'mobile';
  if (width >= MONITOR_MIN_WIDTH && aspect <= MONITOR_PORTRAIT_MAX_ASPECT) return 'mobile';
  if (width <= PHONE_MAX_WIDTH && aspect <= PHONE_MAX_ASPECT) return 'mobile';
  return 'desktop';
}

export const currentLayout = (): LayoutMode =>
  typeof window === 'undefined' ? 'desktop' : computeLayout(window.innerWidth, window.innerHeight);
