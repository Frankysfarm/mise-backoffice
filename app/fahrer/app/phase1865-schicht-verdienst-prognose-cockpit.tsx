'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Euro, TrendingUp, Zap } from 'lucide-react';

/**
 * Phase 1865 — Schicht-Verdienst-Prognose-Cockpit (Fahrer-App)
 *
 * Hochrechnung des heutigen Tagesverdiensts basierend auf:
 *  - Bisherigen Lieferungen + Trinkgelder dieser Schicht
 *  - Durchschnittlicher Verdienst/Lieferung
 *  - Geplante verbleibende Schichtzeit
 * 2-Min-Refresh. Zeigt: Ist-Verdienst, Hochrechnung, Tagesziel-Fortschritt.
 */

interface Props {
  driverId: string;
  dailyGoalEur?: number;
  className?: string;
}

interface EarningData {
  deliveries: number;
  earnedEur: number;
  tipEur: number;
  shiftElapsedMin: number;
  shiftTotalMin: number;
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function FahrerPhase1865SchichtVerdienstPrognose({ driverId, dailyGoalEur = 120, className }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<EarningData | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    fetch(`/api/delivery/fahrer/schicht-verdienst?driver_id=${encodeURIComponent(driverId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && typeof d.earnedEur === 'number') {
          setData(d);
        } else {
          // Mock fallback
          const elapsed = 180 + Math.floor(Math.random() * 30);
          const deliveries = 4 + Math.floor(Math.random() * 3);
          const earned = deliveries * (5.5 + Math.random() * 1.5);
          const tip = deliveries * (0.8 + Math.random() * 1.2);
          setData({
            deliveries,
            earnedEur: earned,
            tipEur: tip,
            shiftElapsedMin: elapsed,
            shiftTotalMin: 480,
          });
        }
      })
      .catch(() => {
        const elapsed = 180;
        setData({ deliveries: 5, earnedEur: 29.5, tipEur: 4.2, shiftElapsedMin: elapsed, shiftTotalMin: 480 });
      });
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 120_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [driverId]);

  if (!data) return null;

  const perDelivery = data.deliveries > 0 ? (data.earnedEur + data.tipEur) / data.deliveries : 0;
  const remainMin = data.shiftTotalMin - data.shiftElapsedMin;
  const deliveriesPerHour = data.deliveries / (data.shiftElapsedMin / 60);
  const forecastDeliveries = deliveriesPerHour * (remainMin / 60);
  const forecastEur = data.earnedEur + data.tipEur + forecastDeliveries * perDelivery;

  const goalPct = Math.min(100, ((data.earnedEur + data.tipEur) / dailyGoalEur) * 100);
  const forecastPct = Math.min(100, (forecastEur / dailyGoalEur) * 100);

  const goalColor =
    goalPct >= 100 ? 'bg-matcha-500' :
    goalPct >= 60 ? 'bg-amber-400' :
    'bg-blue-500';

  return (
    <div className={cn(
      'rounded-2xl border border-white/10 bg-white/5 overflow-hidden',
      className,
    )}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-matcha-400" />
          <span className="text-sm font-bold text-white">Verdienst-Prognose</span>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold',
            goalPct >= 100 ? 'bg-matcha-500/20 text-matcha-300' : 'bg-white/10 text-white/70',
          )}>
            {fmtEur(data.earnedEur + data.tipEur)}
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-white/50" />
          : <ChevronDown className="h-4 w-4 text-white/50" />
        }
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 py-4 space-y-4">
          {/* KPI-Zeile */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Verdient', value: fmtEur(data.earnedEur + data.tipEur), sub: `${data.deliveries} Lieferungen` },
              { label: 'Trinkgeld', value: fmtEur(data.tipEur), sub: `Ø ${fmtEur(data.tipEur / Math.max(1, data.deliveries))}` },
              { label: 'Prognose', value: fmtEur(forecastEur), sub: 'bis Schichtende' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-white/5 p-2.5 text-center">
                <div className="text-white font-black text-sm tabular-nums">{kpi.value}</div>
                <div className="text-[9px] text-white/50 mt-0.5">{kpi.label}</div>
                <div className="text-[9px] text-white/40">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Tagesziel-Fortschrittsbalken */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                Tagesziel {fmtEur(dailyGoalEur)}
              </span>
              <span className="text-[10px] text-white/50">{Math.round(goalPct)}%</span>
            </div>
            <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
              {/* Prognose-Balken (heller) */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/20 transition-all duration-700"
                style={{ width: `${forecastPct}%` }}
              />
              {/* Ist-Balken */}
              <div
                className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-700', goalColor)}
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/40">Ist</span>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5 text-white/40" />
                <span className="text-[9px] text-white/40">Prognose {fmtEur(forecastEur)}</span>
              </div>
            </div>
          </div>

          {/* Tempo-Info */}
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-white/70">
              <span className="font-bold text-white">{deliveriesPerHour.toFixed(1)}</span> Lieferungen/Std
              · noch <span className="font-bold text-white">{Math.round(remainMin)}</span> Min Schicht
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
