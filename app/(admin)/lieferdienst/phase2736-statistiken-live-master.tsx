'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface KpiKachel {
  key: string;
  label: string;
  wert: number;
  einheit: string;
  ziel: number;
  vorwoche: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  inverted: boolean;
}

interface StundenPunkt {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface ApiResponse {
  kpis: KpiKachel[];
  stunden: StundenPunkt[];
  gesamt_score: number;
  insight_tipp: string;
}

const MOCK: ApiResponse = {
  gesamt_score: 84,
  insight_tipp: 'Rush-Hour 18–19 Uhr: Fahrer-Abdeckung erhöhen für bessere SLA.',
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', wert: 162, einheit: '', ziel: 140, vorwoche: 145, ampel: 'gruen', inverted: false },
    { key: 'umsatz', label: 'Umsatz', wert: 4210, einheit: '€', ziel: 3800, vorwoche: 3950, ampel: 'gruen', inverted: false },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: 27, einheit: 'min', ziel: 30, vorwoche: 30, ampel: 'gruen', inverted: true },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', wert: 88, einheit: '%', ziel: 90, vorwoche: 86, ampel: 'gelb', inverted: false },
    { key: 'bewertung', label: 'Bewertung', wert: 4.7, einheit: '★', ziel: 4.5, vorwoche: 4.6, ampel: 'gruen', inverted: false },
    { key: 'fahrer', label: 'Aktive Fahrer', wert: 8, einheit: '', ziel: 7, vorwoche: 7, ampel: 'gruen', inverted: false },
    { key: 'sla', label: 'SLA-Rate', wert: 87, einheit: '%', ziel: 92, vorwoche: 85, ampel: 'gelb', inverted: false },
    { key: 'storno', label: 'Stornoquote', wert: 2.8, einheit: '%', ziel: 5, vorwoche: 3.5, ampel: 'gruen', inverted: true },
    { key: 'trinkgeld', label: 'Ø Trinkgeld', wert: 1.6, einheit: '€', ziel: 1.2, vorwoche: 1.4, ampel: 'gruen', inverted: false },
    { key: 'touren', label: 'Touren', wert: 57, einheit: '', ziel: 50, vorwoche: 52, ampel: 'gruen', inverted: false },
  ],
  stunden: [
    { stunde: '11', bestellungen: 9, umsatz: 230 },
    { stunde: '12', bestellungen: 21, umsatz: 540 },
    { stunde: '13', bestellungen: 28, umsatz: 720 },
    { stunde: '14', bestellungen: 16, umsatz: 410 },
    { stunde: '15', bestellungen: 11, umsatz: 280 },
    { stunde: '16', bestellungen: 14, umsatz: 360 },
    { stunde: '17', bestellungen: 25, umsatz: 640 },
    { stunde: '18', bestellungen: 30, umsatz: 770 },
    { stunde: '19', bestellungen: 15, umsatz: 350 },
  ],
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'border-emerald-200',
  gelb: 'border-yellow-200',
  rot: 'border-red-200',
};
const AMPEL_DOT: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb: 'bg-yellow-400',
  rot: 'bg-red-500',
};
const AMPEL_VAL: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

export function LieferdienstPhase2736StatistikLiveMaster({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [open, setOpen] = useState(true);
  const stunde = new Date().getHours().toString();

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/statistiken-live?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.kpis?.length) setData(d);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const alertKpis = data.kpis.filter(k => k.ampel === 'rot');
  const scoreColor = (s: number) => s >= 85 ? 'text-emerald-600' : s >= 70 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="border rounded-xl bg-white shadow-sm mb-3 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 text-left bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-gray-900">
          <BarChart3 className="w-4 h-4 text-purple-600" />
          Statistiken Live-Master
          {alertKpis.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">
              {alertKpis.length} Alert
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-black ${scoreColor(data.gesamt_score)}`}>{data.gesamt_score}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {alertKpis.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {alertKpis.map(k => (
                <span key={k.key} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertTriangle className="w-3 h-3" /> {k.label}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {data.kpis.map(k => {
              const delta = k.wert - k.vorwoche;
              const besser = k.inverted ? delta < 0 : delta > 0;
              return (
                <div key={k.key} className={`rounded-lg border p-2 ${AMPEL_BG[k.ampel]}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`w-2 h-2 rounded-full ${AMPEL_DOT[k.ampel]}`} />
                    <span className="text-xs text-gray-500 truncate">{k.label}</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className={`text-base font-bold ${AMPEL_VAL[k.ampel]}`}>
                      {k.einheit === '€' ? `${k.wert.toFixed(0)}€` : k.einheit === '★' ? `${k.wert.toFixed(1)}★` : `${k.wert}${k.einheit}`}
                    </span>
                    {besser
                      ? <TrendingUp className="w-3 h-3 text-emerald-500 mb-0.5" />
                      : <TrendingDown className="w-3 h-3 text-red-500 mb-0.5" />
                    }
                  </div>
                  <div className="text-xs text-gray-400">Ziel: {k.einheit === '€' ? `${k.ziel}€` : `${k.ziel}${k.einheit}`}</div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Stundenverlauf</span>
              <div className="flex gap-1">
                {(['bestellungen', 'umsatz'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`text-xs px-2 py-0.5 rounded ${chartMode === m ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={data.stunden} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <XAxis dataKey="stunde" tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => chartMode === 'umsatz' ? `${v}€` : v} />
                <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                  {data.stunden.map((d) => (
                    <Cell key={d.stunde} fill={d.stunde === stunde ? '#7c3aed' : '#c4b5fd'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-start gap-1.5 bg-purple-50 rounded-lg p-2">
            <span className="text-purple-500 mt-0.5">💡</span>
            <p className="text-xs text-gray-700">{data.insight_tipp}</p>
          </div>
        </div>
      )}
    </div>
  );
}
