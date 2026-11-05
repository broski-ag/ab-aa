import { forwardRef, useRef } from 'react';
import { ClickWrapper } from './ClickWrapper';
import { VideoTile } from './VideoTile';
import { useInView } from '../hooks/useInView';
import { useAfterFirstPaint } from '../hooks/useAfterFirstPaint';
import { featuredVideos, showreel, skills, socialVideos, stats, type VideoItem } from '../data/content';

const SectionTitle = ({ target, label }: { target: string; label: string }) => (
  <ClickWrapper scrollTo={target} glowColor="rgba(201,168,76,0.3)" className="section-rule section-rule-interactive">
    <span className="syne text-sm font-semibold tracking-[0.25em] uppercase text-black/40 flex items-center gap-2">
      <span className="gold-dot" />
      {label}
    </span>
  </ClickWrapper>
);

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Same box as a VideoTile (same classes, same aspect ratio), so the page is exactly as tall
 * before the real tiles mount as after — no layout shift — but nearly free to render. The
 * tiles take over right after the hero's first paint.
 */
function Tile({ ready, item, title, aspectRatio, isShowreel }: { ready: boolean; item: VideoItem; title: string; aspectRatio?: 'video' | 'vertical'; isShowreel?: boolean }) {
  if (ready) return <VideoTile item={item} title={title} aspectRatio={aspectRatio} isShowreel={isShowreel} />;
  return <div className={`relative overflow-hidden video-card ${aspectRatio === 'vertical' ? 'aspect-[9/16]' : 'aspect-video'}`} />;
}

/**
 * The portfolio panel. It is an ordinary in-flow block: the page's own scrolling is what
 * lifts it over the hero, so there is nothing here that depends on screen size.
 */
export const Portfolio = forwardRef<HTMLElement, { mobile: boolean }>(function Portfolio({ mobile }, ref) {
  const statsRef = useRef<HTMLDivElement>(null);
  const statsVisible = useInView(statsRef);
  const tilesReady = useAfterFirstPaint();

  return (
    <main
      ref={ref}
      id="portfolio"
      className="relative w-full portfolio-panel z-[99] screen-min-h"
      style={{
        boxShadow: mobile
          ? '0 -10px 30px -5px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.4)'
          : '0 -30px 80px -10px rgba(255,255,255,0.12), 0 -60px 120px -20px rgba(201,168,76,0.06), inset 0 1px 0 rgba(255,255,255,0.6), 0 30px 80px -10px rgba(0,0,0,0.35)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-20">
        {/* Header */}
        <div className="text-center mb-20">
          <h2
            className="syne text-black/90 mb-5 leading-none"
            style={{ fontSize: 'clamp(3rem, 8vw, 7rem)', letterSpacing: '0.04em' }}
          >
            PORTFOLIO
          </h2>

          <p className="ibm-font text-black/55 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            Visual stories crafted to move people — from scroll-stopping reels to brand-defining films.
          </p>

          {/* Skill tags */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {skills.map((name) => (
              <ClickWrapper key={name} glowColor="rgba(201,168,76,0.3)" className="tag-pill">
                {name}
              </ClickWrapper>
            ))}
          </div>
        </div>

        {/* Stats row — its looping glow animations only run while it is on screen */}
        <div
          ref={statsRef}
          data-inview={statsVisible}
          className="stats-row grid grid-cols-2 md:grid-cols-4 gap-4 mb-20"
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="stat-card"
              style={{
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.07)',
                animationDelay: `${i * 0.4}s`,
                borderRadius: '1rem',
                padding: '1.5rem',
                textAlign: 'center',
              }}
            >
              <div
                className="syne font-bold text-black/90 stat-number-pulse"
                style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', animationDelay: `${i * 0.4}s` }}
              >
                {s.value}
              </div>
              <div className="ibm-font text-xs uppercase tracking-widest mt-1" style={{ color: 'var(--warm-gray)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Showreel */}
        <div className="mb-20">
          <SectionTitle target="#showreel" label="SHOW REEL" />
          <div id="showreel" className="max-w-5xl mx-auto rounded-2xl overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <Tile ready={tilesReady} item={showreel} title="SHOW REEL 2026" isShowreel />
          </div>
        </div>

        {/* Social Content */}
        <div className="mb-20">
          <SectionTitle target="#social" label="SOCIAL CONTENT" />
          <div id="social" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {socialVideos.map((item, i) => (
              <Tile key={item.src} ready={tilesReady} item={item} title={`REEL ${pad(i + 1)}`} aspectRatio="vertical" />
            ))}
          </div>
        </div>

        {/* Featured Work */}
        <div className="mb-20">
          <SectionTitle target="#featured" label="FEATURED WORK" />
          <div id="featured" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredVideos.map((item, i) => (
              <Tile key={item.src} ready={tilesReady} item={item} title={`PROJECT ${pad(i + 1)}`} />
            ))}
          </div>
        </div>

        {/* Bottom disclaimer */}
        <p className="text-center ibm-font text-xs mt-12 pb-4">
          All content is original work. Brands and clients belong to their respective owners.
        </p>
      </div>
    </main>
  );
});
