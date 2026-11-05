import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import './heroController.css';
import {
  axisValue,
  findKey,
  formatAt,
  HERO_ELEMENTS,
  moveKey,
  removeKey,
  sampleKeys,
  serializeConfig,
  setKey,
  type Axis,
  type HeroElementDef,
  type HeroValue,
} from '../utils/heroControls';
import { heroControlsStore } from '../utils/heroControlsStore';
import { resolveNodes, visualRect } from '../utils/heroDom';
import type { LayoutMode } from '../utils/layout';

/**
 * HERO CONTROLLER — open with ?controller in the URL or Alt+Shift+H.
 * Loaded lazily (see App.tsx), so visitors never download any of it.
 *
 *  - click an element on the hero (or pick it in the list), then drag it / use the fields
 *  - every change is a keyframe at the CURRENT window size ("auto-key")
 *  - Copy / Download JSON → replace src/data/heroControls.json → build & deploy
 */

const GROUPS: HeroElementDef['group'][] = ['Photos', 'Name', 'Testimonials', 'Other'];
const round = (n: number, d = 3) => Number(n.toFixed(d));

const useViewport = () => {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
};

interface FieldProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (v: number) => void;
}

function Field({ label, unit, value, min, max, step, disabled, onChange }: FieldProps) {
  return (
    <label className="hc-field">
      <span className="hc-field-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="hc-field-num">
        <input
          type="number"
          step={step}
          value={round(value, 3)}
          disabled={disabled}
          onChange={(e) => Number.isFinite(e.target.valueAsNumber) && onChange(e.target.valueAsNumber)}
        />
        <i>{unit}</i>
      </span>
    </label>
  );
}

export default function HeroController({ layout }: { layout: LayoutMode }) {
  const cfg = useSyncExternalStore(heroControlsStore.subscribe, heroControlsStore.getConfig);
  const vp = useViewport();

  const defs = HERO_ELEMENTS[layout];
  const [selected, setSelected] = useState<string | null>('nameFirst');
  const [pick, setPick] = useState(true);
  const [mini, setMini] = useState(false);
  const [dock, setDock] = useState<'left' | 'right'>('right');
  const [note, setNote] = useState('');

  const lc = cfg[layout];
  const def = defs.find((d) => d.id === selected) ?? null;
  const keys = (def && lc.elements[def.id]) || [];
  const at = axisValue(lc.axis, vp.w, vp.h);
  const keyIdx = findKey(keys, at, lc.axis);
  const value: HeroValue = sampleKeys(keys, at);
  const dirty = heroControlsStore.isDirty();

  /* ---- editing ---- */
  const edit = useCallback(
    (id: string, fn: (v: HeroValue) => Partial<HeroValue>) => {
      heroControlsStore.mutate(layout, (l) => {
        const a = axisValue(l.axis, window.innerWidth, window.innerHeight);
        const v = sampleKeys(l.elements[id], a);
        l.elements[id] = setKey(l.elements[id], l.axis, a, fn(v));
      });
    },
    [layout],
  );

  const resetElement = () => {
    if (!def) return;
    heroControlsStore.mutate(layout, (l) => {
      delete l.elements[def.id];
    });
  };

  const setAxis = (axis: Axis) => {
    if (axis === lc.axis) return;
    const hasKeys = Object.keys(lc.elements).length > 0;
    if (hasKeys && !window.confirm('Switching the axis clears the keyframes of this hero (the other hero is untouched). Continue?')) return;
    heroControlsStore.mutate(layout, (l) => {
      l.axis = axis;
      l.elements = {};
    });
  };

  /* ---- selection outline ---- */
  const outlineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = outlineRef.current;
      if (!el) return;
      const d = defs.find((x) => x.id === selected);
      const r = d ? visualRect(resolveNodes(d)) : null;
      if (!r) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.transform = `translate(${r.left - 4}px, ${r.top - 4}px)`;
      el.style.width = `${r.width + 8}px`;
      el.style.height = `${r.height + 8}px`;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [defs, selected]);

  /* ---- pick + drag on the hero ---- */
  const drag = useRef<{ id: string; x: number; y: number } | null>(null);

  const hitTest = (x: number, y: number): HeroElementDef | null => {
    let best: HeroElementDef | null = null;
    let bestArea = Infinity;
    for (const d of defs) {
      if (!d.pick) continue;
      const r = visualRect(resolveNodes(d));
      if (!r) continue;
      if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) {
        const area = r.width * r.height;
        if (area < bestArea) {
          best = d;
          bestArea = area;
        }
      }
    }
    return best;
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) {
      setSelected(null);
      return;
    }
    setSelected(hit.id);
    drag.current = { id: hit.id, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = ((e.clientX - d.x) / window.innerWidth) * 100;
    const dy = ((e.clientY - d.y) / window.innerHeight) * 100;
    d.x = e.clientX;
    d.y = e.clientY;
    edit(d.id, (v) => ({ x: v.x + dx, y: v.y + dy }));
  };
  const onUp = () => {
    drag.current = null;
  };

  /* ---- keyboard: arrows nudge, + / - scale, Esc deselects ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (!selected) return;
      const step = e.shiftKey ? 1 : 0.1;
      const grow = e.shiftKey ? 0.05 : 0.01;
      const map: Record<string, (v: HeroValue) => Partial<HeroValue>> = {
        ArrowLeft: (v) => ({ x: v.x - step }),
        ArrowRight: (v) => ({ x: v.x + step }),
        ArrowUp: (v) => ({ y: v.y - step }),
        ArrowDown: (v) => ({ y: v.y + step }),
        '+': (v) => ({ s: v.s + grow }),
        '=': (v) => ({ s: v.s + grow }),
        '-': (v) => ({ s: v.s - grow }),
      };
      if (e.key === 'Escape') return setSelected(null);
      const fn = map[e.key];
      if (!fn) return;
      e.preventDefault();
      edit(selected, fn);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, edit]);

  /* ---- export ---- */
  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(''), 2200);
  };
  const copy = async () => {
    const text = serializeConfig(cfg);
    try {
      await navigator.clipboard.writeText(text);
      flash('Copied — paste into src/data/heroControls.json');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      flash('Copied — paste into src/data/heroControls.json');
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([serializeConfig(cfg)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'heroControls.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const aspect = vp.w / vp.h;
  const grouped = GROUPS.map((g) => ({ g, items: defs.filter((d) => d.group === g) })).filter((x) => x.items.length);
  const hasKeys = (id: string) => (lc.elements[id]?.length ?? 0) > 0;

  return createPortal(
    <>
      {pick && (
        <div
          className="hc-overlay"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      )}
      <div ref={outlineRef} className="hc-outline" />

      <aside className={`hc-panel hc-${dock}${mini ? ' hc-mini' : ''}`} aria-label="Hero controller">
        <header className="hc-head">
          <div>
            <strong>Hero controller</strong>
            <span className="hc-vp">
              {vp.w} × {vp.h} · {aspect.toFixed(2)} · {layout === 'mobile' ? 'phone hero' : 'landscape hero'}
            </span>
          </div>
          <div className="hc-head-btns">
            <button type="button" title="Move panel to the other side" onClick={() => setDock(dock === 'right' ? 'left' : 'right')}>⇄</button>
            <button type="button" title={mini ? 'Expand' : 'Minimise'} onClick={() => setMini(!mini)}>{mini ? '▢' : '–'}</button>
            <button type="button" title="Close (Alt+Shift+H)" onClick={() => heroControlsStore.setEnabled(false)}>✕</button>
          </div>
        </header>

        {!mini && (
          <div className="hc-body">
            <div className="hc-row">
              <span className="hc-label">Keyframe by</span>
              <div className="hc-seg">
                <button type="button" className={lc.axis === 'width' ? 'on' : ''} onClick={() => setAxis('width')}>Screen width</button>
                <button type="button" className={lc.axis === 'aspect' ? 'on' : ''} onClick={() => setAxis('aspect')}>Aspect ratio</button>
              </div>
            </div>
            <label className="hc-check">
              <input type="checkbox" checked={pick} onChange={(e) => setPick(e.target.checked)} />
              Click &amp; drag elements on the hero
            </label>

            <div className="hc-list">
              {grouped.map(({ g, items }) => (
                <div key={g}>
                  <div className="hc-group">{g}</div>
                  <div className="hc-chips">
                    {items.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`hc-chip${selected === d.id ? ' on' : ''}${hasKeys(d.id) ? ' keyed' : ''}`}
                        onClick={() => setSelected(d.id)}
                        title={d.label}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {def ? (
              <section className="hc-edit">
                <div className="hc-edit-title">
                  {def.label}
                  <button type="button" className="hc-link" onClick={resetElement} disabled={keys.length === 0}>Reset element</button>
                </div>
                <p className="hc-state">
                  {keyIdx >= 0
                    ? `Editing the key at ${formatAt(lc.axis, keys[keyIdx].at)}`
                    : keys.length === 0
                      ? `Not adjusted. Any change adds a key at ${formatAt(lc.axis, at)}`
                      : `Gliding between keys. Any change adds a key at ${formatAt(lc.axis, at)}`}
                </p>
                <Field label="X" unit="%" value={value.x} min={-25} max={25} step={0.05} disabled={false} onChange={(x) => edit(def.id, () => ({ x }))} />
                <Field label="Y" unit="%" value={value.y} min={-25} max={25} step={0.05} disabled={false} onChange={(y) => edit(def.id, () => ({ y }))} />
                <Field
                  label="Size"
                  unit="%"
                  value={value.s * 100}
                  min={30}
                  max={250}
                  step={0.5}
                  disabled={false}
                  onChange={(p) => edit(def.id, () => ({ s: p / 100 }))}
                />

                {keys.length > 0 && (
                  <div className="hc-keys">
                    <div className="hc-keys-head">Keys · resize the window to a key to edit it</div>
                    {keys.map((k, i) => (
                      <div key={`${i}-${k.at}`} className={`hc-key${i === keyIdx ? ' now' : ''}`}>
                        <input
                          type="number"
                          step={lc.axis === 'width' ? 1 : 0.01}
                          defaultValue={k.at}
                          key={k.at}
                          title={lc.axis === 'width' ? 'screen width in px' : 'width / height'}
                          onBlur={(e) => {
                            const n = e.target.valueAsNumber;
                            if (!Number.isFinite(n) || n <= 0 || n === k.at) return;
                            heroControlsStore.mutate(layout, (l) => {
                              l.elements[def.id] = moveKey(l.elements[def.id], i, n, l.axis);
                            });
                          }}
                        />
                        <span>{round(k.x, 2)}, {round(k.y, 2)}</span>
                        <span>{Math.round(k.s * 100)}%</span>
                        <button
                          type="button"
                          title="Delete key"
                          onClick={() =>
                            heroControlsStore.mutate(layout, (l) => {
                              const next = removeKey(l.elements[def.id], i);
                              if (next.length) l.elements[def.id] = next;
                              else delete l.elements[def.id];
                            })
                          }
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <p className="hc-hint">Click an element on the hero, or pick one above.</p>
            )}

            <footer className="hc-foot">
              <div className="hc-foot-btns">
                <button type="button" onClick={copy}>Copy JSON</button>
                <button type="button" onClick={download}>Download</button>
                <button
                  type="button"
                  className="ghost"
                  disabled={!dirty}
                  onClick={() => window.confirm('Discard your unsaved changes?') && heroControlsStore.resetDraft()}
                >
                  Discard
                </button>
              </div>
              <p className="hc-hint">
                {note || (dirty ? 'Unsaved draft (kept in this browser). Copy / download it, put it in src/data/heroControls.json, then build.' : 'No changes yet.')}
              </p>
              <p className="hc-hint">Arrows nudge 0.1% (Shift 1%) · + / − resize · Esc deselects</p>
            </footer>
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
}
