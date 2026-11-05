import { useEffect, useState, type RefObject } from 'react';

/** true while the element is (nearly) on screen — used to pause decorative animations offscreen */
export function useInView<T extends Element>(ref: RefObject<T>, rootMargin = '120px'): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}
