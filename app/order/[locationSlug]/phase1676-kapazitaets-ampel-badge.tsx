'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

/**
 * Phase 1676 — Kapazitäts-Ampel-Badge (Storefront)
 *
 * Live-Badge: Küche/Fahrer-Kapazität (voll/normal/niedrig) + angepasste ETA-Warnung.
 * 3-Min-Polling. Hydration-safe.
 */

type Ampel = 'niedrig' | 'normal' | 'voll';

interface Props {
  locationId: string;
}

interface ApiResponse {
  gesamt_auslastung_pct: number;
  zonen: Array<{ ampel: Ampel }>;
}

const AMPEL_CONFIG: Record<Ampel, { dot: string; badge: string; label: string; eta: string | null }> = {
  niedrig: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    label: 'Schnelle Lieferung verfügbar',
    eta: null,
  },
  normal: {
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 border-amber-200 text-amber-700',
    label: 'Normale Lieferzeit',
    eta: null,
  },
  voll: {
    dot: 'bg-red-500 animate-pulse',
    badge: 'bg-red-50 border-red-200 text-red-700',
    label: 'Hohe Nachfrage',
    eta: 'Lieferzeit kann leicht erhöht sein',
  },
};

function resolveAmpel(data: ApiResponse): Ampel {
  const pct = data.gesamt_auslastung_pct;
  if (pct >= 90) return 'voll';
  if (pct >= 55) return 'normal';
  return 'niedrig';
}

const POLL_MS = 3 * 60 * 1000;

export function StorefrontPhase1676KapazitaetsAmpelBadge({ locationId }: Props) {
  const [ampel, setAmpel] = useState<Ampel | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/admin/zonen-kapazitaet?location_id=${encodeURIComponent(locationId)}`);
      if (!r.ok) return;
      const data: ApiResponse = await r.json();
      setAmpel(resolveAmpel(data));
    } catch { /* ignore */ }
  }, [locationId]);

  useEffect(() => {
    if (!mounted) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [mounted, load]);

  if (!mounted || !ampel) return null;

  const cfg = AMPEL_CONFIG[ampel];

  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm',
      cfg.badge,
    )}>
      <Activity className="h-3 w-3 shrink-0" />
      <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
      <span>{cfg.label}</span>
      {cfg.eta && (
        <span className="ml-1 text-[10px] font-normal opacity-80">— {cfg.eta}</span>
      )}
    </div>
  );
}
