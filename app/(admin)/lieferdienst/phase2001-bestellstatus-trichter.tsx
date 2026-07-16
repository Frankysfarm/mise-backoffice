'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowRight, ChefHat, CheckCircle2, Clock, Package, RefreshCw, Truck } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Phase 2001 — Bestellstatus-Trichter (Lieferdienst)
 *
 * Live-Funnel-Ansicht: Wie viele Bestellungen befinden sich heute in jedem Status?
 * - Neue Bestellungen → Zubereitung → Fertig → Unterwegs → Geliefert
 * - Durchlaufzeit je Stufe
 * - Bottleneck-Ampel: Wo stauen sich Bestellungen?
 * Echtzeit via Supabase.
 */

interface Order {
  id: string;
  status?: string | null;
  bestellt_am?: string | null;
  zubereitung_start?: string | null;
  fertig_am?: string | null;
  abgeholt_am?: string | null;
  geliefert_am?: string | null;
}

interface StageInfo {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  barColor: string;
  statusMatch: string[];
}

const STAGES: StageInfo[] = [
  {
    key: 'neu',
    label: 'Neu',
    icon: <Clock className="w-3.5 h-3.5" />,
    color: 'text-neutral-300',
    bgColor: 'bg-neutral-800/60 border-neutral-700/50',
    barColor: 'bg-neutral-500',
    statusMatch: ['pending', 'new', 'neu', 'confirmed', 'bestätigt'],
  },
  {
    key: 'zubereitung',
    label: 'Zubereitung',
    icon: <ChefHat className="w-3.5 h-3.5" />,
    color: 'text-blue-300',
    bgColor: 'bg-blue-950/40 border-blue-800/50',
    barColor: 'bg-blue-500',
    statusMatch: ['in_progress', 'zubereitung', 'cooking', 'preparing'],
  },
  {
    key: 'fertig',
    label: 'Fertig',
    icon: <Package className="w-3.5 h-3.5" />,
    color: 'text-yellow-300',
    bgColor: 'bg-yellow-950/40 border-yellow-800/50',
    barColor: 'bg-yellow-500',
    statusMatch: ['ready', 'fertig', 'waiting_driver', 'bereit'],
  },
  {
    key: 'unterwegs',
    label: 'Unterwegs',
    icon: <Truck className="w-3.5 h-3.5" />,
    color: 'text-matcha-300',
    bgColor: 'bg-matcha-950/40 border-matcha-800/50',
    barColor: 'bg-matcha-500',
    statusMatch: ['on_the_way', 'delivering', 'unterwegs', 'out_for_delivery'],
  },
  {
    key: 'geliefert',
    label: 'Geliefert',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    color: 'text-green-300',
    bgColor: 'bg-green-950/40 border-green-800/50',
    barColor: 'bg-green-500',
    statusMatch: ['delivered', 'geliefert', 'completed', 'done'],
  },
];

function avgDurationMin(orders: Order[], fromField: keyof Order, toField: keyof Order): number | null {
  const valid = orders.filter((o) => o[fromField] && o[toField]);
  if (!valid.length) return null;
  const total = valid.reduce((sum, o) => {
    const from = new Date(o[fromField] as string).getTime();
    const to = new Date(o[toField] as string).getTime();
    return sum + (to - from) / 60000;
  }, 0);
  return Math.round(total / valid.length);
}

export function LieferdienstPhase2001BestellstatusTrichter({
  locationId,
}: {
  locationId: string | null;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!locationId) { setLoading(false); return; }
    try {
      const supabase = createClient();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('orders')
        .select('id, status, bestellt_am, zubereitung_start, fertig_am, abgeholt_am, geliefert_am')
        .eq('location_id', locationId)
        .gte('bestellt_am', todayStart.toISOString())
        .eq('lieferung', true)
        .limit(500);
      if (data) setOrders(data as Order[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const stageCounts = useMemo(() => {
    return STAGES.map((stage) => {
      const matched = orders.filter((o) => stage.statusMatch.includes((o.status ?? '').toLowerCase()));
      return { ...stage, count: matched.length, orders: matched };
    });
  }, [orders]);

  const total = useMemo(() => orders.length, [orders]);
  const maxCount = useMemo(() => Math.max(...stageCounts.map((s) => s.count), 1), [stageCounts]);

  const durations = useMemo(
    () => ({
      neuToPrep: avgDurationMin(orders, 'bestellt_am', 'zubereitung_start'),
      prepToReady: avgDurationMin(orders, 'zubereitung_start', 'fertig_am'),
      readyToPickup: avgDurationMin(orders, 'fertig_am', 'abgeholt_am'),
      pickupToDelivered: avgDurationMin(orders, 'abgeholt_am', 'geliefert_am'),
    }),
    [orders],
  );

  if (loading) {
    return (
      <Card className="border-matcha-800/30 bg-matcha-950/20 p-3">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Lade Trichter…
        </div>
      </Card>
    );
  }

  if (total === 0) return null;

  const bottleneck = stageCounts.reduce((a, b) => (b.count > a.count ? b : a), stageCounts[0]);

  return (
    <Card className="border-matcha-800/30 bg-matcha-950/20 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-matcha-400" />
          <span className="text-xs font-semibold text-matcha-300 uppercase tracking-wider">
            Bestellstatus-Trichter
          </span>
          <span className="text-[10px] text-neutral-500">Phase 2001</span>
        </div>
        <div className="text-xs text-neutral-400">{total} heute</div>
      </div>

      {/* Funnel Stages */}
      <div className="space-y-1.5">
        {stageCounts.map((stage, idx) => {
          const pct = Math.round((stage.count / total) * 100);
          const widthPct = Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 5 : 0);
          const isBottleneck = stage.key === bottleneck.key && stage.count > 0;

          const durationLabels = [durations.neuToPrep, durations.prepToReady, durations.readyToPickup, durations.pickupToDelivered];
          const durationLabel = idx > 0 && durationLabels[idx - 1] != null ? `Ø ${durationLabels[idx - 1]}min` : null;

          return (
            <div key={stage.key}>
              {/* Duration between stages */}
              {durationLabel && idx > 0 && (
                <div className="flex items-center gap-1 pl-6 mb-0.5">
                  <ArrowRight className="w-2.5 h-2.5 text-neutral-700" />
                  <span className="text-[9px] text-neutral-700">{durationLabel}</span>
                </div>
              )}
              <div
                className={cn(
                  'rounded-lg border p-2 transition-all',
                  stage.bgColor,
                  isBottleneck && stage.count >= 3 && 'ring-1 ring-amber-500/50',
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn(stage.color)}>{stage.icon}</span>
                  <span className={cn('text-xs font-medium flex-1', stage.color)}>{stage.label}</span>
                  <span className="text-xs font-bold text-neutral-200">{stage.count}</span>
                  <span className="text-[10px] text-neutral-500">{pct}%</span>
                  {isBottleneck && stage.count >= 3 && (
                    <span className="text-[9px] text-amber-400 font-medium">Stau</span>
                  )}
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-800/60">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', stage.barColor)}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Conversion Metrics */}
      <div className="flex items-center gap-4 pt-1 border-t border-neutral-800">
        <div className="text-[10px] text-neutral-500">
          Abschluss-Rate:{' '}
          <span className="text-green-400 font-medium">
            {total > 0 ? Math.round((stageCounts[4].count / total) * 100) : 0}%
          </span>
        </div>
        <div className="text-[10px] text-neutral-500">
          Ø Gesamtdauer:{' '}
          <span className="text-matcha-400 font-medium">
            {avgDurationMin(orders, 'bestellt_am', 'geliefert_am') ?? '—'}min
          </span>
        </div>
      </div>
    </Card>
  );
}
