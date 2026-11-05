import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, X, Play, Pause, Volume2, VolumeX, ExternalLink } from 'lucide-react';
import type { VideoItem } from '../data/content';
import { playbackManager, type TilePhase } from '../utils/playbackManager';

// Some browsers (older Safari) cannot decode WebM at all. Detect once so those tiles show
// their thumbnail + "tap to open" instead of a dead, blank box.
const canPlayWebm = (() => {
  if (typeof document === 'undefined') return true;
  try {
    const v = document.createElement('video');
    return !!(v.canPlayType && (v.canPlayType('video/webm; codecs="vp9"') || v.canPlayType('video/webm')));
  } catch {
    return true;
  }
})();

/** how long a tile that has left the "warm" range keeps its decoder/buffers before they are freed */
const RELEASE_MS = typeof window !== 'undefined' && window.innerWidth < 768 ? 800 : 2500;

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type FsVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

const fullscreenElement = () => document.fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null;

interface VideoTileProps {
  item: VideoItem;
  title: string;
  aspectRatio?: 'video' | 'vertical';
  isShowreel?: boolean;
  className?: string;
}

export function VideoTile({ item, title, aspectRatio = 'video', isShowreel = false, className = '' }: VideoTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ReturnType<typeof playbackManager.register> | null>(null);
  const releaseTimer = useRef(0);
  const dragging = useRef(false);
  const intentBeforeFullscreen = useRef<'auto' | 'play'>('auto');

  const [phase, setPhase] = useState<TilePhase>('cold');
  const [ready, setReady] = useState(false); // a real video frame is on screen
  const [loaded, setLoaded] = useState(false); // data available -> progress bar is meaningful
  const [playing, setPlaying] = useState(false);
  // The showreel is started by an explicit click, so sound is allowed. Grid tiles autoplay
  // without a gesture, which browsers only allow while muted.
  const [muted, setMuted] = useState(!isShowreel);
  const [fullscreen, setFullscreen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [thumbMissing, setThumbMissing] = useState(false);

  const unsupported = /\.webm(\?|$)/i.test(item.src) && !canPlayWebm;
  const disabled = unsupported || failed;
  const vertical = aspectRatio === 'vertical';
  const aspectClasses = vertical ? 'aspect-[9/16]' : 'aspect-video';

  // grid tiles use the small preview clip when one exists; the full file is for fullscreen
  const playSrc = item.preview && !isShowreel && !fullscreen ? item.preview : item.src;

  /** attach (or switch) the source; never restarts a video that already has the right one */
  const applySource = useCallback((v: HTMLVideoElement, src: string, preload: 'metadata' | 'auto') => {
    v.preload = preload;
    if (v.getAttribute('src') === src) return;
    const resumeAt = v.currentTime || 0;
    v.src = src;
    if (resumeAt > 0.5) {
      v.addEventListener('loadedmetadata', () => { try { v.currentTime = resumeAt; } catch { /* not seekable yet */ } }, { once: true });
    }
  }, []);

  const playSafely = useCallback(async (v: HTMLVideoElement) => {
    try {
      await v.play();
    } catch (err) {
      // a browser that refuses sound without a gesture: fall back to muted rather than not playing
      if ((err as DOMException)?.name === 'NotAllowedError' && !v.muted) {
        v.muted = true;
        try { await v.play(); } catch { /* still blocked (e.g. iOS Low Power Mode): thumbnail + play button stay */ }
      }
    }
  }, []);

  // ---- register with the page-wide playback manager -----------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const video = videoRef.current;
    const handle = playbackManager.register({ el, autoplay: !isShowreel, disabled, onPhase: setPhase });
    handleRef.current = handle;
    return () => {
      handle.unregister();
      handleRef.current = null;
      window.clearTimeout(releaseTimer.current);
      if (video) playbackManager.releaseAudio(video);
    };
    // `disabled` changes are pushed through update() below, not by re-registering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShowreel]);

  useEffect(() => {
    handleRef.current?.update({ disabled });
  }, [disabled]);

  // sound defaults must be set as a property before the first play(); React's `muted` prop is unreliable
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !isShowreel;
  }, [isShowreel]);

  // ---- react to the phase the manager assigns ----------------------------------------
  useEffect(() => {
    const v = videoRef.current;
    if (!v || disabled) return;
    window.clearTimeout(releaseTimer.current);

    if (phase === 'cold') {
      // far away: free the decoder + buffers (after a short grace so a quick scroll-back is free)
      releaseTimer.current = window.setTimeout(() => {
        if (fullscreenElement() === containerRef.current) return;
        v.pause();
        v.removeAttribute('src');
        v.load();
        setReady(false);
        setLoaded(false);
        setPlaying(false);
      }, RELEASE_MS);
      return () => window.clearTimeout(releaseTimer.current);
    }

    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const eagerBuffer = isShowreel && window.innerWidth >= 768 && !saveData; // showreel: first seconds ready before the click
    applySource(v, playSrc, phase === 'active' || eagerBuffer ? 'auto' : 'metadata');

    if (phase === 'active') void playSafely(v);
    else v.pause();
    return () => window.clearTimeout(releaseTimer.current);
  }, [phase, playSrc, disabled, isShowreel, applySource, playSafely]);

  // ---- fullscreen (this tile only) ----------------------------------------------------
  useEffect(() => {
    const onChange = () => {
      const isMe = fullscreenElement() === containerRef.current;
      setFullscreen((prev) => {
        if (prev === isMe) return prev;
        handleRef.current?.setIntent(isMe ? 'play' : intentBeforeFullscreen.current);
        return isMe;
      });
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current as FsElement | null;
    const v = videoRef.current as FsVideo | null;
    if (!container || !v) return;

    if (fullscreenElement() === container) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else (document as FsDocument).webkitExitFullscreen?.();
      return;
    }
    intentBeforeFullscreen.current = isShowreel ? 'play' : 'auto';
    applySource(v, item.src, 'auto');
    if (container.requestFullscreen) void container.requestFullscreen().catch(() => {});
    else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
    else if (v.webkitEnterFullscreen) {
      // iPhone Safari cannot fullscreen an arbitrary element — hand the video to its native player
      void playSafely(v);
      v.webkitEnterFullscreen();
    }
  };

  // ---- click / keyboard ---------------------------------------------------------------
  const handleActivate = () => {
    if (disabled) {
      window.open(item.src, '_blank', 'noopener,noreferrer');
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      handleRef.current?.setIntent('pause'); // the visitor paused it: scrolling must not restart it
    } else {
      handleRef.current?.setIntent('play');
      applySource(v, playSrc, 'auto');
      void playSafely(v); // inside the click, so unmuted playback (showreel) is allowed
    }
  };

  const seekFromPointer = (e: React.PointerEvent) => {
    const v = videoRef.current;
    const bar = barRef.current;
    if (!v || !bar || !v.duration) return;
    const r = bar.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    v.currentTime = p * v.duration;
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
  };

  const thumbSrc = `/thumbnails/${item.thumb}.jpg`;
  const iconSize = vertical ? (fullscreen ? 'w-8 h-8' : 'w-4 h-4') : fullscreen ? 'w-10 h-10' : 'w-5 h-5';
  const ringSize = vertical ? (fullscreen ? 'w-20 h-20' : 'w-11 h-11') : fullscreen ? 'w-24 h-24' : 'w-14 h-14';

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label={`${title} — ${playing ? 'pause' : 'play'}`}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
      className={`relative group cursor-pointer ${aspectClasses} overflow-hidden transition-all duration-300 ${
        fullscreen ? 'fixed inset-0 z-[9999] !rounded-none !aspect-auto w-screen h-screen bg-black' : 'video-card'
      } ${className}`}
    >
      {/* Thumbnail — native lazy loading: the browser fetches it just before it scrolls into range */}
      {!thumbMissing && (
        <img
          src={thumbSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setThumbMissing(true)}
          className={`absolute inset-0 w-full h-full ${fullscreen ? 'object-contain' : 'object-cover'} transition-opacity duration-300 ${
            ready ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}

      {/* Video — has no source (so no decoder, no network) until the playback manager says so */}
      {!unsupported && (
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full ${fullscreen ? 'object-contain' : 'object-cover'} transition-opacity duration-300 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
          loop
          playsInline
          preload="none"
          onPlay={(e) => {
            setPlaying(true);
            if (!e.currentTarget.muted) playbackManager.claimAudio(e.currentTarget);
          }}
          onPlaying={() => setReady(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onLoadedData={() => setLoaded(true)}
          onVolumeChange={(e) => {
            const v = e.currentTarget;
            setMuted(v.muted);
            if (v.muted) playbackManager.releaseAudio(v);
            else if (!v.paused) playbackManager.claimAudio(v);
          }}
          onTimeUpdate={(e) => {
            // straight to the DOM: no React re-render per tick
            const v = e.currentTarget;
            if (dragging.current || !fillRef.current || !v.duration) return;
            fillRef.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
          }}
          onError={(e) => {
            // removing the source to free memory is not an error
            const v = e.currentTarget;
            if (!v.getAttribute('src')) return;
            setPlaying(false);
            setReady(false);
            setFailed(true);
          }}
        />
      )}

      {/* Gradient overlay — always on for mobile (title/controls are always visible there and need the contrast); hover-reveal on desktop */}
      {!fullscreen && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-10" />
      )}

      {/* Unsupported-format / playback-error badge */}
      {disabled && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-1.5 py-2 px-2 text-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <ExternalLink size={11} className="text-white/70 flex-shrink-0" />
          <span className="text-white/80 text-[10px] ibm-font uppercase tracking-wide">Preview unavailable here — tap to open</span>
        </div>
      )}

      {/* Play / pause */}
      {!unsupported && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div
            className={`rounded-full flex items-center justify-center transition-all duration-300 border border-white/20 ${ringSize} ${
              playing ? 'opacity-0 group-hover:opacity-100 bg-black/45' : 'opacity-100 bg-black/40'
            }`}
          >
            {playing ? <Pause className={`text-white ${iconSize}`} /> : <Play className={`text-white ml-0.5 ${iconSize}`} />}
          </div>
        </div>
      )}

      {/* Top controls */}
      {!fullscreen && !unsupported && (
        <div className="absolute top-3 right-3 flex gap-2 z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
          <button
            type="button"
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={(e) => {
              e.stopPropagation();
              if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
            }}
            className="w-8 h-8 rounded-full bg-black/65 flex items-center justify-center border border-white/15 hover:bg-black/80 transition-colors"
          >
            {muted ? <VolumeX size={13} className="text-white" /> : <Volume2 size={13} className="text-white" />}
          </button>
          <button
            type="button"
            aria-label="Fullscreen"
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full bg-black/65 flex items-center justify-center border border-white/15 hover:bg-black/80 transition-colors"
          >
            <Maximize2 size={13} className="text-white" />
          </button>
        </div>
      )}

      {/* Fullscreen close */}
      {fullscreen && (
        <button
          type="button"
          aria-label="Exit fullscreen"
          onClick={toggleFullscreen}
          className="absolute top-6 right-6 w-12 h-12 bg-black/60 rounded-full flex items-center justify-center z-30 border border-white/20"
        >
          <X size={20} className="text-white" />
        </button>
      )}

      {/* Progress bar */}
      {loaded && !unsupported && (
        <div
          ref={barRef}
          className={`absolute left-0 right-0 cursor-pointer z-30 group/bar ${
            fullscreen ? 'bottom-16 h-1.5' : 'bottom-0 h-1.5 opacity-100 md:h-0.5 md:opacity-0 md:group-hover:opacity-100'
          } transition-all duration-300`}
          style={{ background: 'rgba(255,255,255,0.15)', touchAction: 'none' }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            seekFromPointer(e);
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return;
            e.stopPropagation();
            seekFromPointer(e);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            dragging.current = false;
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            dragging.current = false;
          }}
        >
          <div
            ref={fillRef}
            className="h-full w-full group-hover/bar:bg-amber-400"
            style={{ transform: 'scaleX(0)', transformOrigin: 'left center', background: 'rgba(255,255,255,0.8)' }}
          />
        </div>
      )}

      {/* Title badge */}
      <div
        className={`absolute bottom-3 left-3 z-20 transition-all duration-300 pointer-events-none ${
          fullscreen ? 'opacity-100 bottom-8 left-8' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
        }`}
      >
        <span className="syne text-white text-xs font-semibold bg-black/60 px-2.5 py-1 rounded-full tracking-wide uppercase border border-white/10">
          {title}
        </span>
      </div>
    </div>
  );
}

export default VideoTile;
