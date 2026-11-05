import { useRef, useCallback } from 'react';
import { spawnRipple, scrollToSelector } from '../utils/dom';

interface ClickWrapperProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  href?: string;
  onClick?: () => void;
  scrollTo?: string;
  refresh?: boolean;
  ripple?: boolean;
  scale?: number;
  style?: React.CSSProperties;
  noHover?: boolean;
}

export function ClickWrapper({
  children,
  className = '',
  glowColor = 'rgba(201,168,76,0.6)',
  href,
  onClick,
  scrollTo,
  refresh,
  ripple = true,
  scale = 1.02,
  style = {},
  noHover = false,
}: ClickWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (ripple && ref.current) spawnRipple(ref.current, e.clientX, e.clientY, glowColor);

      if (refresh) window.location.reload();
      else if (href) window.open(href, '_blank', 'noopener,noreferrer');
      else if (scrollTo) scrollToSelector(scrollTo);
      else if (onClick) onClick();
    },
    [glowColor, href, onClick, scrollTo, refresh, ripple],
  );

  return (
    <div
      ref={ref}
      className={noHover ? className : `click-wrapper ${className}`}
      onClick={handleClick}
      style={{ ...style, cursor: 'pointer', '--scale': scale } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
