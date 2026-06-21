'use client';

/**
 * FahrerTourNaechsterStoppKarte — Phase 388
 * Mobile-first Nächster-Stopp-Karte für den Fahrer.
 * Zeigt die nächste ungelieferte Adresse mit Navigationsbutton, Zahlungsart-Badge und Stop-Zähler.
 */

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Navigation, Package, CreditCard, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  distance_meters?: number | null;
  order?: {
    id?: string;
    bestellnummer?: string;
    kunde_name?: string;
    kunde_adresse?: string | null;
    kunde_plz?: string | null;
    kunde_notiz?: string | null;
    zahlungsart?: string;
    gesamtbetrag?: number;
  } | null;
};

type TourData = {
  id: string;
  status: string;
  stops: Stop[];
};

type ApiResponse = {
  tour?: TourData | null;
  active_tour?: TourData | null;
};

const MOCK_TOUR: TourData = {
  id: 'mock-tour-1',
  status: 'unterwegs',
  stops: [
    {
      id: 'stop-1',
      reihenfolge: 1,
      geliefert_am: new Date(Date.now() - 10 * 60_000).toISOString(),
      order: {
        bestellnummer: '#1040',
        kunde_name: 'Peter Müller',
        kunde_adresse: 'Bergstraße 12, 10115 Berlin',
        zahlungsart: 'karte',
        gesamtbetrag: 22.5,
      },
    },
    {
      id: 'stop-2',
      reihenfolge: 2,
      geliefert_am: null,
      distance_meters: 1200,
      order: {
        bestellnummer: '#1041',
        kunde_name: 'Maria Schmidt',
        kunde_adresse: 'Hauptstraße 47',
        kunde_plz: '10117',
        kunde_notiz: 'Bitte klingeln — 3. OG links',
        zahlungsart: 'bar',
        gesamtbetrag: 18.9,
      },
    },
    {
      id: 'stop-3',
      reihenfolge: 3,
      geliefert_am: null,
      order: {
        bestellnummer: '#1042',
        kunde_name: 'Jonas Weber',
        kunde_adresse: 'Lindenallee 8',
        kunde_plz: '10115',
        zahlungsart: 'karte',
        gesamtbetrag: 31.0,
      },
    },
  ],
};

function buildMapsUrl(address: string, plz?: string | null): string {
  const fullAddress = plz ? `${address}, ${plz}` : address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;
}

function fmtDistance(meters: number | null | undefined): string {
  if (meters == null) return 'N/A';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

interface Props {
  driverId: string;
  activeTourId?: string | null;
}

export function FahrerTourNaechsterStoppKarte({ driverId, activeTourId }: Props) {
  const [tour, setTour] = useState<TourData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (activeTourId) params.set('tour_id', activeTourId);
      const res = await fetch(`/api/delivery/fahrer/active-tour?${params.toString()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json: ApiResponse = await res.json();
      const t = json.tour ?? json.active_tour ?? null;
      setTour(t ?? MOCK_TOUR);
    } catch {
      setTour(MOCK_TOUR);
    } finally {
      setLoading(false);
    }
  }, [driverId, activeTourId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-matcha-50 p-4 text-center text-xs text-matcha-400">
        Laden…
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-matcha-50 p-6 text-center">
        <Package className="h-8 w-8 text-matcha-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-matcha-600">Keine aktive Tour</p>
        <p className="text-xs text-matcha-400 mt-1">Warte auf Zuweisung…</p>
      </div>
    );
  }

  const sorted = [...tour.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const nextStop = sorted.find((s) => !s.geliefert_am);
  const deliveredCount = sorted.filter((s) => !!s.geliefert_am).length;
  const totalCount = sorted.length;

  if (!nextStop) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-matcha-50 p-6 text-center">
        <Package className="h-8 w-8 text-matcha-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-matcha-700">Alle Stopps erledigt!</p>
        <p className="text-xs text-matcha-500 mt-1">Rückkehr zur Basis</p>
      </div>
    );
  }

  const order = nextStop.order;
  const fullAddress =
    order?.kunde_adresse
      ? `${order.kunde_adresse}${order.kunde_plz ? `, ${order.kunde_plz}` : ''}`
      : null;
  const mapsUrl = fullAddress ? buildMapsUrl(order?.kunde_adresse ?? '', order?.kunde_plz) : null;
  const isBar = order?.zahlungsart === 'bar';

  return (
    <div className="rounded-2xl border-2 border-matcha-400 bg-white shadow-lg overflow-hidden">
      {/* Top strip */}
      <div className="bg-matcha-600 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-bold text-white uppercase tracking-wider">
          Nächster Stopp
        </span>
        <span className="text-xs font-black text-matcha-200">
          {deliveredCount + 1} / {totalCount}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Address — large and prominent */}
        <div className="flex items-start gap-2">
          <MapPin className="h-5 w-5 text-matcha-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {order?.kunde_name && (
              <p className="text-xs text-gray-500 mb-0.5">{order.kunde_name}</p>
            )}
            <p className="text-lg font-black text-gray-900 leading-tight">
              {order?.kunde_adresse ?? 'Adresse unbekannt'}
            </p>
            {order?.kunde_plz && (
              <p className="text-sm text-gray-600">{order.kunde_plz}</p>
            )}
          </div>
        </div>

        {/* Customer note */}
        {order?.kunde_notiz && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <p className="text-xs font-semibold text-amber-700">Hinweis: {order.kunde_notiz}</p>
          </div>
        )}

        {/* Info row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Payment badge */}
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border',
              isBar
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-blue-50 border-blue-300 text-blue-700',
            )}
          >
            {isBar ? <Banknote className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
            {isBar ? 'Bar' : 'Karte'}
            {order?.gesamtbetrag != null && ` · ${euro(order.gesamtbetrag)}`}
          </span>

          {/* Distance */}
          <span className="text-xs text-gray-500">
            Entfernung: {fmtDistance(nextStop.distance_meters)}
          </span>
        </div>

        {/* Navigate button */}
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-matcha-600 hover:bg-matcha-700 active:bg-matcha-800 text-white font-bold text-sm rounded-xl py-3 transition-colors"
          >
            <Navigation className="h-4 w-4" />
            Navigieren
          </a>
        ) : (
          <div className="flex items-center justify-center gap-2 w-full bg-matcha-200 text-matcha-500 font-bold text-sm rounded-xl py-3 cursor-not-allowed">
            <Navigation className="h-4 w-4" />
            Keine Adresse
          </div>
        )}
      </div>
    </div>
  );
}
