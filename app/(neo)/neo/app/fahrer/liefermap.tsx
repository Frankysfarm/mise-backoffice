'use client';
import { useEffect, useRef, useState } from 'react';
import { saveLocationCenter } from './actions';

type Zone = { id: string; radius_km_bis: number; aktiv: boolean };
const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
const DE_CENTER = { lat: 51.1657, lng: 10.4515 };

// Leaflet einmalig vom CDN laden
function loadLeaflet(): Promise<any> {
  return new Promise((resolve) => {
    const w = window as any;
    if (w.L) return resolve(w.L);
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link');
      css.id = 'leaflet-css'; css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }
    const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', () => resolve(w.L)); return; }
    const s = document.createElement('script');
    s.id = 'leaflet-js'; s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve(w.L);
    document.body.appendChild(s);
  });
}

export function LieferMap({ center, address, zones }: { center: { lat: number | null; lng: number | null }; address: string; zones: Zone[] }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);
  const LRef = useRef<any>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number }>(center.lat != null && center.lng != null ? { lat: center.lat, lng: center.lng } : DE_CENTER);
  const [hasCenter, setHasCenter] = useState(center.lat != null && center.lng != null);
  const [areaName, setAreaName] = useState(address || '');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<'' | 'saving' | 'saved'>('');
  const [searching, setSearching] = useState(false);

  const maxKm = Math.max(1, ...zones.filter((z) => z.aktiv).map((z) => Number(z.radius_km_bis) || 0));

  async function persist(lat: number, lng: number) {
    setSaving('saving');
    const r = await saveLocationCenter(lat, lng).catch(() => ({ ok: false }));
    setSaving(r?.ok ? 'saved' : '');
    if (r?.ok) setTimeout(() => setSaving(''), 1500);
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`);
      const j = await res.json();
      const a = j.address || {};
      const parts = [a.road, a.suburb || a.city_district, a.city || a.town || a.village].filter(Boolean);
      setAreaName(parts.join(', ') || j.display_name || '');
    } catch { /* ignore */ }
  }

  // Init
  useEffect(() => {
    let alive = true;
    loadLeaflet().then((L) => {
      if (!alive || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapEl.current, { zoomControl: true, scrollWheelZoom: false }).setView([pos.lat, pos.lng], hasCenter ? 13 : 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
      const marker = L.marker([pos.lat, pos.lng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        const p = { lat: ll.lat, lng: ll.lng };
        setPos(p); setHasCenter(true);
        drawCircles(p);
        persist(p.lat, p.lng); reverseGeocode(p.lat, p.lng);
      });
      mapRef.current = map; markerRef.current = marker;
      drawCircles(pos);
      if (hasCenter) reverseGeocode(pos.lat, pos.lng);
      setTimeout(() => map.invalidateSize(), 200);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawCircles(p: { lat: number; lng: number }) {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;
    circlesRef.current.forEach((c) => map.removeLayer(c));
    circlesRef.current = [];
    const sorted = [...zones].filter((z) => z.aktiv).sort((a, b) => Number(b.radius_km_bis) - Number(a.radius_km_bis));
    sorted.forEach((z, i) => {
      const col = COLORS[(zones.filter((x) => x.aktiv).length - 1 - i) % COLORS.length];
      const c = L.circle([p.lat, p.lng], { radius: (Number(z.radius_km_bis) || 0) * 1000, color: col, weight: 2, fillColor: col, fillOpacity: 0.08 }).addTo(map);
      circlesRef.current.push(c);
    });
    if (sorted.length && hasCenter) {
      const big = L.circle([p.lat, p.lng], { radius: maxKm * 1000 }).getBounds();
      try { map.fitBounds(big, { padding: [20, 20], maxZoom: 14 }); } catch { /* */ }
    }
  }

  // Radiusänderungen (Zonen-Prop ändert sich nach Server-Refresh) → Kreise neu zeichnen
  useEffect(() => { drawCircles(pos); /* eslint-disable-next-line */ }, [JSON.stringify(zones.map((z) => [z.radius_km_bis, z.aktiv]))]);

  async function doSearch() {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(search)}`);
      const j = await res.json();
      if (j[0]) {
        const p = { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
        setPos(p); setHasCenter(true);
        mapRef.current?.setView([p.lat, p.lng], 14);
        markerRef.current?.setLatLng([p.lat, p.lng]);
        drawCircles(p); persist(p.lat, p.lng); reverseGeocode(p.lat, p.lng);
      }
    } finally { setSearching(false); }
  }

  return (
    <div style={{ padding: 16, background: '#FAFBFC', borderRight: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} placeholder="Adresse suchen (z. B. Pontstr. 1, Aachen)" style={{ flex: 1, height: 38, border: '1.5px solid #E2E8F0', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#0F172A' }} />
        <button onClick={doSearch} disabled={searching} style={{ height: 38, padding: '0 14px', borderRadius: 9, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{searching ? '…' : 'Suchen'}</button>
      </div>
      <div ref={mapEl} style={{ width: '100%', height: 300, borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', background: '#E5E7EB', zIndex: 1 }} />
      <div style={{ marginTop: 10, fontSize: 12.5, color: '#475569' }}>
        {!hasCenter && <div style={{ color: '#B45309', fontWeight: 600 }}>📍 Noch kein Standort gesetzt — Adresse suchen oder Marker ziehen.</div>}
        {hasCenter && <>
          <div style={{ fontWeight: 700, color: '#0F172A' }}>📍 {areaName || 'Standort gesetzt'}</div>
          <div style={{ marginTop: 3 }}>Liefergebiet bis <b>{maxKm} km</b> · {zones.filter((z) => z.aktiv).length} aktive Zonen · Marker ziehen zum Verschieben</div>
        </>}
        {saving === 'saving' && <div style={{ color: '#94A3B8', marginTop: 4 }}>Speichert Standort…</div>}
        {saving === 'saved' && <div style={{ color: '#047857', marginTop: 4 }}>✓ Standort gespeichert</div>}
      </div>
    </div>
  );
}
