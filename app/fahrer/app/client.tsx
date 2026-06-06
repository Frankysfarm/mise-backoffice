'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Banknote, Bike, Calendar, Check, Car, CheckCircle2, ChevronDown, ChevronUp, Clock, Footprints,
  Loader2, LogOut, Map as MapIcon, MapPin, Navigation, Phone, Power, Route, ShoppingBag,
  TrendingUp, Trophy, Zap,
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
      kunde_notiz?: string | null;
      kunde_lieferhinweis?: string | null;
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
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickItems, setPickItems] = useState<any[]>([]);

  // Küchenstatus für Pickup-Phase: welche Bestellungen sind schon fertig?
  const [kitchenStatuses, setKitchenStatuses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!activeBatch || activeBatch.status === 'unterwegs') return;
    const orderIds = activeBatch.stops.map((s) => s.order_id).filter(Boolean);
    if (orderIds.length === 0) return;

    // Initial fetch
    supabase.from('customer_orders')
      .select('id, status')
      .in('id', orderIds)
      .then(({ data }: { data: { id: string; status: string }[] | null }) => {
        if (!data) return;
        setKitchenStatuses(new Map(data.map((r) => [r.id, r.status])));
      });

    // Realtime subscription
    const ch = supabase
      .channel(`kitchen-status-${activeBatch.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=in.(${orderIds.join(',')})`,
      }, (payload: { new: { id: string; status: string } }) => {
        const { id, status: newStatus } = payload.new;
        setKitchenStatuses((prev) => new Map(prev).set(id, newStatus));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBatch?.id, activeBatch?.status]);

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
        if (pos.coords.speed != null) setGpsSpeed(Math.round(pos.coords.speed * 3.6));
        setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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
        if (isMise) {
          await supabase.from('driver_status')
            .update({ aktueller_batch_id: batchId })
            .eq('employee_id', driver.id);
        }
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
            gpsSpeed={gpsSpeed}
            driverLat={driverPos?.lat ?? null}
            driverLng={driverPos?.lng ?? null}
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

            {/* Tour-Stopp-Übersicht: jede Lieferadresse mit individuellem Nav-Link */}
            <div className="space-y-2 mb-4">
              {activeBatch.stops
                .slice()
                .sort((a, b) => a.reihenfolge - b.reihenfolge)
                .map((stop, idx, arr) => {
                  const o = stop.order as any;
                  const isCash = o.zahlungsart === 'bar' || o.bezahlt === false;
                  const kStatus = kitchenStatuses.get(stop.order_id) ?? null;
                  const kitchenReady = kStatus === 'fertig' || kStatus === 'unterwegs';
                  const kitchenCooking = kStatus === 'in_zubereitung';
                  const isLast = idx === arr.length - 1;

                  // Individual stop nav URL
                  const stopNavUrl = stop.order.kunde_lat && stop.order.kunde_lng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${stop.order.kunde_lat},${stop.order.kunde_lng}&travelmode=driving`
                    : stop.order.kunde_adresse
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.order.kunde_adresse)}`
                    : null;

                  // Distanz-Chip
                  const distM = (stop as any).distanz_zum_vorgaenger_m as number | null;

                  return (
                    <div key={stop.id} className="relative">
                      {/* Vertical connector line between stops */}
                      {!isLast && (
                        <div className="absolute left-[15px] top-[52px] bottom-[-8px] w-0.5 bg-white/10 z-0" />
                      )}
                      <div className={cn(
                        'relative z-10 rounded-xl border p-3 flex items-center gap-3 transition',
                        kitchenReady ? 'bg-matcha-700/40 border-accent/40' :
                        isCash ? 'bg-amber-500/10 border-amber-400/30' : 'bg-white/5 border-white/10',
                      )}>
                        <div className={cn(
                          'h-8 w-8 rounded-lg grid place-items-center font-display font-black shrink-0',
                          kitchenReady ? 'bg-accent text-matcha-900' : 'bg-accent/20 text-accent',
                        )}>{kitchenReady ? '✓' : stop.reihenfolge}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="font-display font-bold truncate">{stop.order.kunde_name}</div>
                            {kitchenReady && (
                              <span className="shrink-0 rounded-full bg-accent/20 text-accent px-1.5 py-0.5 text-[9px] font-black uppercase">Fertig!</span>
                            )}
                            {kitchenCooking && (
                              <span className="shrink-0 rounded-full bg-orange-500/20 text-orange-300 px-1.5 py-0.5 text-[9px] font-black animate-pulse">🍳 Kocht</span>
                            )}
                            {kStatus === 'bestätigt' && (
                              <span className="shrink-0 rounded-full bg-blue-500/20 text-blue-300 px-1.5 py-0.5 text-[9px] font-black">Angenommen</span>
                            )}
                          </div>
                          <div className="text-xs text-matcha-300 truncate">{stop.order.kunde_adresse}</div>
                          {/* Distanz + ETA */}
                          <div className="flex items-center gap-2 mt-0.5">
                            {distM != null && distM > 0 && (
                              <span className="text-[9px] text-matcha-400 tabular-nums">
                                {distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`}
                              </span>
                            )}
                            {o.eta_earliest ? (
                              <span className={cn(
                                'text-[9px] font-bold tabular-nums rounded-full px-1.5 py-0.5',
                                new Date(o.eta_earliest).getTime() < Date.now()
                                  ? 'bg-red-500/20 text-red-300'
                                  : 'bg-accent/15 text-accent/80',
                              )}>
                                ⏰ ~{new Date(o.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (activeBatch as any).total_eta_min && arr.length > 0 ? (() => {
                              const estMs = Date.now() + ((idx + 1) / arr.length) * (activeBatch as any).total_eta_min * 60_000;
                              const estTime = new Date(estMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                              return (
                                <span className="text-[9px] font-bold text-matcha-300 tabular-nums rounded-full bg-white/5 px-1.5 py-0.5">
                                  ⏰ ~{estTime}
                                </span>
                              );
                            })() : null}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className={cn('font-display font-bold', isCash ? 'text-amber-300' : 'text-accent')}>
                            {euro(stop.order.gesamtbetrag)}
                          </div>
                          {isCash && <div className="text-[9px] font-bold text-amber-400 uppercase">Bar</div>}
                          {/* Individual Navigation Button */}
                          {stopNavUrl && (
                            <a
                              href={stopNavUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-accent/20 text-accent px-2 py-1 text-[9px] font-bold hover:bg-accent/30 transition"
                              title="Diesen Stopp in Maps öffnen"
                            >
                              <Navigation className="h-3 w-3" />
                              Nav
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
              })}
            </div>

            {/* Alle-Fertig-Banner wenn alle Bestellungen bereit sind */}
            {activeBatch.stops.length > 0 && activeBatch.stops.every((s) => {
              const ks = kitchenStatuses.get(s.order_id);
              return ks === 'fertig' || ks === 'unterwegs';
            }) && (
              <div className="mb-3 rounded-xl bg-accent/15 border-2 border-accent/50 px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <div>
                  <div className="font-display font-bold text-accent">Alle Bestellungen bereit!</div>
                  <div className="text-[11px] text-matcha-300">Packen & starten</div>
                </div>
              </div>
            )}

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
            driverPos={driverPos}
          />
        )}

        {/* Offline state */}
        {!isOnline && !activeBatch && (
          <section className="text-center py-8">
            <Power className="h-12 w-12 text-matcha-300 mx-auto mb-2 opacity-40" />
            <div className="text-matcha-200">Du bist offline. Geh online, um Touren anzunehmen.</div>
          </section>
        )}

        {/* Schicht-Statistik — immer sichtbar wenn kein aktiver Batch */}
        {!activeBatch && <SchichtStats driverId={driver.id} isOnline={isOnline} />}

        {/* Schicht-Buchung — Fahrer können sich für offene Schichten anmelden */}
        {!activeBatch && driver.location_id && (
          <SchichtBuchung locationId={driver.location_id} />
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

/* ---------- SchichtStats ---------- */

function SchichtStats({ driverId, isOnline }: { driverId: string; isOnline: boolean }) {
  const supabase = createClient();
  const [stats, setStats] = useState<{
    deliveries: number;
    tours: number;
    totalBetrag: number;
    totalDistKm: number;
  } | null>(null);
  const [onlineMin, setOnlineMin] = useState<number>(0);
  const prevOnlineRef = React.useRef<number>(0);

  // Tick für Online-Zeit
  useEffect(() => {
    const t = setInterval(() => setOnlineMin((m) => m + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    (async () => {
      // Legacy + Mise parallel abfragen
      const [
        { data: legacyBatches },
        { data: miseDriver },
      ] = await Promise.all([
        supabase
          .from('delivery_batches')
          .select('id, total_distance_km')
          .eq('fahrer_id', driverId)
          .gte('created_at', today.toISOString()),
        supabase
          .from('mise_drivers')
          .select('id')
          .eq('employee_id', driverId)
          .maybeSingle(),
      ]);

      const miseDriverId = (miseDriver as any)?.id ?? null;

      const [{ data: legacyStops }, { data: miseBatches }] = await Promise.all([
        legacyBatches?.length
          ? supabase
              .from('delivery_batch_stops')
              .select('id, geliefert_am, order:customer_orders(gesamtbetrag)')
              .in('batch_id', (legacyBatches as any[]).map((b) => b.id))
              .not('geliefert_am', 'is', null)
          : Promise.resolve({ data: [] }),
        miseDriverId
          ? supabase
              .from('mise_delivery_batches')
              .select('id, total_distance_km')
              .eq('driver_id', miseDriverId)
              .gte('created_at', today.toISOString())
          : Promise.resolve({ data: [] }),
      ]);

      const { data: miseStops } = miseBatches?.length
        ? await supabase
            .from('mise_delivery_batch_stops')
            .select('id, completed_at, type, order:customer_orders(gesamtbetrag)')
            .in('batch_id', (miseBatches as any[]).map((b) => b.id))
            .eq('type', 'dropoff')
            .not('completed_at', 'is', null)
        : { data: [] };

      const legacyDelivered = (legacyStops as any[])?.length ?? 0;
      const miseDelivered = (miseStops as any[])?.length ?? 0;
      const legacyBetrag = ((legacyStops as any[]) ?? []).reduce((s: number, st: any) => s + (st.order?.gesamtbetrag ?? 0), 0);
      const miseBetrag = ((miseStops as any[]) ?? []).reduce((s: number, st: any) => s + (st.order?.gesamtbetrag ?? 0), 0);
      const legacyDist = ((legacyBatches as any[]) ?? []).reduce((s: number, b: any) => s + (b.total_distance_km ?? 0), 0);
      const miseDist = ((miseBatches as any[]) ?? []).reduce((s: number, b: any) => s + (b.total_distance_km ?? 0), 0);

      setStats({
        deliveries: legacyDelivered + miseDelivered,
        tours: ((legacyBatches as any[])?.length ?? 0) + ((miseBatches as any[])?.length ?? 0),
        totalBetrag: legacyBetrag + miseBetrag,
        totalDistKm: legacyDist + miseDist,
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const [realEarnings, setRealEarnings] = useState<{ deliveries: number; totalEur: number } | null>(null);

  useEffect(() => {
    fetch('/api/delivery/driver/earnings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.today?.deliveries >= 0) setRealEarnings(d.today); })
      .catch(() => {});
  }, []);

  // Online-Zeit aus driver_status
  useEffect(() => {
    if (!isOnline) return;
    (async () => {
      const { data } = await supabase
        .from('driver_status')
        .select('online_seit')
        .eq('employee_id', driverId)
        .maybeSingle();
      if (data?.online_seit) {
        const min = Math.floor((Date.now() - new Date(data.online_seit as string).getTime()) / 60_000);
        setOnlineMin(min);
        prevOnlineRef.current = min;
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!stats && !isOnline) return null;
  if (!stats) return null;

  const hasData = stats.deliveries > 0 || stats.tours > 0;

  return (
    <section className={cn(
      'rounded-2xl border p-4',
      hasData ? 'bg-white/5 border-white/10' : 'bg-white/3 border-white/5 opacity-60',
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-accent" />
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300">Heutige Schicht</div>
        {onlineMin > 0 && (
          <div className="ml-auto text-[10px] font-bold text-matcha-400 tabular-nums">
            {Math.floor(onlineMin / 60) > 0 ? `${Math.floor(onlineMin / 60)}h ` : ''}{onlineMin % 60}m online
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <div className="font-display text-2xl font-black text-accent leading-none">{stats.deliveries}</div>
          <div className="text-[10px] text-matcha-300 mt-1">Lieferungen</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <div className="font-display text-2xl font-black text-accent leading-none">{stats.tours}</div>
          <div className="text-[10px] text-matcha-300 mt-1">Touren</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <div className="font-display text-lg font-black text-accent leading-none">
            {stats.totalDistKm > 0 ? `${stats.totalDistKm.toFixed(1)} km` : '—'}
          </div>
          <div className="text-[10px] text-matcha-300 mt-1">Strecke</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <div className="font-display text-lg font-black text-accent leading-none">
            {euro(stats.totalBetrag)}
          </div>
          <div className="text-[10px] text-matcha-300 mt-1">Umsatz</div>
        </div>
      </div>
      {!hasData && isOnline && (
        <div className="mt-2 text-center text-[11px] text-matcha-400">
          Noch keine Lieferungen heute — erste Tour annehmen!
        </div>
      )}
      {stats.deliveries > 0 && (
        <>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-matcha-300">
            <TrendingUp className="h-3 w-3 text-accent" />
            Ø {stats.tours > 0 ? Math.round(stats.deliveries / stats.tours * 10) / 10 : 0} Stopps/Tour
            {stats.totalDistKm > 0 && stats.deliveries > 0 && (
              <span className="ml-2 opacity-70">· Ø {(stats.totalDistKm / stats.deliveries).toFixed(1)} km/Lieferung</span>
            )}
          </div>
          {/* Effizienz-Streifen */}
          {onlineMin > 0 && (() => {
            const delivPerHour = Math.round((stats.deliveries / Math.max(1, onlineMin)) * 60 * 10) / 10;
            const effScore = Math.min(100, Math.round(delivPerHour * 20)); // ~5/h = 100%
            const effLabel = effScore >= 80 ? 'Excellent' : effScore >= 60 ? 'Sehr gut' : effScore >= 40 ? 'Gut' : 'Aufwärmen';
            const effColor = effScore >= 80 ? 'bg-accent' : effScore >= 60 ? 'bg-blue-400' : effScore >= 40 ? 'bg-amber-400' : 'bg-muted';
            const estimatedEarnings = realEarnings?.totalEur ?? (stats.deliveries * 3 + stats.totalDistKm * 0.15);
            const isRealEarnings = realEarnings !== null && realEarnings.totalEur > 0;
            const earningsPerHour = onlineMin >= 5 ? (estimatedEarnings / Math.max(1, onlineMin)) * 60 : null;
            return (
              <div className="mt-3 space-y-2">
                <div className="rounded-xl bg-white/5 px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">Schicht-Effizienz</span>
                    <span className="text-[10px] font-black text-accent">{effLabel}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${effColor}`}
                      style={{ width: `${effScore}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-matcha-400">
                    <span>{delivPerHour}/h Lieferungen</span>
                    {earningsPerHour != null && (
                      <span className="text-accent font-bold">
                        ≈ {earningsPerHour.toFixed(2)}€/h
                        <span className="ml-1 opacity-60 text-[9px]">{isRealEarnings ? '✓ echt' : '~schätz.'}</span>
                      </span>
                    )}
                  </div>
                </div>
                {/* Schicht-Endprognose */}
                {earningsPerHour != null && (() => {
                  const nowH = new Date().getHours();
                  const shiftEndH = 22;
                  const hoursLeft = Math.max(0, shiftEndH - nowH - new Date().getMinutes() / 60);
                  const currentEarnings = estimatedEarnings;
                  const projectedEarnings = currentEarnings + earningsPerHour * hoursLeft;
                  if (hoursLeft <= 0 || projectedEarnings <= 0) return null;
                  return (
                    <div className="rounded-xl bg-accent/10 border border-accent/20 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-matcha-300 uppercase tracking-wider">
                          Prognose bis {shiftEndH}:00 Uhr
                        </span>
                        <span className="font-display text-lg font-black text-accent tabular-nums">
                          ~{projectedEarnings.toFixed(0)}€
                        </span>
                      </div>
                      <div className="text-[9px] text-matcha-400 mt-0.5">
                        {currentEarnings.toFixed(0)}€ bereits{isRealEarnings ? ' (Echtdaten)' : ' (Schätzung)'} + {(earningsPerHour * hoursLeft).toFixed(0)}€ prognose
                      </div>
                    </div>
                  );
                })()}
                {/* Tages-Meilenstein */}
                {(() => {
                  const MILESTONES = [5, 10, 15, 20, 30, 50];
                  const next = MILESTONES.find((m) => m > stats.deliveries);
                  if (!next) return null;
                  const pct = Math.round((stats.deliveries / next) * 100);
                  const remaining = next - stats.deliveries;
                  return (
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">Nächstes Ziel</span>
                        <span className="text-[10px] font-black text-matcha-200">
                          {stats.deliveries}/{next} <span className="text-accent">🏆</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gold transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-matcha-400">
                        Noch {remaining} {remaining === 1 ? 'Lieferung' : 'Lieferungen'} bis zum Meilenstein
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </>
      )}
    </section>
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
  driverPos,
}: {
  openBatches: OpenBatch[];
  pending: boolean;
  onClaim: (batchId: string) => void;
  driverPos?: { lat: number; lng: number } | null;
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
      // Fahrer-Verdienstschätzung: Basis 3€/Stop + 0.15€/km
      const estDriverEarnings = Math.round((stops.length * 3 + totalDistanceKm * 0.15) * 100) / 100;
      return {
        batchId,
        stops,
        totalAmount: stops.reduce((s, x) => s + x.gesamtbetrag, 0),
        cashAmount,
        estDriverEarnings,
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
          {grouped.map(({ batchId, stops, totalAmount, cashAmount, estDriverEarnings, locationName, maxEta, totalDistanceKm, estEtaMin }) => (
            <div key={batchId} className="rounded-2xl bg-accent/5 border-2 border-accent/30 p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-accent text-matcha-900 flex items-center justify-center shrink-0">
                  <Zap size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold">
                    {stops.length === 1 ? stops[0].kunde_name : `${stops.length} Stopps · ${locationName}`}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-matcha-300">
                    <span className="font-bold text-accent">{euro(totalAmount)}</span>
                    {cashAmount > 0 && (
                      <span className="flex items-center gap-1 font-bold text-amber-300">
                        <Banknote size={10} /> Bar: {euro(cashAmount)}
                      </span>
                    )}
                    {/* Fahrer-Verdienstschätzung */}
                    {estDriverEarnings > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-matcha-700/40 border border-matcha-600/40 px-2 py-0.5 font-bold text-matcha-100">
                        <TrendingUp size={10} /> ~{euro(estDriverEarnings)} Verdienst
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
                    {/* Distance from driver to pickup location */}
                    {driverPos && stops[0].location_lat && stops[0].location_lng && (() => {
                      const d = haversineKm(driverPos, { lat: stops[0].location_lat!, lng: stops[0].location_lng! });
                      const label = d < 0.1 ? '< 100m' : d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
                      return (
                        <span className={cn(
                          'flex items-center gap-1 rounded-full px-2 py-0.5 font-bold',
                          d < 0.3 ? 'bg-accent/20 text-accent' : d < 1 ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-matcha-300',
                        )}>
                          <Navigation size={9} /> {label} zur Abholung
                        </span>
                      );
                    })()}
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

/* ---------- SchichtBuchung ---------- */

type BookableSlot = {
  slotStart: string;
  slotEnd: string;
  dayLabel: string;
  timeLabel: string;
  driverNeeded: number;
  driverTarget: number;
  alreadyClaimed: boolean;
};

type DriverClaim = {
  id: string;
  plannedStart: string;
  plannedEnd: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rejectionReason: string | null;
};

function SchichtBuchung({ locationId }: { locationId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [claims, setClaims] = useState<DriverClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimPending, setClaimPending] = useState<string | null>(null);
  const [cancelPending, setCancelPending] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [slotsRes, claimsRes] = await Promise.all([
        fetch(`/api/delivery/shifts/available?location_id=${locationId}`),
        fetch('/api/delivery/shifts/claim'),
      ]);
      if (slotsRes.ok) {
        const { slots: s = [] } = await slotsRes.json() as { slots: BookableSlot[] };
        setSlots(s);
      }
      if (claimsRes.ok) {
        const { claims: c = [] } = await claimsRes.json() as { claims: DriverClaim[] };
        setClaims(c);
      }
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!expanded) load();
    setExpanded(v => !v);
  }

  async function doClaim(slot: BookableSlot) {
    setClaimPending(slot.slotStart);
    try {
      const res = await fetch('/api/delivery/shifts/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id:   locationId,
          planned_start: slot.slotStart,
          planned_end:   slot.slotEnd,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json() as { error?: string };
        alert(error ?? 'Anmeldung fehlgeschlagen');
      } else {
        await load();
      }
    } finally {
      setClaimPending(null);
    }
  }

  async function doCancel(claimId: string) {
    setCancelPending(claimId);
    try {
      await fetch(`/api/delivery/shifts/claim?claim_id=${claimId}`, { method: 'DELETE' });
      await load();
    } finally {
      setCancelPending(null);
    }
  }

  const pendingClaims  = claims.filter(c => c.status === 'pending');
  const approvedClaims = claims.filter(c => c.status === 'approved');
  const openSlots      = slots.filter(s => !s.alreadyClaimed);
  const totalBadge     = openSlots.length + pendingClaims.length + approvedClaims.length;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
      >
        <div className="h-9 w-9 rounded-xl bg-matcha-700 flex items-center justify-center shrink-0">
          <Calendar size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm">Schichten buchen</div>
          <div className="text-[11px] text-matcha-300">
            {expanded
              ? 'Tippe um zuzuklappen'
              : openSlots.length > 0
              ? `${openSlots.length} offene Slot${openSlots.length === 1 ? '' : 's'}`
              : 'Verfügbare Schichten anzeigen'}
          </div>
        </div>
        {totalBadge > 0 && !expanded && (
          <span className="rounded-full bg-accent text-matcha-900 px-2 py-0.5 text-xs font-black">
            {totalBadge}
          </span>
        )}
        {expanded
          ? <ChevronUp size={16} className="text-matcha-300 shrink-0" />
          : <ChevronDown size={16} className="text-matcha-300 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-matcha-300 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Lade Schichten…
            </div>
          )}

          {/* Meine Anmeldungen */}
          {!loading && (pendingClaims.length > 0 || approvedClaims.length > 0) && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300 mb-2">
                Meine Anmeldungen
              </div>
              <div className="space-y-2">
                {[...approvedClaims, ...pendingClaims].map(c => {
                  const start = new Date(c.plannedStart);
                  const end   = new Date(c.plannedEnd);
                  const dayLbl = start.toLocaleDateString('de-DE', {
                    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
                  });
                  const timeLbl = `${start.toISOString().slice(11, 16)} – ${end.toISOString().slice(11, 16)} Uhr`;
                  const isApproved = c.status === 'approved';
                  return (
                    <div key={c.id} className={cn(
                      'rounded-xl border px-3 py-2.5 flex items-center gap-3',
                      isApproved
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-white/5 border-white/10',
                    )}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{dayLbl}</div>
                        <div className="text-[11px] text-matcha-300">{timeLbl}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                          isApproved
                            ? 'bg-accent/20 text-accent'
                            : 'bg-amber-500/20 text-amber-300',
                        )}>
                          {isApproved ? '✓ Genehmigt' : '⏳ Wartet'}
                        </span>
                        {c.status === 'pending' && (
                          <button
                            onClick={() => doCancel(c.id)}
                            disabled={cancelPending === c.id}
                            className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-matcha-300 transition disabled:opacity-40"
                            title="Anmeldung zurückziehen"
                          >
                            {cancelPending === c.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <span className="text-xs">✕</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Verfügbare Slots */}
          {!loading && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300 mb-2">
                Offene Slots
              </div>
              {openSlots.length === 0 ? (
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-5 text-center">
                  <Clock size={20} className="mx-auto mb-1.5 text-matcha-300 opacity-60" />
                  <div className="text-sm text-matcha-200">Keine offenen Schichten</div>
                  <div className="text-[11px] text-matcha-400 mt-0.5">
                    Alle Slots für die nächsten 7 Tage sind gedeckt.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {openSlots.map(slot => (
                    <div
                      key={slot.slotStart}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{slot.dayLabel}</div>
                        <div className="text-[11px] text-matcha-300">{slot.timeLabel}</div>
                        <div className="text-[10px] text-amber-300 mt-0.5">
                          {slot.driverNeeded} von {slot.driverTarget} Fahrern noch gesucht
                        </div>
                      </div>
                      <button
                        onClick={() => doClaim(slot)}
                        disabled={claimPending === slot.slotStart}
                        className="h-9 px-3 rounded-xl bg-accent text-matcha-900 font-display font-bold text-xs inline-flex items-center gap-1.5 shrink-0 transition active:scale-95 disabled:opacity-60"
                      >
                        {claimPending === slot.slotStart
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Check size={12} />}
                        Anmelden
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={load}
            disabled={loading}
            className="w-full text-center text-[11px] text-matcha-400 hover:text-matcha-200 transition py-1"
          >
            {loading ? 'Aktualisiere…' : '↻ Aktualisieren'}
          </button>
        </div>
      )}
    </section>
  );
}
