'use client';

/**
 * DriverHotspotTip — Phase 174
 *
 * Zeigt dem Fahrer (wenn online, kein aktiver Batch) einen
 * Positions-Tipp: wohin er sich vorpositionieren soll,
 * basierend auf den Geo-Cluster Hotspots.
 *
 * Fetcht /api/delivery/admin/geo-clustering?action=hotspots&limit=3
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Crosshair, Navigation2, TrendingUp, X } from 'lucide-react';

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

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function scoreStyle(s: number) {
  if (s >= 80) return { bg: 'bg-red-500', text: 'text-white', badge: 'Sehr gefragt' };
  if (s >= 60) return { bg: 'bg-orange-500', text: 'text-white', badge: 'Viel Nachfrage' };
  if (s >= 40) return { bg: 'bg-amber-500', text: 'text-white', badge: 'Mittlere Nachfrage' };
  return { bg: 'bg-matcha-600', text: 'text-white', badge: 'Ruhige Zone' };
}

interface Props {
  isOnline: boolean;
  hasActiveBatch: boolean;
  driverPos: { lat: number; lng: number } | null;
  locationId?: string | null;
}

export function DriverHotspotTip({ isOnline, hasActiveBatch, driverPos, locationId }: Props) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const shouldShow = isOnline && !hasActiveBatch && driverPos !== null;

  useEffect(() => {
    if (!shouldShow || !locationId) return;
    setDismissed(false);

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/geo-clustering?action=hotspots&limit=3&location_id=${locationId}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { hotspots?: Hotspot[] };
        if (!cancelled) setHotspots(data.hotspots ?? []);
      } catch {
        // ignore
      }
    };
    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [shouldShow, locationId]);

  if (!shouldShow || dismissed || hotspots.length === 0) return null;

  // Nächsten Hotspot zum Fahrer finden
  const nearest = hotspots.reduce<{ h: Hotspot; d: number } | null>((best, h) => {
    const d = haversineKm(driverPos!, { lat: h.center_lat, lng: h.center_lng });
    if (!best || d < best.d) return { h, d };
    return best;
  }, null);

  if (!nearest) return null;
  const { h, d } = nearest;
  const style = scoreStyle(h.demand_score);
  const name = h.label ?? `Zone ${h.cluster_idx + 1}`;
  const peakStr = h.peak_hour !== null ? `Spitze: ${h.peak_hour}:00 Uhr` : null;

  return (
    <div className={cn('rounded-2xl p-4 shadow-lg relative', style.bg, style.text)}>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 opacity-70 hover:opacity-100 transition"
        aria-label="Schließen"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-white/20 p-2">
          <Crosshair className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            Positions-Empfehlung
          </p>
          <p className="text-base font-black leading-tight mt-0.5 truncate">{name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] font-semibold opacity-90">{d.toFixed(1)} km</span>
            <span className="text-[11px] font-bold bg-white/20 rounded-full px-2 py-0.5">
              {style.badge}
            </span>
            {peakStr && (
              <span className="flex items-center gap-0.5 text-[11px] opacity-80">
                <TrendingUp className="h-3 w-3" />
                {peakStr}
              </span>
            )}
          </div>
        </div>
      </div>

      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${h.center_lat},${h.center_lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'mt-3 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold',
          'bg-white/20 hover:bg-white/30 transition border border-white/30',
        )}
      >
        <Navigation2 className="h-4 w-4" />
        Navigiere zu {name}
      </a>
    </div>
  );
}
