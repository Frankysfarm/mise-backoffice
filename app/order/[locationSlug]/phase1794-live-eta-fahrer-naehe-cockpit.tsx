'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, MapPin, Zap } from 'lucide-react';

/**
 * Phase 1794 — Live-ETA-Fahrer-Nähe-Cockpit (Storefront)
 *
 * Zeigt Echtzeit-ETA + Fahrer-Annäherungsindikator für aktive Bestellung.
 * Pulsierende Ampel: Grün ≤10 Min, Gelb ≤20 Min, Rot >20 Min.
 * Hydration-safe; 60s-Polling; Fallback auf statische Schätzung.
 * Nutzt /api/delivery/customer/eta (Kunden-Tracking-Endpunkt).
 */

interface EtaAntwort {
  eta_min: number | null;
  status: 'unterwegs' | 'bereit' | 'zubereitung' | 'angekommen' | null;
  fahrer_name?: string | null;
  fahrer_distanz_km?: number | null;
  aktualisiert_am?: string | null;
}

interface Props {
  orderId: string | null;
  locationId: string;
  className?: string;
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'neutral';

function ampelVonMinuten(min: number | null): Ampel {
  if (min === null) return 'neutral';
  if (min <= 10) return 'gruen';
  if (min <= 20) return 'gelb';
  return 'rot';
}

const AMPEL_CFG: Record<Ampel, { bg: string; border: string; ring: string; text: string; dot: string }> = {
  gruen:   { bg: 'bg-matcha-50 dark:bg-matcha-950/30',  border: 'border-matcha-200 dark:border-matcha-800',  ring: 'ring-matcha-300',  text: 'text-matcha-700 dark:text-matcha-300',  dot: 'bg-matcha-500'  },
  gelb:    { bg: 'bg-amber-50 dark:bg-amber-950/30',    border: 'border-amber-200 dark:border-amber-800',    ring: 'ring-amber-300',   text: 'text-amber-700 dark:text-amber-300',    dot: 'bg-amber-400'   },
  rot:     { bg: 'bg-red-50 dark:bg-red-950/30',        border: 'border-red-200 dark:border-red-800',        ring: 'ring-red-300',     text: 'text-red-700 dark:text-red-300',        dot: 'bg-red-500'     },
  neutral: { bg: 'bg-muted/40',                          border: 'border-border',                              ring: 'ring-border',      text: 'text-muted-foreground',                 dot: 'bg-muted-foreground/40' },
};

const STATUS_LABEL: Record<string, string> = {
  unterwegs:   'Fahrer auf dem Weg',
  bereit:      'Bereit zur Abholung',
  zubereitung: 'In Zubereitung',
  angekommen:  'Fahrer ist da!',
};

async function fetchEta(orderId: string): Promise<EtaAntwort> {
  try {
    const res = await fetch(`/api/delivery/customer/eta?order_id=${encodeURIComponent(orderId)}`);
    if (res.ok) return await res.json();
  } catch {}
  return { eta_min: 22, status: 'unterwegs', fahrer_name: null, fahrer_distanz_km: null, aktualisiert_am: null };
}

export function StorefrontPhase1794LiveEtaFahrerNaeheCockpit({ orderId, locationId, className }: Props) {
  const [data, setData] = useState<EtaAntwort | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !orderId) return;
    let active = true;
    const load = async () => {
      const d = await fetchEta(orderId);
      if (active) setData(d);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { active = false; clearInterval(id); };
  }, [mounted, orderId]);

  if (!mounted || !orderId || !data) return null;
  if (data.status === 'angekommen') return null;

  const ampel = ampelVonMinuten(data.eta_min);
  const c = AMPEL_CFG[ampel];

  const etaLabel = data.eta_min !== null
    ? data.eta_min <= 1 ? 'Jetzt!' : `~${data.eta_min} Min`
    : '–';

  const statusLabel = data.status ? (STATUS_LABEL[data.status] ?? data.status) : 'Bestellung unterwegs';

  return (
    <div className={cn('rounded-2xl border overflow-hidden', c.bg, c.border, className)}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Pulsierender Dot */}
        <div className="relative shrink-0">
          <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', c.bg, 'border', c.border)}>
            <Bike className={cn('h-5 w-5', c.text)} />
          </div>
          <span className={cn(
            'absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
            c.dot,
            ampel !== 'neutral' ? 'animate-pulse' : '',
          )} />
        </div>

        {/* Mitte */}
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold', c.text)}>{statusLabel}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {data.fahrer_name && (
              <span className="text-[11px] text-muted-foreground truncate">Fahrer: {data.fahrer_name}</span>
            )}
            {data.fahrer_distanz_km !== null && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" />
                {data.fahrer_distanz_km.toFixed(1)} km
              </span>
            )}
          </div>
        </div>

        {/* ETA Badge */}
        <div className={cn('shrink-0 rounded-xl px-3 py-2 text-center border', c.bg, c.border)}>
          <div className={cn('font-display text-2xl font-black tabular-nums leading-none', c.text)}>
            {etaLabel}
          </div>
          <div className="text-[9px] font-semibold text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
            <Clock className="h-2.5 w-2.5" /> ETA
          </div>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      {data.eta_min !== null && (
        <div className="px-4 pb-3">
          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', c.dot)}
              style={{ width: `${Math.max(5, Math.min(100, (1 - data.eta_min / 45) * 100))}%` }}
            />
          </div>
          {ampel === 'gruen' && (
            <div className={cn('mt-1 text-[10px] font-bold flex items-center gap-1', c.text)}>
              <Zap className="h-2.5 w-2.5" /> Fast da!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
