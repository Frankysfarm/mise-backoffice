'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Euro, Clock, Star, AlertTriangle, Users, Package, XCircle, CheckCircle2 } from 'lucide-react';

interface StundeData {
  stunde: number;
  umsatz: number;
  bestellungen: number;
  on_time: number;
}

interface ZoneKpi {
  zone: string;
  bestellungen: number;
  avg_lieferzeit_min: number;
  umsatz: number;
}

interface DashboardData {
  bestellungen_heute: number;
  bestellungen_vw: number;
  umsatz_heute: number;
  umsatz_vw: number;
  avg_lieferzeit_min: number;
  avg_lieferzeit_vw: number;
  on_time_quote: number;
  on_time_vw: number;
  storno_quote: number;
  storno_vw: number;
  aktive_fahrer: number;
  avg_bewertung: number;
  trinkgeld_heute: number;
  stunden_verlauf: StundeData[];
  top_zonen: ZoneKpi[];
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function Trend({ now, prev, invert = false, suffix = '' }: { now: number; prev: number; invert?: boolean; suffix?: string }) {
  const diff = now - prev;
  const up = diff >= 0;
  const good = invert ? !up : up;
  if (Math.abs(diff) < 0.1) return <span className="text-xs text-stone-400">stabil</span>;
  return (
    <span className={`flex items-center gap-0.5 text-xs ${good ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(diff).toFixed(1)}{suffix}
    </span>
  );
}

const MOCK: DashboardData = {
  bestellungen_heute: 87, bestellungen_vw: 79,
  umsatz_heute: 2180.50, umsatz_vw: 1943.20,
  avg_lieferzeit_min: 31.4, avg_lieferzeit_vw: 34.1,
  on_time_quote: 84.1, on_time_vw: 80.5,
  storno_quote: 3.2, storno_vw: 4.8,
  aktive_fahrer: 6,
  avg_bewertung: 4.6,
  trinkgeld_heute: 145.80,
  stunden_verlauf: [
    { stunde: 11, umsatz: 120, bestellungen: 5, on_time: 90 },
    { stunde: 12, umsatz: 340, bestellungen: 14, on_time: 85 },
    { stunde: 13, umsatz: 290, bestellungen: 12, on_time: 82 },
    { stunde: 14, umsatz: 210, bestellungen: 9, on_time: 86 },
    { stunde: 15, umsatz: 180, bestellungen: 7, on_time: 88 },
    { stunde: 16, umsatz: 260, bestellungen: 11, on_time: 80 },
    { stunde: 17, umsatz: 410, bestellungen: 16, on_time: 78 },
    { stunde: 18, umsatz: 370, bestellungen: 13, on_time: 84 },
  ],
  top_zonen: [
    { zone: 'Mitte', bestellungen: 32, avg_lieferzeit_min: 28, umsatz: 820 },
    { zone: 'Prenzlberg', bestellungen: 24, avg_lieferzeit_min: 33, umsatz: 612 },
    { zone: 'Kreuzberg', bestellungen: 18, avg_lieferzeit_min: 36, umsatz: 471 },
  ],
};

type ChartMode = 'umsatz' | 'bestellungen' | 'on_time';

const BAR_COLORS: Record<ChartMode, string> = {
  umsatz: '#10b981',
  bestellungen: '#3b82f6',
  on_time: '#8b5cf6',
};

export function LieferdienstPhase2331StatistikDashboardLiveUltimate({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [chartMode, setChartMode] = useState<ChartMode>('umsatz');
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/overview?location_id=${locationId}`);
      if (r.ok) {
        const raw = await r.json();
        const o = raw.overview ?? raw;
        const stunden: StundeData[] = [];
        for (let h = 10; h <= 22; h++) {
          stunden.push({
            stunde: h,
            umsatz: o[`umsatz_${h}h`] ?? 0,
            bestellungen: o[`bestellungen_${h}h`] ?? 0,
            on_time: o[`on_time_${h}h`] ?? 0,
          });
        }
        setData({
          bestellungen_heute: o.bestellungen_heute ?? 0,
          bestellungen_vw: o.bestellungen_vw ?? 0,
          umsatz_heute: o.umsatz_heute ?? 0,
          umsatz_vw: o.umsatz_vw ?? 0,
          avg_lieferzeit_min: o.avg_lieferzeit_min ?? 0,
          avg_lieferzeit_vw: o.avg_lieferzeit_vw ?? 0,
          on_time_quote: o.on_time_quote ?? 0,
          on_time_vw: o.on_time_vw ?? 0,
          storno_quote: o.storno_quote ?? 0,
          storno_vw: o.storno_vw ?? 0,
          aktive_fahrer: o.aktive_fahrer ?? 0,
          avg_bewertung: o.avg_bewertung ?? 0,
          trinkgeld_heute: o.trinkgeld_heute ?? 0,
          stunden_verlauf: stunden,
          top_zonen: o.top_zonen ?? [],
        });
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const alerts: string[] = [];
  if (data.storno_quote > 10) alerts.push(`Storno-Quote ${data.storno_quote.toFixed(1)}% — kritisch!`);
  if (data.on_time_quote < 70) alerts.push(`Pünktlichkeit nur ${data.on_time_quote.toFixed(1)}%`);
  if (data.avg_lieferzeit_min > 45) alerts.push(`Ø Lieferzeit ${data.avg_lieferzeit_min.toFixed(0)} Min`);

  const kpis = [
    { label: 'Bestellungen', value: data.bestellungen_heute.toString(), prev: data.bestellungen_vw, now: data.bestellungen_heute, icon: <Package size={13} />, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100', suffix: '' },
    { label: 'Umsatz', value: fmtEur(data.umsatz_heute), prev: data.umsatz_vw, now: data.umsatz_heute, icon: <Euro size={13} />, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', suffix: ' €' },
    { label: 'Ø Lieferzeit', value: `${data.avg_lieferzeit_min.toFixed(0)} Min`, prev: data.avg_lieferzeit_vw, now: data.avg_lieferzeit_min, icon: <Clock size={13} />, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', suffix: ' Min', invert: true },
    { label: 'On-Time', value: `${data.on_time_quote.toFixed(1)}%`, prev: data.on_time_vw, now: data.on_time_quote, icon: <CheckCircle2 size={13} />, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-100', suffix: '%' },
    { label: 'Storno', value: `${data.storno_quote.toFixed(1)}%`, prev: data.storno_vw, now: data.storno_quote, icon: <XCircle size={13} />, color: 'text-red-700', bg: 'bg-red-50 border-red-100', suffix: '%', invert: true },
    { label: 'Fahrer aktiv', value: data.aktive_fahrer.toString(), prev: data.aktive_fahrer, now: data.aktive_fahrer, icon: <Users size={13} />, color: 'text-stone-700', bg: 'bg-stone-50 border-stone-100', suffix: '' },
    { label: 'Bewertung', value: `${data.avg_bewertung.toFixed(1)}★`, prev: 0, now: data.avg_bewertung, icon: <Star size={13} />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', suffix: '★' },
    { label: 'Trinkgeld', value: fmtEur(data.trinkgeld_heute), prev: 0, now: data.trinkgeld_heute, icon: <Euro size={13} />, color: 'text-teal-700', bg: 'bg-teal-50 border-teal-100', suffix: ' €' },
  ];

  const chartData = data.stunden_verlauf;
  const chartKey = chartMode;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden mb-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-100">
        <span className="font-semibold text-sm text-stone-800">Statistiken-Dashboard Live</span>
        <div className="flex items-center gap-2 text-xs">
          {loading && <span className="text-stone-400">Lade…</span>}
          <span className="text-stone-400">5-Min-Update</span>
        </div>
      </div>

      {/* Alert Strip */}
      {alerts.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-800">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{alerts.join(' · ')}</span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-px bg-stone-100">
        {kpis.map(k => (
          <div key={k.label} className={`bg-white p-2.5`}>
            <div className={`flex items-center gap-1 ${k.color} mb-1`}>
              {k.icon}
              <span className="text-[10px] text-stone-500">{k.label}</span>
            </div>
            <div className={`font-black text-sm tabular-nums ${k.color}`}>{k.value}</div>
            {k.prev > 0 && <Trend now={k.now} prev={k.prev} invert={k.invert} suffix={k.suffix} />}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-stone-600">Stundenverlauf heute</span>
          <div className="flex gap-1">
            {(['umsatz', 'bestellungen', 'on_time'] as ChartMode[]).map(m => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${chartMode === m ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'}`}
              >
                {m === 'umsatz' ? 'Umsatz' : m === 'bestellungen' ? 'Bestell.' : 'On-Time'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={chartData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
            <XAxis dataKey="stunde" tickFormatter={h => `${h}h`} tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={((v: number) => [
                chartMode === 'umsatz' ? fmtEur(v) : chartMode === 'on_time' ? `${v.toFixed(1)}%` : v,
                chartMode === 'umsatz' ? 'Umsatz' : chartMode === 'bestellungen' ? 'Bestellungen' : 'On-Time',
              ]) as any}
              labelFormatter={h => `${h}:00 Uhr`}
            />
            <Bar dataKey={chartKey} radius={[3, 3, 0, 0]}>
              {chartData.map((_d, i) => (
                <Cell key={i} fill={BAR_COLORS[chartMode]} fillOpacity={0.75 + i * 0.02} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Zones */}
      {data.top_zonen.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs font-semibold text-stone-600 mb-2">Top-Zonen</div>
          <div className="space-y-1.5">
            {data.top_zonen.map(z => (
              <div key={z.zone} className="flex items-center gap-2 text-xs">
                <span className="text-stone-600 w-20 truncate font-medium">{z.zone}</span>
                <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, (z.bestellungen / (data.bestellungen_heute || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-stone-500 w-14 text-right">{z.bestellungen} Bestell.</span>
                <span className="text-stone-400 w-14 text-right">{z.avg_lieferzeit_min.toFixed(0)} Min</span>
                <span className="text-emerald-700 w-16 text-right">{fmtEur(z.umsatz)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
