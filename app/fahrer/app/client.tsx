'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Banknote, Bike, Calendar, Check, Car, CheckCircle2, ChevronDown, ChevronUp, Clock, Footprints,
  Loader2, LogOut, Map as MapIcon, MapPin, Navigation, Phone, Power, Route, ShoppingBag,
  TrendingUp, Trophy, X,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';
import { Btn, IconBtn, Avatar, Sheet, Icon as DIcon, Spinner as DSpinner } from './drive-ui';
import { PickDialog } from './pick-dialog';
import { DeliveryView } from './delivery-view';
import { AlarmRinger } from './alarm-ringer';
import { PushRegister } from './push-register';
import { UpdateBanner } from './update-banner';
import { PermissionsGate } from './permissions-gate';
import { startBgLocation, stopBgLocation, updateBatchId } from './bg-location';


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
  created_at?: string | null;
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
  driver, miseDriverId, initialStatus, initialOpenBatches, initialActiveBatch, initialWaitingBatches = [],
}: {
  driver: Driver;
  miseDriverId: string | null;
  initialStatus: Status | null;
  initialOpenBatches: OpenBatch[];
  initialActiveBatch: ActiveBatch | null;
  initialWaitingBatches?: { batch_id: string; orders: { order_id: string; bestellnummer: string; kunde_name: string; kunde_adresse: string; picked: boolean }[] }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [openBatches, setOpenBatches] = useState(initialOpenBatches);
  const [activeBatch, setActiveBatch] = useState(initialActiveBatch);
  // Server-Daten -> lokalen State syncen: macht router.refresh() wirksam (kein Full-Reload noetig)
  useEffect(() => { setActiveBatch(initialActiveBatch); }, [initialActiveBatch]);
  useEffect(() => { setOpenBatches(initialOpenBatches); }, [initialOpenBatches]);
  // Externe Links im System oeffnen; Per-Stop-Navi bevorzugt die Google-Maps-App (sonst macht iOS Apple Maps auf).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!(/^https?:\/\//i.test(href) && a.getAttribute('target') === '_blank')) return;
      e.preventDefault();
      const destM = /[?&]destination=([^&]+)/.exec(href);
      const hasWaypoints = /[?&]waypoints=/.test(href);
      if (/google\.com\/maps/.test(href) && destM && !hasWaypoints) {
        // Google-Maps-App erzwingen; wenn nicht installiert (App bleibt im Vordergrund) -> Web-Fallback
        const appUrl = `comgooglemaps://?daddr=${destM[1]}&directionsmode=driving`;
        let switched = false;
        const onHide = () => { switched = true; };
        document.addEventListener('visibilitychange', onHide, { once: true });
        try { window.location.href = appUrl; } catch { /* noop */ }
        window.setTimeout(() => {
          document.removeEventListener('visibilitychange', onHide);
          if (!switched) { try { window.open(href, '_blank'); } catch { location.href = href; } }
        }, 800);
        return;
      }
      try { window.open(href, '_blank'); } catch { location.href = href; }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  // Heartbeat: meldet "App aktiv" -> push-flush laesst den VoIP-Anruf weg solange du in der App bist
  useEffect(() => {
    async function beat() {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const { data } = await supabase.auth.getSession();
        const tok = data.session?.access_token;
        await fetch('/api/driver/v1/me/heartbeat', { method: 'POST', headers: tok ? { authorization: `Bearer ${tok}` } : {} });
      } catch { /* noop */ }
    }
    beat();
    const iv = setInterval(beat, 15000);
    const onVis = () => { if (document.visibilityState === 'visible') beat(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [supabase]);
  const [pending, startTransition] = useTransition();

  const isOnline = status?.ist_online ?? false;
  // GPS-Zustand wird von bg-location.ts verwaltet (kein lokaler Ref noetig)
  const lastGpsPushRef = useRef<number>(0);
  const [gpsOk, setGpsOk] = useState<boolean | null>(null);
  const gpsAuthFailsRef = useRef(0);
  const [authLost, setAuthLost] = useState(false);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const [gpsLastAt, setGpsLastAt] = useState<number | null>(null);
  const [gpsCalibrating, setGpsCalibrating] = useState(false);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickOrderId, setPickOrderId] = useState<string | null>(null);
  const [pickItems, setPickItems] = useState<any[]>([]);
  // Artikel-Anzahl pro Bestellung (fuer die Drive "Zu picken"-Karten)
  const [pickCounts, setPickCounts] = useState<Map<string, number>>(new Map());
  // F1 Route-Popup: nach komplettem Pickup ("Alles abgeholt. Beste Route fertig")
  const [routeSheet, setRouteSheet] = useState<{ stops: number; km: number | null } | null>(null);
  const [decliningBatch, setDecliningBatch] = useState<string | null>(null);
  const [showShiftEnd, setShowShiftEnd] = useState(false);
  const [shiftSnapshot, setShiftSnapshot] = useState<{
    deliveries: number; tours: number; distKm: number; betrag: number; onlineMin: number;
  } | null>(null);

  // Kapazitäts-Badge: CAP_BASE = 4 Stopps (Standard, aus Config)
  const CAP_BASE = 4;
  // Audio-Ton für neue Tours
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevOpenBatchIdsRef = useRef<Set<string>>(new Set(initialOpenBatches.map((b) => b.batch_id)));
  // Bundling-Hint: zeige "Wird gebündelt..." wenn keine offenen Batches aber fertige Orders warten
  const [bundlingHint, setBundlingHint] = useState(false);

  // Betriebsnachrichten vom Dispatch
  const [broadcasts, setBroadcasts] = useState<{ id: string; message: string; priority: string; sentByName: string | null; createdAt: string }[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => {
      fetch('/api/delivery/driver/messages')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (Array.isArray(d?.messages)) setBroadcasts(d.messages); })
        .catch(() => {});
    };
    if (isOnline) {
      load();
      const iv = setInterval(load, 60_000);
      return () => clearInterval(iv);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  function dismissBroadcast(id: string) {
    setDismissedIds(prev => new Set([...prev, id]));
    fetch('/api/delivery/driver/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ broadcast_id: id }),
    }).catch(() => {});
  }

  const visibleBroadcasts = broadcasts.filter(b => !dismissedIds.has(b.id));

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

  // Artikel-Anzahl pro Bestellung laden (Pick-Phase) -> "N Artikel" auf den Karten
  useEffect(() => {
    if (!activeBatch || activeBatch.status === 'unterwegs') return;
    const orderIds = activeBatch.stops.map((s) => s.order_id).filter(Boolean);
    if (orderIds.length === 0) return;
    (async () => {
      const { data } = await supabase.from('order_items')
        .select('order_id, menge')
        .in('order_id', orderIds);
      if (!data) return;
      const m = new Map<string, number>();
      for (const row of data as { order_id: string; menge: number }[]) {
        m.set(row.order_id, (m.get(row.order_id) ?? 0) + (row.menge ?? 1));
      }
      setPickCounts(m);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBatch?.id, activeBatch?.status]);

  // Fetch Items wenn Pick-Dialog geöffnet wird
  useEffect(() => {
    if (!pickOpen || !activeBatch) return;
    // Items kommen server-seitig mit dem Batch (Service-Role, RLS-frei) — kein Client-Query
    const all = (activeBatch.stops ?? []).flatMap((s: any) =>
      (((s.order?.items ?? []) as any[]).map((it) => ({ ...it, order_id: it.order_id ?? s.order_id }))));
    const seen = new Set<string>();
    const dedup = all.filter((it) => { if (seen.has(it.id)) return false; seen.add(it.id); return true; });
    setPickItems(pickOrderId ? dedup.filter((it) => it.order_id === pickOrderId) : dedup);
  }, [pickOpen, activeBatch, supabase, pickOrderId]);

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

  /* Beim Zurueckkommen in die App (z.B. nach CallKit-Anruf) frisch laden -> neue Tour erscheint */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && !activeBatch && !pickOpen) {
        router.refresh();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [activeBatch, pickOpen]);

  /* Während aktiver Tour: 30-s-Polling als Realtime-Fallback — Storno/Requeue
     durch die Zentrale muss den Fahrer auch bei totem WebSocket erreichen. */
  useEffect(() => {
    if (!activeBatch) return;
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [activeBatch?.id]);

  /* Access-Token gecacht halten: getSession() pro GPS-Fix kann im Feld hängen (navigator.locks),
     dann gehen Positions-Updates verloren und der Fahrer fliegt aus dem Dispatch-Pool. */
  const accessTokenRef = useRef<string>('');
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) accessTokenRef.current = data.session.access_token;
    }).catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Token IMMER nachziehen — auch invalidieren, sonst laufen GPS-POSTs
      // nach Session-Ablauf ewig mit dem alten Token in 401 (Fahrer fliegt still aus dem Pool).
      accessTokenRef.current = session?.access_token ?? '';
      if (event === 'SIGNED_OUT') setAuthLost(true);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* GPS-Tracking: bei Online-Status → bg-location.ts (Capacitor+PWA, Wake Lock, sendBeacon, Offline-Queue) */
  useEffect(() => {
    if (!isOnline) {
      stopBgLocation();
      return;
    }
    if (!('geolocation' in navigator)) { setGpsOk(false); return; }

    // Hilfsfunktion: Position an Server senden (mit React-State-Update)
    const pushFn = async (fix: { lat: number; lng: number; heading?: number | null; speed_kmh?: number | null; accuracy_m?: number | null }) => {
      const accuracy = fix.accuracy_m ?? null;
      // Genauigkeits-Check: > 100m ignorieren
      if (accuracy != null && accuracy > 100) {
        setGpsCalibrating(true);
        return;
      }
      setGpsCalibrating(false);
      setGpsOk(true);
      if (fix.speed_kmh != null) setGpsSpeed(Math.round(fix.speed_kmh));
      setDriverPos({ lat: fix.lat, lng: fix.lng });
      const now = Date.now();
      setGpsLastAt(now);
      if (now - lastGpsPushRef.current < 10000) return; // max alle 10s
      lastGpsPushRef.current = now;

      const token = accessTokenRef.current;
      if (!token) return; // Token noch nicht da — nächster Fix nimmt ihn mit
      const res = await fetch('/api/driver/v1/me/position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ lat: fix.lat, lng: fix.lng, heading: fix.heading ?? null, speed_kmh: fix.speed_kmh ?? null, accuracy_m: accuracy }),
      });
      if (res.status === 401) {
        // Session abgelaufen: einmal aktiv refreshen; klappt das nicht, Fahrer laut warnen.
        gpsAuthFailsRef.current += 1;
        const { data, error } = await supabase.auth.refreshSession();
        if (data.session?.access_token) {
          accessTokenRef.current = data.session.access_token;
          gpsAuthFailsRef.current = 0;
          setAuthLost(false);
        } else if (error || gpsAuthFailsRef.current >= 3) {
          setAuthLost(true);
        }
      } else if (res.ok) {
        gpsAuthFailsRef.current = 0;
      }
    };

    startBgLocation(pushFn, activeBatch?.id ?? null).catch(() => setGpsOk(false));

    return () => stopBgLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  /* Batch-ID an bg-location weitergeben wenn sich activeBatch aendert */
  useEffect(() => {
    updateBatchId(activeBatch?.id ?? null);
  }, [activeBatch?.id]);

  /* Audio-Ton + Bundling-Hint: reagiert auf neue openBatches */
  useEffect(() => {
    const currentIds = new Set(openBatches.map((b) => b.batch_id));
    const isNew = openBatches.some((b) => !prevOpenBatchIdsRef.current.has(b.batch_id));
    prevOpenBatchIdsRef.current = currentIds;
    if (isNew && isOnline && typeof document !== 'undefined' && !document.hidden) {
      // Bundling-Hint ausblenden, da Tour jetzt da
      setBundlingHint(false);
      // Audio-Ton abspielen (kurzer Doppel-Beep)
      try {
        const ctx = new AudioContext();
        const play = (freq: number, startTime: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.35, startTime + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
          osc.start(startTime);
          osc.stop(startTime + 0.25);
        };
        play(880, ctx.currentTime);
        play(1100, ctx.currentTime + 0.18);
      } catch { /* AudioContext blockiert -> kein Ton, kein Crash */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBatches]);

  /* Bundling-Hint: Realtime auf fertige Orders ohne Batch -> zeige "Wird gebündelt" */
  useEffect(() => {
    if (!isOnline || !!activeBatch || openBatches.length > 0) { setBundlingHint(false); return; }
    if (!miseDriverId) return;
    // Erst-Check: gibt es fertige Orders ohne Batch?
    (async () => {
      const { count } = await supabase
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('typ', 'lieferung')
        .eq('status', 'fertig')
        .is('mise_batch_id', null)
        .is('mise_driver_id', null);
      if ((count ?? 0) > 0) setBundlingHint(true);
    })();
    // Realtime: lausche auf Statuswechsel zu "fertig"
    const ch = supabase
      .channel('bundling-hint')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: 'status=eq.fertig',
      }, (payload: any) => {
        if (!payload.new.mise_batch_id && !payload.new.mise_driver_id) setBundlingHint(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, !!activeBatch, openBatches.length]);

  /* Push-Subscribe beim ersten Online-Gehen */
  useEffect(() => {
    if (!isOnline) return;
    ensureBrowserPushSubscription().catch(() => {});
  }, [isOnline]);

  /* Realtime: refresh bei Änderungen in Legacy- UND Mise-Tabellen.
     Subscribe-Status wird ausgewertet: bei CHANNEL_ERROR/TIMED_OUT/CLOSED
     wird mit Backoff neu verbunden — sonst friert die App bei totem wss ein
     (das 30-s-Polling während aktiver Tour bleibt als zweites Netz). */
  useEffect(() => {
    let disposed = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed) return;
      ch = supabase
        .channel(`fahrer-app-${retry}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batches' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batch_stops' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_status', filter: `employee_id=eq.${driver.id}` }, refresh)
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') { retry = 0; return; }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (ch) { supabase.removeChannel(ch); ch = null; }
            const delayMs = Math.min(30_000, 2_000 * 2 ** retry);
            retry += 1;
            retryTimer = setTimeout(connect, delayMs);
          }
        });
    };
    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ch) supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    router.refresh();
  }

  async function goOffline() {
    setShowShiftEnd(false);
    startTransition(async () => {
      if (miseDriverId) {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/driver/v1/session/end', {
          method: 'POST',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          alert((body as { error?: string }).error ?? 'Schicht konnte nicht beendet werden.');
          return;
        }
      }
      await supabase.from('driver_status').upsert({
        employee_id: driver.id, ist_online: false, fahrzeug: driver.fahrzeug_praeferenz, online_seit: null,
      });
      setStatus((s) => ({ ...(s ?? { employee_id: driver.id, fahrzeug: driver.fahrzeug_praeferenz, aktueller_batch_id: null, online_seit: null }), ist_online: false, online_seit: null }));
    });
  }

  async function toggleOnline() {
    const next = !isOnline;
    if (!next) {
      // Going offline — aggregate Legacy + Mise Batches für Schicht-Zusammenfassung
      const today = new Date(); today.setHours(0, 0, 0, 0);

      // Parallel: Legacy + Mise Batches abrufen
      const [
        { data: legacyBatches },
        { data: miseBatchesRaw },
      ] = await Promise.all([
        supabase
          .from('delivery_batches')
          .select('id, total_distance_km')
          .eq('fahrer_id', driver.id)
          .gte('created_at', today.toISOString()),
        miseDriverId
          ? supabase
              .from('mise_delivery_batches')
              .select('id, total_distance_km')
              .eq('driver_id', miseDriverId)
              .gte('created_at', today.toISOString())
          : Promise.resolve({ data: [] }),
      ]);

      const [
        { data: legacyStops },
        { data: miseStops },
      ] = await Promise.all([
        (legacyBatches as any[])?.length
          ? supabase
              .from('delivery_batch_stops')
              .select('id, order:customer_orders(gesamtbetrag)')
              .in('batch_id', (legacyBatches as any[]).map((b: any) => b.id))
              .not('geliefert_am', 'is', null)
          : Promise.resolve({ data: [] }),
        (miseBatchesRaw as any[])?.length
          ? supabase
              .from('mise_delivery_batch_stops')
              .select('id, completed_at, type, order:customer_orders(gesamtbetrag)')
              .in('batch_id', (miseBatchesRaw as any[]).map((b: any) => b.id))
              .eq('type', 'dropoff')
              .not('completed_at', 'is', null)
          : Promise.resolve({ data: [] }),
      ]);

      const totalDeliveries = ((legacyStops as any[])?.length ?? 0) + ((miseStops as any[])?.length ?? 0);
      const totalTours = ((legacyBatches as any[])?.length ?? 0) + ((miseBatchesRaw as any[])?.length ?? 0);

      if (totalDeliveries > 0) {
        const legacyBetrag = ((legacyStops as any[]) ?? []).reduce((s: number, st: any) => s + (st.order?.gesamtbetrag ?? 0), 0);
        const miseBetrag = ((miseStops as any[]) ?? []).reduce((s: number, st: any) => s + (st.order?.gesamtbetrag ?? 0), 0);
        const legacyDist = ((legacyBatches as any[]) ?? []).reduce((s: number, b: any) => s + (b.total_distance_km ?? 0), 0);
        const miseDist = ((miseBatchesRaw as any[]) ?? []).reduce((s: number, b: any) => s + (b.total_distance_km ?? 0), 0);
        const onlineMin = status?.online_seit
          ? Math.floor((Date.now() - new Date(status.online_seit as string).getTime()) / 60_000)
          : 0;
        setShiftSnapshot({
          deliveries: totalDeliveries,
          tours: totalTours,
          distKm: legacyDist + miseDist,
          betrag: legacyBetrag + miseBetrag,
          onlineMin,
        });
        setShowShiftEnd(true);
        return;
      }
      await goOffline();
      return;
    }
    // Going online
    startTransition(async () => {
      try {
        await ensureBrowserPushSubscription();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Browser-Benachrichtigungen konnten nicht aktiviert werden.');
        return;
      }
      if (miseDriverId) {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/driver/v1/session/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({}),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          alert((body as { error?: string }).error ?? 'Schicht konnte nicht gestartet werden.');
          return;
        }
      }
      await supabase.from('driver_status').upsert({
        employee_id: driver.id, ist_online: true, fahrzeug: driver.fahrzeug_praeferenz,
        online_seit: new Date().toISOString(),
      });
      setStatus((s) => ({ ...(s ?? { employee_id: driver.id, fahrzeug: driver.fahrzeug_praeferenz, aktueller_batch_id: null, online_seit: null }), ist_online: true, online_seit: new Date().toISOString() }));
    });
  }

  async function ensureBrowserPushSubscription(): Promise<void> {
    const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (capacitor?.isNativePlatform?.()) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      throw new Error('Dieser Browser unterstützt keine Fahrer-Benachrichtigungen. Bitte Chrome oder Safari verwenden.');
    }
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== 'granted') {
      throw new Error('Bitte Benachrichtigungen erlauben, bevor du online gehst.');
    }
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) throw new Error('Fahrer-Benachrichtigungen sind nicht konfiguriert.');
    // Browser-Fahrer landen direkt auf /fahrer/app ohne Install-Seite — SW hier registrieren,
    // sonst wartet serviceWorker.ready für immer.
    if (!(await navigator.serviceWorker.getRegistration('/fahrer'))) {
      await navigator.serviceWorker.register('/sw.js', { scope: '/fahrer' });
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription()
      ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid).buffer as ArrayBuffer,
      });
    const response = await fetch('/api/drivers/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? 'Browser-Benachrichtigung konnte nicht gespeichert werden.');
    }
  }

  async function claimBatch(batchId: string) {
    const batch = openBatches.find((b) => b.batch_id === batchId);
    const isMise = batch?.source_system === 'mise';
    startTransition(async () => {
      if (isMise) {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/driver/v1/orders/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ batch_id: batchId }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          alert((body as { error?: string }).error ?? 'Tour konnte nicht angenommen werden.');
          return;
        }
      } else {
        await supabase.rpc('claim_delivery_batch', { p_batch_id: batchId });
      }
      // Voller Reload: page.tsx laedt den jetzt-aktiven Batch -> Tour erscheint zuverlaessig
      window.location.reload();
    });
  }

  // Order WAEHREND aktiver Tour annehmen -> in aktiven Batch mergen (F4, 10-incoming-on-tour)
  async function acceptDuringTour(orderBatchId: string) {
    if (!activeBatch) return;
    startTransition(async () => {
      if (activeBatch.status === 'unterwegs') {
        // Waehrend Liefern: separate Warte-Tour (claimen) — NICHT in die laufende Route mergen (Kuechen-JIT)
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/driver/v1/orders/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ batch_id: orderBatchId }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          alert((body as { error?: string }).error ?? 'Wartetour konnte nicht angenommen werden.');
          return;
        }
      } else {
        // Waehrend Picken: in die aktive Tour mergen
        await supabase.rpc('merge_mise_order_into_active_batch', { p_active_batch_id: activeBatch.id, p_order_batch_id: orderBatchId });
      }
      window.location.reload();
    });
  }

  // F3: Tour ablehnen -> zurueck in den Pool / an naechsten Fahrer
  async function declineBatch(batchId: string) {
    setDecliningBatch(batchId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/driver/v1/orders/decline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ batch_id: batchId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as any)?.error ?? 'Ablehnen fehlgeschlagen');
        return;
      }
      // Tour aus der lokalen Liste entfernen + frischen Stand laden
      setOpenBatches((xs) => xs.filter((b) => b.batch_id !== batchId));
      window.location.reload();
    } finally {
      setDecliningBatch(null);
    }
  }

  // F1: nach komplettem Pickup Route-Infos holen und Bestaetigungs-Sheet zeigen
  async function showRouteSheetAfterPickup(activeBatchId: string) {
    let stopsCount = 0;
    let km: number | null = null;
    try {
      const { data: batch } = await supabase
        .from('mise_delivery_batches')
        .select('total_distance_km, stops:mise_delivery_batch_stops(type)')
        .eq('id', activeBatchId)
        .maybeSingle();
      if (batch) {
        km = (batch as any).total_distance_km ?? null;
        stopsCount = (((batch as any).stops ?? []) as { type: string }[])
          .filter((s) => s.type === 'dropoff').length;
      }
    } catch { /* Sheet auch ohne exakte Zahlen zeigen */ }
    setRouteSheet({ stops: stopsCount, km });
  }

  // Alle Orders gepickt -> Batch-Pickup abschliessen + Route-Sheet (das eigentliche "losfahren")
  async function completeAndRoute(batchId: string) {
    startTransition(async () => {
      const { data: result, error } = await supabase.rpc('confirm_pickup_complete', { p_batch_id: batchId });
      if (error) {
        alert(error.message.includes('PICK_REQUIRED')
          ? 'Noch nicht alle Artikel bestätigt — bitte jede Bestellung in der Liste durchgehen.'
          : `Route konnte nicht gestartet werden: ${error.message}`);
        return;
      }
      const r = result as { ok?: boolean; error?: string } | null;
      if (r && r.ok === false) {
        alert(r.error ?? 'Noch nicht alles in der Tüte — bitte alle Bestellungen durchgehen.');
        return;
      }
      // Google-Maps-Route optimieren (beste Stopp-Reihenfolge)
      try {
        const { data } = await supabase.auth.getSession();
        const tok = data.session?.access_token;
        await fetch(`/api/driver/v1/batch/${batchId}/reroute`, { method: 'POST', headers: tok ? { authorization: `Bearer ${tok}` } : {} });
      } catch { /* noop */ }
      // Keine Zwischenseite: direkt in die Lieferansicht (Founder-Vorgabe 12.08.)
      router.refresh();
    });
  }

  async function markDelivered(stopId: string) {
    startTransition(async () => {
      const stop = activeBatch?.stops.find((s) => s.id === stopId);
      if (stop?.order_id) {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token ?? '';
        await fetch('/api/driver/v1/orders/' + stop.order_id + '/delivered', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ photo_url: null, signature: null }),
        });
      } else {
        const now = new Date().toISOString();
        await supabase.from('mise_delivery_batch_stops').update({ completed_at: now }).eq('id', stopId);
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
    <>
    <div className="min-h-screen pb-24">
      {/* Auth-Verlust: Session abgelaufen und Refresh gescheitert — laut warnen, sonst
          verschwindet der Fahrer still aus dem Dispatch-Pool (GPS-401s). */}
      {authLost && (
        <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 bg-[var(--danger)] px-4 py-3 text-white">
          <div className="text-sm font-bold">Anmeldung abgelaufen — du bekommst keine Touren mehr!</div>
          <a href="/fahrer/login" className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-black">
            Neu anmelden
          </a>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg)] px-4 py-4 border-b border-[var(--line)]">
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-11 w-11 rounded-2xl flex items-center justify-center',
            isOnline ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)]',
          )}>
            <Bike size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ink-2)]">Fahrer</div>
            <div className="font-display font-bold truncate">{driver.vorname} {driver.nachname}</div>
          </div>
          {/* Kapazitäts-Badge: zeige Stopp-Auslastung wenn online + aktiver Batch */}
          {isOnline && activeBatch && (() => {
            const stopCount = activeBatch.stops.length;
            const bg = stopCount < 3 ? '#16a34a' : stopCount === 3 ? '#ea580c' : '#dc2626';
            return (
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 9px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                  background: bg, color: '#fff',
                }}
                title={`${stopCount} von ${CAP_BASE} Stopps belegt`}
              >
                <MapPin size={12} />
                {stopCount}/{CAP_BASE}
              </div>
            );
          })()}
          <button
            onClick={logout}
            className="h-10 w-10 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--accent-tint)] flex items-center justify-center"
            aria-label="Abmelden"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-5">
        {/* Betriebsnachrichten vom Dispatch */}
        {visibleBroadcasts.map(b => (
          <div
            key={b.id}
            className={cn(
              'flex items-start gap-3 rounded-2xl border px-4 py-3 animate-in slide-in-from-top-2 duration-200',
              b.priority === 'urgent'
                ? 'border-[var(--danger)]/40 bg-[var(--danger-tint)] text-[var(--danger)]'
                : 'border-[var(--accent)]/40 bg-[var(--accent-tint)] text-[var(--accent)]',
            )}
          >
            <span className="text-lg shrink-0">{b.priority === 'urgent' ? '🚨' : '📢'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{b.message}</p>
              {b.sentByName && (
                <p className="text-[10px] opacity-60 mt-0.5">{b.sentByName}</p>
              )}
            </div>
            <button
              onClick={() => dismissBroadcast(b.id)}
              className="shrink-0 opacity-50 hover:opacity-100 transition p-1"
              aria-label="Schließen"
            >
              ×
            </button>
          </div>
        ))}

        {/* Online Toggle — im Drive-Warte-Screen steckt der Offline-Button in der Fahrer-Leiste */}
        {false && (
          <section>
            <button
              onClick={toggleOnline}
              disabled={pending}
              className={cn(
                'w-full rounded-3xl p-5 font-display font-bold text-lg flex items-center gap-4 transition active:scale-[0.98]',
                isOnline
                  ? 'bg-[var(--accent)] text-white shadow-lg'
                  : 'bg-[var(--surface-2)] border-2 border-[var(--line)] text-[var(--ink-2)]',
              )}
            >
              <div className={cn(
                'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0',
                isOnline ? 'bg-white text-accent' : 'bg-[var(--surface-2)]',
              )}>
                <Power size={26} />
              </div>
              <div className="text-left flex-1">
                <div className="text-xl">{isOnline ? 'Du bist online' : 'Los geht’s'}</div>
                <div className={cn('text-sm font-normal mt-0.5', isOnline ? 'text-[var(--ink)]/70' : 'text-[var(--ink-3)]')}>
                  {isOnline ? 'Tippe hier zum Offline-Gehen' : 'Tippe um online zu gehen'}
                </div>
              </div>
            </button>
            {isOnline && !activeBatch && (
              <>

                {/* GPS-Status */}
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  {gpsOk === false && <span className="text-[var(--danger)]">⚠️ GPS blockiert — in Safari/Chrome Standort erlauben</span>}
                  {gpsCalibrating && <span className="text-[var(--ink-2)]">📍 GPS wird kalibriert…</span>}
                  {gpsOk === true && !gpsCalibrating && (() => {
                    const ageMs = gpsLastAt ? Date.now() - gpsLastAt : null;
                    if (ageMs != null && ageMs > 60000) {
                      return (
                        <button
                          className="text-[var(--danger)] font-semibold"
                          onClick={() => { navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }); }}
                        >
                          🔴 GPS veraltet ({Math.round(ageMs / 1000)}s) — Antippen zum Neustarten
                        </button>
                      );
                    }
                    if (ageMs != null && ageMs > 30000) {
                      return <span className="text-[var(--warning,#f59e0b)] font-semibold">⚠️ GPS schwach — vor {Math.round(ageMs / 1000)}s</span>;
                    }
                    return <span className="text-accent">📍 GPS aktiv</span>;
                  })()}
                  {gpsOk === null && !gpsCalibrating && <span className="text-[var(--ink-3)]">📍 Warte auf GPS-Signal…</span>}
                </div>
              </>
            )}
          </section>
        )}

        {/* Schwebende Box: Naechste Bestellungen waehrend der Tour (Vision: wird vorbereitet) */}
        {activeBatch && isOnline && openBatches.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 8px' }}>
              <DIcon name="bell" size={15} stroke={2.2} style={{ color: 'var(--accent)' }} className="ring-anim" />
              <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-2)' }}>Naechste Bestellungen</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{openBatches.length}</span>
            </div>
            {openBatches.map((b) => {
              const ks = kitchenStatuses.get(b.order_id);
              const ready = !ks || ks === 'fertig' || ks === 'unterwegs';
              const sLabel = ready ? 'Abholbereit' : 'Wird vorbereitet';
              const sColor = ready ? 'var(--accent)' : 'var(--warn)';
              const sBg = ready ? 'var(--accent-tint)' : 'var(--warn-tint)';
              return (
                <div key={b.batch_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, background: 'var(--surface)', borderRadius: 16, marginBottom: 8, boxShadow: 'inset 0 0 0 1px var(--line), 0 2px 10px -6px rgba(0,0,0,.14)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: sBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <DIcon name={ready ? 'bag' : 'clock'} size={19} stroke={2} style={{ color: sColor }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>Neue Bestellung <span className="mono" style={{ color: 'var(--ink-2)' }}>#{(b.bestellnummer || '').slice(-4)}</span></div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.kunde_name} · {b.kunde_adresse}</div>
                    <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, color: sColor, background: sBg, padding: '2px 8px', borderRadius: 7 }}>{sLabel}</span>
                  </div>
                  <Btn size="sm" full={false} onClick={() => acceptDuringTour(b.batch_id)} disabled={pending} icon="plus">Dazunehmen</Btn>
                </div>
              );
            })}
          </section>
        )}

        {/* Active Batch — NEUE Delivery-View wenn unterwegs */}
        {/* Kuechen-JIT: waehrend Liefern angenommene Orders warten auf Abholung (werden vorbereitet) */}
        {activeBatch && activeBatch.status === 'unterwegs' && initialWaitingBatches.length > 0 && (
          <section style={{ margin: '0 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 8px' }}>
              <DIcon name="clock" size={15} stroke={2.2} style={{ color: 'var(--warn)' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-2)' }}>Wartet auf Abholung</span>
            </div>
            {initialWaitingBatches.flatMap((wb) => wb.orders).map((ord) => (
              <div key={ord.order_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, background: 'var(--surface)', borderRadius: 16, marginBottom: 8, boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: ord.picked ? 'var(--accent-tint)' : 'var(--warn-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <DIcon name={ord.picked ? 'bag' : 'clock'} size={19} stroke={2} style={{ color: ord.picked ? 'var(--accent)' : 'var(--warn)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{ord.kunde_name} <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 12 }}>#{(ord.bestellnummer || '').slice(-4)}</span></div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ord.kunde_adresse}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: ord.picked ? 'var(--accent)' : 'var(--warn)', background: ord.picked ? 'var(--accent-tint)' : 'var(--warn-tint)', padding: '4px 9px', borderRadius: 8, whiteSpace: 'nowrap' }}>{ord.picked ? 'abholbereit' : 'wird vorbereitet'}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', marginTop: 4 }}>Nach deinen Lieferungen zurueck zum Restaurant abholen.</div>
          </section>
        )}

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

        {/* Active Batch — Pick-Phase: Drive "Zu picken" (03/04-orders.png) */}
        {activeBatch && activeBatch.status !== 'unterwegs' && (() => {
          const stops = activeBatch.stops.slice().sort((a, b) => a.reihenfolge - b.reihenfolge);
          const total = stops.length;
          const isOrderPicked = (s: any) => { const its = (s.order?.items ?? []) as any[]; return its.length > 0 && its.every((it) => it.pick_confirmed_at); };
          const pickedCount = stops.filter(isOrderPicked).length;
          const allPicked = total > 0 && pickedCount === total;
          const hubName = (activeBatch as any).location_name
            || (driver as any).hub_name
            || 'Restaurant';
          const readyCount = stops.filter((s) => {
            const ks = kitchenStatuses.get(s.order_id);
            return ks === 'fertig' || ks === 'unterwegs';
          }).length;
          const cookingCount = stops.filter((s) => kitchenStatuses.get(s.order_id) === 'in_zubereitung').length;
          const allReady = total > 0 && readyCount === total;
          const cashStops = stops.filter((s) => {
            const o = s.order as any;
            return o.zahlungsart === 'bar' || o.bezahlt === false;
          });
          const totalCash = cashStops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          // Maps-Routenvorschau (alle Stops mit Koordinaten)
          const withCoords = stops.filter((s) => s.order.kunde_lat && s.order.kunde_lng);
          const mapsUrl = (() => {
            if (withCoords.length === 0) return null;
            const dest = `${withCoords[withCoords.length - 1].order.kunde_lat},${withCoords[withCoords.length - 1].order.kunde_lng}`;
            const waypoints = withCoords.slice(0, -1).map((s) => `${s.order.kunde_lat},${s.order.kunde_lng}`).join('|');
            return waypoints
              ? `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`
              : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
          })();

          // ETA Berechnung: total_eta_min aus Batch oder Schätzung
          const totalEtaMin = activeBatch.total_eta_min
            ?? (total > 0 ? Math.round((total * 8) + 5) : null);
          const etaPerStop = totalEtaMin && total > 0 ? Math.round(totalEtaMin / total) : null;

          return (
          <section style={{ margin: '-24px -16px 0' }}>
            {/* Drive-Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 18px 12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--ink)' }}>Zu picken</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 2 }}>
                  {total} {total === 1 ? 'Bestellung' : 'Bestellungen'} · {hubName}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px 5px 9px',
                  borderRadius: 9, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1,
                  background: 'var(--accent-tint)', color: 'var(--accent)',
                }}>
                  <DIcon name="bag" size={14} stroke={2.4} />{readyCount}/{total}
                </span>
                {totalEtaMin != null && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px',
                    borderRadius: 9, fontSize: 11.5, fontWeight: 700,
                    background: 'var(--surface-2)', color: 'var(--ink-2)',
                  }}>
                    <Clock size={12} />~{totalEtaMin} min
                  </span>
                )}
              </div>
            </div>

            {/* Küche / Bar — schlanke Drive-Hinweiszeile */}
            {(cookingCount > 0 || totalCash > 0) && (
              <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', flexWrap: 'wrap' }}>
                {cookingCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 9,
                    fontSize: 12.5, fontWeight: 700, background: 'var(--warn-tint)', color: 'var(--warn)',
                  }}>{cookingCount} kocht noch</span>
                )}
                {totalCash > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 9,
                    fontSize: 12.5, fontWeight: 700, background: 'var(--warn-tint)', color: 'var(--warn)',
                  }}>
                    <Banknote size={14} /> Bar kassieren · {euro(totalCash)}
                  </span>
                )}
              </div>
            )}

            {/* Order-Karten (Drive 03/04) */}
            <div style={{ padding: '2px 16px 12px' }}>
              {stops.map((stop) => {
                const o = stop.order as any;
                const picked = isOrderPicked(stop);
                const isCash = o.zahlungsart === 'bar' || o.bezahlt === false;
                const ks = kitchenStatuses.get(stop.order_id) ?? null;
                const kitchenReady = ks === 'fertig' || ks === 'unterwegs';
                const kitchenCooking = ks === 'in_zubereitung';
                const itemCount = pickCounts.get(stop.order_id) ?? null;
                const code = o.bestellnummer?.replace(/^[A-Z]+-?/, '') ?? '';
                return (
                  <button
                    key={stop.id}
                    type="button"
                    className="press"
                    onClick={() => { setPickOrderId(stop.order_id); setPickOpen(true); }}
                    style={{
                      width: '100%', textAlign: 'left', display: 'block', background: 'var(--surface)',
                      borderRadius: 20, padding: 16, marginBottom: 12,
                      boxShadow: '0 2px 10px -6px rgba(0,0,0,.14), inset 0 0 0 1px var(--line)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>#{code}</span>
                      <div style={{ flex: 1 }} />
                      {picked ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px 5px 9px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: 'var(--accent)', color: 'var(--on-accent)' }}>
                          <DIcon name="check" size={14} stroke={2.4} /> In der Tüte
                        </span>
                      ) : kitchenReady ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px 5px 9px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: 'var(--accent-tint)', color: 'var(--accent)' }}>
                          <DIcon name="check" size={14} stroke={2.4} /> Bereit
                        </span>
                      ) : kitchenCooking ? (
                        <span style={{ padding: '5px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: 'var(--warn-tint)', color: 'var(--warn)' }}>Kocht</span>
                      ) : (
                        <span style={{ padding: '5px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--ink-2)' }}>Offen</span>
                      )}
                    </div>
                    {/* ETA + Distanz pro Stopp */}
                    {(() => {
                      const stopIdx = stops.indexOf(stop);
                      const stopEtaMin = etaPerStop != null ? (stopIdx + 1) * etaPerStop : null;
                      const distKm = driverPos && o.kunde_lat && o.kunde_lng
                        ? haversineKm(driverPos, { lat: o.kunde_lat, lng: o.kunde_lng })
                        : null;
                      if (!stopEtaMin && !distKm) return null;
                      return (
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                          {stopEtaMin != null && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
                              <Clock size={11} />~{stopEtaMin} min
                            </span>
                          )}
                          {distKm != null && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
                              <Navigation size={11} />{distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                      <Avatar name={o.kunde_name} size={44} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 16.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.kunde_name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 500, marginTop: 1 }}>
                          <DIcon name="pin" size={14} stroke={2} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.kunde_adresse || '—'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Picken</span>
                        <DIcon name="chevron" size={17} stroke={2.6} />
                      </div>
                    </div>
                    <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, background: 'var(--line)', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                        <div style={{ width: kitchenReady ? '100%' : '0%', height: '100%', background: 'var(--accent)', borderRadius: 99, transition: 'width .45s cubic-bezier(.2,.7,.2,1)' }} />
                      </div>
                      <span style={{ fontSize: 12.5, color: isCash ? 'var(--warn)' : 'var(--ink-3)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {isCash ? `Bar · ${euro(o.gesamtbetrag)}` : itemCount != null ? `${itemCount} Artikel` : euro(o.gesamtbetrag)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer: Maps-Vorschau (sekundär) + Primary Pick-Button */}
            <div style={{ padding: '0 16px' }}>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="press"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%',
                    height: 46, borderRadius: 13, marginBottom: 10, fontSize: 15, fontWeight: 700,
                    background: 'var(--surface-2)', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1.5px var(--line)',
                  }}
                >
                  <DIcon name="route" size={18} stroke={2.2} style={{ color: 'var(--accent)' }} />
                  Route in Maps vorschauen
                </a>
              )}
              {allPicked ? (
                <Btn onClick={() => completeAndRoute(activeBatch.id)} disabled={pending} icon="route">Route berechnen</Btn>
              ) : (
                <Btn onClick={() => { const next = stops.find((s) => !isOrderPicked(s)); setPickOrderId((next ?? stops[0])?.order_id ?? null); setPickOpen(true); }} icon="bag">{`Picken · ${pickedCount}/${total} in der Tüte`}</Btn>
              )}
              <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.5 }}>
                Tippe eine Bestellung → geh jedes Gericht durch. Danach berechnen wir die Route.
              </div>
            </div>
          </section>
          );
        })()}

        {/* Eingehende Tour — echtes Drive-BOTTOM-SHEET (02-incoming.png) zum Annehmen */}
        {!activeBatch && isOnline && openBatches.length > 0 && (
          <div className="fixed inset-0 z-[60]">
            <Sheet dismissable={false} pad={20}>
              <div className="scroll" style={{ overflowY: 'auto' }}>
                <OpenBatchSection
                  openBatches={openBatches}
                  pending={pending}
                  onClaim={claimBatch}
                  onDecline={declineBatch}
                  decliningBatch={decliningBatch}
                  driverPos={driverPos}
                  onExpire={() => router.refresh()}
                />
              </div>
            </Sheet>
          </div>
        )}

        {/* Warte-Anzeige: kein Batch, online, keine offenen Touren — Drive HomeScreen */}
        {!activeBatch && (
          <FahrerWarteAnzeige
            isOnline={isOnline}
            driverId={driver.id}
            driverName={`${driver.vorname} ${driver.nachname}`.trim()}
            vehicle={driver.fahrzeug_praeferenz}
            gpsOk={gpsOk}
            gpsLastAt={gpsLastAt}
            gpsCalibrating={gpsCalibrating}
            onGoOffline={toggleOnline}
            offlinePending={pending}
          />
        )}

        {/* Bundling-Hint: Frank hält eine Order für besseres Bündelungsergebnis */}
        {isOnline && !activeBatch && openBatches.length === 0 && bundlingHint && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            borderRadius: 16, background: 'var(--accent-tint)',
            boxShadow: 'inset 0 0 0 1px var(--accent)/30',
            animation: 'drv-pulse-soft 2s ease-in-out infinite',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <DIcon name="clock" size={18} stroke={2} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>Nächste Tour wird gebündelt…</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>Frank wartet kurz auf nahe Bestellungen, damit du sie zusammen lieferst.</div>
            </div>
          </div>
        )}

        {/* Offline state */}
        {false && (
          <section className="text-center py-8">
            <Power className="h-12 w-12 text-[var(--ink-3)] mx-auto mb-2 opacity-40" />
            <div className="text-[var(--ink-2)]">Du bist offline. Geh online, um Touren anzunehmen.</div>
          </section>
        )}

        {/* Schicht-Statistik — wenn kein aktiver Batch und NICHT im Drive-Warte-Screen */}
        {false && (
          <SchichtStats driverId={driver.id} miseDriverId={miseDriverId} isOnline={isOnline} />
        )}

        {/* Schicht-Buchung — Fahrer können sich für offene Schichten anmelden */}
        {false && driver.location_id && (
          <SchichtBuchung locationId={driver.location_id} />
        )}
      </main>

      <UpdateBanner />

      {/* Alarm-Ringer: klingelt wenn Tour in Open-Liste (zum Annehmen) ODER zugewiesen (zum Picken) */}
      <PushRegister />
      <AlarmRinger
        openBatchIds={openBatches.map((b) => b.batch_id)}
        assignedBatchId={activeBatch?.status === 'zugewiesen' && !pickOpen ? activeBatch.id : null}
      />

      {pickOpen && activeBatch && (
        <PickDialog
          orderBestellnummer={(activeBatch.stops.find((s) => s.order_id === pickOrderId)?.order.bestellnummer) ?? activeBatch.stops[0]?.order.bestellnummer ?? ''}
          items={pickItems}
          batchId={activeBatch.id}
          onClose={() => setPickOpen(false)}
          onComplete={() => {
            // Geführter Flow: nächste ungepickte Order öffnet sich automatisch;
            // nach der letzten wird direkt die Route berechnet (keine Zwischenseite).
            const nextUnpicked = activeBatch.stops.find((s: any) => {
              if (!s.order_id || s.order_id === pickOrderId) return false;
              const its = (s.order?.items ?? []) as any[];
              return !(its.length > 0 && its.every((it: any) => it.pick_confirmed_at));
            });
            if (nextUnpicked) {
              setPickOrderId(nextUnpicked.order_id);
              router.refresh();
            } else {
              setPickOpen(false);
              completeAndRoute(activeBatch.id);
            }
          }}
        />
      )}

      {/* F1: Route-Bestaetigungs-Sheet nach komplettem Pickup */}
      {routeSheet && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setRouteSheet(null)}>
          <div
            className="w-full max-w-md bg-[var(--surface)] border-t border-[var(--line)] rounded-t-[30px] p-6 pb-8 animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--line)]" />
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-[var(--accent-tint)] text-accent grid place-items-center mb-4">
                <Route size={30} />
              </div>
              <div className="font-display font-bold text-xl">Alles abgeholt</div>
              <div className="mt-1 text-sm text-[var(--ink-2)]">Beste Route fertig</div>
              <div className="mt-3 flex items-center justify-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5">
                  <MapPin size={14} className="text-accent" />
                  <span className="mono font-bold">{routeSheet.stops}</span>
                  <span className="text-[var(--ink-3)]">{routeSheet.stops === 1 ? 'Stopp' : 'Stopps'}</span>
                </span>
                {routeSheet.km != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5">
                    <Navigation size={14} className="text-accent" />
                    <span className="mono font-bold">{routeSheet.km}</span>
                    <span className="text-[var(--ink-3)]">km</span>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => { setRouteSheet(null); router.refresh(); }}
              className="mt-6 w-full h-14 rounded-[17px] bg-[var(--accent)] text-white font-bold text-lg inline-flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-[0_6px_18px_-8px_var(--accent)]"
            >
              <Navigation size={18} />
              Losfahren
            </button>
          </div>
        </div>
      )}

      {/* Schicht-Abschluss Modal */}
      {showShiftEnd && shiftSnapshot && (
        <SchichtAbschlussModal
          snapshot={shiftSnapshot}
          onConfirm={goOffline}
          onCancel={() => setShowShiftEnd(false)}
        />
      )}
    </div>
    </>
  );
}

/* ---------- SchichtStats ---------- */

function SchichtStats({ driverId, miseDriverId, isOnline }: { driverId: string; miseDriverId: string | null; isOnline: boolean }) {
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
      const { data: legacyBatches } = await supabase
        .from('delivery_batches')
        .select('id, total_distance_km')
        .eq('fahrer_id', driverId)
        .gte('created_at', today.toISOString());

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
  }, [driverId, miseDriverId]);

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
      hasData ? 'bg-[var(--surface-2)] border-[var(--line)]' : 'bg-[var(--surface)] border-[var(--line)] opacity-60',
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-accent" />
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ink-3)]">Heutige Schicht</div>
        {onlineMin > 0 && (
          <div className="ml-auto text-[10px] font-bold text-[var(--ink-3)] mono">
            {Math.floor(onlineMin / 60) > 0 ? `${Math.floor(onlineMin / 60)}h ` : ''}{onlineMin % 60}m online
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-[var(--surface-2)] p-3 text-center">
          <div className="font-display text-2xl font-black text-accent leading-none">{stats.deliveries}</div>
          <div className="text-[10px] text-[var(--ink-3)] mt-1">Lieferungen</div>
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] p-3 text-center">
          <div className="font-display text-2xl font-black text-accent leading-none">{stats.tours}</div>
          <div className="text-[10px] text-[var(--ink-3)] mt-1">Touren</div>
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] p-3 text-center">
          <div className="font-display text-lg font-black text-accent leading-none">
            {stats.totalDistKm > 0 ? `${stats.totalDistKm.toFixed(1)} km` : '—'}
          </div>
          <div className="text-[10px] text-[var(--ink-3)] mt-1">Strecke</div>
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] p-3 text-center">
          <div className="font-display text-lg font-black text-accent leading-none">
            {euro(stats.totalBetrag)}
          </div>
          <div className="text-[10px] text-[var(--ink-3)] mt-1">Umsatz</div>
        </div>
      </div>
      {!hasData && isOnline && (
        <div className="mt-2 text-center text-[11px] text-[var(--ink-3)]">
          Noch keine Lieferungen heute — erste Tour annehmen!
        </div>
      )}
      {stats.deliveries > 0 && (
        <>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
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
            const effColor = effScore >= 80 ? 'bg-accent' : effScore >= 60 ? 'bg-[var(--accent)]' : effScore >= 40 ? 'bg-[var(--warn)]' : 'bg-muted';
            const estimatedEarnings = realEarnings?.totalEur ?? (stats.deliveries * 3 + stats.totalDistKm * 0.15);
            const isRealEarnings = realEarnings !== null && realEarnings.totalEur > 0;
            const earningsPerHour = onlineMin >= 5 ? (estimatedEarnings / Math.max(1, onlineMin)) * 60 : null;
            return (
              <div className="mt-3 space-y-2">
                <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Schicht-Effizienz</span>
                    <span className="text-[10px] font-black text-accent">{effLabel}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${effColor}`}
                      style={{ width: `${effScore}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-[var(--ink-3)]">
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
                    <div className="rounded-xl bg-[var(--accent-tint)] border border-accent/20 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider">
                          Prognose bis {shiftEndH}:00 Uhr
                        </span>
                        <span className="font-display text-lg font-black text-accent mono">
                          ~{projectedEarnings.toFixed(0)}€
                        </span>
                      </div>
                      <div className="text-[9px] text-[var(--ink-3)] mt-0.5">
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
                    <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Nächstes Ziel</span>
                        <span className="text-[10px] font-black text-[var(--ink-2)]">
                          {stats.deliveries}/{next} <span className="text-accent">🏆</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--ink-3)] transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-[var(--ink-3)]">
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

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/* ---------- FahrerWarteAnzeige (Drive HomeScreen: Karte + Puls + Warte-Status) ---------- */

/* Stilisierter Karten-Hintergrund (CSS-Strassenraster + Block-/Park-Flaechen). */
function WarteMapBg() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--map-bg, #E7ECE7)',
        backgroundImage:
          'linear-gradient(90deg, var(--map-road, #fff) 0 6px, transparent 6px),' +
          'linear-gradient(0deg, var(--map-road, #fff) 0 6px, transparent 6px)',
        backgroundSize: '78px 78px, 78px 78px',
        backgroundPosition: '24px 0, 0 36px',
        opacity: 0.55,
      }}
    >
      {[
        { l: '8%', t: 40, w: 70, h: 54, park: true },
        { l: '62%', t: 24, w: 88, h: 48 },
        { l: '38%', t: 150, w: 96, h: 60, park: true },
        { l: '70%', t: 210, w: 78, h: 70 },
        { l: '10%', t: 250, w: 90, h: 58 },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.l,
            top: b.t,
            width: b.w,
            height: b.h,
            borderRadius: 9,
            background: b.park ? 'var(--map-park, #D5E6D8)' : 'var(--map-block, #DBE2DC)',
          }}
        />
      ))}
    </div>
  );
}

function FahrerWarteAnzeige({
  isOnline,
  driverId,
  driverName,
  vehicle,
  gpsOk,
  gpsLastAt,
  gpsCalibrating,
  onGoOffline,
  offlinePending,
}: {
  isOnline: boolean;
  driverId: string;
  driverName: string;
  vehicle: string | null;
  gpsOk: boolean | null;
  gpsLastAt: number | null;
  gpsCalibrating: boolean;
  onGoOffline: () => void;
  offlinePending: boolean;
}) {
  const supabase = createClient();
  const [waitSec, setWaitSec] = useState(0);
  const [lastDeliveryMin, setLastDeliveryMin] = useState<number | null>(null);

  // Wartezeit-Ticker
  useEffect(() => {
    const t = setInterval(() => setWaitSec((s) => s + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  // Letzte abgeschlossene Lieferung holen
  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: lastStop } = await supabase
        .from('delivery_batch_stops')
        .select('geliefert_am, batch:delivery_batches!inner(fahrer_id)')
        .eq('batch.fahrer_id', driverId)
        .gte('geliefert_am', today.toISOString())
        .not('geliefert_am', 'is', null)
        .order('geliefert_am', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastStop?.geliefert_am) {
        const min = Math.floor((Date.now() - new Date(lastStop.geliefert_am as string).getTime()) / 60_000);
        setLastDeliveryMin(min);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const waitMin = Math.floor(waitSec / 60);
  const waitSecDisplay = waitSec % 60;

  return (
    // Full-bleed: bricht aus dem main-Padding (px-4 py-6) aus -> Drive-Vollbild-Look
    <section
      className="relative -mx-4 -mt-6 overflow-hidden rounded-b-[28px]"
      style={{ height: 'calc(100dvh - 184px)', minHeight: 440, background: 'var(--bg)' }}
    >
      <WarteMapBg />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, var(--bg) 2%, transparent 18% 60%, var(--bg) 99%)',
        }}
      />

      {/* Top Status-Pill */}
      <div className="absolute left-4 right-4 top-4 flex items-center gap-2.5">
        <div
          className="flex items-center gap-2.5"
          style={{
            padding: '9px 14px',
            background: 'var(--surface)',
            borderRadius: 14,
            boxShadow: '0 4px 16px -6px rgba(0,0,0,.25), inset 0 0 0 1px var(--line)',
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 99,
              background: isOnline ? 'var(--accent)' : 'var(--ink-3)',
              boxShadow: isOnline ? '0 0 0 3px var(--accent-tint)' : 'none',
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <div className="flex-1" />
        {gpsOk === false && (
          <span
            style={{
              padding: '7px 11px',
              borderRadius: 12,
              background: 'var(--danger-tint)',
              color: 'var(--danger)',
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            GPS aus
          </span>
        )}
        {gpsCalibrating && (
          <span
            style={{
              padding: '7px 11px',
              borderRadius: 12,
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            GPS kalibriert…
          </span>
        )}
        {gpsOk === true && !gpsCalibrating && (() => {
          const ageMs = gpsLastAt ? Date.now() - gpsLastAt : null;
          if (ageMs != null && ageMs > 60000) {
            return (
              <span
                style={{
                  padding: '7px 11px',
                  borderRadius: 12,
                  background: 'var(--danger-tint)',
                  color: 'var(--danger)',
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                🔴 GPS {Math.round(ageMs / 1000)}s alt
              </span>
            );
          }
          if (ageMs != null && ageMs > 30000) {
            return (
              <span
                style={{
                  padding: '7px 11px',
                  borderRadius: 12,
                  background: 'rgba(245,158,11,.12)',
                  color: '#f59e0b',
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                ⚠️ GPS schwach
              </span>
            );
          }
          return null;
        })()}
      </div>

      {/* Zentrierte Warte-Karte: Puls-Ring + Bag-Icon */}
      <div
        className="absolute text-center"
        style={{ left: '50%', top: '44%', transform: 'translate(-50%,-50%)', width: 250 }}
      >
        <div style={{ position: 'relative', width: 92, height: 92, margin: '0 auto 18px' }}>
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'drv-pulse 2s ease-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px -8px rgba(0,0,0,.3)',
            }}
          >
            <DIcon name="bag" size={40} stroke={1.8} style={{ color: 'var(--accent)' }} />
          </div>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {isOnline ? 'Warte auf Bestellungen' : 'Du bist offline'}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--ink-2)',
            marginTop: 5,
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {isOnline ? 'Bleib in der Naehe vom Restaurant. Neue Auftraege kommen automatisch rein.' : 'Tippe unten auf „Online gehen“, um Bestellungen zu bekommen.'}
        </div>

        {/* Wartezeit-Chip (mono) */}
        <div
          className="mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            marginTop: 14,
            padding: '8px 13px',
            borderRadius: 12,
            background: 'var(--surface-2)',
          }}
        >
          <DIcon name="clock" size={14} style={{ color: 'var(--ink-3)' }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)' }}>
            {waitMin > 0 ? `${waitMin}m ` : ''}
            {waitSecDisplay.toString().padStart(2, '0')}s
          </span>
          {lastDeliveryMin !== null && (
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>
              · letzte vor {lastDeliveryMin}m
            </span>
          )}
        </div>
      </div>

      {/* Untere Fahrer-Leiste */}
      <div className="absolute bottom-4 left-4 right-4">
        <div
          className="flex items-center gap-3"
          style={{
            padding: 12,
            background: 'var(--surface)',
            borderRadius: 18,
            boxShadow: '0 2px 10px -4px rgba(0,0,0,.12), inset 0 0 0 1px var(--line)',
          }}
        >
          <Avatar name={driverName} size={46} />
          <div className="min-w-0 flex-1">
            <div
              style={{
                fontWeight: 700,
                fontSize: 15.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {driverName}
            </div>
            <div
              className="flex items-center gap-1.5"
              style={{ color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, marginTop: 1 }}
            >
              <DIcon name="truck" size={14} style={{ color: 'var(--accent)' }} />
              {vehicle || 'Lieferung'}
            </div>
          </div>
          <Btn
            variant={isOnline ? "secondary" : "primary"}
            size="sm"
            full={false}
            onClick={onGoOffline}
            disabled={offlinePending}
            style={{ width: 'auto' }}
          >
            {offlinePending ? <DSpinner size={16} color="var(--ink-2)" /> : (isOnline ? 'Offline' : 'Online gehen')}
          </Btn>
        </div>
      </div>
    </section>
  );
}

/* D3 Countdown-Ring: 52px SVG-Kreis (R=22), accent-Stroke, mono-Zahl mittig.
   Start ~60s. Bei 0: NICHTS Destruktives — visuell auf 0, optional onExpire (sanfter Reload). */
function CountdownRing({ seconds = 60, onExpire }: { seconds?: number; onExpire?: () => void }) {
  const [left, setLeft] = useState(seconds);
  const firedRef = useRef(false);
  useEffect(() => {
    setLeft(seconds);
    firedRef.current = false;
    const iv = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(iv);
          if (!firedRef.current) { firedRef.current = true; onExpire?.(); }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const R = 22;
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, left / seconds));
  const offset = C * (1 - frac);
  const low = left <= 10;
  return (
    <div className="relative shrink-0" style={{ width: 52, height: 52 }} aria-label={`${left} Sekunden`}>
      <svg width={52} height={52} viewBox="0 0 52 52" className="-rotate-90">
        <circle cx={26} cy={26} r={R} fill="none" stroke="var(--line)" strokeWidth={4} />
        <circle
          cx={26} cy={26} r={R} fill="none"
          stroke={low ? 'var(--warn)' : 'var(--accent)'}
          strokeWidth={4} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s ease' }}
        />
      </svg>
      <div className={cn('absolute inset-0 grid place-items-center mono font-bold text-sm', low ? 'text-[var(--warn)]' : 'text-accent')}>
        {left}
      </div>
    </div>
  );
}

function OpenBatchSection({
  openBatches,
  pending,
  onClaim,
  onDecline,
  decliningBatch,
  driverPos,
  onExpire,
}: {
  openBatches: OpenBatch[];
  pending: boolean;
  onClaim: (batchId: string) => void;
  onDecline?: (batchId: string) => void;
  decliningBatch?: string | null;
  driverPos?: { lat: number; lng: number } | null;
  onExpire?: () => void;
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
        created_at: stops[0].created_at ?? null,
      };
    });
  }, [openBatches]);

  // Drive-Metriken: Artikel (Stops als Proxy), Gesamt-Strecke, geschaetzte Dauer
  const totalItems = openBatches.length;
  const totalDistKm = grouped.reduce((s, g) => s + (g.totalDistanceKm ?? 0), 0);
  const totalEtaMin = grouped.reduce((s, g) => s + (g.estEtaMin ?? g.maxEta ?? 0), 0);
  const restaurantName = grouped[0]?.locationName ?? 'Restaurant';

  return (
    <section>
      {/* Drive-Header: Bag-Tile (wackelt) + Titel + Countdown-Ring (52px, mono) */}
      <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
        <div
          className="grid place-items-center shrink-0"
          style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-tint)' }}
        >
          <DIcon name="bag" size={24} stroke={2} style={{ color: 'var(--accent)' }} className="ring-anim" />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Neue Tour</div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--ink-2)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {grouped.length} {grouped.length === 1 ? 'Bestellung' : 'Bestellungen'} · {restaurantName}
          </div>
        </div>
        {grouped.length > 0 && (() => {
          const secsLeft = Math.max(10, Math.round((new Date(grouped[0]?.created_at ?? Date.now()).getTime() + 180_000 - Date.now()) / 1000));
          return <CountdownRing key={secsLeft} seconds={secsLeft} onExpire={onExpire} />;
        })()}
      </div>

      {/* Drive-Metriken: Artikel · Strecke · Dauer */}
      {grouped.length > 0 && (
        <div className="flex gap-2" style={{ marginBottom: 14 }}>
          {([
            ['box', String(totalItems), 'Bestellungen'] as const,
            ['route', `${totalDistKm.toFixed(1)} km`, 'Strecke'] as const,
            ['clock', totalEtaMin > 0 ? `~${totalEtaMin} min` : '—', 'Dauer'] as const,
          ]).map(([ic, val, lab]) => (
            <div
              key={lab}
              className="flex-1 text-center"
              style={{ background: 'var(--surface-2)', borderRadius: 14, padding: '12px 10px' }}
            >
              <DIcon name={ic} size={18} stroke={2} style={{ color: 'var(--accent)' }} />
              <div style={{ fontWeight: 800, fontSize: 17, marginTop: 3 }} className="mono">{val}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>{lab}</div>
            </div>
          ))}
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] p-6 text-center">
          <Clock className="h-8 w-8 text-[var(--ink-3)] mx-auto mb-2 opacity-60" />
          <div className="text-[var(--ink-2)] text-sm">Gerade keine offenen Touren.</div>
          <div className="text-[var(--ink-3)] text-xs mt-1">Bleib online — wir sagen dir Bescheid.</div>
        </div>
      ) : (
        /* Drive-getreu (02-incoming.png): pro Batch eine flache, ruhige Stopp-Liste.
           Nummerierte mono-Box | Adresse + Untertitel | rechts mono #Code.
           Keine Accent-Karte/Zap/„Beste Wahl"/Verdienst-Chips/Route-Viz mehr. */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {grouped.map(({ batchId, stops, cashAmount, locationLat, locationLng, estDriverEarnings }) => {
            const isMise = stops[0]?.source_system === 'mise';
            const canDecline = isMise && !!onDecline;
            const isDeclining = decliningBatch === batchId;
            const hub = locationLat != null && locationLng != null
              ? { lat: locationLat, lng: locationLng } : null;
            return (
              <div key={batchId}>
                {/* flache Stopp-Liste */}
                <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 4, marginBottom: 12 }}>
                  {stops.map((s, i) => {
                    const isCash = s.zahlungsart === 'bar' || s.bezahlt === false;
                    const stopKm = hub && s.kunde_lat != null && s.kunde_lng != null
                      ? haversineKm(hub, { lat: s.kunde_lat, lng: s.kunde_lng }) : null;
                    const sub = [
                      s.kunde_plz || s.kunde_stadt
                        ? [s.kunde_plz, s.kunde_stadt].filter(Boolean).join(' ')
                        : null,
                      stopKm != null ? `${stopKm.toFixed(1)} km` : null,
                    ].filter(Boolean).join(' · ');
                    return (
                      <div
                        key={s.order_id}
                        className="flex items-center gap-3"
                        style={{
                          padding: '11px 12px',
                          borderBottom: i < stops.length - 1 ? '1px solid var(--line-2, var(--line))' : 'none',
                        }}
                      >
                        <div
                          className="mono grid place-items-center shrink-0"
                          style={{
                            width: 26, height: 26, borderRadius: 8, background: 'var(--surface)',
                            fontWeight: 700, fontSize: 13, boxShadow: 'inset 0 0 0 1px var(--line)',
                          }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            style={{ fontWeight: 700, fontSize: 14.5 }}
                            className="truncate"
                          >
                            {s.kunde_adresse || s.kunde_name}
                          </div>
                          <div
                            style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}
                            className="flex items-center gap-1.5"
                          >
                            {sub || s.kunde_name}
                            {isCash && (
                              <span className="inline-flex items-center gap-0.5 text-[var(--warn)]">
                                <Banknote size={11} /> Bar
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className="mono shrink-0"
                          style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          #{s.bestellnummer.slice(-4)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Verdienst-Schätzung */}
                {estDriverEarnings > 0 && (
                  <div
                    className="flex items-center gap-2"
                    style={{
                      background: 'var(--success-tint, rgba(34,197,94,0.08))', borderRadius: 12,
                      padding: '9px 12px', marginBottom: 12,
                      fontSize: 13, fontWeight: 600, color: 'var(--success, #16a34a)',
                    }}
                  >
                    <Banknote size={15} /> ~{estDriverEarnings.toFixed(2)} € Verdienst (Schätzung)
                  </div>
                )}

                {/* Bar-Hinweis (nur wenn Bargeld zu kassieren) */}
                {cashAmount > 0 && (
                  <div
                    className="flex items-center gap-2"
                    style={{
                      background: 'var(--warn-tint)', borderRadius: 12,
                      padding: '9px 12px', marginBottom: 12,
                      fontSize: 13, fontWeight: 600, color: 'var(--warn)',
                    }}
                  >
                    <Banknote size={15} /> {euro(cashAmount)} bar kassieren
                  </div>
                )}

                {/* Ablehnen / Annehmen */}
                <div className="flex gap-2.5">
                  {canDecline && (
                    <Btn
                      variant="secondary"
                      onClick={() => onDecline!(batchId)}
                      disabled={pending || isDeclining}
                      style={{ flex: '0 0 34%' }}
                    >
                      {isDeclining ? <DSpinner size={18} color="var(--ink-2)" /> : 'Ablehnen'}
                    </Btn>
                  )}
                  <Btn
                    onClick={() => onClaim(batchId)}
                    disabled={pending || isDeclining}
                    iconRight={pending && !isDeclining ? undefined : 'arrow'}
                    style={{ flex: 1 }}
                  >
                    {pending && !isDeclining ? <DSpinner size={18} /> : 'Annehmen'}
                  </Btn>
                </div>
              </div>
            );
          })}
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
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
      >
        <div className="h-9 w-9 rounded-xl bg-[var(--surface-2)] flex items-center justify-center shrink-0">
          <Calendar size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm">Schichten buchen</div>
          <div className="text-[11px] text-[var(--ink-3)]">
            {expanded
              ? 'Tippe um zuzuklappen'
              : openSlots.length > 0
              ? `${openSlots.length} offene Slot${openSlots.length === 1 ? '' : 's'}`
              : 'Verfügbare Schichten anzeigen'}
          </div>
        </div>
        {totalBadge > 0 && !expanded && (
          <span className="rounded-full bg-[var(--accent)] text-white px-2 py-0.5 text-xs font-black">
            {totalBadge}
          </span>
        )}
        {expanded
          ? <ChevronUp size={16} className="text-[var(--ink-3)] shrink-0" />
          : <ChevronDown size={16} className="text-[var(--ink-3)] shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-[var(--ink-3)] text-sm">
              <Loader2 size={16} className="animate-spin" />
              Lade Schichten…
            </div>
          )}

          {/* Meine Anmeldungen */}
          {!loading && (pendingClaims.length > 0 || approvedClaims.length > 0) && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ink-3)] mb-2">
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
                        ? 'bg-[var(--accent-tint)] border-[var(--accent)]/30'
                        : 'bg-[var(--surface-2)] border-[var(--line)]',
                    )}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{dayLbl}</div>
                        <div className="text-[11px] text-[var(--ink-3)]">{timeLbl}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                          isApproved
                            ? 'bg-[var(--accent-tint)] text-accent'
                            : 'bg-[var(--warn-tint)] text-[var(--warn)]',
                        )}>
                          {isApproved ? '✓ Genehmigt' : '⏳ Wartet'}
                        </span>
                        {c.status === 'pending' && (
                          <button
                            onClick={() => doCancel(c.id)}
                            disabled={cancelPending === c.id}
                            className="h-7 w-7 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--accent-tint)] flex items-center justify-center text-[var(--ink-3)] transition disabled:opacity-40"
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
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ink-3)] mb-2">
                Offene Slots
              </div>
              {openSlots.length === 0 ? (
                <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--line)] px-4 py-5 text-center">
                  <Clock size={20} className="mx-auto mb-1.5 text-[var(--ink-3)] opacity-60" />
                  <div className="text-sm text-[var(--ink-2)]">Keine offenen Schichten</div>
                  <div className="text-[11px] text-[var(--ink-3)] mt-0.5">
                    Alle Slots für die nächsten 7 Tage sind gedeckt.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {openSlots.map(slot => (
                    <div
                      key={slot.slotStart}
                      className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{slot.dayLabel}</div>
                        <div className="text-[11px] text-[var(--ink-3)]">{slot.timeLabel}</div>
                        <div className="text-[10px] text-[var(--warn)] mt-0.5">
                          {slot.driverNeeded} von {slot.driverTarget} Fahrern noch gesucht
                        </div>
                      </div>
                      <button
                        onClick={() => doClaim(slot)}
                        disabled={claimPending === slot.slotStart}
                        className="h-9 px-3 rounded-xl bg-[var(--accent)] text-white font-display font-bold text-xs inline-flex items-center gap-1.5 shrink-0 transition active:scale-95 disabled:opacity-60"
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
            className="w-full text-center text-[11px] text-[var(--ink-3)] hover:text-[var(--ink-2)] transition py-1"
          >
            {loading ? 'Aktualisiere…' : '↻ Aktualisieren'}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- SchichtAbschlussModal ---------- */

function SchichtAbschlussModal({
  snapshot,
  onConfirm,
  onCancel,
}: {
  snapshot: { deliveries: number; tours: number; distKm: number; betrag: number; onlineMin: number };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const effScore = snapshot.onlineMin > 0
    ? Math.min(100, Math.round((snapshot.deliveries / Math.max(1, snapshot.onlineMin)) * 60 * 20))
    : 0;
  const badge = effScore >= 80
    ? { label: 'Excellent! 🏆', color: 'text-accent' }
    : effScore >= 60
    ? { label: 'Sehr gut! ⭐', color: 'text-[var(--warn)]' }
    : effScore >= 40
    ? { label: 'Gut gemacht! 👏', color: 'text-[var(--warn)]' }
    : { label: 'Danke für deine Schicht!', color: 'text-[var(--ink-2)]' };

  const estEarnings = snapshot.deliveries * 3 + snapshot.distKm * 0.15;
  const hStr = snapshot.onlineMin >= 60 ? `${Math.floor(snapshot.onlineMin / 60)}h ` : '';
  const mStr = `${snapshot.onlineMin % 60}m`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white border border-[var(--line)] rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">🎉</div>
          <div className="font-display text-2xl font-black text-accent">Schicht abgeschlossen!</div>
          <div className={`text-sm font-bold mt-1 ${badge.color}`}>{badge.label}</div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] p-4 text-center">
            <div className="font-display text-3xl font-black text-accent leading-none">{snapshot.deliveries}</div>
            <div className="text-[11px] text-[var(--ink-3)] mt-1.5">Lieferungen</div>
          </div>
          <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] p-4 text-center">
            <div className="font-display text-3xl font-black text-accent leading-none">{snapshot.tours}</div>
            <div className="text-[11px] text-[var(--ink-3)] mt-1.5">Touren</div>
          </div>
          <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] p-4 text-center">
            <div className="font-display text-xl font-black text-accent leading-none">
              {snapshot.distKm > 0 ? `${snapshot.distKm.toFixed(1)} km` : '—'}
            </div>
            <div className="text-[11px] text-[var(--ink-3)] mt-1.5">Strecke</div>
          </div>
          <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] p-4 text-center">
            <div className="font-display text-xl font-black text-accent leading-none">
              {snapshot.onlineMin > 0 ? `${hStr}${mStr}` : '—'}
            </div>
            <div className="text-[11px] text-[var(--ink-3)] mt-1.5">Online-Zeit</div>
          </div>
        </div>

        {/* Estimated earnings */}
        {estEarnings > 0 && (
          <div className="rounded-2xl bg-[var(--accent-tint)] border border-accent/20 px-4 py-3 mb-5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1">
              Geschätzter Verdienst
            </div>
            <div className="font-display text-2xl font-black text-accent">{euro(Math.round(estEarnings * 100) / 100)}</div>
            <div className="text-[9px] text-[var(--ink-3)] mt-0.5">Ø {euro(Math.round((estEarnings / Math.max(1, snapshot.deliveries)) * 100) / 100)} pro Lieferung</div>
          </div>
        )}

        {/* Efficiency bar */}
        {effScore > 0 && (
          <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] px-4 py-3 mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Schicht-Effizienz</span>
              <span className="text-[10px] font-black text-accent">{effScore}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${effScore >= 80 ? 'bg-accent' : effScore >= 60 ? 'bg-[var(--accent)]' : 'bg-[var(--warn)]'}`}
                style={{ width: `${effScore}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-[var(--ink-3)] text-right">
              {snapshot.onlineMin > 0 ? `${((snapshot.deliveries / Math.max(1, snapshot.onlineMin)) * 60).toFixed(1)}/h Lieferungen` : ''}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={onConfirm}
            className="w-full h-13 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink-2)] font-display font-bold text-base inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Power size={18} />
            Schicht abschließen
          </button>
          <button
            onClick={onCancel}
            className="w-full h-12 rounded-2xl bg-[var(--accent)] text-white font-display font-bold text-base inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            Weiter arbeiten
          </button>
        </div>
      </div>
    </div>
  );
}
