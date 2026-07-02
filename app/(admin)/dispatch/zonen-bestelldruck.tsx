'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Flame, ChevronDown, ChevronUp, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';

type AlertLevel = 'ok' | 'elevated' | 'high' | 'critical';

interface ZoneRow {
  zone: string;
  openOrders: number;
  activeDrivers: number;
  pressureRatio: number;
  alertLevel: AlertLevel;
  avgWaitMin: number | null;
}

interface Summary {
  totalOpenOrders: number;
  totalActiveDrivers: number;
  criticalZones: string[];
  highZones: string[];
  overallLevel: AlertLevel;
}

interface ApiResponse {
  ok: boolean;
  zones: ZoneRow[];
  summary: Summary;
  generatedAt: string;
}

interface Props {
  locationId?: string | null;
}

const LEVEL_STYLE: Record<AlertLevel, { bg: string; badge: string; text: string; label: string }> = {
  ok:       { bg: 'bg-matcha-50',  badge: 'bg-matcha-100 text-matcha-700', text: 'text-matcha-600', label: 'Normal'   },
  elevated: { bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700',     text: 'text-blue-600',   label: 'Erhöht'   },
  high:     { bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700',   text: 'text-amber-700',  label: 'Hoch'     },
  critical: { bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700',       text: 'text-red-700',    label: 'Kritisch' },
};

export function DispatchZonenBestelldruckMonitor({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    const load = () => {
      fetch(`/api/delivery/admin/zonen-bestelldruck?location_id=${encodeURIComponent(locationId)}`)
        .then(r => r.json())
        .then((d: ApiResponse) => { if (d.ok) setData(d); })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <Card className="border p-4">
        <div className="h-4 w-48 bg-stone-100 animate-pulse rounded mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-stone-100 animate-pulse rounded" />)}
        </div>
      </Card>
    );
  }
  if (!data || !locationId || data.zones.length === 0) return null;

  const { summary } = data;
  const overallStyle = LEVEL_STYLE[summary.overallLevel];
  const hasCritical = summary.criticalZones.length > 0;

  return (
    <Card className="border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', hasCritical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')}>
            <Flame className="h-3.5 w-3.5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground">Zonen-Bestelldruck</div>
            <div className="text-[10px] text-muted-foreground">
              {summary.totalOpenOrders} offen · {summary.totalActiveDrivers} Fahrer aktiv
              {hasCritical && (
                <span className="ml-1.5 text-red-600 font-bold">
                  · {summary.criticalZones.length} Zone{summary.criticalZones.length !== 1 ? 'n' : ''} kritisch
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', overallStyle.badge)}>
            {overallStyle.label}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-100">
          {/* Critical alert banner */}
          {hasCritical && (
            <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 px-4 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span className="text-[11px] text-red-700 font-bold">
                Kritischer Bestelldruck in Zone{summary.criticalZones.length !== 1 ? 'n' : ''}: {summary.criticalZones.join(', ')}
              </span>
            </div>
          )}

          <div className="divide-y divide-stone-100">
            {data.zones.map(zone => {
              const zs = LEVEL_STYLE[zone.alertLevel];
              const fillPct = Math.min(100, (zone.pressureRatio / 5) * 100);
              return (
                <div key={zone.zone} className={cn('px-4 py-3 flex items-center gap-3', zs.bg)}>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/60 border">
                    <MapPin className={cn('h-3.5 w-3.5', zs.text)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold">Zone {zone.zone}</span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', zs.badge)}>
                        {zs.label}
                      </span>
                      {zone.avgWaitMin !== null && zone.avgWaitMin > 5 && (
                        <span className="text-[9px] text-amber-600 font-bold">
                          Ø {zone.avgWaitMin} Min Warte
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700',
                          zone.alertLevel === 'critical' ? 'bg-red-500' :
                          zone.alertLevel === 'high' ? 'bg-amber-400' :
                          zone.alertLevel === 'elevated' ? 'bg-blue-400' : 'bg-matcha-400',
                        )}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className={cn('text-sm font-black tabular-nums', zs.text)}>
                        {zone.openOrders}
                      </span>
                      <span className="text-[9px] text-muted-foreground">offen</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      {zone.alertLevel === 'ok'
                        ? <CheckCircle2 className="h-3 w-3 text-matcha-500" />
                        : <AlertTriangle className="h-3 w-3 text-amber-500" />
                      }
                      <span className="text-[9px] text-muted-foreground">{zone.activeDrivers} Fahrer</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-stone-100">
            <span className="text-[10px] text-muted-foreground">
              Druck-Ratio = Offene Bestellungen ÷ Aktive Fahrer · aktualisiert alle 30s
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
