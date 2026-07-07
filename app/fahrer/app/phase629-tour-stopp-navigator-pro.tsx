'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MapPin, CheckCircle2, Circle, Navigation, Clock, Package } from 'lucide-react';

interface Props {
  driverId: string;
  batchId: string | null;
}

interface Stop {
  id: string;
  stop_number: number;
  status: string;
  address?: string | null;
  order_number?: string | null;
  estimated_arrival_at?: string | null;
  customer_name?: string | null;
}

function minsUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

const MOCK_STOPS: Stop[] = [
  {
    id: 's1',
    stop_number: 1,
    status: 'delivered',
    address: 'Musterstr. 5, Köln',
    order_number: '4821',
    estimated_arrival_at: null,
    customer_name: 'Sabine K.',
  },
  {
    id: 's2',
    stop_number: 2,
    status: 'pending',
    address: 'Hauptplatz 12, Köln',
    order_number: '4822',
    estimated_arrival_at: new Date(Date.now() + 7 * 60_000).toISOString(),
    customer_name: 'Marcus H.',
  },
  {
    id: 's3',
    stop_number: 3,
    status: 'pending',
    address: 'Ringstr. 88, Köln',
    order_number: '4823',
    estimated_arrival_at: new Date(Date.now() + 18 * 60_000).toISOString(),
    customer_name: 'Julia W.',
  },
];

export function FahrerPhase629TourStoppNavigatorPro({ driverId, batchId }: Props) {
  const [stops, setStops] = useState<Stop[]>(MOCK_STOPS);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  if (!batchId) return null;

  const sorted = [...stops].sort((a, b) => a.stop_number - b.stop_number);
  const completed = sorted.filter((s) => ['delivered', 'geliefert', 'abgeholt', 'completed'].includes(s.status));
  const pending = sorted.filter((s) => !['delivered', 'geliefert', 'abgeholt', 'completed'].includes(s.status));
  const nextStop = pending[0] ?? null;

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-bold text-blue-800 dark:text-blue-200 uppercase tracking-wide">
          Tour-Navigator Pro
        </span>
        <span className="ml-auto text-xs font-semibold text-blue-600 dark:text-blue-400">
          {completed.length}/{sorted.length} erledigt
        </span>
      </div>

      <div className="mb-3 h-2 rounded-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all duration-700"
          style={{ width: `${sorted.length > 0 ? (completed.length / sorted.length) * 100 : 0}%` }}
        />
      </div>

      {nextStop && (
        <div className="mb-3 rounded-xl border-2 border-blue-400 dark:border-blue-600 bg-white dark:bg-gray-900/60 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60">
              <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  Nächster Stop
                </span>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
                  #{nextStop.order_number}
                </span>
              </div>
              {nextStop.customer_name && (
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">
                  {nextStop.customer_name}
                </p>
              )}
              {nextStop.address && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {nextStop.address}
                </p>
              )}
              {minsUntil(nextStop.estimated_arrival_at) !== null && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {minsUntil(nextStop.estimated_arrival_at)! <= 0
                      ? 'Ankunft jetzt'
                      : `~${minsUntil(nextStop.estimated_arrival_at)} Min bis Ankunft`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {sorted.map((stop) => {
          const isDone = ['delivered', 'geliefert', 'abgeholt', 'completed'].includes(stop.status);
          const isCurrent = nextStop?.id === stop.id;

          return (
            <div
              key={stop.id}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                isCurrent
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : isDone
                  ? 'opacity-50'
                  : 'bg-white/50 dark:bg-gray-900/20'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-matcha-500" />
              ) : isCurrent ? (
                <MapPin className="h-4 w-4 shrink-0 text-blue-500 animate-pulse" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
              )}
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Stop {stop.stop_number}
              </span>
              {stop.order_number && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  #{stop.order_number}
                </span>
              )}
              {stop.address && (
                <span className="flex-1 text-xs text-gray-400 dark:text-gray-500 truncate">
                  {stop.address}
                </span>
              )}
              {!isDone && minsUntil(stop.estimated_arrival_at) !== null && (
                <span className="shrink-0 text-[10px] font-semibold text-blue-500 dark:text-blue-400 tabular-nums">
                  ~{minsUntil(stop.estimated_arrival_at)} Min
                </span>
              )}
            </div>
          );
        })}
      </div>

      {pending.length === 0 && (
        <div className="mt-3 rounded-lg bg-matcha-100 dark:bg-matcha-900/40 p-3 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-matcha-600 dark:text-matcha-400" />
          <p className="mt-1 text-sm font-bold text-matcha-700 dark:text-matcha-300">
            Alle Stops erledigt!
          </p>
        </div>
      )}
    </div>
  );
}
