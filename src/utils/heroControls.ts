import type { LayoutMode } from './layout';

/* ------------------------------------------------------------------ *
 *  HERO CONTROLLER — data model + maths (no React, no DOM)
 *
 *  Every hero element can carry "resolution keyframes". A key says:
 *  "at this screen width (or aspect ratio) nudge the element by x / y
 *  and multiply its size by s". Between two keys the values glide
 *  (smoothstep, same easing as the desktop → tablet morph); outside the
 *  first / last key they hold.
 *
 *  Keys are ADDITIVE: they sit on top of the existing morph in
 *  useHeroMorph.ts. An element without keys is not touched at all, so the
 *  default config (src/data/heroControls.json) looks exactly like before.
 *
 *    x, y : % of the screen width / height   (+x → right, +y → down)
 *    s    : size multiplier                  (1 = unchanged)
 * ------------------------------------------------------------------ */

export type Axis = 'width' | 'aspect';

export interface HeroKey {
  /** screen width in px (axis "width") or width / height (axis "aspect") */
  at: number;
  x: number;
  y: number;
  s: number;
}
export type HeroValue = Pick<HeroKey, 'x' | 'y' | 's'>;

export interface HeroLayoutControls {
  axis: Axis;
  elements: Record<string, HeroKey[]>;
}
export interface HeroControlsConfig {
  version: 1;
  desktop: HeroLayoutControls;
  mobile: HeroLayoutControls;
}

export const NEUTRAL: Readonly<HeroValue> = { x: 0, y: 0, s: 1 };

/** fixed design-canvas sizes of the exported hero designs */
export const HERO_CANVAS: Record<LayoutMode, { w: number; h: number }> = {
  desktop: { w: 4591, h: 2350 },
  mobile: { w: 1080, h: 1920 },
};

/* ------------------------------ elements ------------------------------ */

export interface HeroElementDef {
  id: string;
  label: string;
  group: 'Photos' | 'Name' | 'Testimonials' | 'Other';
  /**
   * 'canvas' → lives inside the scaled design canvas (text / badge exports)
   * 'screen' → a plain screen-sized layer (the photos, the scroll hint)
   */
  space: 'screen' | 'canvas';
  /** which morph group scales it (so 1% of movement is 1% of the screen either way) */
  scope: 'title' | 'rig' | 'none';
  /** can be grabbed by clicking it on the hero */
  pick: boolean;
  /** one selector per node; all nodes of an element move together */
  targets: string[];
}

const DESK = '.hero-design.desktop-image';
const MOB = '.hero-design.mobile-image';

const nodes = (root: string, ids: string[]) => ids.map((id) => `${root} #${id}`);

const sharedOther: HeroElementDef = {
  id: 'scrollHint',
  label: 'Scroll indicator',
  group: 'Other',
  space: 'screen',
  scope: 'none',
  pick: false,
  targets: ['.hc-scroll-hint'],
};

const card = (
  root: string,
  id: string,
  label: string,
  ids: string[],
): HeroElementDef => ({
  id,
  label,
  group: 'Testimonials',
  space: 'canvas',
  scope: root === DESK ? 'rig' : 'none',
  pick: true,
  targets: nodes(root, ids),
});

const name = (root: string, id: string, label: string, node: string): HeroElementDef => ({
  id,
  label,
  group: 'Name',
  space: 'canvas',
  scope: root === DESK ? 'title' : 'none',
  pick: true,
  targets: nodes(root, [node]),
});

/** Each testimonial = badge image + one-word quote + name + role. Same ids on both heroes. */
export const HERO_ELEMENTS: Record<LayoutMode, HeroElementDef[]> = {
  desktop: [
    { id: 'figure', label: 'Main photo', group: 'Photos', space: 'screen', scope: 'none', pick: false, targets: ['.hero-rig-figure'] },
    { id: 'figure2', label: 'Second photo (fades out on tablet)', group: 'Photos', space: 'screen', scope: 'none', pick: false, targets: ['.hero-me2'] },
    name(DESK, 'nameFirst', 'Aamir', 'text_2'),
    name(DESK, 'nameLast', 'Naqvi', 'text_3'),
    card(DESK, 'card-delux', 'DeluxeklexEATS', ['image_31', 'text_4', 'text_19', 'text_22']),
    card(DESK, 'card-shubham', 'Shubham Sanap', ['image_30', 'text_5', 'text_20', 'text_24']),
    card(DESK, 'card-jaskaran', 'Jaskaran Saini', ['image_29', 'text_6', 'text_21', 'text_18']),
    card(DESK, 'card-saisha', 'Saisha and Ayushi', ['image_28', 'text_7', 'text_14', 'text_23']),
    card(DESK, 'card-akash', 'Akash Shindey', ['image_25', 'text_8', 'text_11', 'text_15']),
    card(DESK, 'card-hansolo', 'Hansolo', ['image_26', 'text_9', 'text_12', 'text_16']),
    card(DESK, 'card-ateeb', 'Ateeb Murad Nazeer', ['image_27', 'text_10', 'text_13', 'text_17']),
    sharedOther,
  ],
  mobile: [
    { id: 'figure', label: 'Main photo', group: 'Photos', space: 'screen', scope: 'none', pick: false, targets: ['.hc-mobile-figure'] },
    name(MOB, 'nameFirst', 'Aamir', 'text_1'),
    name(MOB, 'nameLast', 'Naqvi', 'text_2'),
    card(MOB, 'card-delux', 'DeluxeklexEATS', ['image_30', 'text_3', 'text_18', 'text_21']),
    card(MOB, 'card-shubham', 'Shubham Sanap', ['image_29', 'text_4', 'text_19', 'text_23']),
    card(MOB, 'card-jaskaran', 'Jaskaran Saini', ['image_28', 'text_5', 'text_20', 'text_17']),
    card(MOB, 'card-saisha', 'Saisha and Ayushi', ['image_27', 'text_6', 'text_13', 'text_22']),
    card(MOB, 'card-akash', 'Akash Shindey', ['image_24', 'text_7', 'text_10', 'text_14']),
    card(MOB, 'card-hansolo', 'Hansolo', ['image_25', 'text_8', 'text_11', 'text_15']),
    card(MOB, 'card-ateeb', 'Ateeb Murad Nazeer', ['image_26', 'text_9', 'text_12', 'text_16']),
    sharedOther,
  ],
};

/* ------------------------------- keyframes ------------------------------ */

const ease = (p: number) => p * p * (3 - 2 * p);

/** how close (on the axis) counts as "the same resolution" */
const TOLERANCE: Record<Axis, number> = { width: 8, aspect: 0.012 };

/** standard resolutions — a first key is fenced in by neutral keys at the neighbouring ones */
const LADDER: Record<Axis, number[]> = {
  width: [320, 360, 390, 430, 480, 600, 768, 820, 1024, 1180, 1280, 1366, 1440, 1536, 1600, 1680, 1920, 2048, 2304, 2560, 3072, 3440, 3840, 5120, 7680],
  aspect: [0.36, 0.4, 0.43, 0.46, 0.48, 0.5, 0.5625, 0.6, 0.62, 0.66, 0.72, 0.8, 1, 1.25, 1.33, 1.5, 1.6, 1.78, 1.9, 2, 2.2, 2.33, 2.4, 2.67, 3.2, 3.56],
};
const FENCE: Record<Axis, [number, number]> = { width: [0.9, 1.1], aspect: [0.94, 1.06] };

export const axisValue = (axis: Axis, w: number, h: number) =>
  axis === 'width' ? w : w / Math.max(1, h);

export const roundAt = (axis: Axis, at: number) =>
  axis === 'width' ? Math.round(at) : Math.round(at * 1000) / 1000;

export const formatAt = (axis: Axis, at: number) =>
  axis === 'width' ? `${Math.round(at)} px` : `${at.toFixed(3)} (w/h)`;

export function sampleKeys(keys: readonly HeroKey[] | undefined, at: number): HeroValue {
  if (!keys || keys.length === 0) return { ...NEUTRAL };
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (at <= first.at) return { x: first.x, y: first.y, s: first.s };
  if (at >= last.at) return { x: last.x, y: last.y, s: last.s };
  for (let i = 1; i < keys.length; i++) {
    if (at <= keys[i].at) {
      const a = keys[i - 1];
      const b = keys[i];
      const t = ease((at - a.at) / (b.at - a.at));
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: a.s + (b.s - a.s) * t };
    }
  }
  return { x: last.x, y: last.y, s: last.s };
}

export function findKey(keys: readonly HeroKey[], at: number, axis: Axis): number {
  let best = -1;
  let bestD = Infinity;
  keys.forEach((k, i) => {
    const d = Math.abs(k.at - at);
    if (d <= TOLERANCE[axis] && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

function fencePositions(axis: Axis, at: number): [number, number] {
  const ladder = LADDER[axis];
  const [lo, hi] = FENCE[axis];
  const below = [...ladder].reverse().find((v) => v <= at * lo) ?? at * (lo - 0.05);
  const above = ladder.find((v) => v >= at * hi) ?? at * (hi + 0.05);
  return [roundAt(axis, below), roundAt(axis, above)];
}

/**
 * Set values on the key at `at` (creating it when none is there yet — like auto-keyframe).
 * The very first key of an element is fenced in by two neutral keys so that tuning one
 * resolution doesn't silently change every other one.
 */
export function setKey(
  keys: readonly HeroKey[] | undefined,
  axis: Axis,
  at: number,
  patch: Partial<HeroValue>,
): HeroKey[] {
  const list = (keys ?? []).map((k) => ({ ...k }));
  const idx = findKey(list, at, axis);
  if (idx >= 0) {
    list[idx] = clampKey({ ...list[idx], ...patch });
    return list;
  }
  const base = sampleKeys(list, at);
  if (list.length === 0) {
    const [lo, hi] = fencePositions(axis, at);
    list.push({ at: lo, ...NEUTRAL }, { at: hi, ...NEUTRAL });
  }
  list.push(clampKey({ at: roundAt(axis, at), x: base.x, y: base.y, s: base.s, ...patch }));
  return list.sort((a, b) => a.at - b.at);
}

export function removeKey(keys: readonly HeroKey[], index: number): HeroKey[] {
  return keys.filter((_, i) => i !== index).map((k) => ({ ...k }));
}

export function moveKey(keys: readonly HeroKey[], index: number, at: number, axis: Axis): HeroKey[] {
  const moved = { ...keys[index], at: roundAt(axis, at) };
  const rest = keys
    .filter((k, i) => i !== index && Math.abs(k.at - moved.at) > TOLERANCE[axis])
    .map((k) => ({ ...k }));
  return [...rest, moved].sort((a, b) => a.at - b.at);
}

function clampKey(k: HeroKey): HeroKey {
  const fin = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback);
  return { at: k.at, x: fin(k.x, 0), y: fin(k.y, 0), s: Math.min(8, Math.max(0.05, fin(k.s, 1))) };
}

/* ----------------------------- load / save ------------------------------ */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function normalizeLayout(raw: unknown, fallbackAxis: Axis): HeroLayoutControls {
  const out: HeroLayoutControls = { axis: fallbackAxis, elements: {} };
  if (!isObj(raw)) return out;
  if (raw.axis === 'width' || raw.axis === 'aspect') out.axis = raw.axis;
  if (isObj(raw.elements)) {
    for (const [id, list] of Object.entries(raw.elements)) {
      if (!Array.isArray(list)) continue;
      const keys: HeroKey[] = [];
      for (const k of list) {
        if (!isObj(k) || typeof k.at !== 'number' || !Number.isFinite(k.at)) continue;
        const key = clampKey({
          at: roundAt(out.axis, k.at),
          x: Number(k.x ?? 0),
          y: Number(k.y ?? 0),
          s: Number(k.s ?? 1),
        });
        if (!keys.some((o) => Math.abs(o.at - key.at) <= TOLERANCE[out.axis])) keys.push(key);
      }
      if (keys.length) out.elements[id] = keys.sort((a, b) => a.at - b.at);
    }
  }
  return out;
}

export function normalizeConfig(raw: unknown): HeroControlsConfig {
  const r = isObj(raw) ? raw : {};
  return {
    version: 1,
    desktop: normalizeLayout(r.desktop, 'width'),
    mobile: normalizeLayout(r.mobile, 'aspect'),
  };
}

export function serializeConfig(cfg: HeroControlsConfig): string {
  const round = (n: number, d: number) => Number(n.toFixed(d));
  const layout = (l: HeroLayoutControls) => ({
    axis: l.axis,
    elements: Object.fromEntries(
      Object.entries(l.elements)
        .filter(([, keys]) => keys.length > 0)
        .map(([id, keys]) => [
          id,
          keys.map((k) => ({ at: roundAt(l.axis, k.at), x: round(k.x, 3), y: round(k.y, 3), s: round(k.s, 4) })),
        ]),
    ),
  });
  return JSON.stringify({ version: 1, desktop: layout(cfg.desktop), mobile: layout(cfg.mobile) }, null, 2) + '\n';
}
