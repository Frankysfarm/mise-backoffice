'use client';

import { useEffect, useRef } from 'react';
import type { Map as LMap, Marker as LMarker } from 'leaflet';

type Drv = { id: string; name: string; lat: number | null; lng: number | null; returning?: boolean; busy?: boolean };

export default function MapView({ shopLat, shopLng, shopName, drivers }: {
  shopLat: number | null; shopLng: number | null; shopName: string; drivers: Drv[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markersRef = useRef<globalThis.Map<string, LMarker>>(new globalThis.Map());
  const LRef = useRef<typeof import('leaflet') | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      LRef.current = L;
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-leaflet', '1'); document.head.appendChild(link);
      }
      if (cancelled || !containerRef.current || mapRef.current) return;
      const center: [number, number] = [shopLat ?? 50.7766, shopLng ?? 6.0834];
      const map = L.map(containerRef.current, { zoomControl: true }).setView(center, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      if (shopLat != null && shopLng != null) {
        L.marker([shopLat, shopLng], { icon: L.divIcon({ className: '', html: '<div style="font-size:26px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))">🍕</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(map).bindPopup(shopName);
      }
      mapRef.current = map;
      render();
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } markersRef.current.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { render(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [drivers]);

  function render() {
    const L = LRef.current; const map = mapRef.current; if (!L || !map) return;
    const seen = new Set<string>();
    for (const d of drivers) {
      if (d.lat == null || d.lng == null) continue;
      seen.add(d.id);
      const color = d.returning ? '#12B85C' : d.busy ? '#FF8A3D' : '#5AB0FF';
      const html = `<div style="display:flex;align-items:center;gap:4px;background:${color};color:#06120c;font-weight:800;font-size:12px;padding:3px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5);border:2px solid #fff">🚗 ${d.name}</div>`;
      const existing = markersRef.current.get(d.id);
      if (existing) { existing.setLatLng([d.lat, d.lng]); existing.setIcon(L.divIcon({ className: '', html, iconSize: [90, 26], iconAnchor: [45, 13] })); }
      else { const m = L.marker([d.lat, d.lng], { icon: L.divIcon({ className: '', html, iconSize: [90, 26], iconAnchor: [45, 13] }) }).addTo(map); markersRef.current.set(d.id, m); }
    }
    for (const [id, m] of markersRef.current) { if (!seen.has(id)) { map.removeLayer(m); markersRef.current.delete(id); } }
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: 16 }} />;
}
