'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, euro } from '@/lib/utils';
import {
  Bike,
  ChefHat,
  Clock,
  ChevronDown,
  ChevronUp,
  History,
  MapPin,
  Package,
  Radio,
  RefreshCw,
  Target,
  TrendingUp,
  Truck,
  Route as RouteIcon,
  User,
  Banknote,
  CreditCard,
  Check,
  Wifi,
  WifiOff,
  Zap,
  AlertTriangle,
  Gift,
  Loader2,
  Phone,
  MessageSquare,
  Send,
  Megaphone,
  X,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trash2,
  GitCommit,
  Trophy,
  Star,
  BarChart2,
  Calendar,
  Navigation2,
  Gauge,
  Sparkles,
  Crosshair,
} from 'lucide-react';

const DispatchDriverMap = dynamic(
  () => import('./driver-map').then((m) => m.DispatchDriverMap),
  { ssr: false },
);
import { TourSequenzPanel } from './tour-sequenz';
import { ScoreRadarChart } from './score-radar';
import { DispatchQueuePanel } from './dispatch-queue-panel';
import { ZoneCoverageCard } from './zone-coverage-card';
import { TourRouteOverview } from './tour-route-overview';
import { ZoneWaitHeatmap } from './zone-wait-heatmap';
import { AuslastungsHeatmap } from './auslastungs-heatmap';
import { LiveTourTracker } from './live-tour-tracker';
import { DriverReturnForecast } from './driver-return-forecast';
import { EtaAccuracyLive } from './eta-accuracy-live';
import { DispatchTourHealthStrip } from './tour-health-strip';
import { TourEtaStrip } from './tour-eta-strip';
import { OrderScoreGrid } from './order-score-grid';
import { SmartAssignmentPanel } from './smart-assignment';
import { ZoneStatsDashboard } from './zone-stats-dashboard';
import { DispatchScoreTrendStrip } from './score-trend-strip';
import { DriverLeaderboardStrip } from './driver-leaderboard-strip';
import { DriverReliabilityPanel } from './driver-reliability-panel';
import { TourBundleBoard } from './tour-bundle-board';
import { DispatchNächsteZuweisung } from './naechste-zuweisung';
import { FahrerZeitplanPanel } from './fahrer-zeitplan';
import { SlaLivePanel } from './sla-live-panel';
import { DispatchSchichtUebergabePanel } from './schicht-uebergabe';
import { DispatchSchichtRing } from './schicht-ring';
import { DispatchDemandFunnel } from './demand-funnel';
import { DispatchTourKpiRing } from './tour-kpi-ring';
import { TourZeitplanGrid } from './tour-zeitplan';
import { DriverPositioningPanel } from './driver-positioning-panel';
import { type HotspotMarker } from './driver-map';
import { GeoClusterDispatchTip } from './geo-cluster-dispatch-tip';

type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_update: string | null;
  online_seit: string | null;
  employee: { id: string; vorname: string; nachname: string; avatar_url: string | null; telefon: string | null } | null;
};


type ReadyOrder = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  gesamtbetrag: number;
  zahlungsart: string;
  fertig_am: string | null;
  external_source: string | null;
  location_id: string | null;
  dispatch_score: number | null;
  delivery_zone: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  kunde_notiz: string | null;
  kunde_lieferhinweis: string | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null; eta_earliest: string | null; eta_latest: string | null } | null;
  }[];
};

type Location = { id: string; name: string; lat?: number | null; lng?: number | null };

type ShiftClaimItem = {
  id: string;
  driverName: string | null;
  driverVehicle: string | null;
  plannedStart: string;
  plannedEnd: string;
  status: string;
  notes: string | null;
};

export function DispatchBoard({
  initialOrders,
  initialDrivers,
  initialBatches,
  locations,
}: {
  initialOrders: ReadyOrder[];
  initialDrivers: Driver[];
  initialBatches: Batch[];
  locations: Location[];
}) {
  const supabase = createClient();
  const [orders, setOrders] = useState(initialOrders);
  const [drivers, setDrivers] = useState(initialDrivers);
  const [batches, setBatches] = useState(initialBatches);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [orderSort, setOrderSort] = useState<'wait' | 'zone' | 'score'>('wait');
  const [pending, startTransition] = useTransition();
  const [dispatchPending, setDispatchPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [etaRefreshing, setEtaRefreshing] = useState(false);
  const [etaRefreshResult, setEtaRefreshResult] = useState<{ orders_updated: number; orders_skipped: number; batches_processed: number; errors: number; duration_ms: number } | null>(null);
  const [newOrderFlash, setNewOrderFlash] = useState<{ count: number } | null>(null);
  const prevReadyCountRef = useRef(initialOrders.filter((o) => o.status === 'fertig').length);
  const [kitchenLoad, setKitchenLoad] = useState<{ eta_min: number; load: string; active_orders: number; drivers_online: number; queue_signal: string; eta_extension_min: number } | null>(null);
  const [scheduledSummary, setScheduledSummary] = useState<{ total: number; pending: number; released: number; next_due_in_min: number | null } | null>(null);
  const [scheduledOrders, setScheduledOrders] = useState<{ id: string; bestellnummer: string; kunde_name: string | null; scheduled_at: string; schedule_status: string; mins_until_kitchen_start: number | null }[]>([]);
  const [shiftClaims, setShiftClaims] = useState<ShiftClaimItem[]>([]);
  const [staleOrders, setStaleOrders] = useState<{ id: string; bestellnummer: string; age_min: number; dispatch_attempts: number; escalation_status: string | null; delivery_zone: string | null }[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<{
    id: string; orderId: string; reason: string; attemptNumber: number;
    notes: string | null; nextAttemptAt: string | null; createdAt: string;
    bestellnummer: string | null; kundeName: string | null; kundeAdresse: string | null; driverName: string | null;
  }[]>([]);
  const [deliveryHealth, setDeliveryHealth] = useState<{
    slaOnTimePct: number | null;
    etaAccuracyPct: number | null;
    avgDeliveryMin: number | null;
    totalDeliveriesToday: number | null;
    driverUtilization: number | null;
  } | null>(null);
  const [overviewStats, setOverviewStats] = useState<{
    today_stats: { total_orders: number; dispatched: number; delivered: number; pending: number; drivers_online: number };
    zone_counts: Record<string, number>;
  } | null>(null);
  const [recoveryEvents, setRecoveryEvents] = useState<{
    id: string; batch_id: string; triggered_at: string; recovery_type: string; success: boolean; error_message: string | null;
  }[]>([]);
  const [recoveryPending, setRecoveryPending] = useState<string | null>(null);

  // KI-Dispatch-Assistent
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Küchen-Pipeline: Bestellungen die noch kochen aber bald fertig werden
  const [pipelineOrders, setPipelineOrders] = useState<{
    id: string; bestellnummer: string; status: string; delivery_zone: string | null;
    geschaetzte_zubereitung_min: number | null; bestellt_am: string | null;
    ready_target: string | null; timing_status: string | null;
  }[]>([]);

  // Fahrer-Broadcasts
  const [broadcasts, setBroadcasts] = useState<{
    id: string; message: string; priority: string; sentByName: string | null;
    createdAt: string; expiresAt: string; isActive: boolean; readCount: number;
  }[]>([]);
  const [broadcastSending, setBroadcastSending] = useState(false);

  // Score breakdown popover
  const [scorePopover, setScorePopover] = useState<{
    orderId: string;
    bestellnummer: string;
    score: {
      total: number; f_distance: number; f_load: number; f_vehicle: number;
      f_experience: number; f_zone: number; f_prep_time: number; f_time_of_day: number;
      f_priority: number; f_bundle_fit: number; f_history: number;
      decision: string | null; reason: string | null; driver_name: string | null; scored_at: string;
    } | null;
    loading: boolean;
  } | null>(null);

  // Besetzungs-Lücken für die nächsten 12 Stunden
  const [coverageGaps, setCoverageGaps] = useState<{ hour: string; gap: number }[]>([]);

  // Phase 162: Schicht-Übergabe Panel
  const [showSchichtUebergabe, setShowSchichtUebergabe] = useState(false);

  // BatchDetailModal state
  const [batchDetailId, setBatchDetailId] = useState<string | null>(null);

  // ETA overdue notifications — tracks which batch IDs have already fired
  const notifiedOverdueRef = useRef<Set<string>>(new Set());
  const [overdueAlerts, setOverdueAlerts] = useState<{ id: string; batchId: string; driverName: string; overdueMin: number; driverPhone: string | null }[]>([]);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${locationId}`);
        if (!res.ok) return;
        const d = await res.json();
        if (d?.eta_min != null) setKitchenLoad({ eta_min: d.eta_min, load: d.load ?? 'quiet', active_orders: d.active_orders ?? 0, drivers_online: d.drivers_online ?? 0, queue_signal: d.queue_signal ?? 'normal', eta_extension_min: d.eta_extension_min ?? 0 });
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, [locations]);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    fetch(`/api/delivery/admin/coverage?location_id=${locationId}&hours=12&gaps_only=true`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d?.coverage)) {
          const gaps = (d.coverage as { slot_start?: string; hour_label?: string; gap: number }[])
            .filter(c => c.gap < 0)
            .map(c => ({ hour: c.hour_label ?? c.slot_start ?? '', gap: c.gap }));
          setCoverageGaps(gaps);
        }
      })
      .catch(() => {});
  }, [locations]);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/scheduled?location_id=${locationId}&hours=4`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.summary) setScheduledSummary(d.summary);
          if (d?.orders) setScheduledOrders(d.orders);
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [locations]);

  useEffect(() => {
    const load = () => {
      fetch('/api/delivery/admin/shift-claims')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (Array.isArray(d?.claims)) setShiftClaims(d.claims); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/stale-orders?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (Array.isArray(d?.orders)) setStaleOrders(d.orders); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locations]);

  useEffect(() => {
    const load = () => {
      fetch('/api/delivery/admin/failed-attempts?action=list')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (Array.isArray(d?.attempts)) setFailedAttempts(d.attempts); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const load = async () => {
      try {
        const [slaRes, etaRes] = await Promise.all([
          fetch(`/api/delivery/admin/sla?location_id=${locationId}&days=1`).then(r => r.ok ? r.json() : null),
          fetch(`/api/delivery/admin/eta-accuracy?location_id=${locationId}`).then(r => r.ok ? r.json() : null),
        ]);
        const slaOnTimePct = slaRes?.summary?.onTimePct ?? null;
        const avgDeliveryMin = slaRes?.summary?.avgDeliveryMin ?? null;
        const totalDeliveriesToday = slaRes?.summary?.totalStops ?? null;
        const etaAccuracyPct = etaRes?.overall?.onTimeRate != null ? Math.round(etaRes.overall.onTimeRate * 100) : null;
        const driverUtilization = drivers.length > 0
          ? Math.round((drivers.filter((d) => d.ist_online).length / drivers.length) * 100)
          : null;
        setDeliveryHealth({ slaOnTimePct, etaAccuracyPct, avgDeliveryMin, totalDeliveriesToday, driverUtilization });
      } catch {}
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, drivers.length]);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/overview?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.today_stats) setOverviewStats({ today_stats: d.today_stats, zone_counts: d.zone_counts ?? {} }); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locations]);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/recovery?location_id=${locationId}&limit=10`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (Array.isArray(d?.events)) setRecoveryEvents(d.events); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [locations]);

  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/broadcasts?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (Array.isArray(d?.broadcasts)) setBroadcasts(d.broadcasts); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locations]);

  // Küchen-Pipeline laden: Bestellungen in Zubereitung (für Dispatch-Vorplanung)
  useEffect(() => {
    const locationId = locations[0]?.id;
    if (!locationId) return;
    const load = async () => {
      try {
        const { data: cooking } = await supabase
          .from('customer_orders')
          .select('id, bestellnummer, status, delivery_zone, geschaetzte_zubereitung_min, bestellt_am')
          .eq('typ', 'lieferung')
          .eq('location_id', locationId)
          .in('status', ['in_zubereitung', 'bestätigt'])
          .order('bestellt_am', { ascending: true });
        if (!cooking?.length) { setPipelineOrders([]); return; }
        const { data: timings } = await supabase
          .from('kitchen_timings')
          .select('order_id, ready_target, status')
          .in('order_id', (cooking as any[]).map((o) => o.id))
          .in('status', ['cooking', 'scheduled']);
        const tm = new Map(((timings ?? []) as any[]).map((t) => [t.order_id, t]));
        setPipelineOrders((cooking as any[]).map((o) => ({
          ...o,
          ready_target: tm.get(o.id)?.ready_target ?? null,
          timing_status: tm.get(o.id)?.status ?? null,
        })));
      } catch {}
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  async function triggerEtaRefresh() {
    setEtaRefreshing(true);
    try {
      const res = await fetch('/api/delivery/admin/eta-refresh', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setEtaRefreshResult({ orders_updated: data.orders_updated ?? 0, orders_skipped: data.orders_skipped ?? 0, batches_processed: data.batches_processed ?? 0, errors: data.errors ?? 0, duration_ms: data.duration_ms ?? 0 });
        setTimeout(() => setEtaRefreshResult(null), 5000);
      }
      await refresh();
    } finally {
      setEtaRefreshing(false);
    }
  }

  async function smartDispatch() {
    setDispatchPending(true);
    try {
      await fetch('/api/delivery/dispatch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      await refresh();
    } finally {
      setDispatchPending(false);
    }
  }

  async function triggerRecovery(batchId: string) {
    setRecoveryPending(batchId);
    try {
      await fetch('/api/delivery/admin/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId, reason: 'manual_admin' }),
      });
      await refresh();
      const locationId = locations[0]?.id;
      if (locationId) {
        const d = await fetch(`/api/delivery/admin/recovery?location_id=${locationId}&limit=10`)
          .then(r => r.ok ? r.json() : null);
        if (Array.isArray(d?.events)) setRecoveryEvents(d.events);
      }
    } catch {} finally {
      setRecoveryPending(null);
    }
  }

  // ETA-Überschreitungs-Alert: Wenn eine Tour >5 Min überfällig ist, In-App-Banner zeigen
  useEffect(() => {
    const ACTIVE = new Set(['pickup', 'unterwegs', 'pending_acceptance', 'assigned', 'at_restaurant', 'on_route']);
    const now = Date.now();
    for (const b of batches) {
      if (!ACTIVE.has(b.status)) continue;
      const etaMs = b.startzeit && b.total_eta_min != null
        ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
        : null;
      if (!etaMs) continue;
      const overdueMs = now - etaMs;
      if (overdueMs < 5 * 60_000) continue;
      if (notifiedOverdueRef.current.has(b.id)) continue;
      notifiedOverdueRef.current.add(b.id);
      const driverName = b.fahrer
        ? `${b.fahrer.vorname} ${b.fahrer.nachname}`
        : 'Unbekannter Fahrer';
      const driverObj = drivers.find((d) => d.employee_id === b.fahrer_id);
      const driverPhone = driverObj?.employee?.telefon ?? null;
      const overdueMin = Math.floor(overdueMs / 60_000);
      const alertId = `${b.id}-${Math.floor(overdueMs / 60_000)}`;
      setOverdueAlerts((prev) => [...prev.filter((a) => a.batchId !== b.id), { id: alertId, batchId: b.id, driverName, overdueMin, driverPhone }]);
    }
    // Clear notified set for completed batches
    for (const id of notifiedOverdueRef.current) {
      const b = batches.find((bt) => bt.id === id);
      if (!b || !ACTIVE.has(b.status)) notifiedOverdueRef.current.delete(id);
    }
  }, [batches]);

  useEffect(() => {
    const ch = supabase
      .channel('dispatch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_status' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batch_stops' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    const [{ data: o }, { data: d }, { data: legacy }, { data: smart }] = await Promise.all([
      supabase
        .from('customer_orders')
        .select('id, bestellnummer, status, typ, kunde_name, kunde_adresse, kunde_plz, kunde_lat, kunde_lng, gesamtbetrag, zahlungsart, fertig_am, external_source, location_id, dispatch_score, delivery_zone, eta_earliest, eta_latest, kunde_notiz, kunde_lieferhinweis')
        .eq('typ', 'lieferung')
        .in('status', ['fertig', 'unterwegs'])
        .order('fertig_am', { ascending: true }),
      supabase
        .from('driver_status')
        .select('*, employee:employees(id, vorname, nachname, avatar_url, telefon)')
        .order('last_update', { ascending: false }),
      supabase
        .from('delivery_batches')
        .select('id, fahrer_id, status, startzeit, total_distance_km, total_eta_min, zone, fahrer:employees(vorname, nachname), stops:delivery_batch_stops(id, order_id, reihenfolge, geliefert_am, order:customer_orders(bestellnummer, kunde_name, kunde_adresse, eta_earliest, eta_latest))')
        .in('status', ['pickup', 'unterwegs'])
        .order('created_at', { ascending: false }),
      supabase
        .from('mise_delivery_batches')
        .select('id, state, driver_id, started_at, total_distance_km, total_eta_min, zone, driver:mise_drivers(id, name), stops:mise_delivery_batch_stops(id, order_id, sequence, completed_at, type, order:customer_orders(bestellnummer, kunde_name, kunde_adresse, eta_earliest, eta_latest))')
        .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route'])
        .order('created_at', { ascending: false }),
    ]);
    const newOrders: ReadyOrder[] = (o as any) ?? [];
    const newReadyCount = newOrders.filter((x) => x.status === 'fertig').length;
    if (newReadyCount > prevReadyCountRef.current) {
      setNewOrderFlash({ count: newReadyCount - prevReadyCountRef.current });
      setTimeout(() => setNewOrderFlash(null), 6000);
    }
    prevReadyCountRef.current = newReadyCount;
    setOrders(newOrders);
    setDrivers((d as any) ?? []);
    const normalizedSmart = ((smart ?? []) as any[]).map((b: any) => ({
      id: b.id, status: b.state, fahrer_id: b.driver_id, startzeit: b.started_at ?? null,
      total_distance_km: b.total_distance_km ?? null, total_eta_min: b.total_eta_min ?? null, zone: b.zone ?? null,
      fahrer: b.driver ? { vorname: b.driver.name ?? 'Fahrer', nachname: '' } : null,
      _isMise: true,
      stops: ((b.stops ?? []) as any[]).filter((s: any) => s.type === 'dropoff').map((s: any) => ({
        id: s.id, order_id: s.order_id, reihenfolge: s.sequence, geliefert_am: s.completed_at ?? null, order: s.order ?? null,
      })),
    }));
    setBatches([...((legacy ?? []) as any[]), ...normalizedSmart]);
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (locationFilter !== 'all' && o.location_id !== locationFilter) return false;
      return true;
    });
  }, [orders, locationFilter]);

  const readyOrders = useMemo(() => {
    const base = filteredOrders.filter((o) => o.status === 'fertig');
    return [...base].sort((a, b) => {
      if (orderSort === 'zone') return (a.delivery_zone ?? 'Z').localeCompare(b.delivery_zone ?? 'Z');
      if (orderSort === 'score') return (b.dispatch_score ?? 0) - (a.dispatch_score ?? 0);
      // default: wait time (oldest first)
      const aWait = a.fertig_am ? Date.now() - new Date(a.fertig_am).getTime() : 0;
      const bWait = b.fertig_am ? Date.now() - new Date(b.fertig_am).getTime() : 0;
      return bWait - aWait;
    });
  }, [filteredOrders, orderSort]);
  const enRouteOrders = filteredOrders.filter((o) => o.status === 'unterwegs');

  const onlineDrivers = drivers.filter((d) => d.ist_online);
  const offlineDrivers = drivers.filter((d) => !d.ist_online);

  // Per-driver shift stats computed from current batches
  const driverShiftStats = useMemo(() => {
    const m = new Map<string, { stops: number; onTime: number; timed: number }>();
    for (const b of batches) {
      if (!b.fahrer_id) continue;
      if (!m.has(b.fahrer_id)) m.set(b.fahrer_id, { stops: 0, onTime: 0, timed: 0 });
      const entry = m.get(b.fahrer_id)!;
      for (const s of b.stops) {
        if (!s.geliefert_am) continue;
        entry.stops++;
        if (s.order?.eta_latest) {
          entry.timed++;
          if (new Date(s.geliefert_am).getTime() <= new Date(s.order.eta_latest).getTime()) {
            entry.onTime++;
          }
        }
      }
    }
    return m;
  }, [batches]);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openScorePopover(order: ReadyOrder) {
    if (order.dispatch_score == null) return;
    setScorePopover({ orderId: order.id, bestellnummer: order.bestellnummer, score: null, loading: true });
    try {
      const res = await fetch(`/api/delivery/orders/${order.id}/score`);
      const data = await res.json();
      setScorePopover((p) => p ? { ...p, score: data.score ?? null, loading: false } : null);
    } catch {
      setScorePopover((p) => p ? { ...p, loading: false } : null);
    }
  }

  async function cancelSelectedOrders() {
    if (selected.size === 0) return;
    const count = selected.size;
    if (!confirm(`${count} ${count === 1 ? 'Bestellung' : 'Bestellungen'} stornieren? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    setCancelPending(true);
    try {
      await Promise.all(Array.from(selected).map((orderId) =>
        fetch(`/api/delivery/orders/${orderId}/cancel`, { method: 'PATCH' }).catch(() => {}),
      ));
      setSelected(new Set());
    } finally {
      setCancelPending(false);
    }
  }

  async function assignToDriver(fahrerId: string) {
    if (selected.size === 0) return;
    const selectedOrders = readyOrders.filter((o) => selected.has(o.id));
    const locationId = selectedOrders[0]?.location_id ?? null;
    const orderIds = Array.from(selected);

    startTransition(async () => {
      // Bridge-Write: atomisch in Legacy + Mise-System schreiben (via DB-Funktion)
      const { data, error } = await supabase.rpc('assign_to_driver', {
        p_employee_id: fahrerId,
        p_order_ids:   orderIds,
        p_location_id: locationId,
      });

      if (error || !(data as { ok: boolean })?.ok) {
        // Fallback: Legacy-Only-Write wenn RPC nicht verfügbar
        const { data: batch, error: e1 } = await supabase
          .from('delivery_batches')
          .insert({
            location_id: locationId,
            fahrer_id: fahrerId,
            status: 'pickup',
            startzeit: new Date().toISOString(),
            erstellt_von: null,
            auto_erstellt: false,
          })
          .select()
          .single();
        if (e1 || !batch) return;

        const stops = orderIds.map((id, idx) => ({ batch_id: (batch as { id: string }).id, order_id: id, reihenfolge: idx + 1 }));
        await supabase.from('delivery_batch_stops').insert(stops);
        await supabase
          .from('customer_orders')
          .update({ fahrer_id: fahrerId, batch_id: (batch as { id: string }).id, status: 'unterwegs' })
          .in('id', orderIds);
        await supabase
          .from('driver_status')
          .update({ aktueller_batch_id: (batch as { id: string }).id })
          .eq('employee_id', fahrerId);
      }

      setSelected(new Set());
      await refresh();
    });
  }

  return (
    <>
    <DispatchBrowserNotifier batches={batches} orders={readyOrders} />
    <div className="space-y-6">
      {/* Neue Bestellung — kurzer Flash wenn neue Ready-Bestellung eintrifft */}
      {newOrderFlash && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-matcha-400 bg-matcha-50 px-4 py-3 shadow-md animate-in slide-in-from-top-2 duration-300">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-matcha-600 text-white">
            <Package className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display text-sm font-bold text-matcha-900">
              {newOrderFlash.count === 1 ? 'Neue Bestellung bereit!' : `${newOrderFlash.count} neue Bestellungen bereit!`}
            </div>
            <div className="text-xs text-matcha-600">Küche meldet Fertig — bitte Fahrer zuweisen</div>
          </div>
          <button onClick={() => setNewOrderFlash(null)} className="text-matcha-400 hover:text-matcha-700 text-lg leading-none">×</button>
        </div>
      )}
      {/* ETA-Überschreitungs-Alerts */}
      {overdueAlerts.length > 0 && (
        <div className="space-y-1.5">
          {overdueAlerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border-2 border-red-400 bg-red-50 px-4 py-2.5 shadow-md animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 animate-pulse" />
                <div className="flex-1">
                  <div className="font-display text-sm font-bold text-red-900">
                    Tour überfällig: {alert.driverName}
                  </div>
                  <div className="text-xs text-red-700">
                    ETA überschritten um {alert.overdueMin} Min
                  </div>
                </div>
                <button
                  onClick={() => setOverdueAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                  className="text-red-400 hover:text-red-700 text-lg leading-none shrink-0"
                >×</button>
              </div>
              {/* Schnellaktionen */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {alert.driverPhone && (
                  <a
                    href={`tel:${alert.driverPhone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 transition"
                  >
                    <Phone className="h-3 w-3" />
                    Fahrer anrufen
                  </a>
                )}
                <button
                  onClick={() => {
                    // Scroll TourVisualizationPanel into view
                    document.querySelector('[data-tour-panel]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setOverdueAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50 transition"
                >
                  <RouteIcon className="h-3 w-3" />
                  Tour anzeigen
                </button>
                <span className="ml-auto text-[10px] text-red-500 font-mono tabular-nums">
                  +{alert.overdueMin} Min
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Küchen-Auslastungs-Chip: live ETA + Surge-Indikator */}
      {kitchenLoad && (
        <div className={cn(
          'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm',
          kitchenLoad.load === 'busy' ? 'border-red-300 bg-red-50 text-red-800' :
          kitchenLoad.load === 'normal' ? 'border-amber-300 bg-amber-50 text-amber-800' :
          'border-matcha-300 bg-matcha-50 text-matcha-800'
        )}>
          <span className={cn(
            'h-2.5 w-2.5 rounded-full animate-pulse',
            kitchenLoad.load === 'busy' ? 'bg-red-500' :
            kitchenLoad.load === 'normal' ? 'bg-amber-500' : 'bg-matcha-500'
          )} />
          <span className="font-semibold">
            {kitchenLoad.load === 'busy' ? 'Küche sehr ausgelastet' :
             kitchenLoad.load === 'normal' ? 'Küche etwas ausgelastet' : 'Küche bereit'}
          </span>
          <span className="text-inherit opacity-70">·</span>
          <span>~{kitchenLoad.eta_min} Min ETA</span>
          <span className="text-inherit opacity-70">·</span>
          <span>{kitchenLoad.active_orders} aktive Bestellungen</span>
          <span className="text-inherit opacity-70">·</span>
          <span>{kitchenLoad.drivers_online} Fahrer online</span>
        </div>
      )}

      {/* Surge-Warnung: wenn queue_signal=surge oder ETA-Verlängerung >5min */}
      {kitchenLoad && (kitchenLoad.queue_signal === 'surge' || kitchenLoad.eta_extension_min > 5) && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-red-800 text-sm">
          <Zap className="h-4 w-4 text-red-500 shrink-0 animate-pulse" />
          <span className="font-bold">Surge aktiv</span>
          <span className="text-red-600 opacity-80">·</span>
          <span>ETA um +{kitchenLoad.eta_extension_min} Min verlängert</span>
          <span className="ml-auto text-[11px] bg-red-100 border border-red-200 rounded px-2 py-0.5 font-mono font-semibold">
            Hohe Nachfrage
          </span>
        </div>
      )}

      {/* Besetzungs-Lücken: warnt wenn in den nächsten 12h Fahrer fehlen */}
      {coverageGaps.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-bold">Besetzungslücken in 12h: </span>
            {coverageGaps.map((g, i) => (
              <span key={i} className="inline-flex items-center gap-1 mr-2 text-[11px] font-mono bg-amber-100 rounded px-1.5 py-0.5">
                {g.hour} <span className="text-red-500">{g.gap}</span>
              </span>
            ))}
            <span className="text-[11px] text-amber-600 ml-1">Fahrer einplanen!</span>
          </div>
        </div>
      )}

      {/* Geo-Cluster-Empfehlung: Top-Nachfrage-Zone aus Phase 173 K-Means Clustering */}
      <GeoClusterDispatchTip
        locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)}
        freeDriverCount={onlineDrivers.filter((d) => !batches.some((b) => b.fahrer_id === d.employee_id)).length}
      />

      {/* Tour-KPI-Ring: Donut-Chart für Touren-Status heute (abgeschlossen / unterwegs / wartend) */}
      <DispatchTourKpiRing />
      {/* Tour-ETA-Strip: Kompakter Live-Überblick aller aktiven Touren mit Countdown */}
      <TourEtaStrip batches={batches} drivers={drivers} />

      {/* Fahrer-Rangliste heute: Top-Fahrer nach Lieferungen + Pünktlichkeit */}
      <DriverLeaderboardStrip locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)} />
      {/* Fahrer-Zuverlässigkeit: Score + No-Show-Tracking */}
      <DriverReliabilityPanel locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)} />

      {/* Score-Übersicht: Alle wartenden Bestellungen mit Dispatch-Score als Farbbalken */}
      {readyOrders.length > 0 && <OrderScoreGrid orders={readyOrders} />}
      {/* Dispatch-Score-Trend: stündlicher Verlauf des Ø-Dispatch-Scores heute als Sparkline */}
      <DispatchScoreTrendStrip locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)} />

      {/* Schicht-Fortschritts-Ring: Makro-Übersicht aller gelieferten Stops + SLA-Quote */}
      <DispatchSchichtRing batches={batches} />

      {/* Tour-Puls: Kompakter Health-Streifen für alle aktiven Touren */}
      <DispatchTourHealthStrip batches={batches} />

      {/* Küchen-Pipeline: Bestellungen die bald fertig werden — für Fahrer-Vorplanung */}
      {pipelineOrders.length > 0 && (
        <KitchenPipelinePanel orders={pipelineOrders} />
      )}

      {/* Fahrer-Nachrichten: Betriebskommunikation */}
      <BroadcastPanel
        locationId={locations[0]?.id ?? null}
        broadcasts={broadcasts}
        sending={broadcastSending}
        onSend={async (msg, priority) => {
          const locationId = locations[0]?.id;
          if (!locationId) return;
          setBroadcastSending(true);
          try {
            const res = await fetch('/api/delivery/admin/broadcasts', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ location_id: locationId, message: msg, priority }),
            });
            if (res.ok) {
              const d = await res.json();
              setBroadcasts(prev => [{
                id: d.id, message: msg, priority, sentByName: null,
                createdAt: d.created_at, expiresAt: '', isActive: true, readCount: 0,
              }, ...prev.slice(0, 9)]);
            }
          } finally {
            setBroadcastSending(false);
          }
        }}
        onDelete={async (id) => {
          const locationId = locations[0]?.id;
          if (!locationId) return;
          await fetch(`/api/delivery/admin/broadcasts?id=${id}&location_id=${locationId}`, { method: 'DELETE' });
          setBroadcasts(prev => prev.filter(b => b.id !== id));
        }}
      />

      {/* Vorbestellungen: nächste 4h Übersicht */}
      {scheduledSummary && scheduledSummary.total > 0 && (
        <ScheduledOrdersPanel summary={scheduledSummary} orders={scheduledOrders} />
      )}

      {/* Schicht-Übersicht: Heutige Lieferleistung */}
      <TodayDispatchOverview
        locationId={locationFilter !== 'all' ? locationFilter : (orders[0]?.location_id ?? locations[0]?.id ?? null)}
        readyCount={readyOrders.length}
        enRouteCount={enRouteOrders.length}
        onlineDrivers={onlineDrivers.length}
      />

      {/* Kapazitäts-Meter: Live-Auslastung der verfügbaren Fahrer */}
      <DispatchCapacityMeter drivers={drivers} readyOrders={readyOrders} batches={batches} />

      {/* Live Delivery Health — SLA, ETA-Genauigkeit, Fahrer-Auslastung */}
      {deliveryHealth && (
        <LiveDeliveryHealthPanel health={deliveryHealth} />
      )}

      {/* Nachfrage-Prognose: nächste 6h basierend auf historischem Muster */}
      <DemandForecastPanel locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)} />

      {/* Smart-Zuweisung: KI-basierte Fahrer-Empfehlung für die prioritärste wartende Bestellung */}
      {readyOrders.length > 0 && onlineDrivers.length > 0 && (
        <SmartAssignmentPanel
          orders={readyOrders}
          drivers={drivers}
          onAssign={(driverId) => {
            if (readyOrders.length > 0) {
              setSelected(new Set([readyOrders[0].id]));
              assignToDriver(driverId);
            }
          }}
        />
      )}

      {/* Dispatch-Prioritäts-Queue: Score-basierte Warteliste mit Boost */}
      <DispatchQueuePanel locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)} />

      {/* Heutige Lieferstatistiken — Überblick aus DB */}
      {overviewStats && (
        <TodayStatsBar stats={overviewStats.today_stats} zoneCounts={overviewStats.zone_counts} />
      )}

      {/* Zonen-Analyse: Wartezeiten je Lieferzone — hebt unter-bediente Zonen hervor */}
      {readyOrders.length > 0 && (
        <DispatchZoneAnalysisPanel orders={readyOrders} />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Alle Filialen</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
            <Radio className="h-3.5 w-3.5 animate-pulse text-matcha-500" />
            <span className="text-muted-foreground">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Metric icon={<Package className="h-4 w-4" />} label="Bereit" value={readyOrders.length} />
          <Metric icon={<Truck className="h-4 w-4" />} label="Unterwegs" value={enRouteOrders.length} />
          <Metric icon={<Bike className="h-4 w-4" />} label="Online" value={onlineDrivers.length} />
          <Metric icon={<RouteIcon className="h-4 w-4" />} label="Touren" value={batches.length} />
          {/* Phase 105: Live-SLA + ETA-Genauigkeit als Metric-Chips */}
          {deliveryHealth?.slaOnTimePct != null && (
            <Metric
              icon={<Target className="h-4 w-4" />}
              label="SLA"
              value={`${deliveryHealth.slaOnTimePct}%`}
              highlight={deliveryHealth.slaOnTimePct >= 85 ? 'green' : deliveryHealth.slaOnTimePct >= 70 ? 'amber' : 'red'}
            />
          )}
          {deliveryHealth?.etaAccuracyPct != null && (
            <Metric
              icon={<Gauge className="h-4 w-4" />}
              label="ETA-Genau."
              value={`${deliveryHealth.etaAccuracyPct}%`}
              highlight={deliveryHealth.etaAccuracyPct >= 80 ? 'green' : deliveryHealth.etaAccuracyPct >= 60 ? 'amber' : 'red'}
            />
          )}
          <div className="flex flex-col items-start gap-0.5">
            <button
              onClick={triggerEtaRefresh}
              disabled={etaRefreshing || batches.length === 0}
              title="Live-ETAs aller laufenden Touren neu berechnen"
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                etaRefreshResult
                  ? 'border-matcha-400 bg-matcha-50 text-matcha-700'
                  : batches.length > 0
                    ? 'border-border bg-card text-muted-foreground hover:bg-muted'
                    : 'border-border bg-muted text-muted-foreground cursor-default opacity-50',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', etaRefreshing && 'animate-spin')} />
              {etaRefreshResult
                ? `✓ ${etaRefreshResult.orders_updated} ETAs aktualisiert`
                : etaRefreshing ? 'ETAs…' : 'ETAs'}
            </button>
            {etaRefreshResult && (
              <span className="text-[10px] text-matcha-600 font-mono pl-1 tabular-nums">
                {etaRefreshResult.batches_processed} Touren · {etaRefreshResult.orders_skipped} übersprungen
                {etaRefreshResult.errors > 0 && ` · ${etaRefreshResult.errors} Fehler`}
                {' · '}{etaRefreshResult.duration_ms}ms
              </span>
            )}
          </div>
          <button
            onClick={smartDispatch}
            disabled={dispatchPending || readyOrders.length === 0}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-bold transition',
              readyOrders.length > 0
                ? 'bg-matcha-700 text-white hover:bg-matcha-800 border-matcha-700'
                : 'bg-muted text-muted-foreground cursor-default',
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            {dispatchPending ? 'Läuft…' : 'Auto-Dispatch'}
          </button>
          {/* Phase 162: Schicht-Übergabe */}
          <button
            onClick={() => setShowSchichtUebergabe(v => !v)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition',
              showSchichtUebergabe
                ? 'border-saffron/60 bg-amber-50 text-saffron'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <History className="h-3.5 w-3.5" />
            Übergabe
          </button>
          <button
            onClick={async () => {
              const locationId = locationFilter !== 'all'
                ? locationFilter
                : (orders[0]?.location_id ?? locations[0]?.id ?? null);
              if (!locationId) return;
              setAiPanelOpen(true);
              setAiText('');
              setAiLoading(true);
              try {
                const res = await fetch('/api/delivery/admin/ai-assist', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ location_id: locationId }),
                });
                if (!res.ok || !res.body) {
                  setAiText('Fehler: KI-Assistent nicht verfügbar.');
                  return;
                }
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let finished = false;
                while (!finished) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() ?? '';
                  for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const chunk = line.slice(6);
                    if (chunk === '[DONE]') { finished = true; break; }
                    setAiText((prev) => prev + chunk.replace(/\\n/g, '\n'));
                  }
                }
              } finally {
                setAiLoading(false);
              }
            }}
            disabled={aiLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
          >
            <Sparkles className={cn('h-3.5 w-3.5', aiLoading && 'animate-pulse')} />
            {aiLoading ? 'KI denkt…' : 'KI-Empfehlung'}
          </button>
        </div>
      </div>

      {/* KI-Dispatch-Assistent Panel */}
      {aiPanelOpen && (
        <AiDispatchAssistantPanel
          text={aiText}
          loading={aiLoading}
          onClose={() => { setAiPanelOpen(false); setAiText(''); }}
        />
      )}

      {/* Phase 162: Schicht-Übergabe Panel */}
      {showSchichtUebergabe && (
        <DispatchSchichtUebergabePanel
          locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)}
          drivers={drivers}
          activeBatches={batches as any}
          waitingOrders={readyOrders.filter(o => o.status === 'fertig').map(o => ({
            id: o.id,
            bestellnummer: o.bestellnummer,
            kunde_name: o.kunde_name,
            fertig_am: o.fertig_am,
            gesamtbetrag: o.gesamtbetrag,
          }))}
          onClose={() => setShowSchichtUebergabe(false)}
        />
      )}

      {/* Unterwegs-ETA-Strip: alle aktiven Lieferungen mit Countdown */}
      {enRouteOrders.length > 0 && <EnRouteEtaStrip orders={enRouteOrders} />}

      {/* Live-GPS-Puls: Echtzeit-Geschwindigkeit + Signal-Status aller aktiven Fahrer */}
      {batches.length > 0 && <LiveDriverPulseStrip batches={batches} drivers={drivers} />}

      {/* Quick-Assign: beste Bestellung → nächster freier Fahrer mit einem Klick */}
      <DispatchQuickAssignBar
        orders={readyOrders}
        drivers={drivers}
        restaurantLat={locationFilter !== 'all' ? (locations.find((l) => l.id === locationFilter)?.lat ?? null) : (locations[0]?.lat ?? null)}
        restaurantLng={locationFilter !== 'all' ? (locations.find((l) => l.id === locationFilter)?.lng ?? null) : (locations[0]?.lng ?? null)}
        onAssign={async (orderIds, driverId) => {
          const locationId = readyOrders.find((o) => orderIds.includes(o.id))?.location_id ?? null;
          const { data, error } = await supabase.rpc('assign_to_driver', {
            p_employee_id: driverId,
            p_order_ids: orderIds,
            p_location_id: locationId,
          });
          if (error || !(data as { ok: boolean })?.ok) {
            const { data: batch } = await supabase
              .from('delivery_batches')
              .insert({ location_id: locationId, fahrer_id: driverId, status: 'pickup', startzeit: new Date().toISOString(), erstellt_von: null, auto_erstellt: false })
              .select().single();
            if (batch) {
              await supabase.from('delivery_batch_stops').insert(orderIds.map((id, i) => ({ batch_id: (batch as { id: string }).id, order_id: id, reihenfolge: i + 1 })));
              await supabase.from('customer_orders').update({ fahrer_id: driverId, batch_id: (batch as { id: string }).id, status: 'unterwegs' }).in('id', orderIds);
              await supabase.from('driver_status').update({ aktueller_batch_id: (batch as { id: string }).id }).eq('employee_id', driverId);
            }
          }
          await refresh();
        }}
      />

      {/* Active Tour Rail — kompakter Überblick aller laufenden Touren */}
      {batches.length > 0 && <ActiveTourRail batches={batches} drivers={drivers} onSelect={setBatchDetailId} />}

      {/* Liefertrichter: Bestellungen von Eingang bis Lieferung mit Konversionsraten */}
      <DispatchDemandFunnel locationFilter={locationFilter} />

      {/* Zonen-Stats-Dashboard: Übersicht aller Zonen mit Bestellungen, Fahrern, Wartezeiten */}
      <ZoneStatsDashboard
        orders={readyOrders.map(o => ({
          id: o.id,
          bestellnummer: o.bestellnummer,
          status: o.status,
          delivery_zone: o.delivery_zone,
          fertig_am: o.fertig_am,
          gesamtbetrag: o.gesamtbetrag,
          dispatch_score: o.dispatch_score,
        }))}
        batches={batches.map(b => ({
          id: b.id,
          status: b.status,
          zone: b.zone,
          fahrer_id: b.fahrer_id,
        }))}
      />

      {/* Zonen-Wartezeit-Heatmap: Farbkodierte Wartezeiten je Lieferzone */}
      <ZoneWaitHeatmap orders={readyOrders} />

      {/* Auslastungs-Heatmap: historisches Bestellvolumen Stunden × Wochentage */}
      <AuslastungsHeatmap locationId={locations[0]?.id} />

      {/* Zonen-Abdeckung: Welche Zonen haben Bedarf und welche sind gedeckt? */}
      <ZoneCoverageCard
        readyOrders={readyOrders.filter((o) => o.status === 'fertig')}
        drivers={drivers}
        batches={batches}
      />

      {/* Touren-Zeitplan: Visueller Zeitstrahl aller aktiven Touren mit Stop-Fortschritt */}
      {batches.length > 0 && <TourZeitplanGrid batches={batches as any} />}

      {/* Live-Tour-Tracker: kompakte Statuskarten aller aktiven Touren mit Farbkodierung */}
      {batches.length > 0 && <LiveTourTracker batches={batches} />}

      {/* Phase 113: Fahrer-Rückkehr-Vorschau — wann wird welcher Fahrer wieder frei? */}
      {drivers.length > 0 && (
        <DriverReturnForecast drivers={drivers} batches={batches} />
      )}

      {/* Tour-Routen-Übersicht: alle aktiven Touren mit Stopp-Fortschritt und ETA */}
      <TourRouteOverview batches={batches} />

      {/* Tour-Sequenz: Detaillierte Stopp-für-Stopp-Ansicht aller aktiven Touren */}
      <TourSequenzPanel batches={batches} />

      {/* Tour-Bündelung-Effizienz: Stops/km, Zonen-Konzentration, Rückkehr-ETA je Fahrer */}
      {batches.length > 0 && <TourBundleBoard batches={batches} />}

      {/* Fahrer-Zeitplan: Verfügbarkeit und Rückkehr-ETA aller aktiven Fahrer */}
      <FahrerZeitplanPanel locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? '')} />

      {/* Optimale Nächste Zuweisung: welcher Fahrer passt am besten zur nächsten Bestellung */}
      <DispatchNächsteZuweisung locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)} />

      {/* Tour-Gantt: alle aktiven Touren auf 90-Min-Zeitstrahl mit Jetzt-Linie */}
      {batches.length > 0 && <DispatchTourGantt batches={batches} drivers={drivers} />}

      {/* Beste nächste Aktion — KI-Empfehlung für Dispatcher */}
      {readyOrders.length > 0 && onlineDrivers.length > 0 && (
        <DispatchNextBestAction
          orders={readyOrders}
          drivers={onlineDrivers}
          batches={batches}
          onAssign={async (orderIds, driverId) => {
            // Direktzuweisung ohne selected-State-Abhängigkeit
            const locationId = readyOrders.find((o) => orderIds.includes(o.id))?.location_id ?? null;
            const { data, error } = await supabase.rpc('assign_to_driver', {
              p_employee_id: driverId,
              p_order_ids:   orderIds,
              p_location_id: locationId,
            });
            if (error || !(data as { ok: boolean })?.ok) {
              // Fallback
              const { data: batch } = await supabase
                .from('delivery_batches')
                .insert({ location_id: locationId, fahrer_id: driverId, status: 'pickup', startzeit: new Date().toISOString(), erstellt_von: null, auto_erstellt: false })
                .select().single();
              if (batch) {
                await supabase.from('delivery_batch_stops').insert(orderIds.map((id, i) => ({ batch_id: (batch as { id: string }).id, order_id: id, reihenfolge: i + 1 })));
                await supabase.from('customer_orders').update({ fahrer_id: driverId, batch_id: (batch as { id: string }).id, status: 'unterwegs' }).in('id', orderIds);
                await supabase.from('driver_status').update({ aktueller_batch_id: (batch as { id: string }).id }).eq('employee_id', driverId);
              }
            }
            await refresh();
          }}
        />
      )}

      {/* Capacity Forecast — nächster freier Fahrer */}
      <CapacityForecastChip batches={batches} onlineDrivers={onlineDrivers} />

      {/* Lieferfenster — vorgebuchte Zeit-Slots für heute */}
      <DeliveryWindowsPanel />

      {/* Schichtanfragen — ausstehende Fahrer-Schichtanmeldungen */}
      <ShiftClaimsPanel claims={shiftClaims} />

      {/* Phase 89: Kapazitäts-Gauge — freie Plätze in Touren + freie Fahrer */}
      <DispatchCapacityGauge batches={batches} drivers={onlineDrivers} readyCount={readyOrders.length} />

      {/* Score + Zone Summary */}
      <DispatchScoreSummary orders={readyOrders} batches={batches} />

      {/* ETA-Genauigkeit heute: Pünktlichkeitsrate + Ø-Abweichung nach Zone */}
      <EtaAccuracyLive locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)} />

      {/* Live SLA-Monitor: Pünktlichkeitsrate Schicht + Letzte 30/60 Min + Zone-Aufschlüsselung */}
      <SlaLivePanel />

      {/* Zonen-Kapazitäts-Panel: Bestellungen nach Zone + freie Fahrer */}
      {readyOrders.length > 0 && <ZoneCapacityPanel orders={readyOrders} drivers={drivers} />}

      {/* Bündelungschancen: proaktiver Alert wenn ≥2 Bestellungen in gleicher Zone unverteilt */}
      {readyOrders.length >= 2 && <DispatchBundleOpportunityAlert orders={readyOrders} drivers={drivers} />}

      {/* Tour Return Timeline — wann kommen Fahrer zurück? */}
      {batches.length > 0 && <TourReturnTimeline batches={batches} />}

      {/* Fahrer-Schicht-Leaderboard: Stopps, Distanz, ETA-Genauigkeit */}
      <DriverShiftLeaderboard drivers={drivers} batches={batches} />

      {/* Historisches Leaderboard: Wochen-/Monatsranking aus persistenten Snapshots */}
      <DriverHistoricalLeaderboardPanel locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)} />

      {/* Tour-Score-Board: priorisierte Liste aktiver Touren nach ETA-Gesundheit */}
      {batches.length > 0 && <DispatchActiveTourScoreBoard batches={batches} drivers={drivers} />}

      {/* Tour-Visualisierung: alle laufenden Touren im Überblick mit Stopp-Details */}
      {batches.length > 0 && <TourVisualizationPanel batches={batches} drivers={drivers} readyOrders={readyOrders} />}

      {/* Tour-Fortschrittsgeschwindigkeit: Ist die Tour vor oder hinter dem Zeitplan? */}
      {batches.length > 0 && <DispatchTourCompletionSpeedPanel batches={batches} />}

      {/* Handoff-Geschwindigkeit: Ø-Zeit von Fertig → Fahrer-Zuweisung */}
      <DispatchHandoffSpeedPanel locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)} />

      {/* Incident-Übersicht: offene Vorfälle aus dem Incident-Management-System */}
      <OpenIncidentsPanel locationId={locationFilter !== 'all' ? locationFilter : (locations[0]?.id ?? null)} />

      {/* Fahrer-Tipp: welcher freie Fahrer ist am nächsten zu welcher Zone */}
      <DriverZoneMatchPanel orders={filteredOrders} drivers={drivers} batches={batches} />

      {/* Stale Dispatch: Bestellungen >10 Min ohne Fahrer-Zuweisung (Eskalation) */}
      <StaleOrdersPanel orders={staleOrders} />

      {/* Fehlgeschlagene Zustellversuche: Wiederholung planen oder abschließen */}
      {failedAttempts.length > 0 && (
        <FailedAttemptsPanel
          attempts={failedAttempts}
          onRefresh={() => {
            fetch('/api/delivery/admin/failed-attempts?action=list')
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (Array.isArray(d?.attempts)) setFailedAttempts(d.attempts); })
              .catch(() => {});
          }}
        />
      )}

      {/* Batch-Wiederherstellung: stornierte / fehlgeschlagene Touren manuell wiederherstellen */}
      <RecoveryPanel
        batches={batches}
        recoveryEvents={recoveryEvents}
        recoveryPending={recoveryPending}
        onRecover={triggerRecovery}
      />

      {/* Lange Wartezeiten: Bestellungen >8 Min ohne Fahrer */}
      <LongWaitOrdersPanel orders={readyOrders} onSelect={(id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })} selected={selected} />

      {/* Verspätungs-Monitor: verspätete Lieferungen + Kompensations-Gutscheine */}
      <DelayMonitorPanel locationId={locationFilter !== 'all' ? locationFilter : (orders[0]?.location_id ?? locations[0]?.id)} />

      {/* Zone Bundling Opportunities */}
      <ZoneBundlingAlert orders={readyOrders} onlineDrivers={onlineDrivers} onSelectZone={(zone) => {
        const ids = readyOrders.filter((o) => o.delivery_zone === zone).map((o) => o.id);
        setSelected(new Set(ids));
      }} />

      {/* Ausstehender Warenwert — Aufschlüsselung nach Zahlungsart + Wartezeit */}
      <PendingValuePanel orders={readyOrders} />

      {/* Live Driver Map */}
      {(() => {
        const loc = locationFilter !== 'all'
          ? locations.find((l) => l.id === locationFilter)
          : locations[0];
        return (
          <>
            <LiveDriverMapPanel
              drivers={drivers}
              batches={batches}
              orders={filteredOrders}
              restaurantLat={loc?.lat ?? null}
              restaurantLng={loc?.lng ?? null}
              locationId={loc?.id ?? null}
            />
            {/* Positions-Empfehlung für freie Fahrer (Geo-Cluster Hotspots) */}
            {(() => {
              const busyIds = new Set(batches.map((b) => b.fahrer_id).filter(Boolean));
              const freeWithGps = onlineDrivers.filter(
                (d) => !busyIds.has(d.employee_id) && d.last_lat && d.last_lng,
              );
              if (freeWithGps.length === 0) return null;
              return (
                <DriverPositioningPanel
                  locationId={loc?.id ?? null}
                  freeDrivers={freeWithGps.map((d) => ({
                    id: d.employee_id,
                    name: `${d.employee?.vorname ?? ''} ${d.employee?.nachname ?? ''}`.trim(),
                    lat: d.last_lat!,
                    lng: d.last_lng!,
                  }))}
                />
              );
            })()}
          </>
        );
      })()}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left Column: Ready + Active */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-matcha-600" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider">Bereit zur Abholung</h2>
                <Badge variant="secondary">{readyOrders.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground">
                      {selected.size} ausgewählt · wähle Fahrer rechts
                    </div>
                    <button
                      onClick={cancelSelectedOrders}
                      disabled={cancelPending}
                      className="inline-flex items-center gap-1 h-6 rounded border border-red-200 bg-red-50 px-2 text-[10px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                      title="Ausgewählte Bestellungen stornieren"
                    >
                      {cancelPending ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
                      Stornieren
                    </button>
                  </>
                )}
                <select
                  value={orderSort}
                  onChange={(e) => setOrderSort(e.target.value as 'wait' | 'zone' | 'score')}
                  className="h-7 rounded border bg-background px-2 text-[11px] font-medium text-muted-foreground"
                >
                  <option value="wait">Älteste zuerst</option>
                  <option value="zone">Nach Zone</option>
                  <option value="score">Score ↓</option>
                </select>
              </div>
            </div>
            {readyOrders.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Alles ausgeliefert. Neue Bestellungen erscheinen hier live.
              </div>
            ) : (
              <>
                {/* Wartezeit-Verteilung: farbkodierte Balken zeigen Urgenz auf einen Blick */}
                <ReadyOrderWaitHeatmap orders={readyOrders} />
                <div className="divide-y">
                  {readyOrders.map((o) => (
                    <OrderRow
                      key={o.id}
                      order={o}
                      selected={selected.has(o.id)}
                      onToggle={() => toggleSelect(o.id)}
                      onScoreClick={openScorePopover}
                    />
                  ))}
                </div>
              </>
            )}
            {/* Tour-Vorschau: Inline-Zusammenfassung der ausgewählten Bestellungen */}
            {selected.size >= 1 && (
              <BatchSelectionPreview
                orders={readyOrders.filter((o) => selected.has(o.id))}
                restaurantLat={locations[0]?.lat ?? null}
                restaurantLng={locations[0]?.lng ?? null}
              />
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <RouteIcon className="h-4 w-4 text-matcha-600" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider">Laufende Touren</h2>
                <Badge variant="secondary">{batches.length}</Badge>
              </div>
            </div>
            {batches.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Gerade ist niemand unterwegs.
              </div>
            ) : (
              <>
                <ActiveTourSummaryBar batches={batches} />
                <div className="space-y-3 p-4">
                  {batches.map((b) => (
                    <BatchRow key={b.id} batch={b} />
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Right Column: Drivers */}
        <div className="space-y-4">
          {/* Smart Assign — beste Fahrer-Bestellungs-Kombination */}
          <SmartAssignCard
            orders={readyOrders}
            drivers={onlineDrivers}
            batches={batches}
            onSelectOrders={(ids, driverId) => {
              setSelected(new Set(ids));
              assignToDriver(driverId);
            }}
          />

          {/* Schicht-Leaderboard: Top Fahrer nach heutigen Lieferungen */}
          <DispatchShiftLeaderboard drivers={onlineDrivers} batches={batches} />

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <Bike className="h-4 w-4 text-matcha-600" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider">Fahrer</h2>
              </div>
              <div className="text-xs text-muted-foreground">
                {onlineDrivers.length} online · {offlineDrivers.length} offline
              </div>
            </div>

            <div className="divide-y">
              {onlineDrivers.map((d) => {
                const loc = locationFilter !== 'all'
                  ? locations.find((l) => l.id === locationFilter)
                  : locations[0];
                return (
                  <DriverRow
                    key={d.employee_id}
                    driver={d}
                    activeBatch={batches.find((b) => b.fahrer_id === d.employee_id || b.id === d.aktueller_batch_id) ?? null}
                    canAssign={selected.size > 0 && !d.aktueller_batch_id}
                    busy={pending}
                    onAssign={() => assignToDriver(d.employee_id)}
                    restaurantLat={loc?.lat ?? null}
                    restaurantLng={loc?.lng ?? null}
                    shiftStats={driverShiftStats.get(d.employee_id) ?? null}
                  />
                );
              })}
              {onlineDrivers.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Momentan ist kein Fahrer online.
                </div>
              )}

              {offlineDrivers.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer select-none border-t px-5 py-3 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                    {offlineDrivers.length} Fahrer offline
                  </summary>
                  <div className="divide-y">
                    {offlineDrivers.map((d) => (
                      <DriverRow key={d.employee_id} driver={d} canAssign={false} busy={false} onAssign={() => {}} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          </Card>

          {/* Lieferungs-Chronik */}
          <DeliveryChronikPanel
            locationId={locationFilter !== 'all' ? locationFilter : (orders[0]?.location_id ?? null)}
          />
        </div>
      </div>
    </div>

    {/* Score-Aufschlüsselung Popover */}
    {scorePopover && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={() => setScorePopover(null)}
      >
        <div
          className="w-full max-w-sm rounded-2xl bg-card border shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-5 py-3 bg-matcha-50">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600">Scoring-Aufschlüsselung</div>
              <div className="font-display font-bold text-sm">#{scorePopover.bestellnummer.replace('FF-', '')}</div>
            </div>
            <button onClick={() => setScorePopover(null)} className="h-8 w-8 rounded-full hover:bg-muted grid place-items-center text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {scorePopover.loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-matcha-600" />
              <div className="mt-2 text-sm text-muted-foreground">Lade Scoring-Daten…</div>
            </div>
          ) : !scorePopover.score ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Keine Scoring-Daten vorhanden. Score wird beim nächsten Dispatch-Tick berechnet.
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Total score gauge */}
              <div className="flex items-center gap-4 rounded-xl bg-matcha-50 border border-matcha-200 p-3">
                <div className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-display text-2xl font-black',
                  scorePopover.score.total >= 80 ? 'bg-matcha-600 text-white' :
                  scorePopover.score.total >= 60 ? 'bg-blue-500 text-white' :
                  scorePopover.score.total >= 40 ? 'bg-orange-400 text-white' : 'bg-red-500 text-white',
                )}>
                  {Math.round(scorePopover.score.total)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gesamt-Score</div>
                  {scorePopover.score.driver_name && (
                    <div className="text-sm font-bold truncate">{scorePopover.score.driver_name}</div>
                  )}
                  {scorePopover.score.decision && (
                    <div className="text-[10px] text-muted-foreground">{scorePopover.score.decision}</div>
                  )}
                </div>
              </div>
              {/* Radar-Chart — visueller Überblick aller 10 Faktoren */}
              <div className="flex justify-center py-1">
                <ScoreRadarChart score={scorePopover.score} />
              </div>

              {/* 10-factor breakdown */}
              <div className="space-y-1.5">
                {([
                  ['f_distance',    'Distanz',       '📍'],
                  ['f_load',        'Fahrerlast',     '📦'],
                  ['f_vehicle',     'Fahrzeugtyp',    '🚲'],
                  ['f_experience',  'Erfahrung',      '⭐'],
                  ['f_zone',        'Zonenpassung',   '🗺️'],
                  ['f_prep_time',   'Küchen-Timing',  '⏱'],
                  ['f_time_of_day', 'Tageszeit',      '🕐'],
                  ['f_priority',    'Priorität',      '🔥'],
                  ['f_bundle_fit',  'Bündelbarkeit',  '🔗'],
                  ['f_history',     'Historie',       '📊'],
                ] as [keyof typeof scorePopover.score, string, string][]).map(([key, label, icon]) => {
                  const val = scorePopover.score![key] as number;
                  if (val == null) return null;
                  const pct = Math.min(100, (val / 10) * 100);
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-5 text-center text-sm shrink-0">{icon}</span>
                      <span className="text-[11px] text-muted-foreground w-24 shrink-0">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            val >= 8 ? 'bg-matcha-500' : val >= 6 ? 'bg-blue-400' : val >= 4 ? 'bg-orange-400' : 'bg-red-400',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={cn(
                        'w-6 text-right text-[11px] font-bold tabular-nums',
                        val >= 8 ? 'text-matcha-700' : val >= 6 ? 'text-blue-600' : val >= 4 ? 'text-orange-600' : 'text-red-600',
                      )}>
                        {val.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {scorePopover.score.reason && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-[10px] text-muted-foreground leading-relaxed">
                  {scorePopover.score.reason}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}
    {/* BatchDetailModal */}
    <BatchDetailDialog
      batchId={batchDetailId}
      batches={batches}
      drivers={drivers}
      onClose={() => setBatchDetailId(null)}
    />
    </>
  );
}

/* ------------------------------ DeliveryProofBadge ------------------------------ */

const PROOF_LABEL: Record<string, string> = {
  handed_to_person: 'Übergeben',
  left_at_door:     'Vor Tür',
  neighbour:        'Nachbar',
  contactless:      'Kontaktlos',
  photo:            'Foto',
};

function DeliveryProofBadge({ batchId, orderId }: { batchId: string; orderId: string }) {
  const [proof, setProof] = useState<{ proof_type: string; photo_url: string | null; notes: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    if (proof || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/tours/${batchId}/proof?order_id=${orderId}`);
      if (res.ok) {
        const d = await res.json();
        setProof(d.proof ?? null);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => { setOpen((v) => !v); load(); }}
        className="text-[9px] font-bold text-matcha-600 hover:text-matcha-800 transition underline-offset-2 hover:underline"
      >
        {loading ? '…' : open ? '▲ Nachweis' : '▼ Nachweis'}
      </button>
      {open && (
        <div className="mt-1 rounded bg-matcha-50 border border-matcha-200 px-2 py-1.5">
          {proof ? (
            <>
              <div className="text-[10px] font-bold text-matcha-700">
                {PROOF_LABEL[proof.proof_type] ?? proof.proof_type}
              </div>
              {proof.notes && (
                <div className="text-[9px] text-matcha-600 italic mt-0.5">„{proof.notes}"</div>
              )}
              {proof.photo_url && (
                <a href={proof.photo_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
                  <img src={proof.photo_url} alt="Lieferfoto" className="w-20 h-14 object-cover rounded border border-matcha-200" />
                </a>
              )}
            </>
          ) : loading ? (
            <div className="text-[9px] text-matcha-400">Lade…</div>
          ) : (
            <div className="text-[9px] text-matcha-400">Kein Nachweis</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ BatchDetailDialog ------------------------------ */

function BatchDetailDialog({
  batchId,
  batches,
  drivers,
  onClose,
}: {
  batchId: string | null;
  batches: Batch[];
  drivers: Driver[];
  onClose: () => void;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!batchId) return;
    const iv = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(iv);
  }, [batchId]);

  if (!batchId) return null;
  const b = batches.find((bt) => bt.id === batchId);
  if (!b) return null;

  const total = b.stops.length;
  const done = b.stops.filter((s) => s.geliefert_am).length;
  const etaMs =
    b.startzeit && b.total_eta_min != null
      ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
      : null;
  const now = Date.now();
  const secLeft = etaMs ? Math.floor((etaMs - now) / 1000) : null;
  const overdue = secLeft !== null && secLeft < 0;
  const finStr = etaMs
    ? new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;
  const driver = drivers.find((d) => d.employee_id === b.fahrer_id || d.aktueller_batch_id === b.id);
  const driverFull = b.fahrer
    ? `${b.fahrer.vorname} ${b.fahrer.nachname}`
    : driver?.employee
      ? `${driver.employee.vorname} ${driver.employee.nachname}`
      : 'Fahrer';
  const phone = driver?.employee?.telefon ?? null;

  const sortedStops = [...b.stops].sort((a, c) => a.reihenfolge - c.reihenfolge);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4 text-matcha-600" />
            Tour-Detail
            {b.zone && (
              <span className={cn('ml-1 text-xs font-bold px-1.5 py-0.5 rounded', zoneMeta(b.zone).cls)}>
                Zone {b.zone}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Driver info + tour countdown */}
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-matcha-700 flex items-center justify-center text-white font-black text-sm shrink-0">
            {driverFull.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">{driverFull}</div>
            {phone && <div className="text-xs text-muted-foreground">{phone}</div>}
            <div className="text-[11px] text-muted-foreground capitalize mt-0.5">{b.status.replace(/_/g, ' ')}</div>
          </div>
          <div className="text-right shrink-0">
            <div className={cn('text-sm font-black tabular-nums', overdue ? 'text-red-600' : 'text-matcha-700')}>
              {secLeft !== null
                ? overdue
                  ? `+${Math.floor(-secLeft / 60)}m überfällig`
                  : secLeft < 3600
                    ? `${Math.floor(secLeft / 60)}:${String(secLeft % 60).padStart(2, '0')}`
                    : finStr ?? '—'
                : '—'}
            </div>
            {finStr && <div className="text-[10px] text-muted-foreground">{finStr} Uhr</div>}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Stopps', value: `${done}/${total}` },
            { label: 'Strecke', value: b.total_distance_km != null ? `${b.total_distance_km.toFixed(1)} km` : '—' },
            { label: 'ETA', value: b.total_eta_min != null ? `${b.total_eta_min} Min` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border bg-card px-3 py-2 text-center">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-sm font-bold tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        {/* Stop list with per-stop ETA countdown */}
        <div className="rounded-xl border overflow-hidden">
          <div className="px-3 py-2 bg-muted/40 border-b text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Stopps
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {sortedStops.map((s, i) => {
              const stopEtaMs = s.order?.eta_earliest
                ? new Date(s.order.eta_earliest).getTime()
                : null;
              const stopSecLeft = stopEtaMs ? Math.floor((stopEtaMs - now) / 1000) : null;
              const stopOverdue = stopSecLeft !== null && stopSecLeft < 0;
              const stopUrgent = stopSecLeft !== null && stopSecLeft >= 0 && stopSecLeft < 600;
              const stopEtaColor = stopOverdue
                ? 'text-red-500'
                : stopUrgent
                  ? 'text-orange-500'
                  : 'text-matcha-600';

              return (
                <div key={s.id} className={cn('flex items-start gap-2.5 px-3 py-2.5', s.geliefert_am ? 'opacity-50' : '')}>
                  <div className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 mt-0.5',
                    s.geliefert_am ? 'bg-matcha-500' : i === done ? 'bg-orange-400 animate-pulse' : 'bg-muted-foreground/40',
                  )}>
                    {s.geliefert_am ? '✓' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">
                      {s.order?.kunde_name ?? `Stopp ${i + 1}`}
                      {s.order?.bestellnummer && (
                        <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                          #{s.order.bestellnummer.replace('FF-', '')}
                        </span>
                      )}
                    </div>
                    {s.order?.kunde_adresse && (
                      <div className="text-[10px] text-muted-foreground truncate">{s.order.kunde_adresse}</div>
                    )}
                    {s.geliefert_am ? (
                      <div>
                        <div className="text-[10px] text-matcha-600 font-semibold">
                          Zugestellt {new Date(s.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {s.order_id && (
                          <DeliveryProofBadge batchId={b.id} orderId={s.order_id} />
                        )}
                      </div>
                    ) : stopSecLeft !== null ? (
                      <div className={cn('text-[10px] font-semibold tabular-nums', stopEtaColor)}>
                        {stopOverdue
                          ? `${Math.floor(-stopSecLeft / 60)}m überfällig`
                          : stopSecLeft < 3600
                            ? `${Math.floor(stopSecLeft / 60)}:${String(stopSecLeft % 60).padStart(2, '0')} verbleibend`
                            : `ETA ${new Date(stopEtaMs!).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ DeliveryChronikPanel ------------------------------ */

type ChronikEvent = {
  id: string;
  event_type: string;
  order_id: string | null;
  batch_id: string | null;
  driver_id: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
};

function DeliveryChronikPanel({ locationId }: { locationId: string | null }) {
  const [events, setEvents] = useState<ChronikEvent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/events?location_id=${locationId}&limit=25`)
        .then(r => r.ok ? r.json() : null)
        .then((d: { events?: ChronikEvent[] } | null) => { if (d?.events) setEvents(d.events) })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!events.length) return null;

  const eventMeta = (type: string): { icon: string; label: string; cls: string } => {
    switch (type) {
      case 'order_received':     return { icon: '📦', label: 'Bestellung eingegangen', cls: 'text-blue-600' };
      case 'order_dispatched':   return { icon: '🛵', label: 'Dispatcht', cls: 'text-matcha-700' };
      case 'order_bundled':      return { icon: '📦📦', label: 'Gebündelt', cls: 'text-violet-600' };
      case 'batch_created':      return { icon: '🗺️', label: 'Tour erstellt', cls: 'text-matcha-700' };
      case 'batch_completed':    return { icon: '✅', label: 'Tour abgeschlossen', cls: 'text-emerald-700' };
      case 'stop_delivered':     return { icon: '🏠', label: 'Zugestellt', cls: 'text-emerald-600' };
      case 'driver_online':      return { icon: '🟢', label: 'Fahrer online', cls: 'text-emerald-600' };
      case 'driver_offline':     return { icon: '🔴', label: 'Fahrer offline', cls: 'text-red-600' };
      case 'eta_updated':        return { icon: '⏱', label: 'ETA aktualisiert', cls: 'text-amber-600' };
      case 'kitchen_ready':      return { icon: '🍽', label: 'Küche: Fertig', cls: 'text-matcha-600' };
      case 'kitchen_cooking':    return { icon: '🍳', label: 'Küche: Kochen', cls: 'text-orange-600' };
      case 'batch_optimized':    return { icon: '🔀', label: 'Route optimiert', cls: 'text-blue-600' };
      default:                   return { icon: '•', label: type.replace(/_/g, ' '), cls: 'text-muted-foreground' };
    }
  };

  const relTime = (iso: string) => {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)} Min`;
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-5 py-3 border-b text-left hover:bg-muted/30 transition"
      >
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Chronik</span>
        <span className="ml-2 text-xs text-muted-foreground">{events.length} Ereignisse</span>
        {open ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" /> : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto">
          {events.map(ev => {
            const m = eventMeta(ev.event_type);
            return (
              <div key={ev.id} className="flex items-start gap-3 px-4 py-2 border-b last:border-0 hover:bg-muted/20">
                <span className="text-base shrink-0 mt-0.5">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-xs font-semibold', m.cls)}>{m.label}</div>
                  {(ev.payload as any)?.driver_name && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {(ev.payload as any).driver_name}
                    </div>
                  )}
                  {(ev.payload as any)?.bestellnummer && (
                    <div className="text-[10px] font-mono text-muted-foreground">
                      #{String((ev.payload as any).bestellnummer).replace('FF-', '')}
                    </div>
                  )}
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">{relTime(ev.occurred_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ PendingValuePanel ------------------------------ */

function PendingValuePanel({ orders }: { orders: ReadyOrder[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  if (orders.length === 0) return null;

  const now = Date.now();
  const totalValue = orders.reduce((s, o) => s + o.gesamtbetrag, 0);

  const byPay = {
    bar:    orders.filter((o) => o.zahlungsart === 'bar'),
    karte:  orders.filter((o) => o.zahlungsart === 'karte'),
    online: orders.filter((o) => !['bar', 'karte'].includes(o.zahlungsart)),
  };

  const longWait  = orders.filter((o) => o.fertig_am && (now - new Date(o.fertig_am).getTime()) >= 10 * 60_000);
  const medWait   = orders.filter((o) => o.fertig_am && (now - new Date(o.fertig_am).getTime()) >= 5 * 60_000 && (now - new Date(o.fertig_am).getTime()) < 10 * 60_000);
  const freshWait = orders.filter((o) => !o.fertig_am || (now - new Date(o.fertig_am).getTime()) < 5 * 60_000);

  const waitTimes = orders.map((o) => o.fertig_am ? Math.floor((now - new Date(o.fertig_am).getTime()) / 60_000) : 0);
  const avgWait = waitTimes.length > 0 ? Math.round(waitTimes.reduce((s, v) => s + v, 0) / waitTimes.length) : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-2.5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-base font-black text-matcha-800">{euro(totalValue)}</span>
        <span className="text-xs text-muted-foreground">{orders.length} Bestellungen bereit</span>
      </div>
      <div className="h-4 w-px bg-border hidden sm:block" />
      <div className="flex flex-wrap items-center gap-1.5">
        {byPay.bar.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
            <Banknote className="h-3 w-3" />
            {byPay.bar.length}× Bar · {euro(byPay.bar.reduce((s, o) => s + o.gesamtbetrag, 0))}
          </span>
        )}
        {byPay.karte.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
            <CreditCard className="h-3 w-3" />
            {byPay.karte.length}× Karte · {euro(byPay.karte.reduce((s, o) => s + o.gesamtbetrag, 0))}
          </span>
        )}
        {byPay.online.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-800 px-2 py-0.5 text-[10px] font-bold">
            <Wifi className="h-3 w-3" />
            {byPay.online.length}× Online
          </span>
        )}
      </div>
      <div className="h-4 w-px bg-border hidden sm:block" />
      <div className="flex items-center gap-1.5">
        {longWait.length > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
            {longWait.length} &gt;10m
          </span>
        )}
        {medWait.length > 0 && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
            {medWait.length} 5–10m
          </span>
        )}
        {freshWait.length > 0 && (
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {freshWait.length} frisch
          </span>
        )}
        {avgWait > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">⌀ {avgWait}m</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ ZoneBundlingAlert ------------------------------ */

function ZoneBundlingAlert({
  orders,
  onlineDrivers,
  onSelectZone,
}: {
  orders: ReadyOrder[];
  onlineDrivers: Driver[];
  onSelectZone?: (zone: string) => void;
}) {
  if (orders.length === 0) return null;

  // Gruppiere wartende Bestellungen nach Zone
  const byZone = orders.reduce<Record<string, { orders: ReadyOrder[]; maxWaitMin: number }>>((acc, o) => {
    const zone = o.delivery_zone ?? '?';
    if (!acc[zone]) acc[zone] = { orders: [], maxWaitMin: 0 };
    acc[zone].orders.push(o);
    const waitMin = o.fertig_am ? Math.floor((Date.now() - new Date(o.fertig_am).getTime()) / 60_000) : 0;
    acc[zone].maxWaitMin = Math.max(acc[zone].maxWaitMin, waitMin);
    return acc;
  }, {});

  // Nur Zonen mit ≥2 Bestellungen → Bündeln lohnt sich
  const bundlable = Object.entries(byZone)
    .filter(([, { orders: zos }]) => zos.length >= 2)
    .sort((a, b) => b[1].orders.length - a[1].orders.length);

  if (bundlable.length === 0) return null;

  const freeDrivers = onlineDrivers.filter((d) => !d.aktueller_batch_id);
  const totalBundlable = bundlable.reduce((s, [, { orders: zos }]) => s + zos.length, 0);
  const savingMin = Math.round(bundlable.reduce((s, [, { orders: zos }]) => s + (zos.length - 1) * 7, 0));

  return (
    <div className="rounded-xl border-2 border-matcha-300 bg-matcha-50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <RouteIcon className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Bündelungs-Empfehlung · {totalBundlable} Bestellungen · ~{savingMin} Min gespart
        </span>
        {freeDrivers.length > 0 && (
          <span className="ml-auto text-[10px] font-bold text-matcha-600">
            {freeDrivers.length} freier Fahrer
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {bundlable.map(([zone, { orders: zos, maxWaitMin }]) => {
          const zm = zoneMeta(zone);
          const urgent = maxWaitMin >= 8;
          const totalEur = zos.reduce((s, o) => s + o.gesamtbetrag, 0);
          return (
            <button
              key={zone}
              type="button"
              onClick={() => onSelectZone?.(zone)}
              title={onSelectZone ? `Alle ${zos.length} Bestellungen in Zone ${zone} auswählen` : undefined}
              className={cn(
                'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs text-left transition',
                urgent ? 'border-red-300 bg-red-50 hover:bg-red-100' : 'border-matcha-200 bg-white hover:bg-matcha-50',
                onSelectZone && 'cursor-pointer active:scale-[0.97]',
              )}
            >
              <span className={cn('rounded px-2 py-0.5 text-[11px] font-black', zm.cls)}>
                Zone {zone}
              </span>
              <span className="font-bold">{zos.length}×</span>
              <span className="text-muted-foreground">{euro(totalEur)}</span>
              {maxWaitMin > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  urgent ? 'bg-red-500 text-white animate-pulse' : 'bg-muted text-muted-foreground',
                )}>
                  max {maxWaitMin}m
                </span>
              )}
              <span className="rounded-full bg-matcha-100 text-matcha-800 px-1.5 py-0.5 text-[9px] font-bold">
                {onSelectZone ? '→ Alle wählen' : '→ 1 Tour'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ LiveDriverMapPanel ------------------------------ */

function LiveDriverMapPanel({
  drivers,
  batches,
  orders,
  restaurantLat,
  restaurantLng,
  locationId,
}: {
  drivers: Driver[];
  batches: Batch[];
  orders: ReadyOrder[];
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [trails, setTrails] = useState<import('./driver-map').DriverTrail[]>([]);
  const [hotspots, setHotspots] = useState<HotspotMarker[]>([]);
  const [showHotspots, setShowHotspots] = useState(true);

  useEffect(() => {
    if (!open || !locationId) return;
    let cancelled = false;
    const load = () => {
      fetch(`/api/delivery/admin/gps-trails?location_id=${locationId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d: { drivers?: { driver_id: string; trail_points: { lat: number; lng: number }[] }[] } | null) => {
          if (cancelled || !d?.drivers) return;
          setTrails(
            d.drivers
              .filter((dr) => dr.trail_points.length >= 2)
              .map((dr) => ({ driverId: dr.driver_id, points: dr.trail_points })),
          );
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [open, locationId]);

  // Geo-Cluster Hotspots laden (für Karten-Overlay)
  useEffect(() => {
    if (!open || !locationId) return;
    let cancelled = false;
    const loadHotspots = () => {
      fetch(`/api/delivery/admin/geo-clustering?action=hotspots&limit=5&location_id=${locationId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d: { hotspots?: { id: string; cluster_idx: number; center_lat: number; center_lng: number; radius_km: number; order_count: number; peak_hour: number | null; demand_score: number; label: string | null }[] } | null) => {
          if (cancelled || !d?.hotspots) return;
          setHotspots(d.hotspots.map((h) => ({
            id: h.id,
            lat: h.center_lat,
            lng: h.center_lng,
            radius_km: h.radius_km,
            demand_score: h.demand_score,
            order_count: h.order_count,
            peak_hour: h.peak_hour,
            label: h.label,
          })));
        })
        .catch(() => {});
    };
    loadHotspots();
    const iv = setInterval(loadHotspots, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [open, locationId]);

  const onlineWithGps = drivers.filter((d) => d.ist_online && d.last_lat && d.last_lng);
  if (onlineWithGps.length === 0) return null;

  const driverMarkers = onlineWithGps.map((d) => {
    const batch = batches.find((b) => b.fahrer_id === d.employee_id || b.id === d.aktueller_batch_id);
    const total = batch?.stops.length ?? 0;
    const done = batch?.stops.filter((s) => s.geliefert_am).length ?? 0;
    const state: 'frei' | 'unterwegs' | 'zurueck' =
      !batch ? 'frei' : total > 0 && done === total ? 'zurueck' : 'unterwegs';
    return {
      id: d.employee_id,
      name: `${d.employee?.vorname ?? ''} ${d.employee?.nachname ?? ''}`.trim(),
      lat: d.last_lat!,
      lng: d.last_lng!,
      state,
      stopCount: total,
      doneCount: done,
    };
  });

  const orderMarkers = batches.flatMap((b) =>
    b.stops.map((s) => {
      const o = orders.find((x) => x.id === s.order_id);
      if (!o?.kunde_lat || !o?.kunde_lng) return null;
      return {
        id: s.id,
        name: o.kunde_name,
        lat: o.kunde_lat,
        lng: o.kunde_lng,
        done: !!s.geliefert_am,
        seq: s.reihenfolge,
      };
    }).filter(Boolean) as { id: string; name: string; lat: number; lng: number; done: boolean; seq: number }[],
  );

  // Unassigned: fertige Bestellungen die NICHT in einem aktiven Batch sind
  const assignedOrderIds = new Set(batches.flatMap((b) => b.stops.map((s) => s.order_id)));
  const unassignedMarkers = orders
    .filter((o) => o.kunde_lat && o.kunde_lng && !assignedOrderIds.has(o.id))
    .map((o) => ({
      id: o.id,
      name: o.kunde_name,
      lat: o.kunde_lat!,
      lng: o.kunde_lng!,
      zone: o.delivery_zone,
      waitMin: o.fertig_am ? Math.floor((Date.now() - new Date(o.fertig_am).getTime()) / 60_000) : undefined,
    }));

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Karte</span>
          <Badge variant="secondary">{onlineWithGps.length} aktiv</Badge>
          {unassignedMarkers.length > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {unassignedMarkers.length} unzugewiesen
            </Badge>
          )}
          {hotspots.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowHotspots((v) => !v); }}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition',
                showHotspots
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-muted text-muted-foreground border-transparent',
              )}
              title="Hotspot-Zonen ein/ausblenden"
            >
              <Crosshair className="h-2.5 w-2.5" />
              {hotspots.length} Hotspots
            </button>
          )}
          <div className="flex gap-1 ml-1">
            {driverMarkers.map((d) => (
              <span
                key={d.id}
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  d.state === 'frei' ? 'bg-green-500' :
                  d.state === 'zurueck' ? 'bg-blue-500' :
                  'bg-orange-500',
                )}
              />
            ))}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="h-[360px] border-t">
          <DispatchDriverMap
            drivers={driverMarkers}
            orders={orderMarkers}
            unassigned={unassignedMarkers}
            restaurantLat={restaurantLat}
            restaurantLng={restaurantLng}
            trails={trails}
            hotspots={hotspots}
            showHotspots={showHotspots}
          />
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ DispatchScoreSummary ------------------------------ */

function DispatchScoreSummary({ orders, batches }: { orders: ReadyOrder[]; batches: Batch[] }) {
  if (orders.length === 0 && batches.length === 0) return null;

  const scored = orders.filter((o) => o.dispatch_score != null);
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, o) => s + (o.dispatch_score ?? 0), 0) / scored.length)
    : null;

  const zoneCounts: Record<string, number> = {};
  for (const o of orders) {
    if (o.delivery_zone) zoneCounts[o.delivery_zone] = (zoneCounts[o.delivery_zone] ?? 0) + 1;
  }
  const zones = Object.entries(zoneCounts).sort((a, b) => a[0].localeCompare(b[0]));

  const totalStops = batches.reduce((s, b) => s + b.stops.length, 0);
  const doneStops = batches.reduce((s, b) => s + b.stops.filter((st) => st.geliefert_am).length, 0);
  const tourProgress = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : null;

  const tiers = {
    excellent: scored.filter((o) => (o.dispatch_score ?? 0) >= 80).length,
    good:      scored.filter((o) => (o.dispatch_score ?? 0) >= 60 && (o.dispatch_score ?? 0) < 80).length,
    fair:      scored.filter((o) => (o.dispatch_score ?? 0) >= 40 && (o.dispatch_score ?? 0) < 60).length,
    low:       scored.filter((o) => (o.dispatch_score ?? 0) < 40).length,
  };

  const urgent = orders.filter((o) => o.fertig_am && (Date.now() - new Date(o.fertig_am).getTime()) > 10 * 60_000);

  // Bündelungsrate aus aktiven Touren
  const bundledStops = batches.filter((b) => b.stops.length > 1).reduce((s, b) => s + b.stops.length, 0);
  const singleStops = batches.filter((b) => b.stops.length === 1).length;
  const totalBatchStops = bundledStops + singleStops;
  const bundlingRate = totalBatchStops > 0 ? Math.round((bundledStops / totalBatchStops) * 100) : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Avg Score Gauge — SVG Halbkreis-Anzeige mit Note */}
      {avgScore !== null && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ø Dispatch-Score</div>
          </div>
          <div className="flex items-center justify-center">
            <ScoreArcGauge score={avgScore} />
          </div>
          {scored.length > 0 && (
            <div className="mt-3">
              <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                {tiers.excellent > 0 && <div className="bg-matcha-500" style={{ width: `${(tiers.excellent / scored.length) * 100}%` }} />}
                {tiers.good > 0 && <div className="bg-blue-400" style={{ width: `${(tiers.good / scored.length) * 100}%` }} />}
                {tiers.fair > 0 && <div className="bg-orange-400" style={{ width: `${(tiers.fair / scored.length) * 100}%` }} />}
                {tiers.low > 0 && <div className="bg-red-400" style={{ width: `${(tiers.low / scored.length) * 100}%` }} />}
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
                <span className="text-matcha-700 font-bold">{tiers.excellent} A+</span>
                <span className="text-blue-600 font-bold">{tiers.good} B</span>
                <span className="text-orange-600 font-bold">{tiers.fair} C</span>
                <span className="text-red-600 font-bold">{tiers.low} F</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Zone Breakdown */}
      {zones.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Zonen-Verteilung</div>
          </div>
          <div className="space-y-1.5">
            {zones.map(([zone, count]) => {
              const pct = Math.round((count / orders.length) * 100);
              return (
                <div key={zone} className="flex items-center gap-2">
                  <span className={cn('w-5 text-center rounded text-[10px] font-black shrink-0', zoneMeta(zone).cls)}>{zone}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', zoneMeta(zone).barCls)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Tour Progress */}
      {tourProgress !== null && batches.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tour-Fortschritt</div>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <div className="font-display text-3xl font-black leading-none text-matcha-700">{tourProgress}%</div>
            <div className="text-xs text-muted-foreground mb-0.5">{doneStops}/{totalStops} Stopps</div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', tourProgress === 100 ? 'bg-matcha-500' : tourProgress > 60 ? 'bg-orange-400' : 'bg-blue-400')}
              style={{ width: `${tourProgress}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">{batches.length} aktive Tour{batches.length !== 1 ? 'en' : ''}</div>
        </Card>
      )}

      {/* Revenue on Route */}
      {(() => {
        const onRouteOrders = orders.filter((o) => o.status === 'unterwegs');
        const readyTotal = orders.filter((o) => o.status === 'fertig').reduce((s, o) => s + o.gesamtbetrag, 0);
        const onRouteTotal = onRouteOrders.reduce((s, o) => s + o.gesamtbetrag, 0);
        const combined = readyTotal + onRouteTotal;
        if (combined === 0) return null;
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="h-4 w-4 text-matcha-600" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Umsatz unterwegs</div>
            </div>
            <div className="font-display text-2xl font-black leading-none text-matcha-700">{euro(combined)}</div>
            <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
              {onRouteTotal > 0 && (
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                  {euro(onRouteTotal)} liefert gerade
                </div>
              )}
              {readyTotal > 0 && (
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-matcha-400 shrink-0" />
                  {euro(readyTotal)} wartet auf Abholung
                </div>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Urgent orders */}
      {urgent.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-red-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Warten &gt;10 Min</div>
          </div>
          <div className="font-display text-3xl font-black leading-none text-red-700">{urgent.length}</div>
          <div className="mt-2 space-y-1">
            {urgent.slice(0, 3).map((o) => (
              <div key={o.id} className="text-[10px] text-red-700 font-semibold truncate">
                #{o.bestellnummer.replace('FF-', '')} · {o.kunde_name}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Bündelungsrate */}
      {bundlingRate !== null && totalBatchStops >= 2 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <RouteIcon className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bündelungsrate</div>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <div className={cn(
              'font-display text-3xl font-black leading-none',
              bundlingRate >= 70 ? 'text-matcha-700' : bundlingRate >= 40 ? 'text-orange-600' : 'text-red-600',
            )}>{bundlingRate}%</div>
            <div className="text-xs text-muted-foreground mb-0.5">gebündelt</div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', bundlingRate >= 70 ? 'bg-matcha-500' : bundlingRate >= 40 ? 'bg-orange-400' : 'bg-red-400')}
              style={{ width: `${bundlingRate}%` }}
            />
          </div>
          <div className="mt-1.5 text-[9px] text-muted-foreground">{bundledStops} gebündelt · {singleStops} einzeln</div>
        </Card>
      )}

      {/* Wartezeit-Ampel: Wie lange warten fertige Bestellungen auf Abholung? */}
      {orders.filter((o) => o.fertig_am).length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Wartezeit-Ampel</div>
          </div>
          {(() => {
            const withWait = orders.filter((o) => o.fertig_am);
            const fresh  = withWait.filter((o) => (Date.now() - new Date(o.fertig_am!).getTime()) < 5 * 60_000);
            const medium = withWait.filter((o) => { const m = (Date.now() - new Date(o.fertig_am!).getTime()) / 60_000; return m >= 5 && m < 10; });
            const old    = withWait.filter((o) => (Date.now() - new Date(o.fertig_am!).getTime()) >= 10 * 60_000);
            const maxWaitMin = withWait.length > 0
              ? Math.round(Math.max(...withWait.map((o) => (Date.now() - new Date(o.fertig_am!).getTime()) / 60_000)))
              : 0;
            const rows = [
              { label: '<5 Min',  count: fresh.length,  cls: 'bg-matcha-500', textCls: 'text-matcha-700' },
              { label: '5–10 Min', count: medium.length, cls: 'bg-orange-400', textCls: 'text-orange-700' },
              { label: '>10 Min', count: old.length,    cls: 'bg-red-500',    textCls: 'text-red-700' },
            ];
            return (
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="w-14 text-right text-[9px] font-bold text-muted-foreground tabular-nums shrink-0">{r.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', r.cls)}
                        style={{ width: withWait.length > 0 ? `${(r.count / withWait.length) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className={cn('w-4 text-[10px] font-black tabular-nums shrink-0', r.textCls)}>{r.count}</span>
                  </div>
                ))}
                {maxWaitMin > 0 && (
                  <div className={cn('mt-1.5 text-[9px] text-right tabular-nums font-bold', maxWaitMin >= 10 ? 'text-red-600' : 'text-muted-foreground')}>
                    Längste Wartezeit: {maxWaitMin} Min
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Score-Verteilung Histogramm */}
      {scored.length >= 2 && (
        <Card className="p-4 sm:col-span-2 lg:col-span-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-matcha-600" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score-Verteilung · {scored.length} Bestellungen</div>
            {avgScore !== null && (
              <span className={cn(
                'ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-black tabular-nums',
                avgScore >= 80 ? 'bg-matcha-100 text-matcha-800' :
                avgScore >= 60 ? 'bg-blue-100 text-blue-800' :
                avgScore >= 40 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800',
              )}>
                Ø {avgScore}
              </span>
            )}
          </div>
          <div className="flex items-end gap-1 h-16">
            {[
              { lo: 0,  hi: 20,  label: '0–20',  cls: 'bg-red-400',     textCls: 'text-red-700' },
              { lo: 20, hi: 40,  label: '20–40', cls: 'bg-orange-400',  textCls: 'text-orange-700' },
              { lo: 40, hi: 60,  label: '40–60', cls: 'bg-amber-400',   textCls: 'text-amber-700' },
              { lo: 60, hi: 80,  label: '60–80', cls: 'bg-blue-400',    textCls: 'text-blue-700' },
              { lo: 80, hi: 101, label: '80–100',cls: 'bg-matcha-500',  textCls: 'text-matcha-700' },
            ].map((bucket) => {
              const count = scored.filter((o) => {
                const sc = o.dispatch_score ?? 0;
                return sc >= bucket.lo && sc < bucket.hi;
              }).length;
              const maxBucketCount = Math.max(
                ...([0,20,40,60,80].map((lo, _, arr) => {
                  const hi = lo + 20 === 100 ? 101 : lo + 20;
                  return scored.filter((o) => {
                    const sc = o.dispatch_score ?? 0;
                    return sc >= lo && sc < hi;
                  }).length;
                })),
                1,
              );
              const barPct = Math.round((count / maxBucketCount) * 100);
              return (
                <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  {count > 0 && (
                    <span className={cn('text-[9px] font-black tabular-nums', bucket.textCls)}>{count}</span>
                  )}
                  <div className="w-full flex items-end" style={{ height: '44px' }}>
                    <div
                      className={cn('w-full rounded-t transition-all duration-500', bucket.cls, count === 0 && 'opacity-20')}
                      style={{ height: `${Math.max(count === 0 ? 6 : 20, barPct * 0.44)}px` }}
                    />
                  </div>
                  <span className="text-[8px] text-muted-foreground tabular-nums leading-none">{bucket.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function Metric({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number | string; highlight?: 'green' | 'amber' | 'red' }) {
  const valColor = highlight === 'green' ? 'text-matcha-600' : highlight === 'amber' ? 'text-amber-600' : highlight === 'red' ? 'text-red-600' : undefined;
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn('font-display text-sm font-bold leading-none', valColor)}>{value}</div>
      </div>
    </div>
  );
}

/* ── ReadyOrderWaitHeatmap ─────────────────────────────────────────────────────
   Zeigt Wartezeit-Verteilung der fertigen Bestellungen als farbkodierte Balken.
   Jeder Balken = eine Bestellung, Farbe = Wartedauer.
────────────────────────────────────────────────────────────────────────────── */
function ReadyOrderWaitHeatmap({ orders }: { orders: { fertig_am: string | null; bestellnummer: string }[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (orders.length === 0) return null;

  const now = Date.now();
  const buckets = [
    { label: '<5m',  max: 5,  color: 'bg-matcha-400', text: 'text-matcha-700' },
    { label: '5-10m', max: 10, color: 'bg-amber-400',  text: 'text-amber-700' },
    { label: '10-15m',max: 15, color: 'bg-orange-500', text: 'text-orange-700' },
    { label: '>15m',  max: Infinity, color: 'bg-red-500', text: 'text-red-700' },
  ];

  const counts = buckets.map((b, i) => {
    const prev = i > 0 ? buckets[i - 1].max : 0;
    return orders.filter((o) => {
      if (!o.fertig_am) return i === 0;
      const min = (now - new Date(o.fertig_am).getTime()) / 60_000;
      return min >= prev && min < b.max;
    }).length;
  });

  const hasUrgent = counts[2] > 0 || counts[3] > 0;

  return (
    <div className={cn(
      'flex items-center gap-3 border-b px-5 py-2',
      hasUrgent ? 'bg-red-50' : 'bg-muted/30',
    )}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">Wartezeit</span>
      <div className="flex-1 flex items-center gap-1 min-w-0">
        {orders.map((o) => {
          const min = o.fertig_am ? (now - new Date(o.fertig_am).getTime()) / 60_000 : 0;
          const bIdx = min < 5 ? 0 : min < 10 ? 1 : min < 15 ? 2 : 3;
          const b = buckets[bIdx];
          return (
            <div
              key={o.bestellnummer}
              className={cn('h-3 w-3 rounded-sm shrink-0', b.color, bIdx >= 2 && 'animate-pulse')}
              title={`${o.bestellnummer}: ${Math.round(min)} Min warten`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {buckets.map((b, i) => counts[i] > 0 && (
          <span key={b.label} className={cn('text-[9px] font-black tabular-nums', b.text)}>
            {counts[i]}×{b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function OrderRow({
  order,
  selected,
  onToggle,
  onScoreClick,
}: {
  order: ReadyOrder;
  selected: boolean;
  onToggle: () => void;
  onScoreClick?: (order: ReadyOrder) => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const pay = payMeta(order.zahlungsart);
  const waitingMin = order.fertig_am
    ? Math.floor((Date.now() - new Date(order.fertig_am).getTime()) / 60_000)
    : null;
  const waitingSec = order.fertig_am
    ? Math.floor((Date.now() - new Date(order.fertig_am).getTime()) / 1_000)
    : null;
  const urgent = waitingMin !== null && waitingMin >= 10;

  // Live ETA countdown — how long until customer's expected delivery window
  const etaSec = order.eta_earliest
    ? Math.floor((new Date(order.eta_earliest).getTime() - Date.now()) / 1_000)
    : null;
  const etaOverdue = etaSec !== null && etaSec < 0;
  const etaSoon = etaSec !== null && etaSec >= 0 && etaSec < 900; // <15 min

  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-muted/40',
        selected && 'bg-matcha-50',
      )}
    >
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition',
          selected ? 'border-matcha-600 bg-matcha-600 text-white' : 'border-border bg-transparent',
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-bold tracking-wide text-matcha-700">
            {order.bestellnummer.replace('FF-', '')}
          </span>
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', pay.cls)}>
            {pay.icon} {pay.label}
          </span>
          {order.delivery_zone && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', zoneMeta(order.delivery_zone).cls)}>
              {order.delivery_zone}
            </span>
          )}
          {order.dispatch_score != null && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onScoreClick?.(order); }}
              title="Score-Aufschlüsselung anzeigen"
              className={cn('inline-flex flex-col gap-0.5 items-start cursor-pointer hover:opacity-80 transition', scoreMeta(order.dispatch_score).cls)}
            >
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', scoreMeta(order.dispatch_score).cls)}>
                ⚡ {Math.round(order.dispatch_score)}
              </span>
              <span className="inline-block h-1 w-14 rounded-full overflow-hidden bg-black/10">
                <span
                  className={cn(
                    'block h-full rounded-full transition-all',
                    order.dispatch_score >= 80 ? 'bg-matcha-500' :
                    order.dispatch_score >= 60 ? 'bg-blue-400' :
                    order.dispatch_score >= 40 ? 'bg-orange-400' : 'bg-red-400',
                  )}
                  style={{ width: `${order.dispatch_score}%` }}
                />
              </span>
            </button>
          )}
          <DispatchScoreBar score={order.dispatch_score} />
          {order.external_source && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-matcha-900">
              {order.external_source}
            </span>
          )}
          {!urgent && waitingMin !== null && waitingMin >= 3 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 tabular-nums">
              wartet {waitingMin}m
            </span>
          )}
          {urgent && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 animate-pulse">
              wartet {waitingMin}m
            </span>
          )}
          {etaOverdue && (
            <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-bold animate-pulse">
              ETA überzogen!
            </span>
          )}
          {etaSoon && !etaOverdue && etaSec !== null && (
            <span className="rounded-full bg-orange-100 text-orange-800 px-2 py-0.5 text-[10px] font-bold tabular-nums">
              ETA in {Math.floor(etaSec / 60)}:{String(etaSec % 60).padStart(2, '0')}
            </span>
          )}
          {order.eta_earliest && order.eta_latest && (() => {
            const fmt = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            return (
              <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[9px] font-medium tabular-nums">
                {fmt(order.eta_earliest)}–{fmt(order.eta_latest)}
              </span>
            );
          })()}
          {/* Urgency ring: visual priority indicator based on dispatch_score */}
          {order.dispatch_score != null && order.dispatch_score >= 70 && (
            <span className={cn(
              'h-2 w-2 rounded-full shrink-0',
              order.dispatch_score >= 90 ? 'bg-red-500 animate-ping' :
              order.dispatch_score >= 80 ? 'bg-orange-500' : 'bg-amber-400',
            )} title={`Score: ${Math.round(order.dispatch_score)}`} />
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-semibold">{order.kunde_name}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {order.kunde_adresse}
            {order.kunde_plz ? `, ${order.kunde_plz}` : ''}
          </span>
        </div>
        {(order.kunde_notiz || order.kunde_lieferhinweis) && (
          <div className="mt-1 flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
            <span className="text-[10px] text-amber-800 leading-snug line-clamp-1">
              {order.kunde_notiz ?? order.kunde_lieferhinweis}
            </span>
          </div>
        )}
      </div>

      <div className="text-right">
        <div className="font-display text-sm font-bold">{euro(order.gesamtbetrag)}</div>
        {waitingSec !== null && (
          <div className={cn(
            'mt-0.5 flex items-center justify-end gap-1 text-[10px] tabular-nums',
            urgent ? 'text-red-600 font-bold' : 'text-muted-foreground',
          )}>
            <Clock className="h-3 w-3" />
            {Math.floor(waitingSec / 60)}:{String(waitingSec % 60).padStart(2, '0')}
          </div>
        )}
      </div>
    </button>
  );
}

type ActiveBatchRef = Pick<Batch, 'startzeit' | 'total_eta_min' | 'stops'>;

function DriverRow({
  driver,
  activeBatch,
  canAssign,
  busy,
  onAssign,
  restaurantLat,
  restaurantLng,
  shiftStats,
}: {
  driver: Driver;
  activeBatch?: ActiveBatchRef | null;
  canAssign: boolean;
  busy: boolean;
  onAssign: () => void;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  shiftStats?: { stops: number; onTime: number; timed: number } | null;
}) {
  const e = driver.employee;
  const initials = e ? `${e.vorname?.[0] ?? ''}${e.nachname?.[0] ?? ''}`.toUpperCase() : '?';
  const vehicleEmoji: Record<string, string> = { bike: '🚲', ebike: '🛵', scooter: '🛴', auto: '🚗' };
  const lastSeen = driver.last_update ? Math.floor((Date.now() - new Date(driver.last_update).getTime()) / 60_000) : null;

  // Live tick for countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!driver.ist_online) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [driver.ist_online]);
  const onlineSince = driver.online_seit
    ? Math.floor((Date.now() - new Date(driver.online_seit).getTime()) / 60_000)
    : null;

  // Return-time estimate from active batch
  const returnInfo = (() => {
    if (!activeBatch?.startzeit || activeBatch.total_eta_min == null) return null;
    const etaMs = new Date(activeBatch.startzeit).getTime() + activeBatch.total_eta_min * 60_000;
    const secLeft = Math.floor((etaMs - Date.now()) / 1000);
    if (secLeft < -600) return null;
    const doneStops = activeBatch.stops.filter((s) => s.geliefert_am).length;
    const totalStops = activeBatch.stops.length;
    const remainingStops = totalStops - doneStops;
    const returnStr = new Date(Math.max(etaMs, Date.now())).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { secLeft, returnStr, remainingStops, totalStops, doneStops };
  })();

  // Entfernung zum Abholort — nur für freie Fahrer mit GPS
  const distToRestaurant = (() => {
    if (activeBatch) return null;
    if (!driver.ist_online || driver.last_lat == null || driver.last_lng == null) return null;
    if (restaurantLat == null || restaurantLng == null) return null;
    const km = haversineKm(
      { lat: driver.last_lat, lng: driver.last_lng },
      { lat: restaurantLat, lng: restaurantLng },
    );
    const walkMinEstimate = Math.round((km / 15) * 60); // 15 km/h als Fahrad-Tempo
    return { km, walkMinEstimate };
  })();

  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
          {/* Tour-Fortschritts-Ring: SVG-Overlay wenn Fahrer unterwegs */}
          {returnInfo && returnInfo.totalStops > 0 && (
            <svg className="absolute inset-0 -rotate-90" width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
              <circle
                cx="22" cy="22" r="19"
                fill="none"
                stroke={returnInfo.secLeft !== null && returnInfo.secLeft <= 0 ? '#22c55e' : returnInfo.secLeft !== null && returnInfo.secLeft < 300 ? '#f97316' : '#3b82f6'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 19}`}
                strokeDashoffset={`${2 * Math.PI * 19 * (1 - returnInfo.doneStops / returnInfo.totalStops)}`}
                style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s' }}
              />
            </svg>
          )}
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-matcha-700 font-display text-sm font-bold text-white">
            {initials}
          </div>
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background',
              driver.ist_online ? 'bg-matcha-500' : 'bg-muted',
            )}
          >
            {driver.ist_online ? <Wifi className="h-2 w-2 text-white" /> : <WifiOff className="h-2 w-2 text-white" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{e?.vorname} {e?.nachname}</span>
            <span>{vehicleEmoji[driver.fahrzeug] ?? '🚲'}</span>
            {driver.aktueller_batch_id && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Unterwegs</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {driver.ist_online ? (
              <>
                <span className="flex items-center gap-1">
                  <Radio className="h-3 w-3 text-matcha-500" /> online
                </span>
                {onlineSince !== null && <span>· {onlineSince} Min</span>}
                {lastSeen !== null && lastSeen > 5 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                    lastSeen > 15 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700',
                  )}>
                    GPS vor {lastSeen}m
                  </span>
                )}
                {distToRestaurant && (
                  <span className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                    distToRestaurant.km < 0.5 ? 'bg-matcha-100 text-matcha-800' :
                    distToRestaurant.km < 2 ? 'bg-blue-50 text-blue-700' :
                    'bg-muted text-muted-foreground',
                  )} title={`~${distToRestaurant.walkMinEstimate} Min zum Restaurant`}>
                    <MapPin className="h-2.5 w-2.5" />
                    {distToRestaurant.km < 1 ? `${Math.round(distToRestaurant.km * 1000)} m` : `${distToRestaurant.km.toFixed(1)} km`}
                  </span>
                )}
              </>
            ) : (
              <span>offline</span>
            )}
          </div>
        </div>
        {e?.telefon && driver.ist_online && (
          <div className="flex items-center gap-1">
            <a
              href={`tel:${e.telefon}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/70 text-muted-foreground"
              title="Anrufen"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
            {(() => {
              const raw = e.telefon!.replace(/\s+/g, '').replace(/[^\d+]/g, '');
              const intl = raw.startsWith('+') ? raw.slice(1) : raw.startsWith('00') ? raw.slice(2) : raw.startsWith('0') ? '49' + raw.slice(1) : '49' + raw;
              const driverName = `${e.vorname} ${e.nachname}`.trim();
              const msg = encodeURIComponent(`Hallo ${e.vorname}! Bitte melde dich kurz beim Dispatch. 🙏`);
              return (
                <a
                  href={`https://wa.me/${intl}?text=${msg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366]"
                  title={`WhatsApp an ${driverName}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </a>
              );
            })()}
          </div>
        )}
        {canAssign && (
          <Button size="sm" onClick={onAssign} disabled={busy}>
            Zuweisen
          </Button>
        )}
      </div>

      {/* Return countdown for active batch */}
      {returnInfo && (
        <div className="mt-2 pl-[52px]">
          <div className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold',
            returnInfo.secLeft <= 0
              ? 'bg-matcha-100 text-matcha-800 animate-pulse'
              : returnInfo.secLeft < 300
              ? 'bg-orange-100 text-orange-800'
              : 'bg-blue-50 text-blue-700',
          )}>
            <Clock className="h-3 w-3" />
            {returnInfo.secLeft <= 0
              ? `Kommt zurück · ${returnInfo.doneStops}/${returnInfo.totalStops} Stopps`
              : `Zurück ~${returnInfo.returnStr} · ${returnInfo.remainingStops} Stopp${returnInfo.remainingStops !== 1 ? 's' : ''} offen`}
          </div>
          {returnInfo.totalStops > 0 && (
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden" style={{ width: 180 }}>
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  returnInfo.secLeft <= 0 ? 'bg-matcha-500' :
                  returnInfo.secLeft < 300 ? 'bg-orange-400' :
                  'bg-blue-400',
                )}
                style={{ width: `${(returnInfo.doneStops / returnInfo.totalStops) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Schicht-Score-Badge: Lieferungen + SLA-Pünktlichkeit dieser Schicht */}
      {shiftStats && shiftStats.stops > 0 && (
        <div className="mt-1.5 pl-[52px] flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-matcha-50 border border-matcha-200 px-2 py-0.5 text-[9px] font-bold text-matcha-700">
            <CheckCircle2 className="h-2.5 w-2.5" />
            {shiftStats.stops} Ld.
          </span>
          {shiftStats.timed > 0 && (() => {
            const pct = Math.round((shiftStats.onTime / shiftStats.timed) * 100);
            return (
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                pct >= 85 ? 'bg-matcha-50 border-matcha-200 text-matcha-700' :
                pct >= 70 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                'bg-red-50 border-red-200 text-red-700',
              )}>
                <Target className="h-2.5 w-2.5" />
                SLA {pct}%
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ EnRouteEtaStrip ------------------------------ */

function EnRouteEtaStrip({ orders }: { orders: ReadyOrder[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const enriched = orders
    .filter((o) => o.eta_earliest || o.eta_latest)
    .map((o) => {
      const etaMs = o.eta_earliest ? new Date(o.eta_earliest).getTime() : null;
      const etaLatestMs = o.eta_latest ? new Date(o.eta_latest).getTime() : null;
      const secLeft = etaMs ? Math.floor((etaMs - now) / 1000) : null;
      const etaStr = etaMs ? new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
      const overdue = secLeft !== null && secLeft < 0;
      const imminent = !overdue && secLeft !== null && secLeft < 300;
      return { ...o, etaMs, etaLatestMs, secLeft, etaStr, overdue, imminent };
    })
    .sort((a, b) => (a.etaMs ?? 0) - (b.etaMs ?? 0));

  if (enriched.length === 0) return null;

  const overdueCount = enriched.filter((o) => o.overdue).length;
  const imminentCount = enriched.filter((o) => o.imminent).length;

  return (
    <div className={cn(
      'rounded-xl border p-3',
      overdueCount > 0 ? 'border-red-300 bg-red-50' :
      imminentCount > 0 ? 'border-orange-300 bg-orange-50' :
      'border-matcha-200 bg-matcha-50',
    )}>
      <div className="mb-2 flex items-center gap-2">
        <Truck className={cn('h-4 w-4', overdueCount > 0 ? 'text-red-600' : imminentCount > 0 ? 'text-orange-600' : 'text-matcha-700')} />
        <span className={cn(
          'font-display text-xs font-bold uppercase tracking-wider',
          overdueCount > 0 ? 'text-red-800' : imminentCount > 0 ? 'text-orange-800' : 'text-matcha-800',
        )}>
          {enriched.length} Unterwegs
          {overdueCount > 0 && ` · ${overdueCount} überzogen`}
          {imminentCount > 0 && !overdueCount && ` · ${imminentCount} gleich da`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {enriched.map((o) => {
          const zm = zoneMeta(o.delivery_zone ?? '');
          return (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-[11px] min-w-[160px]',
                o.overdue ? 'border-red-400 bg-red-100 animate-pulse' :
                o.imminent ? 'border-orange-400 bg-orange-100' :
                'border-matcha-200 bg-white',
              )}
            >
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-mono font-bold text-foreground">#{o.bestellnummer.replace('FF-', '')}</span>
                  {o.delivery_zone && (
                    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-black', zm.cls)}>{o.delivery_zone}</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{o.kunde_name}</div>
              </div>
              <div className="ml-auto text-right">
                {o.etaStr && (
                  <div className={cn(
                    'font-mono font-black tabular-nums text-sm',
                    o.overdue ? 'text-red-700' : o.imminent ? 'text-orange-700' : 'text-matcha-700',
                  )}>
                    {o.etaStr}
                  </div>
                )}
                {o.secLeft !== null && (
                  <div className={cn(
                    'text-[9px] font-bold tabular-nums',
                    o.overdue ? 'text-red-600' : o.imminent ? 'text-orange-600' : 'text-muted-foreground',
                  )}>
                    {o.overdue
                      ? `+${Math.floor(-o.secLeft / 60)}:${String((-o.secLeft) % 60).padStart(2, '0')}`
                      : `${Math.floor(o.secLeft / 60)}:${String(o.secLeft % 60).padStart(2, '0')} noch`}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ SmartAssignCard ------------------------------ */

function SmartAssignCard({
  orders,
  drivers,
  batches,
  onSelectOrders,
}: {
  orders: ReadyOrder[];
  drivers: Driver[];
  batches: Batch[];
  onSelectOrders: (orderIds: string[], driverId: string) => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const busyIds = new Set(batches.map((b) => b.fahrer_id).filter(Boolean));
  const freeDrivers = drivers.filter((d) => d.ist_online && !busyIds.has(d.employee_id));
  const readyDelivery = orders.filter((o) => o.status === 'fertig' && o.delivery_zone);

  if (freeDrivers.length === 0 || readyDelivery.length === 0) return null;

  // Group orders by zone
  const byZone = readyDelivery.reduce<Record<string, ReadyOrder[]>>((acc, o) => {
    const z = o.delivery_zone!;
    if (!acc[z]) acc[z] = [];
    acc[z].push(o);
    return acc;
  }, {});

  // For each zone, compute centroid
  const zones = Object.entries(byZone).map(([zone, zOrders]) => {
    const lats = zOrders.map((o) => o.kunde_lat).filter((x): x is number => x != null);
    const lngs = zOrders.map((o) => o.kunde_lng).filter((x): x is number => x != null);
    const lat = lats.length > 0 ? lats.reduce((a, b) => a + b, 0) / lats.length : 0;
    const lng = lngs.length > 0 ? lngs.reduce((a, b) => a + b, 0) / lngs.length : 0;
    const maxWaitMin = zOrders.reduce((m, o) => {
      const w = o.fertig_am ? Math.floor((Date.now() - new Date(o.fertig_am).getTime()) / 60_000) : 0;
      return Math.max(m, w);
    }, 0);
    return { zone, orders: zOrders, lat, lng, maxWaitMin };
  });

  // Score each driver-zone pair: lower km + more orders + urgency
  type Rec = { driver: Driver; zone: string; orders: ReadyOrder[]; distKm: number; score: number; maxWaitMin: number };
  const recommendations: Rec[] = [];
  for (const freeDriver of freeDrivers) {
    for (const z of zones) {
      if (!freeDriver.last_lat || !freeDriver.last_lng || !z.lat || !z.lng) continue;
      const distKm = haversineKm(
        { lat: freeDriver.last_lat, lng: freeDriver.last_lng },
        { lat: z.lat, lng: z.lng },
      );
      // Score: more orders → better, less dist → better, more wait → urgent
      const score = z.orders.length * 20 - distKm * 5 + z.maxWaitMin * 3;
      const ordersToAssign = z.orders.slice(0, 3); // max 3 per tour
      recommendations.push({ driver: freeDriver, zone: z.zone, orders: ordersToAssign, distKm, score, maxWaitMin: z.maxWaitMin });
    }
  }
  recommendations.sort((a, b) => b.score - a.score);

  const top = recommendations.slice(0, 2);
  if (top.length === 0) return null;

  return (
    <Card className="overflow-hidden border-matcha-300 bg-matcha-50">
      <div className="flex items-center gap-2 border-b border-matcha-200 px-4 py-3">
        <Zap className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Empfohlene Zuweisung
        </span>
        <span className="ml-auto text-[10px] text-matcha-500">AI-Score</span>
      </div>
      <div className="space-y-2 p-3">
        {top.map((rec, i) => {
          const driverName = rec.driver.employee
            ? `${rec.driver.employee.vorname} ${rec.driver.employee.nachname?.charAt(0) ?? ''}.`
            : `Fahrer ${i + 1}`;
          const zm = zoneMeta(rec.zone);
          const urgency = rec.maxWaitMin >= 10 ? 'animate-pulse border-red-400 bg-red-50' : 'border-matcha-200 bg-white';
          return (
            <div key={`${rec.driver.employee_id}-${rec.zone}`} className={`rounded-xl border-2 p-3 ${urgency}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-black', zm.cls)}>
                  Zone {rec.zone}
                </span>
                <span className="text-xs font-bold text-foreground">{driverName}</span>
                <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                  {rec.distKm.toFixed(1)} km
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {rec.orders.map((o) => (
                  <span key={o.id} className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-0.5 text-[10px] font-semibold">
                    <span className="font-mono">#{o.bestellnummer.replace('FF-', '')}</span>
                    <span className="text-muted-foreground">{o.kunde_name.split(' ')[0]}</span>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {rec.maxWaitMin > 0 && (
                  <span className={cn(
                    'text-[9px] font-bold rounded-full px-2 py-0.5',
                    rec.maxWaitMin >= 10 ? 'bg-red-500 text-white' :
                    rec.maxWaitMin >= 5  ? 'bg-amber-400 text-matcha-900' :
                    'bg-muted text-muted-foreground',
                  )}>
                    max {rec.maxWaitMin}m Warte
                  </span>
                )}
                <button
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-matcha-700 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-matcha-800 active:scale-95"
                  onClick={() => onSelectOrders(rec.orders.map((o) => o.id), rec.driver.employee_id)}
                >
                  <Check className="h-3 w-3" />
                  Zuweisen
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------ ActiveTourSummaryBar ------------------------------ */

function ActiveTourSummaryBar({ batches }: { batches: Batch[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const totalStops = batches.reduce((s, b) => s + b.stops.length, 0);
  const doneStops  = batches.reduce((s, b) => s + b.stops.filter((st) => st.geliefert_am).length, 0);
  const leftStops  = totalStops - doneStops;
  const pct        = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;

  const lateBatches = batches.filter((b) => {
    if (!b.startzeit || !b.total_eta_min) return false;
    const etaMs = new Date(b.startzeit).getTime() + b.total_eta_min * 60_000;
    return etaMs < Date.now() && b.stops.some((s) => !s.geliefert_am);
  }).length;

  return (
    <div className="border-b px-4 py-3 bg-matcha-50/50">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-matcha-800 uppercase tracking-wider">
            {batches.length} Tour{batches.length !== 1 ? 'en' : ''} aktiv
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            <span className="font-bold text-matcha-700">{doneStops}</span>/{totalStops} Stops geliefert
          </span>
          {leftStops > 0 && (
            <span className="text-[11px] text-muted-foreground">
              <span className="font-bold text-blue-700">{leftStops}</span> ausstehend
            </span>
          )}
          {lateBatches > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
              ⚠ {lateBatches} überzogen
            </span>
          )}
        </div>
        <span className={cn(
          'text-[11px] font-black tabular-nums rounded-full px-2 py-0.5',
          pct === 100 ? 'bg-matcha-500 text-white' :
          pct >= 60   ? 'bg-blue-100 text-blue-800' :
                        'bg-stone-100 text-stone-700',
        )}>
          {pct}%
        </span>
      </div>
      {/* Combined progress bar with per-tour segments */}
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted">
        {batches.map((b) => {
          const bTotal = b.stops.length;
          const bDone  = b.stops.filter((s) => s.geliefert_am).length;
          const bPct   = bTotal > 0 ? (bTotal / totalStops) * 100 : 0;
          const donePct = bTotal > 0 ? (bDone / bTotal) * 100 : 0;
          return (
            <div
              key={b.id}
              className="relative rounded-sm overflow-hidden bg-muted"
              style={{ width: `${bPct}%` }}
              title={`${b.fahrer?.vorname ?? '?'}: ${bDone}/${bTotal}`}
            >
              <div
                className={cn(
                  'h-full transition-all',
                  donePct === 100 ? 'bg-matcha-500' :
                  donePct > 50   ? 'bg-blue-400' :
                                   'bg-blue-300',
                )}
                style={{ width: `${donePct}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* Per-driver mini badges */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {batches.map((b) => {
          const bTotal = b.stops.length;
          const bDone  = b.stops.filter((s) => s.geliefert_am).length;
          const name   = b.fahrer ? `${b.fahrer.vorname[0]}. ${b.fahrer.nachname}` : '—';
          return (
            <div
              key={b.id}
              className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-0.5 text-[10px] font-semibold"
              title={name}
            >
              <span className="text-muted-foreground truncate max-w-[60px]">{name}</span>
              <span className={cn(
                'rounded px-1 font-black',
                bDone === bTotal ? 'bg-matcha-100 text-matcha-700' : 'bg-blue-50 text-blue-700',
              )}>
                {bDone}/{bTotal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BatchRow({ batch }: { batch: Batch }) {
  const fahrer = batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`.trim() : 'Unbekannt';
  const total = batch.stops.length;
  const done = batch.stops.filter((s) => s.geliefert_am).length;
  const progress = total > 0 ? (done / total) * 100 : 0;

  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<{ total_eta_min?: number; total_distance_km?: number } | null>(null);

  async function handleOptimize() {
    setOptimizing(true);
    try {
      const res = await fetch(`/api/delivery/tours/${batch.id}/optimize`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (data?.ok) setOptimizeResult(data);
    } finally {
      setOptimizing(false);
    }
  }

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const etaEndMs = batch.startzeit
    ? new Date(batch.startzeit).getTime() + (batch.total_eta_min ?? 0) * 60_000
    : null;
  const etaRemainingSec = etaEndMs ? Math.floor((etaEndMs - Date.now()) / 1000) : null;
  const etaReturnStr = etaEndMs
    ? new Date(etaEndMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
            <User className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">{fahrer}</div>
            <div className="text-xs text-muted-foreground">{total} Stops · {done} geliefert</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {batch.zone && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', zoneMeta(batch.zone).cls)}>
              {batch.zone}
            </span>
          )}
          <Badge variant={batch.status === 'unterwegs' ? 'default' : 'secondary'}>{batch.status}</Badge>
        </div>
      </div>

      {/* Tour-Metriken */}
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        {batch.startzeit && (() => {
          const totalSec = Math.floor((Date.now() - new Date(batch.startzeit).getTime()) / 1000);
          const m = Math.floor(totalSec / 60);
          const s = totalSec % 60;
          return (
            <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
              <Clock className="h-3 w-3" />
              {m}:{String(s).padStart(2, '0')} unterwegs
            </span>
          );
        })()}
        {batch.total_distance_km != null && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <RouteIcon className="h-3 w-3" />
            {batch.total_distance_km.toFixed(1)} km
          </span>
        )}
        {batch.total_eta_min != null && (
          <span className="flex items-center gap-1 font-bold text-matcha-700">
            <Clock className="h-3 w-3" />
            ~{batch.total_eta_min} Min ETA
          </span>
        )}
      </div>

      {etaRemainingSec !== null && (() => {
        const totalEtaSec = (batch.total_eta_min ?? 0) * 60;
        const elapsedSec = totalEtaSec - etaRemainingSec;
        const timePct = totalEtaSec > 0 ? Math.min(100, Math.max(0, Math.round((elapsedSec / totalEtaSec) * 100))) : 0;
        const overdue = etaRemainingSec < 0;
        const r = 20;
        const circ = 2 * Math.PI * r;
        const arcColor = overdue ? '#ef4444' : timePct > 80 ? '#f97316' : timePct > 55 ? '#eab308' : '#22c55e';
        return (
          <div className="mt-2 flex items-center gap-3">
            {totalEtaSec > 0 && (
              <div className="relative flex items-center justify-center h-12 w-12 shrink-0" title={`${timePct}% der Tour-Zeit vergangen`}>
                <svg className="-rotate-90" width="48" height="48" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="4" />
                  <circle
                    cx="24" cy="24" r={r} fill="none"
                    stroke={arcColor} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - Math.min(1, timePct / 100))}
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                  />
                </svg>
                <span className="absolute text-[9px] font-black tabular-nums" style={{ color: arcColor }}>
                  {overdue ? `+${Math.floor(-etaRemainingSec / 60)}` : `${Math.floor(etaRemainingSec / 60)}'`}
                </span>
              </div>
            )}
            <div className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold',
              overdue ? 'bg-red-100 text-red-800 animate-pulse' : etaRemainingSec > 300 ? 'bg-matcha-100 text-matcha-800' : 'bg-orange-100 text-orange-800',
            )}>
              <Clock className="h-3 w-3" />
              {overdue
                ? `+${Math.floor(-etaRemainingSec / 60)}:${String((-etaRemainingSec) % 60).padStart(2, '0')} überzogen`
                : `Fertig in ${Math.floor(etaRemainingSec / 60)}:${String(etaRemainingSec % 60).padStart(2, '0')}`}
              {etaReturnStr && !overdue && <span className="ml-1 opacity-70">· ~{etaReturnStr} Uhr</span>}
            </div>
          </div>
        );
      })()}

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all',
            progress === 100 ? 'bg-matcha-500' : progress > 60 ? 'bg-orange-500' : 'bg-blue-500',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Visual stop timeline */}
      <div className="mt-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {batch.stops
            .sort((a, b) => a.reihenfolge - b.reihenfolge)
            .map((s, idx, arr) => {
              const isDone = !!s.geliefert_am;
              const isNext = !isDone && arr.slice(0, idx).every((p) => !!p.geliefert_am);
              // ETA: echte `eta_earliest` aus der Bestellung, Fallback: proportionale Schätzung
              const stopEtaStr = (() => {
                if (isDone) return null;
                if (s.order?.eta_earliest) {
                  const etaMs = new Date(s.order.eta_earliest).getTime();
                  const isOverdue = etaMs < Date.now();
                  const str = new Date(s.order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                  return isOverdue ? `!${str}` : str;
                }
                if (batch.startzeit && batch.total_eta_min != null && total > 0) {
                  return new Date(
                    new Date(batch.startzeit).getTime() +
                    ((idx + 1) / total) * batch.total_eta_min * 60_000,
                  ).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                }
                return null;
              })();
              const isEtaOverdue = s.order?.eta_earliest
                ? new Date(s.order.eta_earliest).getTime() < Date.now()
                : false;
              return (
                <div key={s.id} className="flex items-center gap-1 shrink-0">
                  <div className={cn(
                    'flex flex-col items-center',
                  )}>
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition',
                      isDone ? 'border-matcha-400 bg-matcha-100 text-matcha-700' :
                      isNext ? 'border-orange-400 bg-orange-50 text-orange-800 ring-2 ring-orange-200' :
                      'border-border bg-card text-muted-foreground',
                    )}>
                      {isDone ? <Check className="h-3.5 w-3.5 text-matcha-600" /> : s.reihenfolge}
                    </div>
                    <div
                      className="mt-1 w-20 text-center text-[9px] leading-tight truncate text-muted-foreground font-medium"
                      title={[s.order?.kunde_name, s.order?.kunde_adresse].filter(Boolean).join(' · ')}
                    >
                      {s.order?.kunde_name ?? '—'}
                    </div>
                    {s.order?.kunde_adresse && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.order.kunde_adresse)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-20 text-center text-[8px] leading-tight truncate text-muted-foreground/60 hover:text-matcha-600 hover:underline transition"
                        title={`In Google Maps öffnen: ${s.order.kunde_adresse}`}
                      >
                        {s.order.kunde_adresse.split(',')[0]}
                      </a>
                    )}
                    {stopEtaStr && (
                      <div className={cn(
                        'text-[8px] tabular-nums text-center font-bold',
                        isEtaOverdue ? 'text-red-600 animate-pulse' :
                        isNext ? 'text-orange-600' :
                        'text-muted-foreground/60',
                      )}>
                        {isEtaOverdue ? stopEtaStr : `~${stopEtaStr}`}
                      </div>
                    )}
                  </div>
                  {idx < arr.length - 1 && (
                    <div className={cn(
                      'h-0.5 w-5 rounded-full shrink-0 mb-4',
                      isDone ? 'bg-matcha-400' : 'bg-border',
                    )} />
                  )}
                </div>
              );
            })}
        </div>
      </div>
      {/* Erweiterte Stopp-Details — ein-/ausklappbar */}
      {batch.stops.length > 0 && <ExpandableStopList batch={batch} />}
      <div className="mt-1 flex items-center gap-2 text-xs flex-wrap">
        <span className={cn(
          'rounded-full px-2 py-0.5 font-bold',
          progress === 100 ? 'bg-matcha-100 text-matcha-800' :
          progress > 50 ? 'bg-orange-100 text-orange-800' :
          'bg-blue-100 text-blue-800',
        )}>
          {done}/{total} · {Math.round(progress)}%
        </span>

        {/* Google Maps Route für alle offenen Stops */}
        {(() => {
          const openStops = batch.stops
            .filter((s) => !s.geliefert_am && s.order?.kunde_adresse)
            .sort((a, b) => a.reihenfolge - b.reihenfolge);
          if (openStops.length === 0) return null;
          const addrs = openStops.map((s) => encodeURIComponent(s.order!.kunde_adresse!));
          const dest = addrs[addrs.length - 1];
          const waypoints = addrs.slice(0, -1).join('|');
          const mapsUrl = waypoints
            ? `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${waypoints}&travelmode=driving`
            : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
          return (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-matcha-50 border border-matcha-200 px-2.5 py-0.5 text-[10px] font-bold text-matcha-700 hover:bg-matcha-100 transition"
              title="Route in Google Maps öffnen"
            >
              <MapPin className="h-3 w-3" />
              Route öffnen
            </a>
          );
        })()}

        {/* Re-Optimieren: nur wenn Tour noch nicht abgeschlossen */}
        {progress < 100 && (
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            title="Route neu optimieren"
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition',
              optimizeResult
                ? 'bg-matcha-100 text-matcha-800'
                : 'bg-muted text-muted-foreground hover:bg-matcha-100 hover:text-matcha-800',
            )}
          >
            <RefreshCw className={cn('h-3 w-3', optimizing && 'animate-spin')} />
            {optimizing
              ? 'Optimiert…'
              : optimizeResult
                ? `✓ ${optimizeResult.total_eta_min ?? '?'} Min · ${optimizeResult.total_distance_km?.toFixed(1) ?? '?'} km`
                : 'Route optimieren'}
          </button>
        )}
      </div>

      {/* Kompakter Stop-Fortschritts-Strip */}
      {batch.stops && batch.stops.length > 0 && (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {[...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge).map((stop, idx) => {
            const done = !!stop.geliefert_am;
            const isCurrent = !done && [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge).slice(0, idx).every(s => !!s.geliefert_am);
            return (
              <div key={stop.id} className="flex items-center gap-1">
                <div className={cn(
                  'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black border',
                  done ? 'bg-matcha-600 border-matcha-600 text-white' :
                  isCurrent ? 'bg-orange-500 border-orange-500 text-white animate-pulse' :
                  'bg-white border-border text-muted-foreground',
                )}>
                  {done ? '✓' : stop.reihenfolge}
                </div>
                {idx < batch.stops.length - 1 && (
                  <div className={cn('h-0.5 w-3 rounded', done ? 'bg-matcha-400' : 'bg-border')} />
                )}
              </div>
            );
          })}
          {(() => {
            const doneCount = batch.stops.filter(s => !!s.geliefert_am).length;
            const pct = batch.stops.length > 0 ? Math.round((doneCount / batch.stops.length) * 100) : 0;
            if (pct === 0 && doneCount === 0) return null;
            return <span className="ml-1 text-[9px] font-bold text-muted-foreground tabular-nums">{doneCount}/{batch.stops.length}</span>;
          })()}
        </div>
      )}
    </div>
  );
}

function ExpandableStopList({ batch }: { batch: Batch }) {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  const sorted = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const now = Date.now();
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-foreground transition"
      >
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {open ? 'Stopps ausblenden' : `${sorted.length} Stopps anzeigen`}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {sorted.map((s, idx) => {
            const isDone = !!s.geliefert_am;
            const isNext = !isDone && sorted.slice(0, idx).every(p => !!p.geliefert_am);
            const etaMs = s.order?.eta_earliest ? new Date(s.order.eta_earliest).getTime() : null;
            const etaStr = etaMs
              ? new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
              : null;
            const secLeft = etaMs ? Math.floor((etaMs - now) / 1000) : null;
            const etaOverdue = secLeft !== null && secLeft < 0;
            const mAbs = secLeft !== null ? Math.abs(Math.floor(secLeft / 60)) : null;
            const sAbs = secLeft !== null ? Math.abs(secLeft) % 60 : null;
            return (
              <div key={s.id} className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs border',
                isDone ? 'bg-matcha-50 border-matcha-200 opacity-60' :
                etaOverdue && isNext ? 'bg-red-50 border-red-300' :
                isNext ? 'bg-orange-50 border-orange-300' :
                'bg-card border-border',
              )}>
                <div className={cn(
                  'h-6 w-6 rounded-full grid place-items-center text-[10px] font-black shrink-0',
                  isDone ? 'bg-matcha-500 text-white' :
                  etaOverdue && isNext ? 'bg-red-500 text-white animate-pulse' :
                  isNext ? 'bg-orange-500 text-white' :
                  'bg-muted text-muted-foreground',
                )}>
                  {isDone ? '✓' : s.reihenfolge}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{s.order?.kunde_name ?? '—'}</div>
                  <div className="text-muted-foreground truncate text-[10px]">
                    {s.order?.kunde_adresse ?? ''}
                  </div>
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  {etaStr && !isDone && (
                    <div className={cn(
                      'text-[10px] font-bold tabular-nums',
                      etaOverdue ? 'text-red-600' : isNext ? 'text-orange-700' : 'text-muted-foreground',
                    )}>
                      {etaStr}
                    </div>
                  )}
                  {!isDone && secLeft !== null && mAbs !== null && sAbs !== null && (
                    <div className={cn(
                      'text-[9px] font-bold tabular-nums',
                      etaOverdue ? 'text-red-500 animate-pulse' :
                      secLeft < 300 ? 'text-amber-600' : 'text-muted-foreground',
                    )}>
                      {etaOverdue
                        ? `+${mAbs}:${String(sAbs).padStart(2, '0')} überfällig`
                        : `noch ${mAbs}:${String(sAbs).padStart(2, '0')}`}
                    </div>
                  )}
                  {isDone && s.geliefert_am && (
                    <div className="text-[9px] text-matcha-600 font-medium">
                      ✓ {new Date(s.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ DriverZoneMatchPanel ------------------------------ */

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function DriverZoneMatchPanel({
  orders,
  drivers,
  batches,
}: {
  orders: ReadyOrder[];
  drivers: Driver[];
  batches: Batch[];
}) {
  const busyDriverIds = new Set(batches.map((b) => b.fahrer_id).filter(Boolean));
  const freeDriversWithGps = drivers.filter(
    (d) => d.ist_online && !busyDriverIds.has(d.employee_id) && d.last_lat != null && d.last_lng != null,
  );
  const readyOrders = orders.filter((o) => o.status === 'fertig' && o.delivery_zone);

  if (freeDriversWithGps.length === 0 || readyOrders.length === 0) return null;

  // Zone centroids
  const byZone = readyOrders.reduce<Record<string, { lats: number[]; lngs: number[]; count: number }>>((acc, o) => {
    if (!o.delivery_zone || !o.kunde_lat || !o.kunde_lng) return acc;
    if (!acc[o.delivery_zone]) acc[o.delivery_zone] = { lats: [], lngs: [], count: 0 };
    acc[o.delivery_zone].lats.push(o.kunde_lat);
    acc[o.delivery_zone].lngs.push(o.kunde_lng);
    acc[o.delivery_zone].count++;
    return acc;
  }, {});

  const zoneCentroids = Object.entries(byZone).map(([zone, { lats, lngs, count }]) => ({
    zone,
    count,
    lat: lats.reduce((a, b) => a + b, 0) / lats.length,
    lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
  }));

  if (zoneCentroids.length === 0) return null;

  // For each zone, find closest free driver
  const matches = zoneCentroids.map(({ zone, count, lat, lng }) => {
    const closest = freeDriversWithGps
      .map((d) => ({ d, km: haversineKm({ lat: d.last_lat!, lng: d.last_lng! }, { lat, lng }) }))
      .sort((a, b) => a.km - b.km)[0];
    return { zone, count, closest };
  }).sort((a, b) => a.zone.localeCompare(b.zone));

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Target className="h-4 w-4 text-matcha-700" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
          Fahrer-Tipp · GPS-Nähe zu Zonen
        </span>
        <span className="ml-auto text-[10px] text-matcha-500">{freeDriversWithGps.length} freie Fahrer</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {matches.map(({ zone, count, closest }) => {
          const zm = zoneMeta(zone);
          const name = closest?.d.employee
            ? `${closest.d.employee.vorname} ${closest.d.employee.nachname?.charAt(0)}.`
            : '—';
          const kmStr = closest ? `${closest.km.toFixed(1)} km` : '—';
          const kmColor = closest && closest.km < 1 ? 'text-matcha-700' : closest && closest.km < 3 ? 'text-orange-700' : 'text-red-600';
          return (
            <div key={zone} className="flex items-center gap-2 rounded-lg border border-matcha-200 bg-white px-3 py-2 text-xs">
              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-black', zm.cls)}>
                {zone}
              </span>
              <span className="font-bold text-foreground">{count}×</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-semibold text-foreground">{name}</span>
              <span className={cn('text-[10px] font-bold tabular-nums', kmColor)}>{kmStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ CapacityForecastChip ------------------------------ */

function CapacityForecastChip({
  batches,
  onlineDrivers,
}: {
  batches: Batch[];
  onlineDrivers: Driver[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  // Drivers currently on a tour
  const busyDriverIds = new Set(batches.map((b) => b.fahrer_id).filter(Boolean));
  const freeDrivers = onlineDrivers.filter((d) => !busyDriverIds.has(d.employee_id));

  // Earliest and latest return from active tours
  const returnTimes = batches
    .map((b) => {
      if (!b.startzeit || b.total_eta_min == null) return null;
      return new Date(b.startzeit).getTime() + b.total_eta_min * 60_000;
    })
    .filter((ms): ms is number => ms != null && ms > now)
    .sort((a, b) => a - b);

  const nextReturn = returnTimes[0] ?? null;
  const lastReturn = returnTimes[returnTimes.length - 1] ?? null;

  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const minLeft = nextReturn ? Math.ceil((nextReturn - now) / 60_000) : null;
  const allFreeMin = lastReturn ? Math.ceil((lastReturn - now) / 60_000) : null;

  if (freeDrivers.length === 0 && nextReturn == null && batches.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm">
      <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
        <Bike className="h-4 w-4 text-matcha-500" />
        <span>Kapazität</span>
      </div>

      {freeDrivers.length > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 px-2.5 py-0.5 text-xs font-semibold text-matcha-800">
          <span className="h-1.5 w-1.5 rounded-full bg-matcha-500 inline-block" />
          {freeDrivers.length} Fahrer sofort verfügbar
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
          Alle Fahrer unterwegs
        </span>
      )}

      {nextReturn != null && (
        <span className="text-xs text-muted-foreground">
          Nächster frei:{' '}
          <span className="font-semibold text-foreground tabular-nums">
            ~{fmtTime(nextReturn)}
          </span>
          {minLeft != null && minLeft > 0 && (
            <span className="ml-1 tabular-nums text-muted-foreground/70">(in {minLeft} Min)</span>
          )}
        </span>
      )}

      {lastReturn != null && lastReturn !== nextReturn && (
        <span className="text-xs text-muted-foreground">
          Alle frei:{' '}
          <span className="font-semibold text-foreground tabular-nums">
            ~{fmtTime(lastReturn)}
          </span>
          {allFreeMin != null && allFreeMin > 0 && (
            <span className="ml-1 tabular-nums text-muted-foreground/70">(in {allFreeMin} Min)</span>
          )}
        </span>
      )}

      {batches.length > 0 && (
        <span className="ml-auto text-xs text-muted-foreground">
          {batches.length} aktive Tour{batches.length !== 1 ? 'en' : ''}
        </span>
      )}
    </div>
  );
}

/* ------------------------------ TourReturnTimeline ------------------------------ */

function TourReturnTimeline({ batches }: { batches: Batch[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  // Collect tours with return ETA
  const tours = batches
    .map((b) => {
      const etaMs = b.startzeit && b.total_eta_min != null
        ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
        : null;
      const doneStops = b.stops.filter((s) => s.geliefert_am).length;
      const totalStops = b.stops.length;
      const fahrer = b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname}`.trim() : 'Unbekannt';
      const secLeft = etaMs ? Math.floor((etaMs - now) / 1000) : null;
      const progress = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;
      return { id: b.id, fahrer, etaMs, secLeft, doneStops, totalStops, progress, zone: b.zone };
    })
    .sort((a, b) => {
      if (a.etaMs && b.etaMs) return a.etaMs - b.etaMs;
      if (a.etaMs) return -1;
      if (b.etaMs) return 1;
      return 0;
    });

  if (tours.length === 0) return null;

  // Compute timeline window: now → max return ETA + 10 min
  const maxEtaMs = tours.reduce((m, t) => (t.etaMs && t.etaMs > m ? t.etaMs : m), now + 30 * 60_000);
  const windowStart = now;
  const windowEnd = maxEtaMs + 10 * 60_000;
  const windowMs = windowEnd - windowStart;

  function toTimePct(ms: number | null): number {
    if (ms == null) return 0;
    return Math.max(0, Math.min(100, ((ms - windowStart) / windowMs) * 100));
  }

  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">Rückkehr-Timeline</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Jetzt → {fmtTime(maxEtaMs)}</span>
      </div>

      {/* Time axis */}
      <div className="relative mb-1">
        {/* Now line */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-matcha-500" style={{ left: '0%' }} />
        <div className="text-[9px] text-matcha-600 font-bold ml-1 mb-1">Jetzt</div>

        {/* Tour rows */}
        <div className="space-y-2 mt-2">
          {tours.map((tour) => {
            const etaPct = toTimePct(tour.etaMs);
            const isOverdue = tour.secLeft != null && tour.secLeft < 0;
            const isSoon = tour.secLeft != null && tour.secLeft >= 0 && tour.secLeft < 300;

            return (
              <div key={tour.id} className="relative flex items-center gap-2">
                {/* Label */}
                <div className="w-24 shrink-0 text-[10px] font-semibold text-right truncate pr-1">
                  {tour.fahrer}
                </div>

                {/* Bar container */}
                <div className="flex-1 relative h-5 rounded-full bg-muted overflow-hidden">
                  {/* Progress fill */}
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full transition-all',
                      tour.progress === 100 ? 'bg-matcha-400' :
                      isOverdue ? 'bg-red-400' :
                      isSoon ? 'bg-orange-400 animate-pulse' :
                      'bg-blue-400',
                    )}
                    style={{ width: `${tour.progress}%` }}
                  />

                  {/* Return ETA marker */}
                  {tour.etaMs && (
                    <div
                      className={cn(
                        'absolute top-0.5 bottom-0.5 w-1 rounded-full',
                        isOverdue ? 'bg-red-600' : isSoon ? 'bg-orange-600' : 'bg-matcha-700',
                      )}
                      style={{ left: `calc(${etaPct}% - 2px)` }}
                      title={`ETA: ${fmtTime(tour.etaMs)}`}
                    />
                  )}

                  {/* Stop counter */}
                  <div className="absolute inset-0 flex items-center px-2 justify-between">
                    <span className="text-[9px] font-bold text-white drop-shadow">
                      {tour.doneStops}/{tour.totalStops}
                    </span>
                    {tour.zone && (
                      <span className={cn(
                        'text-[9px] font-black rounded px-1',
                        zoneMeta(tour.zone).cls,
                      )}>
                        {tour.zone}
                      </span>
                    )}
                  </div>
                </div>

                {/* ETA label */}
                <div className={cn(
                  'w-14 shrink-0 text-[10px] font-bold tabular-nums text-right',
                  isOverdue ? 'text-red-600' : isSoon ? 'text-orange-600' : 'text-muted-foreground',
                )}>
                  {tour.etaMs
                    ? (isOverdue
                      ? `+${Math.floor(-tour.secLeft! / 60)}m`
                      : `~${fmtTime(tour.etaMs)}`)
                    : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" /> Unterwegs</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400 shrink-0" /> Kommt bald</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-400 shrink-0" /> Abgeschlossen</span>
      </div>
    </div>
  );
}

function payMeta(z: string) {
  switch (z) {
    case 'bar':
      return { label: 'Bar', icon: <Banknote className="h-3 w-3" />, cls: 'bg-accent/20 text-matcha-900' };
    case 'karte':
      return { label: 'Karte', icon: <CreditCard className="h-3 w-3" />, cls: 'bg-blue-100 text-blue-800' };
    case 'online':
    case 'stripe':
      return { label: 'Bezahlt', icon: <Check className="h-3 w-3" />, cls: 'bg-matcha-700 text-white' };
    default:
      return { label: z, icon: null, cls: 'bg-muted text-muted-foreground' };
  }
}

function zoneMeta(zone: string | null): { cls: string; barCls: string } {
  switch (zone) {
    case 'A': return { cls: 'bg-green-100 text-green-800',   barCls: 'bg-green-400' };
    case 'B': return { cls: 'bg-blue-100 text-blue-800',     barCls: 'bg-blue-400' };
    case 'C': return { cls: 'bg-orange-100 text-orange-800', barCls: 'bg-orange-400' };
    case 'D': return { cls: 'bg-red-100 text-red-800',       barCls: 'bg-red-400' };
    default:  return { cls: 'bg-muted text-muted-foreground', barCls: 'bg-muted-foreground' };
  }
}

function ScoreArcGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const r = 34;
  const arc = Math.PI * r; // semicircle circumference
  const color =
    score >= 80 ? '#2d6b45' :
    score >= 60 ? '#2563eb' :
    score >= 40 ? '#f97316' :
                  '#ef4444';
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F';
  const gradeColor =
    grade === 'A' || grade === 'B' ? 'text-matcha-700' :
    grade === 'C' ? 'text-blue-600' :
    grade === 'D' ? 'text-orange-600' :
                    'text-red-600';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="52" viewBox="0 0 88 52" className="overflow-visible">
        {/* Track */}
        <path
          d={`M 10 44 A ${r} ${r} 0 0 1 78 44`}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={`M 10 44 A ${r} ${r} 0 0 1 78 44`}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={arc * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s' }}
        />
        {/* Score label */}
        <text x="44" y="40" textAnchor="middle" fontSize="16" fontWeight="800" fill={color} fontFamily="sans-serif">
          {Math.round(score)}
        </text>
      </svg>
      <span className={cn('font-display text-3xl font-black leading-none -mt-2', gradeColor)}>
        {grade}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {grade === 'A' ? 'Exzellent' : grade === 'B' ? 'Sehr gut' : grade === 'C' ? 'Gut' : grade === 'D' ? 'Befriedigend' : 'Verbesserung nötig'}
      </span>
    </div>
  );
}

function scoreMeta(score: number): { cls: string } {
  if (score >= 80) return { cls: 'bg-matcha-100 text-matcha-800' };
  if (score >= 60) return { cls: 'bg-blue-100 text-blue-800' };
  if (score >= 40) return { cls: 'bg-orange-100 text-orange-800' };
  return { cls: 'bg-red-100 text-red-800' };
}

/* ------------------------------ LongWaitOrdersPanel ------------------------------ */

function LongWaitOrdersPanel({
  orders,
  onSelect,
  selected,
}: {
  orders: ReadyOrder[];
  onSelect: (id: string) => void;
  selected: Set<string>;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const THRESHOLD_MIN = 8;

  const longWait = orders
    .filter((o) => o.fertig_am && Math.floor((now - new Date(o.fertig_am).getTime()) / 60_000) >= THRESHOLD_MIN)
    .sort((a, b) => {
      const aWait = a.fertig_am ? now - new Date(a.fertig_am).getTime() : 0;
      const bWait = b.fertig_am ? now - new Date(b.fertig_am).getTime() : 0;
      return bWait - aWait;
    });

  if (longWait.length === 0) return null;

  const totalValue = longWait.reduce((s, o) => s + o.gesamtbetrag, 0);

  return (
    <div className="rounded-xl border-2 border-red-400 bg-red-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-red-600 animate-pulse" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-red-800">
          Wartet zu lang · {longWait.length}× &gt;{THRESHOLD_MIN} Min · {euro(totalValue)}
        </span>
        <span className="ml-auto text-[10px] font-bold text-red-600">
          Sofort dispatchen!
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {longWait.map((o) => {
          const waitMin = o.fertig_am
            ? Math.floor((now - new Date(o.fertig_am).getTime()) / 60_000)
            : 0;
          const waitSec = o.fertig_am
            ? Math.floor((now - new Date(o.fertig_am).getTime()) / 1000)
            : 0;
          const isSel = selected.has(o.id);
          const isCritical = waitMin >= 15;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelect(o.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs text-left transition active:scale-[0.97]',
                isSel
                  ? 'border-matcha-600 bg-matcha-100'
                  : isCritical
                  ? 'border-red-500 bg-white animate-pulse'
                  : 'border-red-300 bg-white hover:border-red-500',
              )}
            >
              {isSel && <Check className="h-3 w-3 text-matcha-700 shrink-0" />}
              <span className="font-mono font-bold text-foreground">
                #{o.bestellnummer.replace('FF-', '')}
              </span>
              {o.delivery_zone && (
                <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-black', zoneMeta(o.delivery_zone).cls)}>
                  {o.delivery_zone}
                </span>
              )}
              <span className="font-medium text-foreground truncate max-w-[80px]">{o.kunde_name}</span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums shrink-0',
                isCritical ? 'bg-red-600 text-white' : 'bg-red-200 text-red-800',
              )}>
                {Math.floor(waitSec / 60)}:{String(waitSec % 60).padStart(2, '0')}
              </span>
              <span className="text-muted-foreground font-medium shrink-0">{euro(o.gesamtbetrag)}</span>
            </button>
          );
        })}
      </div>
      {longWait.length > 0 && (
        <div className="mt-2 text-[10px] text-red-700 font-medium">
          Klicke eine Bestellung um sie auszuwählen → dann Fahrer rechts zuweisen.
        </div>
      )}
    </div>
  );
}

/* ------------------------------ DelayMonitorPanel ------------------------------ */

type DelayOrder = {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  delayMinutes: number;
  firstNoticeSent: boolean;
  criticalNoticeSent: boolean;
  voucherCreated: boolean;
};

type DelayMonitorData = {
  summary: {
    total_delayed: number;
    pending_first_notice: number;
    pending_critical: number;
    pending_voucher: number;
    max_delay_minutes: number;
  };
  delayed_orders: DelayOrder[];
} | null;

function DelayMonitorPanel({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<DelayMonitorData>(null);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/delay-monitor?location_id=${locationId}&limit=20`);
        if (!res.ok) return;
        const d = await res.json();
        if (d?.summary) setData(d);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const triggerScan = async () => {
    if (!locationId || scanning) return;
    setScanning(true);
    try {
      await fetch('/api/delivery/admin/delay-monitor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      const res = await fetch(`/api/delivery/admin/delay-monitor?location_id=${locationId}&limit=20`);
      if (res.ok) { const d = await res.json(); if (d?.summary) setData(d); }
    } finally {
      setScanning(false);
    }
  };

  if (!data || data.summary.total_delayed === 0) return null;

  const { summary, delayed_orders } = data;
  const hasCritical = summary.pending_critical > 0 || summary.max_delay_minutes >= 30;

  return (
    <div className={cn(
      'rounded-xl border-2 p-4 transition-all',
      hasCritical ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50',
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn('h-4 w-4 shrink-0', hasCritical ? 'text-red-600' : 'text-amber-600')} />
        <span className={cn('font-display text-sm font-bold uppercase tracking-wider', hasCritical ? 'text-red-800' : 'text-amber-800')}>
          Verspätungs-Monitor · {summary.total_delayed} betroffen
        </span>
        <div className="ml-auto flex items-center gap-2">
          {summary.pending_voucher > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-700">
              <Gift className="h-3 w-3" /> {summary.pending_voucher} Gutschein{summary.pending_voucher !== 1 ? 'e' : ''}
            </div>
          )}
          {summary.max_delay_minutes > 0 && (
            <div className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums',
              summary.max_delay_minutes >= 30 ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800',
            )}>
              max +{summary.max_delay_minutes}m
            </div>
          )}
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="rounded-lg border border-current bg-white/60 px-2 py-1 text-[10px] font-bold transition hover:bg-white disabled:opacity-50"
          >
            {scanning ? 'Scanne…' : 'Jetzt scannen'}
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="rounded-lg border border-current bg-white/60 px-2 py-1 text-[10px] font-bold transition hover:bg-white"
          >
            {expanded ? '▲ Weniger' : '▼ Details'}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {summary.pending_first_notice > 0 && (
          <div className="rounded-full bg-amber-200 text-amber-800 px-2 py-0.5 text-[9px] font-bold">
            {summary.pending_first_notice}× 1. Benachrichtigung ausstehend
          </div>
        )}
        {summary.pending_critical > 0 && (
          <div className="rounded-full bg-red-200 text-red-800 px-2 py-0.5 text-[9px] font-bold animate-pulse">
            {summary.pending_critical}× Kritisch (≥30 Min)
          </div>
        )}
        {summary.pending_voucher > 0 && (
          <div className="rounded-full bg-purple-200 text-purple-800 px-2 py-0.5 text-[9px] font-bold">
            {summary.pending_voucher}× Kompensations-Gutschein
          </div>
        )}
      </div>

      {expanded && delayed_orders.length > 0 && (
        <div className="mt-3 grid gap-1.5 max-h-52 overflow-y-auto">
          {delayed_orders.slice(0, 15).map((o) => (
            <div
              key={o.orderId}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 text-xs',
                o.delayMinutes >= 30 ? 'bg-red-100 border-red-200' : 'bg-amber-100 border-amber-200',
              )}
            >
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums shrink-0',
                o.delayMinutes >= 30 ? 'bg-red-600 text-white' : 'bg-amber-500 text-white',
              )}>
                +{o.delayMinutes}m
              </span>
              <span className="font-mono font-bold">#{o.bestellnummer.replace(/^[A-Z]+-/, '')}</span>
              <span className="flex-1 truncate font-medium">{o.kundeName}</span>
              <div className="flex items-center gap-1 shrink-0">
                {o.voucherCreated && <Gift className="h-3 w-3 text-purple-600" aria-label="Gutschein erstellt" />}
                {o.criticalNoticeSent && <span className="text-[8px] bg-red-200 text-red-700 rounded px-1">Krit.</span>}
                {o.firstNoticeSent && !o.criticalNoticeSent && <span className="text-[8px] bg-amber-200 text-amber-700 rounded px-1">Benach.</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ TourVisualizationPanel ------------------------------ */

type TourModification = {
  id: string;
  type: string;
  performed_by: string | null;
  reason: string | null;
  created_at: string;
  eta_before_min: number | null;
  eta_after_min: number | null;
};

function TourVisualizationPanel({
  batches, drivers = [], readyOrders = [],
}: {
  batches: Batch[];
  drivers?: Driver[];
  readyOrders?: ReadyOrder[];
}) {
  // Auto-open when any tour is overdue >5 Min — dispatcher sofort informieren
  const hasOverdue = batches.some((b) => {
    if (!b.startzeit || b.total_eta_min == null) return false;
    return Date.now() > new Date(b.startzeit).getTime() + b.total_eta_min * 60_000 + 5 * 60_000;
  });
  const [open, setOpen] = useState(hasOverdue);
  const [, setTick] = useState(0);
  const [removePending, setRemovePending] = useState<string | null>(null);
  const [reoptPending, setReoptPending] = useState<string | null>(null);
  const [modifications, setModifications] = useState<Map<string, TourModification[]>>(new Map());
  const [showMods, setShowMods] = useState<Set<string>>(new Set());
  const [reoptResult, setReoptResult] = useState<Map<string, string>>(new Map());
  const [addStopOpen, setAddStopOpen] = useState<string | null>(null);
  const [addStopPending, setAddStopPending] = useState<string | null>(null);

  // Auto-open wenn eine Tour neu überfällig wird (stale-closure-safe)
  useEffect(() => {
    if (hasOverdue) setOpen(true);
  }, [hasOverdue]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  async function removeStop(batchId: string, stopId: string) {
    if (removePending) return;
    setRemovePending(stopId);
    try {
      const res = await fetch(`/api/delivery/admin/tours/${batchId}/stops/${stopId}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin: manuell entfernt' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Fehler: ${(err as { error?: string }).error ?? res.statusText}`);
      }
    } catch {
      alert('Netzwerkfehler beim Entfernen des Stopps.');
    } finally {
      setRemovePending(null);
    }
  }

  async function reoptimizeTour(batchId: string) {
    if (reoptPending) return;
    setReoptPending(batchId);
    setReoptResult((m) => { const n = new Map(m); n.delete(batchId); return n; });
    try {
      const res = await fetch(`/api/delivery/admin/tours/${batchId}/reoptimize`, { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        const etaMin: number | null = (d as { etaAfterMin?: number }).etaAfterMin ?? null;
        setReoptResult((m) => new Map(m).set(batchId, etaMin != null ? `✓ ${etaMin} Min neu berechnet` : '✓ Optimiert'));
        setTimeout(() => setReoptResult((m) => { const n = new Map(m); n.delete(batchId); return n; }), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Fehler: ${(err as { error?: string }).error ?? res.statusText}`);
      }
    } catch {
      alert('Netzwerkfehler bei Reoptimierung.');
    } finally {
      setReoptPending(null);
    }
  }

  async function toggleModifications(batchId: string) {
    const next = new Set(showMods);
    if (next.has(batchId)) {
      next.delete(batchId);
      setShowMods(next);
      return;
    }
    next.add(batchId);
    setShowMods(next);
    if (modifications.has(batchId)) return;
    try {
      const res = await fetch(`/api/delivery/admin/tours/${batchId}/modifications?limit=20`);
      if (res.ok) {
        const d = await res.json();
        setModifications((m) => new Map(m).set(batchId, (d as { modifications?: TourModification[] }).modifications ?? []));
      }
    } catch {}
  }

  async function addStopToTour(batchId: string, orderId: string) {
    if (addStopPending) return;
    setAddStopPending(orderId);
    try {
      const res = await fetch(`/api/delivery/admin/tours/${batchId}/stops`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.ok) {
        setAddStopOpen(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Fehler: ${(err as { error?: string }).error ?? res.statusText}`);
      }
    } catch {
      alert('Netzwerkfehler beim Hinzufügen des Stopps.');
    } finally {
      setAddStopPending(null);
    }
  }

  const now = Date.now();
  if (batches.length === 0) return null;

  const ACTIVE_STATUSES = new Set(['pending_acceptance', 'assigned', 'at_restaurant', 'on_route', 'en_route', 'pickup', 'unterwegs']);

  const enriched = batches.map((b) => {
    const total = b.stops.length;
    const done = b.stops.filter((s) => s.geliefert_am).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const etaMs = b.startzeit && b.total_eta_min != null
      ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
      : null;
    const secLeft = etaMs ? Math.floor((etaMs - now) / 1000) : null;
    const nextStop = b.stops
      .filter((s) => !s.geliefert_am)
      .sort((a, b) => a.reihenfolge - b.reihenfolge)[0] ?? null;
    const canModify = ACTIVE_STATUSES.has(b.status) && done < total;
    return { batch: b, total, done, progress, etaMs, secLeft, nextStop, canModify };
  }).sort((a, b) => (a.secLeft ?? 9999) - (b.secLeft ?? 9999));

  const MOD_TYPE_LABELS: Record<string, string> = {
    stop_inserted: 'Stopp hinzugefügt',
    stop_removed: 'Stopp entfernt',
    tour_reoptimized: 'Route optimiert',
    tour_stop_inserted: 'Stopp hinzugefügt',
    tour_stop_removed: 'Stopp entfernt',
  };

  return (
    <div data-tour-panel>
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition border-b"
      >
        <div className="flex items-center gap-2">
          <RouteIcon className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Tour-Visualisierung</span>
          <Badge variant="secondary">{batches.length} Touren</Badge>
          {enriched.filter((e) => e.secLeft !== null && e.secLeft < 0).length > 0 && (
            <Badge variant="destructive" className="text-[10px] animate-pulse">
              {enriched.filter((e) => e.secLeft !== null && e.secLeft < 0).length} überzogen
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {enriched.map(({ batch, total, done, progress, secLeft, nextStop, etaMs, canModify }) => {
            const driverName = batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}` : `Fahrer`;
            const driverPhone = drivers.find((d) => d.employee_id === batch.fahrer_id)?.employee?.telefon ?? null;
            const overdue = secLeft !== null && secLeft < 0;
            const imminent = !overdue && secLeft !== null && secLeft < 300;
            const headerBg =
              overdue   ? 'bg-red-50 border-red-200'    :
              imminent  ? 'bg-orange-50 border-orange-200' :
              progress === 100 ? 'bg-matcha-50 border-matcha-200' :
              'bg-card border-border';
            const batchMods = modifications.get(batch.id);
            const modsShown = showMods.has(batch.id);
            return (
              <div key={batch.id} className={cn('rounded-xl border p-3', headerBg)}>
                {/* Tour Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    'h-10 w-10 rounded-xl grid place-items-center font-display font-black text-sm shrink-0',
                    overdue   ? 'bg-red-600 text-white'    :
                    imminent  ? 'bg-orange-500 text-white'  :
                    progress === 100 ? 'bg-matcha-600 text-white' :
                    'bg-matcha-700 text-white',
                  )}>
                    {progress === 100 ? '✓' : `${Math.round(progress)}%`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold">{driverName}</span>
                      {batch.zone && (
                        <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-black', zoneMeta(batch.zone).cls)}>
                          Zone {batch.zone}
                        </span>
                      )}
                      {driverPhone && (
                        <a
                          href={`tel:${driverPhone}`}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold transition',
                            overdue
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70',
                          )}
                          title={`Anrufen: ${driverPhone}`}
                        >
                          <Phone className="h-2.5 w-2.5" />
                          {overdue ? 'Anrufen!' : driverPhone}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span className="tabular-nums">{done}/{total} Stopps</span>
                      {batch.total_distance_km != null && (
                        <span>{batch.total_distance_km.toFixed(1)} km</span>
                      )}
                      {batch.total_distance_km != null && total > 0 && (
                        <span className="font-semibold text-matcha-600 tabular-nums" title="Geschätzte Fahrer-Vergütung (€1.50/Stopp + €0.20/km)">
                          ~{(total * 1.50 + batch.total_distance_km * 0.20).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                      )}
                      {secLeft !== null && (
                        <span className={cn(
                          'font-bold tabular-nums',
                          overdue ? 'text-red-600' : imminent ? 'text-orange-600' : 'text-matcha-700',
                        )}>
                          {overdue
                            ? `+${Math.floor(-secLeft / 60)}m überzogen`
                            : `~${Math.floor(secLeft / 60)}m zurück`}
                        </span>
                      )}
                      {etaMs !== null && !overdue && (
                        <span className="text-muted-foreground/60 tabular-nums">
                          ↩ {new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {nextStop?.order?.kunde_adresse && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextStop.order.kunde_adresse)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-matcha-200 bg-matcha-50 px-2.5 py-1 text-[10px] font-bold text-matcha-700 hover:bg-matcha-100 transition"
                      >
                        <MapPin className="h-3 w-3" />
                        Nächster
                      </a>
                    )}
                    {/* Neu optimieren — nur für mise_delivery_batches */}
                    {canModify && (batch as any)._isMise && (
                      <button
                        onClick={() => reoptimizeTour(batch.id)}
                        disabled={reoptPending === batch.id}
                        title="Route neu optimieren (Nearest-Neighbor)"
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition',
                          reoptResult.get(batch.id)
                            ? 'border-matcha-400 bg-matcha-50 text-matcha-700'
                            : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                        )}
                      >
                        {reoptPending === batch.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RotateCcw className="h-3 w-3" />}
                        {reoptResult.get(batch.id) ?? 'Optimieren'}
                      </button>
                    )}
                    {/* Änderungsprotokoll */}
                    <button
                      onClick={() => toggleModifications(batch.id)}
                      title="Änderungsprotokoll anzeigen"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition',
                        modsShown
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
                      )}
                    >
                      <History className="h-3 w-3" />
                      {batchMods ? batchMods.length : ''}
                    </button>
                    {/* Bestellung zur Tour hinzufügen — nur für mise_delivery_batches */}
                    {canModify && (batch as any)._isMise && readyOrders.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setAddStopOpen(addStopOpen === batch.id ? null : batch.id)}
                          title="Bestellung zu dieser Tour hinzufügen"
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition',
                            addStopOpen === batch.id
                              ? 'border-matcha-400 bg-matcha-50 text-matcha-700'
                              : 'border-matcha-300 bg-white text-matcha-700 hover:bg-matcha-50',
                          )}
                        >
                          <Zap className="h-3 w-3" />
                          +Stop
                        </button>
                        {addStopOpen === batch.id && (
                          <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-xl border bg-popover shadow-lg overflow-hidden">
                            <div className="px-3 py-2 border-b bg-muted/50">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Bestellung einreihen
                              </span>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y">
                              {readyOrders
                                .filter((ro) => !batch.stops.some((s) => s.order_id === ro.id))
                                .slice(0, 8)
                                .map((ro) => (
                                  <button
                                    key={ro.id}
                                    onClick={() => addStopToTour(batch.id, ro.id)}
                                    disabled={addStopPending === ro.id}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition"
                                  >
                                    {addStopPending === ro.id
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin text-matcha-600 shrink-0" />
                                      : <Zap className="h-3.5 w-3.5 text-matcha-500 shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[11px] font-semibold truncate">{ro.kunde_name}</div>
                                      <div className="text-[9px] text-muted-foreground truncate flex items-center gap-1">
                                        {ro.delivery_zone && (
                                          <span className={cn('rounded px-1 py-0 text-[8px] font-bold', zoneMeta(ro.delivery_zone).cls)}>
                                            {ro.delivery_zone}
                                          </span>
                                        )}
                                        {ro.kunde_adresse}
                                      </div>
                                    </div>
                                    <span className="shrink-0 text-[10px] font-mono text-matcha-700">{euro(ro.gesamtbetrag)}</span>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      progress === 100 ? 'bg-matcha-500' :
                      overdue ? 'bg-red-500 animate-pulse' :
                      progress > 60 ? 'bg-orange-400' : 'bg-blue-400',
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Stop dots timeline — with remove buttons for active tours */}
                <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-hide">
                  {batch.stops
                    .slice()
                    .sort((a, b) => a.reihenfolge - b.reihenfolge)
                    .map((stop, idx, arr) => {
                      const isDone = !!stop.geliefert_am;
                      const isNext = !isDone && arr.slice(0, idx).every((p) => !!p.geliefert_am);
                      const stopEtaStr = stop.order?.eta_earliest
                        ? new Date(stop.order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                        : null;
                      const stopEtaOverdue = stop.order?.eta_earliest
                        ? new Date(stop.order.eta_earliest).getTime() < now
                        : false;
                      const canRemove = canModify && (batch as any)._isMise && !isDone && !isNext;
                      return (
                        <div key={stop.id} className="flex items-center shrink-0">
                          <div className="flex flex-col items-center gap-0.5 relative">
                            {/* Delete button — appears on hover for future stops */}
                            {canRemove && (
                              <button
                                onClick={() => {
                                  if (confirm(`Stopp ${stop.reihenfolge} (${stop.order?.kunde_name ?? ''}) aus der Tour entfernen?`)) {
                                    removeStop(batch.id, stop.id);
                                  }
                                }}
                                disabled={removePending === stop.id}
                                title="Stopp aus Tour entfernen"
                                className="absolute -top-1.5 -right-1 z-10 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                                style={{ fontSize: 8 }}
                              >
                                {removePending === stop.id
                                  ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  : <Trash2 className="h-2.5 w-2.5" />}
                              </button>
                            )}
                            <div className={cn(
                              'h-7 w-7 rounded-full grid place-items-center text-[10px] font-bold border-2 transition-all',
                              isDone
                                ? 'bg-matcha-100 border-matcha-400 text-matcha-700'
                                : isNext
                                ? 'bg-orange-50 border-orange-400 text-orange-800 ring-2 ring-orange-200 ring-offset-1'
                                : 'bg-muted border-border text-muted-foreground',
                            )}>
                              {isDone ? '✓' : stop.reihenfolge}
                            </div>
                            <div className="w-16 text-center text-[8px] leading-tight truncate text-muted-foreground">
                              {stop.order?.kunde_name ?? '—'}
                            </div>
                            {stopEtaStr && (
                              <div className={cn(
                                'text-[7px] font-bold tabular-nums text-center',
                                stopEtaOverdue && !isDone ? 'text-red-600' :
                                isNext ? 'text-orange-600' : 'text-muted-foreground/60',
                              )}>
                                {stopEtaOverdue && !isDone ? '!' : '~'}{stopEtaStr}
                              </div>
                            )}
                          </div>
                          {idx < arr.length - 1 && (
                            <div className={cn(
                              'h-0.5 w-6 rounded-full mx-1 shrink-0 mb-4',
                              isDone ? 'bg-matcha-400' : 'bg-border',
                            )} />
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Pünktlichkeits-Prognose: projected delivery pace vs. order ETAs */}
                {done > 0 && batch.startzeit && (() => {
                  const elapsedSec = (now - new Date(batch.startzeit).getTime()) / 1000;
                  const avgSecPerStop = elapsedSec / done;
                  const pending = batch.stops
                    .filter((s) => !s.geliefert_am)
                    .sort((a, b) => a.reihenfolge - b.reihenfolge);
                  let onTimeCount = 0; let lateCount = 0;
                  pending.forEach((stop, idx) => {
                    if (stop.order?.eta_earliest) {
                      const projMs = now + avgSecPerStop * (idx + 1) * 1000;
                      if (projMs <= new Date(stop.order.eta_earliest).getTime()) onTimeCount++;
                      else lateCount++;
                    }
                  });
                  const targetSecPerStop = batch.total_eta_min != null ? (batch.total_eta_min * 60) / total : null;
                  const paceRatio = targetSecPerStop ? avgSecPerStop / targetSecPerStop : null;
                  if (paceRatio === null && onTimeCount === 0 && lateCount === 0) return null;
                  return (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Prognose</span>
                      {onTimeCount > 0 && (
                        <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[9px] font-bold">
                          {onTimeCount} pünktlich
                        </span>
                      )}
                      {lateCount > 0 && (
                        <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-bold animate-pulse">
                          {lateCount} zu spät
                        </span>
                      )}
                      {paceRatio !== null && (
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums',
                          paceRatio <= 0.9 ? 'bg-matcha-100 text-matcha-700' :
                          paceRatio <= 1.1 ? 'bg-blue-100 text-blue-700' :
                          paceRatio <= 1.3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
                        )}>
                          Ø {Math.round(avgSecPerStop)}s/Stop {paceRatio <= 1.0 ? '↑ Gut' : '↓ Langsam'}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Änderungsprotokoll — collapsible audit trail */}
                {modsShown && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <GitCommit className="h-3 w-3 text-amber-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Änderungsprotokoll</span>
                    </div>
                    {!batchMods ? (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Lädt…
                      </div>
                    ) : batchMods.length === 0 ? (
                      <div className="text-[10px] text-amber-600/70">Keine Änderungen protokolliert.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {batchMods.map((mod) => {
                          const label = MOD_TYPE_LABELS[mod.type] ?? mod.type;
                          const ts = new Date(mod.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                          const etaDiff = mod.eta_before_min != null && mod.eta_after_min != null
                            ? mod.eta_after_min - mod.eta_before_min
                            : null;
                          return (
                            <div key={mod.id} className="flex items-start gap-2 text-[10px]">
                              <span className="tabular-nums text-amber-500 shrink-0 mt-0.5">{ts}</span>
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-amber-800">{label}</span>
                                {mod.reason && <span className="text-amber-600"> · {mod.reason}</span>}
                                {etaDiff !== null && (
                                  <span className={cn(
                                    'ml-1 font-mono font-bold',
                                    etaDiff > 0 ? 'text-red-600' : 'text-matcha-600',
                                  )}>
                                    {etaDiff > 0 ? `+${etaDiff}m` : `${etaDiff}m`}
                                  </span>
                                )}
                                {mod.performed_by && (
                                  <span className="text-amber-500"> · {mod.performed_by}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
    </div>
  );
}

/* ------------------------------ TodayDispatchOverview ------------------------------ */

function TodayDispatchOverview({
  locationId,
  readyCount,
  enRouteCount,
  onlineDrivers,
}: {
  locationId: string | null;
  readyCount: number;
  enRouteCount: number;
  onlineDrivers: number;
}) {
  const [trend, setTrend] = useState<{
    today: { orders: number; delivered: number; avg_score: number | null };
    yesterday: { orders: number; delivered: number; avg_score: number | null };
    delta_orders: number;
    delta_delivered: number;
  } | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/trends?location_id=${locationId}`);
        if (!res.ok) return;
        const data = await res.json();
        setTrend(data);
      } catch {}
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const hasData = trend && (trend.today.orders > 0 || enRouteCount > 0 || readyCount > 0);
  if (!hasData && readyCount === 0 && enRouteCount === 0) return null;

  const deliveredToday = trend?.today.delivered ?? 0;
  const ordersToday = trend?.today.orders ?? 0;
  const deliveryRate = ordersToday > 0 ? Math.round((deliveredToday / ordersToday) * 100) : null;
  const deltaDelivered = trend?.delta_delivered ?? 0;
  const avgScore = trend?.today.avg_score;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-gradient-to-r from-matcha-50 to-card px-4 py-2.5">
      <div className="flex items-center gap-2 shrink-0">
        <div className="h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-700">Schicht heute</span>
      </div>

      {deliveredToday > 0 && (
        <div className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-matcha-600" />
          <span className="font-display text-sm font-black text-matcha-800">{deliveredToday}</span>
          <span className="text-[10px] text-muted-foreground">geliefert</span>
          {deltaDelivered !== 0 && (
            <span className={cn(
              'text-[9px] font-bold rounded-full px-1.5 py-0.5',
              deltaDelivered > 0 ? 'bg-matcha-100 text-matcha-700' : 'bg-red-100 text-red-700',
            )}>
              {deltaDelivered > 0 ? '+' : ''}{deltaDelivered} vs gestern
            </span>
          )}
        </div>
      )}

      {deliveryRate !== null && (
        <>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
            <span className={cn(
              'font-display text-sm font-black',
              deliveryRate >= 90 ? 'text-matcha-700' : deliveryRate >= 70 ? 'text-amber-700' : 'text-red-700',
            )}>{deliveryRate}%</span>
            <span className="text-[10px] text-muted-foreground">Lieferquote</span>
          </div>
        </>
      )}

      {avgScore !== null && avgScore !== undefined && (
        <>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-matcha-600" />
            <span className={cn(
              'font-display text-sm font-black',
              avgScore >= 80 ? 'text-matcha-700' : avgScore >= 60 ? 'text-amber-700' : 'text-red-700',
            )}>{Math.round(avgScore)}</span>
            <span className="text-[10px] text-muted-foreground">Ø Score</span>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        {readyCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-800 px-2 py-0.5 text-[10px] font-bold">
            <Package className="h-3 w-3" />
            {readyCount} bereit
          </span>
        )}
        {enRouteCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 px-2 py-0.5 text-[10px] font-bold animate-pulse">
            <Truck className="h-3 w-3" />
            {enRouteCount} unterwegs
          </span>
        )}
        {onlineDrivers > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
            <Bike className="h-3 w-3" />
            {onlineDrivers} online
          </span>
        )}
        {/* Warteschlangen-Schätzung: wann ist die Queue leer? */}
        {readyCount > 0 && onlineDrivers > 0 && (() => {
          const avgTourMin = 25;
          const clearMin = Math.ceil(readyCount / onlineDrivers) * avgTourMin;
          const overloaded = clearMin > 60;
          return (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
              overloaded ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-700',
            )}>
              <Clock className="h-3 w-3" />
              Queue ~{clearMin}m
            </span>
          );
        })()}
      </div>
    </div>
  );
}

/* ------------------------------ DispatchNextBestAction ------------------------------ */

function DispatchNextBestAction({
  orders,
  drivers,
  batches,
  onAssign,
}: {
  orders: ReadyOrder[];
  drivers: Driver[];
  batches: Batch[];
  onAssign: (orderIds: string[], driverId: string) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  if (dismissed || orders.length === 0 || drivers.length === 0) return null;

  const now = Date.now();
  const freeDrivers = drivers.filter((d) => !d.aktueller_batch_id);
  if (freeDrivers.length === 0) return null;

  const topOrder = [...orders]
    .sort((a, b) => {
      const aScore = (a.dispatch_score ?? 0) + (a.fertig_am ? Math.floor((now - new Date(a.fertig_am).getTime()) / 60_000) * 2 : 0);
      const bScore = (b.dispatch_score ?? 0) + (b.fertig_am ? Math.floor((now - new Date(b.fertig_am).getTime()) / 60_000) * 2 : 0);
      return bScore - aScore;
    })[0];

  if (!topOrder) return null;

  const waitMin = topOrder.fertig_am
    ? Math.floor((now - new Date(topOrder.fertig_am).getTime()) / 60_000)
    : null;

  const sameZone = topOrder.delivery_zone
    ? orders.filter((o) => o.id !== topOrder.id && o.delivery_zone === topOrder.delivery_zone)
    : [];

  const bestDriver = freeDrivers[0];
  const driverName = bestDriver.employee
    ? `${bestDriver.employee.vorname} ${bestDriver.employee.nachname}`.trim()
    : 'Fahrer';

  const orderIds = [topOrder.id, ...sameZone.slice(0, 2).map((o) => o.id)];
  const bundled = orderIds.length > 1;
  const urgency = (waitMin ?? 0) >= 10 ? 'critical' : (waitMin ?? 0) >= 5 ? 'urgent' : 'normal';

  return (
    <div className={cn(
      'rounded-xl border-2 p-3 transition',
      urgency === 'critical' ? 'border-red-400 bg-red-50 animate-pulse' :
      urgency === 'urgent'   ? 'border-orange-400 bg-orange-50' :
      'border-matcha-300 bg-matcha-50',
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className={cn(
          'h-4 w-4',
          urgency === 'critical' ? 'text-red-600' :
          urgency === 'urgent'   ? 'text-orange-600' : 'text-matcha-700',
        )} />
        <span className={cn(
          'font-display text-xs font-bold uppercase tracking-wider',
          urgency === 'critical' ? 'text-red-800' :
          urgency === 'urgent'   ? 'text-orange-800' : 'text-matcha-800',
        )}>
          Empfehlung — Beste nächste Aktion
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto text-muted-foreground hover:text-foreground text-lg leading-none transition"
          title="Ausblenden"
        >×</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-white/70 px-3 py-2 min-w-0">
          <Package className="h-4 w-4 text-matcha-600 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-xs font-bold text-matcha-700">
                #{topOrder.bestellnummer.replace('FF-', '')}
              </span>
              {topOrder.dispatch_score != null && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  topOrder.dispatch_score >= 80 ? 'bg-matcha-100 text-matcha-800' :
                  topOrder.dispatch_score >= 60 ? 'bg-blue-100 text-blue-800' :
                  'bg-orange-100 text-orange-800',
                )}>⚡ {Math.round(topOrder.dispatch_score)}</span>
              )}
              {waitMin != null && waitMin > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  waitMin >= 10 ? 'bg-red-100 text-red-700' :
                  waitMin >= 5  ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground',
                )}>{waitMin} Min Warte</span>
              )}
              {topOrder.delivery_zone && (
                <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', zoneMeta(topOrder.delivery_zone).cls)}>
                  Zone {topOrder.delivery_zone}
                </span>
              )}
            </div>
            <div className="text-xs font-semibold truncate mt-0.5">{topOrder.kunde_name}</div>
          </div>
        </div>
        {bundled && (
          <div className="flex items-center gap-1 rounded-lg border bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800">
            <RouteIcon className="h-3.5 w-3.5" />
            +{orderIds.length - 1} Bundle · ~{(orderIds.length - 1) * 7} Min gespart
          </div>
        )}
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Truck className="h-3.5 w-3.5" />→
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white/70 px-3 py-2">
          <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
          <div>
            <div className="text-xs font-bold">{driverName}</div>
            <div className="text-[10px] text-muted-foreground">{bestDriver.fahrzeug}</div>
          </div>
        </div>
        <button
          onClick={() => { onAssign(orderIds, bestDriver.employee_id); setDismissed(true); }}
          className={cn(
            'ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition active:scale-[0.98]',
            urgency === 'critical' ? 'bg-red-600 hover:bg-red-700' :
            urgency === 'urgent'   ? 'bg-orange-600 hover:bg-orange-700' :
            'bg-matcha-700 hover:bg-matcha-800',
          )}
        >
          <Check className="h-3.5 w-3.5" />
          {bundled ? `${orderIds.length}× Zuweisen` : 'Zuweisen'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ DriverShiftLeaderboard ------------------------------ */

type ShiftStats = {
  driverId: string;
  name: string;
  initials: string;
  fahrzeug: string;
  completedStops: number;
  totalStops: number;
  totalDistKm: number;
  activeMinutes: number;
  avgEtaAccuracySec: number | null;
  isOnline: boolean;
  isBusy: boolean;
};

function DriverShiftLeaderboard({
  drivers,
  batches,
}: {
  drivers: Driver[];
  batches: Batch[];
}) {
  const supabase = createClient();
  const [dbStats, setDbStats] = useState<Record<string, { stops: number; km: number }>>({});

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const load = async () => {
      const onlineIds = drivers.filter((d) => d.ist_online).map((d) => d.employee_id);
      if (onlineIds.length === 0) return;
      const { data } = await supabase
        .from('delivery_batches')
        .select('fahrer_id, total_distance_km, stops:delivery_batch_stops(id, geliefert_am)')
        .in('fahrer_id', onlineIds)
        .gte('created_at', today.toISOString());
      if (!data) return;
      const map: Record<string, { stops: number; km: number }> = {};
      for (const b of data as any[]) {
        const id = b.fahrer_id as string;
        if (!map[id]) map[id] = { stops: 0, km: 0 };
        map[id].km += b.total_distance_km ?? 0;
        map[id].stops += ((b.stops as any[]) ?? []).filter((s: any) => s.geliefert_am).length;
      }
      setDbStats(map);
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers.length]);

  const onlineDrivers = drivers.filter((d) => d.ist_online);
  if (onlineDrivers.length === 0) return null;

  const stats: ShiftStats[] = onlineDrivers.map((d) => {
    const e = d.employee;
    const name = e ? `${e.vorname} ${e.nachname}`.trim() : '?';
    const initials = e ? `${e.vorname?.[0] ?? ''}${e.nachname?.[0] ?? ''}`.toUpperCase() : '?';
    const batch = batches.find((b) => b.fahrer_id === d.employee_id || b.id === d.aktueller_batch_id);
    const completed = batch?.stops.filter((s) => s.geliefert_am).length ?? 0;
    const total = batch?.stops.length ?? 0;
    const db = dbStats[d.employee_id] ?? { stops: 0, km: 0 };
    const activeMinutes = d.online_seit
      ? Math.floor((Date.now() - new Date(d.online_seit).getTime()) / 60_000)
      : 0;
    return {
      driverId: d.employee_id,
      name,
      initials,
      fahrzeug: d.fahrzeug ?? 'bike',
      completedStops: db.stops,
      totalStops: total,
      totalDistKm: Math.round(db.km * 10) / 10,
      activeMinutes,
      avgEtaAccuracySec: null,
      isOnline: true,
      isBusy: !!d.aktueller_batch_id,
    };
  }).sort((a, b) => b.completedStops - a.completedStops || b.activeMinutes - a.activeMinutes);

  const totalDeliveries = stats.reduce((s, x) => s + x.completedStops, 0);
  if (totalDeliveries === 0 && stats.every((s) => s.activeMinutes < 5)) return null;

  const vehicleEmoji: Record<string, string> = { bike: '🚲', ebike: '🛵', scooter: '🛴', auto: '🚗', fahrrad: '🚲' };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <TrendingUp className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Schicht-Leaderboard</span>
        <span className="ml-2 text-[10px] text-muted-foreground">{onlineDrivers.length} Fahrer online</span>
        {totalDeliveries > 0 && (
          <span className="ml-auto text-[10px] font-bold text-matcha-700">{totalDeliveries} Stopps heute</span>
        )}
      </div>

      <div className="divide-y">
        {stats.map((s, idx) => {
          const rank = idx + 1;
          const rankCls =
            rank === 1 ? 'text-yellow-600 font-black' :
            rank === 2 ? 'text-slate-500 font-black' :
            rank === 3 ? 'text-amber-700 font-black' :
            'text-muted-foreground font-medium';
          const delivPerHour = s.activeMinutes >= 5 && s.completedStops > 0
            ? Math.round((s.completedStops / s.activeMinutes) * 60 * 10) / 10
            : null;
          const effBar = delivPerHour != null ? Math.min(100, Math.round(delivPerHour * 20)) : 0;

          return (
            <div key={s.driverId} className="flex items-center gap-4 px-5 py-3">
              {/* Rank */}
              <div className={cn('w-6 text-sm text-center shrink-0', rankCls)}>
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
              </div>

              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-matcha-700 font-display text-xs font-bold text-white">
                  {s.initials}
                </div>
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
                    s.isBusy ? 'bg-orange-500' : 'bg-matcha-400',
                  )}
                  title={s.isBusy ? 'Unterwegs' : 'Frei'}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate">{s.name}</span>
                  <span>{vehicleEmoji[s.fahrzeug] ?? '🚲'}</span>
                  {s.isBusy && (
                    <span className="shrink-0 text-[9px] font-bold rounded-full bg-orange-100 text-orange-800 px-1.5 py-0.5">
                      {s.totalStops > 0 ? `${batches.find(b => b.fahrer_id === s.driverId)?.stops.filter(x => x.geliefert_am).length ?? 0}/${s.totalStops} Stop` : 'unterwegs'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {/* Efficiency bar */}
                  {effBar > 0 && (
                    <div className="flex-1 max-w-[80px] h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          effBar >= 80 ? 'bg-matcha-500' : effBar >= 50 ? 'bg-amber-400' : 'bg-blue-400',
                        )}
                        style={{ width: `${effBar}%` }}
                      />
                    </div>
                  )}
                  {delivPerHour != null && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">{delivPerHour}/h</span>
                  )}
                  {s.activeMinutes > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {s.activeMinutes >= 60
                        ? `${Math.floor(s.activeMinutes / 60)}h ${s.activeMinutes % 60}m`
                        : `${s.activeMinutes}m`} online
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 shrink-0 text-right">
                <div>
                  <div className={cn(
                    'font-display text-lg font-black leading-none tabular-nums',
                    s.completedStops >= 5 ? 'text-matcha-700' : s.completedStops >= 2 ? 'text-amber-700' : 'text-muted-foreground',
                  )}>
                    {s.completedStops}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Stopps</div>
                </div>
                {s.totalDistKm > 0 && (
                  <div>
                    <div className="font-display text-sm font-bold leading-none text-muted-foreground tabular-nums">
                      {s.totalDistKm}
                    </div>
                    <div className="text-[9px] text-muted-foreground">km</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: aggregate */}
      {totalDeliveries > 0 && (
        <div className="flex items-center gap-4 border-t bg-muted/30 px-5 py-2 text-[10px] text-muted-foreground">
          <span><span className="font-bold text-foreground">{totalDeliveries}</span> Stopps gesamt</span>
          {stats.some((s) => s.totalDistKm > 0) && (
            <span>
              <span className="font-bold text-foreground">
                {Math.round(stats.reduce((s, x) => s + x.totalDistKm, 0) * 10) / 10}
              </span> km gesamt
            </span>
          )}
          <span className="ml-auto">
            Ø <span className="font-bold text-foreground">
              {stats.filter((s) => s.completedStops > 0).length > 0
                ? Math.round(totalDeliveries / stats.filter((s) => s.completedStops > 0).length * 10) / 10
                : 0}
            </span>/Fahrer
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ DeliveryWindowsPanel ------------------------------ */

type WindowSlot = {
  slot_id: string;
  window_start_utc: string;
  window_end_utc: string;
  slot_type: string;
  label: string | null;
  extra_fee_eur: number;
  remaining_capacity: number;
  utilization_pct: number;
  is_filling_fast: boolean;
};

function DeliveryWindowsPanel() {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<WindowSlot[]>([]);
  const [stats, setStats] = useState<{
    total_bookings_today: number;
    confirmed: number;
    dispatched: number;
    delivered: number;
    missed: number;
    avg_utilization_pct: number;
  } | null>(null);

  useEffect(() => {
    const load = () => {
      Promise.all([
        fetch('/api/delivery/admin/windows?action=availability').then(r => r.ok ? r.json() : null),
        fetch('/api/delivery/admin/windows?action=stats').then(r => r.ok ? r.json() : null),
      ]).then(([avail, st]) => {
        if (avail?.today?.slots?.length) setSlots(avail.today.slots);
        if (st && !st._fallback) setStats(st);
      }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, []);

  if (slots.length === 0 && !stats) return null;

  const now = new Date();
  const upcoming = slots.filter(s => new Date(s.window_end_utc) > now);
  const totalBooked = stats?.total_bookings_today ?? 0;

  if (totalBooked === 0 && upcoming.length === 0) return null;

  const slotTypeMeta = (type: string) =>
    type === 'express' ? { label: 'Express', cls: 'bg-amber-100 text-amber-800' }
    : type === 'scheduled' ? { label: 'Geplant', cls: 'bg-blue-100 text-blue-800' }
    : { label: 'Standard', cls: 'bg-stone-100 text-stone-700' };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-3 border-b text-left hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Lieferfenster · Heute</span>
          {totalBooked > 0 && (
            <Badge variant="secondary">{totalBooked} Buchungen</Badge>
          )}
          {upcoming.some(s => s.is_filling_fast) && (
            <Badge variant="destructive" className="text-[10px]">Fast voll!</Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Stats row */}
          {stats && totalBooked > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { label: 'Gesamt', value: stats.total_bookings_today, cls: 'text-foreground' },
                { label: 'Bestätigt', value: stats.confirmed, cls: 'text-blue-700' },
                { label: 'Unterwegs', value: stats.dispatched, cls: 'text-amber-700' },
                { label: 'Geliefert', value: stats.delivered, cls: 'text-matcha-700' },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <div className={`text-lg font-black tabular-nums ${m.cls}`}>{m.value}</div>
                  <div className="text-[10px] text-muted-foreground">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming slots */}
          {upcoming.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bevorstehende Slots</div>
              {upcoming.slice(0, 6).map(slot => {
                const start = new Date(slot.window_start_utc);
                const end   = new Date(slot.window_end_utc);
                const isActive = start <= now && now < end;
                const pct = Math.min(100, Math.round(slot.utilization_pct));
                const meta = slotTypeMeta(slot.slot_type);
                return (
                  <div key={slot.slot_id} className={cn(
                    'rounded-xl border p-2.5',
                    isActive ? 'border-matcha-300 bg-matcha-50' :
                    slot.is_filling_fast ? 'border-amber-300 bg-amber-50' :
                    'border-border bg-card',
                  )}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                        {start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', meta.cls)}>{meta.label}</span>
                      {slot.label && <span className="text-[10px] text-muted-foreground truncate flex-1">{slot.label}</span>}
                      {isActive && <span className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-matcha-500 animate-pulse" />}
                      {slot.extra_fee_eur > 0 && (
                        <span className="text-[10px] font-bold text-amber-700">+{slot.extra_fee_eur.toFixed(2)} €</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-matcha-500')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={cn('text-[10px] font-bold tabular-nums shrink-0', pct >= 90 ? 'text-red-700' : pct >= 70 ? 'text-amber-700' : 'text-muted-foreground')}>
                        {pct}%
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {slot.remaining_capacity} frei
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {upcoming.length === 0 && totalBooked === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Keine Lieferfenster für heute konfiguriert.</p>
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ ScheduledOrdersPanel ------------------------------ */

function ScheduledOrdersPanel({ summary, orders }: {
  summary: { total: number; pending: number; released: number; next_due_in_min: number | null };
  orders: { id: string; bestellnummer: string; kunde_name: string | null; scheduled_at: string; schedule_status: string; mins_until_kitchen_start: number | null }[];
}) {
  const [open, setOpen] = useState(false);

  const nextDue = summary.next_due_in_min;
  const isUrgent = nextDue !== null && nextDue <= 15;

  return (
    <div className={cn(
      'flex flex-col rounded-xl border px-4 py-3 text-sm transition',
      isUrgent
        ? 'border-amber-300 bg-amber-50'
        : 'border-matcha-200 bg-matcha-50',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 w-full text-left"
      >
        <Clock className={cn('h-4 w-4 shrink-0', isUrgent ? 'text-amber-600' : 'text-matcha-600')} />
        <div className="flex-1 flex flex-wrap items-center gap-2">
          <span className={cn('font-bold', isUrgent ? 'text-amber-800' : 'text-matcha-800')}>
            {summary.total} Vorbestellung{summary.total !== 1 ? 'en'  : ''} · nächste 4h
          </span>
          {summary.pending > 0 && (
            <span className="rounded-full bg-white/70 border border-matcha-200 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {summary.pending} ausstehend
            </span>
          )}
          {summary.released > 0 && (
            <span className="rounded-full bg-matcha-200 px-2 py-0.5 text-[10px] font-bold text-matcha-800">
              {summary.released} freigegeben
            </span>
          )}
          {nextDue !== null && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
              isUrgent ? 'bg-amber-200 text-amber-900' : 'bg-matcha-200 text-matcha-900',
            )}>
              Nächste Küche in {nextDue <= 0 ? 'jetzt' : `${nextDue} Min`}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && orders.length > 0 && (
        <div className="mt-3 divide-y divide-matcha-200/60 border-t border-matcha-200/60">
          {orders.slice(0, 8).map(o => {
            const sched = new Date(o.scheduled_at);
            const isPending = o.schedule_status === 'scheduled';
            const minsK = o.mins_until_kitchen_start;
            return (
              <div key={o.id} className="flex items-center gap-3 py-2">
                <div className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  isPending ? 'bg-amber-400' : 'bg-matcha-500',
                )} />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs font-bold text-foreground">
                    #{o.bestellnummer.replace('FF-', '')}
                  </span>
                  {o.kunde_name && (
                    <span className="ml-2 text-xs text-muted-foreground truncate">{o.kunde_name}</span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs font-bold tabular-nums">
                    {sched.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {minsK !== null && minsK > 0 && (
                    <div className={cn('text-[9px] tabular-nums', minsK <= 10 ? 'text-amber-700 font-bold' : 'text-muted-foreground')}>
                      Küche in {minsK} Min
                    </div>
                  )}
                  {isPending && (minsK === null || minsK <= 0) && (
                    <div className="text-[9px] text-amber-700 font-bold">▶ Freigeben!</div>
                  )}
                </div>
              </div>
            );
          })}
          {orders.length > 8 && (
            <div className="pt-2 text-[11px] text-muted-foreground text-center">+ {orders.length - 8} weitere Vorbestellungen</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ ShiftClaimsPanel ------------------------------ */

function ShiftClaimsPanel({ claims: initialClaims }: { claims: ShiftClaimItem[] }) {
  const [open, setOpen] = useState(false);
  const [claims, setClaims] = useState(initialClaims);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { setClaims(initialClaims); }, [initialClaims]);

  const pendingClaims = claims.filter(c => c.status === 'pending');
  if (pendingClaims.length === 0) return null;

  async function doAction(claimId: string, action: 'approve' | 'reject', reason?: string) {
    setActing(claimId);
    try {
      const body: Record<string, string> = { action, claim_id: claimId };
      if (reason) body.reason = reason;
      const res = await fetch('/api/delivery/admin/shift-claims', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setClaims(cs => cs.map(c => c.id === claimId
          ? { ...c, status: action === 'approve' ? 'approved' : 'rejected' }
          : c,
        ));
        setRejectId(null);
        setRejectReason('');
      }
    } finally {
      setActing(null);
    }
  }

  return (
    <Card className="p-4 border-amber-300 bg-amber-50">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-3 w-full text-left">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-amber-800 shrink-0">
          <User className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-900 text-sm">Schichtanfragen</span>
            <span className="rounded-full bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
              {pendingClaims.length}
            </span>
          </div>
          <div className="text-xs text-amber-700 mt-0.5">
            {pendingClaims.length} offene Anfrage{pendingClaims.length !== 1 ? 'n' : ''} warten auf Genehmigung
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-amber-600 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-amber-600 shrink-0" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2.5 border-t border-amber-200 pt-3">
          {pendingClaims.map(claim => {
            const start = new Date(claim.plannedStart);
            const end   = new Date(claim.plannedEnd);
            const isActing = acting === claim.id;
            const isReject = rejectId === claim.id;
            return (
              <div key={claim.id} className="rounded-xl border border-amber-200 bg-white p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-foreground">
                      {claim.driverName ?? 'Unbekannter Fahrer'}
                    </div>
                    {claim.driverVehicle && (
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {claim.driverVehicle}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-xs tabular-nums text-foreground">
                      {start.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      {' '}
                      {start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {claim.notes && (
                      <div className="mt-1 text-[11px] text-muted-foreground italic">
                        &ldquo;{claim.notes}&rdquo;
                      </div>
                    )}
                  </div>
                  {!isReject && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => doAction(claim.id, 'approve')}
                        disabled={isActing}
                        className="flex items-center gap-1.5 rounded-lg bg-matcha-700 text-white px-2.5 py-1.5 text-xs font-bold disabled:opacity-50 transition"
                      >
                        <Check className="h-3 w-3" />
                        Genehmigen
                      </button>
                      <button
                        onClick={() => { setRejectId(claim.id); setRejectReason(''); }}
                        disabled={isActing}
                        className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 px-2.5 py-1.5 text-xs font-bold disabled:opacity-50 transition"
                      >
                        Ablehnen
                      </button>
                    </div>
                  )}
                </div>
                {isReject && (
                  <div className="mt-2 flex gap-2 items-center border-t border-amber-100 pt-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Ablehnungsgrund (optional)"
                      className="flex-1 h-8 rounded-lg border px-3 text-xs bg-background"
                    />
                    <button
                      onClick={() => doAction(claim.id, 'reject', rejectReason || undefined)}
                      disabled={isActing}
                      className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-bold disabled:opacity-50 transition"
                    >
                      {isActing ? '…' : 'Bestätigen'}
                    </button>
                    <button
                      onClick={() => setRejectId(null)}
                      className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground transition"
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ StaleOrdersPanel ------------------------------ */

function StaleOrdersPanel({ orders }: {
  orders: { id: string; bestellnummer: string; age_min: number; dispatch_attempts: number; escalation_status: string | null; delivery_zone: string | null }[]
}) {
  const [open, setOpen] = useState(false);

  const escalated = orders.filter(o => o.escalation_status === 'escalated' || o.escalation_status === 'needs_escalation');
  if (orders.length === 0) return null;

  const isUrgent = escalated.length > 0;

  return (
    <div className={cn(
      'rounded-xl border-2 px-4 py-3',
      isUrgent ? 'border-red-400 bg-red-50' : 'border-amber-300 bg-amber-50',
    )}>
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-3 w-full text-left">
        <AlertTriangle className={cn('h-4 w-4 shrink-0', isUrgent ? 'text-red-600 animate-pulse' : 'text-amber-600')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-bold text-sm', isUrgent ? 'text-red-900' : 'text-amber-900')}>
              {orders.length} Bestellung{orders.length !== 1 ? 'en' : ''} ohne Fahrer (&gt;10 Min)
            </span>
            {escalated.length > 0 && (
              <span className="rounded-full bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5">
                {escalated.length}× eskaliert
              </span>
            )}
          </div>
          <div className={cn('text-xs mt-0.5', isUrgent ? 'text-red-700' : 'text-amber-700')}>
            Dispatch-Radius wurde bereits erweitert — manuelles Eingreifen empfohlen
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
          {orders.slice(0, 8).map(o => {
            const isEsc = o.escalation_status === 'escalated';
            const needsEsc = o.escalation_status === 'needs_escalation';
            return (
              <div key={o.id} className={cn(
                'rounded-xl border p-3 flex items-center gap-3',
                isEsc ? 'border-red-200 bg-red-50' : needsEsc ? 'border-amber-200 bg-amber-50' : 'border-border bg-card',
              )}>
                <div className={cn('h-2.5 w-2.5 rounded-full shrink-0',
                  isEsc ? 'bg-red-500 animate-pulse' : needsEsc ? 'bg-amber-500' : 'bg-amber-300',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-xs text-foreground">
                    #{o.bestellnummer.replace(/^[A-Z]+-/, '')}
                  </div>
                  {o.delivery_zone && (
                    <div className="text-[10px] text-muted-foreground">{o.delivery_zone}</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn('font-bold tabular-nums text-xs', o.age_min >= 20 ? 'text-red-700' : 'text-amber-700')}>
                    {o.age_min} Min
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {o.dispatch_attempts} Versuch{o.dispatch_attempts !== 1 ? 'e' : ''}
                  </div>
                </div>
                {isEsc && (
                  <span className="rounded-full bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 shrink-0">Eskaliert</span>
                )}
                {needsEsc && !isEsc && (
                  <span className="rounded-full bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 shrink-0">! Eskalieren</span>
                )}
              </div>
            );
          })}
          {orders.length > 8 && (
            <div className="text-center text-[11px] text-muted-foreground">+ {orders.length - 8} weitere</div>
          )}
        </div>
      )}
    </div>
  );
}

function LiveDeliveryHealthPanel({
  health,
}: {
  health: {
    slaOnTimePct: number | null;
    etaAccuracyPct: number | null;
    avgDeliveryMin: number | null;
    totalDeliveriesToday: number | null;
    driverUtilization: number | null;
  };
}) {
  const metrics = [
    { label: 'SLA On-Time', value: health.slaOnTimePct, unit: '%', good: 85, ok: 65, icon: '🎯' },
    { label: 'ETA-Genauigkeit', value: health.etaAccuracyPct, unit: '%', good: 80, ok: 60, icon: '⏱' },
    { label: 'Fahrer online', value: health.driverUtilization, unit: '%', good: 70, ok: 40, icon: '🛵' },
    { label: 'Ø Lieferzeit', value: health.avgDeliveryMin != null ? Math.round(health.avgDeliveryMin) : null, unit: ' Min', good: 30, ok: 45, invert: true, icon: '🚀' },
    { label: 'Lieferungen heute', value: health.totalDeliveriesToday, unit: '', good: 10, ok: 5, icon: '📦' },
  ].filter((m) => m.value != null);
  if (metrics.length < 2) return null;
  const overallScore = (() => {
    let sum = 0; let count = 0;
    if (health.slaOnTimePct != null)      { sum += health.slaOnTimePct;  count++; }
    if (health.etaAccuracyPct != null)    { sum += health.etaAccuracyPct; count++; }
    if (health.driverUtilization != null) { sum += health.driverUtilization; count++; }
    return count > 0 ? Math.round(sum / count) : null;
  })();
  const healthColor = overallScore != null
    ? overallScore >= 80 ? 'text-matcha-700' : overallScore >= 60 ? 'text-amber-700' : 'text-red-700'
    : 'text-muted-foreground';
  const healthLabel = overallScore != null
    ? overallScore >= 80 ? 'Gut' : overallScore >= 60 ? 'Mäßig' : 'Kritisch'
    : '—';
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">❤️</span>
        <span className="font-display text-xs font-bold uppercase tracking-wider">Delivery Health</span>
        {overallScore != null && (
          <span className={cn('ml-auto text-sm font-black tabular-nums', healthColor)}>
            {overallScore}% · {healthLabel}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => {
          const val = m.value!;
          const isGood = (m as { invert?: boolean }).invert ? val <= m.good : val >= m.good;
          const isOk   = (m as { invert?: boolean }).invert ? val <= m.ok   : val >= m.ok;
          const pct    = (m as { invert?: boolean }).invert
            ? Math.max(0, Math.min(100, Math.round((1 - (val - m.good) / Math.max(1, m.ok - m.good)) * 100)))
            : Math.max(0, Math.min(100, Math.round((val / 100) * 100)));
          const barCls = isGood ? 'bg-matcha-500' : isOk ? 'bg-amber-400' : 'bg-red-400';
          const textCls = isGood ? 'text-matcha-700' : isOk ? 'text-amber-700' : 'text-red-700';
          return (
            <div key={m.label} className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground font-medium flex items-center gap-0.5">
                  <span>{m.icon}</span> {m.label}
                </span>
                <span className={cn('font-black tabular-nums', textCls)}>{val}{m.unit}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', barCls)}
                  style={{ width: `${m.unit === '' ? Math.min(100, val * 4) : pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ ZoneCapacityPanel ------------------------------ */

function ZoneCapacityPanel({ orders, drivers }: { orders: ReadyOrder[]; drivers: Driver[] }) {
  const ZONES = ['A', 'B', 'C', 'D'] as const;
  const onlineDrivers = drivers.filter((d) => d.ist_online);
  const idleDrivers = onlineDrivers.filter((d) => !d.aktueller_batch_id);

  const zoneData = ZONES.map((zone) => {
    const zoneOrders = orders.filter((o) => o.delivery_zone === zone);
    return { zone, count: zoneOrders.length };
  }).filter((z) => z.count > 0);

  if (zoneData.length === 0) return null;

  const total = zoneData.reduce((s, z) => s + z.count, 0);
  const maxCount = Math.max(...zoneData.map((z) => z.count), 1);

  const ZONE_META: Record<string, { cls: string; bar: string; label: string }> = {
    A: { cls: 'border-emerald-200 bg-emerald-50', bar: 'bg-emerald-400', label: 'Nah' },
    B: { cls: 'border-blue-200 bg-blue-50', bar: 'bg-blue-400', label: 'Mittel' },
    C: { cls: 'border-amber-200 bg-amber-50', bar: 'bg-amber-400', label: 'Weit' },
    D: { cls: 'border-red-200 bg-red-50', bar: 'bg-red-400', label: 'Fernzone' },
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b">
        <Target className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Zonen-Kapazität</span>
        <Badge variant="secondary">{total} bereit</Badge>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="font-bold text-matcha-700">{idleDrivers.length}</span> Fahrer frei ·
          <span className="font-bold">{onlineDrivers.length}</span> online
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {zoneData.map(({ zone, count }) => {
          const meta = ZONE_META[zone] ?? ZONE_META['D'];
          const pct = Math.round((count / maxCount) * 100);
          const pressure = count >= 4 ? 'hoch' : count >= 2 ? 'normal' : 'niedrig';
          return (
            <div key={zone} className={cn('rounded-xl border p-3', meta.cls)}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-lg font-black text-foreground">Zone {zone}</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase">{meta.label}</span>
              </div>
              <div className="text-3xl font-black tabular-nums mb-1">{count}</div>
              <div className="text-[10px] text-muted-foreground mb-2">
                {count === 1 ? 'Bestellung' : 'Bestellungen'}
              </div>
              <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', meta.bar, pressure === 'hoch' && 'animate-pulse')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {pressure === 'hoch' && (
                <div className="mt-1 text-[9px] font-bold text-red-600 uppercase tracking-wider">Hohe Last</div>
              )}
            </div>
          );
        })}
        {/* Placeholder zones (empty) */}
        {ZONES.filter((z) => !zoneData.find((d) => d.zone === z)).map((zone) => {
          const meta = ZONE_META[zone];
          return (
            <div key={zone} className="rounded-xl border border-dashed border-black/10 p-3 opacity-30">
              <div className="font-display text-lg font-black text-muted-foreground">Zone {zone}</div>
              <div className="text-2xl font-black text-muted-foreground tabular-nums">0</div>
              <div className="text-[10px] text-muted-foreground">{meta.label}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- DemandForecastPanel ---------- */

type ForecastSlot = {
  hourLocal: string;
  expectedOrders: number;
  recommendedMinDrivers: number;
};

function DemandForecastPanel({ locationId }: { locationId: string | null }) {
  const [slots, setSlots] = useState<ForecastSlot[]>([]);
  const [summary, setSummary] = useState<{
    totalExpectedOrders: number;
    peakSlot: { hourLocal: string } | null;
    recommendedMaxDrivers: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/forecast?location_id=${locationId}&hours=6`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.slots) {
          setSlots((d.slots as ForecastSlot[]).slice(0, 6));
          setSummary(d.summary ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && slots.length === 0) return null;

  const maxExpected = slots.reduce((m, s) => Math.max(m, s.expectedOrders), 1);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b text-left hover:bg-muted/30 transition"
      >
        <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Nachfrage-Prognose</span>
        {summary && !expanded && (
          <span className="ml-auto text-xs text-muted-foreground">
            ~{summary.totalExpectedOrders} Bestellungen in 6h erwartet
          </span>
        )}
        {expanded
          ? <ChevronUp size={14} className="ml-auto text-muted-foreground" />
          : <ChevronDown size={14} className="ml-auto shrink-0 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Lade Prognose…
            </div>
          )}
          {!loading && slots.length > 0 && (
            <>
              {/* Bar chart */}
              <div className="flex items-end gap-2 mb-3" style={{ height: '96px' }}>
                {slots.map((slot, i) => {
                  const pct = slot.expectedOrders / maxExpected;
                  const isPeak = summary?.peakSlot?.hourLocal === slot.hourLocal;
                  const barH = Math.max(8, Math.round(pct * 64));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[10px] font-bold tabular-nums text-foreground leading-none">
                        {slot.expectedOrders}
                      </div>
                      <div className="w-full flex items-end justify-center" style={{ height: '64px' }}>
                        <div
                          className={cn(
                            'w-full rounded-t transition-all',
                            isPeak ? 'bg-matcha-500' : 'bg-matcha-200',
                          )}
                          style={{ height: `${barH}px` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums leading-none">{slot.hourLocal}</div>
                      <div className={cn(
                        'text-[9px] font-bold tabular-nums leading-none',
                        slot.recommendedMinDrivers >= 3 ? 'text-red-500' :
                        slot.recommendedMinDrivers >= 2 ? 'text-amber-500' : 'text-matcha-500',
                      )}>
                        {slot.recommendedMinDrivers}F
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Summary footer */}
              {summary && (
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                  <div>
                    Peak:{' '}
                    <span className="font-bold text-foreground">{summary.peakSlot?.hourLocal ?? '—'} Uhr</span>
                  </div>
                  <div>
                    Max. Fahrer:{' '}
                    <span className="font-bold text-foreground">{summary.recommendedMaxDrivers}</span>
                  </div>
                  <div>
                    Gesamt:{' '}
                    <span className="font-bold text-foreground">~{summary.totalExpectedOrders} Bestellungen</span>
                  </div>
                  <div className="ml-auto text-[10px] text-muted-foreground">F = empf. Fahrer/Slot</div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ FailedAttemptsPanel ------------------------------ */

type FailedAttemptItem = {
  id: string;
  orderId: string;
  reason: string;
  attemptNumber: number;
  notes: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  bestellnummer: string | null;
  kundeName: string | null;
  kundeAdresse: string | null;
  driverName: string | null;
};

const FAILED_REASON_LABELS: Record<string, string> = {
  no_answer: 'Nicht geöffnet',
  wrong_address: 'Falsche Adresse',
  refused: 'Annahme verweigert',
  access_denied: 'Kein Zutritt',
  not_home: 'Nicht zuhause',
  other: 'Sonstiges',
};

function FailedAttemptsPanel({
  attempts,
  onRefresh,
}: {
  attempts: FailedAttemptItem[];
  onRefresh: () => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? attempts : attempts.slice(0, 3);

  async function scheduleRetry(id: string, minutesFromNow: number) {
    setPendingId(id);
    try {
      const nextAt = new Date(Date.now() + minutesFromNow * 60_000).toISOString();
      await fetch('/api/delivery/admin/failed-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'schedule_retry', attempt_id: id, next_attempt_at: nextAt }),
      });
      onRefresh();
    } catch {} finally {
      setPendingId(null);
    }
  }

  async function resolveAttempt(id: string, resolution: string) {
    setPendingId(id);
    try {
      await fetch('/api/delivery/admin/failed-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', attempt_id: id, resolution }),
      });
      onRefresh();
    } catch {} finally {
      setPendingId(null);
    }
  }

  return (
    <Card className="overflow-hidden border-2 border-red-200">
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
        <span className="font-display text-sm font-bold text-red-900">Fehlgeschlagene Zustellung</span>
        <Badge variant="destructive" className="ml-auto">{attempts.length}</Badge>
      </div>
      <div className="divide-y">
        {displayed.map((a) => {
          const ago = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 60_000);
          const isBusy = pendingId === a.id;
          return (
            <div key={a.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-red-700">#{a.attemptNumber}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-sm font-bold">{a.kundeName ?? 'Unbekannt'}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {FAILED_REASON_LABELS[a.reason] ?? a.reason}
                    </Badge>
                    {a.bestellnummer && (
                      <span className="text-[11px] text-muted-foreground font-mono">#{a.bestellnummer.slice(-4)}</span>
                    )}
                  </div>
                  {a.kundeAdresse && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin size={10} />
                      {a.kundeAdresse}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      vor {ago < 60 ? `${ago}m` : `${Math.floor(ago / 60)}h`}
                    </span>
                    {a.driverName && <span>Fahrer: {a.driverName}</span>}
                    {a.notes && <span className="italic truncate max-w-[180px]">{a.notes}</span>}
                  </div>
                  {a.nextAttemptAt && (
                    <div className="mt-1 text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                      <Clock size={10} />
                      Retry: {new Date(a.nextAttemptAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => scheduleRetry(a.id, 30)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition"
                >
                  <Clock size={11} />
                  Retry in 30m
                </button>
                <button
                  onClick={() => scheduleRetry(a.id, 60)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition"
                >
                  <Clock size={11} />
                  in 60m
                </button>
                <button
                  onClick={() => resolveAttempt(a.id, 'returned_to_restaurant')}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition"
                >
                  {isBusy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Zurück ins Restaurant
                </button>
                <button
                  onClick={() => resolveAttempt(a.id, 'cancelled')}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                >
                  <X size={11} />
                  Stornieren
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {attempts.length > 3 && (
        <div className="border-t px-5 py-2 bg-muted/30">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1"
          >
            {showAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAll ? 'Weniger anzeigen' : `${attempts.length - 3} weitere anzeigen`}
          </button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ TodayStatsBar ------------------------------ */

function TodayStatsBar({
  stats,
  zoneCounts,
}: {
  stats: { total_orders: number; dispatched: number; delivered: number; pending: number; drivers_online: number };
  zoneCounts: Record<string, number>;
}) {
  const topZones = Object.entries(zoneCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const deliveryPct = stats.total_orders > 0
    ? Math.round((stats.delivered / stats.total_orders) * 100)
    : 0;

  return (
    <div className="rounded-xl border bg-card px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
        <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wide text-matcha-700">Heute</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Bestellungen</span>
        <span className="font-bold tabular-nums">{stats.total_orders}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-matcha-600" />
        <span className="text-xs text-muted-foreground">Zugestellt</span>
        <span className="font-bold tabular-nums text-matcha-700">{stats.delivered}</span>
        {stats.total_orders > 0 && (
          <span className="text-[11px] text-muted-foreground">({deliveryPct}%)</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs text-muted-foreground">Ausstehend</span>
        <span className="font-bold tabular-nums text-amber-700">{stats.pending}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs text-muted-foreground">Dispatched</span>
        <span className="font-bold tabular-nums">{stats.dispatched}</span>
      </div>

      {topZones.length > 0 && (
        <div className="flex items-center gap-1.5 ml-auto">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Zonen:</span>
          <div className="flex items-center gap-1">
            {topZones.map(([zone, count]) => (
              <span key={zone} className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
                {zone} <span className="text-muted-foreground">·{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-matcha-500 rounded-full transition-all duration-700"
          style={{ width: `${deliveryPct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------ RecoveryPanel ------------------------------ */

const RECOVERABLE_STATUSES = ['storniert', 'cancelled', 'fehlgeschlagen', 'failed', 'stuck'];

function RecoveryPanel({
  batches,
  recoveryEvents,
  recoveryPending,
  onRecover,
}: {
  batches: Batch[];
  recoveryEvents: { id: string; batch_id: string; triggered_at: string; recovery_type: string; success: boolean; error_message: string | null }[];
  recoveryPending: string | null;
  onRecover: (batchId: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const recoverableBatches = batches.filter((b) => RECOVERABLE_STATUSES.includes(b.status));

  if (recoverableBatches.length === 0 && recoveryEvents.length === 0) return null;

  return (
    <Card className="overflow-hidden border-amber-200">
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-amber-50">
        <RotateCcw className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="font-display text-sm font-bold text-amber-900">Batch-Wiederherstellung</span>
        {recoverableBatches.length > 0 && (
          <Badge className="ml-auto bg-amber-100 text-amber-800 border-amber-300">
            {recoverableBatches.length} wiederherstellbar
          </Badge>
        )}
      </div>

      {recoverableBatches.length > 0 && (
        <div className="divide-y">
          {recoverableBatches.map((b) => {
            const isBusy = recoveryPending === b.id;
            const driverName = b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname}` : null;
            const stopCount = b.stops?.length ?? 0;
            return (
              <div key={b.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-sm font-bold font-mono">
                      {b.id.slice(-6).toUpperCase()}
                    </span>
                    <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">
                      {b.status}
                    </Badge>
                    {b.zone && (
                      <Badge variant="secondary" className="text-[10px]">{b.zone}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {driverName && <span className="flex items-center gap-1"><User size={10} />{driverName}</span>}
                    {stopCount > 0 && <span className="flex items-center gap-1"><Package size={10} />{stopCount} Stopps</span>}
                    {b.total_distance_km && (
                      <span className="flex items-center gap-1"><RouteIcon size={10} />{b.total_distance_km.toFixed(1)} km</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onRecover(b.id)}
                  disabled={isBusy || recoveryPending !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition shrink-0"
                >
                  {isBusy ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                  Wiederherstellen
                </button>
              </div>
            );
          })}
        </div>
      )}

      {recoveryEvents.length > 0 && (
        <div className="border-t">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center gap-2 px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition"
          >
            <History size={13} />
            Verlauf ({recoveryEvents.length})
            {showHistory ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
          </button>
          {showHistory && (
            <div className="divide-y border-t">
              {recoveryEvents.map((ev) => {
                const when = new Date(ev.triggered_at);
                const ago = Math.floor((Date.now() - when.getTime()) / 60_000);
                return (
                  <div key={ev.id} className="flex items-center gap-3 px-5 py-2 text-xs">
                    {ev.success
                      ? <CheckCircle2 size={13} className="text-matcha-600 shrink-0" />
                      : <XCircle size={13} className="text-red-500 shrink-0" />}
                    <span className="font-mono text-muted-foreground">{ev.batch_id.slice(-6).toUpperCase()}</span>
                    <span className="text-muted-foreground">{ev.recovery_type}</span>
                    <span className="ml-auto text-muted-foreground">
                      {ago < 60 ? `vor ${ago}m` : `vor ${Math.floor(ago / 60)}h`}
                    </span>
                    {ev.error_message && (
                      <span className="text-red-600 italic truncate max-w-[160px]">{ev.error_message}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── BroadcastPanel ───────────────────────────────────────────────────────────

function BroadcastPanel({
  locationId,
  broadcasts,
  sending,
  onSend,
  onDelete,
}: {
  locationId: string | null;
  broadcasts: { id: string; message: string; priority: string; sentByName: string | null; createdAt: string; isActive: boolean; readCount: number }[];
  sending: boolean;
  onSend: (msg: string, priority: 'normal' | 'urgent') => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  const activeCount = broadcasts.filter(b => b.isActive).length;

  async function handleSend() {
    if (!msg.trim() || !locationId) return;
    await onSend(msg.trim(), priority);
    setMsg('');
  }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition"
      >
        <Megaphone size={16} className="text-blue-600 shrink-0" />
        <span className="font-display text-sm font-bold flex-1 text-left">Fahrer-Nachrichten</span>
        {activeCount > 0 && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
            {activeCount} aktiv
          </Badge>
        )}
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          <div className="px-5 py-4 space-y-3">
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value.slice(0, 280))}
              placeholder="Nachricht an alle aktiven Fahrer..."
              rows={2}
              className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border overflow-hidden text-xs">
                <button
                  onClick={() => setPriority('normal')}
                  className={cn('px-3 py-1.5 font-medium transition', priority === 'normal' ? 'bg-blue-600 text-white' : 'hover:bg-muted/50')}
                >
                  Normal
                </button>
                <button
                  onClick={() => setPriority('urgent')}
                  className={cn('px-3 py-1.5 font-medium transition', priority === 'urgent' ? 'bg-red-600 text-white' : 'hover:bg-muted/50')}
                >
                  Dringend
                </button>
              </div>
              <span className="text-[10px] text-muted-foreground ml-auto">{msg.length}/280</span>
              <button
                onClick={handleSend}
                disabled={sending || !msg.trim() || !locationId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Senden
              </button>
            </div>
          </div>

          {broadcasts.length === 0 ? (
            <div className="px-5 py-3 text-xs text-muted-foreground italic">Keine Nachrichten vorhanden.</div>
          ) : (
            broadcasts.slice(0, 8).map(b => {
              const ago = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / 60_000);
              return (
                <div key={b.id} className="flex items-start gap-3 px-5 py-3">
                  <div className={cn('mt-0.5 shrink-0 h-2 w-2 rounded-full', b.isActive ? (b.priority === 'urgent' ? 'bg-red-500' : 'bg-blue-500') : 'bg-muted-foreground/30')} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', !b.isActive && 'text-muted-foreground line-through')}>{b.message}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      {b.sentByName && <span>{b.sentByName}</span>}
                      <span>·</span>
                      <span>{ago < 60 ? `vor ${ago} Min` : `vor ${Math.floor(ago / 60)} h`}</span>
                      {b.readCount > 0 && <><span>·</span><span>{b.readCount}× gelesen</span></>}
                    </div>
                  </div>
                  {b.isActive && (
                    <button
                      onClick={() => onDelete(b.id)}
                      className="shrink-0 text-muted-foreground hover:text-red-600 transition p-1"
                      title="Nachricht löschen"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ OpenIncidentsPanel ------------------------------ */

type Incident = {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
  title: string;
  description: string | null;
  created_at: string;
  order_bestellnummer: string | null;
  driver_name: string | null;
};

const INCIDENT_SEVERITY_META: Record<string, { label: string; cls: string }> = {
  low:      { label: 'Niedrig',   cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  medium:   { label: 'Mittel',    cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  high:     { label: 'Hoch',      cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  critical: { label: 'Kritisch',  cls: 'bg-red-100 text-red-800 border-red-200 animate-pulse' },
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  late_delivery:        'Verspätete Lieferung',
  wrong_order:          'Falsche Bestellung',
  missing_item:         'Fehlender Artikel',
  driver_complaint:     'Fahrer-Beschwerde',
  customer_complaint:   'Kunden-Beschwerde',
  damage:               'Schaden/Unfall',
  no_show:              'Fahrer erschienen nicht',
  other:                'Sonstiges',
};

function OpenIncidentsPanel({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<{ total: number; open: number; critical: number } | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const [statsRes, listRes] = await Promise.all([
          fetch(`/api/delivery/admin/incidents?stats=true&location_id=${locationId}`),
          fetch(`/api/delivery/admin/incidents?status=open_all&location_id=${locationId}&limit=20`),
        ]);
        if (statsRes.ok) {
          const d = await statsRes.json() as { stats?: { total_open: number; total_incidents: number; critical_open: number } };
          if (d.stats) {
            setStats({ total: d.stats.total_incidents ?? 0, open: d.stats.total_open ?? 0, critical: d.stats.critical_open ?? 0 });
          }
        }
        if (listRes.ok) {
          const d = await listRes.json() as { incidents?: Incident[] };
          setIncidents(d.incidents ?? []);
        }
      } catch {}
    };
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [locationId]);

  async function resolveIncident(id: string) {
    if (resolving) return;
    setResolving(id);
    try {
      await fetch(`/api/delivery/admin/incidents/${id}?location_id=${locationId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', notes: 'Admin: Manuell aufgelöst' }),
      });
      setIncidents((prev) => prev.filter((i) => i.id !== id));
      setStats((s) => s ? { ...s, open: Math.max(0, s.open - 1) } : s);
    } catch {}
    setResolving(null);
  }

  if (!locationId) return null;
  const criticalCount = incidents.filter((i) => i.severity === 'critical').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3 hover:bg-muted/30 transition border-b text-left"
      >
        <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
        <span className="font-display text-sm font-bold flex-1">Offene Incidents</span>
        {stats && stats.open > 0 && (
          <Badge
            variant={criticalCount > 0 ? 'destructive' : 'secondary'}
            className={cn('text-[10px]', criticalCount > 0 && 'animate-pulse')}
          >
            {stats.open} offen{criticalCount > 0 ? ` · ${criticalCount} kritisch` : ''}
          </Badge>
        )}
        {(!stats || stats.open === 0) && (
          <Badge variant="secondary" className="text-[10px] text-matcha-600">Alles OK</Badge>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="p-4">
          {incidents.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-matcha-400 mx-auto mb-2 opacity-60" />
              Keine offenen Incidents.
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc) => {
                const sev = INCIDENT_SEVERITY_META[inc.severity] ?? INCIDENT_SEVERITY_META.low;
                const typeLabel = INCIDENT_TYPE_LABELS[inc.type] ?? inc.type;
                const createdAt = new Date(inc.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={inc.id} className={cn('rounded-xl border px-3 py-2.5 flex items-start gap-3', sev.cls)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-display text-sm font-bold leading-tight">{inc.title}</span>
                        <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-black', sev.cls)}>
                          {sev.label}
                        </span>
                        <span className="text-[9px] text-muted-foreground/70 font-mono">{createdAt}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] flex-wrap">
                        <span className="font-semibold">{typeLabel}</span>
                        {inc.order_bestellnummer && (
                          <span className="rounded bg-black/5 px-1 py-0.5 font-mono">#{inc.order_bestellnummer.replace('FF-', '')}</span>
                        )}
                        {inc.driver_name && (
                          <span className="text-muted-foreground">· {inc.driver_name}</span>
                        )}
                      </div>
                      {inc.description && (
                        <div className="mt-1 text-[10px] text-muted-foreground/80 line-clamp-2">{inc.description}</div>
                      )}
                    </div>
                    <button
                      onClick={() => resolveIncident(inc.id)}
                      disabled={resolving === inc.id}
                      title="Incident als gelöst markieren"
                      className="shrink-0 inline-flex items-center gap-1 rounded-full border border-matcha-300 bg-matcha-50 px-2 py-0.5 text-[10px] font-bold text-matcha-700 hover:bg-matcha-100 transition"
                    >
                      {resolving === inc.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Check className="h-3 w-3" />}
                      Lösen
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ ActiveTourRail ------------------------------ */

function ActiveTourRail({ batches, drivers, onSelect }: { batches: Batch[]; drivers: Driver[]; onSelect: (id: string) => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const ACTIVE = new Set(['pickup', 'unterwegs', 'pending_acceptance', 'assigned', 'at_restaurant', 'on_route']);
  const active = batches.filter((b) => ACTIVE.has(b.status));
  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <GitCommit className="h-3.5 w-3.5 text-matcha-600" />
        <span className="font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Tour-Schiene · {active.length} aktiv
        </span>
      </div>
      <div className="flex flex-col divide-y">
        {active.map((b) => {
          const total = b.stops.length;
          const done = b.stops.filter((s) => s.geliefert_am).length;
          const remaining = total - done;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const etaMs = b.startzeit && b.total_eta_min != null
            ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
            : null;
          const secLeft = etaMs ? Math.floor((etaMs - now) / 1000) : null;
          const overdue = secLeft !== null && secLeft < 0;
          const soon = !overdue && secLeft !== null && secLeft < 5 * 60;
          const finStr = etaMs
            ? new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            : null;
          const driver = drivers.find((d) => d.employee_id === b.fahrer_id || d.aktueller_batch_id === b.id);
          const driverName = b.fahrer
            ? `${b.fahrer.vorname.charAt(0)}. ${b.fahrer.nachname}`
            : driver?.employee?.vorname ?? 'Fahrer';

          const statusColor =
            pct === 100 ? 'bg-matcha-500' :
            overdue ? 'bg-red-500' :
            soon ? 'bg-orange-400' :
            'bg-matcha-600';

          return (
            <div
              key={b.id}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => onSelect(b.id)}
            >
              {/* Driver avatar chip */}
              <div className={cn(
                'h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black text-white',
                pct === 100 ? 'bg-matcha-500' : overdue ? 'bg-red-500' : 'bg-matcha-700',
              )}>
                {driverName.charAt(0)}
              </div>

              {/* Driver + zone */}
              <div className="min-w-0 w-24 shrink-0">
                <div className="text-[11px] font-bold truncate">{driverName}</div>
                {b.zone && (
                  <span className={cn('text-[9px] font-bold', zoneMeta(b.zone).cls.replace(/bg-\S+/, '').trim())}>
                    Zone {b.zone}
                  </span>
                )}
              </div>

              {/* Stop dots */}
              <div className="flex items-center gap-0.5 flex-1 min-w-0">
                {b.stops
                  .sort((a, c) => a.reihenfolge - c.reihenfolge)
                  .slice(0, 8)
                  .map((s, i) => (
                    <span
                      key={s.id}
                      className={cn(
                        'inline-flex items-center justify-center rounded-full shrink-0',
                        s.geliefert_am
                          ? 'h-4 w-4 bg-matcha-500 text-white text-[8px] font-black'
                          : i === done
                          ? 'h-4 w-4 bg-orange-400 text-white text-[8px] font-black animate-pulse ring-1 ring-orange-300 ring-offset-1'
                          : 'h-4 w-4 bg-muted text-muted-foreground text-[8px]',
                      )}
                      title={s.order?.kunde_name ?? `Stopp ${i + 1}`}
                    >
                      {s.geliefert_am ? '✓' : i + 1}
                    </span>
                  ))
                }
                {b.stops.length > 8 && (
                  <span className="text-[9px] text-muted-foreground ml-1">+{b.stops.length - 8}</span>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-16 shrink-0">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', statusColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[9px] text-muted-foreground tabular-nums mt-0.5 text-right">
                  {done}/{total}
                </div>
              </div>

              {/* ETA */}
              <div className="shrink-0 text-right min-w-[52px]">
                {secLeft !== null ? (
                  <>
                    <div className={cn(
                      'text-[11px] font-black tabular-nums leading-tight',
                      overdue ? 'text-red-600' : soon ? 'text-orange-600' : 'text-matcha-700',
                    )}>
                      {overdue
                        ? `+${Math.floor(-secLeft / 60)}m`
                        : secLeft < 3600
                        ? `${Math.floor(secLeft / 60)}:${String(secLeft % 60).padStart(2, '0')}`
                        : finStr ?? '—'}
                    </div>
                    {finStr && (
                      <div className="text-[9px] text-muted-foreground tabular-nums">{finStr}</div>
                    )}
                  </>
                ) : (
                  <span className="text-[9px] text-muted-foreground">—</span>
                )}
              </div>

              {/* Distance */}
              {b.total_distance_km != null && b.total_distance_km > 0 && (
                <div className="shrink-0 text-[9px] text-muted-foreground tabular-nums min-w-[32px] text-right">
                  {b.total_distance_km.toFixed(1)} km
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ DispatchTourGantt ------------------------------ */

function DispatchTourGantt({ batches, drivers }: { batches: Batch[]; drivers: Driver[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const ACTIVE = new Set(['pickup', 'unterwegs', 'pending_acceptance', 'assigned', 'at_restaurant', 'on_route']);
  const active = batches.filter((b) => ACTIVE.has(b.status));
  if (active.length === 0) return null;

  const now = Date.now();
  const HORIZON_MIN = 90;
  const horizonMs = HORIZON_MIN * 60_000;

  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 border-b hover:bg-muted/30 transition-colors"
      >
        <GitCommit className="h-3.5 w-3.5 text-matcha-600" />
        <span className="font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Tour-Gantt · {active.length} aktiv · 90 Min
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="p-3 space-y-2">
          {/* Zeit-Skala */}
          <div className="flex ml-[88px] mb-1">
            {Array.from({ length: 7 }, (_, i) => {
              const tMs = now + i * 15 * 60_000;
              const label = new Date(tMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={i} className="flex-1 text-[8px] text-muted-foreground text-left" style={{ width: `${100 / 7}%` }}>
                  {label}
                </div>
              );
            })}
          </div>

          {/* Touren-Zeilen */}
          {active.map((b) => {
            const driver = drivers.find((d) => d.employee_id === b.fahrer_id);
            const driverName = b.fahrer
              ? `${b.fahrer.vorname} ${b.fahrer.nachname.charAt(0)}.`
              : driver?.employee
              ? `${driver.employee.vorname} ${driver.employee.nachname.charAt(0)}.`
              : 'Unbekannt';

            const total = b.stops.length;
            const done = b.stops.filter((s) => s.geliefert_am).length;
            const pct = total > 0 ? (done / total) * 100 : 0;

            // Startzeit der Tour (früheste ETA oder startzeit)
            const tourStartMs = b.startzeit
              ? new Date(b.startzeit).getTime()
              : b.stops[0]?.order?.eta_earliest
              ? new Date(b.stops[0].order.eta_earliest).getTime() - (b.total_eta_min ?? 30) * 60_000
              : now - 15 * 60_000;

            // Endzeit der Tour (späteste eta_latest oder total_eta_min)
            const latestEtas = b.stops
              .map((s) => s.order?.eta_latest)
              .filter(Boolean)
              .map((e) => new Date(e!).getTime());
            const tourEndMs = latestEtas.length > 0
              ? Math.max(...latestEtas)
              : tourStartMs + (b.total_eta_min ?? 45) * 60_000;

            const barStart = Math.max(0, tourStartMs - now);
            const barEnd = Math.min(horizonMs, tourEndMs - now);
            const barWidth = Math.max(2, ((barEnd - barStart) / horizonMs) * 100);
            const barLeft = Math.min(98, (barStart / horizonMs) * 100);

            const isLate = tourEndMs < now;
            const barColor = isLate
              ? 'bg-red-400'
              : pct >= 80
              ? 'bg-matcha-400'
              : pct >= 50
              ? 'bg-blue-400'
              : 'bg-orange-400';

            // Jetzt-Linie: 0% des Balkenbereichs
            const nowPct = Math.min(100, ((now - tourStartMs) / Math.max(1, tourEndMs - tourStartMs)) * 100);

            return (
              <div key={b.id} className="flex items-center gap-2">
                {/* Fahrername */}
                <div className="w-[80px] shrink-0 text-[9px] font-semibold text-foreground truncate text-right pr-1">
                  {driverName}
                </div>

                {/* Gantt-Balken */}
                <div className="relative flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('absolute top-0 h-full rounded-full opacity-80 transition-all duration-500', barColor)}
                    style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                  />
                  {/* Fortschritt innerhalb des Balkens */}
                  {barWidth > 0 && (
                    <div
                      className="absolute top-0 h-full rounded-full bg-white/30"
                      style={{ left: `${barLeft}%`, width: `${barWidth * pct / 100}%` }}
                    />
                  )}
                  {/* Jetzt-Linie */}
                  <div
                    className="absolute top-0 h-full w-px bg-foreground/60"
                    style={{ left: `0%` }}
                  />
                  {/* Stopp-Markers */}
                  {b.stops.map((s, i) => {
                    const stopEta = s.order?.eta_earliest ? new Date(s.order.eta_earliest).getTime() : null;
                    if (!stopEta) return null;
                    const markerLeft = Math.min(98, Math.max(1, ((stopEta - now) / horizonMs) * 100));
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full border border-white',
                          s.geliefert_am ? 'bg-matcha-500' : 'bg-white'
                        )}
                        style={{ left: `${markerLeft}%` }}
                        title={`Stopp ${i + 1}: ${s.order?.kunde_name ?? ''}`}
                      />
                    );
                  })}
                </div>

                {/* Progress */}
                <div className="w-[36px] shrink-0 text-[9px] text-muted-foreground tabular-nums text-right">
                  {done}/{total}
                </div>
              </div>
            );
          })}

          {/* Legende */}
          <div className="flex items-center gap-3 pt-1 border-t mt-1">
            {[
              { color: 'bg-matcha-400', label: '≥80%' },
              { color: 'bg-blue-400', label: '≥50%' },
              { color: 'bg-orange-400', label: '<50%' },
              { color: 'bg-red-400', label: 'überfällig' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <div className={cn('h-2 w-3 rounded-sm', l.color)} />
                <span className="text-[8px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <div className="h-3 w-px bg-foreground/60" />
              <span className="text-[8px] text-muted-foreground">Jetzt</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- DispatchQuickAssignBar ---- */
/* Zeigt die eine beste Zuweisung (höchster Score + nächster freier Fahrer) mit einem Klick */
function DispatchQuickAssignBar({
  orders,
  drivers,
  restaurantLat,
  restaurantLng,
  onAssign,
}: {
  orders: ReadyOrder[];
  drivers: Driver[];
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  onAssign: (orderIds: string[], driverId: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const freeDrivers = drivers.filter((d) => d.ist_online && !d.aktueller_batch_id);
  const topOrder = orders
    .filter((o) => o.status === 'fertig' && o.dispatch_score != null)
    .sort((a, b) => (b.dispatch_score ?? 0) - (a.dispatch_score ?? 0))[0] ?? null;

  if (!topOrder || freeDrivers.length === 0) return null;

  const waitMin = topOrder.fertig_am
    ? Math.floor((Date.now() - new Date(topOrder.fertig_am).getTime()) / 60_000)
    : null;

  // Nächster freier Fahrer: GPS-nächster zum Restaurant, sonst erster verfügbarer
  const bestDriver = (() => {
    if (restaurantLat != null && restaurantLng != null) {
      const withGps = freeDrivers.filter((d) => d.last_lat != null && d.last_lng != null);
      if (withGps.length > 0) {
        return withGps.slice().sort((a, b) =>
          haversineKm({ lat: a.last_lat!, lng: a.last_lng! }, { lat: restaurantLat!, lng: restaurantLng! }) -
          haversineKm({ lat: b.last_lat!, lng: b.last_lng! }, { lat: restaurantLat!, lng: restaurantLng! })
        )[0];
      }
    }
    return freeDrivers[0];
  })();
  const nearestDistKm = (restaurantLat != null && restaurantLng != null && bestDriver.last_lat != null && bestDriver.last_lng != null)
    ? haversineKm({ lat: bestDriver.last_lat, lng: bestDriver.last_lng }, { lat: restaurantLat, lng: restaurantLng })
    : null;
  const driverName = bestDriver.employee
    ? `${bestDriver.employee.vorname} ${bestDriver.employee.nachname.charAt(0)}.`
    : 'Fahrer';

  async function quickAssign() {
    setPending(true);
    try {
      await onAssign([topOrder!.id], bestDriver.employee_id);
      setDone(`✓ ${topOrder!.bestellnummer.replace('FF-', '')} → ${driverName}`);
      setTimeout(() => setDone(null), 6000);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-matcha-300 bg-matcha-50 px-4 py-2.5 text-sm">
        <span className="text-matcha-600 font-bold">{done}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
      <Zap className="h-4 w-4 text-blue-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-blue-900">Beste nächste Aktion</span>
        <span className="text-[10px] text-blue-700 ml-2">
          #{topOrder.bestellnummer.replace('FF-', '')}
          {topOrder.delivery_zone ? ` · Zone ${topOrder.delivery_zone}` : ''}
          {topOrder.dispatch_score != null ? ` · Score ${Math.round(topOrder.dispatch_score)}` : ''}
          {waitMin != null ? ` · wartet ${waitMin} Min` : ''}
          {' → '}{driverName}
          {nearestDistKm != null ? ` · ${nearestDistKm < 1 ? `${Math.round(nearestDistKm * 1000)} m` : `${nearestDistKm.toFixed(1)} km`} weg` : ''}
        </span>
      </div>
      <button
        onClick={quickAssign}
        disabled={pending}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
        {pending ? '…' : 'Zuweisen'}
      </button>
    </div>
  );
}

/* ------------------------------ MiniSparkline SVG ------------------------------ */

function MiniSparkline({
  data,
  color = '#4ade80',
  width = 80,
  height = 24,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return <span className="text-[9px] text-muted-foreground">–</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const innerH = height - pad * 2;
  const innerW = width - pad * 2;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * innerW,
    y: pad + innerH - ((v - min) / range) * innerH,
  }));
  const polyPts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  // Area fill path
  const areaD = [
    `M${pts[0].x.toFixed(1)},${(pad + innerH).toFixed(1)}`,
    ...pts.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${last.x.toFixed(1)},${(pad + innerH).toFixed(1)}`,
    'Z',
  ].join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={areaD} fill={color} fillOpacity="0.12" />
      <polyline
        points={polyPts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r="2.2" fill={color} />
    </svg>
  );
}

/* ------------------------------ DriverHistoricalLeaderboardPanel ------------------------------ */

type HistoricalLeaderEntry = {
  rank: number;
  driverId: string;
  driverName: string | null;
  initials: string;
  toursCompleted: number;
  stopsCompleted: number;
  totalDistanceKm: number;
  avgDeliveryMin: number | null;
  onTimeRate: number | null;
  avgRating: number | null;
  earningsEur: number;
  activeDays: number;
};

type LbPeriod = 'today' | 'week' | 'month';

function DriverHistoricalLeaderboardPanel({ locationId }: { locationId: string | null }) {
  const [period, setPeriod] = useState<LbPeriod>('week');
  const [entries, setEntries] = useState<HistoricalLeaderEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [snapMsg, setSnapMsg] = useState<string | null>(null);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [historyCache, setHistoryCache] = useState<Map<string, number[]>>(new Map());
  const [historyLoading, setHistoryLoading] = useState<Set<string>>(new Set());

  async function fetchDriverHistory(driverId: string) {
    if (!locationId || historyCache.has(driverId) || historyLoading.has(driverId)) return;
    setHistoryLoading((s) => new Set(s).add(driverId));
    try {
      const res = await fetch(
        `/api/delivery/admin/driver-performance?driver_id=${driverId}&location_id=${locationId}&days=14`,
      );
      if (res.ok) {
        const d = await res.json() as { history?: { stopsCompleted?: number }[] };
        const stops = (d.history ?? []).map((p) => p.stopsCompleted ?? 0);
        setHistoryCache((m) => new Map(m).set(driverId, stops));
      }
    } catch { /* ignore */ } finally {
      setHistoryLoading((s) => { const n = new Set(s); n.delete(driverId); return n; });
    }
  }

  function toggleDriver(driverId: string) {
    if (expandedDriver === driverId) {
      setExpandedDriver(null);
    } else {
      setExpandedDriver(driverId);
      fetchDriverHistory(driverId);
    }
  }

  useEffect(() => {
    if (!open || !locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/driver-leaderboard?location_id=${locationId}&period=${period}&limit=20`)
      .then((r) => r.json())
      .then((d) => setEntries((d.entries ?? []) as HistoricalLeaderEntry[]))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open, period, locationId]);

  const triggerSnapshot = async () => {
    if (!locationId) return;
    setSnapping(true);
    setSnapMsg(null);
    try {
      const res = await fetch('/api/delivery/admin/driver-leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      const d = await res.json();
      setSnapMsg(`${d.snapshots ?? 0} Snapshots erstellt`);
      // Refresh
      setEntries([]);
      setLoading(true);
      fetch(`/api/delivery/admin/driver-leaderboard?location_id=${locationId}&period=${period}&limit=20`)
        .then((r) => r.json())
        .then((data) => setEntries((data.entries ?? []) as HistoricalLeaderEntry[]))
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch {
      setSnapMsg('Fehler beim Snapshot');
    } finally {
      setSnapping(false);
    }
  };

  const PERIOD_LABELS: Record<LbPeriod, string> = { today: 'Heute', week: 'Diese Woche', month: 'Dieser Monat' };
  const PODIUM_COLORS = ['text-yellow-500', 'text-stone-400', 'text-amber-600'];
  const PODIUM_SIZES  = ['h-8 w-8 text-lg', 'h-7 w-7 text-base', 'h-6 w-6 text-sm'];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-2 border-b px-5 py-3 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Trophy className="h-4 w-4 text-yellow-500" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Historisches Leaderboard</span>
        <span className="ml-2 text-[10px] text-muted-foreground">Wochen-/Monatsranking</span>
        <div className="ml-auto flex items-center gap-2">
          {entries.length > 0 && !loading && (
            <span className="text-[10px] font-bold text-yellow-600">{entries.length} Fahrer</span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Period Switcher + Snapshot Button */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['today', 'week', 'month'] as LbPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition',
                  period === p
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {p === 'today' && <Calendar className="h-3 w-3" />}
                {p === 'week'  && <BarChart2 className="h-3 w-3" />}
                {p === 'month' && <Trophy className="h-3 w-3" />}
                {PERIOD_LABELS[p]}
              </button>
            ))}
            <button
              onClick={triggerSnapshot}
              disabled={snapping}
              className="ml-auto inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 disabled:opacity-50 transition"
            >
              {snapping ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Snapshot jetzt
            </button>
          </div>

          {snapMsg && (
            <p className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">{snapMsg}</p>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Lade Leaderboard…</span>
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <Trophy className="h-8 w-8 opacity-20" />
              <p className="text-sm">Noch keine Snapshot-Daten für {PERIOD_LABELS[period]}.</p>
              <p className="text-[11px]">Klicke &quot;Snapshot jetzt&quot; um Daten zu berechnen.</p>
            </div>
          )}

          {!loading && entries.length > 0 && (
            <>
              {/* Podium — Top 3 */}
              {entries.slice(0, 3).length > 0 && (
                <div className="flex items-end justify-center gap-3 pt-2 pb-4">
                  {[entries[1], entries[0], entries[2]].filter(Boolean).map((e, podiumIdx) => {
                    const actualRank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
                    const colorCls  = PODIUM_COLORS[actualRank - 1] ?? 'text-muted-foreground';
                    const sizeCls   = PODIUM_SIZES[actualRank - 1] ?? 'h-6 w-6';
                    const heightCls = actualRank === 1 ? 'h-24' : actualRank === 2 ? 'h-20' : 'h-16';
                    return (
                      <div key={e.driverId} className="flex flex-col items-center gap-1 min-w-[72px]">
                        <div className={cn('flex items-center justify-center rounded-full bg-muted font-bold', sizeCls, colorCls)}>
                          {e.initials}
                        </div>
                        <span className="text-[10px] font-semibold text-center truncate max-w-[70px]">
                          {e.driverName ?? '—'}
                        </span>
                        <span className={cn('text-[10px] font-bold', colorCls)}>{e.stopsCompleted} Stopps</span>
                        <div className={cn('w-full rounded-t-lg bg-muted border', heightCls, actualRank === 1 ? 'bg-yellow-100 border-yellow-300' : actualRank === 2 ? 'bg-stone-100 border-stone-300' : 'bg-amber-50 border-amber-200')}>
                          <div className="flex items-center justify-center h-full">
                            <span className={cn('text-lg font-black', colorCls)}>#{actualRank}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Vollständige Tabelle mit Inline-Bars */}
              {(() => {
                const maxStops    = Math.max(1, ...entries.map(e => e.stopsCompleted));
                const maxEarnings = Math.max(1, ...entries.map(e => e.earningsEur));
                const maxDist     = Math.max(1, ...entries.map(e => e.totalDistanceKm));
                return (
                  <div className="space-y-1.5">
                    {entries.map((e, idx) => {
                      const stopsPct    = Math.round((e.stopsCompleted / maxStops) * 100);
                      const earningsPct = Math.round((e.earningsEur / maxEarnings) * 100);
                      const onTimePct   = e.onTimeRate != null ? Math.round(e.onTimeRate * 100) : null;
                      const ratingPct   = e.avgRating  != null ? Math.round((e.avgRating / 5) * 100) : null;
                      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                      return (
                        <div
                          key={e.driverId}
                          className={cn(
                            'rounded-xl border p-2.5 transition hover:shadow-sm',
                            idx === 0 ? 'border-yellow-300 bg-yellow-50/50' :
                            idx === 1 ? 'border-stone-300 bg-stone-50/50' :
                            idx === 2 ? 'border-amber-200 bg-amber-50/30' :
                            'border-border bg-card',
                          )}
                        >
                          <button
                            type="button"
                            className="flex items-center gap-2 mb-2 w-full text-left"
                            onClick={() => toggleDriver(e.driverId)}
                          >
                            <span className="w-5 text-center font-bold tabular-nums text-[10px] text-muted-foreground shrink-0">
                              {medal ?? `#${e.rank}`}
                            </span>
                            <span className={cn(
                              'inline-flex items-center justify-center rounded-full w-6 h-6 text-[10px] font-bold shrink-0',
                              idx === 0 ? 'bg-yellow-200 text-yellow-800' :
                              idx === 1 ? 'bg-stone-200 text-stone-700' :
                              idx === 2 ? 'bg-amber-100 text-amber-800' :
                              'bg-muted text-muted-foreground',
                            )}>
                              {e.initials}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[12px] truncate">{e.driverName ?? '—'}</span>
                                {e.activeDays > 1 && (
                                  <span className="text-[9px] text-muted-foreground shrink-0">·{e.activeDays}T</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                              <span className="tabular-nums font-bold">{e.stopsCompleted} Stopps</span>
                              {e.earningsEur > 0 && (
                                <span className="tabular-nums text-green-700 font-semibold">€{e.earningsEur.toFixed(2)}</span>
                              )}
                              {expandedDriver === e.driverId
                                ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              }
                            </div>
                          </button>
                          {/* Inline metric bars */}
                          <div className="space-y-1">
                            {/* Stopps-Bar */}
                            <div className="flex items-center gap-1.5">
                              <span className="w-14 text-[9px] text-muted-foreground shrink-0">Stopps</span>
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-matcha-500 transition-all duration-500"
                                  style={{ width: `${stopsPct}%` }}
                                />
                              </div>
                              <span className="w-6 text-right text-[9px] tabular-nums text-muted-foreground shrink-0">{e.stopsCompleted}</span>
                            </div>
                            {/* Pünktlichkeits-Bar */}
                            {onTimePct != null && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-14 text-[9px] text-muted-foreground shrink-0">Pünktl.</span>
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all duration-500',
                                      onTimePct >= 90 ? 'bg-green-500' : onTimePct >= 75 ? 'bg-yellow-500' : 'bg-red-400',
                                    )}
                                    style={{ width: `${onTimePct}%` }}
                                  />
                                </div>
                                <span className={cn(
                                  'w-6 text-right text-[9px] tabular-nums font-semibold shrink-0',
                                  onTimePct >= 90 ? 'text-green-600' : onTimePct >= 75 ? 'text-yellow-600' : 'text-red-500',
                                )}>{onTimePct}%</span>
                              </div>
                            )}
                            {/* Rating-Bar */}
                            {ratingPct != null && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-14 text-[9px] text-muted-foreground shrink-0">Bewert.</span>
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                                    style={{ width: `${ratingPct}%` }}
                                  />
                                </div>
                                <span className="w-6 text-right text-[9px] tabular-nums text-yellow-600 font-semibold shrink-0">
                                  {e.avgRating!.toFixed(1)}
                                </span>
                              </div>
                            )}
                            {/* Distanz-Bar */}
                            {e.totalDistanceKm > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-14 text-[9px] text-muted-foreground shrink-0">Distanz</span>
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-400 transition-all duration-500"
                                    style={{ width: `${Math.round((e.totalDistanceKm / maxDist) * 100)}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right text-[9px] tabular-nums text-muted-foreground shrink-0">
                                  {e.totalDistanceKm.toFixed(1)} km
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Sparkline — 14-Tage Trend, aufklappbar */}
                          {expandedDriver === e.driverId && (
                            <div className="mt-2.5 border-t pt-2.5">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                  <BarChart2 className="h-2.5 w-2.5" />
                                  14-Tage Trend (Stopps)
                                </span>
                                {historyLoading.has(e.driverId) && (
                                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                )}
                              </div>
                              {historyCache.has(e.driverId) ? (
                                <div className="flex items-end gap-3">
                                  <MiniSparkline
                                    data={historyCache.get(e.driverId)!}
                                    color={
                                      idx === 0 ? '#ca8a04' :
                                      idx === 1 ? '#78716c' :
                                      idx === 2 ? '#d97706' :
                                      '#4ade80'
                                    }
                                    width={120}
                                    height={28}
                                  />
                                  <div className="text-[9px] text-muted-foreground">
                                    {historyCache.get(e.driverId)!.length > 0 ? (
                                      <>
                                        <span className="font-bold text-foreground">
                                          {historyCache.get(e.driverId)![historyCache.get(e.driverId)!.length - 1]}
                                        </span>
                                        {' '}gestern
                                        {historyCache.get(e.driverId)!.length >= 7 && (() => {
                                          const arr = historyCache.get(e.driverId)!;
                                          const last3  = arr.slice(-3).reduce((s, v) => s + v, 0) / 3;
                                          const prev3  = arr.slice(-6, -3).reduce((s, v) => s + v, 0) / 3;
                                          const delta = last3 - prev3;
                                          return (
                                            <span className={cn('ml-1.5 font-semibold', delta >= 0 ? 'text-green-600' : 'text-red-500')}>
                                              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
                                            </span>
                                          );
                                        })()}
                                      </>
                                    ) : (
                                      <span>Keine Daten</span>
                                    )}
                                  </div>
                                </div>
                              ) : !historyLoading.has(e.driverId) ? (
                                <span className="text-[9px] text-muted-foreground">Keine Snapshot-Daten vorhanden</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ KitchenPipelinePanel ------------------------------ */

function KitchenPipelinePanel({ orders }: {
  orders: {
    id: string; bestellnummer: string; status: string; delivery_zone: string | null;
    geschaetzte_zubereitung_min: number | null; bestellt_am: string | null;
    ready_target: string | null; timing_status: string | null;
  }[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  const sorted = [...orders].sort((a, b) => {
    const aEta = a.ready_target
      ? new Date(a.ready_target).getTime()
      : a.bestellt_am
        ? new Date(a.bestellt_am).getTime() + (a.geschaetzte_zubereitung_min ?? 15) * 60_000
        : Infinity;
    const bEta = b.ready_target
      ? new Date(b.ready_target).getTime()
      : b.bestellt_am
        ? new Date(b.bestellt_am).getTime() + (b.geschaetzte_zubereitung_min ?? 15) * 60_000
        : Infinity;
    return aEta - bEta;
  });

  // Gruppe: wie viele werden in den nächsten 10 Min fertig?
  const soonCount = sorted.filter((o) => {
    const etaMs = o.ready_target
      ? new Date(o.ready_target).getTime()
      : o.bestellt_am
        ? new Date(o.bestellt_am).getTime() + (o.geschaetzte_zubereitung_min ?? 15) * 60_000
        : null;
    return etaMs != null && etaMs - now <= 10 * 60_000;
  }).length;

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-orange-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-orange-800">
          Küchen-Pipeline · {orders.length} noch in Zubereitung
        </span>
        {soonCount > 0 && (
          <span className="ml-1 rounded-full bg-orange-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
            {soonCount} in ~10 Min bereit
          </span>
        )}
        <span className="ml-auto text-[10px] text-orange-500">Fahrer vorplanen</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sorted.slice(0, 8).map((o) => {
          const etaMs = o.ready_target
            ? new Date(o.ready_target).getTime()
            : o.bestellt_am
              ? new Date(o.bestellt_am).getTime() + (o.geschaetzte_zubereitung_min ?? 15) * 60_000
              : null;
          const secLeft = etaMs != null ? Math.floor((etaMs - now) / 1000) : null;
          const isReady = secLeft != null && secLeft <= 0;
          const isSoon = secLeft != null && secLeft > 0 && secLeft <= 300;
          const mm = secLeft != null ? Math.abs(Math.floor(secLeft / 60)) : null;
          const ss = secLeft != null ? Math.abs(secLeft % 60) : null;
          const isCooking = o.timing_status === 'cooking' || o.status === 'in_zubereitung';
          return (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
                isReady
                  ? 'bg-matcha-50 border-matcha-300'
                  : isSoon
                  ? 'bg-orange-100 border-orange-300 animate-pulse'
                  : 'bg-white border-orange-200',
              )}
            >
              <span className={cn(
                'font-mono font-black tabular-nums text-[11px] min-w-[32px]',
                isReady ? 'text-matcha-600' : isSoon ? 'text-orange-700' : 'text-orange-500',
              )}>
                {isReady ? '✓' : secLeft == null ? '?' : `${mm}:${String(ss).padStart(2, '0')}`}
              </span>
              <span className="font-bold text-foreground">
                #{o.bestellnummer.replace(/^FF-/, '')}
              </span>
              {o.delivery_zone && (
                <span className="rounded-full bg-matcha-100 text-matcha-700 px-1.5 py-0.5 text-[9px] font-bold">
                  {o.delivery_zone}
                </span>
              )}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                isCooking ? 'bg-orange-200 text-orange-800' : 'bg-blue-100 text-blue-700',
              )}>
                {isCooking ? 'kocht' : 'angenommen'}
              </span>
            </div>
          );
        })}
        {sorted.length > 8 && (
          <span className="text-[10px] text-muted-foreground self-center">
            +{sorted.length - 8} weitere
          </span>
        )}
      </div>
      {/* Zone-Vorschau: welche Zonen werden als nächstes fertig? */}
      {sorted.length >= 2 && (() => {
        const zoneCounts: Record<string, number> = {};
        for (const o of sorted.slice(0, 8)) {
          if (o.delivery_zone) zoneCounts[o.delivery_zone] = (zoneCounts[o.delivery_zone] ?? 0) + 1;
        }
        const zones = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);
        if (zones.length === 0) return null;
        return (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap border-t border-orange-200 pt-2">
            <span className="text-[10px] text-orange-600 font-bold">Zonen bündeln:</span>
            {zones.map(([zone, cnt]) => (
              <span
                key={zone}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums',
                  cnt >= 3 ? 'bg-orange-500 text-white' : cnt >= 2 ? 'bg-orange-200 text-orange-900' : 'bg-orange-100 text-orange-700',
                )}
              >
                {zone} ×{cnt}
              </span>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

/* ------------------------------ LiveDriverPulseStrip ------------------------------ */

type LiveDriverGps = {
  id: string;
  name: string;
  vehicle: string | null;
  state: string;
  last_lat: number | null;
  last_lng: number | null;
  last_position_at: string | null;
  live_position?: {
    lat: number; lng: number;
    heading: number | null;
    speed_kmh: number | null;
    recorded_at: string;
    seconds_stale: number;
  } | null;
  active_batch?: { id: string; state: string; stop_count: number; zone: string | null } | null;
};

const HEADING_LABEL = (deg: number): string => {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
};

function LiveDriverPulseStrip({ batches, drivers }: { batches: Batch[]; drivers: Driver[] }) {
  const [gpsDrivers, setGpsDrivers] = useState<LiveDriverGps[]>([]);
  const [lastFetch, setLastFetch] = useState<Date>(new Date());

  useEffect(() => {
    const load = () => {
      fetch('/api/delivery/admin/drivers')
        .then((r) => r.ok ? r.json() : null)
        .then((d: { drivers?: LiveDriverGps[] } | null) => {
          if (Array.isArray(d?.drivers)) {
            setGpsDrivers(d!.drivers);
            setLastFetch(new Date());
          }
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, []);

  const activeGps = gpsDrivers.filter((g) => {
    if (g.active_batch != null) return true;
    const legacyDriver = drivers.find((d) => {
      const fullName = `${d.employee?.vorname ?? ''} ${d.employee?.nachname ?? ''}`.trim().toLowerCase();
      return fullName === g.name?.toLowerCase();
    });
    return legacyDriver?.aktueller_batch_id != null;
  });

  if (activeGps.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Radio className="h-3.5 w-3.5 text-blue-600 animate-pulse shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
          Live-GPS · {activeGps.length} Fahrer unterwegs
        </span>
        <span className="ml-auto text-[9px] text-blue-400 tabular-nums">
          {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeGps.map((g) => {
          const stale = g.live_position?.seconds_stale ?? (
            g.last_position_at
              ? Math.floor((Date.now() - new Date(g.last_position_at).getTime()) / 1000)
              : null
          );
          const speed = g.live_position?.speed_kmh ?? null;
          const heading = g.live_position?.heading ?? null;
          const isMoving = speed != null ? speed > 2 : null;
          const isStale = stale != null && stale > 120;
          const isNoSignal = stale == null || stale > 300;

          const chipColor = isNoSignal
            ? 'border-stone-200 bg-white text-stone-500'
            : isStale
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : isMoving
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-blue-200 bg-white text-blue-800';

          const staleLabel = stale == null
            ? 'Kein Signal'
            : stale < 60 ? `${stale}s`
            : stale < 3600 ? `${Math.floor(stale / 60)}m`
            : `${Math.floor(stale / 3600)}h`;

          return (
            <div
              key={g.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition',
                chipColor,
              )}
              title={`${g.name} · ${speed != null ? `${speed.toFixed(0)} km/h` : '—'} · Signal vor ${staleLabel}`}
            >
              <span className="text-sm leading-none shrink-0">
                {g.vehicle === 'bike' ? '🚲' : g.vehicle === 'ebike' ? '⚡' : g.vehicle === 'roller' || g.vehicle === 'scooter' ? '🛵' : '🚗'}
              </span>
              <span className="font-bold truncate max-w-[60px]">
                {g.name?.split(' ')[0] ?? '?'}
              </span>
              {speed != null && (
                <span className="inline-flex items-center gap-0.5 font-mono font-black tabular-nums">
                  <Gauge size={9} className="shrink-0" />
                  {speed.toFixed(0)}<span className="font-normal opacity-70 text-[9px]">km/h</span>
                </span>
              )}
              {heading != null && (
                <span className="inline-flex items-center gap-0.5 opacity-80">
                  <Navigation2
                    size={9}
                    className="shrink-0"
                    style={{ transform: `rotate(${heading}deg)` }}
                  />
                  <span className="text-[9px]">{HEADING_LABEL(heading)}</span>
                </span>
              )}
              <span className={cn(
                'text-[9px] shrink-0',
                isNoSignal ? 'text-stone-400' : isStale ? 'text-amber-600 font-bold' : 'opacity-60',
              )}>
                {isNoSignal ? <WifiOff size={9} className="inline" /> : staleLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ DispatchCapacityMeter (Phase 65) ------------------------------ */
function DispatchCapacityMeter({
  drivers,
  readyOrders,
  batches,
}: {
  drivers: Driver[];
  readyOrders: ReadyOrder[];
  batches: Batch[];
}) {
  const onlineCount = drivers.filter((d) => d.ist_online).length;
  const activeBatchCount = batches.filter((b) =>
    ['assigned', 'pickup', 'at_restaurant', 'on_route', 'unterwegs', 'pending_acceptance'].includes(b.status ?? ''),
  ).length;
  const waitingCount = readyOrders.filter((o) => o.status === 'fertig').length;

  if (onlineCount === 0 && readyOrders.length === 0) return null;

  const utilization =
    onlineCount > 0 ? Math.min(100, Math.round((activeBatchCount / onlineCount) * 100)) : 0;

  const pressure: 'high' | 'medium' | 'low' =
    waitingCount > onlineCount ? 'high' : waitingCount > 0 ? 'medium' : 'low';

  const utilColor =
    utilization >= 90 ? 'bg-red-500' :
    utilization >= 60 ? 'bg-orange-400' : 'bg-matcha-500';

  const pressureLabel =
    pressure === 'high' ? 'Hoher Druck' :
    pressure === 'medium' ? 'Normaler Betrieb' : 'Entspannt';

  const pressureBadge =
    pressure === 'high'   ? 'bg-red-100 text-red-700 border-red-200' :
    pressure === 'medium' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-matcha-50 text-matcha-700 border-matcha-200';

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Gauge className="h-3.5 w-3.5 shrink-0 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">
          Kapazitäts-Meter
        </span>
        <span className={cn('ml-auto rounded-full border px-2 py-0.5 text-[9px] font-black', pressureBadge)}>
          {pressureLabel}
        </span>
      </div>

      <div className="mb-2.5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-matcha-50 py-1.5">
          <div className="font-mono text-lg font-black text-matcha-700">{onlineCount}</div>
          <div className="text-[9px] font-bold uppercase text-matcha-500">Online</div>
        </div>
        <div className="rounded-lg bg-blue-50 py-1.5">
          <div className="font-mono text-lg font-black text-blue-700">{activeBatchCount}</div>
          <div className="text-[9px] font-bold uppercase text-blue-500">Unterwegs</div>
        </div>
        <div className={cn('rounded-lg py-1.5', waitingCount > 0 ? 'bg-orange-50' : 'bg-stone-50')}>
          <div className={cn('font-mono text-lg font-black', waitingCount > 0 ? 'text-orange-700' : 'text-stone-400')}>
            {waitingCount}
          </div>
          <div className="text-[9px] font-bold uppercase text-stone-400">Warten</div>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[9px]">
          <span className="font-bold uppercase text-muted-foreground">Auslastung</span>
          <span className="font-mono font-black">{utilization}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all duration-700', utilColor)}
            style={{ width: `${utilization}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ DispatchShiftLeaderboard ------------------------------ */

function DispatchShiftLeaderboard({
  drivers,
  batches,
}: {
  drivers: Driver[];
  batches: Batch[];
}) {
  type DriverRow = { driverId: string; name: string; deliveries: number; onlineMin: number };
  const [rows, setRows] = useState<DriverRow[]>([]);

  useEffect(() => {
    if (drivers.length === 0) return;
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    (async () => {
      const [{ data: legacyStops }, { data: miseStops }] = await Promise.all([
        supabase
          .from('delivery_batch_stops')
          .select('batch_id, geliefert_am, batch:delivery_batches!inner(fahrer_id)')
          .not('geliefert_am', 'is', null)
          .gte('geliefert_am', today.toISOString()) as Promise<{ data: Array<{ batch_id: string; geliefert_am: string; batch: { fahrer_id: string } }> | null }>,
        supabase
          .from('mise_delivery_batch_stops')
          .select('completed_at, batch:mise_delivery_batches!inner(driver:mise_drivers!inner(employee_id))')
          .eq('type', 'dropoff')
          .not('completed_at', 'is', null)
          .gte('completed_at', today.toISOString()) as Promise<{ data: Array<{ completed_at: string; batch: { driver: { employee_id: string } } }> | null }>,
      ]);

      const countByDriver: Record<string, number> = {};
      for (const s of legacyStops ?? []) {
        const did = s.batch?.fahrer_id;
        if (did) countByDriver[did] = (countByDriver[did] ?? 0) + 1;
      }
      for (const s of miseStops ?? []) {
        const did = s.batch?.driver?.employee_id;
        if (did) countByDriver[did] = (countByDriver[did] ?? 0) + 1;
      }

      const result: DriverRow[] = drivers
        .filter((d) => (countByDriver[d.employee_id] ?? 0) > 0)
        .map((d) => ({
          driverId: d.employee_id,
          name: d.employee
            ? `${d.employee.vorname} ${d.employee.nachname?.charAt(0) ?? ''}.`
            : d.employee_id.slice(0, 8),
          deliveries: countByDriver[d.employee_id] ?? 0,
          onlineMin: d.online_seit
            ? Math.max(1, Math.floor((Date.now() - new Date(d.online_seit).getTime()) / 60_000))
            : 60,
        }))
        .sort((a, b) => b.deliveries - a.deliveries)
        .slice(0, 5);

      setRows(result);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers.map((d) => d.employee_id).join(',')]);

  if (rows.length === 0) return null;

  const maxD = rows[0]?.deliveries ?? 1;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Trophy className="h-3.5 w-3.5 shrink-0 text-matcha-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">Schicht-Ranking</span>
        <span className="ml-auto text-[9px] text-muted-foreground">Lieferungen heute</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const pct = Math.round((r.deliveries / maxD) * 100);
          const dph = Math.round((r.deliveries / r.onlineMin) * 60 * 10) / 10;
          return (
            <div key={r.driverId} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-[11px]">
                {medals[i] ?? `${i + 1}.`}
              </span>
              <span className="flex-1 min-w-0 truncate text-xs font-medium">{r.name}</span>
              <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">{dph}/h</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-matcha-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-4 text-right text-[10px] font-black tabular-nums text-matcha-700">
                  {r.deliveries}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ AiDispatchAssistantPanel (Phase 67) ------------------------------ */

function AiDispatchAssistantPanel({
  text,
  loading,
  onClose,
}: {
  text: string;
  loading: boolean;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-violet-800">KI-Dispatch-Assistent</span>
          {loading && (
            <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-600">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
              analysiert…
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-violet-400 hover:bg-violet-100 hover:text-violet-700 transition"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-72 overflow-y-auto rounded-lg bg-white/80 p-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-mono"
      >
        {text || (loading ? (
          <span className="text-violet-400 italic">KI liest aktuellen Dispatch-Zustand…</span>
        ) : (
          <span className="text-muted-foreground italic">Kein Inhalt</span>
        ))}
        {loading && text && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-500 align-text-bottom" />
        )}
      </div>
    </div>
  );
}

/* ------------------------------ DispatchZoneAnalysisPanel ------------------------------ */

const ZONE_META_DISPATCH: Record<string, { label: string; ring: string; bg: string; text: string; bar: string }> = {
  A: { label: 'Zone A ≤2 km', ring: 'border-matcha-400', bg: 'bg-matcha-50',  text: 'text-matcha-800', bar: 'bg-matcha-500' },
  B: { label: 'Zone B ≤4 km', ring: 'border-blue-400',   bg: 'bg-blue-50',    text: 'text-blue-800',   bar: 'bg-blue-500'   },
  C: { label: 'Zone C ≤7 km', ring: 'border-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-800',  bar: 'bg-amber-500'  },
  D: { label: 'Zone D  >7 km', ring: 'border-red-400',    bg: 'bg-red-50',     text: 'text-red-800',    bar: 'bg-red-500'    },
};

function DispatchZoneAnalysisPanel({ orders }: { orders: ReadyOrder[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, []);

  if (orders.length === 0) return null;

  const now = Date.now();

  type ZoneRow = {
    zone: string;
    count: number;
    avgWaitMin: number;
    maxWaitMin: number;
    totalValue: number;
    orders: ReadyOrder[];
  };

  const map = new Map<string, ReadyOrder[]>();
  for (const o of orders) {
    const z = o.delivery_zone ?? '?';
    if (!map.has(z)) map.set(z, []);
    map.get(z)!.push(o);
  }

  const rows: ZoneRow[] = Array.from(map.entries())
    .map(([zone, zOrders]) => {
      const waitTimes = zOrders.map((o) =>
        o.fertig_am ? Math.floor((now - new Date(o.fertig_am).getTime()) / 60_000) : 0,
      );
      return {
        zone,
        count: zOrders.length,
        avgWaitMin: waitTimes.length > 0 ? Math.round(waitTimes.reduce((s, v) => s + v, 0) / waitTimes.length) : 0,
        maxWaitMin: waitTimes.length > 0 ? Math.max(...waitTimes) : 0,
        totalValue: zOrders.reduce((s, o) => s + o.gesamtbetrag, 0),
        orders: zOrders,
      };
    })
    .sort((a, b) => b.maxWaitMin - a.maxWaitMin);

  const maxCount = Math.max(...rows.map((r) => r.count), 1);
  const criticalZones = rows.filter((r) => r.maxWaitMin >= 10).length;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      criticalZones > 0 ? 'border-red-200 bg-red-50/40' : 'border-border bg-card',
    )}>
      <div className="mb-3 flex items-center gap-2">
        <MapPin className={cn('h-3.5 w-3.5 shrink-0', criticalZones > 0 ? 'text-red-600' : 'text-matcha-600')} />
        <span className={cn(
          'font-display text-xs font-bold uppercase tracking-wider',
          criticalZones > 0 ? 'text-red-800' : 'text-matcha-800',
        )}>
          Zonen-Analyse · {orders.length} bereit
        </span>
        {criticalZones > 0 && (
          <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white animate-pulse">
            {criticalZones} Zone{criticalZones !== 1 ? 'n' : ''} &gt;10m
          </span>
        )}
        <span className="ml-auto text-[9px] text-muted-foreground">Wartezeit seit Fertig</span>
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const meta = ZONE_META_DISPATCH[r.zone] ?? ZONE_META_DISPATCH.D;
          const pct = Math.round((r.count / maxCount) * 100);
          const waitColor =
            r.maxWaitMin >= 10 ? 'bg-red-100 text-red-700' :
            r.maxWaitMin >= 5  ? 'bg-orange-100 text-orange-700' :
                                 'bg-matcha-100 text-matcha-700';
          const avgColor =
            r.avgWaitMin >= 10 ? 'text-red-600 font-black' :
            r.avgWaitMin >= 5  ? 'text-orange-600 font-bold' :
                                 'text-matcha-700 font-semibold';

          return (
            <div key={r.zone} className={cn('rounded-lg border px-3 py-2', meta.ring, meta.bg)}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn('text-[10px] font-black uppercase tracking-wide', meta.text)}>
                  {meta.label !== 'Zone ? ≤? km' ? meta.label : `Zone ${r.zone}`}
                </span>
                <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums', waitColor)}>
                  max {r.maxWaitMin}m
                </span>
                <span className={cn('text-[9px] tabular-nums', avgColor)}>
                  Ø {r.avgWaitMin}m
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5 text-[9px] text-muted-foreground">
                    <span className="tabular-nums font-black">{r.count} Best.</span>
                    <span className="tabular-nums">{euro(r.totalValue)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', meta.bar)}
                      style={{ width: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 flex flex-wrap gap-1">
                  {r.orders.slice(0, 4).map((o) => {
                    const wMin = o.fertig_am ? Math.floor((now - new Date(o.fertig_am).getTime()) / 60_000) : 0;
                    return (
                      <span
                        key={o.id}
                        className={cn(
                          'rounded px-1 py-0.5 text-[8px] font-bold tabular-nums',
                          wMin >= 10 ? 'bg-red-200 text-red-800' :
                          wMin >= 5  ? 'bg-orange-200 text-orange-800' :
                                       'bg-white/70 text-foreground/60',
                        )}
                        title={`#${o.bestellnummer} · ${wMin}m warten`}
                      >
                        #{o.bestellnummer.replace(/^[A-Z]+-/, '')}
                      </span>
                    );
                  })}
                  {r.orders.length > 4 && (
                    <span className="rounded px-1 py-0.5 text-[8px] font-bold text-muted-foreground">
                      +{r.orders.length - 4}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ DispatchScoreBar ------------------------------ */
function DispatchScoreBar({ score }: { score: number | null }) {
  if (score == null) return null;
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 75 ? 'bg-matcha-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
  const label = pct >= 75 ? 'Gut' : pct >= 50 ? 'OK' : 'Schlecht';
  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">Score</span>
        <span className="text-[9px] font-black tabular-nums">{Math.round(pct)} · {label}</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------ DispatchBrowserNotifier ------------------------------ */
// Fires native browser Notification when tours become overdue or orders wait >10 min without a driver.
// Mirrors the in-app overdueAlerts banner but reaches the dispatcher even when the tab is in the background.
function DispatchBrowserNotifier({ batches, orders }: { batches: Batch[]; orders: ReadyOrder[] }) {
  const permRef = useRef<NotificationPermission | null>(null);
  const notifiedOverdueRef = useRef<Set<string>>(new Set());
  const notifiedLongWaitRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((p) => { permRef.current = p; });
    } else {
      permRef.current = Notification.permission;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (permRef.current !== 'granted') {
      permRef.current = Notification.permission;
      if (permRef.current !== 'granted') return;
    }

    const ACTIVE = new Set(['pickup', 'unterwegs', 'pending_acceptance', 'assigned', 'at_restaurant', 'on_route']);
    const now = Date.now();

    for (const b of batches) {
      if (!ACTIVE.has(b.status)) continue;
      const etaMs = b.startzeit && b.total_eta_min != null
        ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
        : null;
      if (!etaMs || now - etaMs < 5 * 60_000) continue;
      if (notifiedOverdueRef.current.has(b.id)) continue;
      notifiedOverdueRef.current.add(b.id);
      const driverName = b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname}` : 'Fahrer unbekannt';
      const overdueMin = Math.floor((now - etaMs) / 60_000);
      new Notification('Tour überfällig – Dispatch', {
        body: `${driverName} · ETA +${overdueMin} Min überschritten`,
        tag: `overdue-${b.id}`,
        icon: '/favicon.ico',
      });
    }
    for (const id of notifiedOverdueRef.current) {
      const b = batches.find((bt) => bt.id === id);
      if (!b || !ACTIVE.has(b.status)) notifiedOverdueRef.current.delete(id);
    }

    for (const o of orders) {
      if (notifiedLongWaitRef.current.has(o.id)) continue;
      const waitMs = o.fertig_am ? now - new Date(o.fertig_am).getTime() : 0;
      if (waitMs < 10 * 60_000) continue;
      notifiedLongWaitRef.current.add(o.id);
      const waitMin = Math.floor(waitMs / 60_000);
      new Notification('Bestellung wartet – Dispatch', {
        body: `${o.bestellnummer} · ${waitMin} Min ohne Fahrer-Zuweisung`,
        tag: `longwait-${o.id}`,
        icon: '/favicon.ico',
      });
    }
    const orderIds = new Set(orders.map((o) => o.id));
    for (const id of notifiedLongWaitRef.current) {
      if (!orderIds.has(id)) notifiedLongWaitRef.current.delete(id);
    }
  }, [batches, orders]);

  return null;
}

/* ------------------------------ BatchSelectionPreview ------------------------------ */

function BatchSelectionPreview({
  orders,
  restaurantLat,
  restaurantLng,
}: {
  orders: ReadyOrder[];
  restaurantLat: number | null;
  restaurantLng: number | null;
}) {
  if (orders.length === 0) return null;

  const totalValue = orders.reduce((s, o) => s + o.gesamtbetrag, 0);
  const avgScore =
    orders.filter((o) => o.dispatch_score != null).length > 0
      ? Math.round(
          orders.reduce((s, o) => s + (o.dispatch_score ?? 0), 0) /
            orders.filter((o) => o.dispatch_score != null).length,
        )
      : null;

  // Zones
  const zones = [...new Set(orders.map((o) => o.delivery_zone).filter(Boolean))] as string[];

  // Estimate route distance: restaurant → stop1 → stop2 → ... → restaurant
  type OrderWithCoords = ReadyOrder & { kunde_lat: number; kunde_lng: number };
  let estDistKm: number | null = null;
  const withCoords = orders.filter((o): o is OrderWithCoords =>
    o.kunde_lat != null && o.kunde_lng != null,
  );
  if (withCoords.length > 0 && restaurantLat != null && restaurantLng != null) {
    let dist = 0;
    let prev = { lat: restaurantLat, lng: restaurantLng };
    for (const o of withCoords) {
      dist += haversineKm(prev, { lat: o.kunde_lat, lng: o.kunde_lng });
      prev = { lat: o.kunde_lat, lng: o.kunde_lng };
    }
    dist += haversineKm(prev, { lat: restaurantLat, lng: restaurantLng });
    estDistKm = Math.round(dist * 10) / 10;
  }

  // Rough ETA estimate: 3 min/km avg delivery speed + 2 min per stop handoff
  const estMinutes = estDistKm != null ? Math.round(estDistKm * 3 + orders.length * 2) : null;

  const scoreColor =
    avgScore == null ? 'text-muted-foreground'
    : avgScore >= 80 ? 'text-matcha-600'
    : avgScore >= 60 ? 'text-blue-500'
    : avgScore >= 40 ? 'text-orange-500'
    : 'text-red-500';

  return (
    <div className="border-t bg-matcha-50/80 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-matcha-600" />
        <span className="font-display text-[10px] font-bold uppercase tracking-wider text-matcha-800">
          Tour-Vorschau · {orders.length} Stopp{orders.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {zones.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-white border px-2 py-1">
            <MapPin className="h-3 w-3 text-matcha-500" />
            <span className="text-[10px] font-semibold">
              {zones.map((z) => `Zone ${z}`).join(' + ')}
            </span>
          </div>
        )}
        {estDistKm != null && (
          <div className="flex items-center gap-1.5 rounded-md bg-white border px-2 py-1">
            <Navigation2 className="h-3 w-3 text-blue-500" />
            <span className="text-[10px] font-semibold tabular-nums">~{estDistKm} km</span>
          </div>
        )}
        {estMinutes != null && (
          <div className="flex items-center gap-1.5 rounded-md bg-white border px-2 py-1">
            <Clock className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-semibold tabular-nums">~{estMinutes} Min</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded-md bg-white border px-2 py-1">
          <Banknote className="h-3 w-3 text-matcha-500" />
          <span className="text-[10px] font-semibold tabular-nums">
            {totalValue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </span>
        </div>
        {avgScore != null && (
          <div className="flex items-center gap-1.5 rounded-md bg-white border px-2 py-1">
            <Gauge className="h-3 w-3 text-matcha-500" />
            <span className={cn('text-[10px] font-bold tabular-nums', scoreColor)}>Score {avgScore}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DispatchTourCompletionSpeedPanel
// Shows, for each active tour (batch), whether it is ahead or behind schedule
// based on stops completed vs time elapsed relative to total ETA.
// ---------------------------------------------------------------------------
function DispatchTourCompletionSpeedPanel({ batches }: { batches: Batch[] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Only show batches that are actively in delivery (have a start time and stops)
  const activeBatches = batches.filter(
    (b) => b.status === 'in_delivery' && b.startzeit && b.stops.length > 0 && b.total_eta_min != null,
  );

  if (activeBatches.length === 0) return null;

  const rows = activeBatches.map((batch) => {
    const startMs = new Date(batch.startzeit!).getTime();
    const elapsedMin = Math.max(0, (now - startMs) / 60_000);
    const totalEtaMin = batch.total_eta_min!;
    const totalStops = batch.stops.length;

    // Linear estimate: how many stops should be done by now
    const progressRatio = totalEtaMin > 0 ? Math.min(elapsedMin / totalEtaMin, 1) : 0;
    const expectedDone = progressRatio * totalStops;

    // Actual stops completed (geliefert_am set)
    const actualDone = batch.stops.filter((s) => s.geliefert_am != null).length;

    const diff = actualDone - expectedDone;
    const diffRounded = Math.round(diff);

    const driverName = batch.fahrer
      ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
      : batch.id.slice(0, 8);

    let statusLabel: string;
    let statusClass: string;
    let Icon: React.ElementType;

    if (diffRounded > 0) {
      statusLabel = `Voraus +${diffRounded} Stopp${diffRounded !== 1 ? 's' : ''}`;
      statusClass = 'text-green-600 bg-green-50 border-green-200';
      Icon = TrendingUp;
    } else if (diffRounded < 0) {
      statusLabel = `Verzögert ${diffRounded} Stopp${Math.abs(diffRounded) !== 1 ? 's' : ''}`;
      statusClass = 'text-red-600 bg-red-50 border-red-200';
      Icon = Clock;
    } else {
      statusLabel = 'Im Plan';
      statusClass = 'text-blue-600 bg-blue-50 border-blue-200';
      Icon = CheckCircle2;
    }

    return { batch, driverName, actualDone, totalStops, elapsedMin, totalEtaMin, statusLabel, statusClass, Icon };
  });

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-matcha-100 bg-matcha-50/40">
        <TrendingUp className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-semibold text-matcha-800">Tour-Geschwindigkeit</span>
        <span className="ml-auto text-[10px] text-matcha-400">Aktualisiert alle 15 s</span>
      </div>
      <div className="divide-y divide-matcha-50">
        {rows.map(({ batch, driverName, actualDone, totalStops, elapsedMin, totalEtaMin, statusLabel, statusClass, Icon }) => (
          <div key={batch.id} className="flex items-center gap-3 px-4 py-2.5">
            {/* Driver / tour info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-800">{driverName}</p>
              <p className="text-[10px] text-gray-400 tabular-nums">
                {actualDone}/{totalStops} Stopps &middot; {Math.round(elapsedMin)} / {Math.round(totalEtaMin)} min
              </p>
            </div>

            {/* Progress bar */}
            <div className="hidden sm:block w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-matcha-400"
                style={{ width: `${Math.min(100, (actualDone / Math.max(1, totalStops)) * 100)}%` }}
              />
            </div>

            {/* Status badge */}
            <div className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', statusClass)}>
              <Icon className="h-3 w-3" />
              {statusLabel}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ DispatchCapacityGauge ------------------------------ */
/* Phase 89: Zeigt verbleibende Kapazität über alle aktiven Touren und freie Fahrer.
   Hilft dem Dispatcher zu sehen, wieviele weitere Bestellungen noch eingebunden werden können. */
function DispatchCapacityGauge({
  batches,
  drivers,
  readyCount,
}: {
  batches: Batch[];
  drivers: Driver[];
  readyCount: number;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const MAX_STOPS_PER_TOUR = 4;

  // Kapazität in aktiven Touren
  const activeTourCapacity = batches.reduce((sum, b) => {
    const openStops = b.stops.filter((s) => !s.geliefert_am).length;
    return sum + Math.max(0, MAX_STOPS_PER_TOUR - openStops);
  }, 0);

  // Freie Online-Fahrer (kein aktiver Batch)
  const freeDrivers = drivers.filter((d) => d.ist_online && !d.aktueller_batch_id);
  const freeDriverCapacity = freeDrivers.length * MAX_STOPS_PER_TOUR;

  const totalCapacity = activeTourCapacity + freeDriverCapacity;
  const deficit = Math.max(0, readyCount - totalCapacity);
  const surplus = Math.max(0, totalCapacity - readyCount);

  if (batches.length === 0 && freeDrivers.length === 0) return null;

  const statusColor =
    deficit > 0 ? 'text-red-600' :
    surplus === 0 ? 'text-amber-600' :
    surplus >= readyCount ? 'text-matcha-600' :
    'text-blue-600';
  const bgColor =
    deficit > 0 ? 'bg-red-50 border-red-200' :
    surplus === 0 ? 'bg-amber-50 border-amber-200' :
    'bg-matcha-50 border-matcha-200';

  const gaugeLabel =
    deficit > 0 ? `${deficit} Best. ohne Kapazität` :
    totalCapacity === 0 ? 'Keine Kapazität' :
    `${surplus} Plätze frei`;

  return (
    <div className={cn('rounded-xl border px-4 py-3', bgColor)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Kapazitäts-Gauge
          </span>
        </div>
        <span className={cn('text-[10px] font-black tabular-nums', statusColor)}>
          {gaugeLabel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="font-black text-xl tabular-nums text-matcha-700">{activeTourCapacity}</div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">In Touren frei</div>
        </div>
        <div className="text-center">
          <div className="font-black text-xl tabular-nums text-blue-600">{freeDriverCapacity}</div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">Freie Fahrer</div>
        </div>
        <div className="text-center">
          <div className={cn('font-black text-xl tabular-nums', statusColor)}>{totalCapacity}</div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">Gesamt frei</div>
        </div>
      </div>
      {/* Visual capacity bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
          <span>{readyCount} bereit</span>
          <span>Max {totalCapacity} Plätze</span>
        </div>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              deficit > 0 ? 'bg-red-500' :
              readyCount === 0 ? 'bg-matcha-300' :
              'bg-matcha-500',
            )}
            style={{ width: totalCapacity > 0 ? `${Math.min(100, (readyCount / totalCapacity) * 100)}%` : '0%' }}
          />
        </div>
      </div>
      {deficit > 0 && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-100/80 border border-red-200 px-2.5 py-1.5 text-[10px] font-semibold text-red-800">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {deficit} Bestellung{deficit > 1 ? 'en' : ''} haben keinen Fahrer — Kapazität erweitern!
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DispatchHandoffSpeedPanel — Ø-Zeit von fertig_am → Batch-Dispatch
// ---------------------------------------------------------------------------
function DispatchHandoffSpeedPanel({ locationId }: { locationId: string | null }) {
  const supabase = createClient();
  type HandoffRow = { sec: number; hour: number };
  const [rows, setRows] = useState<HandoffRow[]>([]);

  useEffect(() => {
    if (!locationId) return;
    async function load() {
      const since = new Date(Date.now() - 8 * 3600_000).toISOString();
      const { data } = await supabase
        .from('delivery_batch_stops')
        .select('order:customer_orders(fertig_am, location_id), batch:delivery_batches(startzeit)')
        .gte('created_at', since)
        .limit(60);

      if (!data) return;
      const parsed: HandoffRow[] = [];
      for (const row of data as unknown as { order: { fertig_am: string | null; location_id: string | null } | null; batch: { startzeit: string | null } | null }[]) {
        if (!row.order?.fertig_am || !row.batch?.startzeit) continue;
        if (locationId && row.order.location_id !== locationId) continue;
        const sec = Math.round((new Date(row.batch.startzeit).getTime() - new Date(row.order.fertig_am).getTime()) / 1000);
        if (sec < 0 || sec > 1800) continue;
        parsed.push({ sec, hour: new Date(row.batch.startzeit).getHours() });
      }
      setRows(parsed);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (rows.length < 3) return null;

  const avg = Math.round(rows.reduce((s, r) => s + r.sec, 0) / rows.length);
  const recent5 = rows.slice(-5);
  const recentAvg = Math.round(recent5.reduce((s, r) => s + r.sec, 0) / recent5.length);
  const trend = recentAvg - avg;

  const buckets = [30, 60, 120, 180, 300, 600];
  const labels  = ['<30s', '1m', '2m', '3m', '5m', '10m', '>10m'];
  const hist = Array(labels.length).fill(0);
  rows.forEach(r => {
    const idx = buckets.findIndex(b => r.sec < b);
    hist[idx === -1 ? labels.length - 1 : idx]++;
  });
  const maxH = Math.max(...hist, 1);

  const avgColor = avg < 120 ? 'text-matcha-400' : avg < 300 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-matcha-700 bg-matcha-900/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-white">
          <Zap className="h-3.5 w-3.5 text-gold" />
          Handoff-Geschwindigkeit
        </span>
        <span className="text-[10px] text-matcha-400">{rows.length} Touren heute</span>
      </div>
      <div className="flex items-end gap-4">
        <div>
          <div className={cn('font-mono text-2xl font-black tabular-nums', avgColor)}>
            {avg < 60 ? `${avg}s` : `${Math.floor(avg / 60)}m${String(avg % 60).padStart(2, '0')}s`}
          </div>
          <div className="text-[9px] text-matcha-400">Ø fertig → Fahrer</div>
        </div>
        {trend !== 0 && (
          <div className={cn('text-xs font-bold', trend < 0 ? 'text-matcha-400' : 'text-red-400')}>
            {trend < 0 ? '▼ ' : '▲ '}{Math.abs(trend)}s letzte 5
          </div>
        )}
      </div>
      <div className="flex items-end gap-1 h-10">
        {hist.map((count, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
            <div
              className={cn('w-full rounded-sm', count > 0 ? 'bg-matcha-500' : 'bg-matcha-800')}
              style={{ height: `${Math.round((count / maxH) * 36)}px` }}
            />
            <span className="text-[7px] text-matcha-500 font-mono">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   DispatchBundleOpportunityAlert
   Zeigt proaktiv Bündelungsmöglichkeiten: Zonen mit ≥2 fertigen Bestellungen
   ohne zugewiesenen Fahrer — Dispatcher kann sofort bündeln.
   --------------------------------------------------------------------------- */
function DispatchBundleOpportunityAlert({ orders, drivers }: { orders: ReadyOrder[]; drivers: Driver[] }) {
  const unassigned = orders.filter(
    (o) => o.status === 'fertig' && o.typ === 'lieferung',
  );
  if (unassigned.length < 2) return null;

  const freeDrivers = drivers.filter((d) => d.ist_online && !d.aktueller_batch_id);

  // Group by zone
  const byZone: Record<string, ReadyOrder[]> = {};
  for (const o of unassigned) {
    const z = o.delivery_zone ?? 'X';
    if (!byZone[z]) byZone[z] = [];
    byZone[z].push(o);
  }

  const opportunities = Object.entries(byZone)
    .filter(([, zoneOrders]) => zoneOrders.length >= 2)
    .map(([zone, zoneOrders]) => ({
      zone,
      count: zoneOrders.length,
      totalValue: zoneOrders.reduce((s, o) => s + o.gesamtbetrag, 0),
      oldestWaitMin: (() => {
        const oldest = zoneOrders.reduce((m, o) => {
          const ms = o.fertig_am ? Date.now() - new Date(o.fertig_am).getTime() : 0;
          return ms > m ? ms : m;
        }, 0);
        return Math.floor(oldest / 60_000);
      })(),
    }))
    .sort((a, b) => b.count - a.count || b.oldestWaitMin - a.oldestWaitMin);

  if (opportunities.length === 0) return null;

  const ZONE_CLS: Record<string, string> = {
    A: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    B: 'border-blue-300 bg-blue-50 text-blue-800',
    C: 'border-amber-300 bg-amber-50 text-amber-800',
    D: 'border-red-300 bg-red-50 text-red-800',
    X: 'border-gray-300 bg-gray-50 text-gray-800',
  };

  return (
    <Card className="border-matcha-200 bg-matcha-50/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-200/60">
        <Zap className="h-4 w-4 text-matcha-700 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider text-matcha-800">
          Bündelungschancen
        </span>
        <Badge variant="secondary" className="bg-matcha-100 text-matcha-800">
          {opportunities.length} Zone{opportunities.length !== 1 ? 'n' : ''}
        </Badge>
        {freeDrivers.length > 0 && (
          <span className="ml-auto text-[10px] font-bold text-matcha-600">
            {freeDrivers.length} Fahrer frei
          </span>
        )}
      </div>
      <div className="p-3 flex flex-wrap gap-2">
        {opportunities.map(({ zone, count, totalValue, oldestWaitMin }) => (
          <div
            key={zone}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2',
              ZONE_CLS[zone] ?? ZONE_CLS['X'],
              oldestWaitMin >= 10 && 'ring-1 ring-red-400 animate-pulse',
            )}
          >
            <div className="font-display text-sm font-black">Zone {zone}</div>
            <div className="flex flex-col items-center shrink-0">
              <span className="text-xl font-black tabular-nums leading-none">{count}</span>
              <span className="text-[8px] font-bold uppercase">Bestellungen</span>
            </div>
            <div className="text-[10px] space-y-0.5">
              <div className="font-bold tabular-nums">
                {totalValue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </div>
              <div className={cn('font-bold', oldestWaitMin >= 10 ? 'text-red-600' : 'text-muted-foreground')}>
                {oldestWaitMin > 0 ? `⏱ ${oldestWaitMin}m warten` : 'Gerade fertig'}
              </div>
            </div>
            <div className={cn(
              'rounded-full px-2 py-0.5 text-[8px] font-black shrink-0',
              count >= 3 ? 'bg-matcha-700 text-white' : 'bg-white/60 text-muted-foreground',
            )}>
              {count >= 3 ? '→ Sofort bündeln!' : '→ Bündeln'}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DispatchActiveTourScoreBoard
// Zeigt alle aktiven Touren als priorisierte Score-Liste:
// ETA-Status (grün/gelb/rot), Fortschritt (X von Y Stopps), Fahrername
// Hilft dem Dispatcher, sofort zu sehen welche Touren Aufmerksamkeit brauchen.
// ---------------------------------------------------------------------------
export function DispatchActiveTourScoreBoard({ batches, drivers }: { batches: Batch[]; drivers: Driver[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  type TourRow = {
    batch: Batch;
    driverName: string;
    completedStops: number;
    totalStops: number;
    elapsedMin: number;
    etaMin: number | null;
    remainMin: number | null;
    health: 'on-time' | 'tight' | 'late' | 'unknown';
    progressPct: number;
  };

  const rows: TourRow[] = batches
    .filter((b) => ['unterwegs', 'on_route', 'gestartet'].includes(b.status))
    .map((b) => {
      const driver = drivers.find((d) => d.employee_id === (b.fahrer_id ?? ''));
      const driverName = driver?.employee
        ? `${driver.employee.vorname} ${driver.employee.nachname[0]}.`
        : 'Fahrer';
      const totalStops = b.stops?.length ?? 0;
      const completedStops = b.stops?.filter((s) => s.geliefert_am).length ?? 0;
      const startMs = b.startzeit ? new Date(b.startzeit).getTime() : null;
      const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
      const etaMin = b.total_eta_min ?? null;
      const remainMin = etaMin !== null ? Math.max(0, etaMin - elapsedMin) : null;

      let health: TourRow['health'] = 'unknown';
      if (etaMin !== null) {
        const usedPct = elapsedMin / etaMin;
        const donePct = totalStops > 0 ? completedStops / totalStops : 0;
        if (usedPct - donePct > 0.3) health = 'late';
        else if (usedPct - donePct > 0.1) health = 'tight';
        else health = 'on-time';
      }

      return {
        batch: b,
        driverName,
        completedStops,
        totalStops,
        elapsedMin,
        etaMin,
        remainMin,
        health,
        progressPct: totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0,
      };
    })
    .sort((a, b) => {
      const order = ['late', 'tight', 'on-time', 'unknown'];
      return order.indexOf(a.health) - order.indexOf(b.health);
    });

  if (rows.length === 0) return null;

  const healthStyle = {
    late:     { bg: 'bg-red-50',     border: 'border-red-200',     badge: 'bg-red-500 text-white',      label: 'Verspätet',   barColor: 'bg-red-400'   },
    tight:    { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-400 text-white',    label: 'Knapp',       barColor: 'bg-amber-400' },
    'on-time':{ bg: 'bg-matcha-50',  border: 'border-matcha-200',  badge: 'bg-matcha-500 text-white',   label: 'Pünktlich',   barColor: 'bg-matcha-500'},
    unknown:  { bg: 'bg-muted/30',   border: 'border-border',      badge: 'bg-muted text-muted-foreground', label: 'Unbekannt', barColor: 'bg-muted-foreground'},
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <RouteIcon className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Aktive Touren · Score-Board
        </span>
        <Badge variant="secondary" className="ml-auto">
          {rows.length} Tour{rows.length !== 1 ? 'en' : ''}
        </Badge>
      </div>
      <div className="divide-y">
        {rows.map((row) => {
          const hs = healthStyle[row.health];
          return (
            <div key={row.batch.id} className={cn('px-4 py-3 flex items-center gap-3', hs.bg)}>
              {/* Health badge */}
              <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[58px] text-center', hs.badge)}>
                {hs.label}
              </div>

              {/* Driver + zone */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold truncate">{row.driverName}</span>
                  {row.batch.zone && (
                    <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                      Zone {row.batch.zone}
                    </span>
                  )}
                  {row.remainMin !== null && (
                    <span className={cn(
                      'text-[10px] font-bold tabular-nums',
                      row.health === 'late' ? 'text-red-600' : row.health === 'tight' ? 'text-amber-600' : 'text-matcha-600',
                    )}>
                      ~{row.remainMin} Min verbleibend
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', hs.barColor)}
                      style={{ width: `${row.progressPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                    {row.completedStops}/{row.totalStops}
                  </span>
                </div>
              </div>

              {/* Elapsed */}
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-black tabular-nums text-foreground">
                  {row.elapsedMin}m
                </div>
                <div className="text-[8px] text-muted-foreground">vergangen</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
