'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Banknote, Bike, Check, Car, CheckCircle2, Clock, Footprints, Loader2, LogOut, Map as MapIcon, MapPin,
  Navigation, Phone, Power, Route, ShoppingBag, Zap,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';
import { PickDialog } from './pick-dialog';
import { DeliveryView } from './delivery-view';
import { AlarmRinger } from './alarm-ringer';
import { UpdateBanner } from './update-banner';
import { PermissionsGate } from './permissions-gate';

const VEHICLES = [
  { id: 'fuss',    label: 'Zu Fuß',  icon: Footprints, hint: 'bis ~1 km' },
  { id: 'fahrrad', label: 'Fahrrad', icon: Bike,       hint: 'bis ~3 km' },
  { id: 'ebike',   label: 'E-Bike',  icon: Zap,        hint: 'bis ~6 km' },
  { id: 'roller',  label: 'Roller',  icon: Bike,       hint: 'bis ~10 km' },
  { id: 'auto',    label: 'Auto',    icon: Car,        hint: 'keine Grenze' },
];

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  tenant_id: string;
  location_id: string | null;
  fahrzeug_praeferenz: string | null;
};

type Status = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string | null;
  aktueller_batch_id: string | null;
  online_seit: string | null;
};

type OpenBatch = {
  batch_id: string;
  tenant_id: string;
  location_id: string;
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  gesamtbetrag: number;
  geschaetzte_lieferung_min: number | null;
  location_name: string;
  location_lat: number | null;
  location_lng: number | null;
  source_system: 'legacy' | 'mise' | null;
  zahlungsart?: string | null;
  bezahlt?: boolean | null;
};

type ActiveBatch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min?: number | null;
  total_distance_km?: number | null;
  stops: {
    id: string;
    batch_id: string;
    order_id: string;
    reihenfolge: number;
    angekommen_am: string | null;
    geliefert_am: string | null;
    distanz_zum_vorgaenger_m?: number | null;
    order: {
      id: string;
      bestellnummer: string;
      kunde_name: string;
      kunde_adresse: string | null;
      kunde_plz: string | null;
      kunde_lat: number | null;
      kunde_lng: number | null;
      gesamtbetrag: number;
    };
  }[];
};

export function FahrerApp({
  driver, initialStatus, initialOpenBatches, initialActiveBatch,
}: {
  driver: Driver;
  initialStatus: Status | null;
  initialOpenBatches: OpenBatch[];
  initialActiveBatch: ActiveBatch | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [openBatches, setOpenBatches] = useState(initialOpenBatches);
  const [activeBatch, setActiveBatch] = useState(initialActiveBatch);
  const [vehicle, setVehicle] = useState<string>(driver.fahrzeug_praeferenz ?? 'ebike');
  const [pending, startTransition] = useTransition();

  const isOnline = status?.ist_online ?? false;
  const gpsWatchRef = useRef<number | null>(null);
  const [gpsOk, setGpsOk] = useState<boolean | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickItems, setPickItems] = useState<any[]>([]);

  // Fetch Items wenn Pick-Dialog geöffnet wird
  useEffect(() => {
    if (!pickOpen || !activeBatch) return;
    (async () => {
      const orderIds = activeBatch.stops.map((s) => s.order_id);
      const { data } = await supabase.from('order_items')
        .select('id, order_id, name, menge, notiz, pick_confirmed_at, pick_missing')
        .in('order_id', orderIds);
      setPickItems((data as any[]) ?? []);
    })();
  }, [pickOpen, activeBatch, supabase]);

  /* SW-Auto-Update-Check: alle 60s Polling; UpdateBanner zeigt sich wenn neue Version */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const iv = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
    }, 60_000);
    const vis = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  /* GPS-Tracking: bei Online-Status watchPosition starten, Updates alle ~15s */
  useEffect(() => {
    if (!isOnline) {
      if (gpsWatchRef.current != null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
      return;
    }
    if (!('geolocation' in navigator)) { setGpsOk(false); return; }

    let lastPush = 0;
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsOk(true);
        const now = Date.now();
        if (now - lastPush < 15000) return;   // max alle 15s
        lastPush = now;
        supabase.from('driver_status').update({
          last_lat: pos.coords.latitude,
          last_lng: pos.coords.longitude,
          last_heading: pos.coords.heading ?? null,
          last_speed_kmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null,
          last_update: new Date().toISOString(),
        }).eq('employee_id', driver.id).then(() => {});
      },
      () => setGpsOk(false),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      if (gpsWatchRef.current != null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  /* Push-Subscribe beim ersten Online-Gehen */
  useEffect(() => {
    if (!isOnline) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return;
        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapid) return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid).buffer as ArrayBuffer,
        });
        await fetch('/api/drivers/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      } catch {}
    })();
  }, [isOnline]);

  /* Realtime: refresh bei Änderungen in Legacy- UND Mise-Tabellen */
  useEffect(() => {
    const ch = supabase
      .channel('fahrer-app')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batches' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batch_stops' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_status', filter: `employee_id=eq.${driver.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    router.refresh();
  }

  async function toggleOnline() {
    const next = !isOnline;
    startTransition(async () => {
      await supabase.from('driver_status').upsert({
        employee_id: driver.id,
        ist_online: next,
        fahrzeug: vehicle,
        online_seit: next ? new Date().toISOString() : null,
      });
      setStatus((s) => ({ ...(s ?? { employee_id: driver.id, fahrzeug: vehicle, aktueller_batch_id: null, online_seit: null }), ist_online: next, online_seit: next ? new Date().toISOString() : null }));
    });
  }

  async function claimBatch(batchId: string) {
    const batch = openBatches.find((b) => b.batch_id === batchId);
    const isMise = batch?.source_system === 'mise';
    startTransition(async () => {
      const { data } = isMise
        ? await supabase.rpc('claim_mise_delivery_batch', { p_batch_id: batchId, p_employee_id: driver.id })
        : await supabase.rpc('claim_delivery_batch', { p_batch_id: batchId });
      if ((data as any)?.ok) {
        setPickOpen(true);
        router.refresh();
      } else {
        alert((data as any)?.error ?? 'Konnte Tour nicht annehmen');
      }
    });
  }

  async function markDelivered(stopId: string) {
    startTransition(async () => {
      const now = new Date().toISOString();

      // Legacy-Stop updaten
      await supabase.from('delivery_batch_stops')
        .update({ geliefert_am: now })
        .eq('id', stopId);

      // Mise-Stop updaten (falls dieser Stop aus dem Mise-System stammt)
      await supabase.from('mise_delivery_batch_stops')
        .update({ completed_at: now })
        .eq('id', stopId);

      const stop = activeBatch?.stops.find((s) => s.id === stopId);
      if (stop) {
        await supabase.from('customer_orders')
          .update({ status: 'geliefert', geliefert_am: now })
          .eq('id', stop.order_id);
      }

      router.refresh();
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/fahrer');
  }

  const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

  return (
    <PermissionsGate vapidPublic={VAPID} driverId={driver.id}>
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-br from-matcha-900 to-matcha-700 px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-11 w-11 rounded-2xl flex items-center justify-center',
            isOnline ? 'bg-accent text-matcha-900' : 'bg-white/10',
          )}>
            <Bike size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-200">Fahrer</div>
            <div className="font-display font-bold truncate">{driver.vorname} {driver.nachname}</div>
          </div>
          <button
            onClick={logout}
            className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="Abmelden"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-5">
        {/* Online Toggle */}
        {!activeBatch && (
          <section>
            <button
              onClick={toggleOnline}
              disabled={pending}
              className={cn(
                'w-full rounded-3xl p-5 font-display font-bold text-lg flex items-center gap-4 transition active:scale-[0.98]',
                isOnline
                  ? 'bg-accent text-matcha-900 shadow-lg'
                  : 'bg-white/5 border-2 border-white/10 text-matcha-100',
              )}
            >
              <div className={cn(
                'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0',
                isOnline ? 'bg-matcha-900 text-accent' : 'bg-white/10',
              )}>
                <Power size={26} />
              </div>
              <div className="text-left flex-1">
                <div className="text-xl">{isOnline ? 'Du bist online' : 'Los geht&apos;s'}</div>
                <div className={cn('text-sm font-normal mt-0.5', isOnline ? 'text-matcha-900/70' : 'text-matcha-300')}>
                  {isOnline ? 'Tippe hier zum Offline-Gehen' : 'Tippe um online zu gehen'}
                </div>
              </div>
            </button>

            {/* Vehicle selector — alle 5 Fahrzeug-Typen */}
            {isOnline && !activeBatch && (
              <>
                <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300 px-1">Mein Fahrzeug</div>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {VEHICLES.map((v) => {
                    const Icon = v.icon;
                    const isActive = vehicle === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => { setVehicle(v.id); supabase.from('driver_status').update({ fahrzeug: v.id }).eq('employee_id', driver.id); }}
                        className={cn(
                          'rounded-xl p-2 border-2 transition flex flex-col items-center gap-1 min-h-[76px]',
                          isActive ? 'bg-accent text-matcha-900 border-accent' : 'bg-white/5 border-white/10 text-matcha-200',
                        )}
                        title={v.hint}
                      >
                        <Icon className="h-5 w-5" />
                        <div className="text-[10px] font-bold leading-tight text-center">{v.label}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 px-2 text-[11px] text-matcha-300 leading-relaxed">
                  Dein Fahrzeug entscheidet welche Touren du bekommst. E-Bike ≈ Stadt, Auto = weit.
                </div>

                {/* GPS-Status */}
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  {gpsOk === false && <span className="text-red-300">⚠️ GPS blockiert — in Safari/Chrome Standort erlauben</span>}
                  {gpsOk === true && <span className="text-accent">📍 GPS aktiv</span>}
                  {gpsOk === null && <span className="text-matcha-300">📍 Warte auf GPS-Signal…</span>}
                </div>
              </>
            )}
          </section>
        )}

        {/* Active Batch — NEUE Delivery-View wenn unterwegs */}
        {activeBatch && activeBatch.status === 'unterwegs' && (
          <DeliveryView
            batchId={activeBatch.id}
            stops={activeBatch.stops as any}
            batchStartedAt={activeBatch.started_at}
            totalEtaMin={activeBatch.total_eta_min ?? null}
            onAllDone={() => router.refresh()}
          />
        )}

        {/* Active Batch — Pick-Phase: groß + zentral, kein ablenkender Kram */}
        {activeBatch && activeBatch.status !== 'unterwegs' && (
          <section>
            <div className="flex items-center justify-between mb-3 text-accent">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider">Tour #{activeBatch.stops[0]?.order.bestellnummer.slice(-4)}</h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-matcha-300">{activeBatch.stops.length} {activeBatch.stops.length === 1 ? 'Stopp' : 'Stopps'}</span>
                <span className="font-display font-bold text-accent">
                  {euro(activeBatch.stops.reduce((s, st) => s + st.order.gesamtbetrag, 0))}
                </span>
              </div>
            </div>

            {/* Cash-to-collect Banner */}
            {(() => {
              const cashStops = activeBatch.stops.filter((s) => {
                const o = s.order as any;
                return o.zahlungsart === 'bar' || o.bezahlt === false;
              });
              const totalCash = cashStops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
              if (totalCash <= 0) return null;
              return (
                <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-4 py-3 mb-3 flex items-center gap-3">
                  <Banknote className="h-5 w-5 text-amber-300 shrink-0" />
                  <div className="flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Bar kassieren</div>
                    <div className="font-display font-black text-amber-200 text-xl">{euro(totalCash)}</div>
                  </div>
                  <div className="text-[10px] text-amber-400">{cashStops.length} {cashStops.length === 1 ? 'Zahlung' : 'Zahlungen'}</div>
                </div>
              );
            })()}

            {/* Übersicht Stops */}
            <div className="space-y-2 mb-4">
              {activeBatch.stops.map((stop) => {
                const o = stop.order as any;
                const isCash = o.zahlungsart === 'bar' || o.bezahlt === false;
                return (
                  <div key={stop.id} className={cn(
                    'rounded-xl border p-3 flex items-center gap-3',
                    isCash ? 'bg-amber-500/10 border-amber-400/30' : 'bg-white/5 border-white/10',
                  )}>
                    <div className="h-8 w-8 rounded-lg bg-accent/20 text-accent grid place-items-center font-display font-black">{stop.reihenfolge}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold truncate">{stop.order.kunde_name}</div>
                      <div className="text-xs text-matcha-300 truncate">{stop.order.kunde_adresse}</div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <div className={cn('font-display font-bold', isCash ? 'text-amber-300' : 'text-accent')}>
                        {euro(stop.order.gesamtbetrag)}
                      </div>
                      {isCash && <div className="text-[9px] font-bold text-amber-400 uppercase">Bar</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Route-Vorschau in Google Maps */}
            {activeBatch.stops.length > 0 && (() => {
              const withCoords = activeBatch.stops
                .sort((a, b) => a.reihenfolge - b.reihenfolge)
                .filter((s) => s.order.kunde_lat && s.order.kunde_lng);
              if (withCoords.length === 0) return null;
              const dest = `${withCoords[withCoords.length - 1].order.kunde_lat},${withCoords[withCoords.length - 1].order.kunde_lng}`;
              const waypoints = withCoords.slice(0, -1).map((s) => `${s.order.kunde_lat},${s.order.kunde_lng}`).join('|');
              const mapsUrl = waypoints
                ? `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`
                : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
              return (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold text-matcha-200 inline-flex items-center justify-center gap-2 mb-3 transition"
                >
                  <MapIcon className="h-4 w-4" />
                  Route in Maps vorschauen ({withCoords.length} {withCoords.length === 1 ? 'Stopp' : 'Stopps'})
                </a>
              );
            })()}

            {/* Großer Pick-Starten Button */}
            <button
              onClick={() => setPickOpen(true)}
              className="w-full h-16 rounded-2xl bg-accent text-matcha-900 font-display text-xl font-black inline-flex items-center justify-center gap-3 active:scale-[0.98] shadow-xl shadow-accent/30"
            >
              <ShoppingBag className="h-6 w-6" />
              Jetzt Packen & Kontrollieren
            </button>

            <div className="mt-3 text-xs text-matcha-300 text-center leading-relaxed">
              Tippe „Packen" → geh jedes Item durch („ist dabei" / „fehlt"). Danach wird die schnellste Route berechnet.
            </div>
          </section>
        )}

        {/* Open Batches — Pickup Inbox */}
        {!activeBatch && isOnline && (
          <OpenBatchSection
            openBatches={openBatches}
            pending={pending}
            onClaim={claimBatch}
          />
        )}

        {/* Offline state */}
        {!isOnline && !activeBatch && (
          <section className="text-center py-8">
            <Power className="h-12 w-12 text-matcha-300 mx-auto mb-2 opacity-40" />
            <div className="text-matcha-200">Du bist offline. Geh online, um Touren anzunehmen.</div>
          </section>
        )}
      </main>

      <UpdateBanner />

      {/* Alarm-Ringer: klingelt wenn Tour in Open-Liste (zum Annehmen) ODER zugewiesen (zum Picken) */}
      <AlarmRinger
        openBatchIds={openBatches.map((b) => b.batch_id)}
        assignedBatchId={activeBatch?.status === 'zugewiesen' && !pickOpen ? activeBatch.id : null}
      />

      {pickOpen && activeBatch && (
        <PickDialog
          orderBestellnummer={activeBatch.stops[0]?.order.bestellnummer ?? ''}
          items={pickItems}
          batchId={activeBatch.id}
          onClose={() => setPickOpen(false)}
          onComplete={() => { setPickOpen(false); router.refresh(); }}
        />
      )}
    </div>
    </PermissionsGate>
  );
}

/* ---------- Haversine ---------- */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function OpenBatchSection({
  openBatches,
  pending,
  onClaim,
}: {
  openBatches: OpenBatch[];
  pending: boolean;
  onClaim: (batchId: string) => void;
}) {
  // Group stops by batch_id for multi-stop display
  const grouped = useMemo(() => {
    const map = new Map<string, OpenBatch[]>();
    for (const b of openBatches) {
      if (!map.has(b.batch_id)) map.set(b.batch_id, []);
      map.get(b.batch_id)!.push(b);
    }
    return Array.from(map.entries()).map(([batchId, stops]) => {
      const locLat = stops[0].location_lat;
      const locLng = stops[0].location_lng;
      let totalDistanceKm = 0;
      let prev = locLat != null && locLng != null ? { lat: locLat, lng: locLng } : null;
      for (const s of stops) {
        if (s.kunde_lat && s.kunde_lng && prev) {
          totalDistanceKm += haversineKm(prev, { lat: s.kunde_lat, lng: s.kunde_lng });
          prev = { lat: s.kunde_lat, lng: s.kunde_lng };
        }
      }
      const estEtaMin = Math.round((totalDistanceKm / 20) * 60 + stops.length * 3);
      const cashAmount = stops
        .filter((s) => s.zahlungsart === 'bar' || s.bezahlt === false)
        .reduce((sum, s) => sum + s.gesamtbetrag, 0);
      return {
        batchId,
        stops,
        totalAmount: stops.reduce((s, x) => s + x.gesamtbetrag, 0),
        cashAmount,
        locationName: stops[0].location_name,
        locationLat: locLat,
        locationLng: locLng,
        maxEta: stops.reduce((m, x) => Math.max(m, x.geschaetzte_lieferung_min ?? 0), 0),
        totalDistanceKm: totalDistanceKm > 0 ? totalDistanceKm : null,
        estEtaMin: estEtaMin > 0 ? estEtaMin : null,
      };
    });
  }, [openBatches]);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3 text-accent">
        <ShoppingBag className="h-4 w-4" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wider">Verfügbare Touren</h2>
        {grouped.length > 0 && (
          <span className="ml-auto rounded-full bg-accent text-matcha-900 px-2 py-0.5 text-xs font-bold">{grouped.length}</span>
        )}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
          <Clock className="h-8 w-8 text-matcha-300 mx-auto mb-2 opacity-60" />
          <div className="text-matcha-200 text-sm">Gerade keine offenen Touren.</div>
          <div className="text-matcha-300 text-xs mt-1">Bleib online — wir sagen dir Bescheid.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ batchId, stops, totalAmount, cashAmount, locationName, maxEta, totalDistanceKm, estEtaMin }) => (
            <div key={batchId} className="rounded-2xl bg-accent/5 border-2 border-accent/30 p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-accent text-matcha-900 flex items-center justify-center shrink-0">
                  <Zap size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold">
                    {stops.length === 1 ? stops[0].kunde_name : `${stops.length} Stopps · ${locationName}`}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-matcha-300">
                    <span className="font-bold text-accent">{euro(totalAmount)}</span>
                    {cashAmount > 0 && (
                      <span className="flex items-center gap-1 font-bold text-amber-300">
                        <Banknote size={10} /> Bar: {euro(cashAmount)}
                      </span>
                    )}
                    {estEtaMin ? (
                      <span className="flex items-center gap-1"><Clock size={10} /> ~{estEtaMin} Min</span>
                    ) : maxEta > 0 ? (
                      <span className="flex items-center gap-1"><Clock size={10} /> ~{maxEta} Min</span>
                    ) : null}
                    {totalDistanceKm != null && (
                      <span className="flex items-center gap-1"><Route size={10} /> {totalDistanceKm.toFixed(1)} km</span>
                    )}
                    <span>{stops.length} {stops.length === 1 ? 'Stopp' : 'Stopps'}</span>
                  </div>
                </div>
              </div>

              {/* Route-Visualisierung für Multi-Stop */}
              {stops.length > 1 && totalDistanceKm != null && (
                <div className="mb-3 rounded-xl bg-white/5 px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400 mb-1.5">Route</div>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="h-5 w-5 rounded-full bg-matcha-700 text-accent flex items-center justify-center">
                        <MapPin size={10} />
                      </div>
                      <div className="text-[9px] text-matcha-400 max-w-[52px] truncate text-center mt-0.5">{locationName}</div>
                    </div>
                    {stops.map((s, i) => (
                      <div key={s.order_id} className="flex items-center gap-1 shrink-0">
                        <div className="w-4 h-0.5 bg-accent/40 rounded-full mb-3" />
                        <div className="flex flex-col items-center">
                          <div className="h-5 w-5 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center text-[9px] font-black">{i + 1}</div>
                          <div className="text-[9px] text-matcha-400 max-w-[52px] truncate text-center mt-0.5">{s.kunde_name.split(' ')[0]}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stop list */}
              <div className="space-y-2 mb-3">
                {stops.map((s, i) => {
                  const isCash = s.zahlungsart === 'bar' || s.bezahlt === false;
                  return (
                    <div key={s.order_id} className={cn(
                      'flex items-start gap-2 rounded-xl px-3 py-2',
                      isCash ? 'bg-amber-500/10 border border-amber-400/30' : 'bg-white/5',
                    )}>
                      <div className="h-6 w-6 rounded-lg bg-accent/20 text-accent grid place-items-center text-[11px] font-black shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{s.kunde_name}</div>
                        <div className="text-[11px] text-matcha-300 truncate">
                          {s.kunde_adresse}{s.kunde_plz ? `, ${s.kunde_plz}` : ''}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className={cn('text-sm font-bold', isCash ? 'text-amber-300' : 'text-accent')}>{euro(s.gesamtbetrag)}</div>
                        {isCash && (
                          <div className="flex items-center gap-0.5 text-[9px] font-bold text-amber-300 uppercase tracking-wide">
                            <Banknote size={9} /> Bar
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => onClaim(batchId)}
                disabled={pending}
                className="w-full h-12 rounded-xl bg-accent text-matcha-900 font-display font-bold text-base inline-flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
              >
                {pending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {stops.length === 1 ? 'Tour annehmen' : `${stops.length}-Stopp-Tour annehmen`}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
