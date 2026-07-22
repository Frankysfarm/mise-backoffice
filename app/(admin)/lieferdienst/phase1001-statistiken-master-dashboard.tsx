'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, ChevronDown, ChevronUp, Euro, TrendingUp, TrendingDown, Users, Package } from 'lucide-react';

interface StundeData {
  stunde: number;
  label: string;
  bestellungen: number;
  umsatz: number;
  avg_lieferzeit: number;
}

interface FahrerKpi {
  fahrer_id: string;
  name: string;
  touren: number;
  umsatz: number;
  puenktlichkeit_pct: number;
  score: number;
}

interface ApiData {
  heute_umsatz: number;
  heute_bestellungen: number;
  heute_avg_lieferzeit_min: number;
  heute_puenktlichkeit_pct: number;
  heute_storno_rate_pct: number;
  vorgestern_umsatz: number;
  delta_umsatz_pct: number;
  aktive_fahrer: number;
  stunden: StundeData[];
  top_fahrer: FahrerKpi[];
}

const MOCK: ApiData = {
  heute_umsatz: 2847.50,
  heute_bestellungen: 94,
  heute_avg_lieferzeit_min: 28,
  heute_puenktlichkeit_pct: 82,
  heute_storno_rate_pct: 4.2,
  vorgestern_umsatz: 2634.00,
  delta_umsatz_pct: 8.1,
  aktive_fahrer: 6,
  stunden: [
    { stunde: 11, label: '11:00', bestellungen: 8, umsatz: 224, avg_lieferzeit: 26 },
    { stunde: 12, label: '12:00', bestellungen: 18, umsatz: 520, avg_lieferzeit: 31 },
    { stunde: 13, label: '13:00', bestellungen: 14, umsatz: 402, avg_lieferzeit: 29 },
    { stunde: 14, label: '14:00', bestellungen: 7, umsatz: 190, avg_lieferzeit: 24 },
    { stunde: 15, label: '15:00', bestellungen: 5, umsatz: 140, avg_lieferzeit: 22 },
    { stunde: 16, label: '16:00', bestellungen: 6, umsatz: 168, avg_lieferzeit: 25 },
    { stunde: 17, label: '17:00', bestellungen: 11, umsatz: 312, avg_lieferzeit: 28 },
    { stunde: 18, label: '18:00', bestellungen: 25, umsatz: 891, avg_lieferzeit: 34 },
  ],
  top_fahrer: [
    { fahrer_id: 'f1', name: 'Max M.', touren: 8, umsatz: 1240, puenktlichkeit_pct: 95, score: 92 },
    { fahrer_id: 'f2', name: 'Sara K.', touren: 6, umsatz: 980, puenktlichkeit_pct: 86, score: 81 },
    { fahrer_id: 'f3', name: 'Tim B.', touren: 5, umsatz: 627, puenktlichkeit_pct: 72, score: 69 },
  ],
};

function fmt(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

export function LieferdienstPhase1001StatistikenMasterDashboard({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'umsatz' | 'bestellungen' | 'lieferzeit'>('umsatz');
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/analytics?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load();
    else setData(MOCK);
    const poll = setInterval(load, 60_000);
    return () => clearInterval(poll);
  }, [locationId]);

  const d = data ?? MOCK;
  const chartData = d.stunden.map(s => ({
    label: s.label,
    value: tab === 'umsatz' ? s.umsatz : tab === 'bestellungen' ? s.bestellungen : s.avg_lieferzeit,
  }));
  const maxVal = Math.max(...chartData.map(c => c.value), 1);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow bg-white dark:bg-gray-900 mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">Statistiken Master Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-green-600 dark:text-green-400">{fmt(d.heute_umsatz)}</span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          {/* KPI-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: Euro, label: 'Umsatz heute', val: fmt(d.heute_umsatz), delta: `${d.delta_umsatz_pct >= 0 ? '+' : ''}${d.delta_umsatz_pct.toFixed(1)}%`, up: d.delta_umsatz_pct >= 0 },
              { icon: Package, label: 'Bestellungen', val: `${d.heute_bestellungen}`, delta: null, up: true },
              { icon: Users, label: 'Aktive Fahrer', val: `${d.aktive_fahrer}`, delta: null, up: true },
              { icon: AlertTriangle, label: 'Storno', val: `${d.heute_storno_rate_pct}%`, delta: null, up: d.heute_storno_rate_pct < 5 },
            ].map(k => (
              <div key={k.label} className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <k.icon className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-[10px] text-gray-500">{k.label}</span>
                </div>
                <div className="text-base font-black text-gray-900 dark:text-white">{k.val}</div>
                {k.delta && (
                  <div className={`flex items-center gap-0.5 text-[10px] font-bold mt-0.5 ${k.up ? 'text-green-600' : 'text-red-500'}`}>
                    {k.up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    {k.delta} vs. gestern
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Stunden-Chart */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Stunden-Verlauf</span>
              <div className="flex gap-1 ml-auto">
                {(['umsatz', 'bestellungen', 'lieferzeit'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${tab === t ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                  >
                    {t === 'umsatz' ? 'Umsatz' : t === 'bestellungen' ? 'Bestellungen' : 'Ø Lieferzeit'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#f9fafb', fontWeight: 700 }}
                    itemStyle={{ color: '#60a5fa' }}
                    formatter={(v: number) => tab === 'umsatz' ? fmt(v) : tab === 'lieferzeit' ? `${v} Min` : `${v}`}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((c, i) => (
                      <Cell key={i} fill={c.value === maxVal ? '#3b82f6' : '#60a5fa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top-Fahrer */}
          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Top-Fahrer heute</div>
            <div className="space-y-1.5">
              {d.top_fahrer.map((f, i) => (
                <div key={f.fahrer_id} className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 px-3 py-2">
                  <span className={`text-xs font-black w-5 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-700'}`}>#{i + 1}</span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex-1">{f.name}</span>
                  <span className="text-[10px] text-gray-500">{f.touren} Touren</span>
                  <span className="text-[10px] font-bold text-green-600 dark:text-green-400">{fmt(f.umsatz)}</span>
                  <span className={`text-[10px] font-bold ${f.score >= 80 ? 'text-green-500' : f.score >= 65 ? 'text-amber-500' : 'text-red-500'}`}>{f.score} Pkt</span>
                </div>
              ))}
            </div>
          </div>

          {/* Zusammenfassung */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 px-3 py-2">
              <div className={`text-base font-black ${d.heute_puenktlichkeit_pct >= 85 ? 'text-green-500' : d.heute_puenktlichkeit_pct >= 70 ? 'text-amber-500' : 'text-red-500'}`}>{d.heute_puenktlichkeit_pct}%</div>
              <div className="text-[9px] text-gray-500">Pünktlichkeit</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 px-3 py-2">
              <div className={`text-base font-black ${d.heute_avg_lieferzeit_min <= 30 ? 'text-green-500' : d.heute_avg_lieferzeit_min <= 40 ? 'text-amber-500' : 'text-red-500'}`}>{d.heute_avg_lieferzeit_min} Min</div>
              <div className="text-[9px] text-gray-500">Ø Lieferzeit</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
