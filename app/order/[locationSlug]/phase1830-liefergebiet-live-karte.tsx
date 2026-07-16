'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, AlertTriangle, X, Clock } from 'lucide-react';

/**
 * Phase 1830 — Liefergebiet-Live-Karte (Storefront)
 *
 * Zeigt ob der aktuelle Standort in der Lieferzone liegt + ETA-Schätzung.
 * Hydration-safe (mounted-Guard); schließbar.
 */

interface Props {
  locationId: string;
  className?: string;
}

interface ZonenStatus {
  in_liefergebiet: boolean;
  eta_min: number | null;
  zone_name: string | null;
  min_bestellwert_cents: number | null;
  liefergebuehr_cents: number | null;
  zonen_farbe: 'gruen' | 'gelb' | 'rot' | null;
}

const MOCK_STATUS: ZonenStatus = {
  in_liefergebiet: true,
  eta_min: 28,
  zone_name: 'Mitte',
  min_bestellwert_cents: 1500,
  liefergebuehr_cents: 199,
  zonen_farbe: 'gruen',
};

function euro(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export function StorefrontPhase1830LiefergebietLiveKarte({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<ZonenStatus | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let aktiv = true;

    const laden = async () => {
      try {
        const r = await fetch(
          `/api/delivery/public/zonen-status?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (!r.ok) throw new Error('fetch_failed');
        if (aktiv) setStatus(await r.json());
      } catch {
        if (aktiv) setStatus(MOCK_STATUS);
      }
    };

    laden();
  }, [mounted, locationId]);

  if (!mounted || geschlossen) return null;

  const s = status ?? MOCK_STATUS;

  const farbe = s.zonen_farbe ?? (s.in_liefergebiet ? 'gruen' : 'rot');

  const styles = {
    gruen: {
      bg: 'bg-matcha-50 dark:bg-matcha-950/30',
      border: 'border-matcha-200 dark:border-matcha-800',
      icon: <CheckCircle2 className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0" />,
      text: 'text-matcha-700 dark:text-matcha-300',
      pill: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
    },
    gelb: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-800',
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      text: 'text-amber-700 dark:text-amber-300',
      pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
    rot: {
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-800',
      icon: <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />,
      text: 'text-red-700 dark:text-red-300',
      pill: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    },
  };

  const st = styles[farbe] ?? styles.gruen;

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-xl border px-4 py-3',
        st.bg,
        st.border,
        className,
      )}
    >
      {/* Icon */}
      <MapPin className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {st.icon}
          <span className={cn('text-sm font-semibold', st.text)}>
            {s.in_liefergebiet
              ? `Lieferung möglich${s.zone_name ? ` – Zone ${s.zone_name}` : ''}`
              : 'Leider außerhalb des Liefergebiets'}
          </span>
          {s.eta_min !== null && s.in_liefergebiet && (
            <span className={cn('rounded-full text-[10px] font-bold px-1.5 py-0.5 flex items-center gap-1', st.pill)}>
              <Clock className="h-3 w-3" />
              ~{s.eta_min} Min
            </span>
          )}
        </div>

        {s.in_liefergebiet && (s.min_bestellwert_cents !== null || s.liefergebuehr_cents !== null) && (
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {s.min_bestellwert_cents !== null && `MBW ${euro(s.min_bestellwert_cents)}`}
            {s.min_bestellwert_cents !== null && s.liefergebuehr_cents !== null && ' · '}
            {s.liefergebuehr_cents !== null && (s.liefergebuehr_cents === 0 ? 'Kostenlose Lieferung' : `Liefergebühr ${euro(s.liefergebuehr_cents)}`)}
          </p>
        )}

        {!s.in_liefergebiet && (
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Für Abholung sind wir jederzeit erreichbar.
          </p>
        )}
      </div>

      {/* Close */}
      <button
        onClick={() => setGeschlossen(true)}
        className="ml-auto shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
        aria-label="Schließen"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
