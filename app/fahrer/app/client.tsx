'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Banknote, Bike, Calendar, Check, Car, CheckCircle2, ChevronDown, ChevronUp, Clock, FileText, Footprints,
  History, Loader2, LogOut, Map as MapIcon, MapPin, Navigation, Package, Phone, Power, Receipt, Route, ShoppingBag,
  TrendingUp, Trophy, Zap, ListOrdered,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';
import { PickDialog } from './pick-dialog';
import { DeliveryView } from './delivery-view';
import { AlarmRinger } from './alarm-ringer';
import { PushRegister } from './push-register';
import { UpdateBanner } from './update-banner';
import { PermissionsGate } from './permissions-gate';
import { SchichtEffizienzMeter } from './schicht-effizienz';
import { TourProgressRing } from './tour-ring';
import { TourStopsPanel } from './tour-stops-panel';
import { TourKpiSummary } from './tour-kpi-summary';
import { FahrerNaviStrip } from './fahrer-navi-strip';
import { EarningsProgressBar } from './earnings-progress-bar';
import { TourMiniMap } from './tour-mini-map';
import { SchichtPuls } from './schicht-puls';
import { TourSpeedTracker } from './tour-speed-tracker';
import { OpenBatchMap } from './open-batch-map';
import { OfflineNetworkBanner } from './offline-network-banner';
import { TagesabschlussBadge, type TagesabschlussData } from './tagesabschluss-badge';
import { CashflowTracker } from './cashflow-tracker';
import { TourAbschlussRechner } from './tour-abschluss-rechner';
import { SchichtKpiLive } from './schicht-kpi-live';
import { StopNavCard } from './stop-nav-card';
import { EtaAmpel } from './eta-ampel';
import { FahrerTagesZusammenfassung } from './tages-zusammenfassung';
import { KundenHistorieKarte } from './kunden-historie-karte';
import { TourStatusHeader } from './tour-status-header';
import { FahrerStickyBar } from './fahrer-sticky-bar';
import { NextStopCta } from './next-stop-cta';
import { TourAbschlussPrognose } from './tour-abschluss-prognose';
import { NaviWidget } from './navi-widget';
import { SchichtEinnahmenRing } from './schicht-einnahmen-ring';
import { TourEffizienzScore } from './tour-effizienz-score';
import { FahrerRatingHistorie } from './rating-historie';
import { TourEfficiencyTicker } from './tour-efficiency-ticker';
import { StopTimerRing } from './stop-timer-ring';
import { SchichtPauseReminder } from './schicht-pause-reminder';
import { StreakBadge } from './streak-badge';
import { MeilensteinToast } from './meilenstein-toast';
import { TourOptBadge } from './tour-opt-badge';
import { FahrerWetterWarnBanner } from './wetter-warn-banner';
import { FahrerSchichtEinnahmenChart } from './schicht-einnahmen-chart';
import { FahrerTagesBewertungKarte } from './tages-bewertung-karte';
import { SchichtBedarfChip } from './schicht-bedarf-chip';
import { FahrzeitPrognose } from './fahrzeit-prognose';
import { StopSchnellPanel } from './stop-schnell-panel';
import { SmartStopNavigator } from './smart-stop-navigator';
import { NaechsterStoppCountdown } from './naechster-stopp-countdown';
import { FahrerIncentiveLiveStrip } from './incentive-live-strip';
import { FahrerComebackBonusHinweis } from './comeback-bonus-hinweis';
import { FahrerRouteQualitaet } from './route-qualitaet';
import { DriverHotspotTip } from './driver-hotspot-tip';
import { TourStopEtaPredictor } from './tour-stop-eta-predictor';
import { ProximityStopAlert } from './proximity-stop-alert';
import { TourFortschrittsCockpit } from './tour-fortschritts-cockpit';
import { TourEffizienzLive } from './tour-efficiency-live';
import { TourEffizienzAnalyse } from './tour-effizienz-analyse';
import { TourFeedbackSchnell } from './tour-feedback-schnell';
import { SchichtKilometerTracker } from './schicht-kilometer-tracker';
import { KassenUebersicht } from './kassen-uebersicht';
import { SchichtBonusBooster } from './schicht-bonus-booster';
import { FahrerAnkunftsSignal } from './ankunfts-signal';
import { FahrerRampUpFortschritt } from './ramp-up-fortschritt';
import { FahrerRichtungsAnzeige } from './richtungs-anzeige';
import { TourFertigPrognose } from './tour-fertig-prognose';
import { TourStopNavigator } from './tour-stop-navigator';
import { TourNavigationsCockpit } from './tour-navigations-cockpit';
import { FahrerKundenNotizKarte } from './kunden-notiz-karte';
import { TourZeitplanFahrer } from './tour-zeitplan-fahrer';
import { TourNaviHUD } from './tour-navi-hud';
import { TourPunktlichkeitsCoach } from './tour-punktlichkeits-coach';
import { TourStopsDetailPanel, type TourStop } from './tour-stop-detail-card';
import { TourStoppAktionen } from './tour-stopp-aktionen';
import { TourFortschrittsRing } from './tour-fortschritts-ring';

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
      kunde_telefon?: string | null;
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
  const [pending, startTransition] = useTransition();

  const isOnline = status?.ist_online ?? false;

  // Live-Tick: sorgt dafür, dass ETA-Countdowns in Stopp-Liste jede Sekunde neu berechnet werden
  const [, setLiveTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLiveTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const gpsWatchRef = useRef<number | null>(null);
  const [gpsOk, setGpsOk] = useState<boolean | null>(null);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickItems, setPickItems] = useState<any[]>([]);
  const [showShiftEnd, setShowShiftEnd] = useState(false);
  const [shiftSnapshot, setShiftSnapshot] = useState<{
    deliveries: number; tours: number; distKm: number; betrag: number; onlineMin: number;
  } | null>(null);

  // Tagesabschluss-Badge: persistente Schicht-Zusammenfassung nach Schichtende
  const [tagesabschlussData, setTagesabschlussData] = useState<TagesabschlussData | null>(null);

  // Heutige Schicht: Lieferungen + Schätzung
  const [todayStats, setTodayStats] = useState<{ deliveries: number; estEarnings: number } | null>(null);

  // Wochen-Performance: Rang + 7-Tage-Trend
  type RankData = { rank: number; total: number; history: { date: string; stopsCompleted: number; onTimeRate: number | null }[] };
  const [rankData, setRankData] = useState<RankData | null>(null);

  // Betriebsnachrichten vom Dispatch
  const [broadcasts, setBroadcasts] = useState<{ id: string; message: string; priority: string; sentByName: string | null; createdAt: string }[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Nächste geplante Schichten (aus offline-bundle)
  const [upcomingShifts, setUpcomingShifts] = useState<{ id: string; planned_start: string; planned_end: string; status: string }[]>([]);

  // Peak-Zeit-Erkennung: pollt eta/live zur Erkennung von Surge/Stoßzeiten
  const [peakSignal, setPeakSignal] = useState<{ signal: string; load: string; etaExtension: number } | null>(null);

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

  useEffect(() => {
    fetch('/api/delivery/driver/offline-bundle', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d?.upcomingShifts)) setUpcomingShifts(d.upcomingShifts); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOnline || !driver.location_id) return;
    const poll = () => {
      fetch(`/api/delivery/eta/live?location_id=${driver.location_id}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.queue_signal) setPeakSignal({ signal: d.queue_signal, load: d.load ?? 'normal', etaExtension: d.eta_extension_min ?? 0 }); })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 90_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driver.location_id]);

  useEffect(() => {
    if (!isOnline) return;
    fetch('/api/delivery/driver/my-performance?period=week&days=7')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.rank != null && d?.total != null) {
          setRankData({ rank: d.rank, total: d.total, history: Array.isArray(d.history) ? d.history : [] });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    const load = async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: batches } = await supabase
        .from('delivery_batches')
        .select('id, total_distance_km')
        .eq('fahrer_id', driver.id)
        .gte('created_at', today.toISOString());
      if (!batches?.length) { setTodayStats({ deliveries: 0, estEarnings: 0 }); return; }
      const { data: stops } = await supabase
        .from('delivery_batch_stops')
        .select('id, distanz_zum_vorgaenger_m')
        .in('batch_id', (batches as any[]).map((b: any) => b.id))
        .not('geliefert_am', 'is', null);
      const deliveries = (stops as any[])?.length ?? 0;
      const distKm = ((batches as any[]) ?? []).reduce((s: number, b: any) => s + (b.total_distance_km ?? 0), 0);
      const estEarnings = deliveries * 1.50 + distKm * 0.20;
      setTodayStats({ deliveries, estEarnings });
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [isOnline, driver.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // fertig_am je Order: zum Anzeigen wie lange eine Bestellung schon wartet
  const [kitchenFertigAt, setKitchenFertigAt] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!activeBatch || activeBatch.status === 'unterwegs') return;
    const orderIds = activeBatch.stops.map((s) => s.order_id).filter(Boolean);
    if (orderIds.length === 0) return;

    // Initial fetch
    supabase.from('customer_orders')
      .select('id, status, fertig_am')
      .in('id', orderIds)
      .then(({ data }: { data: { id: string; status: string; fertig_am: string | null }[] | null }) => {
        if (!data) return;
        setKitchenStatuses(new Map(data.map((r) => [r.id, r.status])));
        setKitchenFertigAt(new Map(data.filter(r => r.fertig_am).map((r) => [r.id, r.fertig_am!])));
      });

    // Realtime subscription
    const ch = supabase
      .channel(`kitchen-status-${activeBatch.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=in.(${orderIds.join(',')})`,
      }, (payload: { new: { id: string; status: string; fertig_am?: string | null } }) => {
        const { id, status: newStatus, fertig_am } = payload.new;
        setKitchenStatuses((prev) => new Map(prev).set(id, newStatus));
        if (fertig_am) setKitchenFertigAt((prev) => new Map(prev).set(id, fertig_am));
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

  /* Phase 91: Offline-Bundle beim App-Start prefetchen → SW cached es für Offline-Betrieb */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: 'PREFETCH_OFFLINE_BUNDLE' });
    }).catch(() => {});
    // Alle 5 Min erneut prefetchen damit Bundle frisch bleibt
    const prefetchIv = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'PREFETCH_OFFLINE_BUNDLE' });
      }).catch(() => {});
    }, 5 * 60_000);
    return () => clearInterval(prefetchIv);
  }, []);

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
        window.location.reload();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [activeBatch, pickOpen]);

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

  async function goOffline() {
    setShowShiftEnd(false);
    startTransition(async () => {
      await supabase.from('driver_status').upsert({
        employee_id: driver.id, ist_online: false, fahrzeug: driver.fahrzeug_praeferenz, online_seit: null,
      });
      setStatus((s) => ({ ...(s ?? { employee_id: driver.id, fahrzeug: driver.fahrzeug_praeferenz, aktueller_batch_id: null, online_seit: null }), ist_online: false, online_seit: null }));
    });
  }

  async function toggleOnline() {
    const next = !isOnline;
    if (!next) {
      // Going offline — check if there are deliveries to show summary
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: batches } = await supabase
        .from('delivery_batches')
        .select('id, total_distance_km')
        .eq('fahrer_id', driver.id)
        .gte('created_at', today.toISOString());
      if (batches && (batches as any[]).length > 0) {
        const { data: stops } = await supabase
          .from('delivery_batch_stops')
          .select('id, order:customer_orders(gesamtbetrag)')
          .in('batch_id', (batches as any[]).map((b: any) => b.id))
          .not('geliefert_am', 'is', null);
        const deliveries = (stops as any[])?.length ?? 0;
        if (deliveries > 0) {
          const betrag = ((stops as any[]) ?? []).reduce((s: number, st: any) => s + (st.order?.gesamtbetrag ?? 0), 0);
          const distKm = ((batches as any[]) ?? []).reduce((s: number, b: any) => s + (b.total_distance_km ?? 0), 0);
          const onlineMin = status?.online_seit
            ? Math.floor((Date.now() - new Date(status.online_seit as string).getTime()) / 60_000)
            : 0;
          const snap = { deliveries, tours: (batches as any[]).length, distKm, betrag, onlineMin };
          setShiftSnapshot(snap);
          setTagesabschlussData({ ...snap, date: new Date().toISOString().slice(0, 10) });
          setShowShiftEnd(true);
          return;
        }
      }
      await goOffline();
      return;
    }
    // Going online
    startTransition(async () => {
      await supabase.from('driver_status').upsert({
        employee_id: driver.id, ist_online: true, fahrzeug: driver.fahrzeug_praeferenz,
        online_seit: new Date().toISOString(),
      });
      setStatus((s) => ({ ...(s ?? { employee_id: driver.id, fahrzeug: driver.fahrzeug_praeferenz, aktueller_batch_id: null, online_seit: null }), ist_online: true, online_seit: new Date().toISOString() }));
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
        window.location.reload();
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

  async function markArrived(stopId: string) {
    startTransition(async () => {
      const now = new Date().toISOString();
      await supabase.from('delivery_batch_stops')
        .update({ angekommen_am: now })
        .eq('id', stopId);
      await supabase.from('mise_delivery_batch_stops')
        .update({ angekommen_am: now })
        .eq('id', stopId);
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
    {/* Sticky bottom navigation bar — zeigt immer den nächsten Stop */}
    {activeBatch && (
      <FahrerStickyBar
        stops={activeBatch.stops as any}
        batchStatus={activeBatch.status}
      />
    )}
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
        {/* Betriebsnachrichten vom Dispatch */}
        {visibleBroadcasts.map(b => (
          <div
            key={b.id}
            className={cn(
              'flex items-start gap-3 rounded-2xl border px-4 py-3 animate-in slide-in-from-top-2 duration-200',
              b.priority === 'urgent'
                ? 'border-red-400 bg-red-950/30 text-red-100'
                : 'border-blue-400/50 bg-blue-950/30 text-blue-100',
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
            {isOnline && !activeBatch && (
              <>

                {/* GPS-Status */}
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  {gpsOk === false && <span className="text-red-300">⚠️ GPS blockiert — in Safari/Chrome Standort erlauben</span>}
                  {gpsOk === true && <span className="text-accent">📍 GPS aktiv</span>}
                  {gpsOk === null && <span className="text-matcha-300">📍 Warte auf GPS-Signal…</span>}
                </div>

                {/* Peak-Zeit Banner: zeigt Bonus-Stunden dem Fahrer */}
                {peakSignal && (peakSignal.signal === 'surge' || peakSignal.load === 'busy') && (
                  <div className={cn(
                    'mt-3 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-bold',
                    peakSignal.signal === 'surge'
                      ? 'bg-red-500/20 border border-red-400/40 text-red-200'
                      : 'bg-amber-500/15 border border-amber-400/30 text-amber-200',
                  )}>
                    <Zap className="h-4 w-4 shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <div>{peakSignal.signal === 'surge' ? '⚡ Surge-Zeit aktiv' : '🔥 Stoßzeit'}</div>
                      <div className="text-[10px] font-normal opacity-80 mt-0.5">
                        {peakSignal.signal === 'surge'
                          ? `ETA +${peakSignal.etaExtension} Min — höchste Nachfrage`
                          : 'Viele Bestellungen — jetzt online bleiben!'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Nächste Schichten — aus offline-bundle */}
                {upcomingShifts.length > 0 && (
                  <div className="mt-3 rounded-xl border border-matcha-600/40 bg-matcha-800/50 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-matcha-400 mb-2 flex items-center gap-1.5">
                      <Calendar size={10} />
                      Nächste Schicht
                    </div>
                    {upcomingShifts.slice(0, 2).map((shift, i) => {
                      const start = new Date(shift.planned_start);
                      const end = new Date(shift.planned_end);
                      const msUntil = start.getTime() - Date.now();
                      const isToday = start.toDateString() === new Date().toDateString();
                      const hoursUntil = Math.floor(msUntil / 3_600_000);
                      const minsUntil = Math.floor((msUntil % 3_600_000) / 60_000);
                      const countdown = msUntil > 0
                        ? hoursUntil > 0 ? `in ${hoursUntil}h ${minsUntil}m` : `in ${minsUntil}m`
                        : null;
                      return (
                        <div key={shift.id} className={cn('flex items-center gap-3 py-1.5', i > 0 && 'border-t border-matcha-700/50 mt-1.5')}>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white">
                              {isToday ? 'Heute' : start.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })}
                            </div>
                            <div className="text-[11px] text-matcha-300 tabular-nums">
                              {start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                            </div>
                          </div>
                          {countdown && (
                            <span className="text-[11px] font-bold text-accent bg-accent/10 rounded-full px-2.5 py-0.5 tabular-nums shrink-0">
                              {countdown}
                            </span>
                          )}
                          {shift.status === 'active' && (
                            <span className="text-[10px] font-bold text-matcha-100 bg-matcha-600 rounded-full px-2 py-0.5 shrink-0">Aktiv</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Heutige Schicht — Statistik-Widget */}
                {todayStats && todayStats.deliveries > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-matcha-700/40 border border-matcha-600/30 px-3 py-2.5 text-center">
                      <div className="font-display font-black text-2xl text-accent">{todayStats.deliveries}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300 mt-0.5">Lieferungen heute</div>
                    </div>
                    <div className="rounded-xl bg-accent/15 border border-accent/30 px-3 py-2.5 text-center">
                      <div className="font-display font-black text-2xl text-accent">{todayStats.estEarnings.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300 mt-0.5">Geschätzte Vergütung</div>
                    </div>
                  </div>
                )}

                {/* Wochen-Rang — 7-Tage-Sparkline mit Rang-Badge */}
                {rankData && (
                  <div className={cn(
                    'mt-3 rounded-xl border px-3 py-2.5',
                    rankData.rank <= 3 ? 'bg-yellow-500/10 border-yellow-500/25' : 'bg-white/5 border-white/10',
                  )}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {rankData.rank <= 3 && <span className="text-sm">🏆</span>}
                          <span className={cn(
                            'font-display font-black text-lg leading-none',
                            rankData.rank <= 3 ? 'text-yellow-300' : 'text-accent',
                          )}>
                            #{rankData.rank}
                          </span>
                          <span className="text-[10px] text-matcha-400">von {rankData.total} · diese Woche</span>
                        </div>
                        {(() => {
                          const last = rankData.history.at(-1)?.onTimeRate;
                          if (last == null) return null;
                          return (
                            <div className={cn(
                              'text-[10px] mt-0.5 font-bold',
                              last >= 0.9 ? 'text-accent' : last >= 0.7 ? 'text-amber-300' : 'text-red-400',
                            )}>
                              {Math.round(last * 100)}% pünktlich
                            </div>
                          );
                        })()}
                      </div>
                      {/* 7-Tage Stops-Sparkline */}
                      {rankData.history.length > 0 && (() => {
                        const hist = rankData.history.slice(-7);
                        const mx = Math.max(1, ...hist.map(h => h.stopsCompleted));
                        return (
                          <div className="flex items-end gap-[3px] h-8 shrink-0">
                            {hist.map((p, i) => {
                              const h = Math.max(4, Math.round((p.stopsCompleted / mx) * 28));
                              const isLatest = i === hist.length - 1;
                              return (
                                <div
                                  key={p.date}
                                  style={{ height: `${h}px` }}
                                  className={cn('w-2.5 rounded-sm', isLatest ? 'bg-accent' : 'bg-white/25')}
                                  title={`${new Date(p.date).toLocaleDateString('de-DE', { weekday: 'short' })}: ${p.stopsCompleted}`}
                                />
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Schicht-Puls: Live-Tempo-Ring mit Wochenvergleich */}
                {todayStats && status?.online_seit && (
                  <SchichtPuls
                    onlineSinceIso={status.online_seit}
                    totalDeliveries={todayStats.deliveries}
                    weekHistory={rankData?.history ?? []}
                  />
                )}

                {/* Schicht-Effizienz: Liefertempo vs. Ziel */}
                {todayStats && status?.online_seit && (
                  <SchichtEffizienzMeter
                    deliveries={todayStats.deliveries}
                    onlineMin={Math.floor((Date.now() - new Date(status.online_seit).getTime()) / 60_000)}
                    estEarnings={todayStats.estEarnings}
                  />
                )}

                {/* Tagesverdienst-Fortschrittsbalken: Einnahmen + Stopps + Ø-Zeit */}
                {todayStats && (
                  <EarningsProgressBar
                    completedBatches={0}
                    totalDeliveries={todayStats.deliveries}
                    cashCollected={todayStats.estEarnings}
                    onlineSinceIso={status?.online_seit ?? null}
                    activeBatch={activeBatch}
                    dailyTargetEur={80}
                  />
                )}

                {/* Phase 184: Schicht-Einnahmen-Ring — Visueller Donut-Ring für tägliches Einnahmenziel */}
                {todayStats && todayStats.deliveries > 0 && (
                  <SchichtEinnahmenRing
                    deliveries={todayStats.deliveries}
                    estEarnings={todayStats.estEarnings}
                    goalEur={80}
                  />
                )}

                {/* Phase 251: Ramp-Up-Fortschritt — Eigener Onboarding-Score für neue Fahrer */}
                <FahrerRampUpFortschritt driverId={driver.id} />

                {/* Phase 205: Schicht-Einnahmen-Chart — stündlicher Einnahmenverlauf */}
                <FahrerSchichtEinnahmenChart driverId={driver.id} />

                {/* Phase 206: Tages-Bewertungskarte — Ø Kundenbewertung letzte 7 Tage */}
                <FahrerTagesBewertungKarte driverId={driver.id} />

                {/* Pause-Widget — Phase 84 */}
                <FahrerPauseWidget />
                {/* Phase 193: Schicht-Pause-Erinnerung — Pflichtpause-Hinweis nach 2,5h / 4,5h */}
                <SchichtPauseReminder onlineSince={status?.online_seit ?? null} />
                {/* Phase 194: Streak-Badge — zeigt Pünktlichkeits-Serie + Multiplikator */}
                {driver.location_id && <StreakBadge driverId={driver.id} locationId={driver.location_id} />}
                {/* Phase 195: Meilenstein-Toast — Benachrichtigung bei neuen Streak-Meilensteinen */}
                <MeilensteinToast driverId={driver.id} />
                {/* Phase 207: Schicht-Bedarf-Chip — zeigt Fahrermangel-Stunden heute */}
                {driver.location_id && <SchichtBedarfChip locationId={driver.location_id} />}
                {/* Phase 269: Pünktlichkeits-Coach — Score + Coaching-Hinweise aus 14-Tage-Analyse */}
                <TourPunktlichkeitsCoach driverId={driver.id} />
              </>
            )}
          </section>
        )}

        {/* Active Batch — NEUE Delivery-View wenn unterwegs */}
        {activeBatch && activeBatch.status === 'unterwegs' && (
          <>
            {/* Tour-Status-Kopf: Fortschrittsbalken + KPIs (Stopps, Elapsed, ETA, Ø/Stopp) */}
            <TourStatusHeader activeBatch={activeBatch} />
            {/* Tour-Fortschritts-Kopfleiste — mit Live-Sekunden-Countdown */}
            <TourLiveProgressHeader batch={activeBatch as any} />
            {/* Tour-Fortschritts-Ring: visuelle Übersicht Stopps + ETA */}
            <TourProgressRing
              totalStops={activeBatch.stops.length}
              completedStops={activeBatch.stops.filter((s) => s.geliefert_am != null).length}
              distanceKm={(activeBatch as any).total_distance_km ?? null}
              startedAt={activeBatch.started_at}
              totalEtaMin={activeBatch.total_eta_min ?? null}
            />
          {/* Tour-Fortschritts-Cockpit: SVG-Fortschrittsring + Verdienst + Elapsed-Zeit */}
          <div className="px-4">
            <TourFortschrittsCockpit
              stops={activeBatch.stops.map(s => ({
                geliefert_am: s.geliefert_am,
                reihenfolge: s.reihenfolge,
                order: {
                  bestellnummer: (s.order as any)?.bestellnummer ?? '',
                  gesamtbetrag: (s.order as any)?.gesamtbetrag ?? 0,
                },
              }))}
              startedAt={activeBatch.started_at}
              totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
            />
          </div>
          {/* Phase 233: Effizienz-Analyse — Stops/Std vs. persönlicher Durchschnitt + Score */}
          <div className="px-4">
            <TourEffizienzAnalyse
              tour={{
                stops: activeBatch.stops.length,
                completedStops: activeBatch.stops.filter(s => s.geliefert_am).length,
                startedAt: activeBatch.started_at,
                totalEarnings: (activeBatch as any).total_earnings_eur ?? undefined,
                distanceKm: (activeBatch as any).total_distance_km ?? undefined,
              }}
            />
          </div>

          {/* Tour-Effizienz-Live: Live-Vergleich Fortschritt vs. Zeit — Vorsprung/Rückstand */}
          <div className="px-4">
            <TourEffizienzLive
              batch={{
                id: activeBatch.id,
                status: activeBatch.status ?? 'on_route',
                started_at: activeBatch.started_at,
                total_eta_min: activeBatch.total_eta_min ?? null,
                total_distance_km: (activeBatch as any).total_distance_km ?? null,
              }}
              stops={activeBatch.stops.map(s => ({
                id: s.id,
                reihenfolge: s.reihenfolge,
                angekommen_am: s.angekommen_am ?? null,
                geliefert_am: s.geliefert_am,
              }))}
            />
          </div>
          {/* Kassen-Übersicht: Bargeld-Stops mit Gesamtbetrag — aufklappbar */}
          <KassenUebersicht stops={activeBatch.stops as any} />
          {/* Phase 247: Nächster-Stopp-Countdown — ETA-Fenster + Distanz + Aktions-Buttons */}
          <NaechsterStoppCountdown
            stops={activeBatch.stops as any}
            currentLat={driverPos?.lat ?? null}
            currentLng={driverPos?.lng ?? null}
          />
          {/* Phase 218: Smart-Stop-Navigator — nächster Stop mit Navigation + Kundeninfo */}
          <SmartStopNavigator
            stops={activeBatch.stops as any}
            batchStartedAt={activeBatch.started_at}
            totalEtaMin={activeBatch.total_eta_min ?? null}
          />
          {/* Näherungs-Alert: Vibration + Overlay wenn Fahrer <250m vom nächsten Stop */}
          {(() => {
            const nextStop = activeBatch.stops.find((s) => !s.geliefert_am);
            if (!nextStop) return null;
            return (
              <ProximityStopAlert
                nextStopLat={(nextStop.order as any)?.kunde_lat ?? null}
                nextStopLng={(nextStop.order as any)?.kunde_lng ?? null}
                nextStopName={(nextStop.order as any)?.kunde_name ?? `Stop ${nextStop.reihenfolge}`}
                nextStopAddress={(nextStop.order as any)?.kunde_adresse ?? null}
              />
            );
          })()}
          {/* ETA-Ampel: Schnellstatus ob aktuelle Tour pünktlich ist */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <EtaAmpel
                etaLatest={(activeBatch.stops.find(s => !s.geliefert_am)?.order as any)?.eta_latest ?? null}
                etaEarliest={(activeBatch.stops.find(s => !s.geliefert_am)?.order as any)?.eta_earliest ?? null}
                batchStartedAt={activeBatch.started_at}
                totalEtaMin={activeBatch.total_eta_min ?? null}
                stopsTotal={activeBatch.stops.length}
                stopsCompleted={activeBatch.stops.filter(s => s.geliefert_am).length}
              />
            </div>
          )}
          {/* Nächster Stop — prominente Navigationskarte mit ETA + Betrag */}
          {activeBatch.stops.some(s => !s.geliefert_am) && (
            <div className="px-4">
              <StopNavCard
                stops={activeBatch.stops as any}
              />
            </div>
          )}
          {/* Phase 191: Stop-Timer-Ring — zeigt wie lange Fahrer bereits am aktuellen Stop ist */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am && s.angekommen_am);
            if (!nextStop) return null;
            return (
              <div className="px-4">
                <StopTimerRing
                  arrivedAt={nextStop.angekommen_am}
                  expectedDwellSec={90}
                  stopLabel={nextStop.order.kunde_adresse ?? `Stop ${nextStop.reihenfolge}`}
                />
              </div>
            );
          })()}
          {/* Next-Stop Navigation CTA — großer daumenfreundlicher Maps-Button */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!nextStop) return null;
            return (
              <div className="px-4">
                <NextStopCta
                  address={nextStop.order.kunde_adresse ?? null}
                  lat={nextStop.order.kunde_lat ?? null}
                  lng={nextStop.order.kunde_lng ?? null}
                  stopNumber={nextStop.reihenfolge}
                  isCurrentStop={true}
                />
              </div>
            );
          })()}
          {/* NaviWidget: Turn-by-Turn Navigation zum nächsten Stopp */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!nextStop) return null;
            const lat = nextStop.order.kunde_lat;
            const lng = nextStop.order.kunde_lng;
            if (!lat || !lng || !driverPos) return null;
            const vehicleRaw = status?.fahrzeug ?? driver.fahrzeug_praeferenz ?? '';
            const vehicle: 'car' | 'bike' = /fahrrad|bike|rad|velo/i.test(vehicleRaw) ? 'bike' : 'car';
            return (
              <div className="px-4">
                <NaviWidget
                  batchId={activeBatch.id}
                  stopIndex={nextStop.reihenfolge}
                  toLat={lat}
                  toLng={lng}
                  vehicle={vehicle}
                  driverLat={driverPos.lat}
                  driverLng={driverPos.lng}
                />
              </div>
            );
          })()}
          {/* Phase 255: Richtungs-Anzeige — Kompass-Pfeil + Luftlinien-Distanz zum nächsten Stopp */}
          {driverPos && (
            <div className="px-4">
              <FahrerRichtungsAnzeige
                stops={activeBatch.stops as any}
                driverLat={driverPos.lat}
                driverLng={driverPos.lng}
              />
            </div>
          )}
          {/* Phase 249: Ankunfts-Signal — Kunden mit einem Tap über Ankunft informieren */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!nextStop) return null;
            return (
              <div className="px-4">
                <FahrerAnkunftsSignal
                  orderId={nextStop.order_id}
                  kundeVorname={(nextStop.order as any)?.kunde_name?.split(' ')[0] ?? 'Kunde'}
                  kundeTelefon={(nextStop.order as any)?.kunde_telefon ?? null}
                />
              </div>
            );
          })()}
          {/* Kunden-Historie: Stammkunde vs. Neukunde, Bestellanzahl, Ø Wert */}
          {(() => {
            const nextStop = activeBatch.stops.find(s => !s.geliefert_am);
            if (!nextStop) return null;
            return (
              <div className="px-4">
                <KundenHistorieKarte
                  orderId={nextStop.order_id}
                  locationId={driver.location_id}
                />
              </div>
            );
          })()}
          {/* Phase 210: Fahrzeit-Prognose — verbleibende Zeit + Stopp-Countdown */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrzeitPrognose
                stops={activeBatch.stops.map(s => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge,
                  kunde_name: (s.order as any)?.kunde_name ?? undefined,
                  kunde_adresse: (s.order as any)?.kunde_adresse ?? null,
                  angekommen_am: s.angekommen_am,
                  geliefert_am: s.geliefert_am,
                }))}
                startedAt={activeBatch.started_at}
                totalEtaMin={activeBatch.total_eta_min ?? null}
              />
            </div>
          )}
          {/* Ankunftszeit-Prognose: GPS-basierte ETA für jeden Stopp */}
          {activeBatch.stops.filter((s: any) => !s.geliefert_am).length > 0 && (
            <div className="px-4">
              <TourStopEtaPredictor
                stops={activeBatch.stops as any}
                currentSpeed={gpsSpeed}
                started_at={activeBatch.started_at}
              />
            </div>
          )}
          {/* Tour-KPI-Summary: kompakte Leistungskennzahlen für die aktuelle Tour */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourKpiSummary
                stops={activeBatch.stops as any}
                batchStartedAt={activeBatch.started_at}
                totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
              />
            </div>
          )}
          {/* Tour-Navigation-HUD: Nächster Stopp mit Countdown, Distanz, Navigations-Button */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourNaviHUD
                stops={activeBatch.stops as any}
                totalEtaMin={(activeBatch as any).total_eta_min ?? null}
                totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
              />
            </div>
          )}
          {/* Tour-Stopp-Liste mit Navigation + ETA-Countdowns */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourStopsPanel
                stops={activeBatch.stops as any}
                batchStartedAt={activeBatch.started_at}
                totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
              />
            </div>
          )}
          {/* Stop-Navigator: Nächster Stopp mit Navigation, Anruf, Geliefert + Fortschrittsbalken */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourStopNavigator
                stops={activeBatch.stops as any}
                onMarkDelivered={markDelivered}
                pending={pending}
                kitchenStatuses={kitchenStatuses}
              />
            </div>
          )}
          {/* Phase 260: Tour-Navigations-Cockpit — Stop-Liste mit Expand, Anruf, Navigation, ETA */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourNavigationsCockpit driverId={driver.id} batchId={(activeBatch as any).id ?? null} />
            </div>
          )}
          {/* Phase 263: Kunden-Notiz-Karte — Lieferhinweise + Sonderanweisungen pro Stop hervorgehoben */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerKundenNotizKarte
                stops={activeBatch.stops as any}
                currentStopId={activeBatch.stops.find((s: any) => s.geliefert_am == null)?.id ?? null}
              />
            </div>
          )}
          {/* Phase 271: Tour-Stop-Detail-Karten — expandierbare Kunden-Info + Aktions-Buttons je Stop */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourStopsDetailPanel
                stops={activeBatch.stops.map((s, i): TourStop => ({
                  id: s.id,
                  stopNumber: s.reihenfolge ?? i + 1,
                  customerName: s.order?.kunde_name ?? 'Kunde',
                  address: [s.order?.kunde_adresse, s.order?.kunde_plz].filter(Boolean).join(', ') || 'Adresse unbekannt',
                  phone: s.order?.kunde_telefon ?? undefined,
                  notes: s.order?.kunde_notiz ?? s.order?.kunde_lieferhinweis ?? undefined,
                  itemCount: 1,
                  status: s.geliefert_am ? 'delivered' : s.angekommen_am ? 'arrived' : 'pending',
                  distanceKm: s.distanz_zum_vorgaenger_m ? s.distanz_zum_vorgaenger_m / 1000 : undefined,
                }))}
                activeStopId={activeBatch.stops.find((s) => !s.geliefert_am)?.id}
                onNavigate={(stop) => {
                  const q = encodeURIComponent(stop.address);
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank');
                }}
                onCall={(phone) => { window.open(`tel:${phone}`, '_self'); }}
              />
            </div>
          )}
          {/* Tour-Fortschritts-Ring: Visueller SVG-Ring mit Stopp-Fortschritt + ETA */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <TourFortschrittsRing
                stops={activeBatch.stops.map(s => ({
                  id: s.id,
                  geliefert_am: s.geliefert_am,
                  reihenfolge: s.reihenfolge,
                }))}
                batchStartedAt={activeBatch.started_at}
                totalEtaMin={activeBatch.total_eta_min ?? null}
              />
            </div>
          )}
          {/* Tour-Stopp-Aktionen: Aktionsbuttons für aktuellen Stopp — Angekommen, Geliefert, Anruf, Navigation */}
          {activeBatch.stops.length > 0 && (() => {
            const currentStop = activeBatch.stops.find((s) => !s.geliefert_am);
            if (!currentStop) return null;
            return (
              <div className="px-4">
                <TourStoppAktionen
                  stop={{
                    id: currentStop.id,
                    reihenfolge: currentStop.reihenfolge,
                    order: {
                      bestellnummer: currentStop.order.bestellnummer,
                      kunde_name: currentStop.order.kunde_name,
                      kunde_adresse: currentStop.order.kunde_adresse,
                      kunde_plz: currentStop.order.kunde_plz,
                      kunde_telefon: currentStop.order.kunde_telefon ?? null,
                      gesamtbetrag: currentStop.order.gesamtbetrag,
                      zahlungsart: (currentStop.order as any).zahlungsart ?? null,
                      bezahlt: (currentStop.order as any).bezahlt ?? null,
                      kunde_notiz: (currentStop.order as any).kunde_notiz ?? null,
                      kunde_lieferhinweis: (currentStop.order as any).kunde_lieferhinweis ?? null,
                    },
                    geliefert_am: currentStop.geliefert_am,
                    angekommen_am: (currentStop as any).angekommen_am ?? null,
                  }}
                  onMarkDelivered={markDelivered}
                  onMarkArrived={markArrived}
                  pending={pending}
                />
              </div>
            );
          })()}
          {/* Phase 257: Tour-Fertig-Prognose — wann endet die Tour + Schicht-Vergleich */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourFertigPrognose
                stops={activeBatch.stops as any}
                batchStartedAt={activeBatch.started_at ?? null}
                shiftEndAt={null}
              />
            </div>
          )}
          {/* Phase 265: Tour-Zeitplan — chronologische Stop-Übersicht mit ETA-Uhrzeiten */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourZeitplanFahrer
                stops={activeBatch.stops as any}
                batchStartedAt={activeBatch.started_at ?? null}
              />
            </div>
          )}
          {/* Fahrer-Navi-Strip: Nächster Stop mit Navigation + Telefon */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <FahrerNaviStrip stops={activeBatch.stops as any} currentStopIdx={0} />
            </div>
          )}
          {/* Phase 213: Stopp-Schnell-Panel — kompakter Schnellzugriff mit Navigation + Anruf je Stopp */}
          {activeBatch.stops.length > 0 && (
            <div className="px-4">
              <StopSchnellPanel
                stops={activeBatch.stops as any}
                driverLat={driverPos?.lat ?? null}
                driverLng={driverPos?.lng ?? null}
              />
            </div>
          )}
          {/* Wetter-Warn-Banner: Warnung bei gefährlichen oder schwierigen Bedingungen */}
          {driver.location_id && (
            <div className="px-4">
              <FahrerWetterWarnBanner locationId={driver.location_id} />
            </div>
          )}
          {/* Routen-Qualität: Pünktlichkeit, Distanz, Ø Zeit/Stop */}
          <div className="px-4">
            <FahrerRouteQualitaet
              stops={activeBatch.stops as any}
              batchStartedAt={activeBatch.started_at}
              totalEtaMin={activeBatch.total_eta_min ?? null}
              totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
            />
          </div>
          {/* Tour-Opt-Badge: zeigt ob Route optimiert wurde + km-Ersparnis */}
          <div className="px-4">
            <TourOptBadge batchId={activeBatch.id} />
          </div>
          {/* Tour-Abschluss-Prognose: Tourende-Schätzung + Verbleibende Stopps mit ETA */}
          <div className="px-4">
            <TourAbschlussPrognose
              stops={activeBatch.stops as any}
              batchStartedAt={activeBatch.started_at}
              totalEtaMin={activeBatch.total_eta_min ?? null}
            />
          </div>
          {/* Tour-Tempo-Tracker: aktueller Pace vs. benötigtes Tempo für pünktliche Lieferung */}
          <div className="px-4">
            <TourSpeedTracker
              stops={activeBatch.stops.map(s => ({
                id: s.id,
                reihenfolge: s.reihenfolge,
                geliefert_am: s.geliefert_am,
                angekommen_am: (s as any).angekommen_am ?? null,
              }))}
              batchStartedAt={activeBatch.started_at}
              totalEtaMin={activeBatch.total_eta_min ?? null}
            />
          </div>
          {/* Tour-Effizienz-Ticker: Live-KPI-Streifen — Pünktlichkeit, Ø Stopp-Zeit, Prognose */}
          <div className="px-4">
            <TourEfficiencyTicker
              stops={activeBatch.stops.map(s => ({
                id: s.id,
                reihenfolge: s.reihenfolge,
                angekommen_am: (s as any).angekommen_am ?? null,
                geliefert_am: s.geliefert_am,
                order: s.order ? {
                  eta_earliest: (s.order as any).eta_earliest ?? null,
                  gesamtbetrag: s.order.gesamtbetrag,
                } : null,
              }))}
              batchStartedAt={activeBatch.started_at}
            />
          </div>
          <TourBriefingCard batch={activeBatch as any} />
          {/* Route-Karte während aktiver Lieferung — zeigt verbleibende Stopps + Fahrerposition */}
          {activeBatch.stops.length > 1 && (
            <div className="px-4">
              <TourMiniMap
                stops={activeBatch.stops.map((s) => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge,
                  geliefert_am: s.geliefert_am,
                  order: {
                    kunde_name: s.order.kunde_name,
                    kunde_lat: s.order.kunde_lat ?? null,
                    kunde_lng: s.order.kunde_lng ?? null,
                    bestellnummer: s.order.bestellnummer,
                  },
                }))}
                driverLat={driverPos?.lat ?? null}
                driverLng={driverPos?.lng ?? null}
                className="mb-3"
              />
            </div>
          )}
          {/* Phase 185: Tour-Effizienz-Score — ETA-Genauigkeit des letzten abgeschlossenen Stops */}
          {(() => {
            const lastDelivered = [...activeBatch.stops]
              .filter(s => s.geliefert_am)
              .sort((a, b) => new Date(b.geliefert_am!).getTime() - new Date(a.geliefert_am!).getTime())[0] ?? null;
            return (
              <div className="px-4">
                <TourEffizienzScore
                  recentlyDeliveredStop={lastDelivered as any}
                  tourStartedAt={activeBatch.started_at}
                />
              </div>
            );
          })()}
          {/* Bargeld-Stops: zeigt welche Stops Bargeld erfordern + Gesamtbetrag */}
          <CashflowTracker stops={activeBatch.stops as any} />
          {/* Tour-Abschluss-Bilanz: Statistiken + Verdienst-Schätzung nach Tour-Ende */}
          <div className="px-4">
            <TourAbschlussRechner
              stops={activeBatch.stops as any}
              batchStartedAt={activeBatch.started_at}
              totalDistanceKm={(activeBatch as any).total_distance_km ?? null}
              vehicle={(activeBatch as any).vehicle ?? null}
            />
          </div>
          {/* Phase 238: Schicht-Kilometer-Tracker — Gefahrene Kilometer + CO₂-Vergleich */}
          <SchichtKilometerTracker fahrzeug={status?.fahrzeug ?? null} />
          {/* Phase 243: Schicht-Bonus-Booster — Live-Fortschritt zum nächsten Meilenstein-Bonus */}
          <SchichtBonusBooster />
          {/* Phase 236: Tour-Feedback-Schnell — Stimmung + Rating nach Tour */}
          {activeBatch.stops.every(s => s.geliefert_am) && (
            <TourFeedbackSchnell
              tourId={activeBatch.id}
              driverId={driver?.id ?? null}
            />
          )}
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
          </>
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
                {/* Live Tour-ETA: nächster frühester Kundentermin */}
                {(() => {
                  const nextEta = activeBatch.stops
                    .map((s) => (s.order as any).eta_earliest as string | null)
                    .filter(Boolean)
                    .map((d) => new Date(d!).getTime())
                    .sort((a, b) => a - b)[0] ?? null;
                  if (!nextEta) return null;
                  const secLeft = Math.floor((nextEta - Date.now()) / 1000);
                  const isOverdue = secLeft < 0;
                  const mm = Math.abs(Math.floor(secLeft / 60));
                  const ss = Math.abs(secLeft % 60);
                  return (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums',
                      isOverdue ? 'bg-red-500/30 text-red-200 animate-pulse' : secLeft < 600 ? 'bg-orange-500/30 text-orange-200' : 'bg-accent/20 text-accent',
                    )}>
                      ⏰ {isOverdue ? '-' : ''}{mm}:{String(ss).padStart(2, '0')}
                    </span>
                  );
                })()}
                <span className="font-display font-bold text-accent">
                  {euro(activeBatch.stops.reduce((s, st) => s + st.order.gesamtbetrag, 0))}
                </span>
              </div>
            </div>

            {/* Küchen-Bereitschafts-Fortschritt: X von Y Bestellungen fertig */}
            {(() => {
              const total = activeBatch.stops.length;
              if (total === 0) return null;
              const readyCount = activeBatch.stops.filter((s) => {
                const ks = kitchenStatuses.get(s.order_id);
                return ks === 'fertig' || ks === 'unterwegs';
              }).length;
              const cookingCount = activeBatch.stops.filter((s) => kitchenStatuses.get(s.order_id) === 'in_zubereitung').length;
              const allReady = readyCount === total;
              const pct = Math.round((readyCount / total) * 100);
              return (
                <div className={cn(
                  'rounded-xl border px-4 py-3 mb-3',
                  allReady
                    ? 'bg-accent/15 border-accent/40'
                    : cookingCount > 0
                    ? 'bg-orange-500/10 border-orange-400/30'
                    : 'bg-white/5 border-white/10',
                )}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn(
                      'text-[11px] font-bold uppercase tracking-wider',
                      allReady ? 'text-accent' : 'text-matcha-300',
                    )}>
                      {allReady ? '✓ Alle bereit zum Abholen' : `Küche: ${readyCount} von ${total} fertig`}
                    </span>
                    {cookingCount > 0 && (
                      <span className="text-[10px] font-bold text-orange-300 animate-pulse">
                        {cookingCount} kocht noch
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        allReady ? 'bg-accent' : pct >= 50 ? 'bg-orange-400' : 'bg-matcha-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

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

            {/* Geschätzte Fahrervergütung für diese Tour */}
            {(() => {
              const stopCount = activeBatch.stops.length;
              const distKm = (activeBatch as any).total_distance_km as number | null ?? 0;
              const estEarnings = stopCount * 1.50 + distKm * 0.20;
              if (estEarnings <= 0) return null;
              return (
                <div className="rounded-xl bg-matcha-700/30 border border-matcha-500/30 px-4 py-3 mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">Geschätzte Vergütung</div>
                    <div className="text-[9px] text-matcha-400 mt-0.5">
                      {stopCount}× €1.50
                      {distKm > 0 ? ` + ${distKm.toFixed(1)} km × €0.20` : ''}
                    </div>
                  </div>
                  <div className="font-display font-black text-accent text-xl">{euro(estEarnings)}</div>
                </div>
              );
            })()}

            {/* Gesamte Route in Navi öffnen — alle Stopps als Wegpunkte */}
            {(() => {
              const stopsWithCoords = activeBatch.stops
                .slice()
                .sort((a, b) => a.reihenfolge - b.reihenfolge)
                .filter(s => s.order.kunde_lat && s.order.kunde_lng);
              if (stopsWithCoords.length < 2) return null;
              const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
              let routeUrl: string;
              if (isIos) {
                const last = stopsWithCoords[stopsWithCoords.length - 1];
                const waypoints = stopsWithCoords
                  .slice(0, -1)
                  .map(s => `${s.order.kunde_lat},${s.order.kunde_lng}`)
                  .join('/');
                routeUrl = `maps://maps.apple.com/?daddr=${last.order.kunde_lat},${last.order.kunde_lng}&dirflg=d`;
                if (waypoints) routeUrl += `&via=${encodeURIComponent(waypoints)}`;
              } else {
                const waypoints = stopsWithCoords
                  .slice(1, -1)
                  .map(s => `${s.order.kunde_lat},${s.order.kunde_lng}`)
                  .join('|');
                const last = stopsWithCoords[stopsWithCoords.length - 1];
                routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${last.order.kunde_lat},${last.order.kunde_lng}&travelmode=driving`;
                if (waypoints) routeUrl += `&waypoints=${encodeURIComponent(waypoints)}`;
              }
              return (
                <a
                  href={routeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-blue-600/20 border border-blue-400/40 px-4 py-2.5 text-blue-200 text-[12px] font-bold transition active:scale-[0.98]"
                >
                  <Route size={14} />
                  Gesamte Route navigieren ({stopsWithCoords.length} Stopps)
                </a>
              );
            })()}

            {/* Tour-Karte: Mini-Map mit allen Stopps farbkodiert */}
            {activeBatch.stops.length > 1 && (
              <TourMiniMap
                stops={activeBatch.stops.map((s) => ({
                  id: s.id,
                  reihenfolge: s.reihenfolge,
                  geliefert_am: s.geliefert_am,
                  order: {
                    kunde_name: s.order.kunde_name,
                    kunde_lat: s.order.kunde_lat,
                    kunde_lng: s.order.kunde_lng,
                    bestellnummer: s.order.bestellnummer,
                  },
                }))}
                driverLat={driverPos?.lat ?? null}
                driverLng={driverPos?.lng ?? null}
                className="mb-3"
              />
            )}

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

                  // Individual stop nav URL — Apple Maps auf iOS, sonst Google Maps
                  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
                  const stopNavUrl = stop.order.kunde_lat && stop.order.kunde_lng
                    ? isIos
                      ? `maps://maps.apple.com/?daddr=${stop.order.kunde_lat},${stop.order.kunde_lng}&dirflg=d`
                      : `https://www.google.com/maps/dir/?api=1&destination=${stop.order.kunde_lat},${stop.order.kunde_lng}&travelmode=driving`
                    : stop.order.kunde_adresse
                    ? isIos
                      ? `maps://maps.apple.com/?q=${encodeURIComponent(stop.order.kunde_adresse)}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.order.kunde_adresse)}`
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
                              <>
                                <span className="shrink-0 rounded-full bg-accent/20 text-accent px-1.5 py-0.5 text-[9px] font-black uppercase">Fertig!</span>
                                {kitchenFertigAt.get(stop.order_id) && (() => {
                                  const fertigMs = Date.now() - new Date(kitchenFertigAt.get(stop.order_id)!).getTime();
                                  const fertigMin = Math.floor(fertigMs / 60_000);
                                  if (fertigMin < 1) return null;
                                  const cls = fertigMin >= 10 ? 'bg-red-500/25 text-red-300' : fertigMin >= 5 ? 'bg-orange-500/25 text-orange-300' : 'bg-white/10 text-matcha-300';
                                  return (
                                    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums', cls)}>
                                      {fertigMin >= 10 ? '⚠️ ' : ''}{fertigMin} Min warten
                                    </span>
                                  );
                                })()}
                              </>
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
                            {o.eta_earliest ? (() => {
                              const etaMs = new Date(o.eta_earliest).getTime();
                              const etaStr = new Date(o.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                              const minLeft = Math.round((etaMs - Date.now()) / 60_000);
                              const isOverdue = etaMs < Date.now();
                              return (
                                <span className={cn(
                                  'text-[9px] font-bold tabular-nums rounded-full px-1.5 py-0.5',
                                  isOverdue ? 'bg-red-500/20 text-red-300' : minLeft <= 10 ? 'bg-orange-500/20 text-orange-300' : 'bg-accent/15 text-accent/80',
                                )}>
                                  ⏰ {isOverdue ? `${Math.abs(minLeft)}m verspätet` : `~${minLeft} Min`} ({etaStr})
                                </span>
                              );
                            })() : (activeBatch as any).total_eta_min && arr.length > 0 ? (() => {
                              const estMs = Date.now() + ((idx + 1) / arr.length) * (activeBatch as any).total_eta_min * 60_000;
                              const estTime = new Date(estMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                              const estMin = Math.round(((idx + 1) / arr.length) * (activeBatch as any).total_eta_min);
                              return (
                                <span className="text-[9px] font-bold text-matcha-300 tabular-nums rounded-full bg-white/5 px-1.5 py-0.5">
                                  ⏰ ~{estMin} Min ({estTime})
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
                          {/* Anruf-Button — Kundennummer direkt wählen */}
                          {o.kunde_telefon && (
                            <a
                              href={`tel:${o.kunde_telefon}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-white/10 text-matcha-200 px-2 py-1 text-[9px] font-bold hover:bg-white/20 transition"
                              title={`Anrufen: ${o.kunde_telefon}`}
                            >
                              <Phone className="h-3 w-3" />
                              Anruf
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

            {/* Route-Vorschau in Maps (Apple Maps auf iOS, Google Maps sonst) */}
            {activeBatch.stops.length > 0 && (() => {
              const withCoords = activeBatch.stops
                .sort((a, b) => a.reihenfolge - b.reihenfolge)
                .filter((s) => s.order.kunde_lat && s.order.kunde_lng);
              if (withCoords.length === 0) return null;
              const dest = `${withCoords[withCoords.length - 1].order.kunde_lat},${withCoords[withCoords.length - 1].order.kunde_lng}`;
              const waypoints = withCoords.slice(0, -1).map((s) => `${s.order.kunde_lat},${s.order.kunde_lng}`).join('|');
              const isIosDevice = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
              const mapsUrl = isIosDevice
                ? `maps://maps.apple.com/?daddr=${dest}${withCoords.slice(0, -1).map((s) => `&waypoint=${s.order.kunde_lat},${s.order.kunde_lng}`).join('')}&dirflg=d`
                : waypoints
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
                  {isIosDevice ? '🍎' : '🗺️'} Route in {isIosDevice ? 'Apple Maps' : 'Google Maps'} ({withCoords.length} {withCoords.length === 1 ? 'Stopp' : 'Stopps'})
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

        {/* Warte-Anzeige: kein Batch, online, keine offenen Touren */}
        {!activeBatch && isOnline && openBatches.length === 0 && (
          <FahrerWarteAnzeige driverId={driver.id} locationId={driver.location_id} />
        )}

        {/* Schicht-KPI-Live: Stops, Effizienz, km, Ziel — nur wenn online und kein aktiver Batch */}
        {!activeBatch && isOnline && (
          <div className="px-4">
            <SchichtKpiLive driverId={driver.id} onlineSeit={status?.online_seit ?? null} />
          </div>
        )}

        {/* Phase 222: Comeback-Bonus-Hinweis — Toast wenn Fahrer nach Pause Bonus erhält */}
        {isOnline && (
          <div className="px-4">
            <FahrerComebackBonusHinweis isOnline={isOnline} />
          </div>
        )}

        {/* Phase 222: Incentive-Live-Strip — heutige Boni + Meilenstein-Fortschritt */}
        {!activeBatch && isOnline && (
          <div className="px-4">
            <FahrerIncentiveLiveStrip />
          </div>
        )}

        {/* Wochen-Ranking — nur sichtbar wenn kein aktiver Batch und online */}
        {!activeBatch && isOnline && <FahrerRankingCard />}

        {/* Tages-Zusammenfassung: Schicht-Performance als aufklappbare Übersicht */}
        {!activeBatch && isOnline && todayStats && (
          <FahrerTagesZusammenfassung
            driverId={driver.id}
            completedBatches={[]}
            totalDeliveries={todayStats.deliveries}
            cashCollected={todayStats.estEarnings}
            onlineSeit={status?.online_seit ?? null}
            currentBatchStops={0}
          />
        )}

        {/* Aktive Challenges */}
        {!activeBatch && isOnline && <ChallengeWidget />}

        {/* Positionierungs-Empfehlung */}
        {!activeBatch && isOnline && <PositioningSuggestionBanner />}

        {/* Phase 174: Geo-Cluster Hotspot-Tipp — beste Warte-Position bei Leerlauf */}
        {!activeBatch && isOnline && (
          <DriverHotspotTip
            isOnline={isOnline}
            hasActiveBatch={false}
            driverPos={driverPos}
            locationId={driver.location_id}
          />
        )}

        {/* Offline state */}
        {!isOnline && !activeBatch && (
          <section className="text-center py-8">
            <Power className="h-12 w-12 text-matcha-300 mx-auto mb-2 opacity-40" />
            <div className="text-matcha-200">Du bist offline. Geh online, um Touren anzunehmen.</div>
          </section>
        )}

        {/* Tagesabschluss-Badge: persistente Schicht-Zusammenfassung nach Schichtende */}
        <TagesabschlussBadge
          isOnline={isOnline}
          driverId={driver.id}
          shiftData={tagesabschlussData}
          rankData={rankData}
        />

        {/* Schicht-Statistik — immer sichtbar wenn kein aktiver Batch */}
        {!activeBatch && <SchichtStats driverId={driver.id} isOnline={isOnline} />}

        {/* Tempo-Karte: rollendes Liefertempo der letzten 2 Stunden */}
        {!activeBatch && isOnline && <FahrerPaceCard driverId={driver.id} />}

        {/* Phase 94: Schicht-Dauer-Anzeige — wie lange ist der Fahrer schon online? */}
        {!activeBatch && isOnline && status?.online_seit && (
          <FahrerSchichtCountdown onlineSeit={status.online_seit} />
        )}

        {/* Heutige Stopps-Verlauf — zeitlicher Log der abgeschlossenen Lieferungen */}
        {!activeBatch && <LetzteStoppsLog driverId={driver.id} />}
        {/* Kunden-Bewertungs-Historie — persönliche Sterne + Trend */}
        {!activeBatch && <FahrerRatingHistorie driverId={driver.id} />}

        {/* Abrechnungsperioden — Lohnzettel-Download */}
        {!activeBatch && <MeineAbrechnungen />}

        {/* Schicht-Verlauf — letzte abgeschlossene Schichten */}
        {!activeBatch && <MeineSchichten />}

        {/* Schicht-Buchung — Fahrer können sich für offene Schichten anmelden */}
        {!activeBatch && driver.location_id && (
          <SchichtBuchung locationId={driver.location_id} />
        )}
      </main>

      <UpdateBanner />
      <OfflineNetworkBanner />

      {/* Alarm-Ringer: klingelt wenn Tour in Open-Liste (zum Annehmen) ODER zugewiesen (zum Picken) */}
      <PushRegister />
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

      {/* Schicht-Abschluss Modal */}
      {showShiftEnd && shiftSnapshot && (
        <SchichtAbschlussModal
          snapshot={shiftSnapshot}
          rankData={rankData}
          driverId={driver.id}
          onConfirm={goOffline}
          onCancel={() => setShowShiftEnd(false)}
        />
      )}
    </div>
    </>
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
  const [earningRecords, setEarningRecords] = useState<{ id: string; totalAmount: number; baseAmount: number; kmBonus: number; peakBonus: number; ratingBonus: number; deliveryKm: number; wasPeakTime: boolean; completedAt: string; paidOut: boolean }[]>([]);
  const [earningsOpen, setEarningsOpen] = useState(false);

  useEffect(() => {
    fetch('/api/delivery/driver/earnings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.today?.deliveries >= 0) setRealEarnings(d.today);
        if (Array.isArray(d?.records)) setEarningRecords(d.records);
      })
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

          {/* Verdienst-Aufschlüsselung: Letzte Lieferungen mit Bonus-Details */}
          {earningRecords.length > 0 && (() => {
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const todayRecs = earningRecords.filter(r => new Date(r.completedAt) >= todayStart);
            if (todayRecs.length === 0) return null;
            return (
              <div className="mt-3 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <button
                  onClick={() => setEarningsOpen(p => !p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">
                    Verdienst-Details ({todayRecs.length} Lieferungen)
                  </span>
                  <span className="text-matcha-400 text-[10px]">{earningsOpen ? '▲' : '▼'}</span>
                </button>
                {earningsOpen && (
                  <div className="border-t border-white/8 divide-y divide-white/5">
                    {todayRecs.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-matcha-200 tabular-nums">
                            {new Date(r.completedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span className="text-[9px] bg-white/10 rounded px-1.5 py-0.5 text-matcha-300">
                              {euro(r.baseAmount)} Basis
                            </span>
                            {r.kmBonus > 0 && (
                              <span className="text-[9px] bg-matcha-600/40 rounded px-1.5 py-0.5 text-matcha-200">
                                +{euro(r.kmBonus)} km ({r.deliveryKm.toFixed(1)}km)
                              </span>
                            )}
                            {r.peakBonus > 0 && (
                              <span className="text-[9px] bg-amber-500/20 rounded px-1.5 py-0.5 text-amber-300">
                                +{euro(r.peakBonus)} Peak
                              </span>
                            )}
                            {r.ratingBonus > 0 && (
                              <span className="text-[9px] bg-blue-500/20 rounded px-1.5 py-0.5 text-blue-300">
                                +{euro(r.ratingBonus)} Bonus
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`text-sm font-black tabular-nums shrink-0 ${r.paidOut ? 'text-accent' : 'text-matcha-300'}`}>
                          {euro(r.totalAmount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </section>
  );
}

/* ---------- FahrerPaceCard ---------- */

function FahrerPaceCard({ driverId }: { driverId: string }) {
  const supabase = createClient();
  type SlotData = { h: number; count: number };
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const since = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    (async () => {
      const [{ data: legacyBatches }, { data: miseDriver }] = await Promise.all([
        supabase.from('delivery_batches').select('id').eq('fahrer_id', driverId).gte('created_at', since),
        supabase.from('mise_drivers').select('id').eq('employee_id', driverId).maybeSingle(),
      ]);
      const miseDriverId = (miseDriver as { id: string } | null)?.id ?? null;

      const { data: miseBatches } = miseDriverId
        ? await supabase.from('mise_delivery_batches').select('id').eq('driver_id', miseDriverId).gte('created_at', since)
        : { data: [] as { id: string }[] };

      const [{ data: legacyStops }, { data: miseStops }] = await Promise.all([
        legacyBatches?.length
          ? supabase.from('delivery_batch_stops').select('geliefert_am').in('batch_id', (legacyBatches as { id: string }[]).map((b) => b.id)).not('geliefert_am', 'is', null).gte('geliefert_am', since) as Promise<{ data: { geliefert_am: string }[] | null }>
          : Promise.resolve({ data: [] as { geliefert_am: string }[] }),
        miseBatches?.length
          ? supabase.from('mise_delivery_batch_stops').select('completed_at').eq('type', 'dropoff').in('batch_id', (miseBatches as { id: string }[]).map((b) => b.id)).not('completed_at', 'is', null).gte('completed_at', since) as Promise<{ data: { completed_at: string }[] | null }>
          : Promise.resolve({ data: [] as { completed_at: string }[] }),
      ]);

      const allTimestamps: string[] = [
        ...(legacyStops ?? []).map((s) => s.geliefert_am),
        ...(miseStops ?? []).map((s) => s.completed_at),
      ];
      if (!allTimestamps.length) return;

      const buckets: Record<number, number> = {};
      for (const ts of allTimestamps) {
        const h = new Date(ts).getHours();
        buckets[h] = (buckets[h] ?? 0) + 1;
      }
      const nowH = new Date().getHours();
      const result: SlotData[] = [];
      for (let i = 1; i >= 0; i--) {
        const h = (nowH - i + 24) % 24;
        result.push({ h, count: buckets[h] ?? 0 });
      }
      setSlots(result);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (slots.length === 0 || slots.every((s) => s.count === 0)) return null;

  const total = slots.reduce((s, x) => s + x.count, 0);
  const rate = Math.round(total / 2 * 10) / 10; // deliveries/hour over 2h window
  const max = Math.max(...slots.map((s) => s.count), 1);

  const rateColor =
    rate >= 4 ? 'text-accent' : rate >= 2 ? 'text-amber-300' : 'text-matcha-400';

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-accent" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-300">
          Liefertempo (2h)
        </span>
        <span className={cn('ml-auto font-mono text-lg font-black tabular-nums', rateColor)}>
          {rate}/h
        </span>
      </div>
      <div className="flex items-end gap-1.5">
        {slots.map(({ h, count }) => {
          const barPct = Math.max(8, Math.round((count / max) * 100));
          const isNow = h === new Date().getHours();
          return (
            <div key={h} className="flex flex-1 flex-col items-center gap-0.5">
              <span className="text-[8px] font-bold tabular-nums text-matcha-400">{count}</span>
              <div
                className={cn(
                  'w-full rounded-t-sm transition-all',
                  isNow ? 'bg-accent' : 'bg-matcha-600',
                )}
                style={{ height: `${barPct * 0.4}px` }}
              />
              <span className="text-[8px] tabular-nums text-matcha-500">{h}h</span>
            </div>
          );
        })}
      </div>
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

/* ---------- FahrerWarteAnzeige ---------- */

function FahrerWarteAnzeige({ driverId, locationId }: { driverId: string; locationId?: string | null }) {
  const supabase = createClient();
  const [waitSec, setWaitSec] = useState(0);
  const [lastDeliveryMin, setLastDeliveryMin] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const [kitchenLoad, setKitchenLoad] = useState<{ eta_min: number; active_orders: number } | null>(null);

  // Tick every second for wait timer
  useEffect(() => {
    const t = setInterval(() => {
      setWaitSec((s) => s + 1);
      setPulse((p) => !p);
    }, 1_000);
    return () => clearInterval(t);
  }, []);

  // Live kitchen queue depth
  useEffect(() => {
    if (!locationId) return;
    const poll = () =>
      fetch(`/api/delivery/eta/live?location_id=${locationId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.eta_min != null)
            setKitchenLoad({ eta_min: d.eta_min as number, active_orders: (d.active_orders as number) ?? 0 });
        })
        .catch(() => {});
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  // Fetch last completed delivery time
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
    <section className="rounded-2xl border border-white/10 bg-white/3 p-5 text-center">
      {/* Pulse ring */}
      <div className="relative inline-flex items-center justify-center mb-4">
        <div className={cn(
          'absolute h-16 w-16 rounded-full border-2 border-accent transition-all duration-1000',
          pulse ? 'scale-125 opacity-0' : 'scale-100 opacity-40',
        )} />
        <div className="h-12 w-12 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
          <Route className="h-6 w-6 text-accent" />
        </div>
      </div>

      <div className="font-display text-matcha-100 font-bold text-base mb-1">
        Warte auf nächste Tour…
      </div>
      <div className="text-[11px] text-matcha-400 mb-3">
        System ist aktiv — du bekommst sofort eine Benachrichtigung
      </div>

      {/* Wait timer */}
      <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-4 py-2 tabular-nums">
        <Clock className="h-3.5 w-3.5 text-matcha-400" />
        <span className="text-sm font-black text-matcha-200">
          {waitMin > 0 ? `${waitMin}m ` : ''}{waitSecDisplay.toString().padStart(2, '0')}s
        </span>
        <span className="text-[10px] text-matcha-400">Wartezeit</span>
      </div>

      {lastDeliveryMin !== null && (
        <div className="mt-2 text-[10px] text-matcha-400">
          Letzte Lieferung vor {lastDeliveryMin} Min
        </div>
      )}

      {/* Live kitchen load */}
      {kitchenLoad && (
        <div className={cn(
          'mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold',
          kitchenLoad.eta_min > 30
            ? 'bg-red-500/15 text-red-300'
            : kitchenLoad.eta_min > 20
              ? 'bg-orange-500/15 text-orange-300'
              : 'bg-matcha-500/15 text-matcha-300',
        )}>
          <Package className="h-3 w-3 shrink-0" />
          Küche: {kitchenLoad.active_orders} Bestellung{kitchenLoad.active_orders !== 1 ? 'en' : ''} · ETA {kitchenLoad.eta_min} Min
        </div>
      )}

      {/* Nächste Tour Schätzung: basierend auf Küchen-ETA */}
      {kitchenLoad && kitchenLoad.active_orders >= 1 && (() => {
        // Schätze wann die erste fertige Bestellung dispatcht werden kann
        // (erste Hälfte der ETA = Durchschnitt bis erste Bestellung fertig)
        const estMin = Math.max(1, Math.round(kitchenLoad.eta_min * 0.4));
        return (
          <div className="mt-2 text-[11px] font-bold text-accent/80 tabular-nums">
            ⚡ Nächste Tour in ca. {estMin} Min erwartet
          </div>
        );
      })()}
    </section>
  );
}

/* ---------- FahrerRankingCard ---------- */

type RankingState = {
  rank: number;
  total: number;
  toursWeek: number;
  stopsWeek: number;
  distKmWeek: number;
  onTimeRate: number | null;
  trend: 'up' | 'down' | 'same';
};

function FahrerRankingCard() {
  const [perf, setPerf] = useState<RankingState | null>(null);

  useEffect(() => {
    fetch('/api/delivery/driver/my-performance?period=week&days=14')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.rank == null) return;
        const history = (d.history ?? []) as Array<{
          toursCompleted: number;
          stopsCompleted: number;
          totalDistanceKm: number;
          onTimeRate: number | null;
        }>;
        const lastWeek = history.slice(-7);
        const toursWeek = lastWeek.reduce((s, h) => s + h.toursCompleted, 0);
        const stopsWeek = lastWeek.reduce((s, h) => s + h.stopsCompleted, 0);
        const distKmWeek = lastWeek.reduce((s, h) => s + h.totalDistanceKm, 0);
        const ratedDays = lastWeek.filter((h) => h.onTimeRate != null);
        const onTimeRate =
          ratedDays.length > 0
            ? ratedDays.reduce((s, h) => s + h.onTimeRate!, 0) / ratedDays.length
            : null;
        const recentStops = lastWeek.slice(-3).reduce((s, h) => s + h.stopsCompleted, 0);
        const prevStops = lastWeek.slice(-6, -3).reduce((s, h) => s + h.stopsCompleted, 0);
        const trend: 'up' | 'down' | 'same' =
          recentStops > prevStops + 1 ? 'up' : recentStops < prevStops - 1 ? 'down' : 'same';
        setPerf({ rank: d.rank, total: d.total ?? 1, toursWeek, stopsWeek, distKmWeek, onTimeRate, trend });
      })
      .catch(() => {});
  }, []);

  if (!perf) return null;

  const medal = perf.rank === 1 ? '🥇' : perf.rank === 2 ? '🥈' : perf.rank === 3 ? '🥉' : null;
  const rankColor =
    perf.rank === 1
      ? 'text-yellow-400'
      : perf.rank <= 3
      ? 'text-matcha-300'
      : 'text-white/60';

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/60">
            Wochen-Ranking
          </span>
        </div>
        <div className={cn('flex items-center gap-1 font-display font-black text-2xl', rankColor)}>
          {medal && <span>{medal}</span>}
          <span>#{perf.rank}</span>
          <span className="text-sm font-normal text-white/40">/ {perf.total}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/5 px-2 py-2.5">
          <div className="font-display text-xl font-black text-white">{perf.stopsWeek}</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Lieferungen</div>
        </div>
        <div className="rounded-xl bg-white/5 px-2 py-2.5">
          <div className="font-display text-xl font-black text-white">{perf.toursWeek}</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Touren</div>
        </div>
        <div className="rounded-xl bg-white/5 px-2 py-2.5">
          <div className="font-display text-xl font-black text-white">
            {perf.distKmWeek.toFixed(0)}
            <span className="text-xs font-normal text-white/50"> km</span>
          </div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Strecke</div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-white/50">
        {perf.onTimeRate != null && (
          <span>
            Pünktlich:{' '}
            <span className="font-bold text-matcha-300">{Math.round(perf.onTimeRate * 100)}%</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <TrendingUp
            className={cn(
              'h-3.5 w-3.5',
              perf.trend === 'up'
                ? 'text-matcha-400'
                : perf.trend === 'down'
                ? 'text-red-400 rotate-180'
                : 'text-white/30',
            )}
          />
          {perf.trend === 'up' ? 'Trend steigend' : perf.trend === 'down' ? 'Trend fallend' : 'Stabil'}
        </span>
      </div>
    </section>
  );
}

/* ---------- ChallengeWidget — aktive Challenges in der Fahrer-App ---------- */

type ChallengeEntry = {
  challenge: {
    id: string;
    title: string;
    challengeType: string;
    targetValue: number;
    rewardEur: number;
    endsAt: string;
  };
  participation: {
    currentValue: number;
    progressPct: number;
    completed: boolean;
    rank: number;
  };
};

function ChallengeWidget() {
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);

  useEffect(() => {
    fetch('/api/delivery/driver/challenges')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.challenges) setEntries(d.challenges as ChallengeEntry[]); })
      .catch(() => {});
  }, []);

  if (entries.length === 0) return null;

  function unitLabel(type: string): string {
    if (type === 'deliveries_count') return 'Lieferungen';
    if (type === 'on_time_rate')     return '% Pünktlichkeit';
    if (type === 'avg_rating')       return '★ Sterne';
    if (type === 'revenue_total')    return '€ Umsatz';
    return '';
  }

  function timeLeft(iso: string): string {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Abgelaufen';
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} Min`;
  }

  return (
    <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60">Aktive Challenges</span>
      </div>
      {entries.map(({ challenge: ch, participation: p }) => {
        const pct = Math.min(100, Math.round(p.progressPct));
        return (
          <div key={ch.id} className="rounded-xl bg-white/5 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-white leading-tight">{ch.title}</span>
              {ch.rewardEur > 0 && (
                <span className="shrink-0 rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-xs font-bold text-amber-300">
                  +€{ch.rewardEur.toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
              <span>{p.currentValue} / {ch.targetValue} {unitLabel(ch.challengeType)}</span>
              <span>{timeLeft(ch.endsAt)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  p.completed ? 'bg-emerald-400' : pct >= 75 ? 'bg-amber-400' : 'bg-blue-400',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            {p.completed && (
              <p className="mt-1.5 text-xs text-emerald-400 font-medium">
                ✓ Ziel erreicht — Prämie wird abgerechnet!
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
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
          {grouped.map(({ batchId, stops, totalAmount, cashAmount, estDriverEarnings, locationName, maxEta, totalDistanceKm, estEtaMin }, idx) => {
            // Beste Wahl: höchster Verdienst / geschätzte Minuten
            const earningRate = estEtaMin && estEtaMin > 0 && estDriverEarnings > 0
              ? estDriverEarnings / estEtaMin
              : 0;
            const bestIdx = grouped.reduce((best, g, i) => {
              const r = g.estEtaMin && g.estEtaMin > 0 && g.estDriverEarnings > 0
                ? g.estDriverEarnings / g.estEtaMin : 0;
              return r > (grouped[best].estEtaMin && grouped[best].estEtaMin! > 0 && grouped[best].estDriverEarnings > 0
                ? grouped[best].estDriverEarnings / grouped[best].estEtaMin! : 0) ? i : best;
            }, 0);
            const isBestChoice = grouped.length > 1 && idx === bestIdx && earningRate > 0;
            return (
            <div key={batchId} className={cn('rounded-2xl p-4', isBestChoice ? 'bg-accent/10 border-2 border-accent' : 'bg-accent/5 border-2 border-accent/30')}>
              <div className="flex items-start gap-3 mb-3">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', isBestChoice ? 'bg-accent text-matcha-900' : 'bg-accent/20 text-accent')}>
                  <Zap size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-display font-bold">
                      {stops.length === 1 ? stops[0].kunde_name : `${stops.length} Stopps · ${locationName}`}
                    </div>
                    {isBestChoice && (
                      <span className="rounded-full bg-accent text-matcha-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                        ⭐ Beste Wahl
                      </span>
                    )}
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

              {/* Karten-Vorschau: Alle Lieferpunkte vor dem Annehmen auf der Karte sehen */}
              <OpenBatchMap
                stops={stops.map((s) => ({
                  order_id: s.order_id,
                  kunde_name: s.kunde_name,
                  kunde_lat: s.kunde_lat ?? null,
                  kunde_lng: s.kunde_lng ?? null,
                }))}
                restaurantLat={stops[0]?.location_lat ?? null}
                restaurantLng={stops[0]?.location_lng ?? null}
                restaurantName={stops[0]?.location_name}
                className="mb-3"
              />

              {/* Stop list — Phase 105: mit geschätzter Ankunftszeit pro Stopp */}
              <div className="space-y-2 mb-3">
                {stops.map((s, i) => {
                  const isCash = s.zahlungsart === 'bar' || s.bezahlt === false;
                  // Schätze Ankunftszeit: Abholung ~5 Min + 3 Min/Stopp (grob)
                  const pickupMin = 5;
                  const perStopMin = 3;
                  const etaMin = pickupMin + (i + 1) * perStopMin + Math.round(((s.geschaetzte_lieferung_min ?? 20) / stops.length));
                  const etaTime = new Date(Date.now() + etaMin * 60_000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
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
                        {/* Phase 105: Geschätzte Ankunftszeit */}
                        <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent/80">
                          <Clock size={8} />
                          ~{etaMin} Min · ca. {etaTime} Uhr
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

/* ---------- SchichtAbschlussModal ---------- */

function SchichtAbschlussModal({
  snapshot,
  rankData,
  driverId,
  onConfirm,
  onCancel,
}: {
  snapshot: { deliveries: number; tours: number; distKm: number; betrag: number; onlineMin: number };
  rankData: { rank: number; total: number } | null;
  driverId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  type TourDetail = { id: string; stops: number; distKm: number | null; startzeit: string | null; durationMin: number | null };
  const [tourDetails, setTourDetails] = useState<TourDetail[]>([]);
  const [showTours, setShowTours] = useState(false);

  useEffect(() => {
    async function load() {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: batches } = await supabase
        .from('delivery_batches')
        .select('id, total_distance_km, startzeit, stops:delivery_batch_stops(id, geliefert_am)')
        .eq('fahrer_id', driverId)
        .gte('created_at', today.toISOString())
        .order('startzeit', { ascending: true });
      if (!batches) return;
      const details: TourDetail[] = (batches as any[]).map((b: any) => {
        const stops = (b.stops as any[]) ?? [];
        const delivered = stops.filter((s: any) => s.geliefert_am);
        let durationMin: number | null = null;
        if (b.startzeit && delivered.length > 0) {
          const last = delivered.reduce((latest: any, s: any) => (!latest || s.geliefert_am > latest.geliefert_am ? s : latest), null);
          if (last) durationMin = Math.round((new Date(last.geliefert_am).getTime() - new Date(b.startzeit).getTime()) / 60_000);
        }
        return { id: b.id, stops: delivered.length, distKm: b.total_distance_km, startzeit: b.startzeit, durationMin };
      });
      setTourDetails(details.filter(d => d.stops > 0));
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);
  const effScore = snapshot.onlineMin > 0
    ? Math.min(100, Math.round((snapshot.deliveries / Math.max(1, snapshot.onlineMin)) * 60 * 20))
    : 0;
  const badge = effScore >= 80
    ? { label: 'Excellent! 🏆', color: 'text-accent' }
    : effScore >= 60
    ? { label: 'Sehr gut! ⭐', color: 'text-blue-400' }
    : effScore >= 40
    ? { label: 'Gut gemacht! 👏', color: 'text-amber-400' }
    : { label: 'Danke für deine Schicht!', color: 'text-matcha-200' };

  const estEarnings = snapshot.deliveries * 3 + snapshot.distKm * 0.15;
  const hStr = snapshot.onlineMin >= 60 ? `${Math.floor(snapshot.onlineMin / 60)}h ` : '';
  const mStr = `${snapshot.onlineMin % 60}m`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-matcha-900/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-matcha-800 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">🎉</div>
          <div className="font-display text-2xl font-black text-accent">Schicht abgeschlossen!</div>
          <div className={`text-sm font-bold mt-1 ${badge.color}`}>{badge.label}</div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <div className="font-display text-3xl font-black text-accent leading-none">{snapshot.deliveries}</div>
            <div className="text-[11px] text-matcha-300 mt-1.5">Lieferungen</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <div className="font-display text-3xl font-black text-accent leading-none">{snapshot.tours}</div>
            <div className="text-[11px] text-matcha-300 mt-1.5">Touren</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <div className="font-display text-xl font-black text-accent leading-none">
              {snapshot.distKm > 0 ? `${snapshot.distKm.toFixed(1)} km` : '—'}
            </div>
            <div className="text-[11px] text-matcha-300 mt-1.5">Strecke</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <div className="font-display text-xl font-black text-accent leading-none">
              {snapshot.onlineMin > 0 ? `${hStr}${mStr}` : '—'}
            </div>
            <div className="text-[11px] text-matcha-300 mt-1.5">Online-Zeit</div>
          </div>
        </div>

        {/* Estimated earnings */}
        {estEarnings > 0 && (
          <div className="rounded-2xl bg-accent/10 border border-accent/20 px-4 py-3 mb-5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400 mb-1">
              Geschätzter Verdienst
            </div>
            <div className="font-display text-2xl font-black text-accent">{euro(Math.round(estEarnings * 100) / 100)}</div>
            <div className="text-[9px] text-matcha-400 mt-0.5">Ø {euro(Math.round((estEarnings / Math.max(1, snapshot.deliveries)) * 100) / 100)} pro Lieferung</div>
          </div>
        )}

        {/* Efficiency bar */}
        {effScore > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">Schicht-Effizienz</span>
              <span className="text-[10px] font-black text-accent">{effScore}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${effScore >= 80 ? 'bg-accent' : effScore >= 60 ? 'bg-blue-400' : 'bg-amber-400'}`}
                style={{ width: `${effScore}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-matcha-400 text-right">
              {snapshot.onlineMin > 0 ? `${((snapshot.deliveries / Math.max(1, snapshot.onlineMin)) * 60).toFixed(1)}/h Lieferungen` : ''}
            </div>
          </div>
        )}

        {/* Wochen-Rang — Kontext für diese Schicht */}
        {rankData && (
          <div className={cn(
            'rounded-2xl border px-4 py-3 mb-5 flex items-center justify-between',
            rankData.rank <= 3 ? 'bg-yellow-500/15 border-yellow-500/30' : 'bg-white/5 border-white/10',
          )}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400 mb-0.5">Wochenrang</div>
              <div className={cn('font-display text-xl font-black', rankData.rank <= 3 ? 'text-yellow-300' : 'text-accent')}>
                {rankData.rank <= 3 && '🏆 '}#{rankData.rank}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-matcha-400">von {rankData.total} Fahrern</div>
              <div className="text-[10px] text-matcha-300 mt-0.5">diese Woche</div>
            </div>
          </div>
        )}

        {/* Per-Tour Breakdown */}
        {tourDetails.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowTours(v => !v)}
              className="w-full flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 text-[11px] font-bold text-matcha-300 active:bg-white/10 transition"
            >
              <span>Tour-Details ({tourDetails.length} Touren)</span>
              <span>{showTours ? '▲' : '▼'}</span>
            </button>
            {showTours && (
              <div className="mt-1.5 space-y-1.5">
                {tourDetails.map((t, i) => (
                  <div key={t.id} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-matcha-400">Tour {i + 1}</span>
                      {t.startzeit && (
                        <span className="text-[10px] text-matcha-500">
                          {new Date(t.startzeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-right">
                      <span className="text-accent font-bold">{t.stops} Stopps</span>
                      {t.distKm != null && <span className="text-matcha-300">{t.distKm.toFixed(1)} km</span>}
                      {t.durationMin != null && <span className="text-matcha-400">{t.durationMin}m</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={onConfirm}
            className="w-full h-13 rounded-2xl bg-matcha-700 border border-white/10 text-matcha-100 font-display font-bold text-base inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Power size={18} />
            Schicht abschließen
          </button>
          <button
            onClick={onCancel}
            className="w-full h-12 rounded-2xl bg-accent text-matcha-900 font-display font-bold text-base inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            Weiter arbeiten
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- LetzteStoppsLog ---------- */

type StopLogEntry = {
  id: string;
  geliefert_am: string;
  kunde_name: string;
  kunde_adresse: string | null;
  bestellnummer: string;
  gesamtbetrag: number;
};

function LetzteStoppsLog({ driverId }: { driverId: string }) {
  const supabase = createClient();
  const [stops, setStops] = useState<StopLogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    (async () => {
      const { data: batches } = await supabase
        .from('mise_delivery_batches')
        .select('id')
        .eq('driver_id', driverId)
        .gte('created_at', today.toISOString());
      if (!batches?.length) return;
      const { data: rows } = await supabase
        .from('mise_delivery_batch_stops')
        .select('id, completed_at, order:customer_orders(bestellnummer, kunde_name, kunde_adresse, gesamtbetrag)')
        .in('batch_id', (batches as { id: string }[]).map((b) => b.id))
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(20);
      if (!rows) return;
      setStops((rows as any[]).map((r) => ({
        id: r.id,
        geliefert_am: r.completed_at,
        kunde_name: r.order?.kunde_name ?? '—',
        kunde_adresse: r.order?.kunde_adresse ?? null,
        bestellnummer: r.order?.bestellnummer ?? '—',
        gesamtbetrag: r.order?.gesamtbetrag ?? 0,
      })));
    })().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (stops.length === 0) return null;

  const visible = expanded ? stops : stops.slice(0, 4);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <button
        className="flex w-full items-center gap-2 mb-3"
        onClick={() => setExpanded((e) => !e)}
      >
        <ListOrdered className="h-4 w-4 text-matcha-300 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60 flex-1 text-left">
          Heutige Lieferungen ({stops.length})
        </span>
        {stops.length > 4 && (
          <ChevronDown className={cn('h-4 w-4 text-matcha-400 transition-transform', expanded && 'rotate-180')} />
        )}
      </button>
      <div className="space-y-1.5">
        {visible.map((s, i) => {
          const time = new Date(s.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={s.id} className="flex items-center gap-2.5 py-1.5">
              {/* Timeline dot */}
              <div className="relative flex shrink-0 flex-col items-center">
                <div className={cn(
                  'h-5 w-5 rounded-full border-2 flex items-center justify-center text-[9px] font-black',
                  i === 0 ? 'border-accent bg-accent/20 text-accent' : 'border-white/20 bg-white/5 text-matcha-400',
                )}>
                  {stops.length - i}
                </div>
                {i < visible.length - 1 && (
                  <div className="absolute top-5 h-full w-px bg-white/10" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-matcha-200 truncate">
                    {s.kunde_name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-matcha-400 truncate flex-1">
                    {s.kunde_adresse?.split(',')[0] ?? ''}
                  </span>
                </div>
                <div className="text-[9px] text-matcha-500">
                  #{s.bestellnummer.replace(/^[A-Z]+-/, '')}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] font-bold text-accent">{euro(s.gesamtbetrag)}</div>
                <div className="text-[9px] text-matcha-500 tabular-nums">{time}</div>
              </div>
            </div>
          );
        })}
      </div>
      {stops.length > 4 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 w-full text-center text-[10px] text-matcha-400 hover:text-matcha-200 transition"
        >
          + {stops.length - 4} weitere anzeigen
        </button>
      )}
    </section>
  );
}

/* ---------- MeineAbrechnungen ---------- */

interface DriverPeriod {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  deliveriesCount: number;
  totalKm: number;
  totalPayout: number;
  avgRating: number | null;
  onTimeRatePct: number | null;
  status: 'draft' | 'approved' | 'paid';
  paidAt: string | null;
  pdfUrl: string;
}

function MeineAbrechnungen() {
  const [periods, setPeriods] = useState<DriverPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/delivery/driver/periods')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.periods) setPeriods(d.periods); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && periods.length === 0) return null;

  const PERIOD_LABELS: Record<string, string> = {
    daily: 'Tagesabr.', weekly: 'Wochenabr.', monthly: 'Monatsabr.', custom: 'Abrechnung',
  };
  const STATUS_COLORS: Record<string, string> = {
    draft: 'text-white/40',
    approved: 'text-blue-400',
    paid: 'text-accent',
  };
  const STATUS_LABELS: Record<string, string> = {
    draft: 'Entwurf', approved: 'Freigegeben', paid: 'Ausgezahlt',
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/3 p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2"
      >
        <Receipt className="h-4 w-4 text-matcha-300" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60">
          Meine Abrechnungen
        </span>
        {periods.length > 0 && (
          <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-matcha-300">
            {periods.length}
          </span>
        )}
        <ChevronDown className={cn('ml-auto h-4 w-4 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            </div>
          ) : (
            periods.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-matcha-200">
                      {PERIOD_LABELS[p.periodType] ?? 'Abrechnung'}
                    </span>
                    <span className={cn('text-[10px] font-medium', STATUS_COLORS[p.status])}>
                      · {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  <div className="text-[10px] text-matcha-500 tabular-nums mt-0.5">
                    {new Date(p.periodStart).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    {' – '}
                    {new Date(p.periodEnd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    {' · '}{p.deliveriesCount} Lief.
                    {p.avgRating != null && ` · ★${p.avgRating.toFixed(1)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-black text-accent tabular-nums">
                    {p.totalPayout.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                  <a
                    href={p.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-medium text-matcha-300 hover:bg-white/20 transition"
                    title="Lohnzettel als PDF"
                  >
                    <FileText className="h-3 w-3" />
                    PDF
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- MeineSchichten ---------- */

interface ShiftEntry {
  id: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  status: string;
  durationMinutes: number | null;
  activeMinutes: number | null;
  breakMinutes: number;
  breakCount: number;
  deliveries: number;
  distanceKm: number;
  earningsEur: number;
}

const SHIFT_STATUS_LABEL: Record<string, string> = {
  completed: 'Abgeschlossen',
  active:    'Läuft',
  missed:    'Verpasst',
};
const SHIFT_STATUS_COLOR: Record<string, string> = {
  completed: 'text-accent',
  active:    'text-blue-400',
  missed:    'text-red-400',
};

function MeineSchichten() {
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/delivery/driver/shifts?limit=15')
      .then((r) => r.ok ? r.json() : null)
      .then((d: { shifts?: ShiftEntry[] } | null) => { if (d?.shifts) setShifts(d.shifts); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && shifts.length === 0) return null;

  function fmtTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }
  function fmtMin(min: number | null): string {
    if (min === null || min < 0) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/3 p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2"
      >
        <History className="h-4 w-4 text-matcha-300" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60">
          Schicht-Verlauf
        </span>
        {shifts.length > 0 && (
          <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-matcha-300">
            {shifts.length}
          </span>
        )}
        <ChevronDown className={cn('ml-auto h-4 w-4 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            </div>
          ) : (
            shifts.map((s) => {
              const isExpanded = expandedId === s.id;
              const basePay = s.deliveries * 1.50;
              const distPay = s.distanceKm * 0.20;
              const calcTotal = basePay + distPay;
              const activeH = (s.activeMinutes ?? s.durationMinutes ?? 0) / 60;
              const eurPerH = activeH > 0 ? s.earningsEur / activeH : null;
              const stopsPerH = activeH > 0 ? s.deliveries / activeH : null;
              const completedStatus = s.status === 'completed';

              return (
                <div key={s.id} className="rounded-xl bg-white/5 overflow-hidden">
                  {/* Klickbarer Schicht-Header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="w-full p-3 space-y-2 text-left"
                  >
                    {/* Header: Datum + Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
                        <span className="text-[11px] font-bold text-matcha-200">
                          {fmtDate(s.plannedStart)}
                        </span>
                        <span className="text-[10px] text-matcha-500 tabular-nums">
                          {fmtTime(s.actualStart)} – {fmtTime(s.actualEnd)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-[10px] font-semibold', SHIFT_STATUS_COLOR[s.status] ?? 'text-white/40')}>
                          {SHIFT_STATUS_LABEL[s.status] ?? s.status}
                        </span>
                        <ChevronDown className={cn('h-3 w-3 text-white/30 transition-transform', isExpanded && 'rotate-180')} />
                      </div>
                    </div>

                    {/* Stats-Zeile */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="flex flex-col items-center rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="text-sm font-black text-accent tabular-nums">{s.deliveries}</span>
                        <span className="text-[9px] text-matcha-500 leading-tight mt-0.5">Lief.</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="text-sm font-black text-matcha-200 tabular-nums">
                          {s.activeMinutes !== null ? fmtMin(s.activeMinutes) : fmtMin(s.durationMinutes)}
                        </span>
                        <span className="text-[9px] text-matcha-500 leading-tight mt-0.5">Aktiv</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="text-sm font-black text-matcha-200 tabular-nums">
                          {s.distanceKm > 0 ? `${s.distanceKm.toFixed(1)} km` : '—'}
                        </span>
                        <span className="text-[9px] text-matcha-500 leading-tight mt-0.5">Strecke</span>
                      </div>
                      <div className="flex flex-col items-center rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="text-sm font-black text-accent tabular-nums">
                          {s.earningsEur > 0
                            ? s.earningsEur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
                            : '—'}
                        </span>
                        <span className="text-[9px] text-matcha-500 leading-tight mt-0.5">Verdienst</span>
                      </div>
                    </div>

                    {/* Pausen-Info (nur wenn vorhanden) */}
                    {s.breakCount > 0 && (
                      <div className="flex items-center gap-1.5 text-[10px] text-matcha-500">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{s.breakCount} Pause{s.breakCount !== 1 ? 'n' : ''} · {fmtMin(s.breakMinutes)}</span>
                      </div>
                    )}
                  </button>

                  {/* Aufgeklappte Verdienst-Aufschlüsselung */}
                  {isExpanded && completedStatus && (
                    <div className="border-t border-white/10 px-3 pb-3 pt-2.5 space-y-2.5">
                      <div className="text-[9px] font-black uppercase tracking-widest text-matcha-400">
                        Verdienst-Aufschlüsselung
                      </div>

                      {/* Berechnungszeilen */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-matcha-400">
                            Basis ({s.deliveries} × €1,50)
                          </span>
                          <span className="font-bold text-matcha-200 tabular-nums">
                            {basePay.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {s.distanceKm > 0 && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-matcha-400">
                              Strecke ({s.distanceKm.toFixed(1)} km × €0,20)
                            </span>
                            <span className="font-bold text-matcha-200 tabular-nums">
                              {distPay.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {s.earningsEur > 0 && Math.abs(s.earningsEur - calcTotal) > 0.01 && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-matcha-400">Bonus / Sonstiges</span>
                            <span className="font-bold text-matcha-200 tabular-nums">
                              {(s.earningsEur - calcTotal).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px] border-t border-white/10 pt-1.5">
                          <span className="font-bold text-matcha-200">Gesamt erfasst</span>
                          <span className="font-black text-accent tabular-nums">
                            {s.earningsEur > 0
                              ? s.earningsEur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
                              : calcTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Effizienz-Kennzahlen */}
                      {(eurPerH !== null || stopsPerH !== null) && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {eurPerH !== null && (
                            <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                              <div className="text-sm font-black text-accent tabular-nums">
                                {eurPerH.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-[9px] text-matcha-500 mt-0.5">€ / Stunde</div>
                            </div>
                          )}
                          {stopsPerH !== null && (
                            <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                              <div className="text-sm font-black text-matcha-200 tabular-nums">
                                {stopsPerH.toFixed(1)}
                              </div>
                              <div className="text-[9px] text-matcha-500 mt-0.5">Stopps / Std.</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

function TourBriefingCard({ batch }: { batch: { stops: { order: { gesamtbetrag: number; zahlungsart?: string | null; bezahlt?: boolean | null; kunde_adresse?: string | null } }[]; total_distance_km?: number | null; total_eta_min?: number | null } }) {
  const cashStops = batch.stops.filter(s => !s.order.bezahlt || s.order.zahlungsart === 'bar');
  const totalCash = cashStops.reduce((s, st) => s + st.order.gesamtbetrag, 0);
  const estEarnings = batch.stops.length * 1.50 + ((batch.total_distance_km ?? 0) * 0.20);
  const etaMin = batch.total_eta_min ?? null;

  if (batch.stops.length === 0) return null;

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-white/8 border border-white/15 p-4 space-y-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-matcha-300">Tour-Übersicht</div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-xl font-black text-white tabular-nums">{batch.stops.length}</div>
          <div className="text-[9px] text-matcha-400 font-bold uppercase">Stopps</div>
        </div>
        {etaMin && (
          <div className="text-center">
            <div className="text-xl font-black text-accent tabular-nums">{etaMin}</div>
            <div className="text-[9px] text-matcha-400 font-bold uppercase">Min ETA</div>
          </div>
        )}
        {batch.total_distance_km != null && (
          <div className="text-center">
            <div className="text-xl font-black text-white tabular-nums">{batch.total_distance_km.toFixed(1)}</div>
            <div className="text-[9px] text-matcha-400 font-bold uppercase">km</div>
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {cashStops.length > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-[11px] font-bold text-amber-200">
            💵 {cashStops.length}× Bar · {totalCash.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
          </div>
        )}
        {estEarnings > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-matcha-700/60 border border-matcha-600/40 px-2.5 py-1 text-[11px] font-bold text-matcha-100">
            ~{estEarnings.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })} Verdienst
          </div>
        )}
      </div>
    </div>
  );
}

/* ----- TourLiveProgressHeader ----- */
// Kopfleiste mit Live-Sekunden-Countdown — ersetzt das IIFE-Pattern und re-rendert sekündlich.
function TourLiveProgressHeader({ batch }: {
  batch: {
    stops: { geliefert_am?: string | null }[];
    total_eta_min?: number | null;
    started_at?: string | null;
  };
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const total = batch.stops.length;
  const done = batch.stops.filter((s) => s.geliefert_am).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const etaMin = batch.total_eta_min;
  const startedAt = batch.started_at;

  // Berechne verbleibende Sekunden (live)
  const remainSec = (() => {
    if (!startedAt || etaMin == null) return null;
    const endMs = new Date(startedAt).getTime() + etaMin * 60_000;
    return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
  })();

  const overdue = remainSec === 0 && done < total;
  const totalOverdueSec = (() => {
    if (!startedAt || etaMin == null) return 0;
    const endMs = new Date(startedAt).getTime() + etaMin * 60_000;
    return Math.max(0, Math.floor((Date.now() - endMs) / 1000));
  })();

  const fmtSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const returnTime = (() => {
    if (remainSec == null || remainSec === 0) return null;
    return new Date(Date.now() + remainSec * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  })();

  return (
    <div className={cn(
      'rounded-2xl border px-4 py-3 mb-3',
      overdue ? 'bg-red-900/30 border-red-500/40' :
      pct === 100 ? 'bg-accent/15 border-accent/30' :
      'bg-matcha-800/60 border-white/10',
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Route className="h-3.5 w-3.5 text-matcha-300" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300">
            Tour-Fortschritt
          </span>
        </div>
        <span className="font-display font-bold text-accent tabular-nums">
          {done}/{total} Stopps
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct === 100 ? 'bg-accent' :
            overdue ? 'bg-red-500 animate-pulse' :
            pct >= 60 ? 'bg-matcha-400' : 'bg-orange-400',
          )}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] tabular-nums">
        {pct === 100 ? (
          <span className="text-accent font-bold">Tour abgeschlossen! ✓</span>
        ) : overdue ? (
          <span className="text-red-400 font-bold animate-pulse">
            +{fmtSec(totalOverdueSec)} überfällig
          </span>
        ) : remainSec != null ? (
          <span className={cn('font-bold tabular-nums', remainSec < 300 ? 'text-amber-300' : 'text-matcha-300')}>
            Noch {fmtSec(remainSec)} bis Tour-Ende
          </span>
        ) : (
          <span className="text-matcha-400">{done < total ? 'Tour läuft…' : ''}</span>
        )}
        {returnTime && done < total && (
          <span className="text-matcha-300">
            Rückkehr ~{returnTime} Uhr
          </span>
        )}
      </div>
    </div>
  );
}

// Phase 84 — Pausen-Timer mit Backend-Integration (Phase 58 shift_breaks)
function FahrerPauseWidget() {
  const [activeShiftId, setActiveShiftId] = React.useState<string | null>(null);
  const [pauseStart, setPauseStart] = React.useState<number | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [todayPausenMin, setTodayPausenMin] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  // Aktive Schicht + laufende Pause beim Mount laden
  useEffect(() => {
    fetch('/api/delivery/driver/shifts?limit=5')
      .then(r => r.ok ? r.json() : null)
      .then((d: { shifts?: { id: string; status: string; breakMinutes?: number }[] } | null) => {
        const active = d?.shifts?.find(s => s.status === 'active');
        if (!active) return;
        setActiveShiftId(active.id);
        setTodayPausenMin(active.breakMinutes ?? 0);
        fetch(`/api/delivery/driver/shift/break?shift_id=${active.id}`)
          .then(r => r.ok ? r.json() : null)
          .then((b: { activeBreak?: { id: string; startedAt: string } | null } | null) => {
            if (b?.activeBreak) {
              setPauseStart(new Date(b.activeBreak.startedAt).getTime());
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pauseStart === null) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - pauseStart) / 1000)), 1000);
    return () => clearInterval(t);
  }, [pauseStart]);

  async function startPause() {
    if (saving) return;
    setSaving(true);
    try {
      if (activeShiftId) {
        await fetch('/api/delivery/driver/shift/break', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'start', shift_id: activeShiftId, break_type: 'pause' }),
        }).catch(() => {});
      }
      setPauseStart(Date.now());
      setElapsed(0);
    } finally {
      setSaving(false);
    }
  }

  async function endPause() {
    if (saving) return;
    setSaving(true);
    try {
      if (activeShiftId) {
        await fetch('/api/delivery/driver/shift/break', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'end', shift_id: activeShiftId }),
        }).catch(() => {});
        fetch(`/api/delivery/driver/shift/break?shift_id=${activeShiftId}`)
          .then(r => r.ok ? r.json() : null)
          .then((b: { summary?: { totalBreakMinutes?: number } } | null) => {
            if (b?.summary?.totalBreakMinutes != null) setTodayPausenMin(b.summary.totalBreakMinutes);
          })
          .catch(() => {});
      } else if (pauseStart !== null) {
        const min = Math.round((Date.now() - pauseStart) / 60_000);
        setTodayPausenMin(p => p + Math.max(1, min));
      }
      setPauseStart(null);
      setElapsed(0);
    } finally {
      setSaving(false);
    }
  }

  const isPausing = pauseStart !== null;
  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 mt-3 transition-colors',
      isPausing ? 'bg-amber-500/20 border-amber-400/40' : 'bg-white/5 border-white/10',
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">
            {isPausing ? '⏸ Pause läuft' : '☕ Pause'}
          </div>
          {isPausing ? (
            <div className="font-display font-black text-amber-200 text-xl tabular-nums leading-none mt-0.5">
              {mm}:{String(ss).padStart(2, '0')}
            </div>
          ) : todayPausenMin > 0 ? (
            <div className="text-[11px] text-matcha-400 mt-0.5">
              Heute: {todayPausenMin} Min Pause
            </div>
          ) : (
            <div className="text-[11px] text-matcha-400 mt-0.5">Noch keine Pause heute</div>
          )}
        </div>
        <button
          onClick={isPausing ? endPause : startPause}
          disabled={saving}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-bold shrink-0 transition active:scale-95 disabled:opacity-60',
            isPausing
              ? 'bg-amber-400 text-matcha-900 hover:bg-amber-300'
              : 'bg-white/10 text-matcha-200 hover:bg-white/20',
          )}
        >
          {saving ? '…' : isPausing ? 'Beenden' : 'Pause nehmen'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 94: FahrerSchichtCountdown — Schicht-Dauer-Tracker
// Zeigt wie lange der Fahrer schon online ist und wie viel von einer
// 8-Stunden-Schicht noch übrig bleibt, mit farbcodiertem Fortschrittsring.
// ---------------------------------------------------------------------------
function FahrerSchichtCountdown({ onlineSeit }: { onlineSeit: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const SHIFT_HOURS = 8;
  const elapsedMs = Date.now() - new Date(onlineSeit).getTime();
  const elapsedMin = Math.max(0, Math.floor(elapsedMs / 60_000));
  const elapsedHours = Math.floor(elapsedMin / 60);
  const elapsedRestMin = elapsedMin % 60;

  const shiftMaxMin = SHIFT_HOURS * 60;
  const pct = Math.min(100, Math.round((elapsedMin / shiftMaxMin) * 100));
  const remainingMin = Math.max(0, shiftMaxMin - elapsedMin);
  const remainingH = Math.floor(remainingMin / 60);
  const remainingRestMin = remainingMin % 60;

  const isDone = elapsedMin >= shiftMaxMin;
  const isLate = elapsedMin >= 7 * 60;
  const isWarn = elapsedMin >= 5 * 60;

  const ringColor = isDone ? 'text-red-400' : isLate ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-matcha-400';
  const barColor  = isDone ? 'bg-red-500' : isLate ? 'bg-red-500' : isWarn ? 'bg-amber-400' : 'bg-matcha-500';
  const label     = isDone ? '⚠ Schicht überschritten' : isLate ? '⚠ Fast Schichtende' : isWarn ? '→ Schicht läuft gut' : '⚡ Frisch gestartet';

  // SVG Kreis-Segment (klein, 36px)
  const R = 14;
  const CIRCUM = 2 * Math.PI * R;
  const dash = (pct / 100) * CIRCUM;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">Schicht-Dauer</span>
        <span className={cn('text-[10px] font-bold', ringColor)}>{label}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* SVG Fortschrittsring */}
        <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0 -rotate-90">
          <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r={R} fill="none"
            stroke={isDone || isLate ? '#ef4444' : isWarn ? '#f59e0b' : '#6aab8a'}
            strokeWidth="3"
            strokeDasharray={`${dash} ${CIRCUM}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>

        <div className="flex-1 min-w-0">
          {/* Abgelaufene Zeit */}
          <div className="flex items-baseline gap-1">
            <span className={cn('font-mono text-xl font-black tabular-nums leading-none', ringColor)}>
              {elapsedHours}:{String(elapsedRestMin).padStart(2, '0')}
            </span>
            <span className="text-[10px] text-matcha-400">h online</span>
          </div>

          {/* Verbleibende Zeit */}
          {!isDone ? (
            <div className="text-[11px] text-matcha-400 mt-0.5">
              Noch {remainingH}:{String(remainingRestMin).padStart(2, '0')} h bis 8h
            </div>
          ) : (
            <div className="text-[11px] text-red-400 mt-0.5 font-bold">
              {elapsedHours - SHIFT_HOURS}h {String(elapsedRestMin).padStart(2, '0')}m überschritten
            </div>
          )}
        </div>

        {/* Prozent-Badge */}
        <div className={cn(
          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums',
          isDone || isLate ? 'bg-red-500/20 text-red-300' : isWarn ? 'bg-amber-500/20 text-amber-300' : 'bg-matcha-500/20 text-matcha-300',
        )}>
          {pct}%
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[9px] text-matcha-500">
        <span>Start: {new Date(onlineSeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
        <span>Ziel: {new Date(new Date(onlineSeit).getTime() + SHIFT_HOURS * 3_600_000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
      </div>
    </div>
  );
}

/* ---------- PositioningSuggestionBanner — Standort-Empfehlung für Idle-Fahrer ---------- */

type PositioningSuggestionData = {
  id: string;
  target_label: string;
  reason: string;
  demand_score: number;
  expires_at: string;
  target_lat: number | null;
  target_lng: number | null;
};

function PositioningSuggestionBanner() {
  const [suggestion, setSuggestion] = useState<PositioningSuggestionData | null>(null);
  const [responded, setResponded] = useState(false);
  const [minsLeft, setMinsLeft] = useState(0);

  useEffect(() => {
    fetch('/api/delivery/driver/positioning')
      .then((r) => r.json())
      .then((d) => {
        if (d?.suggestion) {
          setSuggestion(d.suggestion);
          setMinsLeft(Math.max(0, Math.round((new Date(d.suggestion.expires_at).getTime() - Date.now()) / 60_000)));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!suggestion || responded) return;
    const timer = setInterval(() => {
      setMinsLeft((m) => {
        if (m <= 0) { clearInterval(timer); setSuggestion(null); return 0; }
        return m - 1;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, [suggestion, responded]);

  const respond = async (response: 'accepted' | 'rejected') => {
    if (!suggestion) return;
    setResponded(true);
    await fetch('/api/delivery/driver/positioning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestion_id: suggestion.id, response }),
    }).catch(() => {});
  };

  const openNavigation = () => {
    if (!suggestion?.target_lat || !suggestion?.target_lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${suggestion.target_lat},${suggestion.target_lng}`;
    window.open(url, '_blank');
  };

  if (!suggestion || responded) return null;

  const isHighDemand = suggestion.demand_score >= 70;

  return (
    <section className="bg-gradient-to-br from-blue-900/80 to-blue-800/80 border border-blue-700/50 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm',
            isHighDemand ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300',
          )}>
            📍
          </div>
          <div>
            <div className="text-xs font-semibold text-blue-200 uppercase tracking-wide">
              Positions-Empfehlung
            </div>
            <div className="text-sm font-bold text-white">{suggestion.target_label}</div>
          </div>
        </div>
        <div className="text-xs text-blue-400 shrink-0">
          {minsLeft} Min
        </div>
      </div>

      <p className="text-xs text-blue-300 leading-relaxed">{suggestion.reason}</p>

      {isHighDemand && (
        <div className="flex items-center gap-1.5 text-xs text-orange-300 font-medium">
          <span>🔥</span> Hohe Nachfrage erwartet
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {suggestion.target_lat && suggestion.target_lng && (
          <button
            onClick={() => { respond('accepted'); openNavigation(); }}
            className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <span>🗺️</span> Navigieren
          </button>
        )}
        {!suggestion.target_lat && (
          <button
            onClick={() => respond('accepted')}
            className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            ✓ Verstanden
          </button>
        )}
        <button
          onClick={() => respond('rejected')}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-blue-200 text-sm rounded-xl transition-colors"
        >
          ✕
        </button>
      </div>
    </section>
  );
}
