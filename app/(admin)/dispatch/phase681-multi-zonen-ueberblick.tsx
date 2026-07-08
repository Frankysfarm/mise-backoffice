'use client';

/**
 * Phase 681 — Multi-Zonen-Effizienz-Überblick
 * Alle aktiven Lieferzonen auf einen Blick: Fahrerzahl, offene Touren, ETA-Avg.
 * Props: locationId: string | null
 */

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Map, Bike, Clock, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type HeatLevel = 'low' | 'medium' | 'high' | 'critical';

type ZoneLiveRow = {
  zoneId: string;
  zoneName: string;
  zoneLabel: string;
  activeTours: number;
  pendingOrders: number;
  avgDeliveryMin: number | null;
  heatLevel: HeatLevel;
  color: string;
};

const HEAT_STYLE: Record<HeatLevel, { bg: string; text: string; label: string }> = {
  low:      { bg: 'bg-matcha-50 dark:bg-matcha-950/20',   text: 'text-matcha-700 dark:text-matcha-300',   label: 'Ruhig'    },
  medium:   { bg: 'bg-blue-50 dark:bg-blue-950/20',        text: 'text-blue-700 dark:text-blue-300',        label: 'Aktiv'    },
  high:     { bg: 'bg-amber-50 dark:bg-amber-950/20',      text: 'text-amber-700 dark:text-amber-300',      label: 'Hoch'     },
  critical: { bg: 'bg-red-50 dark:bg-red-950/20',          text: 'text-red-700 dark:text-red-300',          label: 'Kritisch' },
};

const HEAT_BADGE: Record<HeatLevel, string> = {
  low:      'bg-matcha-100 text-matcha-800 dark:bg-matcha-900/30 dark:text-matcha-300',
  medium:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  high:     'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export function DispatchPhase681MultiZonenUeberblick({ locationId }: { locationId: string | null }) {
  const [zones, setZones] = useState<ZoneLiveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const fetchZones = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/zone-live-heatmap?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const json = await res.json() as { zones?: ZoneLiveRow[] };
      setZones((json.zones ?? []).filter((z) => z.activeTours > 0 || z.pendingOrders > 0));
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchZones();
    const id = setInterval(fetchZones, 30_000);
    return () => clearInterval(id);
  }, [fetchZones]);

  const totalTouren = zones.reduce((s, z) => s + z.activeTours, 0);
  const totalOffene = zones.reduce((s, z) => s + z.pendingOrders, 0);
  const activeZones = zones.length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-sm">Multi-Zonen-Überblick</span>
          {loading ? (
            <span className="text-xs text-muted-foreground">Lädt…</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {activeZones} Zone{activeZones !== 1 ? 'n' : ''} aktiv · {totalTouren} Touren · {totalOffene} offen
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {zones.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground py-2">Keine aktiven Zonen.</p>
          )}

          {/* Zusammenfassungs-Row */}
          {zones.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { icon: Map, label: 'Zonen aktiv', value: activeZones },
                { icon: Bike, label: 'Touren laufend', value: totalTouren },
                { icon: Package, label: 'Bestellungen offen', value: totalOffene },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                  <Icon className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold tabular-nums">{value}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {zones.map((zone) => {
              const style = HEAT_STYLE[zone.heatLevel];
              return (
                <Card
                  key={zone.zoneId}
                  className={cn('flex items-center gap-3 p-3', style.bg)}
                >
                  {/* Zone-Farb-Dot */}
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: zone.color }}
                  />

                  {/* Zone-Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-bold', style.text)}>
                        Zone {zone.zoneName}
                      </span>
                      <span className="text-xs text-muted-foreground">{zone.zoneLabel}</span>
                      <Badge className={cn('text-[10px] px-1.5 py-0.5 h-auto', HEAT_BADGE[zone.heatLevel])}>
                        {HEAT_STYLE[zone.heatLevel].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Bike className="h-3 w-3" />
                        {zone.activeTours} Tour{zone.activeTours !== 1 ? 'en' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {zone.pendingOrders} offen
                      </span>
                      {zone.avgDeliveryMin !== null && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Ø {zone.avgDeliveryMin} Min
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
