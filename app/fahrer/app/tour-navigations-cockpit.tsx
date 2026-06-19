'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Navigation2, MapPin, CheckCircle2, Clock, ChevronRight,
  Phone, Package, AlertCircle, ArrowRight,
} from 'lucide-react';

interface TourStop {
  id: string;
  stopNumber: number;
  orderId: string;
  customerName: string;
  address: string;
  status: 'pending' | 'arrived' | 'delivered' | 'failed';
  etaMin: number | null;
  distanceKm: number | null;
  phone: string | null;
  notes: string | null;
  items: number;
}

interface TourNavigationsProps {
  driverId: string;
  batchId?: string | null;
}

const STATUS_STYLE = {
  pending:   { icon: Clock,        bg: 'bg-stone-50',    border: 'border-stone-200', text: 'text-stone-600',  label: 'Ausstehend' },
  arrived:   { icon: MapPin,       bg: 'bg-amber-50',    border: 'border-amber-200', text: 'text-amber-700',  label: 'Angekommen' },
  delivered: { icon: CheckCircle2, bg: 'bg-matcha-50',   border: 'border-matcha-200',text: 'text-matcha-700', label: 'Geliefert'  },
  failed:    { icon: AlertCircle,  bg: 'bg-red-50',      border: 'border-red-200',   text: 'text-red-700',    label: 'Fehlgeschl.'},
};

function openMapsNav(address: string) {
  const encoded = encodeURIComponent(address);
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    window.open(`maps://maps.apple.com/?daddr=${encoded}`);
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`);
  }
}

export function TourNavigationsCockpit({ driverId, batchId }: TourNavigationsProps) {
  const [stops, setStops] = useState<TourStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);

  const loadStops = useCallback(async () => {
    try {
      const supabase = createClient();
      const query = supabase
        .from('delivery_batch_stops')
        .select(`
          id, stop_number, order_id, status,
          eta_min, distance_km,
          customer_orders(
            kunde_name, kunde_telefon, kunde_adresse, kunde_notiz,
            order_items(menge)
          )
        `)
        .order('stop_number', { ascending: true })
        .limit(20);

      if (batchId) {
        query.eq('batch_id', batchId);
      } else {
        const { data: batch } = await supabase
          .from('delivery_batches')
          .select('id')
          .eq('driver_id', driverId)
          .in('status', ['active', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (batch?.id) query.eq('batch_id', batch.id);
        else { setStops([]); setLoading(false); return; }
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const mapped: TourStop[] = data.map((s: any) => ({
          id: s.id,
          stopNumber: s.stop_number ?? 0,
          orderId: s.order_id ?? '',
          customerName: s.customer_orders?.kunde_name ?? 'Kunde',
          address: s.customer_orders?.kunde_adresse ?? '',
          status: (['pending', 'arrived', 'delivered', 'failed'].includes(s.status) ? s.status : 'pending') as TourStop['status'],
          etaMin: s.eta_min ?? null,
          distanceKm: s.distance_km ?? null,
          phone: s.customer_orders?.kunde_telefon ?? null,
          notes: s.customer_orders?.kunde_notiz ?? null,
          items: Array.isArray(s.customer_orders?.order_items)
            ? s.customer_orders.order_items.reduce((acc: number, i: any) => acc + (i.menge ?? 1), 0)
            : 1,
        }));
        setStops(mapped);
      }
    } catch {
      // keep state
    } finally {
      setLoading(false);
    }
  }, [driverId, batchId]);

  useEffect(() => {
    loadStops();
    const supabase = createClient();
    const ch = supabase
      .channel(`tour-stops-nav-${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, loadStops)
      .subscribe();
    const poll = setInterval(loadStops, 30_000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [loadStops]);

  const nextStop = stops.find(s => s.status === 'pending' || s.status === 'arrived');
  const done = stops.filter(s => s.status === 'delivered').length;
  const total = stops.length;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-4 animate-pulse">
        <div className="h-4 w-40 bg-stone-100 rounded mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-stone-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (stops.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-5 text-center">
        <Navigation2 className="h-7 w-7 text-stone-300 mx-auto mb-2" />
        <div className="text-sm text-stone-500">Keine aktive Tour — warte auf Zuweisung.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-matcha-600 text-white flex items-center gap-2">
        <Navigation2 className="h-4 w-4 shrink-0" />
        <span className="text-sm font-bold">Tour-Navigation</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">
            {done}/{total} Stops
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-matcha-100">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
        />
      </div>

      {/* Next stop highlight */}
      {nextStop && (
        <div className="bg-matcha-50 border-b border-matcha-100 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600 mb-1.5">
            Nächster Stop
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-matcha-600 text-white font-black text-sm">
              {nextStop.stopNumber}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-stone-800 truncate">{nextStop.customerName}</div>
              <div className="text-xs text-stone-500 truncate">{nextStop.address || 'Adresse unbekannt'}</div>
              <div className="flex items-center gap-3 mt-1">
                {nextStop.etaMin !== null && (
                  <span className="text-[10px] font-bold text-matcha-700">~{nextStop.etaMin} min</span>
                )}
                {nextStop.distanceKm !== null && (
                  <span className="text-[10px] text-stone-400">{nextStop.distanceKm.toFixed(1)} km</span>
                )}
                <span className="text-[10px] text-stone-400">{nextStop.items} Artikel</span>
              </div>
            </div>
            <button
              onClick={() => nextStop.address && openMapsNav(nextStop.address)}
              className="shrink-0 flex items-center gap-1 rounded-xl bg-matcha-600 text-white text-xs font-bold px-3 py-2 active:bg-matcha-700 transition"
            >
              <Navigation2 className="h-3.5 w-3.5" />
              Nav
            </button>
          </div>
        </div>
      )}

      {/* All stops */}
      <div className="divide-y divide-stone-100">
        {stops.map(stop => {
          const st = STATUS_STYLE[stop.status];
          const StopIcon = st.icon;
          const isExpanded = expandedStop === stop.id;
          const isCurrent = stop.id === nextStop?.id;

          return (
            <div key={stop.id} className={cn('transition-colors', st.bg, isCurrent && 'ring-1 ring-inset ring-matcha-300')}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpandedStop(isExpanded ? null : stop.id)}
              >
                {/* Stop number */}
                <div className={cn(
                  'shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-black',
                  stop.status === 'delivered' ? 'bg-matcha-500 text-white' : stop.status === 'failed' ? 'bg-red-500 text-white' : isCurrent ? 'bg-matcha-600 text-white' : 'bg-stone-200 text-stone-600',
                )}>
                  {stop.status === 'delivered' ? <CheckCircle2 className="h-3.5 w-3.5" /> : stop.stopNumber}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold truncate', stop.status === 'delivered' ? 'text-stone-400 line-through' : 'text-stone-800')}>
                      {stop.customerName}
                    </span>
                    <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5 bg-white/70', st.text)}>
                      {st.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-400 truncate">{stop.address || '—'}</div>
                </div>

                {/* ETA / chevron */}
                <div className="shrink-0 flex items-center gap-1">
                  {stop.etaMin !== null && stop.status === 'pending' && (
                    <span className="text-[10px] font-bold text-stone-500 tabular-nums">{stop.etaMin}m</span>
                  )}
                  <ChevronRight className={cn('h-3.5 w-3.5 text-stone-300 transition-transform', isExpanded && 'rotate-90')} />
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-3 pt-0 space-y-2 border-t border-stone-100">
                  {stop.notes && (
                    <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{stop.notes}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {stop.phone && (
                      <a
                        href={`tel:${stop.phone}`}
                        className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1.5 text-[11px] font-bold text-stone-700 active:bg-stone-200"
                      >
                        <Phone className="h-3 w-3" /> {stop.phone}
                      </a>
                    )}
                    <button
                      onClick={() => stop.address && openMapsNav(stop.address)}
                      className="flex items-center gap-1.5 rounded-lg bg-matcha-100 px-2.5 py-1.5 text-[11px] font-bold text-matcha-700 active:bg-matcha-200"
                    >
                      <Navigation2 className="h-3 w-3" /> Navigieren
                    </button>
                    <span className="flex items-center gap-1 text-[10px] text-stone-400">
                      <Package className="h-3 w-3" /> {stop.items} Artikel
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
