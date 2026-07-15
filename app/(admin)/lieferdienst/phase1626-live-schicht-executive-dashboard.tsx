'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Bike, Package, Clock, Star, Euro, AlertCircle } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Props = { locationId: string | null };

type KPI = {
  bestellungen: number;
  umsatz: number;
  avgLieferzeit: number;
  puenktlichkeitPct: number;
  aktiveFahrer: number;
  stornoPct: number;
  avgBewertung: number | null;
  bestellungenVortag: number | null;
  umsatzVortag: number | null;
  stundenverlauf: { hour: number; count: number }[];
};

const MOCK: KPI = {
  bestellungen: 34,
  umsatz: 1248.5,
  avgLieferzeit: 27,
  puenktlichkeitPct: 81,
  aktiveFahrer: 4,
  stornoPct: 3.2,
  avgBewertung: 4.6,
  bestellungenVortag: 29,
  umsatzVortag: 1040,
  stundenverlauf: [
    { hour: 11, count: 2 }, { hour: 12, count: 7 }, { hour: 13, count: 9 },
    { hour: 14, count: 5 }, { hour: 15, count: 4 }, { hour: 16, count: 3 },
    { hour: 17, count: 4 },
  ],
};

function Trend({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev === null) return null;
  const delta = cur - prev;
  const pct = prev > 0 ? Math.abs(delta / prev) * 100 : 0;
  if (Math.abs(delta) < 0.5) return <Minus className="h-3 w-3 text-muted-foreground" />;
  return delta > 0
    ? <span className="flex items-center gap-0.5 text-matcha-600 text-[10px] font-bold"><TrendingUp className="h-3 w-3" />+{Math.round(pct)}%</span>
    : <span className="flex items-center gap-0.5 text-red-600 text-[10px] font-bold"><TrendingDown className="h-3 w-3" />-{Math.round(pct)}%</span>;
}

export function LieferdienstPhase1626LiveSchichtExecutiveDashboard({ locationId }: Props) {
  const [data, setData] = useState<KPI | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/delivery/stats/shift-live?location_id=${encodeURIComponent(locationId)}`);
        if (!r.ok) throw new Error('fetch failed');
        const d = await r.json();
        if (!cancelled) {
          setData({
            bestellungen: d.bestellungen ?? d.total_orders ?? MOCK.bestellungen,
            umsatz: d.umsatz ?? d.revenue ?? MOCK.umsatz,
            avgLieferzeit: d.avg_lieferzeit ?? d.avgDeliveryMin ?? MOCK.avgLieferzeit,
            puenktlichkeitPct: d.puenktlichkeit ?? d.onTimePct ?? MOCK.puenktlichkeitPct,
            aktiveFahrer: d.aktive_fahrer ?? d.activeDrivers ?? MOCK.aktiveFahrer,
            stornoPct: d.storno_pct ?? d.cancellationRate ?? MOCK.stornoPct,
            avgBewertung: d.avg_bewertung ?? d.avgRating ?? MOCK.avgBewertung,
            bestellungenVortag: d.bestellungen_vortag ?? null,
            umsatzVortag: d.umsatz_vortag ?? null,
            stundenverlauf: d.stundenverlauf ?? MOCK.stundenverlauf,
          });
        }
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!data) return null;

  const kpis = [
    {
      icon: Package, label: 'Bestellungen', value: String(data.bestellungen),
      trend: <Trend cur={data.bestellungen} prev={data.bestellungenVortag} />,
      color: 'text-blue-600', bg: 'bg-blue-50',
    },
    {
      icon: Euro, label: 'Umsatz', value: euro(data.umsatz),
      trend: <Trend cur={data.umsatz} prev={data.umsatzVortag} />,
      color: 'text-matcha-600', bg: 'bg-matcha-50',
    },
    {
      icon: Clock, label: 'Ø Lieferzeit', value: `${data.avgLieferzeit} Min`,
      trend: null,
      color: data.avgLieferzeit <= 30 ? 'text-matcha-600' : data.avgLieferzeit <= 40 ? 'text-amber-600' : 'text-red-600',
      bg: 'bg-muted/50',
    },
    {
      icon: Bike, label: 'Pünktlich', value: `${data.puenktlichkeitPct}%`,
      trend: null,
      color: data.puenktlichkeitPct >= 80 ? 'text-matcha-600' : data.puenktlichkeitPct >= 65 ? 'text-amber-600' : 'text-red-600',
      bg: 'bg-muted/50',
    },
    {
      icon: Bike, label: 'Fahrer aktiv', value: String(data.aktiveFahrer),
      trend: null, color: 'text-purple-600', bg: 'bg-purple-50',
    },
    {
      icon: AlertCircle, label: 'Storno', value: `${data.stornoPct.toFixed(1)}%`,
      trend: null,
      color: data.stornoPct < 5 ? 'text-matcha-600' : data.stornoPct < 10 ? 'text-amber-600' : 'text-red-600',
      bg: 'bg-muted/50',
    },
  ];

  if (data.avgBewertung !== null) {
    kpis.push({
      icon: Star, label: 'Ø Bewertung', value: data.avgBewertung.toFixed(1),
      trend: null, color: 'text-amber-500', bg: 'bg-amber-50',
    });
  }

  const maxCount = Math.max(...data.stundenverlauf.map((h) => h.count), 1);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Live-Schicht-Executive-Dashboard
          </span>
        </div>
        {loading && <span className="text-[10px] text-muted-foreground animate-pulse">Aktualisiert…</span>}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
        {kpis.map(({ icon: Icon, label, value, trend, color, bg }) => (
          <div key={label} className={cn('flex items-center gap-3 p-3', bg)}>
            <Icon className={cn('h-5 w-5 shrink-0', color)} />
            <div className="min-w-0">
              <div className={cn('text-lg font-black tabular-nums leading-none', color)}>{value}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-muted-foreground">{label}</span>
                {trend}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hourly chart */}
      {data.stundenverlauf.length > 0 && (
        <div className="px-4 py-3 border-t">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Bestellungen je Stunde
          </div>
          <ResponsiveContainer width="100%" height={60}>
            <BarChart data={data.stundenverlauf} barSize={12}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickFormatter={(h) => `${h}h`}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                formatter={(v: number) => [`${v} Best.`, 'Bestellungen']}
                contentStyle={{ fontSize: 11, padding: '4px 8px' }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {data.stundenverlauf.map((h) => (
                  <Cell
                    key={h.hour}
                    fill={h.count === maxCount ? '#4a7c59' : '#86efac'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
