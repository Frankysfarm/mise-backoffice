'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navigation, MapPin, Banknote, CreditCard, Check, CheckCircle2, Loader2, Phone, ArrowRight, Map, Flag } from 'lucide-react';
import { euro, cn } from '@/lib/utils';

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  distanz_zum_vorgaenger_m: number | null;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_telefon?: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  };
};

export function DeliveryView({
  batchId,
  stops: initialStops,
  batchStartedAt,
  totalEtaMin,
  gpsSpeed,
  driverLat,
  driverLng,
  onAllDone,
}: {
  batchId: string;
  stops: Stop[];
  batchStartedAt?: string | null;
  totalEtaMin?: number | null;
  gpsSpeed?: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
  onAllDone: () => void;
}) {
  const supabase = createClient();
  const [stops, setStops] = useState(initialStops);
  const [pending, setPending] = useState<string | null>(null);
  const [arrivedIds, setArrivedIds] = useState<Set<string>>(new Set());
  const [proximityTriggered, setProximityTriggered] = useState<Set<string>>(new Set());
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const driverMarkerRef = useRef<any>(null);
  const leafletMapRef = useRef<any>(null);
  const mountedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - mountedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime: sync stop state from other devices / tabs
  useEffect(() => {
    const channel = supabase
      .channel(`delivery-view-${batchId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'delivery_batch_stops',
        filter: `batch_id=eq.${batchId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as any;
        setStops((xs) =>
          xs.map((x) =>
            x.id === row.id
              ? { ...x, geliefert_am: row.geliefert_am ?? x.geliefert_am, angekommen_am: row.angekommen_am ?? x.angekommen_am }
              : x
          )
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // Sort: nicht-geliefert zuerst nach reihenfolge, dann geliefert
  const sorted = [...stops].sort((a, b) => {
    const aDone = a.geliefert_am ? 1 : 0;
    const bDone = b.geliefert_am ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return a.reihenfolge - b.reihenfolge;
  });

  const openStops = sorted.filter((s) => !s.geliefert_am);
  const doneCount = sorted.length - openStops.length;
  const nextStop = openStops[0];
  const allDone = openStops.length === 0;

  // GPS-Proximity: Auto-Arrived wenn Fahrer < 80m vom nächsten Stopp
  useEffect(() => {
    if (driverLat == null || driverLng == null || !nextStop) return;
    const destLat = nextStop.order.kunde_lat;
    const destLng = nextStop.order.kunde_lng;
    if (!destLat || !destLng) return;
    if (proximityTriggered.has(nextStop.id)) return;
    if (arrivedIds.has(nextStop.id) || nextStop.angekommen_am) return;

    const R = 6371000;
    const dLat = ((destLat - driverLat) * Math.PI) / 180;
    const dLon = ((destLng - driverLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((driverLat * Math.PI) / 180) * Math.cos((destLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (distM < 80) {
      setProximityTriggered((s) => new Set([...s, nextStop.id]));
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 50, 200]);
      }
      markArrived(nextStop.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLat, driverLng, nextStop?.id]);

  // Leaflet-Map dynamisch laden
  useEffect(() => {
    if (!mapRef.current || mapReady) return;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css' as any).catch(() => {});

      const withCoords = stops.filter((s) => s.order.kunde_lat && s.order.kunde_lng);
      if (withCoords.length === 0) return;

      const centerLat = withCoords.reduce((s, x) => s + (x.order.kunde_lat ?? 0), 0) / withCoords.length;
      const centerLng = withCoords.reduce((s, x) => s + (x.order.kunde_lng ?? 0), 0) / withCoords.length;

      const map = L.map(mapRef.current!).setView([centerLat, centerLng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const latLngs: [number, number][] = [];
      withCoords.sort((a, b) => a.reihenfolge - b.reihenfolge).forEach((s, i) => {
        const lat = s.order.kunde_lat!;
        const lng = s.order.kunde_lng!;
        latLngs.push([lat, lng]);
        const isNext = s.id === nextStop?.id;
        const done = !!s.geliefert_am;
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:sans-serif;color:${
            done ? '#d4a843' : isNext ? '#0d1f16' : '#ffffff'
          };background:${
            done ? '#0d1f16' : isNext ? '#d4a843' : '#2d6b45'
          };border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${s.reihenfolge}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        L.marker([lat, lng], { icon }).addTo(map);
      });

      if (latLngs.length > 1) {
        L.polyline(latLngs, { color: '#d4a843', weight: 4, opacity: 0.7, dashArray: '6 8' }).addTo(map);
      }

      map.fitBounds(latLngs, { padding: [30, 30] });
      leafletMapRef.current = map;

      // Driver self-location marker (blauer Puls-Kreis)
      if (driverLat && driverLng) {
        const driverIcon = L.divIcon({
          className: '',
          html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map);
      }

      setMapReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live GPS-Marker-Update wenn Fahrer sich bewegt
  useEffect(() => {
    if (!leafletMapRef.current || driverLat == null || driverLng == null) return;
    (async () => {
      const L = (await import('leaflet')).default;
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([driverLat, driverLng]);
      } else {
        const driverIcon = L.divIcon({
          className: '',
          html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(leafletMapRef.current);
      }
    })();
  }, [driverLat, driverLng]);

  async function markArrived(stopId: string) {
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from('delivery_batch_stops').update({ angekommen_am: now }).eq('id', stopId),
      supabase.from('mise_delivery_batch_stops').update({ arrived_at: now }).eq('id', stopId),
    ]);
    setArrivedIds((s) => new Set([...s, stopId]));
    setStops((xs) => xs.map((x) => x.id === stopId ? { ...x, angekommen_am: now } : x));
  }

  async function markDelivered(stopId: string) {
    setPending(stopId);
    const now = new Date().toISOString();
    const stop = stops.find((s) => s.id === stopId);
    await Promise.all([
      supabase.from('delivery_batch_stops')
        .update({ geliefert_am: now, angekommen_am: now })
        .eq('id', stopId),
      supabase.from('mise_delivery_batch_stops')
        .update({ completed_at: now, arrived_at: now })
        .eq('id', stopId),
      stop?.order_id
        ? supabase.from('customer_orders')
            .update({ status: 'geliefert', geliefert_am: now })
            .eq('id', stop.order_id)
        : Promise.resolve(),
    ]);
    setPending(null);
    setStops((xs) => xs.map((x) => x.id === stopId ? { ...x, geliefert_am: now } : x));
    if (openStops.length === 1) setTimeout(() => onAllDone(), 800);
  }

  return (
    <div className="flex-1 flex flex-col bg-matcha-900">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">Lieferung läuft</div>
            <div className="font-display font-bold text-lg">
              {doneCount} / {stops.length} zugestellt
            </div>
            <div className="text-[10px] text-matcha-400 tabular-nums mt-0.5 flex items-center gap-2">
              <span>Unterwegs seit {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} Min</span>
              {gpsSpeed != null && gpsSpeed > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  gpsSpeed > 50 ? 'bg-red-500/30 text-red-300' :
                  gpsSpeed > 30 ? 'bg-amber-500/30 text-amber-200' :
                  'bg-accent/20 text-accent',
                )}>
                  {gpsSpeed} km/h
                </span>
              )}
            </div>
            {totalEtaMin != null && batchStartedAt && (() => {
              const etaMs = new Date(batchStartedAt).getTime() + totalEtaMin * 60_000;
              const secLeft = Math.floor((etaMs - Date.now()) / 1000);
              if (secLeft < -600 && doneCount < stops.length) return null;
              const finishStr = new Date(Math.max(etaMs, Date.now())).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className={cn(
                    'text-[10px] font-bold tabular-nums',
                    secLeft <= 0 && doneCount < stops.length ? 'text-amber-300' : 'text-matcha-500',
                  )}>
                    {doneCount === stops.length ? '✓ Tour abgeschlossen' : `Tour fertig ~${finishStr}`}
                  </span>
                  {doneCount < stops.length && secLeft > -600 && (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums',
                      secLeft <= 0 ? 'bg-amber-500/30 text-amber-200' :
                      secLeft < 300 ? 'bg-orange-500/30 text-orange-200' :
                      'bg-matcha-700 text-matcha-100',
                    )}>
                      {secLeft <= 0 ? 'Überfällig' : `noch ${Math.floor(secLeft / 60)}:${String(secLeft % 60).padStart(2, '0')}`}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex-1 h-1.5 bg-white/10 rounded-full ml-4 overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${(doneCount / stops.length) * 100}%` }} />
          </div>
        </div>
        {/* Tour-Kassen-Zusammenfassung */}
        {(() => {
          const cashStops = stops.filter((s) => !s.order.bezahlt || s.order.zahlungsart === 'bar');
          const totalCash = cashStops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          const totalAll = stops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          if (totalCash === 0) return null;
          return (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 px-3 py-1.5">
                <Banknote size={12} className="text-amber-300" />
                <span className="text-[11px] font-bold text-amber-200">Bar kassieren: {euro(totalCash)}</span>
              </div>
              <div className="text-[10px] text-matcha-400">Gesamt: {euro(totalAll)}</div>
            </div>
          );
        })()}
      </div>

      {/* Next-Stop-Hero: prominente Anzeige des nächsten Stops */}
      {nextStop && !allDone && (
        <div className="mx-4 mt-3 rounded-2xl bg-accent/10 border-2 border-accent/30 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-accent">Nächster Stopp</span>
            <span className={cn(
              'ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums',
              !nextStop.order.bezahlt || nextStop.order.zahlungsart === 'bar'
                ? 'bg-amber-400 text-matcha-900'
                : 'bg-matcha-700 text-matcha-50',
            )}>
              {!nextStop.order.bezahlt || nextStop.order.zahlungsart === 'bar'
                ? `BAR ${euro(nextStop.order.gesamtbetrag)}`
                : `Online ✓`}
            </span>
          </div>
          <div className="font-display text-xl font-black leading-tight">{nextStop.order.kunde_name}</div>
          <div className="mt-0.5 text-sm text-matcha-200 leading-tight">
            {nextStop.order.kunde_adresse}
            {nextStop.order.kunde_plz && `, ${nextStop.order.kunde_plz}`}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-matcha-300">
              <span className="h-5 w-5 rounded-full bg-accent text-matcha-900 flex items-center justify-center font-black text-[10px]">
                {nextStop.reihenfolge}
              </span>
              Stopp {nextStop.reihenfolge} von {stops.length}
            </span>
            {nextStop.distanz_zum_vorgaenger_m != null && nextStop.distanz_zum_vorgaenger_m > 0 && (
              <span className="text-matcha-300 font-mono">
                {(nextStop.distanz_zum_vorgaenger_m / 1000).toFixed(1)} km
              </span>
            )}
            {/* ETA für nächsten Stopp */}
            {batchStartedAt && totalEtaMin != null && (() => {
              const startMs = new Date(batchStartedAt).getTime();
              const etaMs = startMs + ((nextStop.reihenfolge / stops.length) * totalEtaMin * 60_000);
              const secLeft = Math.floor((etaMs - Date.now()) / 1000);
              const etaStr = new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              if (secLeft < -300) return null;
              return (
                <span className={cn(
                  'rounded-full px-2 py-0.5 font-bold',
                  secLeft < 0 ? 'bg-red-500/30 text-red-300' :
                  secLeft < 180 ? 'bg-amber-500/30 text-amber-200' :
                  'bg-white/10 text-matcha-200',
                )}>
                  ~{etaStr} Uhr
                </span>
              );
            })()}
          </div>
          {/* Live-ETA vom Server (eta_earliest aus DB) */}
          {nextStop.order.eta_earliest && (() => {
            const etaMs  = new Date(nextStop.order.eta_earliest).getTime();
            const etaStr = new Date(nextStop.order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const latestStr = nextStop.order.eta_latest
              ? new Date(nextStop.order.eta_latest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
              : null;
            const secLeft = Math.floor((etaMs - Date.now()) / 1000);
            const overdue = secLeft < 0;
            return (
              <div className={cn(
                'mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold',
                overdue
                  ? 'bg-red-500/30 text-red-200 animate-pulse'
                  : secLeft < 300
                    ? 'bg-amber-500/30 text-amber-200'
                    : 'bg-matcha-700/60 text-matcha-100',
              )}>
                <span>{overdue ? '⚠ ETA überzogen' : '🕐 ETA'}</span>
                <span className="tabular-nums font-mono">
                  {latestStr ? `${etaStr}–${latestStr}` : etaStr} Uhr
                </span>
                {!overdue && secLeft < 600 && (
                  <span className="tabular-nums">
                    (noch {Math.floor(secLeft / 60)}:{String(secLeft % 60).padStart(2, '0')})
                  </span>
                )}
              </div>
            );
          })()}

          {/* Direct navigation buttons for next stop */}
          {nextStop.order.kunde_lat && nextStop.order.kunde_lng && (() => {
            const lat = nextStop.order.kunde_lat!;
            const lng = nextStop.order.kunde_lng!;
            const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
            const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
            const appleUrl  = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
            const wazeUrl   = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
            return (
              <div className="mt-3 flex gap-2">
                <a
                  href={isIos ? appleUrl : googleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-accent text-matcha-900 font-bold text-sm transition active:scale-[0.98]"
                >
                  <Navigation size={14} />
                  {isIos ? 'Apple Maps' : 'Google Maps'}
                </a>
                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-[#33ccff]/20 border border-[#33ccff]/40 text-[#33ccff] font-bold text-sm transition active:scale-[0.98]"
                  title="In Waze öffnen"
                >
                  Waze
                </a>
              </div>
            );
          })()}
        </div>
      )}

      {/* Multi-Waypoint Navigation */}
      {openStops.length > 0 && (() => {
        const stopsWithCoords = openStops.filter((s) => s.order.kunde_lat && s.order.kunde_lng);
        if (stopsWithCoords.length === 0) return null;
        const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
        let mapsUrl: string;
        if (isIos && stopsWithCoords.length === 1) {
          mapsUrl = `maps://maps.apple.com/?daddr=${stopsWithCoords[0].order.kunde_lat},${stopsWithCoords[0].order.kunde_lng}&dirflg=d`;
        } else {
          // Google Maps Waypoints (works on all platforms)
          const coords = stopsWithCoords.map((s) => `${s.order.kunde_lat},${s.order.kunde_lng}`);
          const dest = coords[coords.length - 1];
          const waypoints = coords.slice(0, -1).join('|');
          mapsUrl = waypoints
            ? `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`
            : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
        }
        return (
          <div className="mx-4 mt-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold text-white transition"
            >
              <Map size={16} />
              {stopsWithCoords.length === 1 ? 'Navigieren' : `Alle ${stopsWithCoords.length} Stops in Maps`}
            </a>
          </div>
        );
      })()}

      {/* Map */}
      <div className="mx-4 mt-2 rounded-2xl overflow-hidden border border-white/10 relative" style={{ height: 240 }}>
        <div ref={mapRef} className="w-full h-full" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center text-matcha-300 text-sm">
            <Loader2 className="animate-spin mr-2" size={14} /> Karte lädt…
          </div>
        )}
        {/* Re-center button */}
        {mapReady && driverLat != null && driverLng != null && (
          <button
            onClick={() => {
              if (leafletMapRef.current && driverLat != null && driverLng != null) {
                leafletMapRef.current.setView([driverLat, driverLng], 15, { animate: true });
              }
            }}
            className="absolute bottom-2 right-2 z-[1000] h-9 w-9 rounded-xl bg-matcha-900/80 border border-white/20 text-white flex items-center justify-center backdrop-blur hover:bg-matcha-800/90 active:scale-95 transition"
            title="Zu meiner Position"
          >
            <Navigation size={16} className="text-accent" />
          </button>
        )}
      </div>

      {/* Stops — Restdistanz-Streifen */}
      {openStops.length > 0 && (() => {
        const remainDistM = openStops.reduce((s, st) => s + (st.distanz_zum_vorgaenger_m ?? 0), 0);
        const totalDistM = stops.reduce((s, st) => s + (st.distanz_zum_vorgaenger_m ?? 0), 0);
        if (remainDistM === 0) return null;
        return (
          <div className="mx-4 mt-1 flex items-center gap-3 text-[10px] text-matcha-300">
            <span className="font-bold text-matcha-100">{openStops.length} verbleibend</span>
            <span className="text-matcha-400">·</span>
            <span>~{(remainDistM / 1000).toFixed(1)} km</span>
            {totalDistM > 0 && (
              <>
                <span className="text-matcha-400">·</span>
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.max(0, ((totalDistM - remainDistM) / totalDistM) * 100)}%` }}
                  />
                </div>
                <span className="tabular-nums">{Math.round(((totalDistM - remainDistM) / totalDistM) * 100)}%</span>
              </>
            )}
          </div>
        );
      })()}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {sorted.map((stop) => {
          const done = !!stop.geliefert_am;
          const isNext = !done && stop.id === nextStop?.id;
          const isBar = !stop.order.bezahlt || stop.order.zahlungsart === 'bar';
          const amount = stop.order.gesamtbetrag;

          return (
            <div key={stop.id} className={cn(
              'rounded-2xl p-4 border-2 transition',
              done ? 'bg-white/5 border-white/10 opacity-50' :
              isNext ? 'bg-accent/10 border-accent shadow-xl shadow-accent/20' :
              'bg-white/5 border-white/10',
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  'h-12 w-12 rounded-xl grid place-items-center font-display font-black text-lg shrink-0',
                  done ? 'bg-matcha-700 text-accent' :
                  isNext ? 'bg-accent text-matcha-900' :
                  'bg-white/10 text-matcha-200',
                )}>
                  {done ? <Check size={20} /> : stop.reihenfolge}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold leading-tight">{stop.order.kunde_name}</div>
                  <div className="text-sm text-matcha-200 leading-tight">
                    {stop.order.kunde_adresse}
                    {stop.order.kunde_plz && `, ${stop.order.kunde_plz}`}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-matcha-300">
                    <span>#{stop.order.bestellnummer.replace(/^[A-Z]+-/, '')}</span>
                    {stop.distanz_zum_vorgaenger_m && stop.distanz_zum_vorgaenger_m > 0 && (
                      <span>· {(stop.distanz_zum_vorgaenger_m / 1000).toFixed(1)} km</span>
                    )}
                    {!done && (() => {
                      // Echte ETA aus DB bevorzugen
                      const etaMs = stop.order.eta_earliest
                        ? new Date(stop.order.eta_earliest).getTime()
                        : batchStartedAt && totalEtaMin != null
                          ? new Date(batchStartedAt).getTime() + ((stop.reihenfolge / stops.length) * totalEtaMin * 60_000)
                          : null;
                      if (!etaMs) return null;
                      const etaStr = new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                      const secLeft = Math.floor((etaMs - Date.now()) / 1000);
                      if (secLeft < -600) return null;
                      const isReal = !!stop.order.eta_earliest;
                      return (
                        <span className={cn(
                          'rounded-full px-1.5 py-0.5 font-bold',
                          secLeft < 0 ? 'bg-red-500/30 text-red-300' :
                          secLeft < 300 ? 'bg-amber-500/30 text-amber-200' :
                          isReal ? 'bg-blue-500/20 text-blue-200' :
                          'bg-white/10',
                        )}>
                          {isReal ? '' : '~'}{etaStr}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Zahlungs-Indikator */}
              <div className={cn(
                'mt-3 rounded-xl p-3 flex items-center gap-3',
                isBar && !done ? 'bg-amber-500/20 border-2 border-amber-400' : 'bg-matcha-700/50',
              )}>
                {isBar && !done ? (
                  <>
                    <div className="h-10 w-10 rounded-lg bg-amber-400 text-matcha-900 grid place-items-center">
                      <Banknote size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">BAR kassieren</div>
                      <div className="font-display text-2xl font-black text-amber-200">{euro(amount)}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-lg bg-matcha-700 text-accent grid place-items-center">
                      <CreditCard size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">Online bezahlt ✓</div>
                      <div className="font-bold text-white">{euro(amount)}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Distance + ETA countdown for next stop */}
              {isNext && nextStop && stop.id === nextStop.id && stop.distanz_zum_vorgaenger_m != null && stop.distanz_zum_vorgaenger_m > 0 && (
                <StopEtaBar distanzM={stop.distanz_zum_vorgaenger_m} gpsSpeed={gpsSpeed} />
              )}

              {/* Arrived-Badge wenn bereits angekommen, aber noch nicht zugestellt */}
              {isNext && (stop.angekommen_am || arrivedIds.has(stop.id)) && !stop.geliefert_am && (
                <div className="mt-2 flex items-center gap-1.5 rounded-full bg-accent/20 border border-accent/40 px-3 py-1 text-[11px] font-bold text-accent">
                  <Flag size={11} /> Angekommen — bitte zustellen
                </div>
              )}

              {/* Actions nur für next stop */}
              {isNext && (
                <div className="mt-3 flex gap-2">
                  {stop.order.kunde_telefon && (
                    <a href={`tel:${stop.order.kunde_telefon}`} className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20 grid place-items-center">
                      <Phone size={16} />
                    </a>
                  )}
                  {/* Angekommen-Button — nur wenn noch nicht angekommen */}
                  {!stop.angekommen_am && !arrivedIds.has(stop.id) && (
                    <button
                      onClick={() => markArrived(stop.id)}
                      className="h-11 px-3 rounded-xl bg-accent/20 border border-accent/40 text-accent flex items-center gap-1.5 text-xs font-bold shrink-0"
                    >
                      <Flag size={13} /> Angekommen
                    </button>
                  )}
                  {stop.order.kunde_lat && stop.order.kunde_lng && (() => {
                    const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
                    const lat = stop.order.kunde_lat!;
                    const lng = stop.order.kunde_lng!;
                    const primaryHref = isIos
                      ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
                      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
                    const secondaryHref = isIos
                      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
                      : `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
                    const secondaryLabel = isIos ? 'Google' : 'Waze';
                    return (
                      <>
                        <a
                          href={primaryHref}
                          target="_blank" rel="noreferrer"
                          className="flex-1 h-11 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center gap-2 text-sm font-bold"
                        >
                          <Navigation size={16} /> Navigieren
                        </a>
                        <a
                          href={secondaryHref}
                          target="_blank" rel="noreferrer"
                          className="h-11 px-3 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-xs font-bold text-matcha-300"
                        >
                          {secondaryLabel}
                        </a>
                      </>
                    );
                  })()}
                  <button
                    onClick={() => markDelivered(stop.id)}
                    disabled={pending === stop.id}
                    className="flex-1 h-11 rounded-xl bg-accent text-matcha-900 flex items-center justify-center gap-2 font-display font-bold active:scale-[0.98] disabled:opacity-50"
                  >
                    {pending === stop.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {isBar ? 'Kassiert & Zugestellt' : 'Zugestellt'}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {allDone && (() => {
          const cashStops = stops.filter((s) => !s.order.bezahlt || s.order.zahlungsart === 'bar');
          const totalCash = cashStops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          const onlineTotal = stops.filter((s) => s.order.bezahlt && s.order.zahlungsart !== 'bar')
            .reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          const elapsedMin = Math.floor(elapsed / 60);
          const totalDistKm = stops.reduce((sum, s) => sum + ((s.distanz_zum_vorgaenger_m ?? 0) / 1000), 0);
          return (
            <div className="rounded-2xl bg-matcha-700 border-2 border-accent p-5 text-center space-y-4">
              <div>
                <CheckCircle2 className="h-10 w-10 text-accent mx-auto mb-2" />
                <div className="font-display text-xl font-black">Alle ausgeliefert!</div>
                <div className="text-sm text-matcha-200 mt-1">Zurück zum Restaurant</div>
              </div>
              {/* Explicit tour close button — prevents accidental early close, updates batch status */}
              <TourCloseButton batchId={batchId} onDone={onAllDone} />

              {/* Tour-Zusammenfassung */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="font-display text-xl font-black text-accent">{stops.length}</div>
                  <div className="text-[10px] text-matcha-300 mt-0.5">Stopps</div>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="font-display text-xl font-black text-accent">{elapsedMin}m</div>
                  <div className="text-[10px] text-matcha-300 mt-0.5">Unterwegs</div>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="font-display text-xl font-black text-accent">
                    {totalDistKm > 0 ? `${totalDistKm.toFixed(1)}km` : `${stops.length}×`}
                  </div>
                  <div className="text-[10px] text-matcha-300 mt-0.5">
                    {totalDistKm > 0 ? 'Distanz' : 'Lieferungen'}
                  </div>
                </div>
              </div>

              {/* Cash collection summary */}
              {totalCash > 0 && (
                <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 p-4 text-left">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-2">
                    Kassiertes Bargeld — bitte abgeben
                  </div>
                  <div className="font-display text-3xl font-black text-amber-200">
                    {euro(totalCash)}
                  </div>
                  <div className="mt-2 space-y-1">
                    {cashStops.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs text-amber-100">
                        <span>#{s.order.bestellnummer.replace(/^[A-Z]+-/, '')} · {s.order.kunde_name}</span>
                        <span className="font-bold tabular-nums">{euro(s.order.gesamtbetrag)}</span>
                      </div>
                    ))}
                  </div>
                  {onlineTotal > 0 && (
                    <div className="mt-3 text-[10px] text-matcha-300">
                      Online bezahlt: {euro(onlineTotal)} — kein Bargeld
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function TourCloseButton({ batchId, onDone }: { batchId: string; onDone: () => void }) {
  const supabase = createClient();
  const [closing, setClosing] = useState(false);

  async function close() {
    setClosing(true);
    // Resolve mise_drivers.id before parallel updates
    const { data: miseBatch } = await supabase
      .from('mise_delivery_batches')
      .select('driver_id')
      .eq('id', batchId)
      .maybeSingle();

    const updates: Promise<any>[] = [
      supabase.from('delivery_batches').update({ status: 'abgeschlossen' }).eq('id', batchId),
      supabase.from('mise_delivery_batches').update({ state: 'completed', completed_at: new Date().toISOString() }).eq('id', batchId),
      supabase.from('driver_status').update({ aktueller_batch_id: null }).eq('aktueller_batch_id', batchId),
    ];
    if (miseBatch?.driver_id) {
      updates.push(
        supabase.from('mise_drivers').update({ state: 'returning' }).eq('id', miseBatch.driver_id)
      );
    }
    await Promise.all(updates);
    setClosing(false);
    onDone();
  }

  return (
    <button
      onClick={close}
      disabled={closing}
      className="w-full h-14 rounded-2xl bg-accent text-matcha-900 font-display font-black text-lg flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-60 shadow-xl shadow-accent/30"
    >
      {closing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
      {closing ? 'Wird abgeschlossen…' : 'Tour abschließen'}
    </button>
  );
}

function StopEtaBar({ distanzM, gpsSpeed }: { distanzM: number; gpsSpeed?: number | null }) {
  const mountedAt = useRef(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - mountedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const speedKmh = gpsSpeed != null && gpsSpeed >= 3 ? gpsSpeed : 15;
  const totalSec = Math.ceil((distanzM / 1000 / speedKmh) * 3600);
  const remaining = Math.max(0, totalSec - elapsedSec);
  const progressPct = Math.min(100, (elapsedSec / totalSec) * 100);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  // Speed arc gauge: 0-60 km/h range, semicircle
  const liveSpeed = gpsSpeed != null && gpsSpeed >= 3 ? gpsSpeed : null;
  const speedPct = liveSpeed != null ? Math.min(1, liveSpeed / 60) : null;
  const arcR = 18;
  const arcLen = Math.PI * arcR; // semicircle
  const speedColor = liveSpeed == null ? '#4d7c5f' : liveSpeed > 50 ? '#f97316' : liveSpeed > 25 ? '#d4a843' : '#4ae68a';

  return (
    <div className="mt-2 rounded-xl bg-white/10 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-matcha-300 flex items-center gap-1.5">
          <ArrowRight size={12} />
          {(distanzM / 1000).toFixed(1)} km
        </span>

        {/* Live-Geschwindigkeit: Arc-Gauge */}
        <div className="flex items-center gap-2">
          {liveSpeed != null && (
            <div className="flex flex-col items-center" title={`GPS: ${liveSpeed} km/h`}>
              <svg width="44" height="26" viewBox="0 0 44 26" className="overflow-visible">
                {/* Track */}
                <path d={`M 4 22 A ${arcR} ${arcR} 0 0 1 40 22`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" strokeLinecap="round" />
                {/* Speed arc */}
                <path
                  d={`M 4 22 A ${arcR} ${arcR} 0 0 1 40 22`}
                  fill="none"
                  stroke={speedColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={arcLen}
                  strokeDashoffset={arcLen * (1 - (speedPct ?? 0))}
                  style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s' }}
                />
                <text x="22" y="21" textAnchor="middle" fontSize="9" fontWeight="800" fill={speedColor} fontFamily="monospace">
                  {liveSpeed}
                </text>
              </svg>
              <span className="text-[8px] text-matcha-400 -mt-1 font-bold">km/h</span>
            </div>
          )}

          <span className={cn(
            'font-bold tabular-nums',
            remaining === 0 ? 'text-accent' : remaining < 120 ? 'text-orange-300' : 'text-white',
          )}>
            {remaining === 0 ? 'Fast da!' : `~${m > 0 ? `${m}:${String(s).padStart(2, '0')} Min` : `${s}s`}`}
          </span>
        </div>
      </div>

      {/* Route progress bar */}
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            progressPct >= 100 ? 'bg-accent' : progressPct > 70 ? 'bg-orange-400' : 'bg-matcha-400',
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
