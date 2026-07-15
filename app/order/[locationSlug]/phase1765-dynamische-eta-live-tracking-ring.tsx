'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock } from 'lucide-react';

/**
 * Phase 1765 — Dynamische ETA Live-Tracking-Ring (Storefront)
 *
 * Kreisring zeigt den Fortschritt der aktiven Bestellung (0–100%).
 * 4 Phasen: Küche → Bereit → Fahrer → Geliefert.
 * 30s-Polling. Nur wenn orderId vorhanden.
 * GET /api/delivery/customer/tracking?order_id=<id>
 */

interface TrackingData {
  status: 'new' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | string;
  eta_minutes: number | null;
  driver_name?: string | null;
  progress_pct?: number;
}

interface Props {
  orderId?: string | null;
  locationId?: string | null;
  className?: string;
}

const PHASE_LABELS: Record<string, { label: string; pct: number }> = {
  new:       { label: 'Bestellung eingegangen', pct: 5 },
  preparing: { label: 'Küche bereitet zu',      pct: 35 },
  ready:     { label: 'Bereit zur Abholung',    pct: 65 },
  picked_up: { label: 'Fahrer unterwegs',       pct: 85 },
  delivered: { label: 'Geliefert!',             pct: 100 },
};

function getPhase(status: string) {
  return PHASE_LABELS[status] ?? { label: status, pct: 50 };
}

const CIRCUMFERENCE = 2 * Math.PI * 38;

export function StorefrontPhase1765DynamischeEtaLiveTrackingRing({ orderId, locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<TrackingData | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const load = async () => {
      const locPart = locationId ? `&location_id=${locationId}` : '';
      try {
        const r = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}${locPart}`);
        if (r.ok && !cancelled) {
          const j = await r.json();
          setData(j);
        }
      } catch { /* silent */ }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId, locationId]);

  if (!mounted || !orderId) return null;
  if (!data) return null;
  if (data.status === 'delivered') return null;

  const { label, pct } = getPhase(data.status);
  const offset = CIRCUMFERENCE * (1 - pct / 100);

  const ringColor = pct < 40
    ? '#f59e0b'
    : pct < 80
    ? '#3b82f6'
    : '#22c55e';

  return (
    <div className={cn('mx-4 mt-2 rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-center gap-4">
        {/* SVG-Ring */}
        <div className="shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden="true">
            <circle cx="44" cy="44" r="38" stroke="currentColor" strokeWidth="8" className="text-muted" />
            <circle
              cx="44"
              cy="44"
              r="38"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              transform="rotate(-90 44 44)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <text x="44" y="40" textAnchor="middle" dominantBaseline="middle" fill={ringColor} fontSize="16" fontWeight="900">
              {pct}%
            </text>
            <text x="44" y="55" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="8" className="fill-muted-foreground">
              Fortschritt
            </text>
          </svg>
        </div>

        <div className="flex-1 space-y-2">
          <div>
            <div className="text-xs font-semibold leading-tight">{label}</div>
            {data.eta_minutes != null && data.eta_minutes > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-black" style={{ color: ringColor }}>
                  ~{data.eta_minutes} Min
                </span>
                <span className="text-[10px] text-muted-foreground">verbleibend</span>
              </div>
            )}
          </div>

          {data.driver_name && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Bike className="h-3 w-3" />
              Fahrer: <span className="font-semibold text-foreground">{data.driver_name}</span>
            </div>
          )}

          {/* Phasen-Leiste */}
          <div className="flex items-center gap-0.5">
            {['new', 'preparing', 'ready', 'picked_up', 'delivered'].map((s, i) => {
              const done = PHASE_LABELS[s].pct <= pct;
              return (
                <div
                  key={s}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    done ? 'bg-green-500' : 'bg-muted',
                    i === 0 ? 'rounded-l-full' : '',
                    i === 4 ? 'rounded-r-full' : '',
                  )}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
