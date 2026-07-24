'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, AlertTriangle, TrendingUp, TrendingDown, Minus, Target, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KpiKachel {
  label: string;
  wert: string;
  einheit: string;
  ziel: string;
  delta_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  invertiert: boolean;
}

interface StundenBar {
  stunde: number;
  bestellungen: number;
  umsatz: number;
  ist_aktuell: boolean;
}

interface ApiResponse {
  kpis: KpiKachel[];
  gesamt_score: number;
  insight: string | null;
  alert_kpis: string[];
  stunden: StundenBar[];
}

const MOCK: ApiResponse = {
  kpis: [
    { label: 'Bestellungen', wert: '61', einheit: '', ziel: '≥50', delta_pct: 8, ampel: 'gruen', invertiert: false },
    { label: 'Umsatz', wert: '1.640', einheit: '€', ziel: '≥1.500 €', delta_pct: 9, ampel: 'gruen', invertiert: false },
    { label: 'Ø Lieferzeit', wert: '29', einheit: ' Min', ziel: '≤35', delta_pct: -6, ampel: 'gruen', invertiert: true },
    { label: 'Pünktlichkeit', wert: '93', einheit: '%', ziel: '≥90%', delta_pct: 2, ampel: 'gruen', invertiert: false },
    { label: 'Ø Bewertung', wert: '4.8', einheit: '★', ziel: '≥4.5', delta_pct: 1, ampel: 'gruen', invertiert: false },
    { label: 'Fahrer online', wert: '6', einheit: '', ziel: '≥3', delta_pct: 0, ampel: 'gruen', invertiert: false },
    { label: 'SLA-Quote', wert: '91', einheit: '%', ziel: '≥85%', delta_pct: 4, ampel: 'gruen', invertiert: false },
    { label: 'Storno-Quote', wert: '2.8', einheit: '%', ziel: '≤5%', delta_pct: -0.5, ampel: 'gruen', invertiert: true },
    { label: 'Ø Bestellwert', wert: '26.9', einheit: '€', ziel: '≥24 €', delta_pct: 3, ampel: 'gruen', invertiert: false },
    { label: 'Neue Kunden', wert: '14', einheit: '', ziel: '≥10', delta_pct: 17, ampel: 'gruen', invertiert: false },
  ],
  gesamt_score: 87,
  insight: 'Starke Schicht: Umsatz +9% über Ziel, Lieferzeit auf Tiefstwert 29 Min.',
  alert_kpis: [],
  stunden: [
    { stunde: 11, bestellungen: 3, umsatz: 78, ist_aktuell: false },
    { stunde: 12, bestellungen: 8, umsatz: 212, ist_aktuell: false },
    { stunde: 13, bestellungen: 11, umsatz: 295, ist_aktuell: false },
    { stunde: 14, bestellungen: 7, umsatz: 188, ist_aktuell: false },
    { stunde: 15, bestellungen: 5, umsatz: 134, ist_aktuell: false },
    { stunde: 16, bestellungen: 9, umsatz: 241, ist_aktuell: false },
    { stunde: 17, bestellungen: 12, umsatz: 322, ist_aktuell: false },
    { stunde: 18, bestellungen: 6, umsatz: 170, ist_aktuell: true },
  ],
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
  gelb: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
  rot: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
};
const AMPEL_DOT: Record<string, string> = { gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500' };
const AMPEL_VAL: Record<string, string> = { gruen: 'text-emerald-600', gelb: 'text-yellow-600', rot: 'text-red-600' };

function DeltaIcon({ d, inv }: { d: number; inv: boolean }) {
  const good = inv ? d < 0 : d > 0;
  const bad = inv ? d > 0 : d < 0;
  if (good) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (bad) return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

export function LieferdienstPhase2730StatistikLiveIntelligenceHub({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [chartModus, setChartModus] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/statistiken?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.kpis?.length) { setData(d); setLastUpdate(new Date()); } }
    } catch {}
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const scoreColor = (s: number) => s >= 85 ? 'text-emerald-600' : s >= 70 ? 'text-yellow-600' : 'text-red-600';
  const chartData = data.stunden.map(h => ({ name: `${h.stunde}h`, val: chartModus === 'bestellungen' ? h.bestellungen : h.umsatz, current: h.ist_aktuell }));

  return (
    <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button className="w-full flex items-center justify-between p-3 text-left" onClick={() => setOpen(o => !o)}>
        <span className="flex items-center gap-2 font-semibold text-sm">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          Statistiken Live Intelligence Hub
          {data.alert_kpis.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">{data.alert_kpis.length} ⚠</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{lastUpdate.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}</span>
          {open ? <TrendingUp className="w-4 h-4 text-gray-400" /> : <TrendingDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Gesamt-Score + Insight */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center justify-center px-4 py-2 border rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 min-w-[72px]">
              <div className="text-xs text-gray-500">Score</div>
              <div className={`text-3xl font-black ${scoreColor(data.gesamt_score)}`}>{data.gesamt_score}</div>
              <div className="w-full mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${data.gesamt_score}%` }} />
              </div>
            </div>
            {data.insight && (
              <div className="flex-1 flex items-center px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
                {data.insight}
              </div>
            )}
          </div>

          {/* Alert Strip */}
          {data.alert_kpis.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Kritisch: {data.alert_kpis.join(' · ')}
            </div>
          )}

          {/* KPI-Grid 2-spaltig */}
          <div className="grid grid-cols-2 gap-2">
            {data.kpis.map(k => (
              <div key={k.label} className={`border rounded-lg px-3 py-2 ${AMPEL_BG[k.ampel]}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{k.label}</span>
                  <div className="flex items-center gap-0.5">
                    <DeltaIcon d={k.delta_pct} inv={k.invertiert} />
                    <span className="text-xs text-gray-400">{k.delta_pct > 0 ? '+' : ''}{k.delta_pct}%</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-xl font-black ${AMPEL_VAL[k.ampel]}`}>{k.wert}{k.einheit}</span>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${AMPEL_DOT[k.ampel]}`} />
                </div>
                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <Target className="w-3 h-3" />{k.ziel}
                </div>
              </div>
            ))}
          </div>

          {/* Stundenverlauf-Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Stundenverlauf</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setChartModus('bestellungen')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${chartModus === 'bestellungen' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                >Bestellungen</button>
                <button
                  onClick={() => setChartModus('umsatz')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${chartModus === 'umsatz' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                >Umsatz</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => chartModus === 'umsatz' ? [`${v} €`, 'Umsatz'] : [v, 'Bestellungen']}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="val" radius={[3, 3, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.current ? '#6366f1' : '#a5b4fc'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-right text-xs text-gray-400">60-Sek-Polling · Mock-Fallback aktiv</div>
        </div>
      )}
    </div>
  );
}
