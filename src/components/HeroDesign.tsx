import { useEffect, useRef, useMemo } from 'react';

interface HeroDesignProps {
  html: string;
  width: number;
  height: number;
  fit?: 'cover' | 'contain';
  group?: boolean;
  hideTitle?: boolean;
  hideTestimonials?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// The desktop design is rendered twice (title behind the figure, testimonials in front of
// it). Each variant is parsed once and shared, whichever instance asks first.
const processedCache = new Map<string, { source: string; result: string }>();

export function HeroDesign({
  html,
  width,
  height,
  fit = 'cover',
  group = false,
  hideTitle = false,
  hideTestimonials = false,
  className = '',
  style,
}: HeroDesignProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Process the HTML once with DOMParser: strip the unwanted group's
  // elements and wrap the rest in group divs — all at the string level
  // so only the needed layers end up in the real DOM. This avoids
  // injecting the full 57 KB desktop HTML twice (once for title, once
  // for testimonials) and avoids runtime querySelector/manipulation.
  const processedHtml = useMemo(() => {
    if (!group || (!hideTitle && !hideTestimonials)) return html;

    const cacheKey = hideTitle ? 'testimonials' : 'title';
    const cached = processedCache.get(cacheKey);
    if (cached && cached.source === html) return cached.result;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const page = doc.querySelector('.page');
    if (!page) return html;

    page.setAttribute(
      'style',
      (page.getAttribute('style') || '').replace('overflow: hidden', 'overflow: visible'),
    );

    const titleIds = new Set(['text_2', 'text_3']);
    const testimonialIds = new Set([
      'text_4', 'text_5', 'text_6', 'text_7', 'text_8', 'text_9', 'text_10',
      'text_11', 'text_12', 'text_13', 'text_14', 'text_15', 'text_16', 'text_17',
      'text_18', 'text_19', 'text_20', 'text_21', 'text_22', 'text_23', 'text_24',
      'image_25', 'image_26', 'image_27', 'image_28', 'image_29', 'image_30', 'image_31',
    ]);

    const children = Array.from(page.children) as HTMLElement[];

    if (hideTitle) {
      children.filter((c) => titleIds.has(c.id)).forEach((c) => c.remove());
      const members = children.filter((c) => testimonialIds.has(c.id));
      if (members.length) {
        const g = doc.createElement('div');
        g.className = 'testimonial-group';
        g.setAttribute('style', 'position: absolute; inset: 0; pointer-events: none');
        members[0].before(g);
        members.forEach((m) => g.appendChild(m));
      }
    } else if (hideTestimonials) {
      children.filter((c) => testimonialIds.has(c.id)).forEach((c) => c.remove());
      const members = children.filter((c) => titleIds.has(c.id));
      if (members.length) {
        const g = doc.createElement('div');
        g.className = 'title-group';
        g.setAttribute('style', 'position: absolute; inset: 0; pointer-events: none');
        members[0].before(g);
        members.forEach((m) => g.appendChild(m));
      }
    }

    const result = page.outerHTML;
    processedCache.set(cacheKey, { source: html, result });
    return result;
  }, [html, group, hideTitle, hideTestimonials]);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;

    const resize = () => {
      const w = box.clientWidth || window.innerWidth;
      const h = box.clientHeight || window.innerHeight;
      const scale = fit === 'cover'
        ? Math.max(w / width, h / height)
        : Math.min(w / width, h / height);
      canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
      canvas.style.setProperty('--hero-scale', String(scale));
    };

    resize();

    // the box is a viewport-sized fixed layer, so this also fires on window resize / rotation
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    return () => ro.disconnect();
  }, [width, height, fit]);

  const initialScale = typeof window !== 'undefined'
    ? (fit === 'cover'
        ? Math.max(window.innerWidth / width, window.innerHeight / height)
        : Math.min(window.innerWidth / width, window.innerHeight / height))
    : 1;

  return (
    <div
      ref={boxRef}
      className={`hero-design ${className}`}
      style={{ overflow: 'hidden', pointerEvents: 'none', ...style }}
    >
      <div
        ref={canvasRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width,
          height,
          transformOrigin: 'center center',
          transform: `translate(-50%, -50%) scale(${initialScale})`,
          // deliberately NO will-change here: it pins the raster scale of a 4591x2350 layer,
          // which leaves the text soft after the window is enlarged or the monitor rotated
        }}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    </div>
  );
}
