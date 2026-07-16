'use client';

import { useEffect, useState } from 'react';
import { MapPin, Check, Clock } from 'lucide-react';

/**
 * Phase 2011 — Live-Tour-Stopp-Übersicht (Fahrer-App)
 *
 * Alle Stopps der aktuellen Tour in einer übersichtlichen Liste.
 * Nur sichtbar wenn batchId vorhanden. 30-Sek-Polling, isOnline-Guard.
 */

type StoppStatus = 'pending' | 'arrived' | 'delivered';

interface TourStopp {
  reihenfolge: number;
  adresse: string;
  kunde_name: string;
  status: StoppStatus;
  eta_min: number | null;
}

interface Props {
  driverId: string;
  batchId: string | null;
  isOnline: boolean;
}

const MOCK_STOPPS: TourStopp[] = [
  { reihenfolge: 1, adresse: 'Musterstraße 12, 52062 Aachen', kunde_name: 'Maria Schmidt', status: 'delivered', eta_min: null },
  { reihenfolge: 2, adresse: 'Adalbertsteinweg 44, 52070 Aachen', kunde_name: 'Jonas Weber', status: 'arrived', eta_min: 3 },
  { reihenfolge: 3, adresse: 'Jülicher Straße 15, 52068 Aachen', kunde_name: 'Sophie Müller', status: 'pending', eta_min: 14 },
];

function statusConfig(status: StoppStatus): { bg: string; icon: JSX.Element; label: string } {
  if (status === 'delivered') {
    return {
      bg: 'bg-matcha-500',
      icon: <Check className="h-3.5 w-3.5 text-white" />,
      label: 'Geliefert',
    };
  }
  if (status === 'arrived') {
    return {
      bg: 'bg-amber-400',
      icon: <MapPin className="h-3.5 w-3.5 text-white" />,
      label: 'Vor Ort',
    };
  }
  return {
    bg: 'bg-slate-300 dark:bg-slate-600',
    icon: <Clock className="h-3.5 w-3.5 text-white" />,
    label: 'Ausstehend',
  };
}

export function FahrerPhase2011LiveTourStoppUebersicht({ driverId, batchId, isOnline }: Props) {
  const [stopps, setStopps] = useState<TourStopp[] | null>(null);

  useEffect(() => {
    if (!isOnline || !batchId) return;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/driver/tour-stops?driver_id=${encodeURIComponent(driverId)}&batch_id=${encodeURIComponent(batchId!)}`
        );
        if (res.ok) {
          const data: TourStopp[] = await res.json();
          setStopps(data);
        }
      } catch {
        setStopps(MOCK_STOPPS);
      }
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [driverId, batchId, isOnline]);

  if (!batchId || !stopps) return null;

  const total = stopps.length;
  const done = stopps.filter(s => s.status === 'delivered').length;

  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden border shadow-lg bg-gradient-to-br from-matcha-50 to-emerald-50 dark:from-matcha-950/40 dark:to-emerald-950/40 border-matcha-200 dark:border-matcha-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-matcha-500 to-emerald-500 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <span className="font-bold text-sm">Tour-Übersicht</span>
          </div>
          <span className="text-xs text-white/90 font-medium">{done}/{total} geliefert</span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-white/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-0">
          {stopps.map((stopp, idx) => {
            const cfg = statusConfig(stopp.status);
            const isLast = idx === stopps.length - 1;

            return (
              <div key={stopp.reihenfolge} className="flex gap-3">
                {/* Timeline column */}
                <div className="flex flex-col items-center">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center shadow-sm ${cfg.bg}`}>
                    {cfg.icon}
                  </div>
                  {!isLast && (
                    <div className="w-px flex-1 bg-border my-1" style={{ minHeight: 20 }} />
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-4'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{stopp.kunde_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{stopp.adresse}</div>
                    </div>
                    <div className="shrink-0 text-xs font-medium">
                      {stopp.status === 'delivered' ? (
                        <span className="text-matcha-600 dark:text-matcha-400">Geliefert</span>
                      ) : stopp.eta_min != null ? (
                        <span className="flex items-center gap-0.5 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {stopp.eta_min} Min
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
