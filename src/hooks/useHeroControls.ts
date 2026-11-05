import { useEffect } from 'react';
import {
  axisValue,
  HERO_CANVAS,
  HERO_ELEMENTS,
  sampleKeys,
  type HeroElementDef,
} from '../utils/heroControls';
import { heroControlsStore } from '../utils/heroControlsStore';
import { resolveNodes } from '../utils/heroDom';
import type { LayoutMode } from '../utils/layout';
import { morphScales } from './useHeroMorph';

/**
 * Applies the hero controller keyframes (src/data/heroControls.json) to the hero.
 *
 * Uses the independent CSS `translate` / `scale` properties, which stack on top of the
 * existing `transform`s (the desktop → tablet morph, the parallax, the export's own
 * `rotate(0deg)`), so nothing that already works is overwritten. Elements without keys
 * are never touched. Runs once per frame at most, and only on resize / config change.
 */

const supported = () =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('translate', '1px') && CSS.supports('scale', '1');

interface Live {
  def: HeroElementDef;
  nodes: HTMLElement[];
  /** transform-origin per node, so the nodes of one testimonial scale as one block */
  origins: string[] | null;
}

const px = (el: HTMLElement, prop: 'left' | 'top' | 'width' | 'height') => parseFloat(el.style[prop]) || 0;

function groupOrigins(nodes: HTMLElement[]): string[] | null {
  if (nodes.length < 2) return null;
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const n of nodes) {
    l = Math.min(l, px(n, 'left'));
    t = Math.min(t, px(n, 'top'));
    r = Math.max(r, px(n, 'left') + px(n, 'width'));
    b = Math.max(b, px(n, 'top') + px(n, 'height'));
  }
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;
  return nodes.map((n) => `${(cx - px(n, 'left')).toFixed(2)}px ${(cy - px(n, 'top')).toFixed(2)}px`);
}

export function useHeroControls(layout: LayoutMode, heroHtml: string | null) {
  // Alt+Shift+H opens / closes the controller panel (or add ?controller to the URL)
  useEffect(() => {
    heroControlsStore.initFromUrl();
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyH') {
        e.preventDefault();
        heroControlsStore.setEnabled(!heroControlsStore.getEnabled());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!supported()) return;

    const defs = HERO_ELEMENTS[layout];
    const canvas = HERO_CANVAS[layout];
    const originals = new Map<HTMLElement, string>();
    let live: Live[] = [];
    let frame = 0;

    const resolve = () => {
      live = defs
        .map((def) => {
          const nodes = resolveNodes(def);
          return { def, nodes, origins: def.space === 'canvas' ? groupOrigins(nodes) : null };
        })
        .filter((l) => l.nodes.length > 0);
    };

    const clear = (node: HTMLElement) => {
      node.style.translate = '';
      node.style.scale = '';
      const o = originals.get(node);
      if (o !== undefined) {
        node.style.transformOrigin = o;
        originals.delete(node);
      }
    };

    const apply = () => {
      frame = 0;
      const cfg = heroControlsStore.getConfig()[layout];
      const W = window.innerWidth;
      const H = window.innerHeight;
      const at = axisValue(cfg.axis, W, H);
      const S = Math.min(W / canvas.w, H / canvas.h); // HeroDesign's "contain" scale
      const k = layout === 'desktop' ? morphScales(W, H) : { title: 1, rig: 1 };

      for (const { def, nodes, origins } of live) {
        const keys = cfg.elements[def.id];
        if (!keys || keys.length === 0) {
          nodes.forEach((n) => originals.has(n) && clear(n));
          continue;
        }
        const v = sampleKeys(keys, at);
        let dx = (v.x / 100) * W;
        let dy = (v.y / 100) * H;
        if (def.space === 'canvas') {
          // screen px -> canvas px, undoing the canvas scale and the morph group's scale
          const group = def.scope === 'title' ? k.title : def.scope === 'rig' ? k.rig : 1;
          dx /= S * group;
          dy /= S * group;
        }
        nodes.forEach((n, i) => {
          if (!originals.has(n)) originals.set(n, n.style.transformOrigin);
          if (origins) n.style.transformOrigin = origins[i];
          n.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
          n.style.scale = v.s.toFixed(4);
        });
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    resolve();
    apply();
    // the hero design arrives as fetched HTML; pick up its nodes as soon as they are in the DOM
    const again = window.setTimeout(() => {
      resolve();
      schedule();
    }, 0);

    const unsubscribe = heroControlsStore.subscribe(() => {
      resolve(); // cheap, and keeps selections valid if nodes were swapped
      schedule();
    });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule);

    return () => {
      window.clearTimeout(again);
      if (frame) cancelAnimationFrame(frame);
      unsubscribe();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      live.forEach((l) => l.nodes.forEach(clear));
    };
  }, [layout, heroHtml]);
}
