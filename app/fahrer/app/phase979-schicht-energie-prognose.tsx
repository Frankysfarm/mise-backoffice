'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Battery, BatteryLow, BatteryMedium, Coffee, TrendingDown, Zap } from 'lucide-react';

/**
 * Phase 979 — Schicht-Energie-Prognose (Fahrer-App)
 *
 * Prognose verbleibende Energie + Pausen-Empfehlung
 * basierend auf bisheriger Schicht-Intensität.
 */

interface EnergiePrognose {
  energie_pct: number;               // 0–100
  schicht_dauer_min: number;
  stopps_absolviert: number;
  intensitaet: 'niedrig' | 'mittel' | 'hoch';
  pause_empfohlen: boolean;
  pause_in_min: number | null;       // null = keine Empfehlung
  prognose_restdauer_min: number;
  empfehlung: string;
  generiert_am: string;
}

const MOCK: EnergiePrognose = {
  energie_pct: 68,
  schicht_dauer_min: 210,
  stopps_absolviert: 7,
  intensitaet: 'mittel',
  pause_empfohlen: true,
  pause_in_min: 25,
  prognose_restdauer_min: 150,
  empfehlung: 'In ~25 Min kurze Pause (10 Min) empfohlen — danach stabile Energie bis Schichtende.',
  generiert_am: new Date().toISOString(),
};

interface Props {
  driverId: string;
  isOnline: boolean;
}

function energieFarbe(pct: number): string {
  if (pct >= 60) return 'text-matcha-600';
  if (pct >= 35) return 'text-amber-500';
  return 'text-red-500';
}

function energieBg(pct: number): string {
  if (pct >= 60) return 'bg-matcha-500';
  if (pct >= 35) return 'bg-amber-400';
  return 'bg-red-500';
}

function BatterieIcon({ pct }: { pct: number }) {
  if (pct >= 60) return <Battery className={cn('h-5 w-5', energieFarbe(pct))} />;
  if (pct >= 35) return <BatteryMedium className={cn('h-5 w-5', energieFarbe(pct))} />;
  return <BatteryLow className={cn('h-5 w-5', energieFarbe(pct))} />;
}

function fmtMin(min: number): string {
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}Min` : `${h}h`;
}

export function FahrerPhase979SchichtEnergiePrognose({ driverId, isOnline }: Props) {
  const [data, setData] = useState<EnergiePrognose | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/energie-prognose?driver_id=${driverId}`);
        if (res.ok) {
          setData(await res.json());
        } else {
          setData(MOCK);
        }
      } catch {
        setData(MOCK);
      } finally {
        setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 10 * 60_000);
    return () => clearInterval(t);
  }, [driverId, isOnline]);

  if (!isOnline || (!data && !loading)) return null;
  if (loading && !data) {
    return (
      <div className="mx-4 rounded-xl border bg-card px-4 py-3 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
    );
  }
  if (!data) return null;

  const { energie_pct, schicht_dauer_min, stopps_absolviert, intensitaet, pause_empfohlen, pause_in_min, prognose_restdauer_min, empfehlung } = data;
  const niedrig = energie_pct < 35;

  return (
    <div
      className={cn(
        'mx-4 rounded-xl border bg-card overflow-hidden',
        niedrig ? 'border-red-300' : pause_empfohlen ? 'border-amber-300' : 'border-border',
      )}
      data-fahrer-phase="979"
    >
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5',
        niedrig ? 'bg-red-50 dark:bg-red-950/20' : pause_empfohlen ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-muted/20',
      )}>
        <BatterieIcon pct={energie_pct} />
        <span className="font-bold text-sm flex-1">Schicht-Energie-Prognose</span>
        <span className={cn('text-lg font-black tabular-nums', energieFarbe(energie_pct))}>
          {energie_pct}%
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Energie-Balken */}
        <div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', energieBg(energie_pct))}
              style={{ width: `${energie_pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Erschöpft</span>
            <span>Volle Energie</span>
          </div>
        </div>

        {/* KPI-Grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Schichtdauer', value: fmtMin(schicht_dauer_min), icon: <Zap className="h-3 w-3" /> },
            { label: 'Stopps', value: String(stopps_absolviert), icon: <TrendingDown className="h-3 w-3" /> },
            { label: 'Intensität', value: intensitaet.charAt(0).toUpperCase() + intensitaet.slice(1), icon: <Battery className="h-3 w-3" /> },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl bg-muted/30 px-2 py-2 text-center">
              <div className="flex justify-center text-muted-foreground mb-0.5">{kpi.icon}</div>
              <div className="text-sm font-black">{kpi.value}</div>
              <div className="text-[9px] text-muted-foreground">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Restdauer-Prognose */}
        <div className="rounded-xl bg-muted/20 px-3 py-2 flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <div className="text-[10px] text-muted-foreground">Energie reicht voraussichtlich noch</div>
            <div className="text-sm font-bold">{fmtMin(prognose_restdauer_min)}</div>
          </div>
        </div>

        {/* Pausen-Empfehlung */}
        {pause_empfohlen && (
          <div className={cn(
            'rounded-xl px-3 py-2 flex items-start gap-2',
            niedrig
              ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
              : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800',
          )}>
            <Coffee className={cn('h-4 w-4 shrink-0 mt-0.5', niedrig ? 'text-red-600' : 'text-amber-600')} />
            <div>
              {pause_in_min !== null && (
                <div className={cn('text-[10px] font-black', niedrig ? 'text-red-700' : 'text-amber-700')}>
                  {niedrig ? 'Pause jetzt empfohlen!' : `Pause in ~${pause_in_min} Min empfohlen`}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground mt-0.5">{empfehlung}</div>
            </div>
          </div>
        )}

        {!pause_empfohlen && (
          <div className="text-[10px] text-muted-foreground text-center">{empfehlung}</div>
        )}
      </div>
    </div>
  );
}
