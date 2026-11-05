import type { LayoutMode } from './layout';

/**
 * The two hero designs are static HTML exports served from /public/hero. They are
 * preloaded from <head> (see index.html), so by the time React asks for one the request
 * is usually already finished. Only the composition the visitor actually needs is fetched.
 */
const cache = new Map<LayoutMode, Promise<string>>();

export function loadHeroHtml(mode: LayoutMode): Promise<string> {
  let pending = cache.get(mode);
  if (!pending) {
    pending = fetch(`/hero/${mode}.html`).then((res) => {
      if (!res.ok) throw new Error(`Hero design failed to load (${res.status})`);
      return res.text();
    });
    pending.catch(() => cache.delete(mode)); // allow a retry on the next resize / mount
    cache.set(mode, pending);
  }
  return pending;
}
