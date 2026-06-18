'use client';

/**
 * RealtimeGpsDashboard — Phase 247
 * Self-fetching live-GPS-Übersicht aller aktiven Fahrer + Touren auf einer Leaflet-Karte.
 * Pollt alle 10s /api/delivery/tours?state=active und aktualisiert Marker und Routen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import {
  Navigation2, RefreshCw, Wifi, WifiOff, Truck, MapPin, Clock, CheckCircle2,
} from 'lucide-react';

// ── Typen ──────────────────────────────────────────────────────────────────────

interface Stop {
  id: string;
  order_id: string;
  type: string;
  sequence: number;
  lat: number | null;
  lng: number | null;
  address: string | null;
  order: { id: string; bestellnummer: string; status: string; eta_earliest: string | null; eta_latest: string | null } | null;
}

interface Driver {
  id: string;
  name: string;
  vehicle: string | null;
  last_lat: number | null;
  last_lng: number | null;
  state: string;
}

interface Tour {
  id: string;
  state: string;
  zone: string | null;
  dispatch_score: number | null;
  total_eta_min: number | null;
  stop_count: number;
  created_at: string;
  driver: Driver | null;
  stops: Stop[];
}

// ── Leaflet-Karte (dynamisch geladen) ─────────────────────────────────────────

interface MapProps {
  tours: Tour[];
  restaurantLat?: number | null;
  restaurantLng?: number | null;
}

function GpsTourMapInner({ tours, restaurantLat, restaurantLng }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerGroupRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Initiale Karte einmalig erstellen
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await import('leaflet/dist/leaflet.css' as any).catch(() => {});
      if (cancelled || !mapRef.current) return;
      leafletRef.current = L;

      const centerLat = restaurantLat ?? tours.find(t => t.driver?.last_lat)?.driver?.last_lat ?? 48.137;
      const centerLng = restaurantLng ?? tours.find(t => t.driver?.last_lng)?.driver?.last_lng ?? 11.575;

      const map = L.map(mapRef.current, { zoomControl: true }).setView([centerLat, centerLng], 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
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

  // Marker + Routen bei jedem Datensatz-Update neu zeichnen
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    const layer = layerGroupRef.current;
    if (!map || !L || !layer || !ready) return;

    layer.clearLayers();

    const allLatLngs: [number, number][] = [];

    // Restaurant-Marker
    if (restaurantLat && restaurantLng) {
      allLatLngs.push([restaurantLat, restaurantLng]);
      L.marker([restaurantLat, restaurantLng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#0d1f16;border:2px solid #d4a843;font-size:14px;">🏠</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(layer).bindPopup('Restaurant');
    }

    // Fahrerzuordnung Farbe
    const TOUR_COLORS = ['#f97316', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];

    tours.forEach((tour, idx) => {
      const color = TOUR_COLORS[idx % TOUR_COLORS.length];
      const driver = tour.driver;

      // Fahrer-GPS-Marker
      if (driver?.last_lat && driver.last_lng) {
        allLatLngs.push([driver.last_lat, driver.last_lng]);
        const emoji = driver.vehicle === 'auto' ? '🚗' : driver.vehicle === 'elektro' ? '⚡' : '🚴';
        L.marker([driver.last_lat, driver.last_lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:14px;">${emoji}</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
        })
          .addTo(layer)
          .bindPopup(
            `<b>${driver.name}</b><br/>` +
            `${tour.stop_count} Stopps · Zone ${tour.zone ?? '–'}<br/>` +
            `Score: ${tour.dispatch_score ?? '–'}`,
          );
      }

      // Stopp-Marker + Route als Polylinie
      const routePoints: [number, number][] = [];
      if (driver?.last_lat && driver.last_lng) {
        routePoints.push([driver.last_lat, driver.last_lng]);
      }

      const sortedStops = [...tour.stops].sort((a, b) => a.sequence - b.sequence);
      sortedStops.forEach((stop) => {
        if (!stop.lat || !stop.lng) return;
        const latLng: [number, number] = [stop.lat, stop.lng];
        allLatLngs.push(latLng);
        routePoints.push(latLng);

        const isDone = stop.order?.status === 'geliefert';
        L.marker(latLng, {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${isDone ? '#6b7280' : color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);font-size:10px;font-weight:900;color:white;">${isDone ? '✓' : stop.sequence}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        })
          .addTo(layer)
          .bindPopup(`<b>#${stop.order?.bestellnummer ?? stop.order_id.slice(0, 6)}</b><br/>${stop.address ?? 'Adresse unbekannt'}`);
      });

      // Routenlinie
      if (routePoints.length >= 2) {
        L.polyline(routePoints, {
          color,
          weight: 2.5,
          opacity: 0.65,
          dashArray: '6,4',
        }).addTo(layer);
      }
    });

    // Bounds anpassen
    if (allLatLngs.length > 1) {
      try {
        map.fitBounds(allLatLngs, { padding: [30, 30], maxZoom: 16 });
      } catch {
        // ignore
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(tours.map(t => `${t.id}:${t.driver?.last_lat},${t.driver?.last_lng}`))]);

  return <div ref={mapRef} className="w-full h-full" suppressHydrationWarning />;
}

const GpsTourMap = dynamic(
  () => Promise.resolve(GpsTourMapInner),
  { ssr: false, loading: () => <div className="w-full h-full bg-muted/20 animate-pulse rounded-b-xl" /> },
);

// ── Driver-Status-Zeile ────────────────────────────────────────────────────────

function DriverRow({ tour, color }: { tour: Tour; color: string }) {
  const d = tour.driver;
  if (!d) return null;

  const completed = tour.stops.filter(s => s.order?.status === 'geliefert').length;
  const total = tour.stops.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isLate = tour.total_eta_min != null && tour.total_eta_min > 60;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div
        className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-black text-white"
        style={{ background: color }}
      >
        {d.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold truncate">{d.name}</span>
          {tour.zone && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted font-bold shrink-0">
              Zone {tour.zone}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground shrink-0">{completed}/{total}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        {tour.dispatch_score != null && (
          <div className={cn(
            'text-[10px] font-black tabular-nums',
            tour.dispatch_score >= 80 ? 'text-matcha-600' : tour.dispatch_score >= 60 ? 'text-amber-600' : 'text-red-500',
          )}>
            {tour.dispatch_score}
          </div>
        )}
        {tour.total_eta_min != null && (
          <div className={cn('text-[9px] font-mono', isLate ? 'text-red-500' : 'text-muted-foreground')}>
            {tour.total_eta_min}m ETA
          </div>
        )}
      </div>
    </div>
  );
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────

interface Props {
  locationId: string;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
}

const TOUR_COLORS = ['#f97316', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];

export function RealtimeGpsDashboard({ locationId, restaurantLat, restaurantLng }: Props) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  const [mapOpen, setMapOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/tours?location_id=${locationId}&state=active`);
      if (!res.ok) throw new Error('API-Fehler');
      const data = await res.json() as { tours?: Tour[] };
      setTours(data.tours ?? []);
      setOnline(true);
      setLastUpdate(new Date());
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  // Auto-Refresh alle 10s
  useEffect(() => {
    const iv = setInterval(() => void load(), 10_000);
    return () => clearInterval(iv);
  }, [load]);

  const activeTours = tours.filter(t => t.state !== 'completed');
  const totalStops = activeTours.reduce((s, t) => s + t.stop_count, 0);
  const completedStops = activeTours.reduce((s, t) => s + t.stops.filter(st => st.order?.status === 'geliefert').length, 0);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-matcha-800">
          <Navigation2 className="h-4 w-4 text-matcha-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Echtzeit GPS
          </div>
          {lastUpdate && (
            <div className="text-[10px] text-muted-foreground">
              Aktualisiert {lastUpdate.toLocaleTimeString('de-DE')} · Auto-Refresh 10s
            </div>
          )}
        </div>

        {/* KPI-Badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <Truck className="h-3 w-3 text-matcha-500" />
            <span className="text-[10px] font-bold">{activeTours.length} Touren</span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <MapPin className="h-3 w-3 text-blue-500" />
            <span className="text-[10px] font-bold">{completedStops}/{totalStops} Stopps</span>
          </div>
          <div className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5',
            online ? 'bg-matcha-100 text-matcha-700' : 'bg-red-100 text-red-700',
          )}>
            {online
              ? <Wifi className="h-3 w-3" />
              : <WifiOff className="h-3 w-3" />}
            <span className="text-[10px] font-bold">{online ? 'Live' : 'Offline'}</span>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-1 rounded-lg hover:bg-muted transition"
            title="Aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setMapOpen(o => !o)}
            className="text-[10px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition"
          >
            {mapOpen ? 'Karte▲' : 'Karte▼'}
          </button>
        </div>
      </div>

      {/* Leaflet-Karte */}
      {mapOpen && (
        <div style={{ height: 340 }}>
          {loading && !tours.length ? (
            <div className="w-full h-full bg-muted/20 animate-pulse flex items-center justify-center text-xs text-muted-foreground">
              GPS-Daten laden…
            </div>
          ) : activeTours.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-matcha-500" />
              Keine aktiven Touren
            </div>
          ) : (
            <GpsTourMap
              tours={activeTours}
              restaurantLat={restaurantLat}
              restaurantLng={restaurantLng}
            />
          )}
        </div>
      )}

      {/* Fahrer-Liste */}
      {activeTours.length > 0 && (
        <div className="px-4 py-2">
          {activeTours.map((tour, idx) => (
            <DriverRow key={tour.id} tour={tour} color={TOUR_COLORS[idx % TOUR_COLORS.length]} />
          ))}
        </div>
      )}

      {/* Legende */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-muted/30">
        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground">
          Fahrer GPS wird direkt von der API abgerufen · Pollingintervall: 10 Sek.
        </span>
      </div>
    </div>
  );
}
