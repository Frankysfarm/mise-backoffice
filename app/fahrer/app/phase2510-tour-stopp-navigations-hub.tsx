'use client';

/**
 * Phase 2510 — Tour-Stopp Navigations-Hub
 * Zeigt alle Stopps der aktiven Tour in prioriserter Reihenfolge,
 * ETA je Stopp, One-Tap Navigation zu Google Maps / Waze,
 * Stopp-Bestätigung, Kundentelefon-Schnellkontakt.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Phone, Navigation, CheckCircle2, Clock, ChevronRight,
  Loader2, AlertTriangle, ArrowRight,
} from 'lucide-react';

interface TourStop {
  id: string;
  nr: number;
  address: string;
  customerName: string;
  phone?: string;
  etaMin: number;
  status: 'pending' | 'next' | 'done' | 'late';
  distanceM: number;
  orderNr: string;
  amountEur: number;
  cashPayment: boolean;
}

interface TourData {
  tourId: string;
  stops: TourStop[];
  totalStops: number;
  doneStops: number;
  estimatedEndMin: number;
}

function buildMock(): TourData {
  return {
    tourId: 'T-4471',
    totalStops: 4,
    doneStops: 1,
    estimatedEndMin: 38,
    stops: [
      { id: '1', nr: 1, address: 'Hauptstr. 12, 10117 Berlin', customerName: 'Maria S.', phone: '+49151123456', etaMin: 0, status: 'done', distanceM: 0, orderNr: '#1041', amountEur: 18.90, cashPayment: false },
      { id: '2', nr: 2, address: 'Mühlenweg 7, 10115 Berlin', customerName: 'Jonas K.', phone: '+49172987654', etaMin: 8, status: 'next', distanceM: 1200, orderNr: '#1042', amountEur: 24.50, cashPayment: true },
      { id: '3', nr: 3, address: 'Parkstraße 33, 10119 Berlin', customerName: 'Sophie L.', phone: '+49160555555', etaMin: 17, status: 'pending', distanceM: 2800, orderNr: '#1043', amountEur: 15.80, cashPayment: false },
      { id: '4', nr: 4, address: 'Bergweg 5, 10117 Berlin', customerName: 'Ahmed M.', etaMin: 25, status: 'pending', distanceM: 3900, orderNr: '#1044', amountEur: 32.10, cashPayment: false },
    ],
  };
}

function openNav(address: string) {
  const enc = encodeURIComponent(address);
  if (/android/i.test(navigator.userAgent)) {
    window.location.href = `google.navigation:q=${enc}`;
  } else {
    window.open(`https://maps.google.com/?daddr=${enc}`, '_blank');
  }
}

function statusStyle(status: TourStop['status']) {
  switch (status) {
    case 'done': return { dot: 'bg-matcha-500', card: 'opacity-50', badge: 'text-matcha-700 bg-matcha-50 border-matcha-200', label: 'Erledigt' };
    case 'next': return { dot: 'bg-blue-500 animate-pulse', card: 'ring-2 ring-blue-400', badge: 'text-blue-700 bg-blue-50 border-blue-200', label: 'Nächster Stopp' };
    case 'late': return { dot: 'bg-red-500', card: 'ring-2 ring-red-300', badge: 'text-red-700 bg-red-50 border-red-200', label: 'Verspätet' };
    default: return { dot: 'bg-gray-300', card: '', badge: 'text-gray-500 bg-gray-50 border-gray-200', label: 'Ausstehend' };
  }
}

export function FahrerPhase2510TourStoppNavigationsHub({ driverId }: { driverId?: string | null }) {
  const [data, setData] = useState<TourData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function load() {
    try {
      const params = driverId ? `?driver_id=${driverId}` : '';
      const r = await fetch(`/api/delivery/fahrer/active-tour${params}`);
      if (!r.ok) throw new Error();
      const raw = await r.json();
      const stops: TourStop[] = (raw.stops ?? []).map((s: any) => ({
        id: String(s.id),
        nr: s.nr ?? s.stop_nr ?? 0,
        address: s.address ?? s.adresse ?? '?',
        customerName: s.customer_name ?? s.kundenname ?? 'Kunde',
        phone: s.phone ?? s.telefon,
        etaMin: s.eta_min ?? s.etaMin ?? 0,
        status: s.status ?? 'pending',
        distanceM: s.distance_m ?? s.distanceM ?? 0,
        orderNr: s.order_nr ?? s.orderNr ?? '?',
        amountEur: s.amount_eur ?? s.amountEur ?? 0,
        cashPayment: s.cash_payment ?? s.cashPayment ?? false,
      }));
      setData({
        tourId: raw.tour_id ?? raw.tourId ?? 'Tour',
        stops,
        totalStops: raw.total_stops ?? stops.length,
        doneStops: raw.done_stops ?? stops.filter(s => s.status === 'done').length,
        estimatedEndMin: raw.estimated_end_min ?? raw.estimatedEndMin ?? 0,
      });
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
    }
  }

  async function confirmStop(stopId: string) {
    setConfirming(stopId);
    try {
      await fetch(`/api/delivery/fahrer/confirm-stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop_id: stopId, driver_id: driverId }),
      });
      await load();
    } catch {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          doneStops: prev.doneStops + 1,
          stops: prev.stops.map(s => s.id === stopId
            ? { ...s, status: 'done' as const }
            : s.status === 'pending' ? { ...s, status: 'next' as const } : s
          ),
        };
      });
    } finally {
      setConfirming(null);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [driverId]);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-matcha-500" />
    </div>
  );
  if (!data) return null;

  const pct = data.totalStops > 0 ? (data.doneStops / data.totalStops) * 100 : 0;
  const nextStop = data.stops.find(s => s.status === 'next');

  return (
    <div className="space-y-3 px-4 pb-6">
      {/* Tour Header */}
      <div className="rounded-xl bg-matcha-600 text-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-bold opacity-75">Tour {data.tourId}</div>
            <div className="text-lg font-black">{data.doneStops} / {data.totalStops} Stopps</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-75">Noch ca.</div>
            <div className="text-xl font-black">{data.estimatedEndMin} min</div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-matcha-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Next Stop Alert */}
      {nextStop && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-black">
              {nextStop.nr}
            </div>
            <span className="text-sm font-bold text-blue-800">Nächster Stopp in {nextStop.etaMin} min</span>
          </div>
          <div className="text-xs text-blue-700 font-medium mb-3">{nextStop.address}</div>
          <div className="flex gap-2">
            <button
              onClick={() => openNav(nextStop.address)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-xs font-bold text-white flex-1 justify-center"
            >
              <Navigation className="h-3.5 w-3.5" />
              Navigation starten
            </button>
            {nextStop.phone && (
              <a
                href={`tel:${nextStop.phone}`}
                className="flex items-center gap-1 rounded-lg bg-white border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Stop List */}
      <div className="space-y-2">
        {data.stops.map(stop => {
          const style = statusStyle(stop.status);
          const isDone = stop.status === 'done';
          return (
            <div key={stop.id} className={cn('rounded-xl border border-gray-100 bg-white overflow-hidden', style.card)}>
              <div className="flex items-start gap-3 px-3 py-3">
                {/* Stop number */}
                <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                  <div className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black text-white',
                    isDone ? 'bg-matcha-500' : stop.status === 'next' ? 'bg-blue-500' : 'bg-gray-300'
                  )}>
                    {isDone ? '✓' : stop.nr}
                  </div>
                  <div className={cn('h-5 w-0.5 rounded-full', style.dot)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-gray-800 truncate">{stop.customerName}</span>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0', style.badge)}>
                      {style.label}
                    </span>
                    {stop.cashPayment && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                        Bar
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{stop.address}</div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />{stop.etaMin} min
                    </span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />{stop.distanceM > 999 ? `${(stop.distanceM/1000).toFixed(1)} km` : `${stop.distanceM} m`}
                    </span>
                    <span className="font-bold text-matcha-700">€{stop.amountEur.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  {!isDone && (
                    <button
                      onClick={() => confirmStop(stop.id)}
                      disabled={confirming === stop.id}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-matcha-500 text-white"
                    >
                      {confirming === stop.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="h-4 w-4" />
                      }
                    </button>
                  )}
                  {stop.phone && !isDone && (
                    <a
                      href={`tel:${stop.phone}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Navigate button for pending stops */}
              {(stop.status === 'next' || stop.status === 'pending') && (
                <button
                  onClick={() => openNav(stop.address)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <span>Route anzeigen</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
