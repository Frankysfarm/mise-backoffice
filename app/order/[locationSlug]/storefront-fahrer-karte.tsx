'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bike, Clock, MapPin, Navigation, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverState {
  name: string | null;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  etaMin: number | null;
  distanceM: number | null;
}

interface Props {
  orderId: string;
  destLat?: number | null;
  destLng?: number | null;
  destAdresse?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  className?: string;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function LiveMiniMap({
  driverLat, driverLng, heading, destLat, destLng,
}: {
  driverLat: number; driverLng: number; heading: number | null;
  destLat: number | null; destLng: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-leaflet', '1');
        document.head.appendChild(link);
      }
      if (cancelled || !containerRef.current) return;

      const center = [driverLat, driverLng] as [number, number];
      const map = L.map(containerRef.current, {
        center,
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      mapRef.current = map;

      const deg = heading ?? 0;
      const driverIcon = L.divIcon({
        html: `<div style="position:relative;width:40px;height:40px">
          <div style="position:absolute;inset:0;border-radius:50%;background:#22c55e;opacity:.2;animation:ping 2s infinite"></div>
          <div style="position:absolute;inset:8px;border-radius:50%;background:#16a34a;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:12px">🛵</div>
          ${heading != null ? `<div style="position:absolute;top:-4px;left:50%;transform:translateX(-50%) rotate(${deg}deg) translateY(-4px);width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:8px solid #22c55e"></div>` : ''}
          <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>
        </div>`,
        className: '', iconSize: [40, 40], iconAnchor: [20, 20],
      });
      markerRef.current = L.marker(center, { icon: driverIcon }).addTo(map);

      if (destLat != null && destLng != null) {
        const destIcon = L.divIcon({
          html: `<div style="font-size:20px;line-height:1">📍</div>`,
          className: '', iconSize: [24, 24], iconAnchor: [12, 24],
        });
        L.marker([destLat, destLng], { icon: destIcon }).addTo(map);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const pos = [driverLat, driverLng] as [number, number];
    markerRef.current.setLatLng(pos);
    mapRef.current.panTo(pos, { animate: true, duration: 0.5 });
  }, [driverLat, driverLng]);

  return <div ref={containerRef} className="h-full w-full" />;
}

export function StorefrontFahrerKarte({
  orderId, destLat, destLng, destAdresse, locationLat, locationLng, className,
}: Props) {
  const [driver, setDriver] = useState<DriverState | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchState = useCallback(async () => {
    const { data: order } = await supabase
      .from('customer_orders')
      .select('status,fahrer_id,fahrer_vorname,fahrer_lat,fahrer_lng,fahrer_heading,geschaetzte_lieferung_min')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) { setLoading(false); return; }
    setOrderStatus(order.status as string);

    if (order.fahrer_id && (order.fahrer_lat as number | null) != null && (order.fahrer_lng as number | null) != null) {
      const fLat = order.fahrer_lat as number;
      const fLng = order.fahrer_lng as number;
      const distM = (destLat != null && destLng != null) ? haversineM(fLat, fLng, destLat, destLng) : null;
      setDriver({
        name: order.fahrer_vorname as string | null,
        lat: fLat, lng: fLng,
        heading: order.fahrer_heading as number | null,
        etaMin: order.geschaetzte_lieferung_min as number | null,
        distanceM: distM,
      });
    } else {
      setDriver(null);
    }
    setLoading(false);
  }, [orderId, destLat, destLng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchState();
    const ch = supabase
      .channel(`sf-driver-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` }, fetchState)
      .subscribe();
    const iv = setInterval(fetchState, 30_000);
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, [fetchState, orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className={cn('rounded-2xl border border-gray-200 bg-gray-50 h-16 flex items-center justify-center', className)}>
        <Loader2 size={16} className="text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!driver || !['fertig', 'unterwegs'].includes(orderStatus ?? '')) return null;

  const showMap = driver.lat != null && driver.lng != null;

  return (
    <div className={cn('rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm', className)}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50">
          <Bike size={16} className="text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-900">
            {driver.name ? `${driver.name} ist unterwegs` : 'Fahrer ist unterwegs'}
          </div>
          {driver.etaMin != null && (
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <Clock size={9} />
              ca. {driver.etaMin} Min.
              {driver.distanceM != null && (
                <span className="ml-1 flex items-center gap-0.5">
                  <Navigation size={9} />
                  {driver.distanceM < 1000 ? `${driver.distanceM} m` : `${(driver.distanceM / 1000).toFixed(1)} km`}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
      </div>

      {showMap && (
        <div className="h-48">
          <LiveMiniMap
            driverLat={driver.lat!}
            driverLng={driver.lng!}
            heading={driver.heading}
            destLat={destLat ?? null}
            destLng={destLng ?? null}
          />
        </div>
      )}

      {destAdresse && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500">
          <MapPin size={10} className="text-gray-400 shrink-0" />
          {destAdresse}
        </div>
      )}
    </div>
  );
}
