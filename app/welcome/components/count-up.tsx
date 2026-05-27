'use client';

import { useEffect, useRef, useState } from 'react';

/** Animiert eine Zahl von 0 auf end wenn im Viewport. */
export function CountUp({
  end, suffix = '', prefix = '', duration = 1200,
}: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    let raf = 0;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(end * eased);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [end, duration]);

  return (
    <span ref={ref}>
      {prefix}{Math.round(value).toLocaleString('de-DE')}{suffix}
    </span>
  );
}
