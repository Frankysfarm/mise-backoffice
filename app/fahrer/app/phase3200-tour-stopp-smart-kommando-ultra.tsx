'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  AlertTriangle, CheckCircle2, ChevronRight, Clock, MapPin, Navigation,
  Package, Phone, User,
} from 'lucide-react';

// Phase 3200 — Tour-Stopp Smart-Kommando Ultra (Fahrer-App)
// Zeigt nächsten und übernächsten Stopp: Adresse, ETA-Countdown,
// Kundenkontakt, Pakete und Quick-Confirm-Button. 15-Sek-Polling, 1-Sek-Tick.

type StopRow = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_telefon: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
    items: { name: string; menge: number }[];
  } | null;
};

type Props = {
  driverId: string;
  batchId?: string;
};

function secToLabel(sec: number): string {
  if (sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function etaColor(sec: number | null): string {
  if (sec === null) return 'text-gray-500';
  if (sec < 0) return 'text-red-600';
  if (sec < 120) return 'text-red-500';
  if (sec < 300) return 'text-yellow-600';
  return 'text-green-700';
}

export function FahrerPhase3200TourStoppSmartKommandoUltra({ driverId, batchId }: Props) {
  const supabase = createClient();
  const [stops, setStops] = useState<StopRow[]>([]);
  const [etaSecs, setEtaSecs] = useState<Map<string, number>>(new Map());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const etaRef = useRef<Map<string, number>>(new Map());

  async function loadStops() {
    let query = supabase
      .from('batch_stops')
      .select(`
        id, reihenfolge, geliefert_am,
        order:orders(
          id, bestellnummer, kunde_name, kunde_adresse, kunde_telefon,
          eta_earliest, eta_latest,
          items:order_items(name:menu_item_name, menge:quantity)
        )
      `)
      .is('geliefert_am', null)
      .order('reihenfolge', { ascending: true })
      .limit(3);

    if (batchId) {
      query = query.eq('batch_id', batchId);
    } else {
      // Find active batch for driver
      const { data: batch } = await supabase
        .from('batches')
        .select('id')
        .eq('fahrer_id', driverId)
        .in('status', ['aktiv', 'unterwegs'])
        .maybeSingle();
      if (!batch) { setStops([]); return; }
      query = query.eq('batch_id', batch.id);
    }

    const { data } = await query;
    if (!data) return;

    const now = new Date();
    const newEta = new Map<string, number>();
    for (const s of data as StopRow[]) {
      const latest = s.order?.eta_latest ? new Date(s.order.eta_latest) : null;
      if (latest) {
        newEta.set(s.id, Math.round((latest.getTime() - now.getTime()) / 1000));
      }
    }

    etaRef.current = newEta;
    setStops(data as StopRow[]);
    setEtaSecs(new Map(newEta));
  }

  // Confirm delivery
  async function confirmDelivery(stopId: string) {
    setConfirming(stopId);
    try {
      await supabase
        .from('batch_stops')
        .update({ geliefert_am: new Date().toISOString() })
        .eq('id', stopId);
      await loadStops();
    } finally {
      setConfirming(null);
    }
  }

  // 1-sec countdown
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const updated = new Map<string, number>();
    for (const [id, sec] of etaRef.current) {
      updated.set(id, sec - 1);
    }
    etaRef.current = updated;
    setEtaSecs(new Map(updated));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  useEffect(() => {
    loadStops();
    const iv = setInterval(loadStops, 15_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, batchId]);

  if (!stops.length) return null;

  const [next, ...upcoming] = stops;

  return (
    <div className="flex flex-col gap-3">
      {/* Next stop — prominent */}
      <div className="rounded-xl border-2 border-blue-400 bg-blue-50 p-3 shadow-sm">
        <div className="flex items-center gap-1.5 mb-2">
          <Navigation className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Nächster Stopp</span>
          <span className="ml-auto bg-blue-600 text-white text-xs font-bold rounded px-1.5 py-0.5">
            #{next.reihenfolge}
          </span>
        </div>

        {/* Address */}
        {next.order?.kunde_adresse && (
          <div className="flex items-start gap-1.5 mb-2">
            <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(next.order.kunde_adresse)}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-blue-800 leading-tight"
            >
              {next.order.kunde_adresse}
            </a>
          </div>
        )}

        {/* Customer + ETA row */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-700 truncate">{next.order?.kunde_name}</span>
          </div>
          {next.order?.kunde_telefon && (
            <a href={`tel:${next.order.kunde_telefon}`} className="flex items-center gap-1 text-xs text-blue-600">
              <Phone className="w-3.5 h-3.5" />
              Anrufen
            </a>
          )}
        </div>

        {/* ETA countdown */}
        {etaSecs.has(next.id) && (
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">ETA:</span>
            <span className={cn('text-sm font-bold tabular-nums', etaColor(etaSecs.get(next.id) ?? null))}>
              {etaSecs.get(next.id)! <= 0 ? 'Überfällig!' : secToLabel(etaSecs.get(next.id)!)}
            </span>
            {(etaSecs.get(next.id) ?? 0) < 0 && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            )}
          </div>
        )}

        {/* Items */}
        {(next.order?.items?.length ?? 0) > 0 && (
          <div className="flex items-start gap-1.5 mb-3">
            <Package className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <div className="text-xs text-gray-600 leading-relaxed">
              {next.order!.items.map((item, i) => (
                <span key={i}>{item.menge}× {item.name}{i < next.order!.items.length - 1 ? ', ' : ''}</span>
              ))}
            </div>
          </div>
        )}

        {/* Confirm button */}
        <button
          onClick={() => confirmDelivery(next.id)}
          disabled={confirming === next.id}
          className={cn(
            'w-full rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all',
            confirming === next.id
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white active:scale-95',
          )}
        >
          <CheckCircle2 className="w-4 h-4" />
          {confirming === next.id ? 'Bestätige...' : 'Lieferung bestätigen'}
        </button>
      </div>

      {/* Upcoming stops — compact */}
      {upcoming.map((stop, idx) => (
        <div key={stop.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-gray-700">{stop.reihenfolge}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-700 truncate">{stop.order?.kunde_adresse ?? stop.order?.kunde_name}</div>
            {etaSecs.has(stop.id) && (
              <div className={cn('text-xs font-bold tabular-nums', etaColor(etaSecs.get(stop.id) ?? null))}>
                ETA {secToLabel(Math.max(0, etaSecs.get(stop.id)!))}
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        </div>
      ))}
    </div>
  );
}
