'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Route, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1196 — Routen-Effizienz-Badge (Fahrer-App)
// Tages-Routen-Effizienz: km/Stopp vs. Team-Ø + Badge Platin/Gold/Silber/Bronze

interface Props {
  driverId: string;
  isOnline: boolean;
}

type RoutenData = {
  km_gesamt: number;
  stopps_gesamt: number;
  km_pro_stopp: number;
  team_avg_km_pro_stopp: number;
  effizienz_pct: number;
  badge: 'platin' | 'gold' | 'silber' | 'bronze';
  badge_label: string;
};

const MOCK: RoutenData = {
  km_gesamt: 42.5,
  stopps_gesamt: 14,
  km_pro_stopp: 3.04,
  team_avg_km_pro_stopp: 3.8,
  effizienz_pct: 120,
  badge: 'gold',
  badge_label: 'Gold',
};

const BADGE_STYLES: Record<string, { bg: string; border: string; text: string; ring: string; emoji: string }> = {
  platin: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-400',
    text: 'text-slate-700 dark:text-slate-200',
    ring: 'ring-slate-400',
    emoji: '💎',
  },
  gold: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    emoji: '🥇',
  },
  silber: {
    bg: 'bg-gray-50 dark:bg-gray-900/40',
    border: 'border-gray-400',
    text: 'text-gray-600 dark:text-gray-300',
    ring: 'ring-gray-400',
    emoji: '🥈',
  },
  bronze: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-400',
    text: 'text-orange-700 dark:text-orange-300',
    ring: 'ring-orange-400',
    emoji: '🥉',
  },
};

function fmtKm(km: number): string {
  return km.toFixed(1).replace('.', ',') + ' km';
}

export function FahrerPhase1196RoutenEffizienzBadge({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<RoutenData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/driver/routen-effizienz-badge?driver_id=${encodeURIComponent(driverId)}`);
      setData(r.ok ? await r.json() as RoutenData : MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => void load(), 10 * 60000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const d = data ?? MOCK;
  const bs = BADGE_STYLES[d.badge] ?? BADGE_STYLES.bronze;
  const delta = d.effizienz_pct - 100;
  const besserAls = delta > 0;

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', bs.border, bs.bg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route className={cn('h-4 w-4 shrink-0', bs.text)} />
          <span className={cn('font-bold text-sm', bs.text)}>Routen-Effizienz</span>
          <span className={cn('rounded-full text-[10px] font-black px-2 py-0.5 ring-1', bs.ring, bs.text)}>
            {bs.emoji} {d.badge_label}
          </span>
          {loading && <Loader2 className={cn('h-3 w-3 animate-spin', bs.text)} />}
        </div>
        {open
          ? <ChevronUp className={cn('h-4 w-4', bs.text)} />
          : <ChevronDown className={cn('h-4 w-4', bs.text)} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Main metric */}
          <div className="flex items-center justify-center gap-4 rounded-xl bg-white/40 dark:bg-black/20 border border-current/10 py-4">
            <div className="text-center">
              <p className={cn('text-[10px] font-bold uppercase tracking-wide mb-0.5', bs.text)}>Dein km/Stopp</p>
              <p className={cn('text-2xl font-black tabular-nums', bs.text)}>{fmtKm(d.km_pro_stopp)}</p>
            </div>
            <div className={cn('text-3xl font-black', bs.text)}>vs.</div>
            <div className="text-center opacity-60">
              <p className={cn('text-[10px] font-bold uppercase tracking-wide mb-0.5', bs.text)}>Team-Ø</p>
              <p className={cn('text-2xl font-black tabular-nums', bs.text)}>{fmtKm(d.team_avg_km_pro_stopp)}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/40 dark:bg-black/20 border border-current/10 p-2.5 text-center">
              <p className={cn('text-[9px] font-bold uppercase tracking-wide mb-1', bs.text)}>Km heute</p>
              <p className={cn('text-sm font-black', bs.text)}>{fmtKm(d.km_gesamt)}</p>
            </div>
            <div className="rounded-lg bg-white/40 dark:bg-black/20 border border-current/10 p-2.5 text-center">
              <p className={cn('text-[9px] font-bold uppercase tracking-wide mb-1', bs.text)}>Stopps</p>
              <p className={cn('text-sm font-black', bs.text)}>{d.stopps_gesamt}</p>
            </div>
            <div className="rounded-lg bg-white/40 dark:bg-black/20 border border-current/10 p-2.5 text-center">
              <p className={cn('text-[9px] font-bold uppercase tracking-wide mb-1', bs.text)}>Effizienz</p>
              <p className={cn('text-sm font-black', bs.text)}>
                {besserAls ? '+' : ''}{delta.toFixed(0)}%
              </p>
            </div>
          </div>

          <div className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 border border-current/10',
            besserAls ? 'bg-matcha-50 dark:bg-matcha-950/30' : 'bg-muted/30',
          )}>
            <Award className={cn('h-4 w-4 shrink-0', bs.text)} />
            <span className={cn('text-xs font-medium', bs.text)}>
              {besserAls
                ? `${Math.abs(delta).toFixed(0)}% effizienter als Team-Ø — weiter so!`
                : `${Math.abs(delta).toFixed(0)}% über Team-Ø — Route optimieren!`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
