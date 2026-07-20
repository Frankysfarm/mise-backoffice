'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navigation, MapPin, Banknote, CreditCard, Check, CheckCircle2, Loader2, Phone, PhoneCall, ArrowRight, Map as MapIcon, Flag, TrendingUp, Share2, AlertTriangle, MessageSquare, AlertCircle, Camera, ImageIcon, Clock } from 'lucide-react';
import { euro, cn } from '@/lib/utils';
import { enqueueOutbox, flushOutbox } from './outbox';

type FailedReason = 'no_answer' | 'wrong_address' | 'refused' | 'access_denied' | 'not_home' | 'other';
const FAILED_REASON_LABELS: Record<FailedReason, string> = {
  no_answer:      'Keine Reaktion',
  not_home:       'Nicht zu Hause',
  wrong_address:  'Falsche Adresse',
  refused:        'Annahme verweigert',
  access_denied:  'Kein Zutritt (Tor/Klingel)',
  other:          'Sonstiges',
};

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
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
  };
};

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [confirmSkipId, setConfirmSkipId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const driverMarkerRef = useRef<any>(null);
  const leafletMapRef = useRef<any>(null);
  const mountedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [copiedStopId, setCopiedStopId] = useState<string | null>(null);
  const [failedStopId, setFailedStopId] = useState<string | null>(null);
  const [failedReason, setFailedReason] = useState<FailedReason>('no_answer');
  const [failedNotes, setFailedNotes] = useState('');
  const [pendingFailed, setPendingFailed] = useState<string | null>(null);
  const [delayOpen, setDelayOpen] = useState(false);
  const [delaySent, setDelaySent] = useState(false);
  // Kundennachrichten: Map<order_id, Nachricht[]>
  const [customerMsgs, setCustomerMsgs] = useState<Map<string, { id: string; nachricht: string; created_at: string }[]>>(new Map());
  const [expandedMsgOrderId, setExpandedMsgOrderId] = useState<string | null>(null);
  type ProofType = 'handed_to_person' | 'left_at_door' | 'neighbour' | 'contactless' | 'photo';
  const [proofModalStopId, setProofModalStopId] = useState<string | null>(null);
  const [proofType, setProofType] = useState<ProofType>('handed_to_person');
  const [proofNotes, setProofNotes] = useState('');
  const [proofPending, setProofPending] = useState(false);
  const [proofPhotoBlob, setProofPhotoBlob] = useState<Blob | null>(null);
  const [proofPhotoPreview, setProofPhotoPreview] = useState<string | null>(null);
  const proofCameraRef = useRef<HTMLInputElement>(null);
  type OItem = { order_id: string; name: string; menge: number; einzelpreis: number; notiz: string | null };
  const [orderItems, setOrderItems] = useState<Map<string, OItem[]>>(new Map());
  const [showItemsStopId, setShowItemsStopId] = useState<string | null>(null);
  const [restaurantLoc, setRestaurantLoc] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [showAllStops, setShowAllStops] = useState(false);
  // F2 Kunde-nicht-erreichbar Flow: Anrufen -> Warte-Timer -> melden (cant_find_customer)
  const [unreachableStopId, setUnreachableStopId] = useState<string | null>(null);
  const [unreachablePhase, setUnreachablePhase] = useState<'call' | 'waiting'>('call');
  const [unreachableCountdown, setUnreachableCountdown] = useState(0);
  const [unreachablePending, setUnreachablePending] = useState(false);
  const UNREACHABLE_WAIT_SEC = 120;
  // (fremde Arbeit beibehalten)
  const [routeChangedNotice, setRouteChangedNotice] = useState<{ type: string; ts: number } | null>(null);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - mountedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const getToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    };
    const on = () => { setIsOnline(true); flushOutbox(getToken).catch(() => {}); };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
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

  // Tour-Modifikationen: Echtzeit-Benachrichtigung wenn Dispatch die Route ändert
  useEffect(() => {
    const ch = supabase
      .channel(`tour-mods-${batchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tour_modifications',
        filter: `batch_id=eq.${batchId}`,
      }, (payload: { new: { modification_type: string; created_at: string } }) => {
        const type = payload.new.modification_type;
        setRouteChangedNotice({ type, ts: Date.now() });
        setTimeout(() => setRouteChangedNotice(null), 12_000);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // Kundennachrichten laden + Realtime-Abo
  useEffect(() => {
    const orderIds = initialStops.map((s) => s.order_id);
    if (orderIds.length === 0) return;

    // Initial laden
    supabase
      .from('order_messages')
      .select('id, order_id, nachricht, created_at')
      .in('order_id', orderIds)
      .eq('sender', 'kunde')
      .order('created_at', { ascending: false })
      .then(({ data }: { data: { id: string; order_id: string; nachricht: string; created_at: string }[] | null }) => {
        if (!data) return;
        const map = new Map<string, { id: string; nachricht: string; created_at: string }[]>();
        for (const m of data) {
          if (!map.has(m.order_id)) map.set(m.order_id, []);
          map.get(m.order_id)!.push({ id: m.id, nachricht: m.nachricht, created_at: m.created_at });
        }
        setCustomerMsgs(map);
      });

    // Realtime: neue Kundennachrichten
    const ch = supabase
      .channel(`delivery-msgs-${batchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `order_id=in.(${orderIds.join(',')})`,
      }, (payload: { new: { id: string; order_id: string; sender: string; nachricht: string; created_at: string } }) => {
        const { new: msg } = payload;
        if (msg.sender !== 'kunde') return;
        setCustomerMsgs((prev) => {
          const m = new Map(prev);
          const existing = m.get(msg.order_id) ?? [];
          m.set(msg.order_id, [{ id: msg.id, nachricht: msg.nachricht, created_at: msg.created_at }, ...existing]);
          return m;
        });
        setExpandedMsgOrderId(msg.order_id);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // Bestellpositionen laden (für Lieferverifizierung)
  useEffect(() => {
    const orderIds = initialStops.map((s) => s.order_id);
    if (orderIds.length === 0) return;
    supabase
      .from('order_items')
      .select('order_id, name, menge, einzelpreis, notiz')
      .in('order_id', orderIds)
      .then(({ data }: { data: OItem[] | null }) => {
        if (!data) return;
        const map = new Map<string, OItem[]>();
        for (const item of data) {
          if (!map.has(item.order_id)) map.set(item.order_id, []);
          map.get(item.order_id)!.push(item);
        }
        setOrderItems(map);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // Restaurant-Standort laden (für Rückfahrt-Navigation nach Tour-Ende)
  useEffect(() => {
    (async () => {
      const { data: batch } = await supabase
        .from('delivery_batches')
        .select('location:locations(name, lat, lng)')
        .eq('id', batchId)
        .maybeSingle();
      const loc = (batch as any)?.location;
      if (loc?.lat && loc?.lng) {
        setRestaurantLoc({ lat: loc.lat, lng: loc.lng, name: loc.name ?? 'Restaurant' });
        return;
      }
      // Fallback: mise_delivery_batches
      const { data: miseBatch } = await supabase
        .from('mise_delivery_batches')
        .select('location:mise_locations(name, latitude, longitude)')
        .eq('id', batchId)
        .maybeSingle();
      const ml = (miseBatch as any)?.location;
      if (ml?.latitude && ml?.longitude) {
        setRestaurantLoc({ lat: ml.latitude, lng: ml.longitude, name: ml.name ?? 'Restaurant' });
      }
    })();
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
  // Skipped stops go to back; all other open stops come first
  const nextStop = openStops.find((s) => !skippedIds.has(s.id)) ?? openStops[0];
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

  function vibrate(pattern: number | number[]) {
    try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch {}
  }

  async function markArrived(stopId: string) {
    vibrate([50, 30, 50]);
    const now = new Date().toISOString();
    // Optimistic UI update immediately
    setArrivedIds((s) => new Set([...s, stopId]));
    setStops((xs) => xs.map((x) => x.id === stopId ? { ...x, angekommen_am: now } : x));
    // Persist arrived_at via API (with outbox fallback when offline)
    const url = `/api/driver/v1/batch/${batchId}/stops/${stopId}/arrived`;
    if (!isOnline) {
      enqueueOutbox(url, 'POST', {});
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        // Fallback: direct supabase writes
        await Promise.all([
          supabase.from('delivery_batch_stops').update({ angekommen_am: now }).eq('id', stopId),
          supabase.from('mise_delivery_batch_stops').update({ arrived_at: now }).eq('id', stopId),
        ]);
      }
    } catch {
      // Network error — enqueue for retry
      enqueueOutbox(url, 'POST', {});
    }
  }

  async function markDelivered(stopId: string) {
    vibrate([100, 50, 100, 50, 200]);
    setPending(stopId);
    const now = new Date().toISOString();
    const stop = stops.find((s) => s.id === stopId);
    // Optimistic UI update
    setStops((xs) => xs.map((x) => x.id === stopId ? { ...x, geliefert_am: now } : x));
    const url = `/api/driver/v1/orders/${stop?.order_id}/delivered`;
    if (!stop?.order_id) {
      // No order_id: fallback direct writes
      await Promise.all([
        supabase.from('delivery_batch_stops').update({ geliefert_am: now, angekommen_am: now }).eq('id', stopId),
        supabase.from('mise_delivery_batch_stops').update({ completed_at: now, arrived_at: now }).eq('id', stopId),
      ]);
      setPending(null);
      if (openStops.length === 1) setTimeout(() => onAllDone(), 800);
      return;
    }
    if (!isOnline) {
      enqueueOutbox(url, 'POST', { stop_id: stopId });
      setPending(null);
      if (openStops.length === 1) setTimeout(() => onAllDone(), 800);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ stop_id: stopId }),
      });
      if (!res.ok) {
        // API failed — fallback to direct writes so delivery is never lost
        await Promise.all([
          supabase.from('delivery_batch_stops').update({ geliefert_am: now, angekommen_am: now }).eq('id', stopId),
          supabase.from('mise_delivery_batch_stops').update({ completed_at: now, arrived_at: now }).eq('id', stopId),
          supabase.from('customer_orders').update({ status: 'geliefert', geliefert_am: now }).eq('id', stop.order_id),
        ]);
      }
    } catch {
      // Network error — enqueue for retry
      enqueueOutbox(url, 'POST', { stop_id: stopId });
    }
    setPending(null);
    if (openStops.length === 1) setTimeout(() => onAllDone(), 800);
  }

  async function markFailedAttempt(stopId: string) {
    const stop = stops.find((s) => s.id === stopId);
    if (!stop) return;
    setPendingFailed(stopId);
    try {
      await fetch(`/api/delivery/tours/${batchId}/failed-attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stop_id:   stopId,
          order_id:  stop.order_id,
          reason:    failedReason,
          notes:     failedNotes.trim() || null,
          driver_lat: driverLat,
          driver_lng: driverLng,
        }),
      });
    } catch { /* fire-and-forget */ }
    setPendingFailed(null);
    setSkippedIds((s) => new Set([...s, stopId]));
    setFailedStopId(null);
    setFailedNotes('');
    setFailedReason('no_answer');
  }

  // F2: Warte-Timer fuer "Kunde nicht erreichbar"
  function startUnreachableWait() {
    setUnreachablePhase('waiting');
    setUnreachableCountdown(UNREACHABLE_WAIT_SEC);
  }
  useEffect(() => {
    if (unreachablePhase !== 'waiting' || unreachableCountdown <= 0) return;
    const t = setTimeout(() => setUnreachableCountdown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [unreachablePhase, unreachableCountdown]);

  function closeUnreachable() {
    setUnreachableStopId(null);
    setUnreachablePhase('call');
    setUnreachableCountdown(0);
  }

  // F2: eskalieren -> Issue cant_find_customer melden (Bearer-Auth)
  async function reportCantFindCustomer(stopId: string) {
    const stop = stops.find((s) => s.id === stopId);
    if (!stop) return;
    setUnreachablePending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/driver/v1/orders/${stop.order_id}/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: 'cant_find_customer',
          detail: `Kunde ${stop.order.kunde_name} nach Anruf + ${UNREACHABLE_WAIT_SEC}s Warten nicht erreichbar.`,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as any)?.error ?? 'Melden fehlgeschlagen');
        return;
      }
      // Stop lokal zuruckstellen, damit Fahrer weiterfahren kann
      setSkippedIds((s) => new Set([...s, stopId]));
      closeUnreachable();
    } finally {
      setUnreachablePending(false);
    }
  }

  async function uploadProofPhoto(blob: Blob, stopId: string): Promise<string | null> {
    try {
      const path = `${batchId}/${stopId}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('delivery-proofs').upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (error) return null;
      const { data } = supabase.storage.from('delivery-proofs').getPublicUrl(path);
      return data?.publicUrl ?? null;
    } catch {
      return null;
    }
  }

  async function confirmDeliveryWithProof(stopId: string) {
    setProofPending(true);
    const stop = stops.find((s) => s.id === stopId);

    let photoUrl: string | null = null;
    if (proofType === 'photo' && proofPhotoBlob) {
      photoUrl = await uploadProofPhoto(proofPhotoBlob, stopId);
    }

    // Fire-and-forget — proof stored for admin review, delivery proceeds regardless
    fetch(`/api/delivery/tours/${batchId}/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stop_id:    stopId,
        order_id:   stop?.order_id ?? null,
        proof_type: proofType,
        photo_url:  photoUrl,
        notes:      proofNotes.trim() || null,
        driver_lat: driverLat ?? null,
        driver_lng: driverLng ?? null,
      }),
    }).catch(() => {});
    await markDelivered(stopId);
    setProofModalStopId(null);
    setProofNotes('');
    setProofType('handed_to_person');
    setProofPhotoBlob(null);
    setProofPhotoPreview(null);
    setProofPending(false);
  }

  // Live earnings estimate: base €1.50/stop + €0.20/km from completed stops
  const deliveredStops = sorted.filter((s) => s.geliefert_am);
  const estimatedEarnings = deliveredStops.reduce((sum, s) => {
    const kmBonus = s.distanz_zum_vorgaenger_m != null ? (s.distanz_zum_vorgaenger_m / 1000) * 0.20 : 0;
    return sum + 1.50 + kmBonus;
  }, 0);

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Offline-Warnung */}
      {!isOnline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-[var(--danger)] px-4 py-2 text-sm font-bold text-[var(--ink)]">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          Kein Internet — Änderungen werden verzögert synchronisiert
        </div>
      )}
      {/* Route-Änderungs-Banner — erscheint wenn Dispatch die Tour live modifiziert */}
      {routeChangedNotice && (
        <div className="sticky top-0 z-40 flex items-center gap-3 bg-blue-600 px-4 py-2.5 text-white animate-in slide-in-from-top-2 duration-300">
          <span className="text-lg shrink-0">🔄</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-black uppercase tracking-wide">Route aktualisiert</div>
            <div className="text-[10px] opacity-80">
              {routeChangedNotice.type === 'tour_reoptimized' || routeChangedNotice.type === 'tour_stop_removed'
                ? 'Dispatch hat deine Route neu optimiert. Bitte prüfe die Stopps.'
                : routeChangedNotice.type === 'tour_stop_inserted' || routeChangedNotice.type === 'stop_inserted'
                  ? 'Ein neuer Stopp wurde zu deiner Tour hinzugefügt.'
                  : 'Deine Tour wurde vom Dispatch geändert.'}
            </div>
          </div>
          <button
            onClick={() => setRouteChangedNotice(null)}
            className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold"
          >
            OK
          </button>
        </div>
      )}
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Lieferung läuft</div>
            <div className="font-display font-bold text-lg">
              {doneCount} / {stops.length} zugestellt
            </div>
            <div className="text-[10px] text-[var(--ink-3)] mono mt-0.5 flex items-center gap-2">
              <span>Unterwegs seit {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} Min</span>
              {gpsSpeed != null && gpsSpeed > 0 && (
                <SpeedArcGauge speed={gpsSpeed} />
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
                    'text-[10px] font-bold mono',
                    secLeft <= 0 && doneCount < stops.length ? 'text-[var(--warn)]' : 'text-[var(--ink-3)]',
                  )}>
                    {doneCount === stops.length ? '✓ Tour abgeschlossen' : `Tour fertig ~${finishStr}`}
                  </span>
                  {doneCount < stops.length && secLeft > -600 && (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-black mono',
                      secLeft <= 0 ? 'bg-[var(--warn-tint)] text-[var(--warn)]' :
                      secLeft < 300 ? 'bg-[var(--warn-tint)] text-[var(--warn)]' :
                      'bg-[var(--surface-2)] text-[var(--ink-2)]',
                    )}>
                      {secLeft <= 0 ? 'Überfällig' : `noch ${Math.floor(secLeft / 60)}:${String(secLeft % 60).padStart(2, '0')}`}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex-1 flex flex-col items-end gap-1.5 ml-3">
            <div className="w-full h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${(doneCount / stops.length) * 100}%` }} />
            </div>
            {estimatedEarnings > 0 && (
              <div className="inline-flex items-center gap-1 rounded-full bg-accent/15 border border-[var(--accent)]/30 px-2 py-1">
                <TrendingUp size={10} className="text-accent" />
                <span className="text-[10px] font-bold mono text-accent">
                  ~{estimatedEarnings.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {/* Verzögerung melden — sendet Nachricht an Kunden-Tracking */}
            <button
              onClick={() => setDelayOpen(true)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition',
                delaySent
                  ? 'bg-[var(--surface-2)] text-[var(--ink-2)]'
                  : 'bg-[var(--warn-tint)] border border-[var(--warn)]/30 text-[var(--warn)] active:scale-95',
              )}
              title="Verzögerung oder Problem melden"
            >
              <AlertCircle size={9} />
              {delaySent ? 'Gemeldet ✓' : 'Verspätung?'}
            </button>
          </div>
        </div>
        {/* Tour-Kassen-Zusammenfassung */}
        {(() => {
          const cashStops = stops.filter((s) => !s.order.bezahlt && (s.order.zahlungsart === 'bar' || s.order.zahlungsart == null));
          const totalCash = cashStops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          const totalAll = stops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          if (totalCash === 0) return null;
          return (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg bg-[var(--warn-tint)] border border-[var(--warn)]/30 px-3 py-1.5">
                <Banknote size={12} className="text-[var(--warn)]" />
                <span className="text-[11px] font-bold text-[var(--warn)]">Bar kassieren: {euro(totalCash)}</span>
              </div>
              <div className="text-[10px] text-[var(--ink-3)]">Gesamt: {euro(totalAll)}</div>
            </div>
          );
        })()}
      </div>

      {/* Next-Stop-Hero: prominente Anzeige des nächsten Stops */}
      {nextStop && !allDone && (
        <div className="mx-4 mt-3 rounded-2xl bg-[var(--accent-tint)] border-2 border-[var(--accent)]/30 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-accent">Nächster Stopp</span>
            <span className={cn(
              'ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold mono',
              !nextStop.order.bezahlt && (nextStop.order.zahlungsart === 'bar' || nextStop.order.zahlungsart == null)
                ? 'bg-[var(--warn)] text-[var(--ink)]'
                : 'bg-[var(--surface-2)] text-[var(--ink)]',
            )}>
              {!nextStop.order.bezahlt && (nextStop.order.zahlungsart === 'bar' || nextStop.order.zahlungsart == null)
                ? `BAR ${euro(nextStop.order.gesamtbetrag)}`
                : `Online ✓`}
            </span>
          </div>
          <div className="font-display text-xl font-black leading-tight">{nextStop.order.kunde_name}</div>
          <div className="mt-0.5 text-sm text-[var(--ink-2)] leading-tight">
            {nextStop.order.kunde_adresse}
            {nextStop.order.kunde_plz && `, ${nextStop.order.kunde_plz}`}
          </div>
          {nextStop.order.kunde_notiz && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-[var(--warn-tint)] border border-[var(--warn)]/30 px-2 py-1.5">
              <span className="text-[var(--warn)] text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5">Notiz:</span>
              <span className="text-[var(--warn)] text-[11px] leading-snug">{nextStop.order.kunde_notiz}</span>
            </div>
          )}
          {nextStop.order.kunde_lieferhinweis && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-[var(--accent-tint)] border border-[var(--accent)]/30 px-2 py-1.5">
              <span className="text-[var(--accent)] text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5">Lieferhinweis:</span>
              <span className="text-[var(--accent)] text-[11px] leading-snug">{nextStop.order.kunde_lieferhinweis}</span>
            </div>
          )}
          {/* Bestellpositionen: Lieferverifizierung */}
          {(() => {
            const items = orderItems.get(nextStop.order_id);
            if (!items || items.length === 0) return null;
            const isShown = showItemsStopId === nextStop.id;
            return (
              <div className="mt-2">
                <button
                  onClick={() => setShowItemsStopId(isShown ? null : nextStop.id)}
                  className="flex items-center gap-2 w-full text-left rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2 transition active:scale-[0.99]"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-3)]">
                    {items.reduce((s, i) => s + i.menge, 0)} Artikel prüfen
                  </span>
                  <span className="ml-auto text-[var(--ink-3)] text-[10px]">{isShown ? '▲' : '▼'}</span>
                </button>
                {isShown && (
                  <div className="mt-1 rounded-xl bg-[var(--surface)] border border-[var(--line)] divide-y divide-[var(--line)] overflow-hidden">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2">
                        <span className="h-6 w-6 rounded-full bg-[var(--surface-2)] text-[var(--ink-2)] flex items-center justify-center font-black text-[11px] shrink-0">
                          {item.menge}
                        </span>
                        <span className="flex-1 text-[12px] font-semibold text-[var(--ink-2)] leading-tight">{item.name}</span>
                        {item.notiz && (
                          <span className="text-[9px] text-[var(--warn)] italic max-w-[80px] truncate">{item.notiz}</span>
                        )}
                        <span className="text-[10px] text-[var(--ink-3)] mono">
                          {(item.menge * item.einzelpreis).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="mt-2 flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-[var(--ink-3)]">
              <span className="h-5 w-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-black text-[10px]">
                {nextStop.reihenfolge}
              </span>
              Stopp {nextStop.reihenfolge} von {stops.length}
            </span>
            {nextStop.distanz_zum_vorgaenger_m != null && nextStop.distanz_zum_vorgaenger_m > 0 && (
              <span className="text-[var(--ink-3)] mono">
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
                  secLeft < 0 ? 'bg-[var(--danger-tint)] text-[var(--danger)]' :
                  secLeft < 180 ? 'bg-[var(--warn-tint)] text-[var(--warn)]' :
                  'bg-[var(--surface-2)] text-[var(--ink-2)]',
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
                  ? 'bg-[var(--danger-tint)] text-[var(--danger)] animate-pulse'
                  : secLeft < 300
                    ? 'bg-[var(--warn-tint)] text-[var(--warn)]'
                    : 'bg-[var(--surface-2)]/60 text-[var(--ink-2)]',
              )}>
                <span>{overdue ? '⚠ ETA überzogen' : '🕐 ETA'}</span>
                <span className="mono">
                  {latestStr ? `${etaStr}–${latestStr}` : etaStr} Uhr
                </span>
                {!overdue && secLeft < 600 && (
                  <span className="mono">
                    (noch {Math.floor(secLeft / 60)}:{String(secLeft % 60).padStart(2, '0')})
                  </span>
                )}
              </div>
            );
          })()}

          {/* Aktionen (Anrufen/Navigieren/Liefern) liegen in der Stopp-Karte unten — Drive 07-route */}
        </div>
      )}

      {/* Upcoming Stops Preview — kompakter Horizontalstreifen für Stops 2..n */}
      {openStops.length > 1 && (
        <div className="mx-4 mt-2">
          <div className="text-[9px] font-black uppercase tracking-widest text-[var(--ink-3)] mb-1.5">
            Nächste Stops
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {openStops.slice(1).map((s, idx) => {
              const distKm = s.distanz_zum_vorgaenger_m != null && s.distanz_zum_vorgaenger_m > 0
                ? (s.distanz_zum_vorgaenger_m / 1000).toFixed(1)
                : null;
              const isCash = !s.order.bezahlt && (s.order.zahlungsart === 'bar' || s.order.zahlungsart == null);
              return (
                <div
                  key={s.id}
                  className="shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 min-w-[140px] max-w-[180px]"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="h-5 w-5 rounded-full bg-[var(--surface-2)] text-[var(--ink-2)] flex items-center justify-center font-black text-[10px] shrink-0">
                      {s.reihenfolge}
                    </span>
                    {isCash && (
                      <span className="rounded-full bg-[var(--warn-tint)] text-[var(--warn)] px-1.5 py-0.5 text-[9px] font-bold">
                        BAR
                      </span>
                    )}
                    {distKm && (
                      <span className="text-[9px] text-[var(--ink-3)] ml-auto mono">{distKm} km</span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-[var(--ink-2)] leading-tight truncate">
                    {s.order.kunde_name}
                  </div>
                  <div className="text-[9px] text-[var(--ink-3)] leading-tight truncate mt-0.5">
                    {s.order.kunde_adresse}
                  </div>
                  {/* Schnellaktionen: Anrufen + Navigation */}
                  <div className="mt-1.5 flex gap-1.5">
                    {s.order.kunde_telefon && (
                      <a
                        href={`tel:${s.order.kunde_telefon}`}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-[var(--surface-2)]/60 border border-[var(--line)] py-1 text-[9px] font-bold text-[var(--ink-2)] active:scale-[0.97] transition"
                        title="Anrufen"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone size={9} />
                        Anrufen
                      </a>
                    )}
                    {s.order.kunde_lat && s.order.kunde_lng && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${s.order.kunde_lat},${s.order.kunde_lng}&travelmode=driving`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-accent/15 border border-[var(--accent)]/30 py-1 text-[9px] font-bold text-accent active:scale-[0.97] transition"
                        title="Navigation"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Navigation size={9} />
                        Nav
                      </a>
                    )}
                  </div>
                  {s.order.eta_earliest && (() => {
                    const etaMs = new Date(s.order.eta_earliest).getTime();
                    const secLeft = Math.floor((etaMs - Date.now()) / 1000);
                    const etaStr = new Date(s.order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    const overdue = secLeft < 0;
                    const soon = !overdue && secLeft < 600;
                    const rm = Math.floor(Math.abs(secLeft) / 60);
                    const rs = Math.abs(secLeft) % 60;
                    return (
                      <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] text-[var(--ink-3)] mono">~{etaStr}</span>
                        {secLeft < 1800 && (
                          <span className={cn(
                            'rounded-full px-1.5 py-0.5 text-[8px] font-bold mono',
                            overdue ? 'bg-[var(--danger-tint)] text-[var(--danger)] animate-pulse' :
                            soon ? 'bg-[var(--warn-tint)] text-[var(--warn)]' :
                            'bg-[var(--surface-2)]/50 text-[var(--ink-3)]',
                          )}>
                            {overdue ? `+${rm}:${String(rs).padStart(2, '0')}` : `${rm}:${String(rs).padStart(2, '0')}`}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
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
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--accent-tint)] text-sm font-bold text-[var(--ink)] transition"
            >
              <MapIcon size={16} />
              {stopsWithCoords.length === 1 ? 'Navigieren' : `Alle ${stopsWithCoords.length} Stops in Maps`}
            </a>
          </div>
        );
      })()}

      {/* Karte entfernt (sah im Drive-Look unsauber aus) - Navigation via externem Maps-Link */}

      {/* Stops — Restdistanz-Streifen */}
      {openStops.length > 0 && (() => {
        const remainDistM = openStops.reduce((s, st) => s + (st.distanz_zum_vorgaenger_m ?? 0), 0);
        const totalDistM = stops.reduce((s, st) => s + (st.distanz_zum_vorgaenger_m ?? 0), 0);
        if (remainDistM === 0) return null;
        return (
          <div className="mx-4 mt-1 flex items-center gap-3 text-[10px] text-[var(--ink-3)]">
            <span className="font-bold text-[var(--ink-2)]">{openStops.length} verbleibend</span>
            <span className="text-[var(--ink-3)]">·</span>
            <span>~{(remainDistM / 1000).toFixed(1)} km</span>
            {totalDistM > 0 && (
              <>
                <span className="text-[var(--ink-3)]">·</span>
                <div className="flex-1 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${Math.max(0, ((totalDistM - remainDistM) / totalDistM) * 100)}%` }}
                  />
                </div>
                <span className="mono">{Math.round(((totalDistM - remainDistM) / totalDistM) * 100)}%</span>
              </>
            )}
          </div>
        );
      })()}

      {/* Alle Stopps — vertikale Timeline (auf-/zuklappbar) */}
      {stops.length > 1 && (
        <div className="mx-4 mt-3">
          <button
            onClick={() => setShowAllStops((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-[var(--surface)] border border-[var(--line)] px-4 py-2.5 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ink-3)]">Alle Stopps</span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-bold mono',
                doneCount === stops.length
                  ? 'bg-[var(--accent-tint)] text-accent'
                  : 'bg-[var(--surface-2)] text-[var(--ink-3)]',
              )}>
                {doneCount}/{stops.length}
              </span>
            </div>
            <span className="text-[var(--ink-3)] text-sm">{showAllStops ? '▲' : '▼'}</span>
          </button>

          {showAllStops && (
            <div className="mt-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] overflow-hidden">
              {[...stops]
                .sort((a, b) => a.reihenfolge - b.reihenfolge)
                .map((s, idx, arr) => {
                  const done = !!s.geliefert_am;
                  const isNext = !done && arr.slice(0, idx).every((p) => !!p.geliefert_am);
                  const isBar = !s.order.bezahlt && (s.order.zahlungsart === 'bar' || s.order.zahlungsart == null);
                  const deliveryTime = s.geliefert_am
                    ? new Date(s.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                    : null;
                  const etaStr = s.order.eta_earliest
                    ? new Date(s.order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                    : null;
                  const etaOverdue = s.order.eta_earliest && !done
                    ? new Date(s.order.eta_earliest).getTime() < Date.now()
                    : false;
                  const distKm = s.distanz_zum_vorgaenger_m != null && s.distanz_zum_vorgaenger_m > 0
                    ? (s.distanz_zum_vorgaenger_m / 1000).toFixed(1)
                    : null;
                  return (
                    <div key={s.id} className={cn(
                      'flex items-start gap-3 px-4 py-3 border-b border-[var(--line)] last:border-0 transition',
                      isNext ? 'bg-[var(--accent-tint)]' : done ? 'opacity-60' : '',
                    )}>
                      {/* Sequence dot */}
                      <div className="flex flex-col items-center shrink-0 mt-0.5">
                        <div className={cn(
                          'h-7 w-7 rounded-full flex items-center justify-center font-black text-[11px] border-2',
                          done
                            ? 'bg-[var(--accent-tint)] border-accent text-accent'
                            : isNext
                            ? 'bg-white border-accent text-accent ring-2 ring-accent/30 ring-offset-1 ring-offset-transparent'
                            : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink-3)]',
                        )}>
                          {done ? '✓' : s.reihenfolge}
                        </div>
                        {idx < arr.length - 1 && (
                          <div className={cn(
                            'w-0.5 flex-1 mt-1 min-h-[16px]',
                            done ? 'bg-accent/30' : 'bg-[var(--surface-2)]',
                          )} />
                        )}
                      </div>

                      {/* Stop details */}
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            'font-display font-bold text-sm',
                            done ? 'text-[var(--ink-3)] line-through' : isNext ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]',
                          )}>
                            {s.order.kunde_name}
                          </span>
                          {isBar && !done && (
                            <span className="rounded-full bg-[var(--warn-tint)] text-[var(--warn)] px-1.5 py-0.5 text-[8px] font-bold">
                              BAR {euro(s.order.gesamtbetrag)}
                            </span>
                          )}
                          {done && (
                            <span className="rounded-full bg-[var(--accent-tint)] text-accent px-1.5 py-0.5 text-[8px] font-bold">
                              {deliveryTime}
                            </span>
                          )}
                          {isNext && (
                            <span className="rounded-full bg-[var(--accent)] text-white px-1.5 py-0.5 text-[8px] font-black">
                              Nächster
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--ink-3)] leading-tight truncate mt-0.5">
                          {s.order.kunde_adresse}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {distKm && (
                            <span className="text-[9px] text-[var(--ink-3)] mono">{distKm} km</span>
                          )}
                          {etaStr && !done && (
                            <span className={cn(
                              'text-[9px] font-bold mono',
                              etaOverdue ? 'text-[var(--danger)] animate-pulse' : 'text-[var(--ink-3)]',
                            )}>
                              {etaOverdue ? '⚠ ' : '~'}{etaStr}
                            </span>
                          )}
                          {s.order.kunde_telefon && (
                            <a
                              href={`tel:${s.order.kunde_telefon}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[9px] font-bold text-[var(--ink-3)] hover:text-[var(--ink-2)] transition"
                            >
                              📞 Anrufen
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Verzögerung / Problem melden */}
      {delayOpen && (() => {
        const nextPending = stops.find((s) => !s.geliefert_am);
        const DELAY_OPTIONS = [
          { label: '~5 Min verspätet', msg: '🕐 Ich bin etwa 5 Minuten später als geplant – bitte kurz Geduld!' },
          { label: '~10+ Min verspätet', msg: '🕐 Ich bin leider etwas verspätet (10+ Min) – danke für dein Verständnis!' },
          { label: 'Straße gesperrt', msg: '🚧 Straße gesperrt – ich fahre eine Umleitung und bin bald bei dir!' },
          { label: 'Adresse schwer zu finden', msg: '📍 Ich suche gerade deine genaue Adresse – kannst du kurz ans Telefon gehen?' },
          { label: 'Verkehr / Stau', msg: '🚗 Starker Verkehr – ich bin auf dem Weg, es dauert etwas länger als geplant.' },
        ];
        async function sendDelay(msg: string) {
          if (!nextPending) return;
          await supabase.from('order_messages').insert({
            order_id: nextPending.order_id,
            sender: 'fahrer',
            nachricht: msg,
          });
          setDelaySent(true);
          setDelayOpen(false);
          setTimeout(() => setDelaySent(false), 30_000);
        }
        return (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm" onClick={() => setDelayOpen(false)}>
            <div className="w-full rounded-t-3xl bg-white border-t border-[var(--line)] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <AlertCircle className="mx-auto mb-2 text-[var(--warn)]" size={28} />
                <div className="font-display font-bold text-lg">Verzögerung melden</div>
                <p className="text-sm text-[var(--ink-3)] mt-1">Kunden werden automatisch benachrichtigt.</p>
              </div>
              <div className="space-y-2">
                {DELAY_OPTIONS.map(({ label, msg }) => (
                  <button
                    key={label}
                    onClick={() => void sendDelay(msg)}
                    className="w-full h-11 rounded-xl bg-[var(--warn-tint)] border border-[var(--warn)]/30 text-[var(--warn)] text-sm font-bold text-left px-4 flex items-center gap-2 active:scale-[0.98] transition"
                  >
                    <AlertCircle size={14} className="text-[var(--warn)] shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setDelayOpen(false)}
                className="w-full h-11 rounded-xl bg-[var(--surface-2)] font-bold text-sm"
              >
                Abbrechen
              </button>
            </div>
          </div>
        );
      })()}

      {/* Modal: Nicht zugestellt melden */}
      {/* F2: Kunde nicht erreichbar — Anrufen -> Warte-Timer -> eskalieren */}
      {unreachableStopId && (() => {
        const stop = stops.find((s) => s.id === unreachableStopId);
        if (!stop) return null;
        const phone = stop.order.kunde_telefon;
        const mm = String(Math.floor(unreachableCountdown / 60)).padStart(2, '0');
        const ss = String(unreachableCountdown % 60).padStart(2, '0');
        return (
          <div className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm" onClick={closeUnreachable}>
            <div className="w-full rounded-t-3xl bg-white border-t border-[var(--line)] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <PhoneCall className="mx-auto mb-2 text-accent" size={28} />
                <div className="font-display font-bold text-lg">Kunde nicht erreichbar?</div>
                <p className="text-sm text-[var(--ink-3)] mt-1">
                  {stop.order.kunde_name} — #{stop.order.bestellnummer.replace(/^[A-Z]+-/, '')}
                </p>
              </div>

              {unreachablePhase === 'call' ? (
                <>
                  <p className="text-sm text-[var(--ink-2)] text-center">
                    Ruf den Kunden zuerst an. Wenn niemand abnimmt, starte den Warte-Timer.
                  </p>
                  <div className="space-y-2">
                    {phone ? (
                      <a
                        href={`tel:${phone}`}
                        className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <Phone size={16} /> Kunden anrufen
                      </a>
                    ) : (
                      <div className="w-full h-12 rounded-xl bg-[var(--surface-2)] text-[var(--ink-3)] font-bold text-sm flex items-center justify-center gap-2">
                        Keine Telefonnummer hinterlegt
                      </div>
                    )}
                    <button
                      onClick={startUnreachableWait}
                      className="w-full h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink-2)] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Clock size={16} /> Niemand erreicht — warten
                    </button>
                  </div>
                  <button
                    onClick={closeUnreachable}
                    className="w-full h-11 rounded-xl bg-transparent text-[var(--ink-3)] font-bold text-sm"
                  >
                    Abbrechen
                  </button>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center py-2">
                    <div className="mono font-display font-black text-4xl text-accent">{mm}:{ss}</div>
                    <p className="text-xs text-[var(--ink-3)] mt-2 text-center">
                      {unreachableCountdown > 0
                        ? 'Warte am Übergabeort. Versuch es nochmal anzurufen.'
                        : 'Wartezeit abgelaufen. Du kannst jetzt melden.'}
                    </p>
                  </div>
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="w-full h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink-2)] font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <Phone size={16} /> Nochmal anrufen
                    </a>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={closeUnreachable}
                      className="flex-1 h-12 rounded-xl bg-[var(--surface-2)] font-bold text-sm"
                    >
                      Doch erreicht
                    </button>
                    <button
                      onClick={() => reportCantFindCustomer(unreachableStopId)}
                      disabled={unreachableCountdown > 0 || unreachablePending}
                      className="flex-1 h-12 rounded-xl bg-[var(--warn)] text-[var(--ink)] font-display font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {unreachablePending
                        ? <Loader2 size={16} className="animate-spin" />
                        : <AlertTriangle size={16} />}
                      Melden
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {failedStopId && (() => {
        const stop = stops.find((s) => s.id === failedStopId);
        return (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm" onClick={() => setFailedStopId(null)}>
            <div className="w-full rounded-t-3xl bg-white border-t border-[var(--line)] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <AlertTriangle className="mx-auto mb-2 text-[var(--warn)]" size={28} />
                <div className="font-display font-bold text-lg">Nicht zugestellt</div>
                <p className="text-sm text-[var(--ink-3)] mt-1">
                  {stop?.order.kunde_name} — #{stop?.order.bestellnummer.replace(/^[A-Z]+-/, '')}
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Grund</div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FAILED_REASON_LABELS) as [FailedReason, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setFailedReason(key)}
                      className={cn(
                        'h-10 rounded-xl text-[11px] font-bold border transition active:scale-[0.97]',
                        failedReason === key
                          ? 'bg-[var(--warn-tint)] border-[var(--warn)]/40 text-[var(--warn)]'
                          : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink-3)]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">Notiz (optional)</div>
                <textarea
                  value={failedNotes}
                  onChange={(e) => setFailedNotes(e.target.value.slice(0, 200))}
                  placeholder="z.B. Klingel defekt, falsche Hausnummer…"
                  rows={2}
                  className="w-full rounded-xl bg-[var(--surface)] border border-[var(--line)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] px-3 py-2 resize-none focus:outline-none focus:border-[var(--warn)]/60"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setFailedStopId(null); setFailedNotes(''); setFailedReason('no_answer'); }}
                  className="flex-1 h-12 rounded-xl bg-[var(--surface-2)] font-bold text-sm"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => markFailedAttempt(failedStopId)}
                  disabled={pendingFailed === failedStopId}
                  className="flex-1 h-12 rounded-xl bg-[var(--warn)] text-[var(--ink)] font-display font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {pendingFailed === failedStopId
                    ? <Loader2 size={16} className="animate-spin" />
                    : <AlertTriangle size={16} />}
                  Melden
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bestätigung: Stopp überspringen */}
      {confirmSkipId && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setConfirmSkipId(null)}>
          <div className="w-full rounded-t-3xl bg-white border-t border-[var(--line)] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-2xl mb-2">🚪</div>
              <div className="font-display font-bold text-lg">Nicht angetroffen?</div>
              <p className="text-sm text-[var(--ink-3)] mt-1">
                Stopp wird ans Ende der Tour verschoben. Du kannst danach nochmal versuchen.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSkipId(null)}
                className="flex-1 h-12 rounded-xl bg-[var(--surface-2)] font-bold text-sm"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  setSkippedIds((s) => new Set([...s, confirmSkipId]));
                  setConfirmSkipId(null);
                }}
                className="flex-1 h-12 rounded-xl bg-[var(--warn)] text-[var(--ink)] font-display font-bold text-sm"
              >
                Zurückstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Liefernachweis — Art der Übergabe wählen */}
      {proofModalStopId && (() => {
        const proofStop = stops.find((s) => s.id === proofModalStopId);
        const isBarProof = !proofStop?.order.bezahlt && (proofStop?.order.zahlungsart === 'bar' || proofStop?.order.zahlungsart == null);
        const PROOF_OPTIONS: { key: ProofType; label: string; icon: string }[] = [
          { key: 'handed_to_person', label: 'Übergeben', icon: '🤝' },
          { key: 'left_at_door',    label: 'Vor Tür',    icon: '🚪' },
          { key: 'neighbour',       label: 'Nachbar',    icon: '👥' },
          { key: 'contactless',     label: 'Kontaktlos', icon: '📦' },
          { key: 'photo',           label: 'Foto',       icon: '📷' },
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm" onClick={() => !proofPending && setProofModalStopId(null)}>
            <div className="w-full rounded-t-3xl bg-white border-t border-[var(--line)] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <CheckCircle2 className="mx-auto mb-2 text-accent" size={28} />
                <div className="font-display font-bold text-lg">Liefernachweis</div>
                <p className="text-sm text-[var(--ink-3)] mt-1">
                  {proofStop?.order.kunde_name} — wie wurde zugestellt?
                </p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PROOF_OPTIONS.map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setProofType(key);
                      if (key !== 'photo') { setProofPhotoBlob(null); setProofPhotoPreview(null); }
                    }}
                    className={cn(
                      'rounded-xl py-3 text-[10px] font-bold border flex flex-col items-center gap-1 transition active:scale-[0.97]',
                      proofType === key
                        ? 'bg-[var(--accent-tint)] border-accent text-accent'
                        : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink-3)]',
                    )}
                  >
                    <span className="text-xl">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>

              {/* Foto-Aufnahme: nur wenn 'photo' gewählt */}
              {proofType === 'photo' && (
                <div>
                  <input
                    ref={proofCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      // Compress via Canvas to max 800px, quality 0.75
                      const img = new Image();
                      const objectUrl = URL.createObjectURL(file);
                      img.onload = () => {
                        const maxDim = 800;
                        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.round(img.width * scale);
                        canvas.height = Math.round(img.height * scale);
                        const ctx = canvas.getContext('2d')!;
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob((blob) => {
                          if (!blob) return;
                          setProofPhotoBlob(blob);
                          setProofPhotoPreview(canvas.toDataURL('image/jpeg', 0.75));
                        }, 'image/jpeg', 0.75);
                        URL.revokeObjectURL(objectUrl);
                      };
                      img.src = objectUrl;
                    }}
                  />
                  {proofPhotoPreview ? (
                    <div className="relative rounded-xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={proofPhotoPreview} alt="Foto-Vorschau" className="w-full h-40 object-cover" />
                      <button
                        type="button"
                        onClick={() => { setProofPhotoBlob(null); setProofPhotoPreview(null); proofCameraRef.current && (proofCameraRef.current.value = ''); }}
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/70 flex items-center justify-center text-[var(--ink)] text-xs font-bold"
                      >
                        ✕
                      </button>
                      <div className="absolute bottom-0 inset-x-0 py-1.5 bg-black/50 text-[10px] font-bold text-accent text-center flex items-center justify-center gap-1">
                        <ImageIcon size={10} /> Foto bereit
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => proofCameraRef.current?.click()}
                      className="w-full h-20 rounded-xl border-2 border-dashed border-[var(--accent)]/40 bg-[var(--accent-tint)] flex flex-col items-center justify-center gap-1.5 text-accent/80 hover:bg-[var(--accent-tint)] active:scale-[0.98] transition"
                    >
                      <Camera size={22} />
                      <span className="text-[11px] font-bold">Foto aufnehmen</span>
                    </button>
                  )}
                </div>
              )}

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">Notiz (optional)</div>
                <textarea
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value.slice(0, 200))}
                  placeholder="z.B. Paket vor Eingangstür abgestellt…"
                  rows={2}
                  className="w-full rounded-xl bg-[var(--surface)] border border-[var(--line)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] px-3 py-2 resize-none focus:outline-none focus:border-accent/60"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setProofModalStopId(null); setProofPhotoBlob(null); setProofPhotoPreview(null); }}
                  disabled={proofPending}
                  className="flex-1 h-12 rounded-xl bg-[var(--surface-2)] font-bold text-sm disabled:opacity-40"
                >
                  Zurück
                </button>
                <button
                  onClick={() => confirmDeliveryWithProof(proofModalStopId!)}
                  disabled={proofPending || (proofType === 'photo' && !proofPhotoBlob)}
                  className="flex-1 h-12 rounded-[17px] bg-[var(--accent)] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_6px_18px_-8px_var(--accent)]"
                >
                  {proofPending
                    ? <Loader2 size={16} className="animate-spin" />
                    : <CheckCircle2 size={16} />}
                  {proofType === 'photo' && !proofPhotoBlob ? 'Foto fehlt noch' : isBarProof ? 'Kassiert & Zugestellt' : 'Bestätigen'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {sorted.map((stop) => {
          const done = !!stop.geliefert_am;
          const isNext = !done && stop.id === nextStop?.id;
          const isBar = !stop.order.bezahlt && (stop.order.zahlungsart === 'bar' || stop.order.zahlungsart == null);
          const amount = stop.order.gesamtbetrag;

          return (
            <div key={stop.id} className={cn(
              'rounded-2xl p-4 border-2 transition',
              done ? 'bg-[var(--surface-2)] border-[var(--line)] opacity-50' :
              isNext ? 'bg-[var(--accent-tint)] border-accent shadow-xl shadow-accent/20' :
              'bg-[var(--surface-2)] border-[var(--line)]',
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  'h-12 w-12 rounded-full grid place-items-center font-bold text-base shrink-0',
                  done ? 'bg-[var(--accent-tint)] text-accent' :
                  isNext ? 'bg-[var(--accent)] text-white' :
                  'bg-[var(--accent-tint)] text-[var(--accent)]',
                )}>
                  {done ? <Check size={20} /> : initials(stop.order.kunde_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold leading-tight">{stop.order.kunde_name}</div>
                  <div className="text-sm text-[var(--ink-2)] leading-tight">
                    {stop.order.kunde_adresse}
                    {stop.order.kunde_plz && `, ${stop.order.kunde_plz}`}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] mono text-[var(--ink-3)]">
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
                          secLeft < 0 ? 'bg-[var(--danger-tint)] text-[var(--danger)]' :
                          secLeft < 300 ? 'bg-[var(--warn-tint)] text-[var(--warn)]' :
                          isReal ? 'bg-[var(--accent-tint)] text-[var(--accent)]' :
                          'bg-[var(--surface-2)]',
                        )}>
                          {isReal ? '' : '~'}{etaStr}
                        </span>
                      );
                    })()}
                  </div>
                  {/* Kundennotiz — auch für ausstehende Folge-Stops sichtbar */}
                  {!done && stop.order.kunde_notiz && (
                    <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-[var(--warn-tint)] border border-[var(--warn)]/20 px-2 py-1">
                      <span className="shrink-0 text-[9px] font-black text-[var(--warn)] uppercase tracking-wider mt-0.5">Notiz:</span>
                      <span className="text-[10px] text-[var(--warn)] leading-snug">{stop.order.kunde_notiz}</span>
                    </div>
                  )}
                  {/* Kundennachrichten-Badge + Expandable */}
                  {!done && (() => {
                    const msgs = customerMsgs.get(stop.order_id) ?? [];
                    if (msgs.length === 0) return null;
                    const isExpanded = expandedMsgOrderId === stop.order_id;
                    const latest = msgs[0];
                    return (
                      <button
                        onClick={() => setExpandedMsgOrderId(isExpanded ? null : stop.order_id)}
                        className="mt-1.5 w-full text-left"
                      >
                        <div className="flex items-start gap-1.5 rounded-md bg-[var(--accent-tint)] border border-[var(--accent)]/40 px-2 py-1.5">
                          <MessageSquare className="shrink-0 h-3 w-3 text-[var(--accent)] mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-black text-[var(--accent)] uppercase tracking-wider">
                              Kunde{msgs.length > 1 ? ` · ${msgs.length} Nachr.` : ''}
                            </div>
                            {isExpanded ? (
                              <div className="mt-1 space-y-1.5">
                                {msgs.map((m) => (
                                  <div key={m.id}>
                                    <div className="text-[10px] text-[var(--accent)] leading-snug">{m.nachricht}</div>
                                    <div className="text-[8px] text-[var(--ink-3)] mono">
                                      {new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-[var(--accent)] leading-snug truncate">{latest.nachricht}</div>
                            )}
                          </div>
                          <span className="shrink-0 text-[9px] text-[var(--ink-3)] font-bold">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Zahlungs-Indikator — Zahlungsart bleibt korrekt, auch nach Zustellung */}
              <div className={cn(
                'mt-3 rounded-xl p-3 flex items-center gap-3',
                isBar && !done ? 'bg-[var(--warn-tint)] border-2 border-[var(--warn)]/40' : 'bg-[var(--surface-2)]/50',
              )}>
                {isBar ? (
                  <>
                    <div className={cn(
                      'h-10 w-10 rounded-lg grid place-items-center',
                      done ? 'bg-[var(--accent-tint)] text-[var(--accent)]' : 'bg-[var(--warn)] text-[var(--ink)]',
                    )}>
                      <Banknote size={20} />
                    </div>
                    <div className="flex-1">
                      <div className={cn(
                        'text-[10px] font-bold uppercase tracking-wider',
                        done ? 'text-[var(--accent)]' : 'text-[var(--warn)]',
                      )}>
                        {done ? 'BAR kassiert ✓' : 'BAR kassieren'}
                      </div>
                      <div className={cn(
                        'mono text-2xl font-black',
                        done ? 'text-[var(--accent)]' : 'text-[var(--warn)]',
                      )}>{euro(amount)}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-lg bg-[var(--surface-2)] text-accent grid place-items-center">
                      <CreditCard size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">{stop.order.bezahlt ? 'Online bezahlt ✓' : 'Zahlstatus offen · nicht bar kassieren'}</div>
                      <div className="mono font-bold text-[var(--ink)]">{euro(amount)}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Distance + ETA countdown for next stop */}
              {isNext && nextStop && stop.id === nextStop.id && stop.distanz_zum_vorgaenger_m != null && stop.distanz_zum_vorgaenger_m > 0 && (
                <StopEtaBar distanzM={stop.distanz_zum_vorgaenger_m} gpsSpeed={gpsSpeed} />
              )}
              {/* Live-GPS-Näherungs-Ring: Echtzeit-Distanz wenn GPS vorhanden */}
              {isNext && nextStop && stop.id === nextStop.id &&
                driverLat != null && driverLng != null &&
                stop.order.kunde_lat != null && stop.order.kunde_lng != null && (
                <LiveProximityRing
                  driverLat={driverLat}
                  driverLng={driverLng}
                  destLat={stop.order.kunde_lat}
                  destLng={stop.order.kunde_lng}
                />
              )}

              {/* Arrived-Badge wenn bereits angekommen, aber noch nicht zugestellt */}
              {isNext && (stop.angekommen_am || arrivedIds.has(stop.id)) && !stop.geliefert_am && (
                <div className="mt-2 flex items-center gap-1.5 rounded-full bg-[var(--accent-tint)] border border-[var(--accent)]/40 px-3 py-1 text-[11px] font-bold text-accent">
                  <Flag size={11} /> Angekommen — bitte zustellen
                </div>
              )}
              {/* Zurückgestellt-Badge für übersprungene Stops */}
              {!done && skippedIds.has(stop.id) && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--warn-tint)] border border-[var(--warn)]/30 px-3 py-1.5">
                  <span className="text-[11px] font-bold text-[var(--warn)]">Zurückgestellt — nach anderen Stops nochmal</span>
                  <button
                    onClick={() => setSkippedIds((s) => { const n = new Set(s); n.delete(stop.id); return n; })}
                    className="text-[10px] font-bold text-[var(--warn)] underline"
                  >
                    Jetzt
                  </button>
                </div>
              )}

              {/* Actions nur für next stop — Drive 07-route: Anrufen + Navi, dann Primary, dann muted Utility */}
              {isNext && (() => {
                const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
                const lat = stop.order.kunde_lat;
                const lng = stop.order.kunde_lng;
                const navHref = lat && lng
                  ? (isIos
                      ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
                      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`)
                  : null;
                const wazeHref = lat && lng ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : null;
                const arrived = stop.angekommen_am || arrivedIds.has(stop.id);
                return (
                <div className="mt-3 space-y-2">
                  {/* Primär-Aktionen: Anrufen + Navigieren (Drive 07-route) */}
                  <div className="flex gap-2">
                    {stop.order.kunde_telefon ? (
                      <a
                        href={`tel:${stop.order.kunde_telefon}`}
                        className="flex-1 h-12 rounded-[13px] bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center gap-2 text-sm font-bold text-[var(--ink)] active:scale-[0.98] transition"
                      >
                        <Phone size={16} /> Anrufen
                      </a>
                    ) : null}
                    {navHref && (
                      <a
                        href={navHref}
                        target="_blank" rel="noreferrer"
                        className="flex-1 h-12 rounded-[13px] bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center gap-2 text-sm font-bold text-[var(--ink)] active:scale-[0.98] transition"
                      >
                        <Navigation size={16} /> Navigieren
                      </a>
                    )}
                  </div>
                  {/* Primary: Bestellung geliefert */}
                  <button
                    onClick={() => { setProofModalStopId(stop.id); setProofType('handed_to_person'); setProofNotes(''); setProofPhotoBlob(null); setProofPhotoPreview(null); }}
                    disabled={pending === stop.id || proofPending}
                    className="w-full h-14 rounded-[17px] bg-[var(--accent)] text-white flex items-center justify-center gap-2 text-[18px] font-bold active:scale-[0.98] disabled:opacity-50 shadow-[0_6px_18px_-8px_var(--accent)]"
                  >
                    {pending === stop.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    {isBar ? 'Kassiert & geliefert' : 'Bestellung geliefert'}
                  </button>
                  {/* Sekundäre Utility-Aktionen (muted, kompakt) */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {!arrived && (
                      <button
                        onClick={() => markArrived(stop.id)}
                        className="h-9 px-3 rounded-lg bg-[var(--accent-tint)] border border-[var(--accent)]/30 text-accent flex items-center gap-1.5 text-[11px] font-bold"
                      >
                        <Flag size={12} /> Angekommen
                      </button>
                    )}
                    {/* WhatsApp "Ich bin da" */}
                    {stop.order.kunde_telefon && (() => {
                      const raw = stop.order.kunde_telefon!.replace(/\s+/g, '').replace(/[^\d+]/g, '');
                      const intl = raw.startsWith('+') ? raw.slice(1) : raw.startsWith('00') ? raw.slice(2) : raw.startsWith('0') ? '49' + raw.slice(1) : '49' + raw;
                      const msg = encodeURIComponent(`Hallo! Ich bin Ihr Lieferfahrer und stehe vor Ihrer Tür. Bestellung #${stop.order.bestellnummer.replace(/^[A-Z]+-/, '')} 🚗`);
                      return (
                        <a
                          href={`https://wa.me/${intl}?text=${msg}`}
                          target="_blank" rel="noreferrer"
                          className="h-9 px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink-2)] flex items-center gap-1.5 text-[11px] font-bold"
                          title="WhatsApp: Ich bin da!"
                        >
                          <MessageSquare size={12} /> WhatsApp
                        </a>
                      );
                    })()}
                    {wazeHref && (
                      <a
                        href={wazeHref}
                        target="_blank" rel="noreferrer"
                        className="h-9 px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink-2)] flex items-center gap-1.5 text-[11px] font-bold"
                        title="In Waze öffnen"
                      >
                        Waze
                      </a>
                    )}
                    {/* Tracking-Link teilen */}
                    <button
                      onClick={async () => {
                        const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/track/${stop.order.bestellnummer}`;
                        const text = `Deine Bestellung ist unterwegs! Verfolge sie hier: ${url}`;
                        if (typeof navigator !== 'undefined' && navigator.share) {
                          try { await navigator.share({ title: 'Lieferung verfolgen', text, url }); } catch {}
                        } else {
                          try { await navigator.clipboard.writeText(url); } catch {}
                          setCopiedStopId(stop.id);
                          setTimeout(() => setCopiedStopId(null), 2000);
                        }
                      }}
                      title="Tracking-Link teilen"
                      className={cn(
                        'h-9 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition',
                        copiedStopId === stop.id
                          ? 'bg-accent/20 text-accent'
                          : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink-2)]',
                      )}
                    >
                      {copiedStopId === stop.id ? <Check size={12} /> : <Share2 size={12} />} Teilen
                    </button>
                    {openStops.length > 1 && (
                      <button
                        onClick={() => setConfirmSkipId(stop.id)}
                        className="h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[var(--ink-3)] text-[11px] font-bold"
                      >
                        Zurückstellen
                      </button>
                    )}
                  </div>
                  {/* Drive 07-route: "Kunde nicht gefunden?" muted Link */}
                  {arrived && (
                    <div className="flex items-center justify-center gap-4 pt-1">
                      <button
                        onClick={() => { setUnreachableStopId(stop.id); setUnreachablePhase('call'); setUnreachableCountdown(0); }}
                        className="text-[12px] font-bold text-[var(--ink-3)] underline-offset-2 hover:underline flex items-center gap-1"
                      >
                        <PhoneCall size={12} /> Kunde nicht erreichbar?
                      </button>
                      <button
                        onClick={() => { setFailedStopId(stop.id); setFailedReason('no_answer'); setFailedNotes(''); }}
                        className="text-[12px] font-bold text-[var(--warn)] underline-offset-2 hover:underline flex items-center gap-1"
                      >
                        <AlertTriangle size={12} /> Nicht zustellbar
                      </button>
                    </div>
                  )}
                </div>
                );
              })()}
            </div>
          );
        })}

        {allDone && (() => {
          const cashStops = stops.filter((s) => !s.order.bezahlt && (s.order.zahlungsart === 'bar' || s.order.zahlungsart == null));
          const totalCash = cashStops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          const onlineTotal = stops.filter((s) => s.order.bezahlt && s.order.zahlungsart !== 'bar')
            .reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          const elapsedMin = Math.floor(elapsed / 60);
          const totalDistKm = stops.reduce((sum, s) => sum + ((s.distanz_zum_vorgaenger_m ?? 0) / 1000), 0);
          return (
            <div className="rounded-2xl bg-[var(--surface)] p-5 text-center space-y-4" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              <div className="flex flex-col items-center">
                {/* Drive Pop-Check-Kreis (10-summary.png) */}
                <div
                  style={{
                    width: 96, height: 96, borderRadius: '50%', background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14, boxShadow: '0 16px 40px -12px var(--accent)',
                    animation: 'drv-pop .5s cubic-bezier(.2,.9,.3,1.2)',
                  }}
                >
                  <Check size={50} strokeWidth={3} className="text-white" />
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--ink)' }}>Tour abgeschlossen</div>
                <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 500, marginTop: 6 }}>Stark gefahren! Alles dokumentiert.</div>
              </div>
              {/* Explicit tour close button — prevents accidental early close, updates batch status */}
              <TourCloseButton batchId={batchId} onDone={onAllDone} />

              {/* Navigation zurück zum Restaurant */}
              {restaurantLoc && (() => {
                const { lat, lng, name } = restaurantLoc;
                const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
                const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
                const appleUrl  = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
                const wazeUrl   = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
                return (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-3)] mb-2 flex items-center gap-1.5">
                      <Navigation size={10} />
                      Zurück: {name}
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={isIos ? appleUrl : googleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[var(--surface-2)] text-[var(--ink-2)] font-bold text-xs active:scale-[0.98] transition"
                      >
                        <Navigation size={12} />
                        {isIos ? 'Apple Maps' : 'Google Maps'}
                      </a>
                      <a
                        href={wazeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 h-9 px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink-2)] font-bold text-xs active:scale-[0.98] transition"
                      >
                        Waze
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* Tour-Zusammenfassung */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="font-display text-xl font-black text-accent">{stops.length}</div>
                  <div className="text-[10px] text-[var(--ink-3)] mt-0.5">Stopps</div>
                </div>
                <div className="rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="font-display text-xl font-black text-accent">{elapsedMin}m</div>
                  <div className="text-[10px] text-[var(--ink-3)] mt-0.5">Unterwegs</div>
                </div>
                <div className="rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="font-display text-xl font-black text-accent">
                    {totalDistKm > 0 ? `${totalDistKm.toFixed(1)}km` : `${stops.length}×`}
                  </div>
                  <div className="text-[10px] text-[var(--ink-3)] mt-0.5">
                    {totalDistKm > 0 ? 'Distanz' : 'Lieferungen'}
                  </div>
                </div>
              </div>

              {/* Tour-Qualitätsscore */}
              {(() => {
                const withEta = stops.filter((s) => s.geliefert_am && s.order.eta_latest);
                const onTime = withEta.filter((s) => new Date(s.geliefert_am!).getTime() <= new Date(s.order.eta_latest!).getTime()).length;
                const etaPct = withEta.length > 0 ? Math.round((onTime / withEta.length) * 100) : null;
                const speedScore = totalDistKm > 0 && elapsedMin > 0 ? Math.min(100, Math.round((totalDistKm / elapsedMin) * 200)) : null;
                const score = etaPct != null ? Math.round(etaPct * 0.7 + (speedScore ?? 70) * 0.3) : (speedScore ?? null);
                if (score == null) return null;
                const grade = score >= 90 ? { label: 'Exzellent', color: 'text-accent', ring: 'border-accent' } :
                              score >= 75 ? { label: 'Gut', color: 'text-[var(--ink-3)]', ring: 'border-[var(--line)]' } :
                              score >= 55 ? { label: 'Ok', color: 'text-[var(--warn)]', ring: 'border-[var(--warn)]/40' } :
                              { label: 'Verbesserbar', color: 'text-[var(--danger)]', ring: 'border-[var(--danger)]/40' };
                return (
                  <div className={`rounded-xl border-2 ${grade.ring} bg-[var(--surface-2)] p-4`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-2">Tour-Qualität</div>
                    <div className="flex items-center justify-center gap-4">
                      <div className="relative flex items-center justify-center w-16 h-16">
                        <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                          <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor"
                            className={grade.color}
                            strokeWidth="6" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 26}`}
                            strokeDashoffset={`${2 * Math.PI * 26 * (1 - score / 100)}`} />
                        </svg>
                        <div className={`absolute font-black text-base mono ${grade.color}`}>{score}</div>
                      </div>
                      <div className="text-left">
                        <div className={`font-display text-lg font-black ${grade.color}`}>{grade.label}</div>
                        {etaPct != null && <div className="text-xs text-[var(--ink-3)] mt-0.5">{etaPct}% rechtzeitig geliefert</div>}
                        {speedScore != null && <div className="text-xs text-[var(--ink-3)]">{(totalDistKm / elapsedMin * 60).toFixed(1)} km/h Ø</div>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Geschätzter Fahrer-Verdienst */}
              {(() => {
                const BASE_PER_STOP = 3.00;
                const KM_RATE = 0.25;
                const baseEarning = stops.length * BASE_PER_STOP;
                const kmEarning = totalDistKm > 0 ? totalDistKm * KM_RATE : 0;
                const totalEstimate = baseEarning + kmEarning;
                return (
                  <div className="rounded-xl bg-matcha-900/60 border border-matcha-500/30 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300 mb-3 flex items-center gap-1.5">
                      <TrendingUp size={10} className="text-accent" />
                      Geschätzter Verdienst
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-matcha-200">{stops.length}× Stopps × {euro(BASE_PER_STOP)}</span>
                        <span className="font-bold tabular-nums text-white">{euro(baseEarning)}</span>
                      </div>
                      {totalDistKm > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-matcha-200">{totalDistKm.toFixed(1)} km × {euro(KM_RATE)}</span>
                          <span className="font-bold tabular-nums text-white">{euro(kmEarning)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-matcha-600/50 flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Schätzung gesamt</span>
                      <span className="font-display text-xl font-black text-accent">{euro(totalEstimate)}</span>
                    </div>
                    <p className="text-[9px] text-matcha-400 mt-2">Offizielle Abrechnung erfolgt durch die Zentrale</p>
                  </div>
                );
              })()}

              {/* Cash collection summary */}
              {totalCash > 0 && (
                <div className="rounded-xl bg-[var(--warn-tint)] border border-[var(--warn)]/30 p-4 text-left">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--warn)] mb-2">
                    Kassiertes Bargeld — bitte abgeben
                  </div>
                  <div className="font-display text-3xl font-black text-[var(--warn)]">
                    {euro(totalCash)}
                  </div>
                  <div className="mt-2 space-y-1">
                    {cashStops.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs text-[var(--warn)]">
                        <span>#{s.order.bestellnummer.replace(/^[A-Z]+-/, '')} · {s.order.kunde_name}</span>
                        <span className="font-bold mono">{euro(s.order.gesamtbetrag)}</span>
                      </div>
                    ))}
                  </div>
                  {onlineTotal > 0 && (
                    <div className="mt-3 text-[10px] text-[var(--ink-3)]">
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
      className="w-full h-14 rounded-[17px] bg-[var(--accent)] text-white font-black text-lg flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-60 shadow-[0_6px_18px_-8px_var(--accent)]"
    >
      {closing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
      {closing ? 'Wird abgeschlossen…' : 'Tour abschließen'}
    </button>
  );
}

/* Live-GPS-Näherungs-Ring: Echtzeit-Distanz zum nächsten Stop, basierend auf Fahrer-GPS */
function LiveProximityRing({
  driverLat, driverLng,
  destLat, destLng,
}: { driverLat: number; driverLng: number; destLat: number; destLng: number }) {
  const [distM, setDistM] = useState<number | null>(null);

  useEffect(() => {
    function calcDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371000;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    setDistM(calcDist(driverLat, driverLng, destLat, destLng));
  }, [driverLat, driverLng, destLat, destLng]);

  if (distM === null) return null;

  // Ring füllt sich von 0% (weit weg) → 100% (unter 15m = angekommen)
  const MAX_DIST_M = 400;
  const pct = Math.max(0, Math.min(100, Math.round(((MAX_DIST_M - distM) / MAX_DIST_M) * 100)));
  const arrived = distM < 30;
  const near    = distM < 80;
  const soon    = distM < 200;

  const ringColor = arrived ? '#4ae68a' : near ? '#f97316' : soon ? '#d4a843' : '#3b82f6';
  const R = 20, circ = 2 * Math.PI * R;

  const label = arrived
    ? 'Angekommen!'
    : distM < 1000
    ? `${Math.round(distM)} m`
    : `${(distM / 1000).toFixed(1)} km`;

  return (
    <div className={cn(
      'mt-2 flex items-center gap-3 rounded-xl px-3 py-2 border',
      arrived ? 'bg-[var(--accent-tint)] border-accent/50' :
      near    ? 'bg-[var(--warn-tint)] border-[var(--warn)]/30' :
      soon    ? 'bg-[var(--warn-tint)] border-[var(--warn)]/30' :
                'bg-[var(--surface-2)] border-[var(--line)]',
    )}>
      {/* SVG Proximity Ring */}
      <div className="relative h-12 w-12 shrink-0 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx="24" cy="24" r={R}
            fill="none"
            stroke={ringColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s' }}
          />
        </svg>
        <span className="relative text-[8px] font-black text-center leading-none" style={{ color: ringColor }}>
          {arrived ? '✓' : `${pct}%`}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">Entfernung</div>
        <div className={cn(
          'font-display font-black text-base mono leading-tight',
          arrived ? 'text-accent' : near ? 'text-[var(--warn)]' : 'text-[var(--ink)]',
        )}>
          {label}
        </div>
        {near && !arrived && (
          <div className="text-[9px] text-[var(--warn)] font-bold animate-pulse">Fast da!</div>
        )}
        {arrived && (
          <div className="text-[9px] text-accent font-bold">Bitte klingeln</div>
        )}
      </div>
    </div>
  );
}

function SpeedArcGauge({ speed }: { speed: number }) {
  const MAX_SPEED = 60;
  const pct = Math.min(1, speed / MAX_SPEED);
  const r = 14;
  const arc = Math.PI * r;
  const color = speed > 50 ? '#f97316' : speed > 30 ? '#d4a843' : '#4ae68a';
  return (
    <div className="flex flex-col items-center shrink-0" title={`${speed} km/h`}>
      <svg width="36" height="22" viewBox="0 0 36 22" className="overflow-visible">
        <path d={`M 4 18 A ${r} ${r} 0 0 1 32 18`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3.5" strokeLinecap="round" />
        <path
          d={`M 4 18 A ${r} ${r} 0 0 1 32 18`}
          fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={arc * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s' }}
        />
        <text x="18" y="17" textAnchor="middle" fontSize="8" fontWeight="800" fill={color} fontFamily="monospace">
          {speed}
        </text>
      </svg>
      <span className="text-[7px] text-[var(--ink-3)] font-bold leading-none">km/h</span>
    </div>
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
    <div className="mt-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--ink-3)] flex items-center gap-1.5">
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
              <span className="text-[8px] text-[var(--ink-3)] -mt-1 font-bold">km/h</span>
            </div>
          )}

          <span className={cn(
            'font-bold mono',
            remaining === 0 ? 'text-accent' : remaining < 120 ? 'text-[var(--warn)]' : 'text-[var(--ink)]',
          )}>
            {remaining === 0 ? 'Fast da!' : `~${m > 0 ? `${m}:${String(s).padStart(2, '0')} Min` : `${s}s`}`}
          </span>
        </div>
      </div>

      {/* Route progress bar */}
      <div className="h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            progressPct >= 100 ? 'bg-accent' : progressPct > 70 ? 'bg-[var(--warn)]' : 'bg-[var(--accent)]',
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
