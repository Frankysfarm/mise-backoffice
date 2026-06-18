'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Loader2, TrendingUp, User, Zap } from 'lucide-react';

type PerformanceTier = 'top' | 'good' | 'average' | 'at_risk';

interface DriverPrediction {
  driverId: string;
  driverName?: string;
  predictedTours: number;
  predictedOnTimeRate: number;
  predictedAvgMin: number | null;
  confidenceScore: number;
  performanceTier: PerformanceTier;
}

interface Dashboard {
  predictionDate: string;
  totalDrivers: number;
  tierCounts: Record<PerformanceTier, number>;
  predictions: DriverPrediction[];
}

const TIER_META: Record<PerformanceTier, { label: string; badge: string; bg: string; border: string; dot: string }> = {
  top:     { label: 'Top',       badge: 'bg-matcha-600 text-white',       bg: 'bg-matcha-50',  border: 'border-matcha-200',  dot: 'bg-matcha-500' },
  good:    { label: 'Gut',       badge: 'bg-blue-600 text-white',         bg: 'bg-blue-50',    border: 'border-blue-200',    dot: 'bg-blue-500'   },
  average: { label: 'Ø',         badge: 'bg-amber-500 text-white',        bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-400'  },
  at_risk: { label: 'Risiko',    badge: 'bg-red-600 text-white',          bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500'    },
};

const MOCK: Dashboard = {
  predictionDate: new Date().toISOString().slice(0, 10),
  totalDrivers: 8,
  tierCounts: { top: 2, good: 3, average: 2, at_risk: 1 },
  predictions: [
    { driverId: 'd1', driverName: 'Marco R.', predictedTours: 9, predictedOnTimeRate: 0.92, predictedAvgMin: 18, confidenceScore: 78, performanceTier: 'top' },
    { driverId: 'd2', driverName: 'Ayşe K.', predictedTours: 8, predictedOnTimeRate: 0.89, predictedAvgMin: 21, confidenceScore: 71, performanceTier: 'top' },
    { driverId: 'd3', driverName: 'Jonas H.', predictedTours: 7, predictedOnTimeRate: 0.81, predictedAvgMin: 23, confidenceScore: 65, performanceTier: 'good' },
    { driverId: 'd4', driverName: 'Lena M.', predictedTours: 6, predictedOnTimeRate: 0.78, predictedAvgMin: 25, confidenceScore: 60, performanceTier: 'good' },
    { driverId: 'd5', driverName: 'Tom W.', predictedTours: 5, predictedOnTimeRate: 0.74, predictedAvgMin: 27, confidenceScore: 55, performanceTier: 'good' },
    { driverId: 'd6', driverName: 'Nadia P.', predictedTours: 5, predictedOnTimeRate: 0.68, predictedAvgMin: 29, confidenceScore: 48, performanceTier: 'average' },
    { driverId: 'd7', driverName: 'Ben S.', predictedTours: 4, predictedOnTimeRate: 0.65, predictedAvgMin: 31, confidenceScore: 42, performanceTier: 'average' },
    { driverId: 'd8', driverName: 'Kim A.', predictedTours: 3, predictedOnTimeRate: 0.51, predictedAvgMin: 38, confidenceScore: 30, performanceTier: 'at_risk' },
  ],
};

export function FahrerVorhersageDashboard({ locationId }: { locationId?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    fetch(`/api/delivery/admin/driver-performance-prediction?action=dashboard`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d ?? MOCK))
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [open, locationId]);

  const tierOrder: PerformanceTier[] = ['top', 'good', 'average', 'at_risk'];

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Vorhersage Heute</span>
          {data && (
            <div className="flex gap-1 ml-1">
              {tierOrder.map(t => data.tierCounts[t] > 0 && (
                <span key={t} className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', TIER_META[t].badge)}>
                  {data.tierCounts[t]}× {TIER_META[t].label}
                </span>
              ))}
            </div>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Vorhersagen…
            </div>
          )}

          {!loading && data && (
            <>
              {/* Tier-Übersicht */}
              <div className="grid grid-cols-4 divide-x border-b">
                {tierOrder.map(t => {
                  const m = TIER_META[t];
                  const count = data.tierCounts[t] ?? 0;
                  return (
                    <div key={t} className={cn('flex flex-col items-center py-2 px-1', m.bg)}>
                      <div className="text-xl font-black tabular-nums">{count}</div>
                      <div className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black mt-0.5', m.badge)}>
                        {m.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fahrer-Liste */}
              <div className="divide-y">
                {data.predictions.map(p => {
                  const m = TIER_META[p.performanceTier];
                  return (
                    <div key={p.driverId} className={cn('flex items-center gap-3 px-4 py-2.5', m.bg)}>
                      <div className={cn('h-2 w-2 rounded-full shrink-0 mt-0.5', m.dot)} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold">{p.driverName ?? `Fahrer ${p.driverId.slice(-4)}`}</span>
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', m.badge)}>
                            {m.label}
                          </span>
                        </div>
                        <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground">
                          <span className="font-bold text-foreground">{p.predictedTours} Touren</span>
                          <span>{Math.round(p.predictedOnTimeRate * 100)}% pünktlich</span>
                          {p.predictedAvgMin && <span>Ø {p.predictedAvgMin} Min</span>}
                        </div>
                      </div>

                      {/* Konfidenz-Balken */}
                      <div className="shrink-0 text-right w-14">
                        <div className="text-[9px] text-muted-foreground mb-0.5">Konfidenz</div>
                        <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', p.confidenceScore >= 60 ? 'bg-matcha-500' : p.confidenceScore >= 40 ? 'bg-amber-400' : 'bg-red-400')}
                            style={{ width: `${p.confidenceScore}%` }}
                          />
                        </div>
                        <div className="text-[9px] font-bold tabular-nums mt-0.5">{p.confidenceScore}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 py-2 bg-muted/20 border-t">
                <span className="text-[10px] text-muted-foreground">
                  {!locationId && '⚠ Mock-Daten (keine Filiale) · '}
                  KI-Prognose für {new Date(data.predictionDate).toLocaleDateString('de-DE')} · {data.totalDrivers} Fahrer
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
