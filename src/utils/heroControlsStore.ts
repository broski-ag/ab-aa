import raw from '../data/heroControls.json';
import {
  normalizeConfig,
  serializeConfig,
  type HeroControlsConfig,
  type HeroLayoutControls,
} from './heroControls';
import type { LayoutMode } from './layout';

/**
 * Tiny external store for the hero controller.
 *
 *  - `committed` is what ships: src/data/heroControls.json.
 *  - While the controller is open, edits go to a `draft` (kept in this browser's
 *    localStorage so a reload doesn't lose work). Visitors never get a draft.
 */

const DRAFT_KEY = 'hero-controls-draft-v1';
const PARAM = 'controller';

const committed: HeroControlsConfig = normalizeConfig(raw);
let draft: HeroControlsConfig | null = null;
let enabled = false;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const clone = (c: HeroControlsConfig): HeroControlsConfig => JSON.parse(JSON.stringify(c));

function loadDraft(): HeroControlsConfig {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored) return normalizeConfig(JSON.parse(stored));
  } catch {
    /* storage blocked or corrupt — start from the saved config */
  }
  return clone(committed);
}

function saveDraft() {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, serializeConfig(draft));
  } catch {
    /* ignore */
  }
}

function syncUrl(on: boolean) {
  try {
    const url = new URL(window.location.href);
    if (on) url.searchParams.set(PARAM, '1');
    else url.searchParams.delete(PARAM);
    window.history.replaceState(null, '', url);
  } catch {
    /* ignore */
  }
}

export const heroControlsStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  /** the config the hero should currently render with */
  getConfig: (): HeroControlsConfig => (enabled && draft ? draft : committed),
  getCommitted: (): HeroControlsConfig => committed,
  getEnabled: (): boolean => enabled,

  isDirty: () => !!draft && serializeConfig(draft) !== serializeConfig(committed),

  /** open / close the controller (also mirrors ?controller=1 in the address bar) */
  setEnabled(on: boolean) {
    if (on === enabled) return;
    enabled = on;
    draft = on ? loadDraft() : null;
    syncUrl(on);
    emit();
  },

  /** called once at start-up: opens the controller when the URL asks for it */
  initFromUrl() {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).has(PARAM)) {
      enabled = true;
      draft = loadDraft();
      emit();
    }
  },

  mutate(layout: LayoutMode, fn: (l: HeroLayoutControls) => void) {
    if (!draft) return;
    const next = clone(draft);
    fn(next[layout]);
    draft = next;
    saveDraft();
    emit();
  },

  /** throw the draft away and go back to the saved config */
  resetDraft() {
    draft = clone(committed);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    emit();
  },
};
