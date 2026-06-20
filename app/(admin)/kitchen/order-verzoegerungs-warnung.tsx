'use client';

/**
 * KitchenOrderVerzoegerungsWarnung — Phase 317
 *
 * Zeigt der Küche welche ihrer aktiven Bestellungen laut Delay-Prediction
 * ein hohes/kritisches Verspätungsrisiko haben und warum.
 * Nur sichtbar wenn es kritische oder hohe Bestellungen gibt.
 * Polling alle 90 s auf /api/delivery/admin/order-delay-prediction?action=active
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChefHat, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface Prediction {
  orderId: string;
  delayRiskScore: number;
  riskLevel: RiskLevel;
  predictedDelayMin: number | null;
  riskFactors: {
    kitchenLoad: number;
    peakHourScore: number;
    driverShortage: number;
    orderComplexity: number;
    weatherPenalty: number;
  };
  bestellnummer?: string;
}

function getRiskHint(factors: Prediction['riskFactors']): string {
  if (factors.driverShortage >= 70) return 'Fahrermangel — möglichst früh fertig werden';
  if (factors.kitchenLoad >= 70)    return 'Hohe Küchenlast — Priorisierung prüfen';
  if (factors.peakHourScore >= 70)  return 'Stoßzeit — Lieferzeiten verlängert';
  if (factors.orderComplexity >= 70)return 'Komplexe Bestellung — Tempo erhöhen';
  if (factors.weatherPenalty >= 50) return 'Schlechtes Wetter — Puffer einplanen';
  return 'Mehrere Faktoren kombiniert';
}

export function KitchenOrderVerzoegerungsWarnung({ locationId }: { locationId: string | null }) {
  const [urgent, setUrgent] = useState<Prediction[]>([]);
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
        const filtered = (d.predictions as Prediction[])
          .filter(p => p.riskLevel === 'critical' || p.riskLevel === 'high')
          .sort((a, b) => b.delayRiskScore - a.delayRiskScore)
          .slice(0, 5);
        setUrgent(filtered);
      }
    } catch {}
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 90_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (urgent.length === 0) return null;

  const critCount = urgent.filter(p => p.riskLevel === 'critical').length;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      critCount > 0 ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50',
    )}>
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        critCount > 0 ? 'border-red-200 bg-red-100/60' : 'border-orange-200 bg-orange-100/60',
      )}>
        <AlertTriangle className={cn('h-4 w-4 shrink-0', critCount > 0 ? 'text-red-600' : 'text-orange-600')} />
        <span className={cn('text-xs font-bold uppercase tracking-wider', critCount > 0 ? 'text-red-800' : 'text-orange-800')}>
          {urgent.length} Bestellung{urgent.length !== 1 ? 'en' : ''} mit Verspätungsrisiko
        </span>
        <Zap className={cn('h-3.5 w-3.5 ml-auto', critCount > 0 ? 'text-red-500' : 'text-orange-500')} />
      </div>

      <div className="divide-y divide-red-100/50">
        {urgent.map((p) => {
          const isCrit = p.riskLevel === 'critical';
          return (
            <div key={p.orderId} className="flex items-start gap-3 px-4 py-3">
              <div className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                isCrit ? 'bg-red-200 text-red-700' : 'bg-orange-200 text-orange-700',
              )}>
                <ChefHat className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-black text-stone-800">
                    #{p.bestellnummer ?? p.orderId.slice(0, 6)}
                  </span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[9px] font-black',
                    isCrit ? 'bg-red-600 text-white' : 'bg-orange-500 text-white',
                  )}>
                    {isCrit ? 'KRITISCH' : 'HOHES RISIKO'}
                  </span>
                  {p.predictedDelayMin != null && p.predictedDelayMin > 0 && (
                    <span className="text-[10px] font-bold text-red-600 flex items-center gap-0.5">
                      <Clock className="h-3 w-3" /> ~{Math.round(p.predictedDelayMin)} Min Verzug
                    </span>
                  )}
                </div>
                <div className={cn('text-[11px] mt-0.5', isCrit ? 'text-red-700' : 'text-orange-700')}>
                  {getRiskHint(p.riskFactors)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={cn('text-sm font-black tabular-nums', isCrit ? 'text-red-700' : 'text-orange-700')}>
                  {Math.round(p.delayRiskScore)}
                </div>
                <div className="text-[9px] text-stone-500 uppercase">Score</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
