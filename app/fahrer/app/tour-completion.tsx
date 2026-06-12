'use client';

/**
 * TourCompletionScreen — Phase 98
 * Animierter Abschluss-Bildschirm nach Ablieferung aller Stopps.
 * Zeigt Zusammenfassung + Glückwunsch-Animation.
 */

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Star, Package, MapPin, Clock } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface CompletionStats {
  stopsCompleted: number;
  totalBetrag: number;
  elapsedMin: number;
  distanceKm: number | null;
}

interface TourCompletionScreenProps {
  stats: CompletionStats;
  onContinue: () => void;
}

function ConfettiParticle({ style }: { style: React.CSSProperties }) {
  return <div className="absolute w-2 h-2 rounded-sm" style={style} />;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function useConfetti() {
  const [particles, setParticles] = useState<{ id: number; style: React.CSSProperties }[]>([]);
  useEffect(() => {
    const ps = Array.from({ length: 28 }, (_, i) => ({
      id: i,
      style: {
        left: `${5 + Math.random() * 90}%`,
        top: '-10px',
        backgroundColor: COLORS[i % COLORS.length],
        transform: `rotate(${Math.random() * 360}deg)`,
        animation: `confetti-fall ${0.8 + Math.random() * 1.2}s ease-in forwards`,
        animationDelay: `${Math.random() * 0.6}s`,
        opacity: 0,
      } as React.CSSProperties,
    }));
    setParticles(ps);
  }, []);
  return particles;
}

export function TourCompletionScreen({ stats, onContinue }: TourCompletionScreenProps) {
  const particles = useConfetti();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisible(true);
    timerRef.current = setTimeout(() => onContinue(), 8000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onContinue]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-matcha-900 to-matcha-700 transition-opacity duration-500',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      {/* Keyframe styles injected inline */}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pop-in {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes slide-up {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Confetti layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => <ConfettiParticle key={p.id} style={p.style} />)}
      </div>

      {/* Main card */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center max-w-xs">
        {/* Big check icon */}
        <div style={{ animation: 'pop-in 0.5s ease-out both' }}>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/20 border-4 border-accent shadow-[0_0_40px_rgba(163,230,53,0.4)]">
            <CheckCircle2 className="h-12 w-12 text-accent" strokeWidth={2.5} />
          </div>
        </div>

        {/* Title */}
        <div style={{ animation: 'slide-up 0.4s ease-out 0.2s both' }}>
          <div className="font-display font-black text-3xl text-white leading-tight">
            Tour abgeschlossen!
          </div>
          <div className="mt-1 text-sm text-matcha-300 font-medium">
            Alle {stats.stopsCompleted} {stats.stopsCompleted === 1 ? 'Stopp' : 'Stopps'} geliefert
          </div>
        </div>

        {/* Stats grid */}
        <div
          className="grid grid-cols-2 gap-2.5 w-full"
          style={{ animation: 'slide-up 0.4s ease-out 0.35s both' }}
        >
          <StatCell
            icon={<Package className="h-4 w-4" />}
            label="Lieferungen"
            value={String(stats.stopsCompleted)}
          />
          <StatCell
            icon={<Star className="h-4 w-4" />}
            label="Umsatz"
            value={euro(stats.totalBetrag)}
          />
          <StatCell
            icon={<Clock className="h-4 w-4" />}
            label="Dauer"
            value={`${stats.elapsedMin} Min`}
          />
          <StatCell
            icon={<MapPin className="h-4 w-4" />}
            label="Distanz"
            value={stats.distanceKm != null ? `${stats.distanceKm.toFixed(1)} km` : '–'}
          />
        </div>

        {/* CTA */}
        <button
          onClick={onContinue}
          className="mt-2 w-full rounded-2xl bg-accent px-6 py-3.5 font-display font-bold text-matcha-900 text-base active:scale-95 transition"
          style={{ animation: 'slide-up 0.4s ease-out 0.5s both' }}
        >
          Zurück zur Übersicht
        </button>
        <div
          className="text-[10px] text-matcha-400"
          style={{ animation: 'slide-up 0.4s ease-out 0.6s both' }}
        >
          Weiterleitung in 8 Sekunden…
        </div>
      </div>
    </div>
  );
}

function StatCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/8 border border-white/10 px-3 py-2.5 text-left">
      <div className="flex items-center gap-1.5 text-matcha-300 mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-display font-black text-lg text-white leading-none">{value}</div>
    </div>
  );
}
