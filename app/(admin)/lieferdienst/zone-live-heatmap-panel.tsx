'use client';

/**
 * ZoneLiveHeatmapPanel — Phase 456
 * Live-Dichte je Lieferzone A/B/C/D.
 * Kachel-Grid mit HeatLevel-Farbkodierung, aktiveTours, pendingOrders, avgDeliveryMin.
 * 60s-Auto-Refresh.
 */

import { useEffect, useState, useCallback } from 'react';
import { MapPin, RefreshCw, ChevronDown, ChevronUp, Flame, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type HeatLevel = 'low' | 'medium' | 'high' | 'critical';

interface ZoneLiveRow {
  zoneId:          string;
  zoneName:        string;
  zoneLabel:       string;
  activeTours:     number;
  pendingOrders:   number;
  avgDeliveryMin:  number | null;
  heatLevel:       HeatLevel;
  color:           string;
}

const HEAT_CONFIG: Record<HeatLevel, { bg: string; border: string; badge: string; label: string }> = {
  low:      { bg: 'bg-matcha-50',  border: 'border-matcha-200', badge: 'bg-matcha-500 text-white',  label: 'Ruhig' },
  medium:   { bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-500 text-white',   label: 'Normal' },
  high:     { bg: 'bg-orange-50',  border: 'border-orange-200', badge: 'bg-orange-500 text-white',  label: 'Viel' },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',    badge: 'bg-red-600 text-white',     label: 'Kritisch' },
};

export function ZoneLiveHeatmapPanel({ locationId }: { locationId?: string | null }) {
  const [zones, setZones] = useState<ZoneLiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    if (!locationId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/delivery/admin/zone-live-heatmap?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d?.zones)) {
          setZones(d.zones);
          setLastUpdated(new Date());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!loading && zones.length === 0) return null;

  const criticalCount = zones.filter(z => z.heatLevel === 'critical').length;
  const highCount     = zones.filter(z => z.heatLevel === 'high').length;

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Flame className={cn(
          'h-4 w-4 shrink-0',
          criticalCount > 0 ? 'text-red-500' : highCount > 0 ? 'text-orange-500' : 'text-matcha-600',
        )} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Zonen Live-Auslastung
        </span>
        {criticalCount > 0 && (
          <span className="text-[10px] font-bold bg-red-100 text-red-700 rounded px-1.5 py-0.5">
            {criticalCount} kritisch
          </span>
        )}
        {!loading && lastUpdated && (
          <span className="text-[9px] text-muted-foreground tabular-nums">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={load}
          className="p-1 hover:bg-muted/40 rounded transition"
          title="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
        </button>
        <button onClick={() => setOpen(v => !v)} className="p-1 hover:bg-muted/40 rounded">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>

      {open && (
        <div className="p-3">
          {loading && zones.length === 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {zones.map(zone => {
                const heat = HEAT_CONFIG[zone.heatLevel];
                return (
                  <div
                    key={zone.zoneId}
                    className={cn('rounded-lg border p-3 flex flex-col gap-2', heat.bg, heat.border)}
                  >
                    {/* Zone-Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: zone.color }}
                        />
                        <span className="text-xs font-black text-foreground">
                          Zone {zone.zoneName}
                        </span>
                      </div>
                      <span className={cn('text-[9px] font-bold rounded px-1 py-0.5', heat.badge)}>
                        {heat.label}
                      </span>
                    </div>

                    {/* Sub-Label */}
                    <span className="text-[10px] text-muted-foreground -mt-1 font-medium">
                      {zone.zoneLabel}
                    </span>

                    {/* KPIs */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" />
                          Touren
                        </span>
                        <span className={cn(
                          'font-black tabular-nums',
                          zone.activeTours >= 3 ? 'text-red-600' : zone.activeTours >= 1 ? 'text-amber-700' : 'text-muted-foreground',
                        )}>
                          {zone.activeTours}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Offen</span>
                        <span className={cn(
                          'font-bold tabular-nums',
                          zone.pendingOrders >= 5 ? 'text-red-600' : zone.pendingOrders >= 2 ? 'text-amber-700' : 'text-foreground',
                        )}>
                          {zone.pendingOrders}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          Ø Zeit
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {zone.avgDeliveryMin != null ? `${zone.avgDeliveryMin} min` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-4 mt-2 px-1 text-[9px] text-muted-foreground">
            {(['low', 'medium', 'high', 'critical'] as HeatLevel[]).map(h => (
              <span key={h} className="flex items-center gap-1">
                <span className={cn('w-2 h-2 rounded-full inline-block', HEAT_CONFIG[h].badge.replace('text-white', ''))} />
                {HEAT_CONFIG[h].label}
              </span>
            ))}
            <span className="ml-auto italic">60s-Refresh</span>
          </div>
        </div>
      )}
    </div>
  );
}
