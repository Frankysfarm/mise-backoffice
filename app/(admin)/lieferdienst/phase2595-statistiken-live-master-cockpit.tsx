'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, TrendingDown, TrendingUp } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface KpiKachel {
  key: string;
  label: string;
  wert: string;
  ziel: string;
  ampel: 'grün' | 'gelb' | 'rot';
  trend: number;
}

interface StundenPunkt {
  h: string;
  bestellungen: number;
  umsatz: number;
}

interface ZoneRanking {
  zone: string;
  bestellungen: number;
  umsatz: number;
  lieferzeit_min: number;
}

interface ApiData {
  kpis: KpiKachel[];
  stunden: StundenPunkt[];
  zonen: ZoneRanking[];
  alerts: string[];
  last_updated: string;
}

const MOCK: ApiData = {
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', wert: '47', ziel: '60', ampel: 'gelb', trend: 12 },
    { key: 'umsatz', label: 'Umsatz', wert: '1.240€', ziel: '1.500€', ampel: 'gelb', trend: 8 },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: '28 Min', ziel: '≤30 Min', ampel: 'grün', trend: -2 },
    { key: 'on_time', label: 'Pünktlichkeit', wert: '84%', ziel: '≥90%', ampel: 'gelb', trend: 3 },
    { key: 'storno', label: 'Storno-Rate', wert: '3.2%', ziel: '≤5%', ampel: 'grün', trend: -1 },
    { key: 'bewertung', label: 'Ø Bewertung', wert: '4.3 ★', ziel: '≥4.5', ampel: 'gelb', trend: 1 },
    { key: 'fahrer', label: 'Aktive Fahrer', wert: '4', ziel: '6', ampel: 'rot', trend: 0 },
    { key: 'revenue_per_order', label: '€/Bestellung', wert: '26.38€', ziel: '≥25€', ampel: 'grün', trend: 5 },
  ],
  stunden: [
    { h: '11', bestellungen: 3, umsatz: 78 },
    { h: '12', bestellungen: 8, umsatz: 210 },
    { h: '13', bestellungen: 11, umsatz: 290 },
    { h: '14', bestellungen: 6, umsatz: 158 },
    { h: '15', bestellungen: 4, umsatz: 105 },
    { h: '16', bestellungen: 5, umsatz: 132 },
    { h: '17', bestellungen: 10, umsatz: 267 },
  ],
  zonen: [
    { zone: 'Mitte', bestellungen: 18, umsatz: 475, lieferzeit_min: 22 },
    { zone: 'Schwabing', bestellungen: 14, umsatz: 368, lieferzeit_min: 27 },
    { zone: 'Maxvorstadt', bestellungen: 9, umsatz: 237, lieferzeit_min: 31 },
    { zone: 'Bogenhausen', bestellungen: 6, umsatz: 160, lieferzeit_min: 35 },
  ],
  alerts: ['Fahrer-Kapazität kritisch: nur 4/6 aktiv', 'Pünktlichkeit unter Ziel: 84% (Ziel: 90%)'],
  last_updated: new Date().toISOString(),
};

const AMPEL_COLORS: Record<string, string> = {
  grün: 'bg-green-50 border-green-200 text-green-700',
  gelb: 'bg-amber-50 border-amber-200 text-amber-700',
  rot: 'bg-red-50 border-red-200 text-red-700',
};

const BAR_COLORS: Record<string, string> = {
  grün: '#22c55e', gelb: '#f59e0b', rot: '#ef4444',
};

export function LieferdienstPhase2595StatistikenLiveMasterCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const load = () => {
      if (!locationId) { setData(MOCK); return; }
      fetch(`/api/delivery/admin/statistics-live?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: ApiData | null) => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 3 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const hasAlerts = data.alerts.length > 0;

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlerts ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'}`}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-slate-600" />
          <span className="font-semibold text-xs text-gray-800">Statistiken Live Master</span>
          {hasAlerts && <AlertTriangle size={12} className="text-amber-500" />}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            {data.kpis.filter(k => k.ampel === 'grün').length}/{data.kpis.length} grün
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Alert-Strip */}
          {hasAlerts && (
            <div className="space-y-1">
              {data.alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-100 border border-amber-200 px-2.5 py-1.5">
                  <AlertTriangle size={11} className="text-amber-600 mt-0.5 shrink-0" />
                  <span className="text-[10px] font-medium text-amber-800">{a}</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {data.kpis.map(kpi => (
              <div key={kpi.key} className={`rounded-lg border p-2 ${AMPEL_COLORS[kpi.ampel]}`}>
                <div className="text-[9px] font-semibold uppercase tracking-wide opacity-70 mb-0.5">{kpi.label}</div>
                <div className="text-sm font-bold">{kpi.wert}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] opacity-60">Ziel {kpi.ziel}</span>
                  {kpi.trend !== 0 && (
                    <span className={`text-[9px] font-semibold flex items-center gap-0.5 ${kpi.trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {kpi.trend > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                      {Math.abs(kpi.trend)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Stundenverlauf-Chart */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold text-gray-600">Stundenverlauf</span>
              <div className="flex gap-1 ml-auto">
                {(['bestellungen', 'umsatz'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${chartMode === m ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz €'}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={data.stunden} barSize={16}>
                <XAxis dataKey="h" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 10, borderRadius: 6, padding: '4px 8px' }}
                  formatter={(v) => chartMode === 'umsatz' ? [`${v != null ? v : ''}€`, 'Umsatz'] : [v ?? '', 'Bestellungen']}
                />
                <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                  {data.stunden.map((_, i) => (
                    <Cell key={i} fill={i === data.stunden.length - 1 ? '#6366f1' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Zonen-Ranking */}
          <div>
            <div className="text-[10px] font-semibold text-gray-600 mb-1.5">Top-Zonen</div>
            <div className="space-y-1">
              {data.zonen.map((z, i) => {
                const maxBest = Math.max(...data.zonen.map(x => x.bestellungen));
                const pct = maxBest > 0 ? (z.bestellungen / maxBest) * 100 : 0;
                return (
                  <div key={z.zone} className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400 w-4 shrink-0">#{i + 1}</span>
                    <span className="text-[10px] font-semibold text-gray-700 w-24 shrink-0 truncate">{z.zone}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] text-gray-500 shrink-0">{z.bestellungen} | {z.lieferzeit_min} Min</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[9px] text-gray-300 text-right">Aktualisiert: {new Date(data.last_updated).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 3-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
