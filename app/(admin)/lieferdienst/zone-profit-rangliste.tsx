'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, TrendingUp, TrendingDown, Minus, Euro, Package } from 'lucide-react';

interface Props {
  locationId: string;
}

type ZoneRow = {
  zone: string;
  deliveries: number;
  revenue: number;
  avgDeliveryMin: number;
  slaRate: number;
  profitScore: number;
  trend: 'up' | 'down' | 'flat';
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

// Mock-Daten als Fallback wenn API fehlt
function getMockZones(locationId: string): ZoneRow[] {
  const seed = locationId.charCodeAt(0) ?? 65;
  const zones = ['Nord', 'Süd', 'Ost', 'West', 'Mitte', 'Altstadt'];
  return zones.slice(0, 4).map((zone, i) => {
    const base = ((seed + i * 17) % 40) + 10;
    const revenue = base * 12 + i * 30;
    const deliveries = Math.floor(base / 3) + i * 2 + 3;
    const slaRate = Math.max(55, 95 - i * 8 - (seed % 10));
    const avgMin = 25 + i * 4 + (seed % 8);
    const profitScore = Math.round((slaRate * 0.4) + (Math.min(100, (revenue / 400) * 100) * 0.4) + ((deliveries / 20) * 100 * 0.2));
    return {
      zone,
      deliveries,
      revenue,
      avgDeliveryMin: avgMin,
      slaRate: Math.min(100, slaRate),
      profitScore: Math.min(100, profitScore),
      trend: i === 0 ? 'up' : i === 2 ? 'down' : 'flat',
    };
  }).sort((a, b) => b.profitScore - a.profitScore);
}

export function ZoneProfitRangliste({ locationId }: Props) {
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);

    fetch(`/api/delivery/zones?action=stats&location_id=${encodeURIComponent(locationId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.zones && Array.isArray(data.zones) && data.zones.length > 0) {
          const rows: ZoneRow[] = data.zones.map((z: Record<string, unknown>) => ({
            zone: String(z.zone ?? z.name ?? '?'),
            deliveries: Number(z.deliveries ?? z.count ?? 0),
            revenue: Number(z.revenue ?? z.umsatz ?? 0),
            avgDeliveryMin: Number(z.avg_delivery_min ?? z.avg_min ?? 30),
            slaRate: Number(z.sla_rate ?? z.pct_on_time ?? 70),
            profitScore: Number(z.profit_score ?? z.score ?? 50),
            trend: (z.trend === 'up' || z.trend === 'down' ? z.trend : 'flat') as ZoneRow['trend'],
          })).sort((a: ZoneRow, b: ZoneRow) => b.profitScore - a.profitScore);
          setZones(rows);
          setUsingMock(false);
        } else {
          setZones(getMockZones(locationId));
          setUsingMock(true);
        }
      })
      .catch(() => {
        setZones(getMockZones(locationId));
        setUsingMock(true);
      })
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="h-3 w-36 bg-muted rounded animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (zones.length === 0) return null;

  const maxRevenue = Math.max(...zones.map(z => z.revenue), 1);

  const TrendIcon = ({ trend }: { trend: ZoneRow['trend'] }) => {
    if (trend === 'up')   return <TrendingUp size={11} className="text-matcha-500" />;
    if (trend === 'down') return <TrendingDown size={11} className="text-red-500" />;
    return <Minus size={11} className="text-muted-foreground" />;
  };

  const rankBadge = (i: number) => {
    if (i === 0) return <span className="text-amber-500 font-black text-xs">①</span>;
    if (i === 1) return <span className="text-zinc-400 font-black text-xs">②</span>;
    if (i === 2) return <span className="text-orange-400 font-black text-xs">③</span>;
    return <span className="text-muted-foreground font-bold text-xs">{i + 1}</span>;
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Zonen-Profit-Rangliste
        </span>
        {usingMock && (
          <span className="ml-auto text-[9px] rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-bold">
            Demo
          </span>
        )}
        {!usingMock && (
          <span className="ml-auto text-[9px] text-muted-foreground">Live</span>
        )}
      </div>

      {/* Zone rows */}
      <div className="space-y-2">
        {zones.map((z, i) => {
          const scoreColor =
            z.profitScore >= 75 ? 'text-matcha-700' :
            z.profitScore >= 50 ? 'text-amber-700' :
                                   'text-red-600';
          const barColor =
            z.profitScore >= 75 ? 'bg-matcha-400' :
            z.profitScore >= 50 ? 'bg-amber-400' :
                                   'bg-red-400';

          return (
            <div key={z.zone} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 space-y-1.5">
              {/* Top row */}
              <div className="flex items-center gap-2">
                {rankBadge(i)}
                <span className="text-xs font-bold">{z.zone}</span>
                <TrendIcon trend={z.trend} />
                <div className="ml-auto flex items-center gap-3">
                  <div className="text-right">
                    <div className={cn('text-xs font-black tabular-nums', scoreColor)}>
                      {z.profitScore}
                    </div>
                    <div className="text-[8px] text-muted-foreground">Score</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold tabular-nums text-foreground">
                      {fmtEur(z.revenue)}
                    </div>
                    <div className="text-[8px] text-muted-foreground">Umsatz</div>
                  </div>
                </div>
              </div>

              {/* Revenue bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', barColor)}
                    style={{ width: `${Math.round((z.revenue / maxRevenue) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Bottom KPIs */}
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                <div className="flex items-center gap-0.5">
                  <Package size={9} />
                  <span>{z.deliveries} Lieferungen</span>
                </div>
                <div>Ø {z.avgDeliveryMin} Min</div>
                <div className={cn('font-bold', z.slaRate >= 80 ? 'text-matcha-600' : z.slaRate >= 60 ? 'text-amber-600' : 'text-red-600')}>
                  SLA {z.slaRate.toFixed(0)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-muted-foreground">
        Score = Umsatz (40%) + SLA (40%) + Volumen (20%)
      </div>
    </div>
  );
}
