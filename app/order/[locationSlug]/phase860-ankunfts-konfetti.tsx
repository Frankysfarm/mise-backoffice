'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  orderId: string | null;
  status: string | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const COLORS = ['#16a34a', '#22c55e', '#84cc16', '#facc15', '#f97316', '#3b82f6', '#a855f7', '#ec4899'];

function createParticle(width: number): Particle {
  return {
    x: Math.random() * width,
    y: -10,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: Math.random() * 8 + 4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    opacity: 1,
  };
}

function KonfettiCanvas({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initiale Partikel
    for (let i = 0; i < 120; i++) {
      particlesRef.current.push(createParticle(canvas.width));
    }

    let frame = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Neue Partikel in den ersten 60 Frames
      if (frame < 60 && frame % 3 === 0) {
        particlesRef.current.push(createParticle(canvas.width));
      }

      particlesRef.current = particlesRef.current.filter(p => p.opacity > 0.01);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // Schwerkraft
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height * 0.6) p.opacity -= 0.02;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      frame++;
      const elapsed = Date.now() - startRef.current;

      if (elapsed < 4000) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onDone();
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
    />
  );
}

export function Phase860AnkunftsKonfetti({ orderId, status }: Props) {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (status !== 'geliefert' || !orderId || done) return;
    const key = `konfetti_shown_${orderId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    setShow(true);
  }, [status, orderId, done]);

  const handleDone = () => {
    setShow(false);
    setDone(true);
  };

  if (!show) return null;

  return (
    <>
      <KonfettiCanvas onDone={handleDone} />
      {/* Erfolgs-Overlay */}
      <div className="fixed inset-x-0 top-1/3 z-50 flex justify-center pointer-events-none">
        <div className="animate-bounce rounded-2xl bg-matcha-600 text-white px-8 py-5 text-center shadow-2xl">
          <div className="text-4xl mb-1">🎉</div>
          <div className="text-lg font-black">Lieferung angekommen!</div>
          <div className="text-sm opacity-90 mt-0.5">Guten Appetit!</div>
        </div>
      </div>
    </>
  );
}
