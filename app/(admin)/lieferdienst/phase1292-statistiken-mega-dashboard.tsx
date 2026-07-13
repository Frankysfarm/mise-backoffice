'use client';

// Phase 1292 (Lieferdienst) — Statistiken-Mega-Dashboard
// 6 KPI-Kacheln + Stunden-Balken-Chart + Zonen-Tabelle + Trend-Indikatoren.
// 5-Min-Polling · API /api/delivery/admin/statistiken?action=heute · Mock-Fallback

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Users, Clock, Euro, Star,
  Package, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatistikenHeute {
  umsatz_heute: number;
  umsatz_gestern: number;
  lieferungen_heute: number;
  lieferungen_gestern: number;
  avg_lieferzeit_min: number;
  avg_lieferzeit_gestern_min: number;
  storno_quote: number;
  storno_quote_gestern: number;
  aktive_fahrer: number;
  aktive_fahrer_gestern: number;
  kundenzufriedenheit: number;
  kundenzufriedenheit_gestern: number;
  bestellungen_nach_stunde: { stunde: number; bestellungen: number }[];
  zonen: { zone: string; bestellungen: number; avg_eta_min: number; score: number }[];
}

interface Props {
  locationId: string | null;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK: StatistikenHeute = {
  umsatz_heute: 1847,
  umsatz_gestern: 1623,
  lieferungen_heute: 43,
  lieferungen_gestern: 38,
  avg_lieferzeit_min: 28,
  avg_lieferzeit_gestern_min: 31,
  storno_quote: 3.2,
  storno_quote_gestern: 4.1,
  aktive_fahrer: 5,
  aktive_fahrer_gestern: 4,
  kundenzufriedenheit: 4.7,
  kundenzufriedenheit_gestern: 4.5,
  bestellungen_nach_stunde: [
    { stunde: 10, bestellungen: 2 },
    { stunde: 11, bestellungen: 4 },
    { stunde: 12, bestellungen: 9 },
    { stunde: 13, bestellungen: 7 },
    { stunde: 14, bestellungen: 5 },
    { stunde: 15, bestellungen: 3 },
    { stunde: 16, bestellungen: 2 },
    { stunde: 17, bestellungen: 4 },
    { stunde: 18, bestellungen: 8 },
    { stunde: 19, bestellungen: 6 },
    { stunde: 20, bestellungen: 5 },
    { stunde: 21, bestellungen: 3 },
  ],
  zonen: [
    { zone: 'Mitte', bestellungen: 14, avg_eta_min: 24, score: 92 },
    { zone: 'Nord', bestellungen: 10, avg_eta_min: 31, score: 78 },
    { zone: 'Süd', bestellungen: 9, avg_eta_min: 27, score: 85 },
    { zone: 'West', bestellungen: 6, avg_eta_min: 35, score: 71 },
    { zone: 'Ost', bestellungen: 4, avg_eta_min: 29, score: 80 },
  ],
};

const POLL_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Trend = 'up' | 'down';

function calcTrend(current: number, prev: number): Trend {
  return current >= prev ? 'up' : 'down';
}

function pctDiff(current: number, prev: number): string {
  if (prev === 0) return '—';
  const diff = ((current - prev) / prev) * 100;
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
}

type HighlightLevel = 'good' | 'warn' | 'bad' | 'neutral';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TrendBadge({ trend, pct }: { trend: Trend; pct: string }) {
  const isUp = trend === 'up';
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded-full',
      isUp
        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
        : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
    )}>
      {isUp
        ? <TrendingUp className="h-2.5 w-2.5" />
        : <TrendingDown className="h-2.5 w-2.5" />}
      {pct}
    </span>
  );
}

function KpiTile({
  icon, label, value, trend, pct, highlight, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: Trend;
  pct: string;
  highlight: HighlightLevel;
  sub?: string;
}) {
  const borderBg: Record<HighlightLevel, string> = {
    good: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20',
    warn: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
    bad: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',
    neutral: 'border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50',
  };
  return (
    <div className={cn('rounded-xl border p-3 flex flex-col gap-1.5', borderBg[highlight])}>
      <div className="flex items-center gap-1.5">
        <span className="text-stone-500 dark:text-stone-400">{icon}</span>
        <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 leading-tight">{label}</span>
      </div>
      <p className="text-lg font-black text-stone-800 dark:text-stone-100 leading-none">{value}</p>
      <div className="flex items-center gap-1.5">
        <TrendBadge trend={trend} pct={pct} />
        {sub && <span className="text-[9px] text-stone-400 dark:text-stone-500">{sub}</span>}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden mb-4 animate-pulse">
      <div className="h-11 bg-stone-200 dark:bg-stone-700" />
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-stone-100 dark:bg-stone-800 h-20" />
          ))}
        </div>
        <div className="rounded-xl bg-stone-100 dark:bg-stone-800 h-32" />
        <div className="rounded-xl bg-stone-100 dark:bg-stone-800 h-36" />
      </div>
    </div>
  );
}

// Bar chart bar colour based on value relative to max
function barColor(value: number, max: number): string {
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.8) return '#4ade80'; // green
  if (ratio >= 0.5) return '#fbbf24'; // amber
  return '#86efac';                   // light green (matcha)
}

// Zone score colour
function scoreHighlight(score: number): string {
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400 font-bold';
  if (score >= 70) return 'text-amber-600 dark:text-amber-400 font-bold';
  return 'text-red-600 dark:text-red-400 font-bold';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LieferdienstPhase1292StatistikenMegaDashboard({ locationId }: Props) {
  const [data, setData] = useState<StatistikenHeute | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const url = `/api/delivery/admin/statistiken?action=heute&location_id=${encodeURIComponent(locationId)}`;
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return <LoadingSkeleton />;

  // KPI derivations
  const umsatzTrend = calcTrend(data.umsatz_heute, data.umsatz_gestern);
  const lieferTrend = calcTrend(data.lieferungen_heute, data.lieferungen_gestern);
  // For delivery time: lower is better → invert trend display
  const etaRaw = calcTrend(data.avg_lieferzeit_gestern_min, data.avg_lieferzeit_min);
  const etaTrend = etaRaw; // 'up' means improved (faster)
  const stornoRaw = calcTrend(data.storno_quote_gestern, data.storno_quote); // 'up' means rate went down (good)
  const stornoTrend = stornoRaw;
  const fahrerTrend = calcTrend(data.aktive_fahrer, data.aktive_fahrer_gestern);
  const sterneTrend = calcTrend(data.kundenzufriedenheit, data.kundenzufriedenheit_gestern);

  // ETA: good if < 30min, warn if < 40, bad otherwise
  const etaHighlight: HighlightLevel =
    data.avg_lieferzeit_min < 30 ? 'good' : data.avg_lieferzeit_min < 40 ? 'warn' : 'bad';

  // Storno: good if < 4%, warn < 8%, else bad
  const stornoHighlight: HighlightLevel =
    data.storno_quote < 4 ? 'good' : data.storno_quote < 8 ? 'warn' : 'bad';

  // Chart max
  const chartMax = Math.max(...data.bestellungen_nach_stunde.map(d => d.bestellungen), 1);

  const updateStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden mb-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#3d5a3e] to-[#4a7a4b] text-white">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-300" />
          <span className="text-sm font-bold">Statistiken Mega-Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/70">Stand {updateStr} · 5-Min</span>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            title="Jetzt aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">

        {/* ── 6 KPI Tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* 1 — Umsatz */}
          <KpiTile
            icon={<Euro className="h-4 w-4" />}
            label="Heutiger Umsatz"
            value={`${data.umsatz_heute.toFixed(0)} €`}
            trend={umsatzTrend}
            pct={pctDiff(data.umsatz_heute, data.umsatz_gestern)}
            highlight={umsatzTrend === 'up' ? 'good' : 'warn'}
            sub={`Gestern: ${data.umsatz_gestern.toFixed(0)} €`}
          />
          {/* 2 — Lieferungen */}
          <KpiTile
            icon={<Package className="h-4 w-4" />}
            label="Lieferungen"
            value={String(data.lieferungen_heute)}
            trend={lieferTrend}
            pct={pctDiff(data.lieferungen_heute, data.lieferungen_gestern)}
            highlight={lieferTrend === 'up' ? 'good' : 'neutral'}
            sub={`Gestern: ${data.lieferungen_gestern}`}
          />
          {/* 3 — Ø Lieferzeit */}
          <KpiTile
            icon={<Clock className="h-4 w-4" />}
            label="Ø Lieferzeit (min)"
            value={`${data.avg_lieferzeit_min} min`}
            trend={etaTrend}
            pct={pctDiff(data.avg_lieferzeit_gestern_min, data.avg_lieferzeit_min)}
            highlight={etaHighlight}
            sub={`Gestern: ${data.avg_lieferzeit_gestern_min} min`}
          />
          {/* 4 — Storno-Quote */}
          <KpiTile
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Storno-Quote (%)"
            value={`${data.storno_quote.toFixed(1)} %`}
            trend={stornoTrend}
            pct={pctDiff(data.storno_quote_gestern, data.storno_quote)}
            highlight={stornoHighlight}
            sub={`Gestern: ${data.storno_quote_gestern.toFixed(1)} %`}
          />
          {/* 5 — Aktive Fahrer */}
          <KpiTile
            icon={<Users className="h-4 w-4" />}
            label="Aktive Fahrer"
            value={String(data.aktive_fahrer)}
            trend={fahrerTrend}
            pct={pctDiff(data.aktive_fahrer, data.aktive_fahrer_gestern)}
            highlight={data.aktive_fahrer >= 4 ? 'good' : data.aktive_fahrer >= 2 ? 'warn' : 'bad'}
            sub={`Gestern: ${data.aktive_fahrer_gestern}`}
          />
          {/* 6 — Kundenzufriedenheit */}
          <KpiTile
            icon={<Star className="h-4 w-4" />}
            label="Kundenzufriedenheit"
            value={`${data.kundenzufriedenheit.toFixed(1)} ★`}
            trend={sterneTrend}
            pct={pctDiff(data.kundenzufriedenheit, data.kundenzufriedenheit_gestern)}
            highlight={data.kundenzufriedenheit >= 4.5 ? 'good' : data.kundenzufriedenheit >= 4.0 ? 'warn' : 'bad'}
            sub={`Gestern: ${data.kundenzufriedenheit_gestern.toFixed(1)} ★`}
          />
        </div>

        {/* ── Stunden-Bar-Chart ── */}
        <div className="rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 p-3">
          <p className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-2">
            Bestellungen nach Stunde (heute)
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={data.bestellungen_nach_stunde} barCategoryGap="20%">
              <XAxis
                dataKey="stunde"
                tickFormatter={h => `${h}h`}
                tick={{ fontSize: 9, fill: '#a8a29e' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: '1px solid #e7e5e4',
                  background: '#fafaf9',
                }}
                formatter={(v: number) => [`${v} Bestellungen`, '']}
                labelFormatter={(l: number) => `${l}:00 Uhr`}
              />
              <Bar dataKey="bestellungen" radius={[4, 4, 0, 0]}>
                {data.bestellungen_nach_stunde.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.bestellungen, chartMax)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Zonen-Tabelle ── */}
        <div className="rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-stone-100 dark:border-stone-800">
            <p className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Zonen-Performance</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-800">
                  <th className="text-left px-3 py-1.5 font-medium">Zone</th>
                  <th className="text-right px-3 py-1.5 font-medium">Bestellungen</th>
                  <th className="text-right px-3 py-1.5 font-medium">Ø ETA</th>
                  <th className="text-right px-3 py-1.5 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.zonen.map((z, i) => (
                  <tr
                    key={z.zone}
                    className={cn(
                      'border-b border-stone-100 dark:border-stone-800 last:border-b-0',
                      i % 2 === 0
                        ? 'bg-white dark:bg-stone-900'
                        : 'bg-stone-50 dark:bg-stone-800/50',
                    )}
                  >
                    <td className="px-3 py-1.5 font-medium text-stone-700 dark:text-stone-300">{z.zone}</td>
                    <td className="px-3 py-1.5 text-right text-stone-600 dark:text-stone-400">{z.bestellungen}</td>
                    <td className="px-3 py-1.5 text-right text-stone-600 dark:text-stone-400">{z.avg_eta_min} min</td>
                    <td className={cn('px-3 py-1.5 text-right', scoreHighlight(z.score))}>{z.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
