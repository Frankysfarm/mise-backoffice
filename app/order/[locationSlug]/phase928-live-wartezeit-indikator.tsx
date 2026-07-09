'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

/**
 * Phase 928 — Live-Wartezeit-Indikator (Storefront)
 *
 * Echtzeit-Ampel: zeigt aktuell durchschnittliche Wartezeit
 * für Lieferbestellungen. Grün / Amber / Rot je Auslastung.
 * 2-Min-Polling. Nur bei orderType='lieferung'.
 */

interface Props {
  locationId: string | null;
  orderType: string;
}

type Ampel = 'gruen' | 'amber' | 'rot';

interface WartezeitStatus {
  avgMin: number;
  ampel: Ampel;
  label: string;
  aktivBestellungen: number;
}

const POLL_MS = 2 * 60 * 1000;

function berechneAmpel(avgMin: number): Ampel {
  if (avgMin <= 30) return 'gruen';
  if (avgMin <= 45) return 'amber';
  return 'rot';
}

const AMPEL_STYLES: Record<Ampel, { dot: string; text: string; bg: string; border: string }> = {
  gruen: {
    dot: 'bg-matcha-500',
    text: 'text-matcha-700',
    bg: 'bg-matcha-50',
    border: 'border-matcha-200',
  },
  amber: {
    dot: 'bg-amber-400',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  rot: {
    dot: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
};

const AMPEL_LABEL: Record<Ampel, string> = {
  gruen: 'Kurze Wartezeit',
  amber: 'Mäßige Auslastung',
  rot: 'Hohe Auslastung',
};

export function Phase928LiveWartezeitIndikator({ locationId, orderType }: Props) {
  const [status, setStatus] = useState<WartezeitStatus | null>(null);

  const load = useCallback(async () => {
    if (!locationId || orderType !== 'lieferung') return;
    try {
      const res = await fetch(
        `/api/delivery/admin/kunden-wartezeit-live?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (!json.ok || !json.data) throw new Error();
      const avg: number = json.data.avgWartezeitAktivMin ?? json.data.avgWartezeitAbgeschlossenMin ?? 0;
      const ampel = berechneAmpel(avg);
      setStatus({
        avgMin: Math.round(avg),
        ampel,
        label: AMPEL_LABEL[ampel],
        aktivBestellungen: json.data.aktivBestellungen ?? 0,
      });
    } catch {
      // On error: don't show stale data
    }
  }, [locationId, orderType]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!status || orderType !== 'lieferung') return null;

  const s = AMPEL_STYLES[status.ampel];

  return (
    <div className={cn(
      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm',
      s.bg,
      s.border,
    )}>
      {/* Pulsing dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', s.dot)} />
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', s.dot)} />
      </span>

      <Clock className={cn('h-3.5 w-3.5 shrink-0', s.text)} />

      <div className="flex-1 min-w-0">
        <span className={cn('font-bold tabular-nums', s.text)}>
          {status.avgMin > 0 ? `~${status.avgMin} Min` : '—'}
        </span>
        <span className={cn('ml-1.5 text-xs', s.text)}>{status.label}</span>
      </div>

      {status.aktivBestellungen > 0 && (
        <span className="text-xs text-stone-400 shrink-0">
          {status.aktivBestellungen} aktiv
        </span>
      )}
    </div>
  );
}
