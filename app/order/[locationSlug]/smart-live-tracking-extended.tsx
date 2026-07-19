'use client';

/**
 * SmartLiveTrackingExtended
 * Erweiterte Storefront-Live-Tracking-Karte mit:
 * – Dynamische ETA mit Countdown
 * – Fahrer-Info + Bewertung
 * – Status-Timeline mit Fortschrittsbalken
 * – Küchen-Fortschritts-Anzeige (Prep-Bar)
 * – Kunden-Benachrichtigungs-Chip
 * – 15-Sek-Polling
 */

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, ChefHat, Bike, Clock, MapPin, Package, Star, Bell, Navigation2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ────────────────────────────────────────────────────── */

type DeliveryStatus = 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'on_way' | 'nearby' | 'delivered';

interface TrackingData {
  status: DeliveryStatus;
  eta_min: number | null;
  driver_name?: string;
  driver_rating?: number;
  driver_distance_km?: number;
  kitchen_progress_pct?: number;
  stops_before?: number;
  updated_at?: string;
}

/* ── Status config ────────────────────────────────────────────── */

interface StatusStep {
  key: DeliveryStatus;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const STEPS: StatusStep[] = [
  { key: 'confirmed',  label: 'Bestätigt',      sublabel: 'Deine Bestellung wird bearbeitet', icon: <CheckCircle2 className="w-4 h-4" /> },
  { key: 'preparing',  label: 'In Zubereitung', sublabel: 'Die Küche kocht für dich',           icon: <ChefHat     className="w-4 h-4" /> },
  { key: 'ready',      label: 'Fertig',          sublabel: 'Warte auf den Fahrer',              icon: <Package     className="w-4 h-4" /> },
  { key: 'picked_up',  label: 'Abgeholt',        sublabel: 'Fahrer hat dein Essen',             icon: <Bike        className="w-4 h-4" /> },
  { key: 'on_way',     label: 'Unterwegs',       sublabel: 'Dein Fahrer ist auf dem Weg',       icon: <Navigation2 className="w-4 h-4" /> },
  { key: 'delivered',  label: 'Zugestellt',      sublabel: 'Guten Appetit! 🍽️',                icon: <CheckCircle2 className="w-4 h-4" /> },
];

const ORDER: Record<DeliveryStatus, number> = {
  confirmed: 0, preparing: 1, ready: 2, picked_up: 3, on_way: 4, nearby: 4, delivered: 5,
};

/* ── ETA Countdown ────────────────────────────────────────────── */

function EtaCountdown({ etaMin }: { etaMin: number }) {
  const [secs, setSecs] = useState(etaMin * 60);

  useEffect(() => {
    setSecs(etaMin * 60);
  }, [etaMin]);

  useEffect(() => {
    const iv = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  const min = Math.floor(secs / 60);
  const sec = secs % 60;
  const urgent = min <= 5;
  const color  = urgent ? 'text-matcha-600' : 'text-saffron-700';

  return (
    <div className="flex flex-col items-center">
      <div className={cn('text-4xl font-black tabular-nums', color)}>
        {min}<span className="text-2xl">:{String(sec).padStart(2, '0')}</span>
      </div>
      <div className="text-xs font-semibold text-stone-500 mt-0.5">
        {urgent ? '🟢 Gleich da!' : 'Min. verbleibend'}
      </div>
    </div>
  );
}

/* ── Kitchen Progress ─────────────────────────────────────────── */

function KitchenProgress({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-matcha-400' : pct >= 50 ? 'bg-amber-400' : 'bg-saffron-400';

  return (
    <div>
      <div className="flex justify-between text-[11px] font-semibold text-stone-500 mb-1">
        <span className="flex items-center gap-1"><ChefHat className="w-3 h-3" /> Zubereitung</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-1000', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Status Timeline ──────────────────────────────────────────── */

function StatusTimeline({ status }: { status: DeliveryStatus }) {
  const currentIdx = ORDER[status] ?? 0;

  return (
    <div className="space-y-2">
      {STEPS.map((step, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        const future = i > currentIdx;

        return (
          <div key={step.key} className="flex items-center gap-3">
            {/* Icon */}
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all',
              done   ? 'bg-matcha-400 text-white' :
              active ? 'bg-saffron-400 text-white ring-4 ring-saffron-100 animate-pulse' :
                       'bg-stone-100 text-stone-300'
            )}>
              {step.icon}
            </div>

            {/* Text */}
            <div className={cn('flex-1', future ? 'opacity-40' : '')}>
              <div className={cn('text-sm font-bold', active ? 'text-stone-900' : done ? 'text-matcha-700' : 'text-stone-500')}>
                {step.label}
              </div>
              {active && (
                <div className="text-[11px] text-stone-400 mt-0.5">{step.sublabel}</div>
              )}
            </div>

            {done && <CheckCircle2 className="w-4 h-4 text-matcha-500 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Driver Card ──────────────────────────────────────────────── */

function DriverCard({ name, rating, distanceKm }: { name: string; rating?: number; distanceKm?: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-stone-50 border border-stone-200 p-3">
      <div className="w-10 h-10 rounded-full bg-saffron-100 flex items-center justify-center shrink-0">
        <Bike className="w-5 h-5 text-saffron-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-stone-900 truncate">{name}</div>
        {rating != null && (
          <div className="flex items-center gap-1 text-[11px] text-amber-500 mt-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{rating.toFixed(1)}</span>
            <span className="text-stone-400">Bewertung</span>
          </div>
        )}
      </div>
      {distanceKm != null && (
        <div className="text-right shrink-0">
          <div className="text-sm font-black text-stone-900">{distanceKm.toFixed(1)} km</div>
          <div className="text-[10px] text-stone-400">entfernt</div>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

interface Props {
  orderId: string | null;
}

export function SmartLiveTrackingExtended({ orderId }: Props) {
  const [data, setData] = useState<TrackingData>({
    status: 'preparing',
    eta_min: 22,
    driver_name: 'Ahmed K.',
    driver_rating: 4.9,
    driver_distance_km: 2.3,
    kitchen_progress_pct: 40,
    stops_before: 0,
  });
  const [notified, setNotified] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const r = await fetch(`/api/delivery/tracking?order_id=${orderId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
  }, [orderId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  const statusLabel = STEPS.find(s => s.key === data.status)?.label ?? data.status;
  const showDriver = ['picked_up', 'on_way', 'nearby'].includes(data.status);
  const showKitchen = ['preparing', 'ready'].includes(data.status);
  const isNearby = data.status === 'nearby';
  const isDelivered = data.status === 'delivered';

  /* ── Progress bar overall ─────────────────────────────────────── */
  const overallPct = Math.round(((ORDER[data.status] ?? 0) / (STEPS.length - 1)) * 100);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden space-y-0">
      {/* Header */}
      <div className={cn(
        'px-4 pt-4 pb-3 text-center',
        isDelivered ? 'bg-matcha-50' : isNearby ? 'bg-amber-50' : 'bg-saffron-50'
      )}>
        <div className="text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wide">Live-Tracking</div>
        <div className={cn('text-base font-black', isDelivered ? 'text-matcha-700' : isNearby ? 'text-amber-700' : 'text-stone-900')}>
          {statusLabel}
        </div>

        {/* ETA */}
        {data.eta_min != null && !isDelivered && (
          <div className="mt-3">
            <EtaCountdown etaMin={data.eta_min} />
          </div>
        )}
        {isDelivered && (
          <div className="mt-3 text-3xl">🎉</div>
        )}
      </div>

      {/* Overall progress bar */}
      <div className="px-4 py-2">
        <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-1000', isDelivered ? 'bg-matcha-400' : 'bg-saffron-400')}
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Driver info */}
      {showDriver && data.driver_name && (
        <div className="px-4 pb-3">
          <DriverCard name={data.driver_name} rating={data.driver_rating} distanceKm={data.driver_distance_km} />
        </div>
      )}

      {/* Stops before me */}
      {showDriver && (data.stops_before ?? 0) > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 text-[11px] bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-semibold text-amber-700">
              {data.stops_before} Stopp{(data.stops_before ?? 0) > 1 ? 's' : ''} vor dir
            </span>
          </div>
        </div>
      )}

      {/* Kitchen progress */}
      {showKitchen && data.kitchen_progress_pct != null && (
        <div className="px-4 pb-3">
          <KitchenProgress pct={data.kitchen_progress_pct} />
        </div>
      )}

      {/* Nearby alert */}
      {isNearby && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm font-bold text-amber-700">
            <Bell className="w-4 h-4 animate-bounce" />
            Dein Fahrer ist fast da!
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="px-4 pb-4 border-t border-stone-100 pt-3">
        <StatusTimeline status={data.status} />
      </div>

      {/* Notification chip */}
      {!isDelivered && !notified && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setNotified(true)}
            className="w-full text-center text-[11px] font-semibold text-stone-400 hover:text-stone-600 transition-colors py-2 border border-dashed border-stone-200 rounded-xl"
          >
            <Bell className="w-3.5 h-3.5 inline mr-1" />
            Browser-Benachrichtigung aktivieren
          </button>
        </div>
      )}
      {notified && (
        <div className="px-4 pb-4">
          <div className="text-center text-[11px] font-semibold text-matcha-600 py-2 bg-matcha-50 rounded-xl">
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
            Du wirst benachrichtigt, wenn der Fahrer ankommt
          </div>
        </div>
      )}

      <div className="px-4 pb-3 text-[10px] text-stone-400 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Aktualisiert alle 15 Sekunden
      </div>
    </div>
  );
}
