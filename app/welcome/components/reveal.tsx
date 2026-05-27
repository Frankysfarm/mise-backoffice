'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
};

/** Simple scroll-reveal — nutzt IntersectionObserver, CSS-only Animation. */
export function Reveal({ children, className, delay = 0, y = 20 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    // Fallback-Timer: immer sichtbar nach 800ms, falls Observer nicht triggert
    const fallback = setTimeout(() => setVisible(true), 800);

    // Direkt sichtbar, wenn Element schon im Viewport (above-the-fold)
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      clearTimeout(fallback);
      return () => clearTimeout(fallback);
    }

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      clearTimeout(fallback);
      return () => clearTimeout(fallback);
    }

    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
          clearTimeout(fallback);
        }
      },
      { rootMargin: '-60px 0px', threshold: 0.05 },
    );
    obs.observe(el);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, []);

  return (
    <div
      ref={ref}
      className={cn('transition-all duration-700 motion-reduce:transition-none', className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : `translateY(${y}px)`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
