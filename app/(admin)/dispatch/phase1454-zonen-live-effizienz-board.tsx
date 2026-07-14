'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, TrendingUp, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Phase 1454 — Zonen-Live-Effizienz-Board (Dispatch)
// Live-Performance je Lieferzone: Bestellungen, Ø-Lieferzeit, Pünktlichkeit, Fahrer

interface Stop {
  id: string;
  zone?: string | null;
  geliefert_am?: string | null;
  angekommen_am?: string | null;
  geplante_ankunft?: string | null;
  erstellt_am?: string | null;
}

interface Batch {
  id: string;
  zone?: string | null;
  status?: string | null;
  fahrer_id?: string | null;
  stops?: Stop[] | null;
  erstellt_am?: string | null;
}

interface Props {
  batches: Batch[];
  stops?: Stop[];
}

interface ZoneStats {
  zone: string;
  orderCount: number;
  deliveredCount: number;
  onTimeCount: number;
  avgDeliveryMin: number | null;
  onTimePct: number;
  activeDrivers: number;
}

function getHealthColor(pct: number): string {
  if (pct >= 85) return '#2d6b45';
  if (pct >= 70) return '#d97706';
  return '#dc2626';
}

function getHealthLabel(pct: number): { label: string; cls: string } {
  if (pct >= 85) return { label: 'Gut', cls: 'bg-matcha-500 text-white' };
  if (pct >= 70) return { label: 'Ok', cls: 'bg-amber-400 text-white' };
  return { label: 'Kritisch', cls: 'bg-red-500 text-white' };
}

function computeZoneStats(batches: Batch[]): ZoneStats[] {
  const zoneMap = new Map<string, {
    orders: number; delivered: number; onTime: number;
    deliveryMins: number[]; drivers: Set<string>;
  }>();

  for (const b of batches) {
    const zone = b.zone ?? 'Zone ?';
    if (!zoneMap.has(zone)) {
      zoneMap.set(zone, { orders: 0, delivered: 0, onTime: 0, deliveryMins: [], drivers: new Set() });
    }
    const z = zoneMap.get(zone)!;
    if (b.fahrer_id) z.drivers.add(b.fahrer_id);

    for (const s of b.stops ?? []) {
      z.orders++;
      if (s.geliefert_am) {
        z.delivered++;
        if (s.erstellt_am && s.geliefert_am) {
          const min = (new Date(s.geliefert_am).getTime() - new Date(s.erstellt_am).getTime()) / 60000;
          if (min > 0 && min < 120) z.deliveryMins.push(min);
        }
        if (s.geplante_ankunft && s.geliefert_am) {
          if (new Date(s.geliefert_am) <= new Date(s.geplante_ankunft)) z.onTime++;
        } else {
          z.onTime++;
        }
      }
    }
  }

  return Array.from(zoneMap.entries())
    .map(([zone, d]) => ({
      zone,
      orderCount: d.orders,
      deliveredCount: d.delivered,
      onTimeCount: d.onTime,
      avgDeliveryMin: d.deliveryMins.length > 0
        ? Math.round(d.deliveryMins.reduce((a, b) => a + b, 0) / d.deliveryMins.length)
        : null,
      onTimePct: d.delivered > 0 ? Math.round((d.onTime / d.delivered) * 100) : 100,
      activeDrivers: d.drivers.size,
    }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 8);
}

export function DispatchPhase1454ZonenLiveEfzienzBoard({ batches, stops }: Props) {
  const [open, setOpen] = useState(true);

  const zones = computeZoneStats(batches ?? []);

  const chartData = zones.map(z => ({
    name: z.zone.replace('Zone ', ''),
    pct: z.onTimePct,
    orders: z.orderCount,
  }));

  if (zones.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Zonen-Live-Effizienz</span>
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {zones.length} Zonen
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 pt-3 pb-4 space-y-4">
          {/* Pünktlichkeits-Chart */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Pünktlichkeit je Zone
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={chartData} barSize={24} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: unknown) => [`${v as number}%`, 'Pünktlichkeit']}
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                />
                <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={getHealthColor(entry.pct)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Zone-Kacheln */}
          <div className="grid gap-2">
            {zones.map(z => {
              const health = getHealthLabel(z.onTimePct);
              return (
                <div key={z.zone} className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2">
                  <MapPin className="h-4 w-4 text-matcha-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{z.zone}</span>
                      <span className={cn('text-[9px] font-black rounded-full px-1.5 py-0.5', health.cls)}>
                        {health.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span>{z.orderCount} Bestellungen</span>
                      {z.avgDeliveryMin !== null && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          Ø {z.avgDeliveryMin} Min
                        </span>
                      )}
                      <span>{z.activeDrivers} Fahrer</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className="font-mono text-sm font-black tabular-nums"
                      style={{ color: getHealthColor(z.onTimePct) }}
                    >
                      {z.onTimePct}%
                    </div>
                    <div className="text-[8px] text-muted-foreground">pünktlich</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
