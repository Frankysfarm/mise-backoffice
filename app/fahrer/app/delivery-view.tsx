'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navigation, MapPin, Banknote, CreditCard, Check, CheckCircle2, Loader2, Phone, ArrowRight } from 'lucide-react';
import { euro, cn } from '@/lib/utils';

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  distanz_zum_vorgaenger_m: number | null;
  geliefert_am: string | null;
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
  };
};

export function DeliveryView({
  batchId,
  stops: initialStops,
  onAllDone,
}: {
  batchId: string;
  stops: Stop[];
  onAllDone: () => void;
}) {
  const supabase = createClient();
  const [stops, setStops] = useState(initialStops);
  const [pending, setPending] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const mountedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - mountedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

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
      setMapReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markDelivered(stopId: string) {
    setPending(stopId);
    const { error } = await supabase.from('delivery_batch_stops')
      .update({ geliefert_am: new Date().toISOString(), angekommen_am: new Date().toISOString() })
      .eq('id', stopId);
    setPending(null);
    if (error) { alert(error.message); return; }
    setStops((xs) => xs.map((x) => x.id === stopId ? { ...x, geliefert_am: new Date().toISOString() } : x));
    // Wenn alle fertig → callback
    if (openStops.length === 1) setTimeout(() => onAllDone(), 800);
  }

  return (
    <div className="flex-1 flex flex-col bg-matcha-900">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">Lieferung läuft</div>
          <div className="font-display font-bold text-lg">
            {doneCount} / {stops.length} zugestellt
          </div>
          <div className="text-[10px] text-matcha-400 tabular-nums mt-0.5">
            Unterwegs seit {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} Min
          </div>
        </div>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full ml-4 overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${(doneCount / stops.length) * 100}%` }} />
        </div>
      </div>

      {/* Map */}
      <div className="mx-4 mt-2 rounded-2xl overflow-hidden border border-white/10" style={{ height: 240 }}>
        <div ref={mapRef} className="w-full h-full" />
        {!mapReady && (
          <div className="w-full h-full flex items-center justify-center text-matcha-300 text-sm">
            <Loader2 className="animate-spin mr-2" size={14} /> Karte lädt…
          </div>
        )}
      </div>

      {/* Stops */}
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
                <StopEtaBar distanzM={stop.distanz_zum_vorgaenger_m} elapsedSec={elapsed} />
              )}

              {/* Actions nur für next stop */}
              {isNext && (
                <div className="mt-3 flex gap-2">
                  {stop.order.kunde_telefon && (
                    <a href={`tel:${stop.order.kunde_telefon}`} className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20 grid place-items-center">
                      <Phone size={16} />
                    </a>
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

        {allDone && (
          <div className="rounded-2xl bg-matcha-700 border-2 border-accent p-5 text-center">
            <CheckCircle2 className="h-10 w-10 text-accent mx-auto mb-2" />
            <div className="font-display text-xl font-black">Alle ausgeliefert!</div>
            <div className="text-sm text-matcha-200 mt-1">Zurück zum Restaurant</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StopEtaBar({ distanzM, elapsedSec }: { distanzM: number; elapsedSec: number }) {
  // Estimate 15 km/h average speed for delivery
  const totalSec = Math.ceil((distanzM / 1000 / 15) * 3600);
  const remaining = Math.max(0, totalSec - elapsedSec);
  const progressPct = Math.min(100, (elapsedSec / totalSec) * 100);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  return (
    <div className="mt-2 rounded-xl bg-white/10 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-matcha-300 flex items-center gap-1.5">
          <ArrowRight size={12} />
          {(distanzM / 1000).toFixed(1)} km
        </span>
        <span className={cn(
          'font-bold tabular-nums',
          remaining === 0 ? 'text-accent' : remaining < 120 ? 'text-orange-300' : 'text-white',
        )}>
          {remaining === 0 ? 'Fast da!' : `~${m > 0 ? `${m}:${String(s).padStart(2, '0')} Min` : `${s}s`}`}
        </span>
      </div>
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
