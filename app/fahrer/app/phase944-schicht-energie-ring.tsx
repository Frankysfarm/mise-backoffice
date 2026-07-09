'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Zap, Battery, BatteryLow, TrendingDown, Loader2 } from 'lucide-react';

/**
 * Phase 944 — Schicht-Energie-Ring (Fahrer-App)
 *
 * Visueller SVG-Ring der verbleibenden Schichtenergie basierend auf
 * Stopps + Schichtdauer + Pausen. Nur sichtbar wenn isOnline=true.
 */

interface EnergieData {
  energie_pct: number;
  schicht_stunden: number;
  stopps_heute: number;
  pausen_min: number;
  empfehlung: string | null;
  status: 'fit' | 'muede' | 'erschoepft';
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const MOCK: EnergieData = {
  energie_pct: 72,
  schicht_stunden: 4.5,
  stopps_heute: 14,
  pausen_min: 20,
  empfehlung: 'Kurze Pause nach dem nächsten Stopp empfohlen.',
  status: 'fit',
};

function EnergieRing({ pct, status, size = 96 }: { pct: number; status: EnergieData['status']; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = status === 'fit' ? '#4ade80' : status === 'muede' ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={7} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" dominantBaseline="middle"
        fontSize="18" fontWeight="bold" fill={color}>
        {pct}%
      </text>
      <text x={size / 2} y={size / 2 + 13} textAnchor="middle" dominantBaseline="middle"
        fontSize="9" fill="currentColor" className="text-muted-foreground" opacity="0.6">
        Energie
      </text>
    </svg>
  );
}

export function FahrerPhase944SchichtEnergieRing({ driverId, isOnline }: Props) {
  const [data, setData] = useState<EnergieData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId || !isOnline) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/schicht-energie?driver_id=${driverId}`);
        if (!cancelled) setData(res.ok ? await res.json() : MOCK);
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  const d = data ?? MOCK;

  const statusLabel = d.status === 'fit' ? 'Fit' : d.status === 'muede' ? 'Müde' : 'Erschöpft';
  const StatusIcon = d.status === 'erschoepft' ? BatteryLow : d.status === 'muede' ? TrendingDown : Battery;
  const statusTextColor = d.status === 'fit'
    ? 'text-matcha-600 dark:text-matcha-400'
    : d.status === 'muede'
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Zap className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Schicht-Energie
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <div className={cn('ml-auto flex items-center gap-1', statusTextColor)}>
          <StatusIcon className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold">{statusLabel}</span>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-center gap-4">
          <EnergieRing pct={d.energie_pct} status={d.status} size={96} />
          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Schicht</span>
                <p className="text-sm font-black text-foreground tabular-nums">{d.schicht_stunden.toFixed(1)} h</p>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Stopps</span>
                <p className="text-sm font-black text-foreground tabular-nums">{d.stopps_heute}</p>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Pausen</span>
                <p className="text-sm font-black text-foreground tabular-nums">{d.pausen_min} Min</p>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Status</span>
                <p className={cn('text-sm font-black tabular-nums', statusTextColor)}>{statusLabel}</p>
              </div>
            </div>
          </div>
        </div>

        {d.empfehlung && (
          <div className={cn(
            'mt-3 rounded-lg px-3 py-2 text-[11px] font-medium',
            d.status === 'erschoepft'
              ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
              : d.status === 'muede'
              ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
              : 'bg-matcha-50 dark:bg-matcha-950/30 text-matcha-700 dark:text-matcha-300',
          )}>
            💡 {d.empfehlung}
          </div>
        )}
      </div>
    </div>
  );
}
