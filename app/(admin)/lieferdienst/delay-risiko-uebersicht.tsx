'use client';

/**
 * DelayRisikoUebersicht — Phase 317
 *
 * Lieferdienst-Panel: Vollständige Übersicht über alle Verspätungsprognosen
 * der aktuellen Schicht. Kombiniert Summary-Balken + Accuracy-Tabelle.
 * Nutzt GET /api/delivery/admin/order-delay-prediction?action=dashboard
 * Polling alle 2 Minuten (Lieferdienst-View aktualisiert sich langsamer).
 */

import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

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
  riskLevel: RiskLevel;
  totalPredictions: number;
  settled: number;
  avgRiskScore: number;
  avgPredictedDelayMin: number | null;
  avgActualDelayMin: number | null;
  avgAbsErrorMin: number | null;
  actualLateRate: number | null;
}

const RISK_CFG: Record<RiskLevel, { label: string; color: string; barColor: string }> = {
  critical: { label: 'Kritisch', color: 'text-red-700',    barColor: '#ef4444' },
  high:     { label: 'Hoch',     color: 'text-orange-700', barColor: '#f97316' },
  medium:   { label: 'Mittel',   color: 'text-amber-700',  barColor: '#f59e0b' },
  low:      { label: 'Niedrig',  color: 'text-matcha-700', barColor: '#65a30d' },
};

export function DelayRisikoUebersicht({ locationId }: { locationId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [accuracy, setAccuracy] = useState<AccuracyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
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
    intervalRef.current = setInterval(load, 120_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Risikoübersicht…
        </div>
      </div>
    );
  }

  if (!summary || (summary.totalActive === 0 && summary.settledToday === 0)) return null;

  const chartData: { name: string; count: number; fill: string }[] = [
    { name: 'Kritisch', count: summary.criticalCount, fill: '#ef4444' },
    { name: 'Hoch',     count: summary.highCount,     fill: '#f97316' },
    { name: 'Mittel',   count: summary.mediumCount,   fill: '#f59e0b' },
    { name: 'Niedrig',  count: summary.lowCount,      fill: '#65a30d' },
  ].filter(d => d.count > 0);

  const hasAccuracy = accuracy.some(a => a.settled > 0);
  const urgentPct = summary.totalActive > 0
    ? Math.round(((summary.criticalCount + summary.highCount) / summary.totalActive) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-700 shrink-0">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-stone-800">Verspätungsrisiko-Übersicht</div>
          <div className="text-xs text-stone-400">
            {summary.totalActive} aktive Prognosen · {summary.settledToday} heute abgerechnet
          </div>
        </div>
        {urgentPct > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-700">
            {urgentPct}% dringend
          </span>
        )}
        {open
          ? <ChevronUp className="h-4 w-4 text-stone-400" />
          : <ChevronDown className="h-4 w-4 text-stone-400" />
        }
      </button>

      {open && (
        <div className="p-5 space-y-5">
          {/* Risiko-Verteilung Balken */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-3">
              Risiko-Verteilung
            </div>
            <div className="flex gap-2 items-stretch">
              {((['critical', 'high', 'medium', 'low'] as RiskLevel[])).map(level => {
                const cfg = RISK_CFG[level];
                const count = level === 'critical' ? summary.criticalCount :
                              level === 'high'     ? summary.highCount :
                              level === 'medium'   ? summary.mediumCount : summary.lowCount;
                const pct = summary.totalActive > 0 ? (count / summary.totalActive) * 100 : 0;
                return (
                  <div key={level} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-16 rounded-lg bg-stone-50 border border-stone-100 relative overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-b-lg transition-all"
                        style={{
                          height: `${Math.max(pct, count > 0 ? 8 : 0)}%`,
                          backgroundColor: RISK_CFG[level].barColor,
                          opacity: count > 0 ? 0.9 : 0.2,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-black tabular-nums text-stone-700">{count}</span>
                      </div>
                    </div>
                    <span className={cn('text-[9px] font-bold uppercase', cfg.color)}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* KPI-Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
              <div className="text-lg font-black tabular-nums text-stone-800">
                {Math.round(summary.avgRiskScore)}
              </div>
              <div className="text-[10px] font-semibold text-stone-500">Ø Risiko-Score</div>
            </div>
            <div className={cn(
              'rounded-xl border p-3',
              summary.criticalCount > 0 ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-100',
            )}>
              <div className={cn(
                'text-lg font-black tabular-nums',
                summary.criticalCount > 0 ? 'text-red-700' : 'text-stone-800',
              )}>
                {summary.criticalCount + summary.highCount}
              </div>
              <div className="text-[10px] font-semibold text-stone-500">Kritisch + Hoch</div>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <div className="text-lg font-black tabular-nums text-blue-800">
                {summary.avgActualDelayMin != null
                  ? `+${summary.avgActualDelayMin.toFixed(0)}m`
                  : '—'
                }
              </div>
              <div className="text-[10px] font-semibold text-stone-500">Ø Ist-Verzug</div>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 1 && (
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={28}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: unknown) => [`${v} Bestellungen`, 'Anzahl']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Accuracy-Tabelle */}
          {hasAccuracy && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Modell-Genauigkeit (abgerechnete Prognosen)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left pb-1 font-bold text-stone-400 uppercase">Risiko</th>
                      <th className="text-right pb-1 font-bold text-stone-400 uppercase">Abgerchn.</th>
                      <th className="text-right pb-1 font-bold text-stone-400 uppercase">Ø Fehler</th>
                      <th className="text-right pb-1 font-bold text-stone-400 uppercase">Verspät.-Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accuracy.filter(a => a.settled > 0).map(a => {
                      const cfg = RISK_CFG[a.riskLevel as RiskLevel] ?? RISK_CFG.low;
                      return (
                        <tr key={a.riskLevel} className="border-b border-stone-50">
                          <td className={cn('py-1.5 font-bold', cfg.color)}>{cfg.label}</td>
                          <td className="py-1.5 text-right tabular-nums text-stone-600">{a.settled}</td>
                          <td className="py-1.5 text-right tabular-nums text-stone-600">
                            {a.avgAbsErrorMin != null ? `±${a.avgAbsErrorMin.toFixed(1)}m` : '—'}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {a.actualLateRate != null ? (
                              <span className={a.actualLateRate > 30 ? 'text-red-600 font-bold' : 'text-stone-600'}>
                                {Math.round(a.actualLateRate)}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
