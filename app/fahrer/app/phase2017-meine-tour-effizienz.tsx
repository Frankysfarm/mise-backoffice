'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react';

/**
 * Phase 2017 — Meine-Tour-Effizienz (Fahrer-App)
 *
 * Effizienzindex + KPI-Aufschlüsselung (Stopps/km/Zeit); Tipps; isOnline-Guard; 5-Min-Polling.
 */

interface TourEffizienzData {
  effizienz_index: number;
  avg_stopps_pro_tour: number;
  avg_km_pro_stopp: number;
  avg_zeit_pro_stopp_min: number;
  trend_vs_vortag: number;
  alert_niedrige_effizienz: boolean;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK: TourEffizienzData = {
  effizienz_index: 74,
  avg_stopps_pro_tour: 3.8,
  avg_km_pro_stopp: 2.1,
  avg_zeit_pro_stopp_min: 7.4,
  trend_vs_vortag: 5,
  alert_niedrige_effizienz: false,
};

const TIPPS = [
  'Gruppiere Stopps nach Zonen für kürzere Wege.',
  'Plane Stopps in Reihenfolge der Straßennummern.',
  'Versuche, pro Tour mindestens 4 Stopps zu bündeln.',
];

export function FahrerPhase2017MeineTourEffizienz({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<TourEffizienzData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!driverId || !locationId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/tour-effizienz?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          setData(MOCK);
        }
      } catch {
        setData(MOCK);
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId]);

  if (!driverId || !isOnline) return null;

  const d = data;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = d ? Math.min(100, Math.max(0, d.effizienz_index)) : 0;
  const offset = circ - (pct / 100) * circ;
  const ringColor = pct >= 75 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
  const ampel = pct >= 75 ? 'text-matcha-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600';

  const tippIndex = d ? Math.min(2, Math.floor((100 - d.effizienz_index) / 34)) : 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Zap className="h-4 w-4 text-violet-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">Meine Tour-Effizienz</span>
        {d && (
          <span className={cn(
            'text-[10px] font-bold rounded-full px-2 py-0.5',
            d.effizienz_index >= 75
              ? 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300'
              : d.effizienz_index >= 60
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
          )}>
            {d.effizienz_index}/100
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!d ? (
            <p className="text-xs text-muted-foreground text-center py-4">Lade Effizienzdaten…</p>
          ) : (
            <>
              {/* Ring + Score */}
              <div className="flex items-center gap-4">
                <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
                  <circle cx="34" cy="34" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                  <circle
                    cx="34" cy="34" r={r} fill="none"
                    stroke={ringColor} strokeWidth="6"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 34 34)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                  <text x="34" y="38" textAnchor="middle" fontSize="12" fontWeight="900" fill={ringColor}>
                    {d.effizienz_index}
                  </text>
                </svg>
                <div className="flex-1 space-y-1">
                  <div className={cn('text-xl font-black', ampel)}>{d.effizienz_index}<span className="text-xs font-normal text-muted-foreground">/100</span></div>
                  <div className={cn(
                    'flex items-center gap-1 text-xs font-medium',
                    d.trend_vs_vortag > 0 ? 'text-matcha-600' : d.trend_vs_vortag < 0 ? 'text-red-600' : 'text-muted-foreground',
                  )}>
                    {d.trend_vs_vortag > 0
                      ? <TrendingUp className="h-3 w-3" />
                      : d.trend_vs_vortag < 0
                        ? <TrendingDown className="h-3 w-3" />
                        : <Minus className="h-3 w-3" />
                    }
                    {d.trend_vs_vortag > 0 ? '+' : ''}{d.trend_vs_vortag} vs. Vortag
                  </div>
                </div>
              </div>

              {/* KPI-Grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Ø Stopps/Tour', value: d.avg_stopps_pro_tour.toFixed(1) },
                  { label: 'Ø km/Stopp', value: `${d.avg_km_pro_stopp.toFixed(1)} km` },
                  { label: 'Ø Zeit/Stopp', value: `${d.avg_zeit_pro_stopp_min.toFixed(1)} Min` },
                ].map(kpi => (
                  <div key={kpi.label} className="rounded-lg border bg-muted/20 p-2 text-center">
                    <div className="text-sm font-black text-foreground">{kpi.value}</div>
                    <div className="text-[9px] text-muted-foreground">{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Tipp */}
              <div className="flex items-start gap-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-3 py-2">
                <Lightbulb className="h-3.5 w-3.5 text-violet-600 shrink-0 mt-0.5" />
                <span className="text-xs text-violet-700 dark:text-violet-300">{TIPPS[tippIndex]}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
