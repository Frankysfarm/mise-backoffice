'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowRight, CheckCircle2, Clock, MapPin, Navigation2,
  Package, Phone, Star, Timer,
} from 'lucide-react';

/* ── Typen ──────────────────────────────────────────────────────────────── */
interface TourStop {
  id: string;
  index: number;
  status: 'ausstehend' | 'aktuell' | 'abgeschlossen';
  adresse: string;
  kundeName: string;
  kundePhone: string | null;
  etaMin: number | null;
  distanceM: number | null;
  hinweis: string | null;
  bestellNummer: string;
  betrag: number | null;
  kasseOffen: boolean;
}

interface TourState {
  batchId: string;
  fahrerName: string;
  gesamtStopps: number;
  aktuellerStoppIdx: number;
  stops: TourStop[];
  startedAt: Date;
}

/* ── Navi-Link-Generator ────────────────────────────────────────────────── */
function buildNaviUrl(adresse: string): string {
  const encoded = encodeURIComponent(adresse);
  if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return `maps://?daddr=${encoded}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
}

/* ── Stop-Karte ─────────────────────────────────────────────────────────── */
function StopCard({ stop, isCurrent }: { stop: TourStop; isCurrent: boolean }) {
  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all',
      isCurrent
        ? 'border-matcha-400 shadow-md shadow-matcha-100'
        : 'border-border bg-muted/30 opacity-75',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5',
        isCurrent ? 'bg-matcha-600 text-white' : 'bg-muted/50 text-muted-foreground',
      )}>
        <div className={cn(
          'h-6 w-6 rounded-full flex items-center justify-center text-xs font-black shrink-0',
          isCurrent ? 'bg-white text-matcha-700' : 'bg-muted-foreground/20 text-muted-foreground',
        )}>
          {stop.index + 1}
        </div>
        <span className="text-xs font-bold truncate flex-1">
          {isCurrent ? 'Aktueller Stopp' : `Stopp ${stop.index + 1}`}
        </span>
        {stop.etaMin !== null && (
          <div className="flex items-center gap-1 shrink-0">
            <Timer className="h-3 w-3" />
            <span className="text-xs font-black tabular-nums">{stop.etaMin} Min</span>
          </div>
        )}
        {stop.status === 'abgeschlossen' && (
          <CheckCircle2 className="h-4 w-4 text-green-400" />
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2 bg-white">
        {/* Adresse + Navi */}
        <div className="flex items-start gap-2">
          <MapPin className={cn('h-4 w-4 shrink-0 mt-0.5', isCurrent ? 'text-matcha-600' : 'text-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold leading-tight">{stop.adresse}</div>
            <div className="text-xs text-muted-foreground">{stop.kundeName}</div>
            {stop.distanceM !== null && (
              <div className="text-[10px] text-muted-foreground">
                {stop.distanceM >= 1000
                  ? `${(stop.distanceM / 1000).toFixed(1)} km`
                  : `${stop.distanceM} m`}
              </div>
            )}
          </div>
          {isCurrent && (
            <a
              href={buildNaviUrl(stop.adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-matcha-600 text-white px-3 py-2 text-xs font-bold active:scale-95 transition-transform"
            >
              <Navigation2 className="h-3.5 w-3.5" />
              Navi
            </a>
          )}
        </div>

        {/* Bestelldetails */}
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            <span>#{stop.bestellNummer}</span>
          </div>
          {stop.betrag !== null && (
            <div className="flex items-center gap-1 font-bold text-foreground">
              <span>€{stop.betrag.toFixed(2)}</span>
              {stop.kasseOffen && (
                <span className="rounded bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[9px] font-black">BAR</span>
              )}
            </div>
          )}
          {stop.kundePhone && isCurrent && (
            <a
              href={`tel:${stop.kundePhone}`}
              className="flex items-center gap-1 text-matcha-600 font-bold"
            >
              <Phone className="h-3 w-3" />
              {stop.kundePhone}
            </a>
          )}
        </div>

        {/* Hinweis */}
        {stop.hinweis && isCurrent && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            ⚠ {stop.hinweis}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function Phase2100TourStopNavigatorMaster({
  driverId,
}: {
  driverId?: string | null;
}) {
  const [tour, setTour] = useState<TourState | null>(null);
  const [loading, setLoading] = useState(true);
  const supaRef = useRef(createClient());

  useEffect(() => {
    if (!driverId) { setLoading(false); return; }
    const supa = supaRef.current;

    async function load() {
      /* Aktives Batch des Fahrers */
      const { data: batch } = await supa
        .from('delivery_batches')
        .select('id,driver_id,started_at,status')
        .eq('driver_id', driverId)
        .in('status', ['unterwegs', 'abgeholt'])
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (!batch) { setTour(null); setLoading(false); return; }

      /* Stopps laden */
      const { data: rawStops } = await supa
        .from('delivery_stops')
        .select('id,stop_index,status,address,customer_name,customer_phone,eta_min,distance_m,notes,order_id')
        .eq('batch_id', batch.id)
        .order('stop_index', { ascending: true });

      if (!rawStops || rawStops.length === 0) { setTour(null); setLoading(false); return; }

      /* Bestellungen laden */
      const orderIds = rawStops.map((s: { order_id: string }) => s.order_id).filter(Boolean);
      const { data: orders } = await supa
        .from('orders')
        .select('id,order_number,total_price,payment_method')
        .in('id', orderIds);

      const orderMap = new Map<string, { number: string; total: number; paymentMethod: string }>(
        (orders ?? []).map((o: { id: string; order_number: string; total_price: number; payment_method: string }) => [o.id, { number: o.order_number, total: o.total_price, paymentMethod: o.payment_method }]),
      );

      const stops: TourStop[] = rawStops.map((s: {
        id: string;
        stop_index: number;
        status: string;
        address: string;
        customer_name: string;
        customer_phone: string | null;
        eta_min: number | null;
        distance_m: number | null;
        notes: string | null;
        order_id: string;
      }) => {
        const ord = orderMap.get(s.order_id);
        return {
          id: s.id,
          index: s.stop_index,
          status: (s.status as TourStop['status']),
          adresse: s.address ?? '',
          kundeName: s.customer_name ?? 'Kunde',
          kundePhone: s.customer_phone ?? null,
          etaMin: s.eta_min ?? null,
          distanceM: s.distance_m ?? null,
          hinweis: s.notes ?? null,
          bestellNummer: ord?.number ?? s.order_id.slice(0, 6).toUpperCase(),
          betrag: ord?.total ?? null,
          kasseOffen: ord?.paymentMethod === 'bar',
        };
      });

      const aktIdx = stops.findIndex(s => s.status === 'aktuell');

      setTour({
        batchId: batch.id,
        fahrerName: 'Fahrer',
        gesamtStopps: stops.length,
        aktuellerStoppIdx: aktIdx >= 0 ? aktIdx : 0,
        stops,
        startedAt: new Date(batch.started_at),
      });
      setLoading(false);
    }

    load();
    const ch = supa
      .channel(`fahrer-stops-${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_stops' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches', filter: `driver_id=eq.${driverId}` }, load)
      .subscribe();

    return () => { supa.removeChannel(ch); };
  }, [driverId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Clock className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Lade Tour…</span>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="rounded-2xl border bg-muted/30 flex flex-col items-center gap-3 py-10 px-4 text-center">
        <Star className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-bold text-muted-foreground">Keine aktive Tour</p>
        <p className="text-xs text-muted-foreground">Warte auf Dispatch-Zuweisung…</p>
      </div>
    );
  }

  const donePct = Math.round((tour.stops.filter(s => s.status === 'abgeschlossen').length / tour.gesamtStopps) * 100);
  const aktuellerStop = tour.stops.find(s => s.status === 'aktuell') ?? tour.stops[tour.aktuellerStoppIdx];
  const naechsterStop = aktuellerStop
    ? tour.stops.find(s => s.index === aktuellerStop.index + 1)
    : null;
  const restStopps = tour.stops.filter(s => s.status !== 'abgeschlossen').length;

  return (
    <div className="space-y-3">
      {/* Fortschritts-Header */}
      <div className="rounded-2xl border bg-matcha-50 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-matcha-800">Tour-Fortschritt</div>
            <div className="text-[11px] text-matcha-600">
              {tour.gesamtStopps - restStopps} von {tour.gesamtStopps} Stopps abgeschlossen
            </div>
          </div>
          <div className="text-2xl font-black text-matcha-700 tabular-nums">{donePct}%</div>
        </div>
        <div className="h-2 rounded-full bg-matcha-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-600 transition-all duration-700"
            style={{ width: `${donePct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-matcha-600">
          <Package className="h-3 w-3" />
          <span>{restStopps} Stopp{restStopps !== 1 ? 's' : ''} verbleibend</span>
        </div>
      </div>

      {/* Aktueller Stopp */}
      {aktuellerStop && <StopCard stop={aktuellerStop} isCurrent />}

      {/* Nächster Stopp (Vorschau) */}
      {naechsterStop && (
        <div>
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Nächster Stopp
            </span>
          </div>
          <StopCard stop={naechsterStop} isCurrent={false} />
        </div>
      )}

      {/* Alle verbleibenden Stopps (kompakt) */}
      {tour.stops.filter(s => s.status === 'ausstehend' && s.id !== naechsterStop?.id).length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-2 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b">
            Weitere Stopps
          </div>
          <div className="divide-y">
            {tour.stops
              .filter(s => s.status === 'ausstehend' && s.id !== naechsterStop?.id)
              .map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground shrink-0">
                    {s.index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{s.kundeName}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{s.adresse}</div>
                  </div>
                  {s.etaMin !== null && (
                    <span className="text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">~{s.etaMin}m</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
