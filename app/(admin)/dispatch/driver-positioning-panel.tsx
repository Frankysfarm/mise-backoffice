'use client';

/**
 * DriverPositioningPanel — Phase 174
 *
 * Zeigt freien Fahrern (online, kein aktiver Batch) die nächste
 * Demand-Zone (Geo-Cluster Hotspot) zur Vorpositionierung an.
 * Fetcht /api/delivery/admin/geo-clustering?action=hotspots&limit=5.
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Crosshair, MapPin, Navigation2, TrendingUp, RefreshCw } from 'lucide-react';

interface Hotspot {
  id: string;
  cluster_idx: number;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  order_count: number;
  peak_hour: number | null;
  demand_score: number;
  label: string | null;
}

interface FreeDriver {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin = Math.sin;
  const cos = Math.cos;
  const x =
    sin(dLat / 2) ** 2 +
    cos((a.lat * Math.PI) / 180) * cos((b.lat * Math.PI) / 180) * sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function scoreColor(s: number) {
  if (s >= 80) return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' };
  if (s >= 60) return { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' };
  if (s >= 40) return { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
  return { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' };
}

function scoreLabel(s: number) {
  if (s >= 80) return 'Sehr hohe Nachfrage';
  if (s >= 60) return 'Hohe Nachfrage';
  if (s >= 40) return 'Mittlere Nachfrage';
  return 'Niedrige Nachfrage';
}

function hourLabel(h: number | null) {
  if (h === null) return null;
  return `Spitze ${h}:00 Uhr`;
}

interface Props {
  freeDrivers: FreeDriver[];
  locationId?: string | null;
}

export function DriverPositioningPanel({ freeDrivers, locationId }: Props) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/geo-clustering?action=hotspots&limit=5&location_id=${locationId}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { hotspots?: Hotspot[] };
      setHotspots(data.hotspots ?? []);
      setLastRefresh(new Date());
    } catch {
      // silently ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (freeDrivers.length === 0 || hotspots.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Positions-Empfehlung
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {freeDrivers.length} frei
          </Badge>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition"
          title="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Freie Fahrer zu Nachfrage-Hotspots vorpositionieren (basierend auf historischen Bestell-Clustern).
      </p>

      <div className="space-y-2">
        {freeDrivers.map((driver) => {
          const nearest = hotspots.reduce<{ hotspot: Hotspot; distKm: number } | null>((best, h) => {
            const d = haversineKm({ lat: driver.lat, lng: driver.lng }, { lat: h.center_lat, lng: h.center_lng });
            if (!best || d < best.distKm) return { hotspot: h, distKm: d };
            return best;
          }, null);

          if (!nearest) return null;
          const { hotspot, distKm } = nearest;
          const col = scoreColor(hotspot.demand_score);

          return (
            <div
              key={driver.id}
              className={cn('rounded-xl border p-3 space-y-1.5', col.bg)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', col.dot)} />
                  <span className="text-sm font-bold">{driver.name}</span>
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {distKm.toFixed(1)} km entfernt
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <MapPin className={cn('h-3 w-3 shrink-0', col.text)} />
                <span className={cn('text-xs font-semibold', col.text)}>
                  {hotspot.label ?? `Zone ${hotspot.cluster_idx + 1}`}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <TrendingUp className="h-3 w-3" />
                  {scoreLabel(hotspot.demand_score)}
                </span>
                {hourLabel(hotspot.peak_hour) && (
                  <span>{hourLabel(hotspot.peak_hour)}</span>
                )}
                <span>{hotspot.order_count} Bestellungen</span>
              </div>

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${hotspot.center_lat},${hotspot.center_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition',
                  'bg-white/70 hover:bg-white/90 border border-white/50',
                  col.text,
                )}
              >
                <Navigation2 className="h-3 w-3" />
                Navigieren
              </a>
            </div>
          );
        })}
      </div>

      {lastRefresh && (
        <p className="text-[9px] text-muted-foreground text-right">
          Aktualisiert: {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </Card>
  );
}
