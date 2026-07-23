'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BarChart2, AlertTriangle, Target } from 'lucide-react';

interface KpiWert {
  label: string;
  wert: string;
  einheit: string;
  ziel: string;
  delta_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  kpis: KpiWert[];
  gesamt_score: number;
  insight: string | null;
  alert_kpis: string[];
  schicht_dauer_min: number;
}

const MOCK: ApiResponse = {
  kpis: [
    { label: 'Bestellungen', wert: '47', einheit: '', ziel: '≥50', delta_pct: 12, ampel: 'gelb' },
    { label: 'Umsatz', wert: '1.240', einheit: '€', ziel: '≥1.500 €', delta_pct: 8, ampel: 'gelb' },
    { label: 'Ø Lieferzeit', wert: '32', einheit: ' Min', ziel: '≤35 Min', delta_pct: -5, ampel: 'gruen' },
    { label: 'Pünktlichkeit', wert: '87', einheit: '%', ziel: '≥90%', delta_pct: 3, ampel: 'gelb' },
    { label: 'Aktive Fahrer', wert: '4', einheit: '', ziel: '≥3', delta_pct: 0, ampel: 'gruen' },
    { label: 'Stornoquote', wert: '2.1', einheit: '%', ziel: '≤5%', delta_pct: -1, ampel: 'gruen' },
    { label: 'ETA-Genauigkeit', wert: '84', einheit: '%', ziel: '≥85%', delta_pct: 2, ampel: 'gelb' },
    { label: 'Kundenbewertung', wert: '4.6', einheit: '★', ziel: '≥4.5', delta_pct: 0, ampel: 'gruen' },
  ],
  gesamt_score: 78,
  insight: 'Umsatz liegt 17% unter Ziel — Peak-Stunden 18–20 Uhr optimal nutzen.',
  alert_kpis: ['Pünktlichkeit unter Ziel', 'ETA-Genauigkeit knapp unter Ziel'],
  schicht_dauer_min: 195,
};

const AMPEL_BG: Record<string, string> = { gruen: 'bg-emerald-50 border-emerald-200', gelb: 'bg-amber-50 border-amber-200', rot: 'bg-red-50 border-red-300' };
const AMPEL_TEXT: Record<string, string> = { gruen: 'text-emerald-700', gelb: 'text-amber-700', rot: 'text-red-700' };

export function LieferdienstPhase2720StatistikenDashboardUltra({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>(MOCK);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/statistiken-dashboard?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.kpis) setData(d);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const schichtH = Math.floor(data.schicht_dauer_min / 60);
  const schichtM = data.schicht_dauer_min % 60;

  return (
    <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm mb-4">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <BarChart2 className="w-4 h-4 text-blue-600" />
          Statistiken Dashboard Ultra
          {data.alert_kpis.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-bold">
              {data.alert_kpis.length} ⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Gesamt-Score-Ring (text-based) */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border">
            <div className="text-center flex-shrink-0">
              <div className={`text-3xl font-black ${data.gesamt_score >= 85 ? 'text-emerald-600' : data.gesamt_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {data.gesamt_score}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">Gesamt-Score</div>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${data.gesamt_score >= 85 ? 'bg-emerald-500' : data.gesamt_score >= 70 ? 'bg-amber-400' : 'bg-red-500'}`}
                  style={{ width: `${data.gesamt_score}%` }}
                />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <Target className="w-3 h-3" />
                <span>Ziel: ≥85 · Schicht: {schichtH}h {schichtM}m</span>
              </div>
            </div>
          </div>

          {/* Alert-Strip */}
          {data.alert_kpis.length > 0 && (
            <div className="space-y-1">
              {data.alert_kpis.map(a => (
                <div key={a} className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {data.kpis.map(kpi => (
              <div key={kpi.label} className={`rounded-xl border p-2.5 ${AMPEL_BG[kpi.ampel]}`}>
                <div className="text-[9px] font-black uppercase tracking-wide text-gray-500 mb-1">{kpi.label}</div>
                <div className={`text-xl font-black tabular-nums leading-none ${AMPEL_TEXT[kpi.ampel]}`}>
                  {kpi.wert}<span className="text-sm font-normal">{kpi.einheit}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-[9px] text-gray-400">{kpi.ziel}</div>
                  <div className="flex items-center gap-0.5 text-[9px]">
                    {kpi.delta_pct > 0 ? (
                      <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                    ) : kpi.delta_pct < 0 ? (
                      <TrendingDown className="w-2.5 h-2.5 text-red-500" />
                    ) : (
                      <Minus className="w-2.5 h-2.5 text-gray-400" />
                    )}
                    <span className={kpi.delta_pct > 0 ? 'text-emerald-600' : kpi.delta_pct < 0 ? 'text-red-600' : 'text-gray-400'}>
                      {kpi.delta_pct > 0 ? '+' : ''}{kpi.delta_pct}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Insight */}
          {data.insight && (
            <div className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg px-3 py-2 italic">
              💡 {data.insight}
            </div>
          )}

          <div className="text-[10px] text-gray-400 text-right">Aktualisierung jede Minute</div>
        </div>
      )}
    </div>
  );
}
