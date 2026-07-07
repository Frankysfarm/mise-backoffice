'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bike, MapPin, Radio, Clock } from 'lucide-react';

interface Props {
  orderId: string;
  locationId: string;
}

interface TrackingData {
  driverName: string | null;
  status: string;
  etaMin: number | null;
  lastUpdate: string | null;
  isNearby: boolean;
}

function secAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 1_000);
}

const PULSE_ANIMATION = `
@keyframes sonarPulse {
  0% { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(2.5); opacity: 0; }
}
`;

export function Phase631LiveTrackingWidget({ orderId, locationId }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<TrackingData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: order } = await supabase
          .from('customer_orders')
          .select('status, batch_id, geschaetzte_lieferzeit_min')
          .eq('id', orderId)
          .single();

        if (!order || cancelled) return;

        let driverName: string | null = null;
        let lastUpdate: string | null = null;
        let etaMin: number | null = order.geschaetzte_lieferzeit_min ?? null;
        let isNearby = false;

        if (order.batch_id) {
          const { data: batch } = await supabase
            .from('delivery_batches')
            .select('driver_id')
            .eq('id', order.batch_id)
            .single();

          if (batch?.driver_id) {
            const { data: profile } = await supabase
              .from('driver_profiles')
              .select('vorname, nachname')
              .eq('id', batch.driver_id)
              .single();

            if (profile) {
              driverName = `${profile.vorname} ${profile.nachname.charAt(0)}.`;
            }

            const { data: ds } = await supabase
              .from('driver_status')
              .select('last_update, last_lat, last_lng')
              .eq('driver_id', batch.driver_id)
              .single();

            if (ds) {
              lastUpdate = ds.last_update;
              isNearby = secAgo(ds.last_update) !== null && (secAgo(ds.last_update) ?? 9999) < 120;
            }
          }
        }

        if (!cancelled) {
          setData({ driverName, status: order.status, etaMin, lastUpdate, isNearby });
        }
      } catch {
        // Ignore errors
      }
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId]);

  if (!data) return null;
  if (!['unterwegs', 'bereit'].includes(data.status)) return null;

  const isLive = data.isNearby;

  return (
    <div className="rounded-2xl border border-matcha-200 dark:border-matcha-700 bg-white dark:bg-gray-900/40 p-4 shadow-sm">
      <style>{PULSE_ANIMATION}</style>
      <div className="flex items-start gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900/60">
          <Bike className="h-5 w-5 text-matcha-600 dark:text-matcha-400" />
          {isLive && (
            <span
              className="absolute inset-0 rounded-full border-2 border-matcha-400 dark:border-matcha-500"
              style={{
                animation: 'sonarPulse 1.5s ease-out infinite',
              }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
              {data.driverName ?? 'Dein Fahrer'}
            </span>
            {isLive && (
              <span className="flex items-center gap-1 rounded-full bg-matcha-100 dark:bg-matcha-900/40 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
                <Radio className="h-2.5 w-2.5" />
                LIVE
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {data.status === 'unterwegs'
              ? 'Ist gerade auf dem Weg zu dir'
              : 'Bestellung wartet auf Abholung'}
          </p>

          {data.etaMin !== null && data.etaMin > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-matcha-500" />
              <span className="text-sm font-bold text-matcha-700 dark:text-matcha-300">
                ~{data.etaMin} Min
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">bis Lieferung</span>
            </div>
          )}

          {data.etaMin !== null && data.etaMin <= 0 && (
            <p className="mt-1 text-sm font-bold text-matcha-600 dark:text-matcha-400 animate-pulse">
              Fahrer kommt gleich an!
            </p>
          )}
        </div>

        <div className="shrink-0">
          <MapPin className="h-5 w-5 text-matcha-400 dark:text-matcha-600" />
        </div>
      </div>
    </div>
  );
}
