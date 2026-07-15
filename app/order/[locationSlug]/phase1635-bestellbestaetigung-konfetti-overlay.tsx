'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  orderPlaced: boolean;
  locationSlug: string;
  onClose?: () => void;
  onReorder?: () => void;
}

const CONFETTI_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  angle: number;
  speed: number;
  rotation: number;
  rotSpeed: number;
  shape: 'rect' | 'circle';
}

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 10 + Math.floor(Math.random() * 80),
    y: -10,
    size: 6 + Math.floor(Math.random() * 8),
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    angle: 60 + Math.floor(Math.random() * 60),
    speed: 1.5 + Math.random() * 2.5,
    rotation: Math.floor(Math.random() * 360),
    rotSpeed: (Math.random() - 0.5) * 8,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }));
}

const SESSION_KEY = 'mise_konfetti_shown';

export function Phase1635BestellbestaetigungKonfettiOverlay({ orderPlaced, locationSlug, onClose, onReorder }: Props) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const animRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);
  const [frame, setFrame] = useState(0);
  const dismissed = useRef(false);

  // Hydration-safe mount
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !orderPlaced) return;
    // Check sessionStorage guard
    try {
      const key = `${SESSION_KEY}_${locationSlug}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* SSR or private mode */ }

    setParticles(createParticles(48));
    setVisible(true);
    setFrame(0);
  }, [mounted, orderPlaced, locationSlug]);

  // CSS-only animate via frame counter
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setFrame((f) => f + 1), 50);
    // Auto-dismiss after 8s
    const dismissId = setTimeout(() => {
      setVisible(false);
      dismissed.current = true;
    }, 8000);
    return () => { clearInterval(id); clearTimeout(dismissId); };
  }, [visible]);

  const handleClose = useCallback(() => {
    setVisible(false);
    dismissed.current = true;
    onClose?.();
  }, [onClose]);

  if (!mounted || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
    >
      {/* Confetti canvas (CSS-animated particles) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => {
          const elapsed = frame * 50;
          const yPct = p.y + (elapsed / 1000) * p.speed * 15;
          const xDrift = Math.sin((elapsed / 1000) * 2 + p.id) * 3;
          const rot = p.rotation + (elapsed / 1000) * p.rotSpeed * 60;
          const opacity = yPct > 90 ? Math.max(0, 1 - (yPct - 90) / 10) : 1;

          return (
            <div
              key={p.id}
              className="absolute"
              style={{
                left: `${p.x + xDrift}%`,
                top: `${yPct}%`,
                width: p.size,
                height: p.shape === 'rect' ? p.size * 0.5 : p.size,
                borderRadius: p.shape === 'circle' ? '50%' : 2,
                background: p.color,
                transform: `rotate(${rot}deg)`,
                opacity,
              }}
            />
          );
        })}
      </div>

      {/* Modal card */}
      <div className="relative z-10 mx-4 max-w-sm w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/10 flex items-center justify-center text-stone-600 hover:bg-black/20 transition"
          aria-label="Schließen"
        >
          ×
        </button>

        <div className="px-6 pt-8 pb-6 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-xl font-black text-stone-900 mb-1">Bestellung aufgegeben!</h2>
          <p className="text-stone-500 text-sm mb-5">
            Vielen Dank! Deine Bestellung wird sofort zubereitet und so schnell wie möglich geliefert.
          </p>

          <div className="flex flex-col gap-2">
            {onReorder && (
              <button
                onClick={() => { onReorder(); handleClose(); }}
                className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 text-sm transition"
              >
                Gleich nochmal bestellen
              </button>
            )}
            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-3 text-sm transition"
            >
              Bestellung verfolgen
            </button>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-emerald-400 to-blue-400" />
      </div>
    </div>
  );
}
