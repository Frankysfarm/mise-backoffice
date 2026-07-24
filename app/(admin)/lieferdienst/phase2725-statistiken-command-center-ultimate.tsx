'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';

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
    { label: 'Bestellungen', wert: '53', einheit: '', ziel: '≥50', delta_pct: 6, ampel: 'gruen', invertiert: false },
    { label: 'Umsatz', wert: '1.420', einheit: '€', ziel: '≥1.500 €', delta_pct: -5, ampel: 'gelb', invertiert: false },
    { label: 'Ø Lieferzeit', wert: '31', einheit: ' Min', ziel: '≤35', delta_pct: -8, ampel: 'gruen', invertiert: true },
    { label: 'Pünktlichkeit', wert: '91', einheit: '%', ziel: '≥90%', delta_pct: 1, ampel: 'gruen', invertiert: false },
    { label: 'Fahrer online', wert: '5', einheit: '', ziel: '≥3', delta_pct: 0, ampel: 'gruen', invertiert: false },
    { label: 'SLA-Quote', wert: '88', einheit: '%', ziel: '≥85%', delta_pct: 3, ampel: 'gruen', invertiert: false },
    { label: 'Storno-Quote', wert: '3.2', einheit: '%', ziel: '≤5%', delta_pct: -1, ampel: 'gruen', invertiert: true },
    { label: 'Ø Bewertung', wert: '4.7', einheit: '★', ziel: '≥4.5', delta_pct: 0, ampel: 'gruen', invertiert: false },
    { label: 'ETA-Genauigkeit', wert: '86', einheit: '%', ziel: '≥85%', delta_pct: 2, ampel: 'gruen', invertiert: false },
    { label: 'Umsatz/Fahrer', wert: '284', einheit: '€', ziel: '≥200 €', delta_pct: 12, ampel: 'gruen', invertiert: false },
  ],
  gesamt_score: 87,
  insight: 'Starke Schicht: Lieferzeit 8% unter Ziel. Peak-Stunden 18–20 Uhr voll ausgelastet.',
  alert_kpis: ['Umsatz 5% unter Tagesziel'],
  stunden: [
    { stunde: 11, bestellungen: 4, umsatz: 95, ist_aktuell: false },
    { stunde: 12, bestellungen: 9, umsatz: 230, ist_aktuell: false },
    { stunde: 13, bestellungen: 12, umsatz: 310, ist_aktuell: false },
    { stunde: 14, bestellungen: 7, umsatz: 185, ist_aktuell: false },
    { stunde: 15, bestellungen: 5, umsatz: 130, ist_aktuell: false },
    { stunde: 16, bestellungen: 6, umsatz: 155, ist_aktuell: false },
    { stunde: 17, bestellungen: 10, umsatz: 315, ist_aktuell: true },
  ],
};

const AMPEL_BG: Record<string, string> = { gruen: 'bg-emerald-50 border-emerald-200', gelb: 'bg-amber-50 border-amber-200', rot: 'bg-red-50 border-red-300' };
const AMPEL_TEXT: Record<string, string> = { gruen: 'text-emerald-700', gelb: 'text-amber-700', rot: 'text-red-700' };

export function LieferdienstPhase2725StatistikenCommandCenterUltimate({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/statistiken-dashboard?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.kpis) setData(d); }
    } catch {}
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const maxBar = Math.max(...data.stunden.map(s => mode === 'bestellungen' ? s.bestellungen : s.umsatz), 1);
  const scoreColor = data.gesamt_score >= 85 ? 'text-emerald-600' : data.gesamt_score >= 70 ? 'text-amber-600' : 'text-red-600';
  const scoreBarColor = data.gesamt_score >= 85 ? 'bg-emerald-500' : data.gesamt_score >= 70 ? 'bg-amber-400' : 'bg-red-500';

  return (
    <div className="border rounded-xl bg-white shadow-sm mb-4">
      <button className="w-full flex items-center justify-between p-3 text-left" onClick={() => setOpen(o => !o)}>
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Activity className="w-4 h-4 text-indigo-600" />
          Statistiken Command Center
          {data.alert_kpis.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-bold">{data.alert_kpis.length} ⚠</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Gesamt-Score */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border">
            <div className="text-center flex-shrink-0 w-16">
              <div className={`text-3xl font-black ${scoreColor}`}>{data.gesamt_score}</div>
              <div className="text-[10px] text-gray-500 uppercase">Gesamt</div>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-3 rounded-full transition-all ${scoreBarColor}`} style={{ width: `${data.gesamt_score}%` }} />
              </div>
              {data.insight && <div className="text-xs text-gray-600 leading-tight">{data.insight}</div>}
            </div>
          </div>

          {/* Alert */}
          {data.alert_kpis.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <ul className="space-y-0.5">{data.alert_kpis.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}

          {/* KPI-Grid 2-spaltig */}
          <div className="grid grid-cols-2 gap-2">
            {data.kpis.map((k, i) => {
              const deltaPos = k.invertiert ? k.delta_pct < 0 : k.delta_pct > 0;
              const deltaNeg = k.invertiert ? k.delta_pct > 0 : k.delta_pct < 0;
              return (
                <div key={i} className={`rounded-lg border p-2 ${AMPEL_BG[k.ampel]}`}>
                  <div className="flex items-start justify-between gap-1">
                    <div className="text-xs text-gray-500 leading-tight">{k.label}</div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {deltaPos ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : deltaNeg ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-gray-300" />}
                      <span className={`text-xs font-medium ${deltaPos ? 'text-emerald-600' : deltaNeg ? 'text-red-500' : 'text-gray-400'}`}>
                        {k.delta_pct > 0 ? '+' : ''}{k.delta_pct}%
                      </span>
                    </div>
                  </div>
                  <div className={`text-lg font-black mt-0.5 ${AMPEL_TEXT[k.ampel]}`}>
                    {k.wert}<span className="text-xs font-normal text-gray-500">{k.einheit}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                    <Target className="w-2.5 h-2.5" />
                    {k.ziel}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stundenverlauf */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">Stundenverlauf</span>
              <div className="flex gap-1">
                {(['bestellungen', 'umsatz'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${mode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}
                  >
                    {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-1 h-20">
              {data.stunden.map(s => {
                const val = mode === 'bestellungen' ? s.bestellungen : s.umsatz;
                const pct = Math.max((val / maxBar) * 100, 4);
                return (
                  <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex flex-col justify-end" style={{ height: 64 }}>
                      <div
                        className={`w-full rounded-t transition-all ${s.ist_aktuell ? 'bg-blue-500' : 'bg-indigo-300'}`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <div className={`text-[9px] ${s.ist_aktuell ? 'font-bold text-blue-600' : 'text-gray-400'}`}>{s.stunde}h</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-gray-400 text-center">10 KPI-Kacheln · Ampel+Δ%+Ziel · 60-Sek-Polling · Mock-Fallback</div>
        </div>
      )}
    </div>
  );
}
