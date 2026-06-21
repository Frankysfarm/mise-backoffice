'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Euro, Target, Minus } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface Stats {
  umsatz: number;
  lieferungen: number;
  onlineDrivers: number;
  avgDeliveryMin: number | null;
  slaOnTimePct: number | null;
  umsatzProLieferung: number;
  umsatzProFahrerStunde: number | null;
  prevUmsatz: number | null;
  prevLieferungen: number | null;
}

function TrendIcon({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev == null) return <Minus className="h-3 w-3 text-stone-400" />;
  if (cur > prev * 1.02) return <TrendingUp className="h-3 w-3 text-matcha-600" />;
  if (cur < prev * 0.98) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-stone-400" />;
}

export function SchichtRenditeCockpit({ locationId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [today, yesterday] = await Promise.all([
          fetch(`/api/delivery/admin/stats?period=today&location_id=${locationId}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/delivery/admin/stats?period=yesterday&location_id=${locationId}`).then(r => r.ok ? r.json() : null),
        ]);
        if (cancelled) return;

        const ts = today?.today_stats ?? today ?? {};
        const ys = yesterday?.today_stats ?? yesterday ?? {};

        const umsatz: number = ts.revenue ?? ts.total_revenue ?? ts.umsatz ?? 0;
        const lieferungen: number = ts.total_deliveries ?? ts.deliveries ?? ts.completed_orders ?? 0;
        const onlineDrivers: number = ts.active_drivers ?? ts.online_drivers ?? 0;
        const avgDeliveryMin: number | null = ts.avg_delivery_min ?? null;
        const slaOnTimePct: number | null = ts.sla_on_time_pct ?? ts.on_time_pct ?? null;

        const shiftHours = 8;
        const umsatzProLieferung = lieferungen > 0 ? umsatz / lieferungen : 0;
        const umsatzProFahrerStunde = onlineDrivers > 0 ? umsatz / (onlineDrivers * shiftHours) : null;

        const prevUmsatz: number | null = ys.revenue ?? ys.total_revenue ?? ys.umsatz ?? null;
        const prevLieferungen: number | null = ys.total_deliveries ?? ys.deliveries ?? ys.completed_orders ?? null;

        setStats({ umsatz, lieferungen, onlineDrivers, avgDeliveryMin, slaOnTimePct, umsatzProLieferung, umsatzProFahrerStunde, prevUmsatz, prevLieferungen });
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;
  if (loading && !stats) return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2 animate-pulse">
      {[1, 2, 3].map(i => <div key={i} className="h-10 bg-stone-100 rounded-xl" />)}
    </div>
  );
  if (!stats) return null;

  const kpis = [
    {
      label: 'Schicht-Umsatz',
      value: euro(stats.umsatz),
      sub: stats.prevUmsatz != null ? `Gestern: ${euro(stats.prevUmsatz)}` : null,
      trend: <TrendIcon cur={stats.umsatz} prev={stats.prevUmsatz} />,
      color: 'bg-matcha-50 text-matcha-700',
    },
    {
      label: 'Lieferungen',
      value: stats.lieferungen.toString(),
      sub: stats.prevLieferungen != null ? `Gestern: ${stats.prevLieferungen}` : null,
      trend: <TrendIcon cur={stats.lieferungen} prev={stats.prevLieferungen} />,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: '∅ / Lieferung',
      value: stats.umsatzProLieferung > 0 ? euro(stats.umsatzProLieferung) : '–',
      sub: stats.avgDeliveryMin != null ? `∅ ${stats.avgDeliveryMin.toFixed(0)} Min Lieferzeit` : null,
      trend: null,
      color: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Umsatz / Fahrer-h',
      value: stats.umsatzProFahrerStunde != null ? euro(stats.umsatzProFahrerStunde) : '–',
      sub: `${stats.onlineDrivers} Fahrer aktiv`,
      trend: null,
      color: 'bg-purple-50 text-purple-700',
    },
  ];

  const slaColor =
    stats.slaOnTimePct == null ? 'text-stone-400' :
    stats.slaOnTimePct >= 85 ? 'text-matcha-600' :
    stats.slaOnTimePct >= 70 ? 'text-amber-600' :
    'text-red-600';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <Euro className="h-4 w-4 text-matcha-600 shrink-0" />
        <div>
          <div className="text-sm font-black text-stone-800">Schicht-Rendite-Cockpit</div>
          <div className="text-[10px] text-stone-400 font-medium">Echtzeit-KPIs · alle 2 Min aktualisiert</div>
        </div>
        {stats.slaOnTimePct != null && (
          <div className="ml-auto flex items-center gap-1.5">
            <Target className={cn('h-3.5 w-3.5', slaColor)} />
            <span className={cn('text-sm font-black tabular-nums', slaColor)}>
              {Math.round(stats.slaOnTimePct)}%
            </span>
            <span className="text-[10px] text-stone-400">SLA</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={cn('rounded-xl p-3', kpi.color)}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{kpi.label}</span>
              {kpi.trend}
            </div>
            <div className="text-lg font-black tabular-nums leading-tight">{kpi.value}</div>
            {kpi.sub && <div className="text-[9px] opacity-60 mt-0.5">{kpi.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
