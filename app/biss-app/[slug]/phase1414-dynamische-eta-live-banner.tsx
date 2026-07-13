'use client';

/**
 * Phase 1414 — Dynamische ETA Live-Banner
 *
 * Zeigt auf der Storefront eine lebendige ETA-Anzeige:
 * - Küchen-Auslastung farbkodiert (ruhig / normal / beschäftigt)
 * - Geschätzte Liefer- & Abholzeit
 * - Anzahl verfügbarer Fahrer
 * - Live-Puls-Indikator + automatisches Refresh
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type EtaData = {
  eta_min: number;
  load: 'quiet' | 'normal' | 'busy';
  drivers_online: number;
} | null;

interface Props {
  locationId: string;
  deliveryTimeMin: number;
  initialEta?: EtaData;
}

const LOAD_CONFIG = {
  quiet: {
    label: 'Ruhig',
    sublabel: 'Küche hat freie Kapazität',
    dot: 'bg-matcha-500',
    bar: 'bg-matcha-500',
    barWidth: 'w-1/4',
    badge: 'bg-matcha-50 text-matcha-700 border-matcha-200',
    icon: '🟢',
    pulse: false,
  },
  normal: {
    label: 'Normalbetrieb',
    sublabel: 'Küche gut ausgelastet',
    dot: 'bg-amber-400',
    bar: 'bg-amber-400',
    barWidth: 'w-1/2',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: '🟡',
    pulse: false,
  },
  busy: {
    label: 'Hohe Auslastung',
    sublabel: 'Küche voll beschäftigt',
    dot: 'bg-red-500',
    bar: 'bg-red-500',
    barWidth: 'w-3/4',
    badge: 'bg-red-50 text-red-700 border-red-200',
    icon: '🔴',
    pulse: true,
  },
};

export function BissPhase1414DynamischeEtaLiveBanner({ locationId, deliveryTimeMin, initialEta }: Props) {
  const [eta, setEta] = useState<EtaData>(initialEta ?? null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(!initialEta);

  useEffect(() => {
    async function fetchEta() {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${locationId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setEta(data);
          setLastUpdated(new Date());
        }
      } catch {
        // Keep last known data
      } finally {
        setLoading(false);
      }
    }
    fetchEta();
    const iv = setInterval(fetchEta, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="mx-4 my-3 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-2.5 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  const load = eta?.load ?? 'normal';
  const cfg = LOAD_CONFIG[load];
  const etaMin = eta?.eta_min ?? deliveryTimeMin;
  const pickupMin = Math.max(10, Math.round(etaMin * 0.45));

  const updatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={cn('mx-4 my-3 rounded-2xl border overflow-hidden', cfg.badge)}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-block w-2.5 h-2.5 rounded-full shrink-0',
              cfg.dot,
              cfg.pulse && 'animate-pulse',
            )}
          />
          <span className="text-xs font-bold uppercase tracking-wide">{cfg.label}</span>
          <span className="hidden sm:inline text-xs opacity-70">— {cfg.sublabel}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs opacity-60">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {updatedStr ? `${updatedStr}` : 'Live'}
        </div>
      </div>

      {/* ETA cards */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        {/* Lieferung */}
        <div className="rounded-xl bg-white/60 border border-current/10 px-3 py-2.5 text-center">
          <div className="text-xl font-black">~{etaMin}&thinsp;Min</div>
          <div className="text-[11px] font-semibold opacity-70 mt-0.5">🛵 Lieferung</div>
        </div>

        {/* Abholung */}
        <div className="rounded-xl bg-white/60 border border-current/10 px-3 py-2.5 text-center">
          <div className="text-xl font-black">~{pickupMin}&thinsp;Min</div>
          <div className="text-[11px] font-semibold opacity-70 mt-0.5">🏃 Abholung</div>
        </div>
      </div>

      {/* Load bar */}
      <div className="px-4 pb-2">
        <div className="h-1.5 rounded-full bg-current/10 overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-700', cfg.bar, cfg.barWidth)} />
        </div>
      </div>

      {/* Drivers + footer note */}
      <div className="px-4 pb-3 flex items-center justify-between text-[11px] opacity-70">
        {eta && eta.drivers_online > 0 ? (
          <span>{eta.drivers_online} Fahrer online</span>
        ) : (
          <span>Fahrer verfügbar</span>
        )}
        {load === 'busy' && (
          <span className="font-semibold text-red-600">Wartezeiten möglich</span>
        )}
        {load === 'quiet' && (
          <span className="font-semibold text-matcha-600">Schnelle Lieferung!</span>
        )}
      </div>
    </div>
  );
}
