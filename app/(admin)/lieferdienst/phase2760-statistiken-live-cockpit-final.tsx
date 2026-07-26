'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Clock, Package, Euro, AlertTriangle, Users, Star, Truck } from 'lucide-react';

interface KpiCard {
  label: string;
  value: string;
  delta: number | null;
  good: boolean;
  ziel?: string;
}

interface StundenEintrag {
  h: number;
  label: string;
  bestellungen: number;
  umsatz: number;
}

interface Data {
  kpis: KpiCard[];
  stunden: StundenEintrag[];
  zonen: { name: string; sla_pct: number; bestellungen: number }[];
  fahrer_top3: { name: string; score: number }[];
  alert_strip: string[];
}

const MOCK_DATA: Data = {
  kpis: [
    { label: 'Bestellungen', value: '47', delta: 12, good: true, ziel: '60' },
    { label: 'Umsatz', value: '1.284 €', delta: 8, good: true, ziel: '1.500 €' },
    { label: 'Ø Lieferzeit', value: '26 Min', delta: -3, good: false, ziel: '≤25 Min' },
    { label: 'Pünktlichkeit', value: '84%', delta: 4, good: true, ziel: '≥90%' },
    { label: 'Bewertung', value: '4.6 ★', delta: 0, good: true, ziel: '≥4.5' },
    { label: 'Aktive Fahrer', value: '5', delta: null, good: true },
    { label: 'SLA', value: '91%', delta: 2, good: true, ziel: '≥95%' },
    { label: 'Storno', value: '3.2%', delta: -1, good: false, ziel: '≤3%' },
  ],
  stunden: [
    { h: 11, label: '11:00', bestellungen: 4, umsatz: 112 },
    { h: 12, label: '12:00', bestellungen: 9, umsatz: 248 },
    { h: 13, label: '13:00', bestellungen: 12, umsatz: 336 },
    { h: 14, label: '14:00', bestellungen: 7, umsatz: 196 },
    { h: 15, label: '15:00', bestellungen: 3, umsatz: 84 },
    { h: 16, label: '16:00', bestellungen: 5, umsatz: 140 },
    { h: 17, label: '17:00', bestellungen: 7, umsatz: 168 },
  ],
  zonen: [
    { name: 'Mitte', sla_pct: 94, bestellungen: 18 },
    { name: 'Nord', sla_pct: 88, bestellungen: 14 },
    { name: 'West', sla_pct: 79, bestellungen: 9 },
    { name: 'Süd', sla_pct: 96, bestellungen: 6 },
  ],
  fahrer_top3: [
    { name: 'Max M.', score: 89 },
    { name: 'Tom R.', score: 82 },
    { name: 'Anna K.', score: 74 },
  ],
  alert_strip: ['Ø Lieferzeit 26 Min > Ziel 25 Min', 'Storno-Rate leicht über Ziel'],
};

type Modus = 'bestellungen' | 'umsatz';

export function LieferdienstPhase2760StatistikLiveCockpitFinal() {
  const [data, setData] = useState<Data>(MOCK_DATA);
  const [modus, setModus] = useState<Modus>('bestellungen');
  const [nowH] = useState(() => new Date().getHours());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/statistik-live-cockpit');
      if (res.ok) {
        const d = await res.json();
        if (d.kpis) setData(d);
      }
    } catch { /* Mock-Fallback */ }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [load]);

  const maxBar = Math.max(...data.stunden.map(s => modus === 'bestellungen' ? s.bestellungen : s.umsatz), 1);

  return (
    <div className="rounded-xl border border-indigo-100 bg-white p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-indigo-600 shrink-0" />
        <span className="font-semibold text-sm text-slate-800">Statistiken Live-Cockpit Final</span>
        <span className="ml-auto text-[10px] text-slate-400">1-Min-Polling</span>
      </div>

      {/* Alert-Strip */}
      {data.alert_strip.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.alert_strip.map((a, i) => (
            <div key={i} className="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3 shrink-0" /> {a}
            </div>
          ))}
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data.kpis.map(k => (
          <div key={k.label} className={`rounded-xl p-3 ${k.good ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">{k.label}</div>
            <div className={`text-base font-black tabular-nums ${k.good ? 'text-emerald-700' : 'text-red-600'}`}>{k.value}</div>
            {k.delta !== null && (
              <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-0.5 ${k.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {k.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {k.delta >= 0 ? '+' : ''}{k.delta}%
              </div>
            )}
            {k.ziel && <div className="text-[9px] text-slate-400 mt-0.5">Ziel {k.ziel}</div>}
          </div>
        ))}
      </div>

      {/* Stundenverlauf-Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Stundenverlauf</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {(['bestellungen', 'umsatz'] as Modus[]).map(m => (
              <button key={m} onClick={() => setModus(m)}
                className={`px-2 py-0.5 text-[10px] font-semibold transition-colors ${modus === m ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-1 h-16">
          {data.stunden.map(s => {
            const val = modus === 'bestellungen' ? s.bestellungen : s.umsatz;
            const pct = Math.max(4, Math.round((val / maxBar) * 100));
            const isNow = s.h === nowH;
            return (
              <div key={s.h} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-t-sm transition-all ${isNow ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                  style={{ height: `${pct}%` }}
                  title={`${s.label}: ${val}${modus === 'umsatz' ? ' €' : ''}`}
                />
                <span className={`text-[8px] tabular-nums font-semibold ${isNow ? 'text-indigo-600' : 'text-slate-400'}`}>{s.label.slice(0, 2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zonen + Fahrer */}
      <div className="grid grid-cols-2 gap-3">
        {/* Zonen-Ranking */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Zonen SLA</div>
          <div className="space-y-1.5">
            {data.zonen.map(z => (
              <div key={z.name} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-600 w-10 shrink-0">{z.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${z.sla_pct >= 90 ? 'bg-emerald-500' : z.sla_pct >= 80 ? 'bg-yellow-400' : 'bg-red-500'}`}
                    style={{ width: `${z.sla_pct}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold tabular-nums w-8 text-right ${z.sla_pct >= 90 ? 'text-emerald-700' : 'text-red-600'}`}>{z.sla_pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fahrer Top-3 */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Top Fahrer</div>
          <div className="space-y-1.5">
            {data.fahrer_top3.map((f, i) => (
              <div key={f.name} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}.</span>
                <span className="text-[10px] text-slate-600 flex-1 truncate">{f.name}</span>
                <span className={`text-[10px] font-bold tabular-nums ${f.score >= 80 ? 'text-emerald-700' : f.score >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{f.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
