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

export type DriverTrail = {
  driverId: string;
  points: Array<{ lat: number; lng: number }>;
};

export type HotspotMarker = {
  id: string;
  lat: number;
  lng: number;
  radius_km: number;
  demand_score: number;
  order_count: number;
  peak_hour: number | null;
  label: string | null;
};

export function DispatchDriverMap({
  drivers,
  orders,
  unassigned,
  restaurantLat,
  restaurantLng,
  trails,
  hotspots,
  showHotspots,
}: {
  drivers: DriverMarker[];
  orders: OrderMarker[];
  unassigned?: UnassignedMarker[];
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  trails?: DriverTrail[];
  hotspots?: HotspotMarker[];
  showHotspots?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trailLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hotspotLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      leafletRef.current = L;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await import('leaflet/dist/leaflet.css' as any).catch(() => {});
      if (cancelled || !mapRef.current) return;

      // Determine center: prefer restaurant coords, fall back to first driver
      const centerLat = restaurantLat ?? drivers[0]?.lat ?? 48.137;
      const centerLng = restaurantLng ?? drivers[0]?.lng ?? 11.575;

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

      // Trail-Polylinien für Fahrerspuren
      const trailLayer = L.layerGroup().addTo(map);
      trailLayerRef.current = trailLayer;
      const TRAIL_COLORS: Record<string, string> = {
        frei: '#22c55e', unterwegs: '#f97316', zurueck: '#3b82f6',
      };
      for (const t of (trails ?? [])) {
        if (t.points.length < 2) continue;
        const driver = drivers.find((d) => d.id === t.driverId);
        const color = driver ? (TRAIL_COLORS[driver.state] ?? '#94a3b8') : '#94a3b8';
        const latlngs = t.points.map((p) => [p.lat, p.lng] as [number, number]);
        L.polyline(latlngs, { color, weight: 3, opacity: 0.55, dashArray: '5,4' }).addTo(trailLayer);
      }

      // Hotspot-Kreise (Geo-Cluster Demand-Zonen)
      const hotspotLayer = L.layerGroup().addTo(map);
      hotspotLayerRef.current = hotspotLayer;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    if (!map || !ready) return;
    const allLatLngs: [number, number][] = drivers.map((d) => [d.lat, d.lng]);
    if (restaurantLat && restaurantLng) allLatLngs.push([restaurantLat, restaurantLng]);
    if (allLatLngs.length > 1) {
      map.fitBounds(allLatLngs, { padding: [30, 30], maxZoom: 15 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers.map((d) => `${d.lat},${d.lng}`).join('|'), ready]);

  // Trail-Polylinien aktualisieren wenn neue GPS-Spuren eintreffen
  useEffect(() => {
    const trailLayer = trailLayerRef.current;
    const L = leafletRef.current;
    if (!trailLayer || !L || !ready) return;
    trailLayer.clearLayers();
    const TRAIL_COLORS: Record<string, string> = {
      frei: '#22c55e', unterwegs: '#f97316', zurueck: '#3b82f6',
    };
    for (const t of (trails ?? [])) {
      if (t.points.length < 2) continue;
      const driver = drivers.find((d) => d.id === t.driverId);
      const color = driver ? (TRAIL_COLORS[driver.state] ?? '#94a3b8') : '#94a3b8';
      const latlngs = t.points.map((p) => [p.lat, p.lng] as [number, number]);
      L.polyline(latlngs, { color, weight: 3, opacity: 0.55, dashArray: '5,4' }).addTo(trailLayer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(trails ?? []).map((t) => `${t.driverId}:${t.points.length}`).join('|'), ready]);

  // Hotspot-Kreise aktualisieren
  useEffect(() => {
    const layer = hotspotLayerRef.current;
    const L = leafletRef.current;
    if (!layer || !L || !ready) return;
    layer.clearLayers();
    if (!showHotspots) return;
    for (const h of (hotspots ?? [])) {
      const score = h.demand_score;
      const color = score >= 80 ? '#ef4444' : score >= 60 ? '#f97316' : score >= 40 ? '#f59e0b' : '#22c55e';
      const radiusM = Math.max(h.radius_km * 1000, 300);
      const circle = L.circle([h.lat, h.lng], {
        radius: radiusM,
        color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 2,
        opacity: 0.5,
        dashArray: '6,4',
      }).addTo(layer);
      const peakLabel = h.peak_hour !== null ? ` · Spitze ${h.peak_hour}:00 Uhr` : '';
      circle.bindPopup(
        `<b>${h.label ?? `Hotspot #${h.id.slice(0, 4)}`}</b><br/>` +
        `Score: <b>${Math.round(score)}</b>${peakLabel}<br/>` +
        `${h.order_count} Bestellungen analysiert`,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(hotspots ?? []).map((h) => h.id).join(','), showHotspots, ready]);

  return (
    <div ref={mapRef} className="w-full h-full" />
  );
}
