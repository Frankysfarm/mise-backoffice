'use client';

/**
 * ZoneStatsDashboard — Echtzeit-Zonenübersicht für den Dispatch.
 * Zeigt alle Lieferzonen (A–D) in einem 4-Kachel-Grid:
 * - Offene Bestellungen in dieser Zone
 * - Zugewiesene Fahrer
 * - Ø Wartezeit
 * - SLA-Status (grün / gelb / rot)
 * Nutzt die vorhandene ops-snapshot API + lokale Order-Daten.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, Clock, MapPin, Package, TrendingUp, Zap } from 'lucide-react';

type ZoneOrder = {
  id: string;
  bestellnummer: string;
  status: string;
  delivery_zone: string | null;
  fertig_am: string | null;
  gesamtbetrag: number;
  dispatch_score: number | null;
};

type ZoneDriver = {
  zone: string | null;
  isActive: boolean;
};

type ZoneMetrics = {
  zone: string;
  pendingCount: number;
  readyCount: number;
  activeDrivers: number;
  avgWaitMin: number | null;
  maxWaitMin: number | null;
  health: 'good' | 'warn' | 'critical';
  avgScore: number | null;
  totalRevenue: number;
};

const ZONE_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  A: { label: 'Zone A', color: 'text-matcha-700', bg: 'bg-matcha-50', border: 'border-matcha-200', icon: '🟢' },
  B: { label: 'Zone B', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: '🔵' },
  C: { label: 'Zone C', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: '🟡' },
  D: { label: 'Zone D', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: '🔴' },
};

function healthFromMetrics(m: Omit<ZoneMetrics, 'health'>): 'good' | 'warn' | 'critical' {
  if ((m.maxWaitMin ?? 0) > 15 || m.pendingCount >= 5) return 'critical';
  if ((m.avgWaitMin ?? 0) > 8 || m.pendingCount >= 3) return 'warn';
  return 'good';
}

const HEALTH_STYLE: Record<string, { ring: string; badge: string; icon: typeof AlertTriangle }> = {
  good:     { ring: 'ring-matcha-300',  badge: 'bg-matcha-100 text-matcha-700', icon: TrendingUp },
  warn:     { ring: 'ring-amber-400',   badge: 'bg-amber-100 text-amber-700',   icon: Clock },
  critical: { ring: 'ring-red-500',     badge: 'bg-red-100 text-red-700',       icon: AlertTriangle },
};

function WaitBar({ min, max }: { min: number | null; max: number | null }) {
  if (min == null) return null;
  const pct = Math.min(100, (min / 20) * 100);
  const color = min > 12 ? 'bg-red-500' : min > 7 ? 'bg-amber-400' : 'bg-matcha-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Ø {min.toFixed(0)} Min Warte</span>
        {max != null && max > min && <span>Max {max.toFixed(0)} Min</span>}
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ZoneCard({ m }: { m: ZoneMetrics }) {
  const meta = ZONE_META[m.zone] ?? { label: `Zone ${m.zone}`, color: 'text-stone-600', bg: 'bg-stone-50', border: 'border-stone-200', icon: '⚪' };
  const hs = HEALTH_STYLE[m.health];
  const HealthIcon = hs.icon;

  return (
    <div className={cn(
      'rounded-2xl border-2 p-4 space-y-3 ring-2 transition-all',
      meta.bg, meta.border, hs.ring,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span className={cn('font-black text-lg', meta.color)}>{meta.label}</span>
        </div>
        <div className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black', hs.badge)}>
          <HealthIcon className="h-3 w-3" />
          {m.health === 'good' ? 'OK' : m.health === 'warn' ? 'Aufpassen' : 'Kritisch'}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/60 border border-white/80 px-3 py-2 text-center">
          <Package className={cn('h-3.5 w-3.5 mx-auto mb-0.5', meta.color)} />
          <div className={cn('text-2xl font-black tabular-nums', meta.color)}>{m.pendingCount}</div>
          <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide">Offen</div>
        </div>
        <div className="rounded-xl bg-white/60 border border-white/80 px-3 py-2 text-center">
          <Bike className={cn('h-3.5 w-3.5 mx-auto mb-0.5', meta.color)} />
          <div className={cn('text-2xl font-black tabular-nums', meta.color)}>{m.activeDrivers}</div>
          <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide">Fahrer</div>
        </div>
      </div>

      {/* Wait bar */}
      <WaitBar min={m.avgWaitMin} max={m.maxWaitMin} />

      {/* Bottom row */}
      <div className="flex items-center justify-between text-[10px]">
        {m.avgScore != null && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3 w-3" />
            Ø Score: <strong>{m.avgScore.toFixed(0)}</strong>
          </span>
        )}
        {m.readyCount > 0 && (
          <span className={cn('font-black rounded-full px-2 py-0.5', m.readyCount >= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
            {m.readyCount} fertig wartend
          </span>
        )}
      </div>
    </div>
  );
}

export function ZoneStatsDashboard({
  orders,
  batches,
}: {
  orders: { id: string; bestellnummer: string; status: string; delivery_zone: string | null; fertig_am: string | null; gesamtbetrag: number; dispatch_score: number | null }[];
  batches: { id: string; status: string; zone: string | null; fahrer_id: string | null }[];
}) {
  const [metrics, setMetrics] = useState<ZoneMetrics[]>([]);

  useEffect(() => {
    const now = Date.now();
    const zones = ['A', 'B', 'C', 'D'];

    const computed: ZoneMetrics[] = zones.map((zone) => {
      const zoneOrders = orders.filter((o) => o.delivery_zone === zone);
      const pending = zoneOrders.filter((o) => ['fertig', 'bestätigt', 'in_zubereitung'].includes(o.status));
      const ready = zoneOrders.filter((o) => o.status === 'fertig');

      const waitMins = ready
        .filter((o) => o.fertig_am)
        .map((o) => (now - new Date(o.fertig_am!).getTime()) / 60_000);

      const avgWaitMin = waitMins.length > 0
        ? waitMins.reduce((s, v) => s + v, 0) / waitMins.length
        : null;
      const maxWaitMin = waitMins.length > 0 ? Math.max(...waitMins) : null;

      // Active drivers: batches in this zone that are active
      const activeBatches = batches.filter(
        (b) => (b.zone === zone) && ['unterwegs', 'on_route', 'assigned', 'pickup'].includes(b.status),
      );
      const activeDrivers = new Set(activeBatches.map((b) => b.fahrer_id).filter(Boolean)).size;

      const scores = pending.map((o) => o.dispatch_score).filter((s): s is number => s != null);
      const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
      const totalRevenue = pending.reduce((s, o) => s + o.gesamtbetrag, 0);

      const base = {
        zone,
        pendingCount: pending.length,
        readyCount: ready.length,
        activeDrivers,
        avgWaitMin: avgWaitMin != null ? Math.round(avgWaitMin * 10) / 10 : null,
        maxWaitMin: maxWaitMin != null ? Math.round(maxWaitMin * 10) / 10 : null,
        avgScore,
        totalRevenue,
      };

      return { ...base, health: healthFromMetrics(base) };
    });

    setMetrics(computed);
  }, [orders, batches]);

  const totalPending = metrics.reduce((s, m) => s + m.pendingCount, 0);
  const criticalZones = metrics.filter((m) => m.health === 'critical');
  const totalReadyWaiting = metrics.reduce((s, m) => s + m.readyCount, 0);

  if (metrics.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="font-bold text-sm">Zonen-Übersicht</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] ml-auto">
          {criticalZones.length > 0 && (
            <span className="flex items-center gap-1 bg-red-100 text-red-700 font-black px-2.5 py-1 rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {criticalZones.map((m) => `Zone ${m.zone}`).join(', ')} kritisch
            </span>
          )}
          {totalReadyWaiting > 0 && (
            <span className="bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full">
              {totalReadyWaiting} Bestellungen warten auf Dispatch
            </span>
          )}
          <span className="text-muted-foreground">
            {totalPending} offen gesamt
          </span>
        </div>
      </div>

      {/* Zone Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m) => <ZoneCard key={m.zone} m={m} />)}
      </div>
    </div>
  );
}
