'use client';

import { useEffect, useState } from 'react';
import { Award, BarChart3, Clock, Euro, Loader2, Package, Target, TrendingUp, Truck, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1625 — Statistiken Final Cockpit (Lieferdienst)
 *
 * Vollständiges Statistiken-Dashboard für die Schicht:
 *   • Heute auf einen Blick: Umsatz, Bestellungen, Ø-Zeit, Pünktlichkeit, Fahrer
 *   • Live-Umsatz-Verlauf (Stunden-Sparkline)
 *   • Top-5-Fahrer-Rangliste nach Deliveries
 *   • Kennzahlen-Ampel (grün/amber/rot)
 *
 * API: GET /api/delivery/stats?location_id=... (30-Sek-Polling, Mock-Fallback)
 */

interface HourBucket {
  hour: string;
  orders: number;
  revenue: number;
}

interface DriverStat {
  name: string;
  deliveries: number;
  avgTimeMin: number;
  onTimePct: number;
}

interface StatsData {
  ordersToday: number;
  revenueToday: number;
  avgDeliveryMin: number;
  onTimePct: number;
  activeDrivers: number;
  hourlyBuckets: HourBucket[];
  topDrivers: DriverStat[];
  cancellationRate: number;
}

const MOCK: StatsData = {
  ordersToday: 42,
  revenueToday: 1287.50,
  avgDeliveryMin: 23,
  onTimePct: 84,
  activeDrivers: 3,
  cancellationRate: 4.2,
  hourlyBuckets: [
    { hour: '11', orders: 3,  revenue: 87 },
    { hour: '12', orders: 8,  revenue: 234 },
    { hour: '13', orders: 11, revenue: 321 },
    { hour: '14', orders: 7,  revenue: 198 },
    { hour: '15', orders: 5,  revenue: 143 },
    { hour: '16', orders: 8,  revenue: 304 },
  ],
  topDrivers: [
    { name: 'Ahmet K.',   deliveries: 12, avgTimeMin: 21, onTimePct: 91 },
    { name: 'Mert S.',    deliveries: 10, avgTimeMin: 25, onTimePct: 78 },
    { name: 'Lukas P.',   deliveries: 9,  avgTimeMin: 22, onTimePct: 88 },
    { name: 'David M.',   deliveries: 7,  avgTimeMin: 27, onTimePct: 72 },
    { name: 'Karim A.',   deliveries: 4,  avgTimeMin: 19, onTimePct: 100 },
  ],
};

function Sparkline({ buckets }: { buckets: HourBucket[] }) {
  if (buckets.length < 2) return null;
  const max = Math.max(...buckets.map(b => b.orders), 1);
  const w = 160;
  const h = 32;
  const pts = buckets.map((b, i) => {
    const x = (i / (buckets.length - 1)) * w;
    const y = h - (b.orders / max) * h;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const area = `0,${h} ${polyline} ${w},${h}`;

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polygon points={area} fill="url(#sparkGrad)" opacity="0.3" />
      <polyline points={polyline} fill="none" stroke="#5a7a4a" strokeWidth="2" strokeLinejoin="round" />
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a7a4a" />
          <stop offset="100%" stopColor="#5a7a4a" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, status,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  status?: 'ok' | 'warn' | 'bad';
}) {
  return (
    <div className={cn(
      'rounded-xl border px-3 py-2.5',
      status === 'ok'   ? 'bg-matcha-50 border-matcha-200' :
      status === 'warn' ? 'bg-amber-50 border-amber-200' :
      status === 'bad'  ? 'bg-red-50 border-red-200' :
      'bg-white border-stone-200',
    )}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn(
          'h-3 w-3 shrink-0',
          status === 'ok'   ? 'text-matcha-600' :
          status === 'warn' ? 'text-amber-600' :
          status === 'bad'  ? 'text-red-600' :
          'text-stone-500',
        )} />
        <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">{label}</span>
      </div>
      <div className={cn(
        'text-xl font-black tabular-nums',
        status === 'ok'   ? 'text-matcha-700' :
        status === 'warn' ? 'text-amber-700' :
        status === 'bad'  ? 'text-red-700' :
        'text-foreground',
      )}>
        {value}
      </div>
      {sub && <div className="text-[9px] text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase1625StatistikenFinalCockpit({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const qs = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/stats${qs}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('no stats');
        const json = await res.json();
        if (!cancelled) setData(json);
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-white text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Statistiken laden…
      </div>
    );
  }

  const d = data ?? MOCK;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-stone-50 border-b text-left"
      >
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider flex-1">
          Statistiken · Schicht-Cockpit
        </span>
        <span className="text-[10px] text-muted-foreground">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <KpiCard
              label="Bestellungen heute"
              value={String(d.ordersToday)}
              sub="abgeschlossen + aktiv"
              icon={Package}
              status="ok"
            />
            <KpiCard
              label="Umsatz heute"
              value={`${d.revenueToday.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`}
              sub="fertige Bestellungen"
              icon={Euro}
              status="ok"
            />
            <KpiCard
              label="Ø Lieferzeit"
              value={`${d.avgDeliveryMin} Min`}
              sub="Ziel: ≤ 30 Min"
              icon={Clock}
              status={d.avgDeliveryMin <= 25 ? 'ok' : d.avgDeliveryMin <= 30 ? 'warn' : 'bad'}
            />
            <KpiCard
              label="Pünktlichkeit"
              value={`${d.onTimePct}%`}
              sub="Ziel: ≥ 85 %"
              icon={Target}
              status={d.onTimePct >= 85 ? 'ok' : d.onTimePct >= 70 ? 'warn' : 'bad'}
            />
            <KpiCard
              label="Aktive Fahrer"
              value={String(d.activeDrivers)}
              sub="im Einsatz"
              icon={Users}
            />
            <KpiCard
              label="Stornoquote"
              value={`${d.cancellationRate.toFixed(1)}%`}
              sub="Ziel: ≤ 5 %"
              icon={Zap}
              status={d.cancellationRate <= 5 ? 'ok' : d.cancellationRate <= 10 ? 'warn' : 'bad'}
            />
          </div>

          {/* Hourly sparkline */}
          {d.hourlyBuckets.length >= 2 && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                  Bestellungen je Stunde
                </span>
                <div className="flex items-center gap-3">
                  {d.hourlyBuckets.map(b => (
                    <span key={b.hour} className="text-[9px] text-stone-400 tabular-nums">{b.hour}h</span>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Sparkline buckets={d.hourlyBuckets} />
                <div className="text-right">
                  <div className="text-xs font-black text-matcha-700 tabular-nums">
                    {d.hourlyBuckets[d.hourlyBuckets.length - 1]?.orders ?? 0}
                  </div>
                  <div className="text-[8px] text-stone-400">letzte Std.</div>
                </div>
              </div>
            </div>
          )}

          {/* Driver ranking */}
          {d.topDrivers.length > 0 && (
            <div className="rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-2 bg-stone-50 border-b flex items-center gap-2">
                <Award className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                  Fahrer-Rangliste · Heute
                </span>
              </div>
              <div className="divide-y">
                {d.topDrivers.map((dr, i) => (
                  <div key={dr.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{dr.name}</div>
                      <div className="text-[9px] text-muted-foreground">Ø {dr.avgTimeMin} Min</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black tabular-nums text-foreground">{dr.deliveries}</div>
                      <div className="text-[8px] text-muted-foreground">Lieferungen</div>
                    </div>
                    <div className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0',
                      dr.onTimePct >= 85 ? 'bg-matcha-100 text-matcha-700' :
                      dr.onTimePct >= 70 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700',
                    )}>
                      {dr.onTimePct}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-2 bg-stone-50 border-t text-[9px] text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="h-2.5 w-2.5" />
        Schicht-Statistiken · 30-Sek-Polling · Mock-Daten als Fallback
      </div>
    </div>
  );
}
