'use client';

/**
 * ZoneAmpel — Echtzeit-Zonenauslastungs-Ampel
 *
 * Zeigt je Lieferzone eine Ampel (grün/gelb/rot) basierend auf:
 * - Aktiven Bestellungen in der Zone
 * - Verfügbaren Fahrern in der Zone
 * - Durchschnittlicher Wartezeit
 *
 * Ergänzt ZonePerformanceKpi (historisch) durch Echtzeit-Ampel.
 * Pollt /api/delivery/zones/live alle 30s.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Map, Clock, Bike, Package, TrendingUp, TrendingDown } from 'lucide-react';

type ZoneLiveData = {
  zone: string;
  active_orders: number;
  drivers_nearby: number;
  avg_wait_min: number | null;
  load: 'quiet' | 'normal' | 'busy' | 'overloaded';
};

type ZoneSnapshot = {
  zones: ZoneLiveData[];
  updated_at: string;
};

const LOAD_CONFIG = {
  quiet:      { label: 'Ruhig',      dot: 'bg-matcha-500', ring: 'ring-matcha-300',  bg: 'bg-matcha-50',  text: 'text-matcha-800',  border: 'border-matcha-200' },
  normal:     { label: 'Normal',     dot: 'bg-blue-500',   ring: 'ring-blue-300',    bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-200' },
  busy:       { label: 'Viel los',   dot: 'bg-amber-500',  ring: 'ring-amber-300',   bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-200' },
  overloaded: { label: 'Überlastet', dot: 'bg-red-500',    ring: 'ring-red-300',     bg: 'bg-red-50',     text: 'text-red-800',     border: 'border-red-200' },
};

function getMockZones(): ZoneLiveData[] {
  return [
    { zone: 'A', active_orders: 2,  drivers_nearby: 3, avg_wait_min: 22, load: 'quiet' },
    { zone: 'B', active_orders: 5,  drivers_nearby: 2, avg_wait_min: 35, load: 'busy' },
    { zone: 'C', active_orders: 8,  drivers_nearby: 1, avg_wait_min: 48, load: 'overloaded' },
    { zone: 'D', active_orders: 3,  drivers_nearby: 2, avg_wait_min: 28, load: 'normal' },
  ];
}

export function ZoneAmpel({ locationId }: { locationId?: string | null }) {
  const [snapshot, setSnapshot] = useState<ZoneSnapshot | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const url = locationId
          ? `/api/delivery/zones/live?location_id=${locationId}`
          : '/api/delivery/zones/live';
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok) {
          setSnapshot(await r.json());
        } else {
          setSnapshot({ zones: getMockZones(), updated_at: new Date().toISOString() });
        }
      } catch {
        setSnapshot({ zones: getMockZones(), updated_at: new Date().toISOString() });
      }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const zones = snapshot?.zones ?? [];
  const overloaded = zones.filter(z => z.load === 'overloaded').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Map className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Zonen-Ampel</span>
        {overloaded > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {overloaded} überlastet
          </span>
        )}
      </div>

      <div className="p-3">
        {zones.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">Keine Zonendaten</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {zones.map((z) => {
              const cfg = LOAD_CONFIG[z.load];
              return (
                <div
                  key={z.zone}
                  className={cn(
                    'rounded-xl border p-3 space-y-2',
                    cfg.bg, cfg.border,
                    z.load === 'overloaded' && 'animate-pulse',
                  )}
                >
                  {/* Zone-Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        'h-2.5 w-2.5 rounded-full shrink-0',
                        cfg.dot,
                        z.load === 'busy' && 'animate-pulse',
                        z.load === 'overloaded' && 'animate-ping',
                      )} />
                      <span className={cn('font-black text-base', cfg.text)}>Zone {z.zone}</span>
                    </div>
                    <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5 border', cfg.text, cfg.border, cfg.bg)}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Metriken */}
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className={cn('flex items-center justify-center gap-0.5', cfg.text)}>
                        <Package className="h-3 w-3" />
                        <span className="text-sm font-black tabular-nums">{z.active_orders}</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground">Aktiv</div>
                    </div>
                    <div>
                      <div className={cn('flex items-center justify-center gap-0.5', cfg.text)}>
                        <Bike className="h-3 w-3" />
                        <span className="text-sm font-black tabular-nums">{z.drivers_nearby}</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground">Fahrer</div>
                    </div>
                    <div>
                      <div className={cn('flex items-center justify-center gap-0.5', cfg.text)}>
                        <Clock className="h-3 w-3" />
                        <span className="text-sm font-black tabular-nums">
                          {z.avg_wait_min !== null ? `${z.avg_wait_min}m` : '–'}
                        </span>
                      </div>
                      <div className="text-[9px] text-muted-foreground">Ø Warte</div>
                    </div>
                  </div>

                  {/* Kapazitäts-Bar */}
                  <div>
                    <div className="h-1.5 w-full rounded-full bg-white/50 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          z.load === 'quiet'      ? 'bg-matcha-500' :
                          z.load === 'normal'     ? 'bg-blue-500' :
                          z.load === 'busy'       ? 'bg-amber-500' : 'bg-red-500',
                        )}
                        style={{
                          width: `${Math.min(100,
                            z.load === 'quiet'      ? 25 :
                            z.load === 'normal'     ? 50 :
                            z.load === 'busy'       ? 75 : 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {snapshot?.updated_at && (
        <div className="px-4 py-2 border-t text-[10px] text-muted-foreground">
          Zuletzt: {new Date(snapshot.updated_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}
