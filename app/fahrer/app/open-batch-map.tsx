'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Map as MapIcon, ChevronDown, ChevronUp } from 'lucide-react';

type OpenBatchStop = {
  order_id: string;
  kunde_name: string;
  kunde_lat: number | null;
  kunde_lng: number | null;
};

type OpenBatchMapProps = {
  stops: OpenBatchStop[];
  restaurantLat: number | null;
  restaurantLng: number | null;
  restaurantName?: string;
  className?: string;
};

export function OpenBatchMap({ stops, restaurantLat, restaurantLng, restaurantName, className }: OpenBatchMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLineRef = useRef<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  const stopsWithCoords = stops.filter((s) => s.kunde_lat != null && s.kunde_lng != null);
  const hasRestaurant = restaurantLat != null && restaurantLng != null;
  const hasAnyCoords = hasRestaurant || stopsWithCoords.length > 0;

  if (!hasAnyCoords) return null;

  return (
    <div className={cn('rounded-xl overflow-hidden border border-white/10', className)}>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-white/5 text-left"
      >
        <MapIcon className="h-3.5 w-3.5 text-accent shrink-0" />
        <span className="text-[11px] font-bold text-matcha-200 flex-1">Karte</span>
        {collapsed
          ? <ChevronDown className="h-3.5 w-3.5 text-matcha-400" />
          : <ChevronUp className="h-3.5 w-3.5 text-matcha-400" />
        }
      </button>
      {!collapsed && (
        <MapCanvas
          stops={stopsWithCoords}
          restaurantLat={restaurantLat}
          restaurantLng={restaurantLng}
          restaurantName={restaurantName}
          mapRef={mapRef}
          mapInstanceRef={mapInstanceRef}
          markersRef={markersRef}
          routeLineRef={routeLineRef}
          ready={ready}
          setReady={setReady}
        />
      )}
    </div>
  );
}

function MapCanvas({
  stops,
  restaurantLat,
  restaurantLng,
  restaurantName,
  mapRef,
  mapInstanceRef,
  markersRef,
  routeLineRef,
  ready,
  setReady,
}: {
  stops: OpenBatchStop[];
  restaurantLat: number | null;
  restaurantLng: number | null;
  restaurantName?: string;
  mapRef: React.RefObject<HTMLDivElement | null>;
  mapInstanceRef: React.MutableRefObject<any>;
  markersRef: React.MutableRefObject<any[]>;
  routeLineRef: React.MutableRefObject<any>;
  ready: boolean;
  setReady: (v: boolean) => void;
}) {
  useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current;

    (async () => {
      const L = (await import('leaflet')).default;
      await (import('leaflet/dist/leaflet.css' as any)).catch(() => {});

      if (mapInstanceRef.current) return;

      const centerLat = restaurantLat ?? stops[0]?.kunde_lat ?? 48.14;
      const centerLng = restaurantLng ?? stops[0]?.kunde_lng ?? 11.57;

      const map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      }).setView([centerLat, centerLng], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      mapInstanceRef.current = map;
      setReady(true);
    })();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !ready) return;

    (async () => {
      const L = (await import('leaflet')).default;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null; }

      const coords: [number, number][] = [];

      // Restaurant pin
      if (restaurantLat != null && restaurantLng != null) {
        coords.push([restaurantLat, restaurantLng]);
        const homeIcon = L.divIcon({
          html: `<div style="background:#1a4731;border:2px solid #4ade80;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#4ade80;font-weight:900;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🏠</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          className: '',
        });
        const m = L.marker([restaurantLat, restaurantLng], { icon: homeIcon })
          .addTo(mapInstanceRef.current);
        if (restaurantName) m.bindPopup(restaurantName);
        markersRef.current.push(m);
      }

      // Customer stop pins
      stops.forEach((s, i) => {
        if (s.kunde_lat == null || s.kunde_lng == null) return;
        coords.push([s.kunde_lat, s.kunde_lng]);
        const pinIcon = L.divIcon({
          html: `<div style="background:#4ade80;border:2px solid #166534;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#14532d;font-weight:900;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${i + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          className: '',
        });
        const m = L.marker([s.kunde_lat, s.kunde_lng], { icon: pinIcon })
          .addTo(mapInstanceRef.current);
        m.bindPopup(`${i + 1}. ${s.kunde_name}`);
        markersRef.current.push(m);
      });

      // Route line
      if (coords.length >= 2) {
        routeLineRef.current = L.polyline(coords, {
          color: '#4ade80',
          weight: 2,
          opacity: 0.7,
          dashArray: '6 4',
        }).addTo(mapInstanceRef.current);
      }

      // Fit bounds
      if (coords.length > 0) {
        mapInstanceRef.current.fitBounds(L.latLngBounds(coords), { padding: [20, 20] });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, stops.length]);

  return <div ref={mapRef as React.RefObject<HTMLDivElement>} style={{ height: 180, width: '100%' }} />;
}
