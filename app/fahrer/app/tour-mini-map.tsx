'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Map as MapIcon } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    kunde_name: string;
    kunde_lat: number | null;
    kunde_lng: number | null;
    bestellnummer: string;
  };
};

interface TourMiniMapProps {
  stops: Stop[];
  driverLat?: number | null;
  driverLng?: number | null;
  className?: string;
}

export function TourMiniMap({ stops, driverLat, driverLng, className }: TourMiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const driverMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const nextPendingIndex = sorted.findIndex((s) => !s.geliefert_am);
  const stopsWithCoords = sorted.filter((s) => s.order.kunde_lat != null && s.order.kunde_lng != null);

  // Initialize map
  useEffect(() => {
    if (collapsed || stopsWithCoords.length === 0 || !mapRef.current) return;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css' as any).catch(() => {});

      if (!mapInstanceRef.current) {
        const centerStop = sorted[nextPendingIndex >= 0 ? nextPendingIndex : 0];
        const lat = centerStop?.order.kunde_lat ?? stopsWithCoords[0].order.kunde_lat!;
        const lng = centerStop?.order.kunde_lng ?? stopsWithCoords[0].order.kunde_lng!;

        const map = L.map(mapRef.current!, {
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
        }).setView([lat, lng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        mapInstanceRef.current = map;
        setReady(true);
      }
    })();
  }, [collapsed, stopsWithCoords.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers + route on stops change
  useEffect(() => {
    if (!mapInstanceRef.current || !ready) return;

    (async () => {
      const L = (await import('leaflet')).default;

      // Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null; }

      // Route polyline
      const coords = stopsWithCoords.map((s) => [s.order.kunde_lat!, s.order.kunde_lng!] as [number, number]);
      if (driverLat && driverLng) coords.unshift([driverLat, driverLng]);
      if (coords.length > 1) {
        routeLineRef.current = L.polyline(coords, {
          color: '#4ae68a', weight: 2, opacity: 0.55, dashArray: '6 4',
        }).addTo(mapInstanceRef.current);
      }

      // Stop markers
      sorted.forEach((stop, i) => {
        if (stop.order.kunde_lat == null || stop.order.kunde_lng == null) return;
        const isCompleted = !!stop.geliefert_am;
        const isCurrent = i === nextPendingIndex;

        const bg = isCompleted ? '#22c55e' : isCurrent ? '#4ae68a' : '#374151';
        const fg = isCompleted || isCurrent ? '#052e16' : '#e5e7eb';
        const label = isCompleted ? '✓' : String(i + 1);
        const glow = isCurrent ? 'box-shadow:0 0 0 4px rgba(74,230,138,0.35),0 2px 8px rgba(0,0,0,0.5)' : 'box-shadow:0 2px 6px rgba(0,0,0,0.35)';

        const icon = L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;border-radius:50%;background:${bg};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:${fg};${glow}">${label}</div>`,
          iconAnchor: [13, 13],
        });

        const marker = L.marker([stop.order.kunde_lat!, stop.order.kunde_lng!], { icon })
          .addTo(mapInstanceRef.current)
          .bindTooltip(stop.order.kunde_name, { permanent: false, direction: 'top', className: 'text-xs' });
        markersRef.current.push(marker);
      });

      // Driver marker
      if (driverMarkerRef.current) { driverMarkerRef.current.remove(); driverMarkerRef.current = null; }
      if (driverLat != null && driverLng != null) {
        const driverIcon = L.divIcon({
          className: '',
          html: `<div style="width:34px;height:34px;border-radius:50%;background:#1d4ed8;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 12px rgba(0,0,0,0.45)">🛵</div>`,
          iconAnchor: [17, 17],
        });
        driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(mapInstanceRef.current);
      }

      // Fit bounds
      const allCoords: [number, number][] = stopsWithCoords.map((s) => [s.order.kunde_lat!, s.order.kunde_lng!]);
      if (driverLat != null && driverLng != null) allCoords.push([driverLat, driverLng]);
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        mapInstanceRef.current.fitBounds(bounds, { padding: [22, 22], maxZoom: 14 });
      }
    })();
  }, [ready, stops, driverLat, driverLng, nextPendingIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch {}
        mapInstanceRef.current = null;
        setReady(false);
      }
    };
  }, []);

  // Expand map after collapse
  useEffect(() => {
    if (!collapsed && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 80);
    }
  }, [collapsed]);

  if (stopsWithCoords.length === 0) return null;

  const completedCount = sorted.filter((s) => s.geliefert_am).length;

  return (
    <div className={cn('rounded-2xl border border-accent/20 overflow-hidden bg-matcha-900', className)}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-matcha-800/70 active:bg-matcha-700/60 transition"
        onClick={() => setCollapsed((v) => !v)}
      >
        <MapIcon size={13} className="text-accent shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-accent flex-1 text-left">
          Tour-Karte
        </span>
        <span className="text-[9px] text-matcha-400 tabular-nums">
          {completedCount}/{sorted.length} abgeschlossen
        </span>
        {collapsed
          ? <ChevronDown size={13} className="text-matcha-400 shrink-0" />
          : <ChevronUp size={13} className="text-matcha-400 shrink-0" />
        }
      </button>

      {/* Map */}
      {!collapsed && (
        <div ref={mapRef} className="w-full" style={{ height: 200 }} />
      )}

      {/* Legend */}
      {!collapsed && (
        <div className="px-3 py-2 bg-matcha-900/80 flex items-center gap-3 flex-wrap border-t border-white/5">
          <span className="flex items-center gap-1 text-[9px] text-matcha-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            Geliefert
          </span>
          <span className="flex items-center gap-1 text-[9px] text-matcha-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#4ae68a]" />
            Aktuell
          </span>
          <span className="flex items-center gap-1 text-[9px] text-matcha-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#374151]" />
            Ausstehend
          </span>
          {driverLat != null && (
            <span className="flex items-center gap-1 text-[9px] text-matcha-400">
              <span className="text-xs">🛵</span>
              Dein Standort
            </span>
          )}
        </div>
      )}
    </div>
  );
}
