'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navigation, MapPin, Banknote, CreditCard, Check, CheckCircle2, Loader2, Phone, ArrowRight, Map as MapIcon, Flag, TrendingUp, Share2, AlertTriangle, MessageSquare, AlertCircle, Camera, ImageIcon } from 'lucide-react';
import { euro, cn } from '@/lib/utils';
import { NaviWidget } from './navi-widget';
import { TourCompletionScreen } from './tour-completion';

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
  const [showCompletion, setShowCompletion] = useState(false);
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
  const [routeChangedNotice, setRouteChangedNotice] = useState<{ type: string; ts: number } | null>(null);
  const [earningsBubble, setEarningsBubble] = useState<{ amount: number; key: number } | null>(null);
  // Näherungs-Banner: Abstand zum nächsten Stopp in Metern (null = unbekannt)
  const [driverDistToNextM, setDriverDistToNextM] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - mountedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const on = () => setIsOnline(true);
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

  // GPS-Proximity: Abstand zum nächsten Stopp berechnen + Auto-Arrived bei < 80m
  useEffect(() => {
    if (driverLat == null || driverLng == null || !nextStop) {
      setDriverDistToNextM(null);
      return;
    }
    const destLat = nextStop.order.kunde_lat;
    const destLng = nextStop.order.kunde_lng;
    if (!destLat || !destLng) { setDriverDistToNextM(null); return; }

    const R = 6371000;
    const dLat = ((destLat - driverLat) * Math.PI) / 180;
    const dLon = ((destLng - driverLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((driverLat * Math.PI) / 180) * Math.cos((destLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    setDriverDistToNextM(Math.round(distM));

    if (distM < 80) {
      if (proximityTriggered.has(nextStop.id)) return;
      if (arrivedIds.has(nextStop.id) || nextStop.angekommen_am) return;
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
    await Promise.all([
      supabase.from('delivery_batch_stops').update({ angekommen_am: now }).eq('id', stopId),
      supabase.from('mise_delivery_batch_stops').update({ arrived_at: now }).eq('id', stopId),
    ]);
    setArrivedIds((s) => new Set([...s, stopId]));
    setStops((xs) => xs.map((x) => x.id === stopId ? { ...x, angekommen_am: now } : x));
  }

  async function markDelivered(stopId: string) {
    vibrate([100, 50, 100, 50, 200]);
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
    // Kurze Verdienst-Bubble anzeigen
    const kmBonus = stop?.distanz_zum_vorgaenger_m != null ? (stop.distanz_zum_vorgaenger_m / 1000) * 0.20 : 0;
    setEarningsBubble({ amount: 1.50 + kmBonus, key: Date.now() });
    setTimeout(() => setEarningsBubble(null), 3000);
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

  /* Tour-Abschluss-Feier: wird nach TourCloseButton angezeigt */
  if (showCompletion) {
    const totalBetrag = stops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
    const totalDistKm = stops.reduce((sum, s) => sum + ((s.distanz_zum_vorgaenger_m ?? 0) / 1000), 0);
    const tourEarnings = stops.reduce((sum, s) => {
      const km = (s.distanz_zum_vorgaenger_m ?? 0) / 1000;
      return sum + 1.50 + km * 0.20;
    }, 0);
    return (
      <TourCompletionScreen
        stats={{
          stopsCompleted: stops.length,
          totalBetrag,
          elapsedMin: Math.floor(elapsed / 60),
          distanceKm: totalDistKm > 0 ? totalDistKm : null,
          estEarnings: tourEarnings,
        }}
        onContinue={onAllDone}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-matcha-900">
      {/* Offline-Warnung */}
      {!isOnline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-bold text-white">
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
      {/* Näherungs-Banner: erscheint wenn Fahrer < 300m vom nächsten Stopp */}
      {driverDistToNextM !== null && driverDistToNextM > 80 && driverDistToNextM <= 300 && nextStop && !arrivedIds.has(nextStop.id) && !nextStop.angekommen_am && (
        <div className="sticky top-0 z-40 flex items-center gap-3 bg-amber-500 px-4 py-2.5 text-matcha-900 animate-in slide-in-from-top-2 duration-200">
          <span className="text-xl shrink-0 animate-bounce">📍</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-black uppercase tracking-wide">Fast da!</div>
            <div className="text-[10px] font-semibold opacity-80 truncate">
              Noch ca. {driverDistToNextM} m · {nextStop.order.kunde_adresse ?? nextStop.order.kunde_name}
            </div>
          </div>
          <span className="shrink-0 font-mono text-sm font-black tabular-nums">{driverDistToNextM} m</span>
        </div>
      )}
      {/* Verdienst-Bubble: kurze Einblendung nach jeder Zustellung */}
      {earningsBubble && (
        <LiveEarningsBubble key={earningsBubble.key} amount={earningsBubble.amount} />
      )}

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
          <div className="flex-1 flex flex-col items-end gap-1.5 ml-3">
            <TourOnTimeRing
              doneCount={doneCount}
              totalStops={stops.length}
              elapsedSec={elapsed}
              totalEtaMin={totalEtaMin ?? null}
            />
            {estimatedEarnings > 0 && (
              <div className="inline-flex items-center gap-1 rounded-full bg-accent/15 border border-accent/30 px-2 py-1">
                <TrendingUp size={10} className="text-accent" />
                <span className="text-[10px] font-bold tabular-nums text-accent">
                  ~{estimatedEarnings.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <MyPerformanceBadge />
            {/* Verzögerung melden — sendet Nachricht an Kunden-Tracking */}
            <button
              onClick={() => setDelayOpen(true)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition',
                delaySent
                  ? 'bg-matcha-700 text-matcha-200'
                  : 'bg-amber-500/15 border border-amber-400/30 text-amber-300 active:scale-95',
              )}
              title="Verzögerung oder Problem melden"
            >
              <AlertCircle size={9} />
              {delaySent ? 'Gemeldet ✓' : 'Verspätung?'}
            </button>
          </div>
        </div>
        {/* Tour-Kassen-Zusammenfassung — zeigt verbleibende Bar-Beträge */}
        {(() => {
          const cashStops = stops.filter((s) => !s.order.bezahlt || s.order.zahlungsart === 'bar');
          if (cashStops.length === 0) return null;
          const remaining = cashStops.filter((s) => !s.geliefert_am);
          const collected = cashStops.filter((s) => !!s.geliefert_am);
          const remainingCash = remaining.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          const collectedCash = collected.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
          return (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {remainingCash > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 px-3 py-1.5">
                  <Banknote size={12} className="text-amber-300" />
                  <span className="text-[11px] font-bold text-amber-200">
                    Noch kassieren: {euro(remainingCash)}
                  </span>
                  <span className="text-[9px] text-amber-400">
                    ({remaining.length} Stopp{remaining.length !== 1 ? 's' : ''})
                  </span>
                </div>
              )}
              {collectedCash > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-matcha-700/40 border border-matcha-600/40 px-2.5 py-1.5">
                  <Check size={10} className="text-accent" />
                  <span className="text-[10px] font-bold text-matcha-200">{euro(collectedCash)} kassiert</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Tour-Rest-Übersicht: verbleibende Stopps, Distanz und Kassenbeträge */}
      {sorted.length > 1 && !allDone && (
        <TourRemainingStrip stops={sorted} doneCount={doneCount} />
      )}

      {/* Tour-Fortschritts-Dots: alle Stopps als nummerierte Punkte */}
      {sorted.length > 1 && <TourProgressDots stops={sorted} doneCount={doneCount} />}

      {/* Kommende-Stopps-Timeline: horizontale Übersicht aller verbleibenden Stopps mit ETA */}
      {openStops.length > 1 && (
        <UpcomingStopsTimeline
          stops={sorted}
          doneCount={doneCount}
          batchStartedAt={batchStartedAt}
          totalEtaMin={totalEtaMin}
        />
      )}

      {/* NaviWidget — Turn-by-Turn Navigation zum nächsten Stopp */}
      {nextStop && !allDone && nextStop.order.kunde_lat && nextStop.order.kunde_lng && (
        <NaviWidget
          batchId={batchId}
          stopIndex={doneCount}
          toLat={nextStop.order.kunde_lat}
          toLng={nextStop.order.kunde_lng}
          vehicle="car"
          driverLat={driverLat ?? null}
          driverLng={driverLng ?? null}
        />
      )}

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
          {/* ETA-Countdown für diesen Stopp */}
          {nextStop.order.eta_earliest && (() => {
            const etaMs = new Date(nextStop.order.eta_earliest).getTime();
            const secsLeft = Math.floor((etaMs - Date.now()) / 1000);
            const isOverdue = secsLeft < 0;
            const minsLeft = Math.abs(Math.floor(secsLeft / 60));
            const secsPart = Math.abs(secsLeft % 60);
            const etaTime = new Date(nextStop.order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const etaLatestTime = nextStop.order.eta_latest
              ? new Date(nextStop.order.eta_latest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
              : null;
            return (
              <div className={cn(
                'mb-2 flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-bold',
                isOverdue
                  ? 'bg-red-500/25 border border-red-400/50 text-red-300 animate-pulse'
                  : secsLeft < 120
                  ? 'bg-orange-500/20 border border-orange-400/40 text-orange-300'
                  : secsLeft < 300
                  ? 'bg-amber-500/15 border border-amber-400/30 text-amber-300'
                  : 'bg-white/8 border border-white/15 text-matcha-300',
              )}>
                <span className="text-base shrink-0">{isOverdue ? '⚠️' : secsLeft < 120 ? '🔔' : '🕐'}</span>
                <span className="flex-1">
                  {isOverdue
                    ? `${minsLeft}:${String(secsPart).padStart(2, '0')} überfällig`
                    : `${minsLeft}:${String(secsPart).padStart(2, '0')} bis ETA`}
                </span>
                <span className="font-mono tabular-nums shrink-0 opacity-80">
                  {etaLatestTime ? `${etaTime}–${etaLatestTime}` : etaTime}
                </span>
              </div>
            );
          })()}
          <div className="font-display text-xl font-black leading-tight">{nextStop.order.kunde_name}</div>
          <div className="mt-0.5 text-sm text-matcha-200 leading-tight">
            {nextStop.order.kunde_adresse}
            {nextStop.order.kunde_plz && `, ${nextStop.order.kunde_plz}`}
          </div>
          {/* GPS-Speed ETA: Schätzt Ankunftszeit basierend auf aktueller Geschwindigkeit */}
          {gpsSpeed != null && gpsSpeed > 2 && driverDistToNextM != null && driverDistToNextM > 0 && (() => {
            const speedMs = gpsSpeed / 3.6;
            const etaSec = Math.round(driverDistToNextM / speedMs);
            const etaMin = Math.ceil(etaSec / 60);
            const distStr = driverDistToNextM >= 1000
              ? `${(driverDistToNextM / 1000).toFixed(1)} km`
              : `${driverDistToNextM} m`;
            return (
              <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-blue-500/15 border border-blue-400/30 px-3 py-1.5">
                <span className="text-base shrink-0">🚀</span>
                <div className="flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-300">GPS-ETA</span>
                  <span className="ml-2 text-[11px] font-bold text-blue-200 tabular-nums">
                    {etaMin === 1 ? '~1 Min' : `~${etaMin} Min`}
                  </span>
                </div>
                <span className="text-[9px] text-blue-400 tabular-nums shrink-0">
                  {distStr} · {gpsSpeed} km/h
                </span>
              </div>
            );
          })()}
          {nextStop.order.kunde_notiz && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-500/15 border border-amber-400/30 px-2 py-1.5">
              <span className="text-amber-300 text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5">Notiz:</span>
              <span className="text-amber-200 text-[11px] leading-snug">{nextStop.order.kunde_notiz}</span>
            </div>
          )}
          {nextStop.order.kunde_lieferhinweis && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-blue-500/15 border border-blue-400/30 px-2 py-1.5">
              <span className="text-blue-300 text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5">Lieferhinweis:</span>
              <span className="text-blue-200 text-[11px] leading-snug">{nextStop.order.kunde_lieferhinweis}</span>
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
                  className="flex items-center gap-2 w-full text-left rounded-xl bg-matcha-800/60 border border-matcha-600/40 px-3 py-2 transition active:scale-[0.99]"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-matcha-300">
                    {items.reduce((s, i) => s + i.menge, 0)} Artikel prüfen
                  </span>
                  <span className="ml-auto text-matcha-400 text-[10px]">{isShown ? '▲' : '▼'}</span>
                </button>
                {isShown && (
                  <div className="mt-1 rounded-xl bg-matcha-800/40 border border-matcha-600/30 divide-y divide-matcha-700/30 overflow-hidden">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2">
                        <span className="h-6 w-6 rounded-full bg-matcha-700 text-matcha-100 flex items-center justify-center font-black text-[11px] shrink-0">
                          {item.menge}
                        </span>
                        <span className="flex-1 text-[12px] font-semibold text-matcha-100 leading-tight">{item.name}</span>
                        {item.notiz && (
                          <span className="text-[9px] text-amber-300 italic max-w-[80px] truncate">{item.notiz}</span>
                        )}
                        <span className="text-[10px] text-matcha-400 tabular-nums">
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
            {/* Live GPS-Abstand: Echtzeit-Berechnung von Fahrerposition zum nächsten Stopp */}
            {driverLat != null && driverLng != null && nextStop.order.kunde_lat != null && nextStop.order.kunde_lng != null && (() => {
              const R = 6371000;
              const dLat = ((nextStop.order.kunde_lat - driverLat) * Math.PI) / 180;
              const dLon = ((nextStop.order.kunde_lng - driverLng) * Math.PI) / 180;
              const a = Math.sin(dLat / 2) ** 2
                + Math.cos((driverLat * Math.PI) / 180) * Math.cos((nextStop.order.kunde_lat * Math.PI) / 180)
                * Math.sin(dLon / 2) ** 2;
              const distM = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
              const isClose = distM < 150;
              const isNear  = distM < 600;
              return (
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold tabular-nums transition',
                  isClose ? 'bg-accent text-matcha-900 animate-pulse' :
                  isNear  ? 'bg-amber-500/30 text-amber-200' :
                            'bg-white/10 text-matcha-400',
                )}>
                  <MapPin size={9} />
                  {distM < 1000 ? `${distM} m` : `${(distM / 1000).toFixed(1)} km`}
                  {isClose && ' · Fast da!'}
                </span>
              );
            })()}
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

          {/* Navigation via NaviWidget (über dem Stop-Hero) */}
          {/* Kunde direkt kontaktieren */}
          {nextStop.order.kunde_telefon && (() => {
            const raw = nextStop.order.kunde_telefon!.replace(/\s+/g, '').replace(/[^\d+]/g, '');
            const intl = raw.startsWith('+') ? raw.slice(1) : raw.startsWith('00') ? raw.slice(2) : raw.startsWith('0') ? '49' + raw.slice(1) : '49' + raw;
            const msg = encodeURIComponent(`Hallo! Ich bin Ihr Lieferfahrer und bin gleich da. Bestellung #${nextStop.order.bestellnummer.replace(/^[A-Z]+-/, '')} 🚗`);
            return (
              <div className="mt-2 flex gap-2">
                <a
                  href={`tel:${nextStop.order.kunde_telefon}`}
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-matcha-700/60 border border-matcha-600/40 text-matcha-100 font-bold text-sm active:scale-[0.98] transition"
                >
                  <Phone size={14} />
                  Anrufen
                </a>
                <a
                  href={`https://wa.me/${intl}?text=${msg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[#25D366]/15 border border-[#25D366]/40 text-[#25D366] font-bold text-sm active:scale-[0.98] transition"
                >
                  <MessageSquare size={14} />
                  WhatsApp
                </a>
              </div>
            );
          })()}
        </div>
      )}

      {/* Upcoming Stops Preview — kompakter Horizontalstreifen für Stops 2..n */}
      {openStops.length > 1 && (
        <div className="mx-4 mt-2">
          <div className="text-[9px] font-black uppercase tracking-widest text-matcha-400 mb-1.5">
            Nächste Stops
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {openStops.slice(1).map((s, idx) => {
              const distKm = s.distanz_zum_vorgaenger_m != null && s.distanz_zum_vorgaenger_m > 0
                ? (s.distanz_zum_vorgaenger_m / 1000).toFixed(1)
                : null;
              const isCash = !s.order.bezahlt || s.order.zahlungsart === 'bar';
              return (
                <div
                  key={s.id}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 min-w-[140px] max-w-[180px]"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="h-5 w-5 rounded-full bg-matcha-700 text-matcha-100 flex items-center justify-center font-black text-[10px] shrink-0">
                      {s.reihenfolge}
                    </span>
                    {isCash && (
                      <span className="rounded-full bg-amber-500/30 text-amber-300 px-1.5 py-0.5 text-[9px] font-bold">
                        BAR
                      </span>
                    )}
                    <span className="ml-auto flex flex-col items-end gap-0 tabular-nums">
                      {/* GPS-Abstand Fahrer → Stopp (Luftlinie) hat Vorrang vor Stopp-zu-Stopp */}
                      {driverLat != null && driverLng != null && s.order.kunde_lat != null && s.order.kunde_lng != null ? (() => {
                        const φ1 = driverLat * Math.PI / 180, φ2 = s.order.kunde_lat * Math.PI / 180;
                        const dφ = (s.order.kunde_lat - driverLat) * Math.PI / 180;
                        const dλ = (s.order.kunde_lng - driverLng) * Math.PI / 180;
                        const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
                        const dm = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
                        return (
                          <span className="text-[9px] text-accent/70 font-bold">
                            {dm < 1000 ? `~${dm}m` : `~${(dm / 1000).toFixed(1)}km`}
                          </span>
                        );
                      })() : distKm ? (
                        <span className="text-[9px] text-matcha-400">{distKm} km</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-matcha-100 leading-tight truncate">
                    {s.order.kunde_name}
                  </div>
                  <div className="text-[9px] text-matcha-400 leading-tight truncate mt-0.5">
                    {s.order.kunde_adresse}
                  </div>
                  {/* Schnellaktionen: Anrufen + Navigation */}
                  <div className="mt-1.5 flex gap-1.5">
                    {s.order.kunde_telefon && (
                      <a
                        href={`tel:${s.order.kunde_telefon}`}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-matcha-700/60 border border-matcha-600/40 py-1 text-[9px] font-bold text-matcha-200 active:scale-[0.97] transition"
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
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-accent/15 border border-accent/30 py-1 text-[9px] font-bold text-accent active:scale-[0.97] transition"
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
                    // Pace-basierter Puffer: projizierte Ankunft vs. ETA
                    const paceBufferSec = batchStartedAt && totalEtaMin && stops.length > 0 ? (() => {
                      const projMs = new Date(batchStartedAt).getTime() + (s.reihenfolge / stops.length) * totalEtaMin * 60_000;
                      return Math.floor((etaMs - projMs) / 1000);
                    })() : null;
                    return (
                      <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] text-matcha-500 tabular-nums">~{etaStr}</span>
                        {secLeft < 1800 && (
                          <span className={cn(
                            'rounded-full px-1.5 py-0.5 text-[8px] font-bold tabular-nums',
                            overdue ? 'bg-red-500/40 text-red-200 animate-pulse' :
                            soon ? 'bg-amber-500/30 text-amber-200' :
                            'bg-matcha-700/50 text-matcha-300',
                          )}>
                            {overdue ? `+${rm}:${String(rs).padStart(2, '0')}` : `${rm}:${String(rs).padStart(2, '0')}`}
                          </span>
                        )}
                        {paceBufferSec !== null && (
                          <span className={cn(
                            'rounded-full px-1.5 py-0.5 text-[8px] font-bold tabular-nums',
                            paceBufferSec >= 120 ? 'text-matcha-400' :
                            paceBufferSec >= 0   ? 'text-amber-400' :
                            'text-red-400 animate-pulse',
                          )}>
                            {paceBufferSec >= 0
                              ? `+${Math.floor(paceBufferSec / 60)}m Puffer`
                              : `-${Math.floor(-paceBufferSec / 60)}m`}
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
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold text-white transition"
            >
              <MapIcon size={16} />
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

      {/* Alle Stopps — vertikale Timeline (auf-/zuklappbar) */}
      {stops.length > 1 && (
        <div className="mx-4 mt-3">
          <button
            onClick={() => setShowAllStops((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-white/8 border border-white/10 px-4 py-2.5 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-matcha-300">Alle Stopps</span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums',
                doneCount === stops.length
                  ? 'bg-accent/20 text-accent'
                  : 'bg-white/10 text-matcha-300',
              )}>
                {doneCount}/{stops.length}
              </span>
            </div>
            <span className="text-matcha-400 text-sm">{showAllStops ? '▲' : '▼'}</span>
          </button>

          {showAllStops && (
            <div className="mt-2 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              {[...stops]
                .sort((a, b) => a.reihenfolge - b.reihenfolge)
                .map((s, idx, arr) => {
                  const done = !!s.geliefert_am;
                  const isNext = !done && arr.slice(0, idx).every((p) => !!p.geliefert_am);
                  const isBar = !s.order.bezahlt || s.order.zahlungsart === 'bar';
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
                      'flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition',
                      isNext ? 'bg-accent/5' : done ? 'opacity-60' : '',
                    )}>
                      {/* Sequence dot */}
                      <div className="flex flex-col items-center shrink-0 mt-0.5">
                        <div className={cn(
                          'h-7 w-7 rounded-full flex items-center justify-center font-black text-[11px] border-2',
                          done
                            ? 'bg-accent/20 border-accent text-accent'
                            : isNext
                            ? 'bg-matcha-900 border-accent text-accent ring-2 ring-accent/30 ring-offset-1 ring-offset-transparent'
                            : 'bg-white/5 border-white/20 text-matcha-400',
                        )}>
                          {done ? '✓' : s.reihenfolge}
                        </div>
                        {idx < arr.length - 1 && (
                          <div className={cn(
                            'w-0.5 flex-1 mt-1 min-h-[16px]',
                            done ? 'bg-accent/30' : 'bg-white/10',
                          )} />
                        )}
                      </div>

                      {/* Stop details */}
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            'font-display font-bold text-sm',
                            done ? 'text-matcha-300 line-through' : isNext ? 'text-white' : 'text-matcha-200',
                          )}>
                            {s.order.kunde_name}
                          </span>
                          {isBar && !done && (
                            <span className="rounded-full bg-amber-500/30 text-amber-300 px-1.5 py-0.5 text-[8px] font-bold">
                              BAR {euro(s.order.gesamtbetrag)}
                            </span>
                          )}
                          {done && (
                            <span className="rounded-full bg-accent/20 text-accent px-1.5 py-0.5 text-[8px] font-bold">
                              {deliveryTime}
                            </span>
                          )}
                          {isNext && (
                            <span className="rounded-full bg-accent text-matcha-900 px-1.5 py-0.5 text-[8px] font-black">
                              Nächster
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-matcha-400 leading-tight truncate mt-0.5">
                          {s.order.kunde_adresse}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {distKm && (
                            <span className="text-[9px] text-matcha-500 tabular-nums">{distKm} km</span>
                          )}
                          {distKm && !done && (
                            <span className="text-[9px] text-matcha-400/70 tabular-nums">~{Math.max(1, Math.ceil(parseFloat(distKm) * 60 / 25))} Min</span>
                          )}
                          {etaStr && !done && (() => {
                            const etaMs = new Date(s.order.eta_earliest!).getTime();
                            const secLeft = Math.floor((etaMs - Date.now()) / 1000);
                            const rm = Math.floor(Math.abs(secLeft) / 60);
                            const rs = Math.abs(secLeft) % 60;
                            return (
                              <span className={cn(
                                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                                etaOverdue
                                  ? 'bg-red-500/30 text-red-300 animate-pulse'
                                  : secLeft < 600
                                  ? 'bg-amber-500/25 text-amber-300'
                                  : 'bg-matcha-700/60 text-matcha-300',
                              )}>
                                {etaOverdue ? `+${rm}:${String(rs).padStart(2,'0')} überfällig` : `~${rm}:${String(rs).padStart(2,'0')} · ${etaStr}`}
                              </span>
                            );
                          })()}
                          {s.order.kunde_telefon && (
                            <a
                              href={`tel:${s.order.kunde_telefon}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[9px] font-bold text-matcha-400 hover:text-matcha-200 transition"
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
            <div className="w-full rounded-t-3xl bg-matcha-800 border-t border-white/10 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <AlertCircle className="mx-auto mb-2 text-amber-400" size={28} />
                <div className="font-display font-bold text-lg">Verzögerung melden</div>
                <p className="text-sm text-matcha-300 mt-1">Kunden werden automatisch benachrichtigt.</p>
              </div>
              <div className="space-y-2">
                {DELAY_OPTIONS.map(({ label, msg }) => (
                  <button
                    key={label}
                    onClick={() => void sendDelay(msg)}
                    className="w-full h-11 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-sm font-bold text-left px-4 flex items-center gap-2 active:scale-[0.98] transition"
                  >
                    <AlertCircle size={14} className="text-amber-400 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setDelayOpen(false)}
                className="w-full h-11 rounded-xl bg-white/10 font-bold text-sm"
              >
                Abbrechen
              </button>
            </div>
          </div>
        );
      })()}

      {/* Modal: Nicht zugestellt melden */}
      {failedStopId && (() => {
        const stop = stops.find((s) => s.id === failedStopId);
        return (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm" onClick={() => setFailedStopId(null)}>
            <div className="w-full rounded-t-3xl bg-matcha-800 border-t border-white/10 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <AlertTriangle className="mx-auto mb-2 text-amber-400" size={28} />
                <div className="font-display font-bold text-lg">Nicht zugestellt</div>
                <p className="text-sm text-matcha-300 mt-1">
                  {stop?.order.kunde_name} — #{stop?.order.bestellnummer.replace(/^[A-Z]+-/, '')}
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">Grund</div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FAILED_REASON_LABELS) as [FailedReason, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setFailedReason(key)}
                      className={cn(
                        'h-10 rounded-xl text-[11px] font-bold border transition active:scale-[0.97]',
                        failedReason === key
                          ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                          : 'bg-white/5 border-white/10 text-matcha-300',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400 mb-1.5">Notiz (optional)</div>
                <textarea
                  value={failedNotes}
                  onChange={(e) => setFailedNotes(e.target.value.slice(0, 200))}
                  placeholder="z.B. Klingel defekt, falsche Hausnummer…"
                  rows={2}
                  className="w-full rounded-xl bg-white/8 border border-white/15 text-sm text-white placeholder:text-matcha-500 px-3 py-2 resize-none focus:outline-none focus:border-amber-400/60"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setFailedStopId(null); setFailedNotes(''); setFailedReason('no_answer'); }}
                  className="flex-1 h-12 rounded-xl bg-white/10 font-bold text-sm"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => markFailedAttempt(failedStopId)}
                  disabled={pendingFailed === failedStopId}
                  className="flex-1 h-12 rounded-xl bg-amber-500 text-matcha-900 font-display font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
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
          <div className="w-full rounded-t-3xl bg-matcha-800 border-t border-white/10 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-2xl mb-2">🚪</div>
              <div className="font-display font-bold text-lg">Nicht angetroffen?</div>
              <p className="text-sm text-matcha-300 mt-1">
                Stopp wird ans Ende der Tour verschoben. Du kannst danach nochmal versuchen.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSkipId(null)}
                className="flex-1 h-12 rounded-xl bg-white/10 font-bold text-sm"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  setSkippedIds((s) => new Set([...s, confirmSkipId]));
                  setConfirmSkipId(null);
                }}
                className="flex-1 h-12 rounded-xl bg-amber-500 text-matcha-900 font-display font-bold text-sm"
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
        const isBarProof = !proofStop?.order.bezahlt || proofStop?.order.zahlungsart === 'bar';
        const PROOF_OPTIONS: { key: ProofType; label: string; icon: string }[] = [
          { key: 'handed_to_person', label: 'Übergeben', icon: '🤝' },
          { key: 'left_at_door',    label: 'Vor Tür',    icon: '🚪' },
          { key: 'neighbour',       label: 'Nachbar',    icon: '👥' },
          { key: 'contactless',     label: 'Kontaktlos', icon: '📦' },
          { key: 'photo',           label: 'Foto',       icon: '📷' },
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm" onClick={() => !proofPending && setProofModalStopId(null)}>
            <div className="w-full rounded-t-3xl bg-matcha-800 border-t border-white/10 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <CheckCircle2 className="mx-auto mb-2 text-accent" size={28} />
                <div className="font-display font-bold text-lg">Liefernachweis</div>
                <p className="text-sm text-matcha-300 mt-1">
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
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'bg-white/5 border-white/10 text-matcha-300',
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
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/70 flex items-center justify-center text-white text-xs font-bold"
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
                      className="w-full h-20 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 flex flex-col items-center justify-center gap-1.5 text-accent/80 hover:bg-accent/10 active:scale-[0.98] transition"
                    >
                      <Camera size={22} />
                      <span className="text-[11px] font-bold">Foto aufnehmen</span>
                    </button>
                  )}
                </div>
              )}

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400 mb-1.5">Notiz (optional)</div>
                <textarea
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value.slice(0, 200))}
                  placeholder="z.B. Paket vor Eingangstür abgestellt…"
                  rows={2}
                  className="w-full rounded-xl bg-white/8 border border-white/15 text-sm text-white placeholder:text-matcha-500 px-3 py-2 resize-none focus:outline-none focus:border-accent/60"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setProofModalStopId(null); setProofPhotoBlob(null); setProofPhotoPreview(null); }}
                  disabled={proofPending}
                  className="flex-1 h-12 rounded-xl bg-white/10 font-bold text-sm disabled:opacity-40"
                >
                  Zurück
                </button>
                <button
                  onClick={() => confirmDeliveryWithProof(proofModalStopId!)}
                  disabled={proofPending || (proofType === 'photo' && !proofPhotoBlob)}
                  className="flex-1 h-12 rounded-xl bg-accent text-matcha-900 font-display font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
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
                    {!done && (
                      <StopEtaStatusChip
                        etaEarliest={stop.order.eta_earliest}
                        etaLatest={stop.order.eta_latest}
                      />
                    )}
                  </div>
                  {/* Kundennotiz — auch für ausstehende Folge-Stops sichtbar */}
                  {!done && stop.order.kunde_notiz && (
                    <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-500/15 border border-amber-400/20 px-2 py-1">
                      <span className="shrink-0 text-[9px] font-black text-amber-300 uppercase tracking-wider mt-0.5">Notiz:</span>
                      <span className="text-[10px] text-amber-200 leading-snug">{stop.order.kunde_notiz}</span>
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
                        <div className="flex items-start gap-1.5 rounded-md bg-blue-500/20 border border-blue-400/40 px-2 py-1.5">
                          <MessageSquare className="shrink-0 h-3 w-3 text-blue-300 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-black text-blue-300 uppercase tracking-wider">
                              Kunde{msgs.length > 1 ? ` · ${msgs.length} Nachr.` : ''}
                            </div>
                            {isExpanded ? (
                              <div className="mt-1 space-y-1.5">
                                {msgs.map((m) => (
                                  <div key={m.id}>
                                    <div className="text-[10px] text-blue-100 leading-snug">{m.nachricht}</div>
                                    <div className="text-[8px] text-blue-400 tabular-nums">
                                      {new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-blue-200 leading-snug truncate">{latest.nachricht}</div>
                            )}
                          </div>
                          <span className="shrink-0 text-[9px] text-blue-400 font-bold">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>
                    );
                  })()}
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
                <div className="mt-2 flex items-center gap-1.5 rounded-full bg-accent/20 border border-accent/40 px-3 py-1 text-[11px] font-bold text-accent">
                  <Flag size={11} /> Angekommen — bitte zustellen
                </div>
              )}
              {/* Zurückgestellt-Badge für übersprungene Stops */}
              {!done && skippedIds.has(stop.id) && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-amber-500/15 border border-amber-400/30 px-3 py-1.5">
                  <span className="text-[11px] font-bold text-amber-300">Zurückgestellt — nach anderen Stops nochmal</span>
                  <button
                    onClick={() => setSkippedIds((s) => { const n = new Set(s); n.delete(stop.id); return n; })}
                    className="text-[10px] font-bold text-amber-200 underline"
                  >
                    Jetzt
                  </button>
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
                  {/* WhatsApp-Schnellnachricht: "Ich bin da" */}
                  {stop.order.kunde_telefon && (() => {
                    const raw = stop.order.kunde_telefon!.replace(/\s+/g, '').replace(/[^\d+]/g, '');
                    const intl = raw.startsWith('+') ? raw.slice(1) : raw.startsWith('00') ? raw.slice(2) : raw.startsWith('0') ? '49' + raw.slice(1) : '49' + raw;
                    const msg = encodeURIComponent(`Hallo! Ich bin Ihr Lieferfahrer und stehe vor Ihrer Tür. Bestellung #${stop.order.bestellnummer.replace(/^[A-Z]+-/, '')} 🚗`);
                    return (
                      <a
                        href={`https://wa.me/${intl}?text=${msg}`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-11 w-11 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 grid place-items-center text-[#25D366]"
                        title="WhatsApp: Ich bin da!"
                      >
                        <MessageSquare size={16} />
                      </a>
                    );
                  })()}
                  {/* Tracking-Link an Kunden teilen */}
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
                      'h-11 w-11 rounded-xl grid place-items-center transition shrink-0',
                      copiedStopId === stop.id
                        ? 'bg-accent/30 text-accent'
                        : 'bg-white/10 hover:bg-white/20 text-matcha-200',
                    )}
                  >
                    {copiedStopId === stop.id ? <Check size={16} /> : <Share2 size={16} />}
                  </button>
                  {/* Angekommen-Button — nur wenn noch nicht angekommen */}
                  {!stop.angekommen_am && !arrivedIds.has(stop.id) && (
                    <button
                      onClick={() => markArrived(stop.id)}
                      className="h-11 px-3 rounded-xl bg-accent/20 border border-accent/40 text-accent flex items-center gap-1.5 text-xs font-bold shrink-0"
                    >
                      <Flag size={13} /> Angekommen
                    </button>
                  )}
                  {/* Nicht angetroffen — Stopp zurückstellen oder dauerhaft als nicht zugestellt melden */}
                  {openStops.length > 1 && (
                    <button
                      onClick={() => setConfirmSkipId(stop.id)}
                      className="h-11 px-2.5 rounded-xl bg-white/8 border border-white/15 text-matcha-300 flex items-center gap-1 text-[11px] font-bold shrink-0"
                    >
                      Zurückst.
                    </button>
                  )}
                  {/* Dauerhaft nicht zugestellt melden (Fahrer vor Ort) */}
                  {(stop.angekommen_am || arrivedIds.has(stop.id)) && (
                    <button
                      onClick={() => { setFailedStopId(stop.id); setFailedReason('no_answer'); setFailedNotes(''); }}
                      className="h-11 px-2.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300 flex items-center gap-1 text-[11px] font-bold shrink-0"
                      title="Nicht zugestellt melden"
                    >
                      <AlertTriangle size={12} /> N. zust.
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
                    onClick={() => { setProofModalStopId(stop.id); setProofType('handed_to_person'); setProofNotes(''); setProofPhotoBlob(null); setProofPhotoPreview(null); }}
                    disabled={pending === stop.id || proofPending}
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
              <TourCloseButton batchId={batchId} onDone={() => setShowCompletion(true)} />

              {/* Navigation zurück zum Restaurant */}
              {restaurantLoc && (() => {
                const { lat, lng, name } = restaurantLoc;
                const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
                const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
                const appleUrl  = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
                const wazeUrl   = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
                return (
                  <div className="rounded-xl border border-matcha-500/40 bg-matcha-900/60 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-400 mb-2 flex items-center gap-1.5">
                      <Navigation size={10} />
                      Zurück: {name}
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={isIos ? appleUrl : googleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-matcha-700 text-matcha-100 font-bold text-xs active:scale-[0.98] transition"
                      >
                        <Navigation size={12} />
                        {isIos ? 'Apple Maps' : 'Google Maps'}
                      </a>
                      <a
                        href={wazeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 h-9 px-3 rounded-lg bg-[#33ccff]/15 border border-[#33ccff]/30 text-[#33ccff] font-bold text-xs active:scale-[0.98] transition"
                      >
                        Waze
                      </a>
                    </div>
                  </div>
                );
              })()}

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

              {/* Tour-Qualitätsscore */}
              {(() => {
                const withEta = stops.filter((s) => s.geliefert_am && s.order.eta_latest);
                const onTime = withEta.filter((s) => new Date(s.geliefert_am!).getTime() <= new Date(s.order.eta_latest!).getTime()).length;
                const etaPct = withEta.length > 0 ? Math.round((onTime / withEta.length) * 100) : null;
                const speedScore = totalDistKm > 0 && elapsedMin > 0 ? Math.min(100, Math.round((totalDistKm / elapsedMin) * 200)) : null;
                const score = etaPct != null ? Math.round(etaPct * 0.7 + (speedScore ?? 70) * 0.3) : (speedScore ?? null);
                if (score == null) return null;
                const grade = score >= 90 ? { label: 'Exzellent', color: 'text-accent', ring: 'border-accent' } :
                              score >= 75 ? { label: 'Gut', color: 'text-matcha-300', ring: 'border-matcha-400' } :
                              score >= 55 ? { label: 'Ok', color: 'text-amber-300', ring: 'border-amber-400' } :
                              { label: 'Verbesserbar', color: 'text-red-300', ring: 'border-red-400' };
                return (
                  <div className={`rounded-xl border-2 ${grade.ring} bg-white/5 p-4`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300 mb-2">Tour-Qualität</div>
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
                        <div className={`absolute font-black text-base tabular-nums ${grade.color}`}>{score}</div>
                      </div>
                      <div className="text-left">
                        <div className={`font-display text-lg font-black ${grade.color}`}>{grade.label}</div>
                        {etaPct != null && <div className="text-xs text-matcha-300 mt-0.5">{etaPct}% rechtzeitig geliefert</div>}
                        {speedScore != null && <div className="text-xs text-matcha-300">{(totalDistKm / elapsedMin * 60).toFixed(1)} km/h Ø</div>}
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
      arrived ? 'bg-accent/20 border-accent/50' :
      near    ? 'bg-orange-500/15 border-orange-400/40' :
      soon    ? 'bg-amber-500/10 border-amber-400/30' :
                'bg-blue-500/10 border-blue-400/20',
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
          'font-display font-black text-base tabular-nums leading-tight',
          arrived ? 'text-accent' : near ? 'text-orange-300' : 'text-white',
        )}>
          {label}
        </div>
        {near && !arrived && (
          <div className="text-[9px] text-orange-300 font-bold animate-pulse">Fast da!</div>
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
      <span className="text-[7px] text-matcha-400 font-bold leading-none">km/h</span>
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

/* ------------------------------ TourOnTimeRing ------------------------------ */
/* SVG-Ring zeigt Fortschritt der Tour + On-Time-Status durch Farbkodierung */
function TourOnTimeRing({
  doneCount,
  totalStops,
  elapsedSec,
  totalEtaMin,
}: {
  doneCount: number;
  totalStops: number;
  elapsedSec: number;
  totalEtaMin: number | null;
}) {
  const pct = totalStops > 0 ? doneCount / totalStops : 0;
  const allDone = doneCount >= totalStops;

  // On-time score: compare actual done % vs expected done % based on elapsed time
  let onTimeStatus: 'ahead' | 'on_time' | 'behind' | 'late' = 'on_time';
  if (totalEtaMin != null && totalEtaMin > 0 && !allDone) {
    const elapsedMin = elapsedSec / 60;
    const expectedPct = Math.min(elapsedMin / totalEtaMin, 1);
    const delta = pct - expectedPct; // positive = ahead, negative = behind
    if (delta > 0.15) onTimeStatus = 'ahead';
    else if (delta >= -0.1) onTimeStatus = 'on_time';
    else if (delta >= -0.25) onTimeStatus = 'behind';
    else onTimeStatus = 'late';
  }
  if (allDone) onTimeStatus = 'ahead';

  const ringColor =
    allDone ? '#86efac' :           // light green: done
    onTimeStatus === 'ahead' ? '#4ade80' :   // green
    onTimeStatus === 'on_time' ? '#a3e635' : // accent/lime
    onTimeStatus === 'behind' ? '#fb923c' :  // orange
    '#f87171';                               // red: late

  const label =
    allDone ? '✓' :
    onTimeStatus === 'ahead' ? 'top' :
    onTimeStatus === 'on_time' ? 'ok' :
    onTimeStatus === 'behind' ? 'spät' :
    '!';

  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="44" height="44" viewBox="0 0 44 44">
        {/* track */}
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        {/* progress arc */}
        <circle
          cx="22" cy="22" r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 22 22)"
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
        />
        {/* center text */}
        <text
          x="22" y="22"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={allDone ? '9' : '8'}
          fontWeight="800"
          fill={ringColor}
          fontFamily="monospace"
        >
          {allDone ? '✓' : `${Math.round(pct * 100)}%`}
        </text>
      </svg>
      <span
        className="text-[8px] font-black uppercase tracking-wider tabular-nums"
        style={{ color: ringColor }}
      >
        {label}
      </span>
    </div>
  );
}

/* ------------------------------ TourRemainingStrip ------------------------------ */
/* Kompaktes Banner: verbleibende Stopps, geschätzte Distanz und noch zu kassierende Beträge */
function TourRemainingStrip({ stops, doneCount }: { stops: Stop[]; doneCount: number }) {
  const remaining = stops.filter((s) => !s.geliefert_am);
  if (remaining.length === 0) return null;

  const remainingDistM = remaining.reduce((sum, s) => sum + (s.distanz_zum_vorgaenger_m ?? 0), 0);
  const remainingDistStr = remainingDistM >= 1000
    ? `${(remainingDistM / 1000).toFixed(1)} km`
    : remainingDistM > 0 ? `${Math.round(remainingDistM)} m` : null;

  const cashRemaining = remaining.filter(s => !s.order.bezahlt || s.order.zahlungsart === 'bar');
  const cashTotal = cashRemaining.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);

  const nextOverdue = remaining.some(s => s.order.eta_earliest && new Date(s.order.eta_earliest).getTime() < Date.now());

  return (
    <div className={cn(
      'mx-4 mt-1 mb-0 rounded-xl border px-3 py-2 flex items-center gap-3 flex-wrap',
      nextOverdue ? 'bg-red-900/20 border-red-500/30' : 'bg-white/5 border-white/10',
    )}>
      {/* Verbleibende Stopps */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-matcha-400">Noch</span>
        <span className={cn(
          'font-display text-lg font-black tabular-nums leading-none',
          nextOverdue ? 'text-red-300' : 'text-white',
        )}>
          {remaining.length}
        </span>
        <span className="text-[9px] text-matcha-400 font-bold">
          Stopp{remaining.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="h-6 w-px bg-white/10 shrink-0" />

      {/* Fortschrittsbalken */}
      <div className="flex-1 min-w-[60px] max-w-[80px]">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              doneCount === stops.length ? 'bg-accent' :
              doneCount >= stops.length * 0.6 ? 'bg-matcha-400' : 'bg-orange-400',
            )}
            style={{ width: `${Math.round((doneCount / stops.length) * 100)}%` }}
          />
        </div>
        <div className="text-[8px] text-matcha-500 font-bold mt-0.5 tabular-nums">
          {doneCount}/{stops.length}
        </div>
      </div>

      {remainingDistStr && (
        <>
          <div className="h-6 w-px bg-white/10 shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[9px] text-matcha-400">~</span>
            <span className="text-[11px] font-black text-matcha-200 tabular-nums">{remainingDistStr}</span>
            <span className="text-[8px] text-matcha-400">gesamt</span>
          </div>
        </>
      )}

      {cashTotal > 0 && (
        <>
          <div className="h-6 w-px bg-white/10 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0 rounded-lg bg-amber-500/15 border border-amber-400/25 px-2 py-0.5">
            <span className="text-[9px] font-black text-amber-300 tabular-nums">
              💵 {cashTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
            </span>
            <span className="text-[8px] text-amber-400">kassieren</span>
          </div>
        </>
      )}

      {nextOverdue && (
        <div className="ml-auto shrink-0 text-[9px] font-black text-red-300 animate-pulse">
          ⚠ Verspätet!
        </div>
      )}
    </div>
  );
}

/* ------------------------------ TourProgressDots ------------------------------ */
/* Zeigt alle Stopps als nummerierte Punkte mit Verbindungslinien — kompakter Fortschrittsstreifen */
function TourProgressDots({ stops, doneCount }: { stops: Stop[]; doneCount: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (stops.length <= 1) return null;

  return (
    <div className="px-4 py-2 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-0">
        {stops.flatMap((s, idx) => {
          const isDone = !!s.geliefert_am;
          const isNext = !isDone && doneCount === idx;
          const isCash = !s.order.bezahlt || s.order.zahlungsart === 'bar';

          // Per-stop ETA label
          const etaLabel = (() => {
            if (isDone) return null;
            const eta = s.order.eta_earliest;
            if (!eta) return null;
            const ms = new Date(eta).getTime() - Date.now();
            const absMins = Math.abs(Math.round(ms / 60_000));
            const isLate = ms < 0;
            if (absMins > 99) return null;
            return { label: isLate ? `+${absMins}` : `${absMins}m`, late: isLate, soon: !isLate && ms < 5 * 60_000 };
          })();

          const els = [
            <div key={s.id} className="flex flex-col items-center gap-0.5">
              <div
                title={`Stopp ${s.reihenfolge}: ${s.order.kunde_name}`}
                className={cn(
                  'relative h-7 w-7 shrink-0 rounded-full flex items-center justify-center font-black text-[10px] border-2 transition-all',
                  isDone
                    ? 'bg-matcha-700 border-matcha-600 text-matcha-400'
                    : isNext
                      ? 'bg-accent border-accent text-matcha-900 shadow-lg shadow-accent/30 scale-110'
                      : 'bg-white/8 border-white/15 text-matcha-500',
                )}
              >
                {isDone ? '✓' : s.reihenfolge}
                {isCash && !isDone && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 border-2 border-matcha-900" />
                )}
              </div>
              {etaLabel && (
                <span className={cn(
                  'text-[8px] font-bold tabular-nums leading-none',
                  etaLabel.late ? 'text-red-400 animate-pulse' :
                  etaLabel.soon ? 'text-amber-300' :
                  'text-matcha-500',
                )}>
                  {etaLabel.label}
                </span>
              )}
            </div>,
          ];
          if (idx < stops.length - 1) {
            els.push(
              <div
                key={`line-${idx}`}
                className={cn('h-px w-3 shrink-0 self-start mt-3.5 transition-all', isDone ? 'bg-matcha-600' : 'bg-white/10')}
              />,
            );
          }
          return els;
        })}
        <span className="ml-2 shrink-0 text-[9px] text-matcha-500 font-bold tabular-nums self-start mt-2">
          {doneCount}/{stops.length}
        </span>
      </div>
    </div>
  );
}

/* ── UpcomingStopsTimeline ──────────────────────────────────────────────────
   Kompakte horizontale Liste aller verbleibenden Stopps mit ETA-Countdown
   und Distanz-Badge. Zeigt nur wenn >1 offener Stopp vorhanden.
──────────────────────────────────────────────────────────────────────────── */
function UpcomingStopsTimeline({
  stops,
  doneCount,
  batchStartedAt,
  totalEtaMin,
}: {
  stops: Stop[];
  doneCount: number;
  batchStartedAt?: string | null;
  totalEtaMin?: number | null;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const openStops = stops.filter(s => !s.geliefert_am).sort((a, b) => a.reihenfolge - b.reihenfolge);
  if (openStops.length <= 1) return null;

  // Per-stop ETA from batch start + proportional time
  const getStopEtaStr = (stop: Stop): { str: string; isLate: boolean; isSoon: boolean } | null => {
    // Prefer DB eta_earliest
    if (stop.order.eta_earliest) {
      const ms = new Date(stop.order.eta_earliest).getTime() - Date.now();
      const absMins = Math.abs(Math.round(ms / 60_000));
      const isLate = ms < 0;
      return {
        str: isLate ? `+${absMins}m` : `${absMins}m`,
        isLate,
        isSoon: !isLate && ms < 5 * 60_000,
      };
    }
    // Fallback: proportional from tour ETA
    if (batchStartedAt && totalEtaMin && stops.length > 0) {
      const etaMs = new Date(batchStartedAt).getTime() + (stop.reihenfolge / stops.length) * totalEtaMin * 60_000;
      const ms = etaMs - Date.now();
      const absMins = Math.abs(Math.round(ms / 60_000));
      const isLate = ms < 0;
      return { str: isLate ? `+${absMins}m` : `${absMins}m`, isLate, isSoon: !isLate && ms < 5 * 60_000 };
    }
    return null;
  };

  return (
    <div className="px-4 mb-2">
      <div className="text-[8px] font-black uppercase tracking-widest text-matcha-400 mb-1.5">
        Kommende Stopps · {openStops.length} verbleibend
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {openStops.map((stop, idx) => {
          const isNext = idx === 0;
          const eta = getStopEtaStr(stop);
          const hasDist = stop.distanz_zum_vorgaenger_m != null && stop.distanz_zum_vorgaenger_m > 0;
          const distStr = hasDist
            ? stop.distanz_zum_vorgaenger_m! >= 1000
              ? `${(stop.distanz_zum_vorgaenger_m! / 1000).toFixed(1)} km`
              : `${stop.distanz_zum_vorgaenger_m} m`
            : null;
          const isCash = !stop.order.bezahlt || stop.order.zahlungsart === 'bar';

          return (
            <div
              key={stop.id}
              className={cn(
                'shrink-0 rounded-xl border p-2.5 flex flex-col gap-1 transition-all',
                'min-w-[110px] max-w-[140px]',
                isNext
                  ? 'border-accent/50 bg-accent/10'
                  : 'border-white/10 bg-white/5',
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={cn(
                  'h-5 w-5 shrink-0 rounded-full flex items-center justify-center font-black text-[10px]',
                  isNext ? 'bg-accent text-matcha-900' : 'bg-white/10 text-matcha-400',
                )}>
                  {stop.reihenfolge}
                </span>
                {isCash && (
                  <span className="text-[8px] font-black text-amber-300 bg-amber-500/20 rounded-full px-1">BAR</span>
                )}
                {eta && (
                  <span className={cn(
                    'text-[9px] font-black tabular-nums rounded-full px-1.5 py-0.5 shrink-0',
                    eta.isLate ? 'bg-red-500/30 text-red-300 animate-pulse' :
                    eta.isSoon ? 'bg-amber-500/30 text-amber-200' :
                    'bg-white/8 text-matcha-300',
                  )}>
                    {eta.str}
                  </span>
                )}
              </div>
              <div className="text-[10px] font-bold text-matcha-100 truncate leading-tight">
                {stop.order.kunde_name}
              </div>
              {stop.order.kunde_adresse && (
                <div className="text-[9px] text-matcha-400 truncate leading-tight">
                  {stop.order.kunde_adresse.replace(/,\s*\d{5}.*$/, '')}
                </div>
              )}
              {distStr && (
                <div className="text-[8px] text-matcha-500 font-mono">
                  {distStr}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ MyPerformanceBadge ------------------------------ */

type PerfHistoryPoint = {
  date: string;
  stopsCompleted: number;
  onTimeRate: number | null;
  totalEarningsEur: number;
  toursCompleted: number;
};

type PerfData = {
  rank: number;
  total: number;
  history: PerfHistoryPoint[];
};

function MyPerformanceBadge() {
  const [data, setData] = useState<PerfData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/delivery/driver/my-performance?period=week&days=7')
      .then((r) => r.json())
      .then((d) => {
        if (d.rank != null && d.total != null) {
          setData({
            rank: d.rank,
            total: d.total,
            history: Array.isArray(d.history) ? d.history : [],
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const isTop3 = data.rank <= 3;
  const last7 = data.history.slice(-7);
  const maxStops = Math.max(1, ...last7.map((p) => p.stopsCompleted));
  const weekStops = last7.reduce((s, p) => s + p.stopsCompleted, 0);
  const weekEarnings = last7.reduce((s, p) => s + p.totalEarningsEur, 0);
  const latestOnTime = [...last7].reverse().find((p) => p.onTimeRate != null)?.onTimeRate ?? null;
  const trend = last7.length >= 2
    ? last7[last7.length - 1].stopsCompleted - last7[last7.length - 2].stopsCompleted
    : 0;

  return (
    <div className="flex flex-col items-end gap-0">
      {/* Compact badge pill — tappable */}
      <button
        onClick={() => setExpanded((x) => !x)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold active:scale-[0.97] transition-transform',
          isTop3
            ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-200'
            : 'bg-white/10 border-white/20 text-white/60',
        )}
      >
        {isTop3 && <span>🏆</span>}
        <span>#{data.rank}/{data.total}</span>
        {/* 7-day stops sparkline — tiny bar chart */}
        <span className="flex items-end gap-[2px] h-[12px]">
          {last7.map((p, i) => {
            const barH = maxStops > 0 ? Math.max(3, Math.round((p.stopsCompleted / maxStops) * 10)) : 3;
            const isLatest = i === last7.length - 1;
            return (
              <span
                key={p.date}
                style={{ height: `${barH}px` }}
                className={cn('inline-block w-[3px] rounded-[1px]', isLatest ? 'bg-accent' : 'bg-white/35')}
              />
            );
          })}
        </span>
        {trend > 0 && <span className="text-accent text-[9px]">▲</span>}
        {trend < 0 && <span className="text-red-400 text-[9px]">▼</span>}
      </button>

      {/* Expandable weekly-stats panel */}
      {expanded && (
        <div className={cn(
          'mt-1 rounded-xl border p-2.5 w-44 text-right',
          isTop3 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-white/5 border-white/10',
        )}>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div>
              <div className="text-sm font-black tabular-nums text-white">{weekStops}</div>
              <div className="text-[8px] text-white/40 leading-tight">Stops<br/>7 Tage</div>
            </div>
            <div>
              <div className={cn(
                'text-sm font-black tabular-nums',
                latestOnTime == null ? 'text-white/30'
                  : latestOnTime >= 0.9 ? 'text-accent'
                  : latestOnTime >= 0.7 ? 'text-amber-300'
                  : 'text-red-400',
              )}>
                {latestOnTime != null ? `${Math.round(latestOnTime * 100)}%` : '—'}
              </div>
              <div className="text-[8px] text-white/40 leading-tight">Pünktlich<br/>letzte Tour</div>
            </div>
            <div>
              <div className="text-sm font-black tabular-nums text-white">
                {weekEarnings > 0
                  ? weekEarnings.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
                  : '—'}
              </div>
              <div className="text-[8px] text-white/40 leading-tight">Verdienst<br/>7 Tage</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ StopEtaStatusChip ------------------------------ */

function StopEtaStatusChip({ etaEarliest, etaLatest }: { etaEarliest: string | null | undefined; etaLatest: string | null | undefined }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!etaEarliest) return null;
  const now = Date.now();
  const earliest = new Date(etaEarliest).getTime();
  const latest = etaLatest ? new Date(etaLatest).getTime() : earliest + 10 * 60_000;

  const minutesToWindow = Math.floor((earliest - now) / 60_000);
  const afterWindow = now > latest;

  if (afterWindow) {
    const lateMin = Math.floor((now - latest) / 60_000);
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[9px] font-bold text-red-300">
        ⚠ +{lateMin}m spät
      </span>
    );
  }
  if (minutesToWindow > 5) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-500/40 px-2 py-0.5 text-[9px] font-bold text-blue-300">
        ⏳ Ankunft in {minutesToWindow}m
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 border border-accent/40 px-2 py-0.5 text-[9px] font-bold text-accent">
      ✓ Zeitfenster
    </span>
  );
}

/* ------------------------------ LiveEarningsBubble ------------------------------ */

function LiveEarningsBubble({ amount }: { amount: number }) {
  return (
    <div
      className="fixed inset-x-0 top-1/3 z-50 flex justify-center pointer-events-none animate-in fade-in zoom-in-75 duration-300"
      style={{ animationFillMode: 'both' }}
    >
      <div className="flex items-center gap-2 rounded-2xl bg-accent/95 shadow-2xl px-5 py-3 ring-2 ring-accent/40">
        <TrendingUp className="h-5 w-5 text-matcha-900 shrink-0" />
        <span className="font-display text-lg font-black text-matcha-900 tabular-nums">
          +{amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
        </span>
        <span className="text-[11px] font-bold text-matcha-700">verdient</span>
      </div>
    </div>
  );
}
