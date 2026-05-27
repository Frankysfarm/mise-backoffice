'use client';

import { useEffect, useRef } from 'react';
import type { Map as LMap, Marker as LMarker, Polyline as LPolyline } from 'leaflet';

type Props = {
  driver: { lat: number; lng: number } | null;
  dest: { lat: number; lng: number } | null;
  pickup?: { lat: number; lng: number } | null;
};

export function LiveMap({ driver, dest, pickup }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const driverMarker = useRef<LMarker | null>(null);
  const destMarker = useRef<LMarker | null>(null);
  const pickupMarker = useRef<LMarker | null>(null);
  const routeLine = useRef<LPolyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      // @ts-ignore - inject leaflet CSS only once
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-leaflet', '1');
        document.head.appendChild(link);
      }
      if (cancelled || !containerRef.current) return;

      const center = dest ?? driver ?? { lat: 50.7753, lng: 6.0839 };
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      renderMarkers(L);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    (async () => {
      const L = await import('leaflet');
      renderMarkers(L);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.lat, driver?.lng, dest?.lat, dest?.lng]);

  async function renderMarkers(L: typeof import('leaflet')) {
    const map = mapRef.current;
    if (!map) return;

    const destIcon = L.divIcon({
      html: `<div style="width:30px;height:30px;border-radius:50%;background:#4ae68a;border:3px solid #0d1f16;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:14px">🏠</div>`,
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const pickupIcon = L.divIcon({
      html: `<div style="width:30px;height:30px;border-radius:50%;background:#d4a843;border:3px solid #0d1f16;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:14px">☕</div>`,
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const driverIcon = L.divIcon({
      html: `
        <div style="position:relative;width:44px;height:44px">
          <div style="position:absolute;inset:0;border-radius:50%;background:#4ae68a;opacity:.25;animation:ping 2s cubic-bezier(0,0,.2,1) infinite"></div>
          <div style="position:absolute;inset:14px;border-radius:50%;background:#14532d;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff">🛵</div>
        </div>
        <style>@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }</style>
      `,
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (dest) {
      if (destMarker.current) destMarker.current.setLatLng([dest.lat, dest.lng]);
      else destMarker.current = L.marker([dest.lat, dest.lng], { icon: destIcon }).addTo(map);
    }
    if (pickup) {
      if (pickupMarker.current) pickupMarker.current.setLatLng([pickup.lat, pickup.lng]);
      else pickupMarker.current = L.marker([pickup.lat, pickup.lng], { icon: pickupIcon }).addTo(map);
    }
    if (driver) {
      if (driverMarker.current) driverMarker.current.setLatLng([driver.lat, driver.lng]);
      else driverMarker.current = L.marker([driver.lat, driver.lng], { icon: driverIcon }).addTo(map);
    }

    if (driver && dest) {
      const coords: [number, number][] = [[driver.lat, driver.lng], [dest.lat, dest.lng]];
      if (routeLine.current) routeLine.current.setLatLngs(coords);
      else routeLine.current = L.polyline(coords, {
        color: '#14532d',
        weight: 4,
        dashArray: '8 8',
        opacity: 0.7,
      }).addTo(map);

      map.fitBounds(coords, { padding: [40, 40], maxZoom: 16 });
    } else if (dest) {
      map.setView([dest.lat, dest.lng], 16);
    }
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
