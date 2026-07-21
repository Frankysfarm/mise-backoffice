'use client';
import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react';

/**
 * Phase 2625 — Statistiken Echtzeit Executive
 *
 * 10 KPI-Kacheln mit Ampel-Farbkodierung + Trend.
 * Stundenverlauf-Chart (Bestellungen/Umsatz umschaltbar).
 * Zonen-Ranking Top-5. Fahrer-Top-3. Alert-Strip.
 * 3-Min-Polling.
 */

interface HourData { hour: string; orders: number; umsatz: number; }
interface ZoneRow  { name: string; orders: number; umsatz: number; }
interface DriverRow { name: string; touren: number; score: number; }

interface StatsData {
  bestellungen_heute: number;
  bestellungen_trend: number;
  umsatz_heute: number;
  umsatz_trend: number;
  avg_lieferzeit_min: number;
  avg_lieferzeit_trend: number;
  on_time_rate: number;
  on_time_trend: number;
  avg_bewertung: number;
  bewertung_trend: number;
  aktive_fahrer: number;
  fahrer_trend: number;
  storno_rate: number;
  storno_trend: number;
  sla_quote: number;
  sla_trend: number;
  umsatz_pro_fahrer: number;
  umsatz_fahrer_trend: number;
  touren_heute: number;
  touren_trend: number;
  stunden: HourData[];
  zonen: ZoneRow[];
  top_fahrer: DriverRow[];
}

const MOCK: StatsData = {
  bestellungen_heute: 143,  bestellungen_trend: 8,
  umsatz_heute: 2847,       umsatz_trend: 12,
  avg_lieferzeit_min: 27,   avg_lieferzeit_trend: -2,
  on_time_rate: 87,         on_time_trend: 3,
  avg_bewertung: 4.4,       bewertung_trend: 0.1,
  aktive_fahrer: 7,         fahrer_trend: 1,
  storno_rate: 4.2,         storno_trend: -0.8,
  sla_quote: 89,            sla_trend: 2,
  umsatz_pro_fahrer: 406,   umsatz_fahrer_trend: 15,
  touren_heute: 52,         touren_trend: 5,
  stunden: [
    { hour: '10', orders: 8,  umsatz: 160 },
    { hour: '11', orders: 14, umsatz: 280 },
    { hour: '12', orders: 22, umsatz: 440 },
    { hour: '13', orders: 25, umsatz: 500 },
    { hour: '14', orders: 18, umsatz: 360 },
    { hour: '15', orders: 12, umsatz: 240 },
    { hour: '16', orders: 16, umsatz: 320 },
    { hour: '17', orders: 28, umsatz: 560 },
  ],
  zonen: [
    { name: 'Mitte',       orders: 38, umsatz: 760 },
    { name: 'Charlottenburg', orders: 29, umsatz: 580 },
    { name: 'Prenzlberg',  orders: 24, umsatz: 480 },
    { name: 'Neukölln',   orders: 18, umsatz: 360 },
    { name: 'Kreuzberg',  orders: 16, umsatz: 320 },
  ],
  top_fahrer: [
    { name: 'Max K.',  touren: 14, score: 91 },
    { name: 'Jana W.', touren: 12, score: 84 },
    { name: 'Ali S.',  touren: 10, score: 78 },
  ],
};

function TrendIcon({ val, invert = false }: { val: number; invert?: boolean }) {
  const pos = invert ? val < 0 : val > 0;
  if (val === 0) return <Minus size={11} className="text-gray-400" />;
  if (pos) return <TrendingUp size={11} className="text-green-500" />;
  return <TrendingDown size={11} className="text-red-500" />;
}

function ampel(val: number, good: number, warn: number, invert = false): string {
  const ok   = invert ? val <= good : val >= good;
  const okWarn = invert ? val <= warn : val >= warn;
  if (ok)     return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20';
  if (okWarn) return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20';
  return             'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20';
}

const BAR_COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#ddd6fe', '#ede9fe', '#f5f3ff', '#faf5ff'];

const POLL = 3 * 60 * 1000;

interface Props { locationId?: string | null }

export function LieferdienstPhase2625StatistikEchtzeitExecutive({ locationId }: Props) {
  const [data, setData]   = useState<StatsData | null>(null);
  const [mode, setMode]   = useState<'orders' | 'umsatz'>('orders');
  const [loading, setLoad] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    if (!locationId) { setData(MOCK); return; }
    setLoad(true);
    fetch(`/api/delivery/stats?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: StatsData) => setData(d))
      .catch(() => setData(MOCK))
      .finally(() => setLoad(false));
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
      <RefreshCw size={16} className="animate-spin mx-auto mb-2" />Dashboard wird geladen…
    </div>
  );

  const kpis = [
    { label: 'Bestellungen',     val: `${data.bestellungen_heute}`,     trend: data.bestellungen_trend,   cls: ampel(data.bestellungen_heute, 100, 60) },
    { label: 'Umsatz',           val: `${(data.umsatz_heute / 100).toFixed(0)} €`,  trend: data.umsatz_trend,         cls: ampel(data.umsatz_heute, 2000, 1000) },
    { label: 'Ø Lieferzeit',     val: `${data.avg_lieferzeit_min} Min`, trend: data.avg_lieferzeit_trend, cls: ampel(data.avg_lieferzeit_min, 30, 40, true), invert: true },
    { label: 'On-Time-Rate',     val: `${data.on_time_rate}%`,          trend: data.on_time_trend,        cls: ampel(data.on_time_rate, 90, 75) },
    { label: 'Ø Bewertung',      val: `${data.avg_bewertung.toFixed(1)} ★`, trend: data.bewertung_trend,  cls: ampel(data.avg_bewertung, 4.3, 4.0) },
    { label: 'Aktive Fahrer',    val: `${data.aktive_fahrer}`,          trend: data.fahrer_trend,         cls: ampel(data.aktive_fahrer, 5, 3) },
    { label: 'Stornoquote',      val: `${data.storno_rate}%`,           trend: data.storno_trend,         cls: ampel(data.storno_rate, 5, 10, true), invert: true },
    { label: 'SLA-Quote',        val: `${data.sla_quote}%`,             trend: data.sla_trend,            cls: ampel(data.sla_quote, 90, 75) },
    { label: '€/Fahrer',         val: `${data.umsatz_pro_fahrer} €`,    trend: data.umsatz_fahrer_trend,  cls: ampel(data.umsatz_pro_fahrer, 300, 200) },
    { label: 'Touren heute',     val: `${data.touren_heute}`,           trend: data.touren_trend,         cls: ampel(data.touren_heute, 40, 20) },
  ];

  const alerts = [
    data.on_time_rate < 75    && `On-Time-Rate niedrig (${data.on_time_rate}%)`,
    data.storno_rate  > 8     && `Stornoquote erhöht (${data.storno_rate}%)`,
    data.avg_lieferzeit_min > 35 && `Lieferzeit zu hoch (${data.avg_lieferzeit_min} Min)`,
    data.avg_bewertung < 4.0  && `Bewertung niedrig (${data.avg_bewertung.toFixed(1)} ★)`,
  ].filter(Boolean) as string[];

  const chartData = data.stunden;
  const chartKey  = mode === 'orders' ? 'orders' : 'umsatz';
  const currentHour = new Date().getHours().toString();

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-700 text-white">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} />
          <span className="font-semibold text-sm">Statistiken Echtzeit Executive</span>
          {loading && <RefreshCw size={11} className="animate-spin opacity-60" />}
        </div>
        <span className="text-xs opacity-70">Heute • 3-Min-Update</span>
      </div>

      {alerts.length > 0 && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800">
          {alerts.map(a => (
            <div key={a} className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle size={11} />{a}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl p-3 ${k.cls}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-semibold opacity-70 uppercase tracking-wide">{k.label}</span>
              <TrendIcon val={k.trend} invert={k.invert} />
            </div>
            <div className="text-lg font-extrabold tabular-nums">{k.val}</div>
            <div className="text-[10px] opacity-60">
              {k.trend > 0 ? '+' : ''}{k.trend}{typeof k.trend === 'number' && k.label.includes('%') ? 'pp' : ''} vs. gestern
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Stundenverlauf</span>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 text-xs">
            {(['orders', 'umsatz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${mode === m ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}
              >
                {m === 'orders' ? 'Bestellungen' : 'Umsatz €'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} barSize={16}>
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => mode === 'umsatz' ? [`${Number(v)} €`, 'Umsatz'] : [Number(v), 'Bestellungen']}
            />
            <Bar dataKey={chartKey} radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.hour === currentHour ? '#6366f1' : BAR_COLORS[i] ?? '#c7d2fe'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4 px-4 pb-4">
        <div>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Top-5 Zonen</p>
          <div className="space-y-1.5">
            {data.zonen.slice(0, 5).map((z, i) => (
              <div key={z.name} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-3 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{z.name}</span>
                    <span className="text-xs text-gray-500">{z.orders}</span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${(z.orders / (data.zonen[0]?.orders ?? 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Top-3 Fahrer</p>
          <div className="space-y-2">
            {data.top_fahrer.map((f, i) => (
              <div key={f.name} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] font-bold text-indigo-500">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{f.name}</p>
                  <p className="text-[10px] text-gray-400">{f.touren} Touren</p>
                </div>
                <span className={`text-xs font-bold ${f.score >= 85 ? 'text-green-600' : f.score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                  {f.score} Pkt
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
