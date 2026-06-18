'use client';

import { useEffect, useRef } from 'react';

// ── Typen ──────────────────────────────────────────────────────────────────────

interface HeatmapPoint { lat: number; lng: number; weight: number; zone: string | null }
interface LiveDriverPoint { driverId: string; driverName: string; lat: number; lng: number; status: string; zone: string | null }

export interface LeafletGeoHeatmapProps {
  points: HeatmapPoint[];
  drivers?: LiveDriverPoint[];
  maxWeight: number;
  height?: number;
}

// ── Komponente ─────────────────────────────────────────────────────────────────

export function LeafletGeoHeatmap({ points, drivers = [], maxWeight, height }: LeafletGeoHeatmapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const layerGroupRef = useRef<import('leaflet').LayerGroup | null>(null);

  // ── Karte initialisieren ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // bereits initialisiert

    Promise.all([
      import('leaflet'),
      // @ts-expect-error CSS-Import ohne Typ-Declaration
      import('leaflet/dist/leaflet.css'),
    ]).then(([L]) => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [52.52, 13.4],
        zoom: 12,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      layerGroupRef.current = layerGroup;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // ── Marker aktualisieren wenn Props sich ändern ─────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const timer = setTimeout(() => {
      const map = mapInstanceRef.current;
      const layerGroup = layerGroupRef.current;
      if (!map || !layerGroup) return;

      import('leaflet').then((L) => {
        // Alle vorherigen Marker entfernen
        layerGroup.clearLayers();

        const boundsPoints: [number, number][] = [];

        // Bestellpunkte als CircleMarker
        for (const p of points) {
          const ratio = maxWeight > 0 ? p.weight / maxWeight : 0;
          const radius = 6 + ratio * 14;
          const opacity = 0.3 + ratio * 0.6;
          const color =
            ratio >= 0.8 ? '#ef4444' :
            ratio >= 0.5 ? '#f97316' :
            ratio >= 0.3 ? '#eab308' :
            '#4ade80';

          const marker = L.circleMarker([p.lat, p.lng], {
            radius,
            fillColor: color,
            fillOpacity: opacity,
            color: color,
            weight: 1,
            opacity: opacity,
          }).bindPopup(`Gewicht: ${p.weight} · Zone: ${p.zone ?? 'unbekannt'}`);

          layerGroup.addLayer(marker);
          boundsPoints.push([p.lat, p.lng]);
        }

        // Fahrerpositionen als CircleMarker
        for (const d of drivers) {
          const marker = L.circleMarker([d.lat, d.lng], {
            radius: 8,
            fillColor: '#6366f1',
            fillOpacity: 0.9,
            color: 'white',
            weight: 2,
            opacity: 1,
          }).bindPopup(`${d.driverName} · Status: ${d.status}`);

          layerGroup.addLayer(marker);
          boundsPoints.push([d.lat, d.lng]);
        }

        // Bounds anpassen
        if (boundsPoints.length > 0) {
          try {
            map.fitBounds(L.latLngBounds(boundsPoints), { padding: [20, 20] });
          } catch {
            map.setView([52.52, 13.4], 12);
          }
        } else {
          map.setView([52.52, 13.4], 12);
        }
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [points, drivers, maxWeight]);

  return (
    <div
      ref={mapContainerRef}
      suppressHydrationWarning
      style={{ height: height ?? 380 }}
      className="w-full rounded-xl border overflow-hidden"
    />
  );
}
