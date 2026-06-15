'use client';

/**
 * LieferZonenHeatmap — Phase 201
 * Zone-für-Zone Leistungsraster: Bestellungen, Ø Wartezeit, On-Time-Rate, Score.
 * Farbkodiert nach Dringlichkeit: rot = Problem, gelb = Achtung, grün = OK.
 * Nutzt die vom parent übergebenen Bestellungen und Batches.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Target, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Order {
  id: string;
  delivery_zone: string | null;
  fertig_am: string | null;
  gesamtbetrag: number;
  dispatch_score: number | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  status: string;
}

interface Props {
  orders: Order[];
}

interface ZoneStat {
  zone: string;
  orderCount: number;
  pendingCount: number;
  totalRevenue: number;
  avgWaitMin: number | null;
  avgScore: number | null;
  onTimePct: number | null;
  urgency: 'ok' | 'warn' | 'critical';
}

function computeZoneStats(orders: Order[]): ZoneStat[] {
  const now = Date.now();
  const zones = new Map<string, Order[]>();

  for (const o of orders) {
    const z = o.delivery_zone ?? 'Unbekannt';
    const list = zones.get(z) ?? [];
    list.push(o);
    zones.set(z, list);
  }

  return Array.from(zones.entries())
    .map(([zone, zOrders]): ZoneStat => {
      const pending = zOrders.filter(o => !['geliefert', 'abgeholt', 'storniert'].includes(o.status));
      const withFertig = zOrders.filter(o => o.fertig_am);
      const waitMins = withFertig.map(o => (now - new Date(o.fertig_am!).getTime()) / 60_000);
      const avgWaitMin = waitMins.length ? waitMins.reduce((a, b) => a + b, 0) / waitMins.length : null;

      const withEta = zOrders.filter(o => o.eta_latest);
      const onTime = withEta.filter(o => {
        if (!o.eta_latest || o.status !== 'geliefert') return false;
        return new Date(o.eta_latest).getTime() >= now;
      });
      const onTimePct = withEta.length > 0 ? (onTime.length / withEta.length) * 100 : null;

      const withScore = zOrders.filter(o => o.dispatch_score !== null);
      const avgScore = withScore.length > 0
        ? withScore.reduce((s, o) => s + (o.dispatch_score ?? 0), 0) / withScore.length
        : null;

      const totalRevenue = zOrders.reduce((s, o) => s + o.gesamtbetrag, 0);

      let urgency: ZoneStat['urgency'] = 'ok';
      if ((avgWaitMin !== null && avgWaitMin > 20) || (onTimePct !== null && onTimePct < 70)) {
        urgency = 'critical';
      } else if ((avgWaitMin !== null && avgWaitMin > 12) || (onTimePct !== null && onTimePct < 85)) {
        urgency = 'warn';
      }

      return { zone, orderCount: zOrders.length, pendingCount: pending.length, totalRevenue, avgWaitMin, avgScore, onTimePct, urgency };
    })
    .sort((a, b) => {
      const urgencyOrder = { critical: 0, warn: 1, ok: 2 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      return b.orderCount - a.orderCount;
    });
}

function UrgencyBadge({ urgency }: { urgency: ZoneStat['urgency'] }) {
  if (urgency === 'critical') return (
    <span className="flex items-center gap-0.5 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[9px] font-black">
      <AlertTriangle className="h-2.5 w-2.5" />KRITISCH
    </span>
  );
  if (urgency === 'warn') return (
    <span className="flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[9px] font-black">
      ACHTUNG
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 rounded-full bg-matcha-100 text-matcha-700 px-1.5 py-0.5 text-[9px] font-black">
      <CheckCircle2 className="h-2.5 w-2.5" />OK
    </span>
  );
}

export function LieferZonenHeatmap({ orders }: Props) {
  const stats = useMemo(() => computeZoneStats(orders), [orders]);

  if (stats.length === 0) return null;

  const criticalCount = stats.filter(s => s.urgency === 'critical').length;

  return (
    <div className="rounded-2xl border border-stone-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50">
            <MapPin className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Zonen-Heatmap</div>
            <div className="text-[10px] text-stone-400">{stats.length} Zonen · Echtzeit</div>
          </div>
        </div>
        {criticalCount > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black">
            {criticalCount} kritisch
          </span>
        )}
      </div>

      {/* Zone Grid */}
      <div className="divide-y divide-stone-50">
        {stats.map(s => (
          <div
            key={s.zone}
            className={cn(
              'flex items-center gap-3 px-4 py-3 transition-colors',
              s.urgency === 'critical' ? 'bg-red-50/60' : s.urgency === 'warn' ? 'bg-amber-50/40' : '',
            )}
          >
            {/* Zone label */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-stone-800 truncate">{s.zone}</span>
                <UrgencyBadge urgency={s.urgency} />
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-stone-500">
                <span>{s.orderCount} Bestellungen{s.pendingCount > 0 ? ` (${s.pendingCount} offen)` : ''}</span>
                {s.totalRevenue > 0 && (
                  <span>{s.totalRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="flex items-center gap-3 shrink-0">
              {s.avgWaitMin !== null && (
                <div className="text-center">
                  <div className={cn(
                    'text-xs font-black tabular-nums',
                    s.avgWaitMin > 20 ? 'text-red-600' : s.avgWaitMin > 12 ? 'text-amber-600' : 'text-matcha-600',
                  )}>
                    {Math.round(s.avgWaitMin)}m
                  </div>
                  <div className="text-[9px] text-stone-400 flex items-center gap-0.5">
                    <Clock className="h-2 w-2" />Ø Warte
                  </div>
                </div>
              )}
              {s.onTimePct !== null && (
                <div className="text-center">
                  <div className={cn(
                    'text-xs font-black tabular-nums',
                    s.onTimePct < 70 ? 'text-red-600' : s.onTimePct < 85 ? 'text-amber-600' : 'text-matcha-600',
                  )}>
                    {Math.round(s.onTimePct)}%
                  </div>
                  <div className="text-[9px] text-stone-400 flex items-center gap-0.5">
                    <Target className="h-2 w-2" />Pünktl.
                  </div>
                </div>
              )}
              {s.avgScore !== null && (
                <div className="text-center">
                  <div className={cn(
                    'text-xs font-black tabular-nums',
                    s.avgScore < 40 ? 'text-red-600' : s.avgScore < 65 ? 'text-amber-600' : 'text-matcha-600',
                  )}>
                    {Math.round(s.avgScore)}
                  </div>
                  <div className="text-[9px] text-stone-400 flex items-center gap-0.5">
                    <TrendingDown className="h-2 w-2" />Score
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-stone-50 bg-stone-50/50">
        <p className="text-[10px] text-stone-400">
          Farbkodierung: <span className="text-red-500 font-bold">Rot</span> = Wartezeit &gt;20 Min oder Pünktlichkeit &lt;70%;
          {' '}<span className="text-amber-500 font-bold">Gelb</span> = Achtung; <span className="text-matcha-600 font-bold">Grün</span> = OK
        </p>
      </div>
    </div>
  );
}
