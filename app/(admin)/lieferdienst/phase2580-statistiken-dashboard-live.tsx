'use client';

/**
 * Phase 2580 — Statistiken Dashboard Live
 * 10 KPI-Kacheln Ampel-Farbkodierung + Trend-Pfeile;
 * Stundenverlauf-Chart Bestellungen/Umsatz (3-Modi);
 * Zonen-Ranking expandierbar; Fahrer-Top-5; Alert-Strip;
 * 3-Min-Polling
 */

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, Users, Package, Clock, Star, Euro, Zap, Target, MapPin, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HourlyBucket { hour: string; bestellungen: number; umsatz: number; }
interface ZoneEntry { zone: string; bestellungen: number; umsatz: number; pkt: number; }
interface DriverTop { name: string; touren: number; score: number; umsatz: number; }

interface DashboardData {
  kpis: {
    bestellungen_heute: number;
    bestellungen_vortag: number;
    umsatz_heute: number;
    umsatz_vortag: number;
    lieferzeit_avg: number;
    lieferzeit_ziel: number;
    storno_quote: number;
    storno_ziel: number;
    on_time_rate: number;
    on_time_ziel: number;
    bewertung_avg: number;
    bewertung_ziel: number;
    aktive_fahrer: number;
    touren_heute: number;
    touren_vortag: number;
    kundenzufriedenheit: number;
    umsatz_pro_stunde: number;
    bestellungen_pro_fahrer: number;
    pauesen_compliance: number;
    durchsatz: number;
  };
  stunden: HourlyBucket[];
  zonen: ZoneEntry[];
  top_fahrer: DriverTop[];
  alerts: string[];
}

const MOCK: DashboardData = {
  kpis: {
    bestellungen_heute: 87, bestellungen_vortag: 73,
    umsatz_heute: 4210, umsatz_vortag: 3640,
    lieferzeit_avg: 23, lieferzeit_ziel: 30,
    storno_quote: 3.2, storno_ziel: 5,
    on_time_rate: 88, on_time_ziel: 85,
    bewertung_avg: 4.6, bewertung_ziel: 4.2,
    aktive_fahrer: 6, touren_heute: 34, touren_vortag: 29,
    kundenzufriedenheit: 91, umsatz_pro_stunde: 320,
    bestellungen_pro_fahrer: 14.5, pauesen_compliance: 95, durchsatz: 2.8,
  },
  stunden: [
    { hour: '10', bestellungen: 4, umsatz: 190 },
    { hour: '11', bestellungen: 8, umsatz: 380 },
    { hour: '12', bestellungen: 18, umsatz: 870 },
    { hour: '13', bestellungen: 22, umsatz: 1050 },
    { hour: '14', bestellungen: 12, umsatz: 560 },
    { hour: '15', bestellungen: 7, umsatz: 330 },
    { hour: '16', bestellungen: 9, umsatz: 420 },
    { hour: '17', bestellungen: 7, umsatz: 410 },
  ],
  zonen: [
    { zone: 'Innenstadt', bestellungen: 32, umsatz: 1540, pkt: 94 },
    { zone: 'Westend',    bestellungen: 21, umsatz:  990, pkt: 82 },
    { zone: 'Nordpark',  bestellungen: 18, umsatz:  870, pkt: 78 },
    { zone: 'Südviertel',bestellungen: 11, umsatz:  530, pkt: 71 },
    { zone: 'Oststadt',  bestellungen:  5, umsatz:  280, pkt: 66 },
  ],
  top_fahrer: [
    { name: 'Max M.',   touren: 12, score: 91, umsatz: 890 },
    { name: 'Sara K.',  touren:  9, score: 84, umsatz: 720 },
    { name: 'Tim B.',   touren:  7, score: 77, umsatz: 560 },
    { name: 'Julia F.', touren:  4, score: 68, umsatz: 310 },
    { name: 'Leon S.',  touren:  2, score: 61, umsatz: 180 },
  ],
  alerts: [],
};

type ChartMode = 'bestellungen' | 'umsatz';

interface KpiTile {
  label: string;
  value: string;
  trend: number;
  trendLabel: string;
  ampel: 'gruen' | 'gelb' | 'rot';
  icon: React.ElementType;
  subtext?: string;
}

function fmtEur(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k €` : `${v} €`;
}

function pct(curr: number, prev: number) {
  if (prev === 0) return 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function TrendPill({ delta }: { delta: number }) {
  if (delta > 2) return (
    <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
      <TrendingUp className="h-2.5 w-2.5" />+{delta}%
    </span>
  );
  if (delta < -2) return (
    <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
      <TrendingDown className="h-2.5 w-2.5" />{delta}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold text-stone-500">
      <Minus className="h-2.5 w-2.5" />±0%
    </span>
  );
}

function KpiCard({ tile }: { tile: KpiTile }) {
  const Icon = tile.icon;
  const bg = tile.ampel === 'gruen' ? 'bg-green-50 border-green-200' : tile.ampel === 'gelb' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const valueColor = tile.ampel === 'gruen' ? 'text-green-700' : tile.ampel === 'gelb' ? 'text-amber-700' : 'text-red-700';
  const iconBg = tile.ampel === 'gruen' ? 'bg-green-100 text-green-600' : tile.ampel === 'gelb' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600';

  return (
    <div className={cn('rounded-xl border p-3', bg)}>
      <div className="flex items-start justify-between mb-1">
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg', iconBg)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <TrendPill delta={tile.trend} />
      </div>
      <div className={cn('text-xl font-black tabular-nums leading-none', valueColor)}>{tile.value}</div>
      <div className="text-[10px] font-medium text-stone-500 mt-0.5">{tile.label}</div>
      {tile.subtext && <div className="text-[9px] text-stone-400 mt-0.5">{tile.subtext}</div>}
    </div>
  );
}

export function LieferdienstPhase2580StatistikDashboardLive({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [mode, setMode] = useState<ChartMode>('bestellungen');
  const [zonenOpen, setZonenOpen] = useState(false);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/analytics?location_id=${locationId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setData(d); })
        .catch(() => {});
    load();
    const iv = setInterval(load, 3 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const k = data.kpis;

  const tiles: KpiTile[] = [
    {
      label: 'Bestellungen heute', value: String(k.bestellungen_heute),
      trend: pct(k.bestellungen_heute, k.bestellungen_vortag),
      trendLabel: 'vs. Vortag',
      ampel: k.bestellungen_heute >= k.bestellungen_vortag ? 'gruen' : 'gelb',
      icon: Package, subtext: `${k.bestellungen_vortag} gestern`,
    },
    {
      label: 'Umsatz heute', value: fmtEur(k.umsatz_heute),
      trend: pct(k.umsatz_heute, k.umsatz_vortag),
      trendLabel: 'vs. Vortag',
      ampel: k.umsatz_heute >= k.umsatz_vortag ? 'gruen' : 'gelb',
      icon: Euro, subtext: `${fmtEur(k.umsatz_pro_stunde)}/h`,
    },
    {
      label: 'Lieferzeit Ø', value: `${k.lieferzeit_avg} Min`,
      trend: pct(k.lieferzeit_ziel, k.lieferzeit_avg),
      trendLabel: `Ziel ≤${k.lieferzeit_ziel} Min`,
      ampel: k.lieferzeit_avg <= k.lieferzeit_ziel ? 'gruen' : k.lieferzeit_avg <= k.lieferzeit_ziel * 1.2 ? 'gelb' : 'rot',
      icon: Clock, subtext: `Ziel ≤${k.lieferzeit_ziel} Min`,
    },
    {
      label: 'On-Time-Rate', value: `${k.on_time_rate}%`,
      trend: k.on_time_rate - k.on_time_ziel,
      trendLabel: `Ziel ≥${k.on_time_ziel}%`,
      ampel: k.on_time_rate >= k.on_time_ziel ? 'gruen' : k.on_time_rate >= k.on_time_ziel - 10 ? 'gelb' : 'rot',
      icon: Target, subtext: `Ziel ≥${k.on_time_ziel}%`,
    },
    {
      label: 'Stornoquote', value: `${k.storno_quote}%`,
      trend: pct(k.storno_ziel, k.storno_quote) * -1,
      trendLabel: `Ziel <${k.storno_ziel}%`,
      ampel: k.storno_quote <= k.storno_ziel ? 'gruen' : k.storno_quote <= k.storno_ziel * 1.5 ? 'gelb' : 'rot',
      icon: AlertTriangle, subtext: `Ziel <${k.storno_ziel}%`,
    },
    {
      label: 'Bewertung Ø', value: `${k.bewertung_avg}★`,
      trend: Math.round((k.bewertung_avg - k.bewertung_ziel) * 100),
      trendLabel: `Ziel ≥${k.bewertung_ziel}★`,
      ampel: k.bewertung_avg >= k.bewertung_ziel ? 'gruen' : k.bewertung_avg >= k.bewertung_ziel - 0.3 ? 'gelb' : 'rot',
      icon: Star, subtext: `Ziel ≥${k.bewertung_ziel}★`,
    },
    {
      label: 'Aktive Fahrer', value: String(k.aktive_fahrer),
      trend: 0,
      trendLabel: '',
      ampel: k.aktive_fahrer >= 4 ? 'gruen' : k.aktive_fahrer >= 2 ? 'gelb' : 'rot',
      icon: Users, subtext: `${k.bestellungen_pro_fahrer} Best./Fahrer`,
    },
    {
      label: 'Touren heute', value: String(k.touren_heute),
      trend: pct(k.touren_heute, k.touren_vortag),
      trendLabel: 'vs. Vortag',
      ampel: k.touren_heute >= k.touren_vortag ? 'gruen' : 'gelb',
      icon: Zap, subtext: `${k.touren_vortag} gestern`,
    },
    {
      label: 'Kundenzufriedenheit', value: `${k.kundenzufriedenheit}%`,
      trend: k.kundenzufriedenheit - 85,
      trendLabel: 'Ziel ≥85%',
      ampel: k.kundenzufriedenheit >= 85 ? 'gruen' : k.kundenzufriedenheit >= 75 ? 'gelb' : 'rot',
      icon: Star, subtext: 'Ziel ≥85%',
    },
    {
      label: 'Durchsatz', value: `${k.durchsatz}/h`,
      trend: k.durchsatz >= 2.5 ? 10 : k.durchsatz >= 2 ? 0 : -10,
      trendLabel: 'Ziel ≥2.5/h',
      ampel: k.durchsatz >= 2.5 ? 'gruen' : k.durchsatz >= 2 ? 'gelb' : 'rot',
      icon: BarChart3, subtext: 'Ziel ≥2.5/h',
    },
  ];

  const chartData = data.stunden;
  const maxVal = Math.max(...chartData.map((h) => mode === 'bestellungen' ? h.bestellungen : h.umsatz), 1);

  return (
    <div className="space-y-4">
      {/* Alert Strip */}
      {data.alerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-bold text-red-700">Aktive Alerts</span>
          </div>
          {data.alerts.map((a, i) => (
            <p key={i} className="text-xs text-red-600">• {a}</p>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100">
            <BarChart3 className="h-4 w-4 text-matcha-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Statistiken Live-Dashboard</div>
            <div className="text-[11px] text-stone-400">10 KPIs · Trend vs. Vortag · Ampel-Farbkodierung</div>
          </div>
          <span className="ml-auto text-[9px] text-stone-400">↻ 3 Min</span>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => <KpiCard key={t.label} tile={t} />)}
        </div>
      </div>

      {/* Stundenverlauf Chart */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-matcha-600" />
            <span className="text-sm font-bold text-stone-800">Stundenverlauf</span>
          </div>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as ChartMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn('rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                  mode === m ? 'bg-matcha-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                )}
              >
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-4">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
              <Tooltip
                formatter={(v: number) => mode === 'umsatz' ? [`${v} €`, 'Umsatz'] : [v, 'Bestellungen']}
                labelFormatter={(h) => `${h}:00 Uhr`}
              />
              <Bar dataKey={mode} radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => {
                  const val = mode === 'bestellungen' ? entry.bestellungen : entry.umsatz;
                  const pctVal = maxVal > 0 ? val / maxVal : 0;
                  const color = pctVal > 0.7 ? '#22c55e' : pctVal > 0.4 ? '#f59e0b' : '#94a3b8';
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zonen Ranking */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setZonenOpen((p) => !p)}
          className="flex w-full items-center justify-between border-b border-stone-100 px-5 py-3 hover:bg-stone-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-bold text-stone-800">Zonen-Ranking</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-400">{data.zonen.length} Zonen</span>
            {zonenOpen ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
          </div>
        </button>
        {zonenOpen && (
          <div className="divide-y divide-stone-50">
            {data.zonen.map((z, i) => (
              <div key={z.zone} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-5 shrink-0 text-center text-[11px] font-bold text-stone-400">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-stone-700">{z.zone}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-stone-500 tabular-nums">{z.bestellungen} Best.</span>
                      <span className="text-[11px] font-bold text-matcha-600 tabular-nums">{fmtEur(z.umsatz)}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold',
                        z.pkt >= 85 ? 'bg-green-100 text-green-700' : z.pkt >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      )}>{z.pkt} Pkt</span>
                    </div>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', z.pkt >= 85 ? 'bg-green-500' : z.pkt >= 70 ? 'bg-amber-400' : 'bg-red-500')}
                      style={{ width: `${z.pkt}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Fahrer */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-3">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-bold text-stone-800">Top Fahrer</span>
          <span className="ml-auto text-[11px] text-stone-400">Heute</span>
        </div>
        <div className="divide-y divide-stone-50">
          {data.top_fahrer.map((f, i) => (
            <div key={f.name} className="flex items-center gap-3 px-5 py-2.5">
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
                i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-stone-300 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
              )}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-stone-700">{f.name}</span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-stone-500">{f.touren} Tour{f.touren !== 1 ? 'en' : ''}</span>
                <span className={cn('font-bold',
                  f.score >= 80 ? 'text-green-600' : f.score >= 60 ? 'text-amber-600' : 'text-red-600'
                )}>{f.score} Pkt</span>
                <span className="font-bold text-matcha-600 tabular-nums">{fmtEur(f.umsatz)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
