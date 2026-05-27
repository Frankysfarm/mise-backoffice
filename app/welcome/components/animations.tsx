'use client';

import { useEffect, useRef, useState } from 'react';

/** Typewriter mit Cursor — rendert Text Zeichen für Zeichen */
export function Typewriter({
  text,
  speed = 55,
  startDelay = 400,
  className,
  accentClass,
  accentText,
}: {
  text: string;
  speed?: number;
  startDelay?: number;
  className?: string;
  accentClass?: string;
  accentText?: string;
}) {
  const [len, setLen] = useState(0);
  const full = accentText ? `${text} ${accentText}` : text;

  useEffect(() => {
    let t: any;
    const start = setTimeout(() => {
      t = setInterval(() => {
        setLen((n) => {
          if (n >= full.length) { clearInterval(t); return n; }
          return n + 1;
        });
      }, speed);
    }, startDelay);
    return () => { clearTimeout(start); clearInterval(t); };
  }, [full, speed, startDelay]);

  const shownBase = text.slice(0, Math.min(len, text.length));
  const shownAcc = accentText && len > text.length + 1
    ? accentText.slice(0, len - text.length - 1) : '';

  return (
    <span className={className}>
      {shownBase}
      {accentText && len > text.length && (
        <> <span className={accentClass}>{shownAcc}</span></>
      )}
      <span className="inline-block w-[0.08em] h-[0.9em] align-[-0.1em] ml-1 bg-accent animate-pulse" />
    </span>
  );
}

/** Emoji-Burst: triggert on-tap an x/y Position */
export function ConfettiButton({
  children,
  onClickFinal,
  className,
  emojis = ['🎉', '✨', '🚀', '🌱', '🍵', '💚', '⭐'],
}: {
  children: React.ReactNode;
  onClickFinal?: () => void;
  className?: string;
  emojis?: string[];
}) {
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number; emoji: string; dx: number; dy: number }>>([]);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const id = Date.now();
    const pieces = Array.from({ length: 14 }).map((_, i) => ({
      id: id + i,
      x: cx,
      y: cy,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      dx: (Math.random() - 0.5) * 260,
      dy: -(Math.random() * 180 + 80),
    }));
    setBursts((b) => [...b, ...pieces]);
    setTimeout(() => {
      setBursts((b) => b.filter((p) => !pieces.some((q) => q.id === p.id)));
      onClickFinal?.();
    }, 900);
  }

  return (
    <>
      <button onClick={handleClick} className={className}>{children}</button>
      {typeof document !== 'undefined' && bursts.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[100]">
          {bursts.map((p) => (
            <span
              key={p.id}
              className="absolute text-3xl confetti-fly"
              style={{
                left: p.x,
                top: p.y,
                transform: 'translate(-50%, -50%)',
                // @ts-ignore — CSS vars
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
              }}
            >
              {p.emoji}
            </span>
          ))}
          <style jsx>{`
            @keyframes fly {
              0%   { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(1); }
              100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 200px)) rotate(720deg) scale(0.4); }
            }
            .confetti-fly { animation: fly 0.9s cubic-bezier(.2,.8,.3,1) forwards; }
          `}</style>
        </div>
      )}
    </>
  );
}

/** Parallax-Blob der Maus/Touch folgt */
export function ParallaxBlob({
  className,
  strength = 30,
}: { className?: string; strength?: number }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      const p = 'touches' in e ? e.touches[0] : e;
      if (!p) return;
      const x = (p.clientX / window.innerWidth - 0.5) * strength;
      const y = (p.clientY / window.innerHeight - 0.5) * strength;
      setPos({ x, y });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
    };
  }, [strength]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        transition: 'transform 0.4s cubic-bezier(.17,.67,.3,1.01)',
      }}
    />
  );
}

/** Scroll-Progress-Bar oben */
export function ScrollProgress({ colorClass = 'bg-accent' }: { colorClass?: string }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    function on() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? (h.scrollTop / max) * 100 : 0);
    }
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-[70]">
      <div className={`h-full ${colorClass} transition-[width]`} style={{ width: `${p}%` }} />
    </div>
  );
}

/** Magnetic Button: zieht zur Maus bei Hover */
export function Magnetic({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el!.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
    }
    function onLeave() {
      el!.style.transform = 'translate(0,0)';
    }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);
  return (
    <div ref={ref} className={className} style={{ transition: 'transform 0.25s cubic-bezier(.17,.67,.3,1.01)' }}>
      {children}
    </div>
  );
}
