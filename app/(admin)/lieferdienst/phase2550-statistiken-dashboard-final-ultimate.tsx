'use client';

/**
 * Phase 2550 — Statistiken-Dashboard Final Ultimate (Lieferdienst)
 *
 * Vollständiges Statistiken-Cockpit:
 * – 12 KPI-Kacheln mit Ampel-Farbkodierung + Trend vs. Vortag
 * – Stunden-Verlaufs-Chart (Bestellungen/Umsatz umschaltbar)
 * – Zonen-Ranking expandierbar
 * – Fahrer Top-5 mit Score-Balken
 * – Alert-Strip: Storno/Lieferzeit/On-Time/Bewertung/Kapazität
 * – 2-Min-Polling
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, Tooltip, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Award, BarChart3, Bike, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Euro, MapPin, Package,
  RefreshCw, Star, TrendingDown, TrendingUp, Users, Zap,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────── */

interface StundenPunkt { stunde: string; bestellungen: number; umsatz: number }
interface ZoneKpi      { zone: string; bestellungen: number; umsatz: number; onTime: number; lieferzeit: number }
interface FahrerKpi    { name: string; touren: number; score: number; bewertung: number; trinkgeld: number }

interface StatsData {
  bestellungen: number;       bestellungen_gestern: number
  umsatz: number;             umsatz_gestern: number
  lieferzeit_avg: number;     lieferzeit_ziel: number
  on_time_rate: number;       on_time_gestern: number
  storno_rate: number;        storno_gestern: number
  bewertung_avg: number;      bewertung_gestern: number
  aktive_fahrer: number;      fahrer_gestern: number
  touren_heute: number;       touren_gestern: number
  trinkgeld_avg: number;      trinkgeld_gestern: number
  umsatz_pro_stunde: number;  umsatz_pro_stunde_gestern: number
  batch_rate: number;         durchsatz: number
  stunden: StundenPunkt[]
  zonen: ZoneKpi[]
  top_fahrer: FahrerKpi[]
}

/* ── Mock ───────────────────────────────────────────────────────── */

function buildMock(): StatsData {
  const stunden: StundenPunkt[] = Array.from({ length: 13 }, (_, i) => {
    const h = 10 + i;
    const base = h < 12 ? 5 : h < 14 ? 22 : h < 16 ? 13 : h < 19 ? 25 : 16;
    return { stunde: `${h}:00`, bestellungen: base + Math.floor(Math.random() * 5), umsatz: (base + Math.floor(Math.random() * 5)) * 14.5 };
  });
  return {
    bestellungen: 163, bestellungen_gestern: 147,
    umsatz: 2380, umsatz_gestern: 2180,
    lieferzeit_avg: 24, lieferzeit_ziel: 30,
    on_time_rate: 0.89, on_time_gestern: 0.83,
    storno_rate: 0.03, storno_gestern: 0.05,
    bewertung_avg: 4.5, bewertung_gestern: 4.3,
    aktive_fahrer: 9, fahrer_gestern: 8,
    touren_heute: 68, touren_gestern: 62,
    trinkgeld_avg: 1.4, trinkgeld_gestern: 1.1,
    umsatz_pro_stunde: 297, umsatz_pro_stunde_gestern: 272,
    batch_rate: 0.62, durchsatz: 2.8,
    stunden,
    zonen: [
      { zone: 'Mitte', bestellungen: 58, umsatz: 850, onTime: 0.93, lieferzeit: 21 },
      { zone: 'Nord',  bestellungen: 41, umsatz: 600, onTime: 0.87, lieferzeit: 25 },
      { zone: 'Süd',   bestellungen: 38, umsatz: 540, onTime: 0.84, lieferzeit: 27 },
      { zone: 'West',  bestellungen: 26, umsatz: 390, onTime: 0.91, lieferzeit: 22 },
    ],
    top_fahrer: [
      { name: 'Felix H.', touren: 13, score: 96, bewertung: 4.9, trinkgeld: 2.1 },
      { name: 'Sara M.',  touren: 11, score: 89, bewertung: 4.7, trinkgeld: 1.8 },
      { name: 'Jan K.',   touren: 10, score: 83, bewertung: 4.5, trinkgeld: 1.4 },
      { name: 'Ana P.',   touren: 9,  score: 78, bewertung: 4.3, trinkgeld: 1.2 },
      { name: 'Tom R.',   touren: 8,  score: 71, bewertung: 4.1, trinkgeld: 0.9 },
    ],
  };
}

/* ── KPI Tile ───────────────────────────────────────────────────── */

type TileColor = 'green' | 'yellow' | 'red' | 'neutral';

function kpiColor(val: number, good: number, warn: number, lowerIsBetter = false): TileColor {
  if (lowerIsBetter) {
    if (val <= good) return 'green';
    if (val <= warn) return 'yellow';
    return 'red';
  }
  if (val >= good) return 'green';
  if (val >= warn) return 'yellow';
  return 'red';
}

const TILE_STYLE: Record<TileColor, { card: string; value: string }> = {
  green:   { card: 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800', value: 'text-matcha-700 dark:text-matcha-300' },
  yellow:  { card: 'bg-amber-50  dark:bg-amber-950/30  border-amber-200  dark:border-amber-800',  value: 'text-amber-700  dark:text-amber-300'  },
  red:     { card: 'bg-red-50    dark:bg-red-950/30    border-red-200    dark:border-red-800',    value: 'text-red-700    dark:text-red-300'    },
  neutral: { card: 'bg-stone-50  dark:bg-stone-900/30  border-stone-200  dark:border-stone-700',  value: 'text-stone-700  dark:text-stone-300'  },
};

function KpiTile({
  label, value, unit, color, trend, trendLabel,
}: {
  label: string; value: string; unit?: string; color: TileColor;
  trend?: number; trendLabel?: string;
}) {
  const s = TILE_STYLE[color];
  const up = trend !== undefined && trend > 0;
  const down = trend !== undefined && trend < 0;

  return (
    <div className={cn('rounded-xl border p-3 flex flex-col gap-1', s.card)}>
      <div className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 leading-tight">{label}</div>
      <div className={cn('text-xl font-black tabular-nums', s.value)}>
        {value}<span className="text-xs font-semibold ml-0.5 opacity-70">{unit}</span>
      </div>
      {trend !== undefined && (
        <div className={cn(
          'flex items-center gap-0.5 text-[10px] font-semibold',
          up ? 'text-matcha-600 dark:text-matcha-400' : down ? 'text-red-500' : 'text-stone-400'
        )}>
          {up   ? <TrendingUp   className="w-3 h-3" /> : null}
          {down ? <TrendingDown className="w-3 h-3" /> : null}
          <span>{trendLabel ?? (up ? `+${Math.abs(trend).toFixed(1)}` : `-${Math.abs(trend).toFixed(1)}`)}</span>
        </div>
      )}
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────── */

export function LieferdienstPhase2550StatistikDashboardFinalUltimate() {
  const [data, setData]           = useState<StatsData>(buildMock());
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const [zonenExp, setZonenExp]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const pollRef                   = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_price, status, created_at, delivery_time_min, rating, zone')
        .gte('created_at', `${today}T00:00:00Z`);

      if (orders && orders.length > 0) {
        const bestellungen = orders.length;
        const umsatz = orders.reduce((s, o) => s + (o.total_price ?? 0), 0);
        const lieferzeit_avg = Math.round(
          orders.filter(o => o.delivery_time_min).reduce((s, o) => s + (o.delivery_time_min ?? 0), 0) /
          Math.max(1, orders.filter(o => o.delivery_time_min).length)
        );
        const storno_rate = orders.filter(o => o.status === 'storniert').length / Math.max(1, bestellungen);
        const bewertung_avg = orders.filter(o => o.rating).reduce((s, o) => s + (o.rating ?? 0), 0) /
          Math.max(1, orders.filter(o => o.rating).length);

        setData(d => ({
          ...d,
          bestellungen, umsatz, lieferzeit_avg,
          storno_rate: +storno_rate.toFixed(3),
          bewertung_avg: +bewertung_avg.toFixed(2),
        }));
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 120_000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  /* ── KPI tiles config ─────────────────────────────────────────── */
  const tiles = [
    { label: 'Bestellungen', value: String(data.bestellungen), unit: '', color: kpiColor(data.bestellungen, 150, 100), trend: data.bestellungen - data.bestellungen_gestern, trendLabel: `${data.bestellungen > data.bestellungen_gestern ? '+' : ''}${data.bestellungen - data.bestellungen_gestern} vs. gestern` },
    { label: 'Umsatz',       value: `${Math.round(data.umsatz / 100) * 100}`, unit: '€', color: kpiColor(data.umsatz, 2000, 1500), trend: data.umsatz - data.umsatz_gestern, trendLabel: `${data.umsatz > data.umsatz_gestern ? '+' : ''}${Math.round(data.umsatz - data.umsatz_gestern)}€` },
    { label: 'Lieferzeit Ø', value: String(data.lieferzeit_avg), unit: ' min', color: kpiColor(data.lieferzeit_avg, 25, 30, true), trend: 0, trendLabel: `${data.lieferzeit_avg < 30 ? '✓' : '!'} Ziel 30 min` },
    { label: 'On-Time',      value: `${Math.round(data.on_time_rate * 100)}`, unit: '%', color: kpiColor(data.on_time_rate, 0.9, 0.8), trend: data.on_time_rate - data.on_time_gestern, trendLabel: `${data.on_time_rate > data.on_time_gestern ? '+' : ''}${Math.round((data.on_time_rate - data.on_time_gestern) * 100)}%` },
    { label: 'Stornoquote',  value: `${Math.round(data.storno_rate * 100)}`, unit: '%', color: kpiColor(data.storno_rate, 0.03, 0.07, true), trend: data.storno_gestern - data.storno_rate, trendLabel: data.storno_rate < data.storno_gestern ? '↓ besser' : '↑ schlechter' },
    { label: 'Bewertung Ø', value: data.bewertung_avg.toFixed(1), unit: '★', color: kpiColor(data.bewertung_avg, 4.5, 4.0), trend: data.bewertung_avg - data.bewertung_gestern, trendLabel: `${data.bewertung_avg >= data.bewertung_gestern ? '+' : ''}${(data.bewertung_avg - data.bewertung_gestern).toFixed(2)}★` },
    { label: 'Aktive Fahrer', value: String(data.aktive_fahrer), unit: '', color: kpiColor(data.aktive_fahrer, 8, 5) as TileColor, trend: data.aktive_fahrer - data.fahrer_gestern, trendLabel: `${data.aktive_fahrer !== data.fahrer_gestern ? (data.aktive_fahrer > data.fahrer_gestern ? '+1' : '-1') : '= gestern'}` },
    { label: 'Touren',        value: String(data.touren_heute), unit: '', color: kpiColor(data.touren_heute, 60, 40) as TileColor, trend: data.touren_heute - data.touren_gestern, trendLabel: `${data.touren_heute > data.touren_gestern ? '+' : ''}${data.touren_heute - data.touren_gestern} vs. gestern` },
    { label: 'Trinkgeld Ø',   value: data.trinkgeld_avg.toFixed(2), unit: '€', color: kpiColor(data.trinkgeld_avg, 1.5, 1.0) as TileColor, trend: data.trinkgeld_avg - data.trinkgeld_gestern, trendLabel: `${data.trinkgeld_avg > data.trinkgeld_gestern ? '+' : ''}${(data.trinkgeld_avg - data.trinkgeld_gestern).toFixed(2)}€` },
    { label: '€/Stunde',      value: String(Math.round(data.umsatz_pro_stunde)), unit: '€', color: kpiColor(data.umsatz_pro_stunde, 280, 200) as TileColor, trend: data.umsatz_pro_stunde - data.umsatz_pro_stunde_gestern, trendLabel: `${data.umsatz_pro_stunde > data.umsatz_pro_stunde_gestern ? '+' : ''}${Math.round(data.umsatz_pro_stunde - data.umsatz_pro_stunde_gestern)}€` },
    { label: 'Batch-Rate',    value: `${Math.round(data.batch_rate * 100)}`, unit: '%', color: kpiColor(data.batch_rate, 0.6, 0.4) as TileColor, trend: undefined, trendLabel: undefined },
    { label: 'Durchsatz',     value: data.durchsatz.toFixed(1), unit: '/h', color: kpiColor(data.durchsatz, 2.5, 2.0) as TileColor, trend: undefined, trendLabel: undefined },
  ] as const;

  /* ── Alerts ─────────────────────────────────────────────────────── */
  const alerts: { msg: string; icon: React.ReactNode; color: string }[] = [];
  if (data.storno_rate > 0.07)       alerts.push({ msg: `Stornoquote ${Math.round(data.storno_rate * 100)}% — kritisch!`, icon: <AlertTriangle className="w-3 h-3" />, color: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' });
  if (data.lieferzeit_avg > 30)       alerts.push({ msg: `Lieferzeit ${data.lieferzeit_avg} min — Ziel 30 min überschritten`, icon: <Clock className="w-3 h-3" />, color: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300' });
  if (data.on_time_rate < 0.8)       alerts.push({ msg: `On-Time nur ${Math.round(data.on_time_rate * 100)}% — Maßnahmen erforderlich`, icon: <Zap className="w-3 h-3" />, color: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' });
  if (data.bewertung_avg < 4.0)      alerts.push({ msg: `Bewertung ${data.bewertung_avg.toFixed(1)}★ — unter Ziel 4,5★`, icon: <Star className="w-3 h-3" />, color: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300' });
  if (data.aktive_fahrer < 5)        alerts.push({ msg: `Nur ${data.aktive_fahrer} aktive Fahrer — Kapazitätsengpass`, icon: <Users className="w-3 h-3" />, color: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' });

  const chartData = data.stunden;
  const barColor = (val: number) => {
    const max = Math.max(...chartData.map(d => chartMode === 'bestellungen' ? d.bestellungen : d.umsatz));
    if (val >= max * 0.8) return '#4ade80';
    if (val >= max * 0.5) return '#f59e0b';
    return '#a8a29e';
  };

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 overflow-hidden shadow-sm space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-matcha-600 dark:text-matcha-400" />
          <span className="font-bold text-sm text-stone-900 dark:text-stone-100">Statistiken — Final Ultimate</span>
          {loading && <div className="w-1.5 h-1.5 rounded-full bg-matcha-400 animate-pulse" />}
        </div>
        <div className="text-[10px] text-stone-400 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          2-Min-Polling
        </div>
      </div>

      {/* Alert strip */}
      {alerts.length > 0 && (
        <div className="px-4 py-2 space-y-1.5 border-b border-stone-100 dark:border-stone-800">
          {alerts.map((a, i) => (
            <div key={i} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 border text-[11px] font-semibold', a.color)}>
              {a.icon}
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid 4×3 */}
      <div className="p-4 grid grid-cols-4 gap-2">
        {tiles.map(t => (
          <KpiTile key={t.label} label={t.label} value={t.value} unit={t.unit} color={t.color} trend={t.trend as number | undefined} trendLabel={t.trendLabel as string | undefined} />
        ))}
      </div>

      {/* Chart */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Stunden-Verlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all',
                  chartMode === m
                    ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300'
                    : 'text-stone-400 hover:text-stone-600'
                )}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData} barSize={14}>
            <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#a8a29e' }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v: number) => chartMode === 'umsatz' ? [`${Math.round(v)}€`, 'Umsatz'] : [v, 'Bestellungen']}
              contentStyle={{ fontSize: 11, background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8 }}
            />
            <Bar dataKey={chartMode} radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={barColor(chartMode === 'bestellungen' ? d.bestellungen : d.umsatz)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Zonen Ranking */}
      <div className="px-4 pb-4 border-t border-stone-100 dark:border-stone-800 pt-3">
        <button
          className="flex items-center justify-between w-full mb-2"
          onClick={() => setZonenExp(e => !e)}
        >
          <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-matcha-500" />
            Zonen-Ranking
          </span>
          {zonenExp ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </button>
        <div className="space-y-1.5">
          {data.zonen.slice(0, zonenExp ? undefined : 2).map((z, i) => (
            <div key={z.zone} className="flex items-center gap-2 text-[11px]">
              <span className="w-4 text-stone-400 font-bold text-center">{i + 1}</span>
              <span className="font-semibold text-stone-700 dark:text-stone-300 w-12">{z.zone}</span>
              <div className="flex-1 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-matcha-400"
                  style={{ width: `${Math.round((z.bestellungen / data.zonen[0].bestellungen) * 100)}%` }}
                />
              </div>
              <span className="text-stone-500 w-8 text-right">{z.bestellungen}</span>
              <span className={cn('w-10 text-right font-semibold', z.onTime >= 0.9 ? 'text-matcha-600 dark:text-matcha-400' : z.onTime >= 0.8 ? 'text-amber-600' : 'text-red-600')}>
                {Math.round(z.onTime * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Fahrer */}
      <div className="px-4 pb-4 border-t border-stone-100 dark:border-stone-800 pt-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Award className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Top Fahrer</span>
        </div>
        <div className="space-y-2">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2 text-[11px]">
              <span className={cn(
                'w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center shrink-0',
                i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' :
                i === 1 ? 'bg-stone-100 text-stone-600 dark:bg-stone-800' :
                          'bg-stone-50  text-stone-400 dark:bg-stone-900'
              )}>#{i + 1}</span>
              <span className="font-semibold text-stone-700 dark:text-stone-300 w-16 truncate">{f.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', f.score >= 85 ? 'bg-matcha-400' : f.score >= 70 ? 'bg-amber-400' : 'bg-red-400')}
                  style={{ width: `${f.score}%` }}
                />
              </div>
              <span className="text-stone-500 w-6 text-right font-bold">{f.score}</span>
              <span className="text-amber-500 w-8 text-right">{f.bewertung.toFixed(1)}★</span>
              <span className="text-stone-400 w-10 text-right">{f.touren}T</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
