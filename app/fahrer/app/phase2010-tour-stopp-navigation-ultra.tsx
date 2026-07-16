'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation, Phone, CheckCircle2, Clock } from 'lucide-react';

/**
 * Phase 2010 — Tour-Stopp-Navigation Ultra (Fahrer-App)
 *
 * Ultra-Navigation für den nächsten Stopp: Adresse, ETA, Kundeninfos, Navi-Links.
 * Nur sichtbar wenn batchId vorhanden. 30-Sek-Polling, isOnline-Guard.
 */

interface CurrentStop {
  order_id: string;
  reihenfolge: number;
  adresse: string;
  kunde_name: string;
  eta_min: number;
  notiz: string | null;
  telefon: string | null;
  lat: number | null;
  lng: number | null;
}

interface Props {
  driverId: string;
  batchId: string | null;
  isOnline: boolean;
}

const MOCK_STOP: CurrentStop = {
  order_id: 'order-demo-001',
  reihenfolge: 1,
  adresse: 'Musterstraße 12, 52062 Aachen',
  kunde_name: 'Maria Schmidt',
  eta_min: 8,
  notiz: 'Klingel 2. OG',
  telefon: '+4917612345678',
  lat: 50.77,
  lng: 6.08,
};

export function FahrerPhase2010TourStoppNavigationUltra({ driverId, batchId, isOnline }: Props) {
  const [stop, setStop] = useState<CurrentStop | null>(null);
  const [arriving, setArriving] = useState(false);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    if (!isOnline || !batchId) return;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/driver/current-stop?driver_id=${encodeURIComponent(driverId)}`
        );
        if (res.ok) {
          const data: CurrentStop = await res.json();
          setStop(data);
        }
      } catch {
        setStop(MOCK_STOP);
      }
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [driverId, batchId, isOnline]);

  if (!batchId || !stop) return null;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.adresse)}`;
  const telUrl = stop.telefon ? `tel:${stop.telefon}` : null;

  async function handleArrived() {
    if (arriving || arrived) return;
    setArriving(true);
    try {
      await fetch('/api/delivery/driver/arrive-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, order_id: stop!.order_id }),
      });
      setArrived(true);
    } catch {
      // ignore — user can retry
    } finally {
      setArriving(false);
    }
  }

  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden border shadow-lg bg-gradient-to-br from-matcha-50 to-emerald-50 dark:from-matcha-950/40 dark:to-emerald-950/40 border-matcha-200 dark:border-matcha-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-matcha-500 to-emerald-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          <span className="font-bold text-sm">Ultra-Navigation</span>
          <span className="ml-auto flex items-center gap-1 text-white/90 text-xs">
            <Clock className="h-3.5 w-3.5" />
            {stop.eta_min} Min
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stop number + Customer */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-11 h-11 rounded-full bg-matcha-500 text-white flex items-center justify-center font-bold text-lg shadow">
            {stop.reihenfolge}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base leading-tight truncate">{stop.kunde_name}</div>
            <div className="flex items-start gap-1 mt-0.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-matcha-500" />
              <span className="leading-snug">{stop.adresse}</span>
            </div>
          </div>
        </div>

        {/* ETA Banner */}
        <div className="rounded-xl bg-white/70 dark:bg-white/5 flex items-center justify-center gap-3 py-3">
          <Clock className="h-5 w-5 text-matcha-500" />
          <span className="text-3xl font-bold text-matcha-700 dark:text-matcha-400">{stop.eta_min}</span>
          <span className="text-sm text-muted-foreground font-medium">Minuten ETA</span>
        </div>

        {/* Notes */}
        {stop.notiz && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">Hinweis: </span>{stop.notiz}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold py-3 text-sm transition-colors"
          >
            <Navigation className="h-4 w-4" />
            Google Maps
          </a>
          {telUrl ? (
            <a
              href={telUrl}
              className="flex items-center justify-center gap-2 rounded-xl bg-matcha-500 hover:bg-matcha-600 active:bg-matcha-700 text-white font-semibold py-3 text-sm transition-colors"
            >
              <Phone className="h-4 w-4" />
              Anrufen
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-400 font-semibold py-3 text-sm cursor-not-allowed">
              <Phone className="h-4 w-4" />
              Kein Telefon
            </div>
          )}
        </div>

        {/* Arrived Button */}
        <button
          onClick={handleArrived}
          disabled={arriving || arrived}
          className={`w-full flex items-center justify-center gap-2 rounded-xl font-bold py-4 text-base transition-colors ${
            arrived
              ? 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-400 cursor-default'
              : 'bg-gradient-to-r from-matcha-500 to-emerald-500 hover:from-matcha-600 hover:to-emerald-600 active:opacity-90 text-white shadow'
          }`}
        >
          <CheckCircle2 className="h-5 w-5" />
          {arrived ? 'Angekommen ✓' : arriving ? 'Wird gespeichert…' : 'Angekommen'}
        </button>
      </div>
    </div>
  );
}
