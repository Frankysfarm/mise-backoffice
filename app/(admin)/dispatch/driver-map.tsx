'use client';

import { useEffect, useRef, useState } from 'react';

type DriverMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: 'frei' | 'unterwegs' | 'zurueck';
  stopCount?: number;
  doneCount?: number;
};

type OrderMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  done: boolean;
  seq: number;
};

type UnassignedMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zone?: string | null;
  waitMin?: number;
};

export function DispatchDriverMap({
  drivers,
  orders,
  unassigned,
  restaurantLat,
  restaurantLng,
}: {
  drivers: DriverMarker[];
  orders: OrderMarker[];
  unassigned?: UnassignedMarker[];
  restaurantLat?: number | null;
  restaurantLng?: number | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css' as any).catch(() => {});
      if (cancelled || !mapRef.current) return;

      // Determine center: prefer restaurant coords, fall back to first driver
      let centerLat = restaurantLat ?? drivers[0]?.lat ?? 48.137;
      let centerLng = restaurantLng ?? drivers[0]?.lng ?? 11.575;

      const map = L.map(mapRef.current, { zoomControl: true }).setView([centerLat, centerLng], 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const allLatLngs: [number, number][] = [];

      // Restaurant marker
      if (restaurantLat && restaurantLng) {
        allLatLngs.push([restaurantLat, restaurantLng]);
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#0d1f16;border:2px solid #d4a843;box-shadow:0 2px 8px rgba(0,0,0,.4);font-size:16px;">🏠</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker([restaurantLat, restaurantLng], { icon })
          .addTo(map)
          .bindPopup('Restaurant');
      }

      // Driver markers
      for (const d of drivers) {
        allLatLngs.push([d.lat, d.lng]);
        const color = d.state === 'frei' ? '#22c55e' : d.state === 'zurueck' ? '#3b82f6' : '#f97316';
        const emoji = d.state === 'frei' ? '🟢' : d.state === 'zurueck' ? '🔵' : '🚴';
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:13px;color:white;font-weight:700;">${emoji}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const popup = `<b>${d.name}</b><br/>${
          d.state === 'unterwegs' && d.stopCount
            ? `${d.doneCount ?? 0}/${d.stopCount} Stopps`
            : d.state === 'frei'
            ? 'Frei'
            : 'Kommt zurück'
        }`;
        L.marker([d.lat, d.lng], { icon }).addTo(map).bindPopup(popup);
      }

      // Order markers
      for (const o of orders) {
        if (!o.lat || !o.lng) continue;
        allLatLngs.push([o.lat, o.lng]);
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${o.done ? '#6b7280' : '#d4a843'};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);font-size:10px;font-weight:700;color:${o.done ? 'white' : '#0d1f16'};">${o.done ? '✓' : o.seq}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker([o.lat, o.lng], { icon }).addTo(map).bindPopup(o.name);
      }

      // Unassigned ready order markers (orange/red !)
      for (const u of (unassigned ?? [])) {
        if (!u.lat || !u.lng) continue;
        allLatLngs.push([u.lat, u.lng]);
        const urgent = (u.waitMin ?? 0) >= 10;
        const bg = urgent ? '#ef4444' : '#f97316';
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:${bg};border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,.4);font-size:12px;font-weight:900;color:white;">!</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const popup = `<b>${u.name}</b>${u.zone ? `<br/>Zone ${u.zone}` : ''}${u.waitMin != null ? `<br/>${u.waitMin} Min bereit` : ''}`;
        L.marker([u.lat, u.lng], { icon }).addTo(map).bindPopup(popup);
      }

      if (allLatLngs.length > 1) {
        map.fitBounds(allLatLngs, { padding: [30, 30] });
      }

      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update driver markers on position change (separate effect)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !ready) return;
    // Simple approach: refit bounds when drivers update
    const allLatLngs: [number, number][] = drivers.map((d) => [d.lat, d.lng]);
    if (restaurantLat && restaurantLng) allLatLngs.push([restaurantLat, restaurantLng]);
    if (allLatLngs.length > 1) {
      map.fitBounds(allLatLngs, { padding: [30, 30], maxZoom: 15 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers.map((d) => `${d.lat},${d.lng}`).join('|'), ready]);

  return (
    <div ref={mapRef} className="w-full h-full" />
  );
}
