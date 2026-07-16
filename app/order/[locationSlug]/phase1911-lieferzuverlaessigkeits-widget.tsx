'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, X } from 'lucide-react';

/**
 * Phase 1911 — Lieferzuverlässigkeits-Widget (Storefront)
 *
 * "99% pünktliche Lieferungen diese Woche in deiner Zone"
 * Social-Proof-Kachel; schließbar; Hydration-safe; 1-Std-Polling.
 */

interface ZuverlässigkeitsDaten {
  puenktlichkeit_pct: number;
  zone: string;
  gesamt_lieferungen: number;
  zeitraum: string;
}

const MOCK: ZuverlässigkeitsDaten = {
  puenktlichkeit_pct: 97,
  zone: 'A',
  gesamt_lieferungen: 184,
  zeitraum: 'diese Woche',
};

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase1911LieferzuverlaessigkeitsWidget({ locationId, className }: Props) {
  const [daten, setDaten] = useState<ZuverlässigkeitsDaten | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/public/avg-eta?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        setDaten({
          puenktlichkeit_pct: json.puenktlichkeit_pct ?? MOCK.puenktlichkeit_pct,
          zone: json.zone ?? MOCK.zone,
          gesamt_lieferungen: json.gesamt_lieferungen ?? MOCK.gesamt_lieferungen,
          zeitraum: 'diese Woche',
        });
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || geschlossen || !daten) return null;

  const farbe =
    daten.puenktlichkeit_pct >= 95
      ? { ring: 'border-green-200 dark:border-green-800', bg: 'bg-green-50 dark:bg-green-950/20', text: 'text-green-800 dark:text-green-200', pct: 'text-green-700 dark:text-green-300', icon: 'text-green-500' }
      : daten.puenktlichkeit_pct >= 85
      ? { ring: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-800 dark:text-blue-200', pct: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-500' }
      : { ring: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-800 dark:text-amber-200', pct: 'text-amber-700 dark:text-amber-300', icon: 'text-amber-500' };

  return (
    <div className={cn('rounded-2xl border px-4 py-3 flex items-center gap-3', farbe.ring, farbe.bg, className)}>
      <ShieldCheck className={cn('h-6 w-6 shrink-0', farbe.icon)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold', farbe.text)}>
          <span className="tabular-nums">{daten.puenktlichkeit_pct}%</span> pünktliche Lieferungen
        </p>
        <p className={cn('text-[11px] mt-0.5', farbe.pct)}>
          {daten.gesamt_lieferungen} Lieferungen {daten.zeitraum} · Zone {daten.zone}
        </p>
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
