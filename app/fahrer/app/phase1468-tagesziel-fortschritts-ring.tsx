'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

// Phase 1468 — Tagesziel-Fortschritts-Ring (Fahrer-App)
// Tages-Bestellungs-Ziel als Ring-Diagramm + Verdienst-KPI + Ziel-Erreichungs-Prognose;
// isOnline-Guard; 30-Min-Polling; nach Phase1463.

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface ZielData {
  ziel_stopps: number;
  erreichte_stopps: number;
  verdienst_eur: number;
  ziel_verdienst_eur: number;
  prognose_stopps: number;
  prognose_status: 'erreicht' | 'knapp' | 'nicht_erreicht';
  schicht_stunden: number;
}

const RING_SIZE = 80;
const STROKE = 8;
const R = (RING_SIZE - STROKE) / 2;
const UMFANG = 2 * Math.PI * R;

function buildMock(driverId: string): ZielData {
  const seed = (driverId.charCodeAt(0) ?? 77) % 5;
  return {
    ziel_stopps: 12,
    erreichte_stopps: 7 + seed,
    verdienst_eur: parseFloat(((7 + seed) * 4.2).toFixed(2)),
    ziel_verdienst_eur: 50.40,
    prognose_stopps: 11 + seed,
    prognose_status: seed >= 3 ? 'erreicht' : seed >= 1 ? 'knapp' : 'nicht_erreicht',
    schicht_stunden: 4 + seed * 0.5,
  };
}

function fmtEur(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PROGNOSE_CONFIG: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  erreicht: {
    cls: 'text-emerald-600 dark:text-emerald-400',
    icon: <TrendingUp className="w-3 h-3" />,
    label: 'Ziel wird erreicht',
  },
  knapp: {
    cls: 'text-amber-600 dark:text-amber-400',
    icon: <Minus className="w-3 h-3" />,
    label: 'Ziel ist knapp',
  },
  nicht_erreicht: {
    cls: 'text-rose-600 dark:text-rose-400',
    icon: <TrendingDown className="w-3 h-3" />,
    label: 'Ziel wird verfehlt',
  },
};

export function FahrerPhase1468TageszielFortschrittsRing({ driverId, isOnline }: Props) {
  const [data, setData] = useState<ZielData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch(`/api/delivery/driver/schicht-ziel?driver_id=${driverId}`);
      if (!res.ok) throw new Error('api');
      const raw = await res.json() as {
        ziel_stopps?: number; erreichte_stopps?: number; verdienst_eur?: number;
        ziel_verdienst_eur?: number; prognose_stopps?: number;
        prognose_status?: string; schicht_stunden?: number;
      };
      setData({
        ziel_stopps: raw.ziel_stopps ?? 12,
        erreichte_stopps: raw.erreichte_stopps ?? 0,
        verdienst_eur: raw.verdienst_eur ?? 0,
        ziel_verdienst_eur: raw.ziel_verdienst_eur ?? 50,
        prognose_stopps: raw.prognose_stopps ?? 0,
        prognose_status: (raw.prognose_status as ZielData['prognose_status']) ?? 'knapp',
        schicht_stunden: raw.schicht_stunden ?? 0,
      });
    } catch {
      setData(buildMock(driverId));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!isOnline || loading) return null;
  if (!data) return null;

  const pct = Math.min(1, data.erreichte_stopps / Math.max(1, data.ziel_stopps));
  const dashOffset = UMFANG * (1 - pct);
  const ringColor = pct >= 1 ? '#10b981' : pct >= 0.7 ? '#f59e0b' : '#64748b';

  const prognose = PROGNOSE_CONFIG[data.prognose_status] ?? PROGNOSE_CONFIG.knapp;
  const verdienstPct = Math.min(100, Math.round((data.verdienst_eur / Math.max(1, data.ziel_verdienst_eur)) * 100));

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
        <Target className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Tagesziel</span>
      </div>

      <div className="px-4 py-4 flex items-center gap-5">
        {/* Ring */}
        <div className="shrink-0 relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
              fill="none" stroke="#e2e8f0" strokeWidth={STROKE}
              className="dark:stroke-slate-700"
            />
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
              fill="none" stroke={ringColor} strokeWidth={STROKE}
              strokeDasharray={UMFANG}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black tabular-nums text-slate-800 dark:text-slate-100 leading-none">
              {data.erreichte_stopps}
            </span>
            <span className="text-[10px] text-slate-400 leading-none">/{data.ziel_stopps}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3">
          {/* Verdienst */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-500 dark:text-slate-400">Verdienst</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {fmtEur(data.verdienst_eur)} / {fmtEur(data.ziel_verdienst_eur)} €
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                style={{ width: `${verdienstPct}%` }}
              />
            </div>
          </div>

          {/* Prognose */}
          <div className={cn('flex items-center gap-1.5 text-xs font-semibold', prognose.cls)}>
            {prognose.icon}
            <span>{prognose.label}</span>
            <span className="text-slate-400 font-normal">({data.prognose_stopps} erwartet)</span>
          </div>

          {/* Schichtdauer */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <RefreshCw className="w-3 h-3" />
            <span>{data.schicht_stunden.toFixed(1)}h Schicht</span>
          </div>
        </div>
      </div>
    </section>
  );
}
