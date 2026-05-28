'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Bike, Check, Car, CheckCircle2, Clock, Footprints, Loader2, LogOut, MapPin,
  Navigation, Phone, Power, ShoppingBag, Zap,
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
};

type ActiveBatch = {
  id: string;
  status: string;
  started_at: string | null;
  stops: {
    id: string;
    batch_id: string;
    order_id: string;
    reihenfolge: number;
    angekommen_am: string | null;
    geliefert_am: string | null;
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

  /* Realtime: refresh on any batch/status change */
  useEffect(() => {
    const ch = supabase
      .channel('fahrer-app')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, refresh)
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
    startTransition(async () => {
      const { data } = await supabase.rpc('claim_delivery_batch', { p_batch_id: batchId });
      if ((data as any)?.ok) {
        // Direkt Pick-Dialog öffnen nach Annahme
        setPickOpen(true);
        router.refresh();
      } else {
        alert((data as any)?.error ?? 'Konnte Tour nicht annehmen');
      }
    });
  }

  async function markDelivered(stopId: string) {
    startTransition(async () => {
      await supabase.from('delivery_batch_stops')
        .update({ geliefert_am: new Date().toISOString() })
        .eq('id', stopId);

      // Order-Status auf geliefert updaten
      const stop = activeBatch?.stops.find((s) => s.id === stopId);
      if (stop) {
        await supabase.from('customer_orders')
          .update({ status: 'geliefert', geliefert_am: new Date().toISOString() })
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
            onAllDone={() => router.refresh()}
          />
        )}

        {/* Active Batch — Pick-Phase: groß + zentral, kein ablenkender Kram */}
        {activeBatch && activeBatch.status !== 'unterwegs' && (
          <section>
            <div className="flex items-center gap-2 mb-3 text-accent">
              <Navigation className="h-4 w-4" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider">Tour #{activeBatch.stops[0]?.order.bestellnummer.slice(-4)}</h2>
            </div>

            {/* Übersicht Stops */}
            <div className="space-y-2 mb-4">
              {activeBatch.stops.map((stop) => (
                <div key={stop.id} className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-accent/20 text-accent grid place-items-center font-display font-black">{stop.reihenfolge}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold truncate">{stop.order.kunde_name}</div>
                    <div className="text-xs text-matcha-300 truncate">{stop.order.kunde_adresse}</div>
                  </div>
                  <div className="font-display font-bold text-accent">{euro(stop.order.gesamtbetrag)}</div>
                </div>
              ))}
            </div>

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
          <section>
            <div className="flex items-center gap-2 mb-3 text-accent">
              <ShoppingBag className="h-4 w-4" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider">Verfügbare Touren</h2>
              {openBatches.length > 0 && (
                <span className="ml-auto rounded-full bg-accent text-matcha-900 px-2 py-0.5 text-xs font-bold">{openBatches.length}</span>
              )}
            </div>

            {openBatches.length === 0 ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
                <Clock className="h-8 w-8 text-matcha-300 mx-auto mb-2 opacity-60" />
                <div className="text-matcha-200 text-sm">Gerade keine offenen Touren.</div>
                <div className="text-matcha-300 text-xs mt-1">Bleib online — wir sagen dir Bescheid.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {openBatches.map((b) => (
                  <div key={b.batch_id} className="rounded-2xl bg-accent/5 border-2 border-accent/30 p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-accent text-matcha-900 flex items-center justify-center shrink-0">
                        <Zap size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold truncate">{b.kunde_name}</div>
                        <div className="text-sm text-matcha-200 truncate">
                          → {b.kunde_adresse}{b.kunde_plz ? `, ${b.kunde_plz}` : ''}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-matcha-300">
                          <span className="font-mono">#{b.bestellnummer.replace('FF-', '')}</span>
                          <span className="font-bold text-accent">{euro(b.gesamtbetrag)}</span>
                          {b.geschaetzte_lieferung_min && <span>~{b.geschaetzte_lieferung_min} Min</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => claimBatch(b.batch_id)}
                      disabled={pending}
                      className="mt-3 w-full h-12 rounded-xl bg-accent text-matcha-900 font-display font-bold text-base inline-flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
                    >
                      {pending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                      Tour annehmen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
