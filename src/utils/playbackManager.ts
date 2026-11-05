/**
 * PLAYBACK MANAGER — how the page keeps ~22 video tiles light.
 *
 * Every tile always shows its thumbnail. On top of that each tile is, at any moment, in
 * exactly one of three phases, decided here for the whole page:
 *
 *   cold    far from the screen. No network, no decoder, no buffered data.
 *   warm    close to the screen (about one and a half screens away) or visible but out of
 *           budget. Only the first bytes / metadata are fetched, so it can start instantly.
 *   active  playing. Only the few tiles nearest the centre of the screen get this.
 *
 * Why: the old build started every visible tile at once (12+ simultaneous decoders on a
 * reel row). Past 3-6 concurrent decodes every video starves, the main thread stalls and
 * scrolling lags. A budget keeps the motion you see smooth, and the thumbnails of the
 * rest are visually identical to a paused first frame.
 *
 * One scroll listener + a handful of getBoundingClientRect() calls (<=22) per ~100 ms
 * replaces the 3 IntersectionObservers per tile and the two timed queues.
 */

export type TilePhase = 'cold' | 'warm' | 'active';
/** 'auto': follow the budget · 'play': the visitor pressed play · 'pause': the visitor paused it */
export type TileIntent = 'auto' | 'play' | 'pause';

export interface TileHandle {
  el: HTMLElement;
  /** may start by itself when on screen (reels / projects). The showreel only starts on click. */
  autoplay: boolean;
  /** this browser cannot decode the file at all (e.g. WebM on old Safari) */
  disabled: boolean;
  onPhase: (phase: TilePhase) => void;
}

interface Entry extends TileHandle {
  phase: TilePhase;
  intent: TileIntent;
}

/** how many tiles may play at once — tuned to what decoders can really sustain */
export function playBudget(): number {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const width = window.innerWidth;
  let n = width < 768 ? 3 : width < 1100 ? 4 : 6;
  if (nav.connection?.saveData) n = Math.min(n, 2);
  if (nav.deviceMemory && nav.deviceMemory <= 2) n = Math.min(n, 2);
  if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) n = Math.min(n, 3);
  return n;
}

/** how many extra tiles pre-buffer (metadata only) so the next ones start instantly */
const warmBudget = () => (window.innerWidth < 768 ? 2 : 3);
/** a tile counts as "warm range" within this many viewport heights of the screen */
const WARM_RANGE = 1.5;
/** share of a tile that must be on screen before it may autoplay */
const MIN_VISIBLE = 0.25;
/** bonus (px) for tiles that are already playing, so two tiles never swap places on a hair */
const STICKY_PX = 90;
const MIN_INTERVAL_MS = 90;

class PlaybackManager {
  private entries = new Set<Entry>();
  private timer = 0;
  private lastRun = 0;
  private listening = false;
  private audible: HTMLVideoElement | null = null;
  /** pre-buffering waits until the hero has finished loading, so it never competes with it */
  private warmAllowed = typeof document !== 'undefined' && document.readyState === 'complete';

  register(handle: TileHandle) {
    const entry: Entry = { ...handle, phase: 'cold', intent: 'auto' };
    this.entries.add(entry);
    this.listen();
    this.schedule();
    return {
      setIntent: (intent: TileIntent) => {
        entry.intent = intent;
        this.schedule(true);
      },
      update: (patch: Partial<Pick<TileHandle, 'autoplay' | 'disabled'>>) => {
        Object.assign(entry, patch);
        this.schedule(true);
      },
      unregister: () => {
        this.entries.delete(entry);
        if (this.entries.size === 0) this.unlisten();
      },
    };
  }

  /** only one video on the page may ever be audible */
  claimAudio(video: HTMLVideoElement) {
    if (this.audible && this.audible !== video && !this.audible.paused) this.audible.muted = true;
    this.audible = video;
  }

  releaseAudio(video: HTMLVideoElement) {
    if (this.audible === video) this.audible = null;
  }

  private listen() {
    if (this.listening) return;
    this.listening = true;
    if (!this.warmAllowed) {
      window.addEventListener(
        'load',
        () => window.setTimeout(() => { this.warmAllowed = true; this.schedule(true); }, 800),
        { once: true },
      );
    }
    window.addEventListener('scroll', this.onEvent, { passive: true });
    window.addEventListener('resize', this.onEvent, { passive: true });
    document.addEventListener('visibilitychange', this.onEvent);
  }

  private unlisten() {
    this.listening = false;
    window.removeEventListener('scroll', this.onEvent);
    window.removeEventListener('resize', this.onEvent);
    document.removeEventListener('visibilitychange', this.onEvent);
    window.clearTimeout(this.timer);
    this.timer = 0;
  }

  private onEvent = () => this.schedule();

  private schedule(immediate = false) {
    if (this.timer) return;
    const wait = immediate ? 0 : Math.max(0, MIN_INTERVAL_MS - (performance.now() - this.lastRun));
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      requestAnimationFrame(this.evaluate);
    }, wait);
  }

  private evaluate = () => {
    this.lastRun = performance.now();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tabHidden = document.hidden;

    const rows = [...this.entries].map((entry) => {
      const r = entry.el.getBoundingClientRect();
      const visibleH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const visibleW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const area = Math.max(1, r.width * r.height);
      return {
        entry,
        fraction: (visibleH * visibleW) / area,
        centerDist: Math.abs((r.top + r.bottom) / 2 - vh / 2),
        outside: r.bottom < 0 ? -r.bottom : r.top > vh ? r.top - vh : 0,
      };
    });

    const next = new Map<Entry, TilePhase>();
    rows.forEach((row) => next.set(row.entry, 'cold'));

    const fullscreenEl =
      document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ?? null;

    if (fullscreenEl) {
      // one tile fills the screen: it alone plays, everything else just pauses (keeps its buffer)
      rows.forEach(({ entry }) => {
        if (entry.el === fullscreenEl && !entry.disabled) next.set(entry, 'active');
        else if (entry.phase !== 'cold') next.set(entry, 'warm');
      });
    } else if (!tabHidden) {
      // 1) tiles the visitor pressed play on always play while they are on screen
      const forced = rows.filter((r) => !r.entry.disabled && r.entry.intent === 'play' && r.fraction > 0);
      forced.forEach((r) => next.set(r.entry, 'active'));

      // 2) the rest of the budget goes to autoplay tiles nearest the centre of the screen
      const room = Math.max(0, playBudget() - forced.length);
      rows
        .filter(
          (r) =>
            r.entry.autoplay &&
            !r.entry.disabled &&
            r.entry.intent === 'auto' &&
            r.fraction >= MIN_VISIBLE,
        )
        .sort(
          (a, b) =>
            a.centerDist - (a.entry.phase === 'active' ? STICKY_PX : 0) -
            (b.centerDist - (b.entry.phase === 'active' ? STICKY_PX : 0)),
        )
        .slice(0, room)
        .forEach((r) => next.set(r.entry, 'active'));

      // 3) the nearest remaining tiles pre-buffer, so they can start the instant they're needed
      const anyVisible = rows.some((r) => r.fraction > 0);
      rows
        .filter(
          (r) =>
            (this.warmAllowed || anyVisible) &&
            !r.entry.disabled &&
            next.get(r.entry) === 'cold' &&
            r.outside <= vh * WARM_RANGE,
        )
        .sort((a, b) => a.outside - b.outside || a.centerDist - b.centerDist)
        .slice(0, warmBudget())
        .forEach((r) => next.set(r.entry, 'warm'));
    }

    next.forEach((phase, entry) => {
      if (entry.phase !== phase) {
        entry.phase = phase;
        entry.onPhase(phase);
      }
    });
  };
}

export const playbackManager = new PlaybackManager();
