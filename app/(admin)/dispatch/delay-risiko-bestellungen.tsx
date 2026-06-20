'use client';

/**
 * DispatchDelayRisikoBestellungen — Phase 317
 *
 * Zeigt alle aktiven Bestellungen mit Verspätungsprognose sortiert nach Risikolevel.
 * Faktor-Breakdown (Küchenlast, Peakstunde, Fahrerknappheit, etc.) als Mini-Balken.
 * Polling alle 60 s auf /api/delivery/admin/order-delay-prediction?action=active
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Loader2, MapPin, Zap } from 'lucide-react';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface RiskFactors {
  kitchenLoad: number;
  peakHourScore: number;
  zoneDistanceScore: number;
  weatherPenalty: number;
  orderComplexity: number;
  driverShortage: number;
  historicalLateRate: number;
}

interface DelayPrediction {
  orderId: string;
  delayRiskScore: number;
  riskLevel: RiskLevel;
  predictedDelayMin: number | null;
  riskFactors: RiskFactors;
  bestellnummer?: string;
  kundeAdresse?: string | null;
  deliveryZone?: string | null;
}

const LEVEL_STYLE: Record<RiskLevel, { badge: string; row: string }> = {
  critical: { badge: 'bg-red-600 text-white',    row: 'bg-red-50 border-l-2 border-red-400'     },
  high:     { badge: 'bg-orange-500 text-white',  row: 'bg-orange-50 border-l-2 border-orange-400' },
  medium:   { badge: 'bg-amber-400 text-white',   row: 'bg-amber-50 border-l-2 border-amber-400'   },
  low:      { badge: 'bg-matcha-500 text-white',  row: 'bg-white border-l-2 border-matcha-300'     },
};

const FACTOR_LABELS: Record<keyof RiskFactors, string> = {
  kitchenLoad:         'Küchenlast',
  peakHourScore:       'Stoßzeit',
  zoneDistanceScore:   'Zone/Distanz',
  weatherPenalty:      'Wetter',
  orderComplexity:     'Komplexität',
  driverShortage:      'Fahrermangel',
  historicalLateRate:  'Hist. Verspätung',
};

function FactorBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'bg-red-500' : value >= 40 ? 'bg-amber-400' : 'bg-matcha-400';
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-24 shrink-0 text-[9px] text-stone-500 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right text-[9px] font-bold tabular-nums text-stone-600">{Math.round(value)}</span>
    </div>
  );
}

export function DispatchDelayRisikoBestellungen({ locationId }: { locationId: string | null }) {
  const [predictions, setPredictions] = useState<DelayPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/order-delay-prediction?action=active&location_id=${encodeURIComponent(locationId)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const d = await res.json();
      if (Array.isArray(d.predictions)) {
        const sorted = [...d.predictions].sort((a: DelayPrediction, b: DelayPrediction) => {
          const order: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
          const ri = order.indexOf(a.riskLevel);
          const rj = order.indexOf(b.riskLevel);
          if (ri !== rj) return ri - rj;
          return b.delayRiskScore - a.delayRiskScore;
        });
        setPredictions(sorted);
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const criticalHigh = predictions.filter(p => p.riskLevel === 'critical' || p.riskLevel === 'high');

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Verspätungsprognosen…
        </div>
      </div>
    );
  }

  if (predictions.length === 0) return null;

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700 shrink-0">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-stone-800">Verspätungs-Risikoprognose</div>
          <div className="text-xs text-stone-400">
            {predictions.length} aktive Prognosen
            {criticalHigh.length > 0 && (
              <span className="ml-1 font-bold text-red-600"> · {criticalHigh.length} kritisch/hoch</span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="divide-y divide-stone-100">
          {predictions.slice(0, 10).map((p) => {
            const style = LEVEL_STYLE[p.riskLevel];
            const isExp = expanded.has(p.orderId);
            const topFactors = Object.entries(p.riskFactors)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3) as [keyof RiskFactors, number][];

            return (
              <div key={p.orderId} className={cn('px-4 py-3', style.row)}>
                <div className="flex items-center gap-2">
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black', style.badge)}>
                    {p.riskLevel === 'critical' ? 'KRITISCH' :
                     p.riskLevel === 'high'     ? 'HOCH' :
                     p.riskLevel === 'medium'   ? 'MITTEL' : 'NIEDRIG'}
                  </span>
                  <span className="font-mono text-xs font-bold text-stone-700">
                    #{p.bestellnummer ?? p.orderId.slice(0, 6)}
                  </span>
                  {p.deliveryZone && (
                    <span className="text-[9px] bg-white/80 border rounded px-1.5 py-0.5 font-bold text-stone-600 flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" /> Zone {p.deliveryZone}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-xs font-bold tabular-nums text-stone-700">
                    <Zap className="h-3 w-3" />
                    Score {Math.round(p.delayRiskScore)}
                  </span>
                  {p.predictedDelayMin != null && p.predictedDelayMin > 0 && (
                    <span className="text-[10px] text-red-600 font-bold flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />+{Math.round(p.predictedDelayMin)} Min
                    </span>
                  )}
                  <button
                    onClick={() => toggleExpand(p.orderId)}
                    className="ml-1 text-stone-400 hover:text-stone-600"
                  >
                    {isExp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {p.kundeAdresse && (
                  <div className="mt-1 text-[10px] text-stone-500 truncate">{p.kundeAdresse}</div>
                )}

                {isExp && (
                  <div className="mt-2 space-y-1 bg-white/60 rounded-lg p-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                      Top-Risikofaktoren
                    </div>
                    {topFactors.map(([key, val]) => (
                      <FactorBar key={key} label={FACTOR_LABELS[key]} value={val} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {predictions.length > 10 && (
            <div className="px-4 py-2 text-[11px] text-stone-400 text-center">
              + {predictions.length - 10} weitere Prognosen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
