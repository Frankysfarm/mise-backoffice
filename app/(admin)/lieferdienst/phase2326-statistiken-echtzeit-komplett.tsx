'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Euro, Clock, Star, AlertTriangle, Users } from 'lucide-react';

interface StundeData {
  stunde: number;
  umsatz: number;
  bestellungen: number;
}

interface KpiData {
  bestellungen_heute: number;
  umsatz_heute: number;
  avg_lieferzeit_min: number;
  on_time_quote: number;
  storno_quote: number;
  aktive_fahrer: number;
  avg_bewertung: number;
  trinkgeld_heute: number;
  stunden_verlauf: StundeData[];
}

function ampelColor(val: number, good: number, bad: number, invert = false) {
  const ok = invert ? val <= good : val >= good;
  const warn = invert ? val <= bad : val >= bad;
  if (ok) return 'text-green-700';
  if (warn) return 'text-amber-700';
  return 'text-red-700';
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

const HOUR_COLORS = ['#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#022c22'];

export function LieferdienstPhase2326StatistikEchtzeitKomplett({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'umsatz' | 'bestellungen'>('umsatz');

  async function load() {
    if (!locationId) { setLoading(false); return; }
    try {
      const r = await fetch(`/api/delivery/admin/overview?location_id=${locationId}`);
      if (!r.ok) return;
      const raw = await r.json();
      const o = raw.overview ?? raw;
      const stunden: StundeData[] = [];
      for (let h = 10; h <= 22; h++) {
        stunden.push({
          stunde: h,
          umsatz: o[`umsatz_${h}h`] ?? 0,
          bestellungen: o[`bestellungen_${h}h`] ?? 0,
        });
      }
      setData({
        bestellungen_heute: o.bestellungen_heute ?? o.orders_today ?? 0,
        umsatz_heute: o.umsatz_heute ?? o.revenue_today ?? 0,
        avg_lieferzeit_min: o.avg_lieferzeit_min ?? o.avg_delivery_time ?? 0,
        on_time_quote: o.on_time_quote ?? o.punctuality_rate ?? 0,
        storno_quote: o.storno_quote ?? o.cancel_rate ?? 0,
        aktive_fahrer: o.aktive_fahrer ?? o.active_drivers ?? 0,
        avg_bewertung: o.avg_bewertung ?? o.avg_rating ?? 0,
        trinkgeld_heute: o.trinkgeld_heute ?? o.tips_today ?? 0,
        stunden_verlauf: stunden,
      });
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const hasAlert = data
    ? data.storno_quote > 15 || data.on_time_quote < 60 || data.avg_lieferzeit_min > 50
    : false;

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-48 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    {
      label: 'Bestellungen', value: data.bestellungen_heute.toString(),
      color: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200', icon: null,
    },
    {
      label: 'Umsatz', value: fmtEur(data.umsatz_heute),
      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: null,
    },
    {
      label: 'Ø Lieferzeit', value: `${data.avg_lieferzeit_min} Min`,
      color: ampelColor(data.avg_lieferzeit_min, 35, 45, true),
      bg: data.avg_lieferzeit_min > 50 ? 'bg-red-50 border-red-200' : data.avg_lieferzeit_min > 40 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200',
      icon: null,
    },
    {
      label: 'Pünktlichkeit', value: `${data.on_time_quote}%`,
      color: ampelColor(data.on_time_quote, 80, 60),
      bg: data.on_time_quote >= 80 ? 'bg-green-50 border-green-200' : data.on_time_quote >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
      icon: null,
    },
    {
      label: 'Stornoquote', value: `${data.storno_quote}%`,
      color: ampelColor(data.storno_quote, 5, 15, true),
      bg: data.storno_quote <= 5 ? 'bg-green-50 border-green-200' : data.storno_quote <= 15 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
      icon: null,
    },
    {
      label: 'Aktive Fahrer', value: data.aktive_fahrer.toString(),
      color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: null,
    },
    {
      label: 'Ø Bewertung', value: `${data.avg_bewertung.toFixed(1)} ★`,
      color: ampelColor(data.avg_bewertung, 4.5, 3.5),
      bg: data.avg_bewertung >= 4.5 ? 'bg-green-50 border-green-200' : data.avg_bewertung >= 3.5 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
      icon: null,
    },
    {
      label: 'Trinkgelder', value: fmtEur(data.trinkgeld_heute),
      color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', icon: null,
    },
  ];

  const chartData = data.stunden_verlauf;
  const maxVal = Math.max(...chartData.map(d => chartMode === 'umsatz' ? d.umsatz : d.bestellungen), 1);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">Statistiken — Echtzeit</div>
            <div className="text-xs text-gray-400">Heute · Live-Daten · 1-Min-Update</div>
          </div>
        </div>
        {hasAlert && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle size={14} />
            <span className="text-xs font-semibold">Alert</span>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {kpis.map(k => (
            <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
              <div className={`text-lg font-black tabular-nums leading-tight ${k.color}`}>{k.value}</div>
              <div className="text-[10px] font-semibold text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Alert Row */}
        {hasAlert && (
          <div className="flex flex-col gap-1">
            {data.storno_quote > 15 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle size={13} className="text-red-600 shrink-0" />
                <p className="text-xs text-red-800 font-semibold">Stornoquote {data.storno_quote}% — über 15% Schwelle!</p>
              </div>
            )}
            {data.on_time_quote < 60 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle size={13} className="text-red-600 shrink-0" />
                <p className="text-xs text-red-800 font-semibold">Pünktlichkeit nur {data.on_time_quote}% — Fahrer priorisieren!</p>
              </div>
            )}
            {data.avg_lieferzeit_min > 50 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Clock size={13} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 font-semibold">Lieferzeit {data.avg_lieferzeit_min} Min — über 50 Min Schwelle!</p>
              </div>
            )}
          </div>
        )}

        {/* Stundenverlauf */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">Stundenverlauf</p>
            <div className="flex gap-1">
              {(['umsatz', 'bestellungen'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                    chartMode === m
                      ? 'bg-matcha-600 text-white border-matcha-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {m === 'umsatz' ? 'Umsatz' : 'Bestellungen'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} barSize={10} margin={{ top: 0, right: 0, left: -32, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9 }} tickFormatter={h => `${h}h`} />
              <Tooltip
                formatter={(v: number) => chartMode === 'umsatz' ? fmtEur(v) : `${v} Bestellungen`}
                labelFormatter={h => `${h}:00 Uhr`}
              />
              <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={
                      (chartMode === 'umsatz' ? chartData[i].umsatz : chartData[i].bestellungen) === maxVal
                        ? '#059669'
                        : '#6ee7b7'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
