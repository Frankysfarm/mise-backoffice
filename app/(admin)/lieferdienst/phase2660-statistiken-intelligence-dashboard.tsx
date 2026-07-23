'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart2, ChevronDown, ChevronUp, Clock, Euro, Package, Star, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KpiKachel {
  key: string;
  label: string;
  wert: number | string;
  einheit: string;
  ziel: number | null;
  ziel_einheit: string;
  trend: 'up' | 'down' | 'flat';
  delta_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface StundenPunkt {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface Alert {
  typ: 'storno' | 'lieferzeit' | 'fahrer' | 'kapazitaet';
  text: string;
}

interface ApiData {
  kpis: KpiKachel[];
  stunden: StundenPunkt[];
  alerts: Alert[];
  schicht_start: string;
}

const STUNDEN_MOCK: StundenPunkt[] = [
  { stunde: '10', bestellungen: 8, umsatz: 142 },
  { stunde: '11', bestellungen: 12, umsatz: 218 },
  { stunde: '12', bestellungen: 31, umsatz: 557 },
  { stunde: '13', bestellungen: 28, umsatz: 504 },
  { stunde: '14', bestellungen: 18, umsatz: 324 },
  { stunde: '15', bestellungen: 11, umsatz: 198 },
  { stunde: '16', bestellungen: 9, umsatz: 162 },
  { stunde: '17', bestellungen: 22, umsatz: 396 },
  { stunde: '18', bestellungen: 41, umsatz: 738 },
  { stunde: '19', bestellungen: 47, umsatz: 846 },
  { stunde: '20', bestellungen: 39, umsatz: 702 },
];

const MOCK: ApiData = {
  schicht_start: '10:00',
  alerts: [
    { typ: 'storno', text: 'Storno-Quote 6.2% — über Ziel (5%)' },
    { typ: 'lieferzeit', text: 'Ø Lieferzeit 38min — kritisch' },
  ],
  kpis: [
    { key: 'umsatz', label: 'Umsatz Heute', wert: 3847, einheit: '€', ziel: 4000, ziel_einheit: '€', trend: 'up', delta_pct: +12, ampel: 'gelb' },
    { key: 'bestellungen', label: 'Bestellungen', wert: 265, einheit: '', ziel: 280, ziel_einheit: '', trend: 'up', delta_pct: +8, ampel: 'gelb' },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: 38, einheit: 'min', ziel: 35, ziel_einheit: 'min', trend: 'down', delta_pct: -4, ampel: 'rot' },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', wert: 82, einheit: '%', ziel: 90, ziel_einheit: '%', trend: 'up', delta_pct: +3, ampel: 'gelb' },
    { key: 'bewertung', label: 'Ø Bewertung', wert: '4.6', einheit: '★', ziel: 4.5, ziel_einheit: '★', trend: 'up', delta_pct: +2, ampel: 'gruen' },
    { key: 'fahrer', label: 'Aktive Fahrer', wert: 7, einheit: '', ziel: 8, ziel_einheit: '', trend: 'flat', delta_pct: 0, ampel: 'gelb' },
    { key: 'storno', label: 'Storno-Quote', wert: 6.2, einheit: '%', ziel: 5, ziel_einheit: '%', trend: 'down', delta_pct: +1.2, ampel: 'rot' },
    { key: 'umsatz_h', label: 'Umsatz/Stunde', wert: 192, einheit: '€', ziel: 200, ziel_einheit: '€', trend: 'up', delta_pct: +5, ampel: 'gelb' },
  ],
};

function ampelStyle(a: string): string {
  if (a === 'gruen') return 'border-green-500/60 bg-green-950/20 text-green-400';
  if (a === 'gelb') return 'border-amber-500/60 bg-amber-950/20 text-amber-400';
  return 'border-red-500/60 bg-red-950/20 text-red-400';
}

function alertIcon(typ: Alert['typ']) {
  switch (typ) {
    case 'storno': return <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />;
    case 'lieferzeit': return <Clock className="h-3 w-3 text-orange-400 shrink-0" />;
    case 'fahrer': return <Users className="h-3 w-3 text-amber-400 shrink-0" />;
    case 'kapazitaet': return <Zap className="h-3 w-3 text-yellow-400 shrink-0" />;
  }
}

export function LieferdienstPhase2660StatistikIntelligenceDashboard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/lieferdienst/statistik?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load(); else setData(MOCK);
    const poll = setInterval(load, 120_000);
    return () => clearInterval(poll);
  }, [locationId]);

  const d = data ?? MOCK;
  const currentHour = new Date().getHours().toString();

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <BarChart2 className="h-4 w-4 text-purple-400 shrink-0" />
          <span className="text-sm font-bold text-white">Statistiken Intelligence Dashboard</span>
          {d.alerts.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white">
              <AlertTriangle className="h-2.5 w-2.5" />{d.alerts.length} Alert{d.alerts.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-[10px] text-gray-500">ab {d.schicht_start}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-3">
          {/* Alerts */}
          {d.alerts.length > 0 && (
            <div className="space-y-1">
              {d.alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-red-950/20 border border-red-700/30 px-3 py-1.5">
                  {alertIcon(a.typ)}
                  <span className="text-[10px] text-red-300">{a.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {d.kpis.map(kpi => (
              <div key={kpi.key} className={`rounded-lg border ${ampelStyle(kpi.ampel)} p-2.5`}>
                <div className="text-[9px] text-gray-400 mb-0.5">{kpi.label}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black tabular-nums text-white">{kpi.wert}</span>
                  <span className="text-[9px] text-gray-400">{kpi.einheit}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  {kpi.ziel !== null && (
                    <span className="text-[9px] text-gray-500">Ziel {kpi.ziel}{kpi.ziel_einheit}</span>
                  )}
                  <div className={`flex items-center gap-0.5 text-[9px] ${kpi.delta_pct > 0 ? 'text-green-400' : kpi.delta_pct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {kpi.trend === 'up' ? <TrendingUp className="h-2.5 w-2.5" /> : kpi.trend === 'down' ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                    {kpi.delta_pct !== 0 && <span>{kpi.delta_pct > 0 ? '+' : ''}{kpi.delta_pct}%</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stundenverlauf Chart */}
          <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white">Stundenverlauf</span>
              <div className="flex rounded-lg overflow-hidden border border-gray-700">
                <button
                  onClick={() => setChartMode('bestellungen')}
                  className={`px-2 py-1 text-[10px] transition-colors ${chartMode === 'bestellungen' ? 'bg-blue-700 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                >
                  Bestellungen
                </button>
                <button
                  onClick={() => setChartMode('umsatz')}
                  className={`px-2 py-1 text-[10px] transition-colors ${chartMode === 'umsatz' ? 'bg-purple-700 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                >
                  Umsatz
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={d.stunden} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px', fontSize: '10px', color: '#fff' }}
                  formatter={(v: number) => [chartMode === 'umsatz' ? `${v}€` : v, chartMode === 'umsatz' ? 'Umsatz' : 'Bestellungen']}
                />
                <Bar dataKey={chartMode} radius={[2, 2, 0, 0]}>
                  {d.stunden.map((s, i) => (
                    <Cell key={i} fill={s.stunde === currentHour ? '#3b82f6' : chartMode === 'umsatz' ? '#7c3aed' : '#2563eb'} fillOpacity={s.stunde === currentHour ? 1 : 0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[9px] text-gray-600 px-1">
            <div className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /><span>2-Min-Polling</span></div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">●</span><span>OK</span>
              <span className="text-amber-500">●</span><span>Warnung</span>
              <span className="text-red-500">●</span><span>Kritisch</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
