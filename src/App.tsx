import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ClickWrapper } from './components/ClickWrapper';
import { scrollToSelector } from './utils/dom';
import { HeroDesign } from './components/HeroDesign';
import { Portfolio } from './components/Portfolio';
import { ContactSection } from './components/ContactSection';
import { useHeroControls } from './hooks/useHeroControls';
import { useHeroMorph } from './hooks/useHeroMorph';
import { useLayoutMode } from './hooks/useLayoutMode';
import { useScrollStage } from './hooks/useScrollStage';
import { HERO_CANVAS } from './utils/heroControls';
import { heroControlsStore } from './utils/heroControlsStore';
import { loadHeroHtml } from './utils/heroHtml';
import type { LayoutMode } from './utils/layout';

// Fixed canvas sizes of the exported hero designs
const HERO_DESKTOP = { width: HERO_CANVAS.desktop.w, height: HERO_CANVAS.desktop.h };
const HERO_MOBILE = { width: HERO_CANVAS.mobile.w, height: HERO_CANVAS.mobile.h };

// The hero controller (see NOTES.md) is a separate chunk: visitors never download it.
const HeroController = lazy(() => import('./components/HeroController'));

const desktopImages = [
  { src: '/pc/me.webp', morph: 'hero-rig-figure', zIndex: 2, extra: 'hero-img-me' },
  { src: '/pc/me2.webp', morph: 'hero-me2', zIndex: 3, extra: 'hero-img-me2' },
];

function App() {
  const layout = useLayoutMode();
  const mobile = layout === 'mobile';

  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroHtml, setHeroHtml] = useState<{ mode: LayoutMode; html: string } | null>(null);

  useHeroMorph(mobile);
  useScrollStage({ stageRef, heroRef, parallax: !mobile });

  // Only the hero design for the active composition is fetched (and it is usually already
  // in flight from <head>). Switching composition on resize fetches the other one once.
  useEffect(() => {
    let cancelled = false;
    let retry = 0;
    const load = (attempt: number) => {
      loadHeroHtml(layout)
        .then((html) => !cancelled && setHeroHtml({ mode: layout, html }))
        .catch(() => {
          if (!cancelled && attempt < 3) retry = window.setTimeout(() => load(attempt + 1), 1200 * (attempt + 1));
        });
    };
    load(0);
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
  }, [layout]);

  const html = heroHtml?.mode === layout ? heroHtml.html : null;

  useHeroControls(layout, html);
  const controllerOpen = useSyncExternalStore(heroControlsStore.subscribe, heroControlsStore.getEnabled);

  return (
    <div ref={stageRef} className="stage relative hero-ready">
      {/* The fixed background lives in index.html (so it paints before any JavaScript runs) */}

      {/* Hero — stays fixed while the portfolio panel rises over it */}
      <div ref={heroRef} className="hero-stage screen-h relative w-full overflow-hidden bg-transparent">
        {mobile && (
          <div>
            <ClickWrapper
              glowColor="rgba(201,168,76,0.3)"
              noHover
              className="mobile-image hero-image-layer fixed overflow-hidden"
              style={{ inset: 0, width: '100%', height: '100%', zIndex: 11 }}
            >
              <img src="/mobile/mbme.webp" alt="" decoding="async" fetchPriority="high" className="hc-mobile-figure w-full h-full object-contain" />
            </ClickWrapper>

            {html && (
              <HeroDesign
                html={html}
                width={HERO_MOBILE.width}
                height={HERO_MOBILE.height}
                fit="contain"
                className="mobile-image hero-image-layer fixed hero-enter"
                style={{ inset: 0, width: '100%', height: '100%', zIndex: 20 }}
              />
            )}
          </div>
        )}

        {!mobile && (
          <div>
            {desktopImages.map((img) => (
              <ClickWrapper
                key={img.src}
                glowColor="rgba(201,168,76,0.3)"
                noHover
                className="desktop-image hero-image-layer hero-parallax fixed overflow-hidden"
                style={{ inset: 0, width: '100%', height: '100%', zIndex: img.zIndex, animation: 'none', pointerEvents: 'none' }}
              >
                <div className={`w-full h-full ${img.morph}`}>
                  <img src={img.src} alt="" decoding="async" fetchPriority="high" className={`w-full h-full object-contain ${img.extra}`} />
                </div>
              </ClickWrapper>
            ))}

            {/* Title — rendered behind me.webp */}
            {html && (
              <HeroDesign
                html={html}
                width={HERO_DESKTOP.width}
                height={HERO_DESKTOP.height}
                fit="contain"
                group
                hideTestimonials
                className="desktop-image hero-image-layer fixed hero-design-text hero-enter"
                style={{ inset: 0, width: '100%', height: '100%', zIndex: 1 }}
              />
            )}

            {/* Testimonials — rendered on top */}
            {html && (
              <HeroDesign
                html={html}
                width={HERO_DESKTOP.width}
                height={HERO_DESKTOP.height}
                fit="contain"
                group
                hideTitle
                className="desktop-image hero-image-layer fixed hero-design-text hero-enter"
                style={{ inset: 0, width: '100%', height: '100%', zIndex: 20 }}
              />
            )}
          </div>
        )}

        {/* Scroll indicator */}
        <div className="hc-scroll-hint hero-enter absolute bottom-4 sm:bottom-6 md:bottom-8 left-0 right-0 z-[60] flex justify-center pointer-events-none">
          <button
            className="scroll-indicator group flex flex-col items-center gap-4 pointer-events-auto"
            onClick={() => scrollToSelector('#portfolio')}
            aria-label="Scroll to portfolio"
          >
            <span className="scroll-indicator-label ibm-font">SCROLL</span>
            <span className="scroll-indicator-track">
              <span className="scroll-indicator-dot" />
            </span>
          </button>
        </div>
      </div>

      <Portfolio mobile={mobile} />

      {/* Closing runway: one viewport of scroll AFTER the panel. As the panel lifts away over
          it, the fixed contact section behind is uncovered — completely, on any screen size. */}
      <div className="contact-runway" aria-hidden="true" />

      <ContactSection />

      {controllerOpen && (
        <Suspense fallback={null}>
          <HeroController layout={layout} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
