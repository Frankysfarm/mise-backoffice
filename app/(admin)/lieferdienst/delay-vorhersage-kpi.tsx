'use client';

/**
 * DelayVorhersageKpi — Phase 317
 *
 * Lieferdienst-KPI-Karte: Zeigt Verspätungsprognose-Summary für den aktuellen Tag.
 * Nutzt GET /api/delivery/admin/order-delay-prediction?action=dashboard
 * Polling alle 90 s.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BarChart2, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Summary {
  totalActive: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  avgRiskScore: number;
  settledToday: number;
  avgActualDelayMin: number | null;
}

interface AccuracyRow {
  riskLevel: string;
  totalPredictions: number;
  settled: number;
  avgAbsErrorMin: number | null;
  actualLateRate: number | null;
}

function KpiTile({
  label, value, sub, colorClass,
}: { label: string; value: string; sub?: string; colorClass: string }) {
  return (
    <div className={cn('rounded-xl p-3 border', colorClass)}>
      <div className="text-lg font-black tabular-nums leading-none">{value}</div>
      <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{label}</div>
      {sub && <div className="text-[9px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function DelayVorhersageKpi({ locationId }: { locationId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [accuracy, setAccuracy] = useState<AccuracyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/order-delay-prediction?action=dashboard&location_id=${encodeURIComponent(locationId)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const d = await res.json();
      if (d.summary) setSummary(d.summary as Summary);
      if (Array.isArray(d.accuracy)) setAccuracy(d.accuracy as AccuracyRow[]);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 90_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-44 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!summary || (summary.totalActive === 0 && summary.settledToday === 0)) return null;

  const urgentPct = summary.totalActive > 0
    ? Math.round(((summary.criticalCount + summary.highCount) / summary.totalActive) * 100)
    : 0;

  const bestRow = accuracy.find(a => a.riskLevel === 'critical' || a.riskLevel === 'high');
  const modelAccuracy = bestRow?.avgAbsErrorMin != null
    ? `±${bestRow.avgAbsErrorMin.toFixed(1)} Min Modell-Fehler`
    : null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700">
          <BarChart2 className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-stone-800">Verspätungs-KI</div>
          <div className="text-xs text-stone-400">
            {summary.totalActive} aktiv · {summary.settledToday} heute abgerechnet
          </div>
        </div>
        {summary.criticalCount > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-700">
            <AlertTriangle className="h-3 w-3" />
            {summary.criticalCount} kritisch
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        <KpiTile
          label="Aktive Prognosen"
          value={String(summary.totalActive)}
          sub={`Ø Score ${Math.round(summary.avgRiskScore)}`}
          colorClass="bg-stone-50 border-stone-200 text-stone-700"
        />
        <KpiTile
          label="Kritisch/Hoch"
          value={String(summary.criticalCount + summary.highCount)}
          sub={urgentPct > 0 ? `${urgentPct}% der aktiven` : 'Kein Risiko'}
          colorClass={
            summary.criticalCount > 0 ? 'bg-red-50 border-red-200 text-red-800' :
            summary.highCount > 0     ? 'bg-orange-50 border-orange-200 text-orange-800' :
            'bg-matcha-50 border-matcha-200 text-matcha-700'
          }
        />
        <KpiTile
          label="Heute abgerechnet"
          value={String(summary.settledToday)}
          sub={summary.avgActualDelayMin != null
            ? `Ø ${summary.avgActualDelayMin.toFixed(1)} Min Verzug`
            : 'Keine Verzugsdaten'}
          colorClass="bg-blue-50 border-blue-200 text-blue-800"
        />
        <KpiTile
          label="Niedrig-Risiko"
          value={String(summary.lowCount)}
          sub={modelAccuracy ?? 'Modell lernt…'}
          colorClass="bg-matcha-50 border-matcha-200 text-matcha-700"
        />
      </div>

      {/* Accuracy-Summary für Hochrisiko-Prognosen */}
      {accuracy.length > 0 && (
        <div className="px-5 pb-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
            Modell-Genauigkeit
          </div>
          <div className="flex flex-wrap gap-2">
            {accuracy
              .filter(a => a.settled > 0)
              .map(a => {
                const levelLabel = a.riskLevel === 'critical' ? 'Kritisch' :
                  a.riskLevel === 'high' ? 'Hoch' :
                  a.riskLevel === 'medium' ? 'Mittel' : 'Niedrig';
                const lateRate = a.actualLateRate != null ? `${Math.round(a.actualLateRate)}% spät` : '';
                const absErr = a.avgAbsErrorMin != null ? `±${a.avgAbsErrorMin.toFixed(1)}m` : '';
                const bgCls = a.riskLevel === 'critical' ? 'bg-red-50 border-red-200' :
                  a.riskLevel === 'high' ? 'bg-orange-50 border-orange-200' :
                  a.riskLevel === 'medium' ? 'bg-amber-50 border-amber-200' :
                  'bg-matcha-50 border-matcha-200';

                return (
                  <div key={a.riskLevel} className={cn('rounded-lg border px-2.5 py-1.5', bgCls)}>
                    <div className="flex items-center gap-1.5">
                      {a.riskLevel === 'low' || a.riskLevel === 'medium'
                        ? <CheckCircle2 className="h-3 w-3 text-matcha-600" />
                        : <Zap className="h-3 w-3 text-red-600" />
                      }
                      <span className="text-[10px] font-bold text-stone-700">{levelLabel}</span>
                    </div>
                    <div className="text-[9px] text-stone-500 mt-0.5">
                      {a.settled} abgerechn.{lateRate ? ` · ${lateRate}` : ''}{absErr ? ` · ${absErr}` : ''}
                    </div>
                  </div>
                );
              })}
            {accuracy.every(a => a.settled === 0) && (
              <div className="text-[11px] text-stone-400 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Noch keine abgerechneten Prognosen heute
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
