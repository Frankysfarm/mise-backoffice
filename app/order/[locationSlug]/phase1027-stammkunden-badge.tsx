'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Heart, X, Star, Clock } from 'lucide-react';

/**
 * Phase 1027 — Kunden-Stammkunden-Badge (Storefront)
 *
 * "Willkommen zurück!" Banner für wiederkehrende Kunden mit letzter Bestellung + Treuepunkte-Stand.
 * Erscheint wenn ≥2 frühere Bestellungen erkannt, localStorage-Persistenz.
 * Dismissbar. 5-Min-Polling.
 */

interface Props {
  locationId: string;
  className?: string;
}

interface StammkundeData {
  ist_stammkunde: boolean;
  vorname: string | null;
  bestellungen_gesamt: number;
  letzte_bestellung_datum: string | null;
  letzte_bestellung_betrag_eur: number | null;
  treuepunkte: number;
  naechste_belohnung_punkte: number | null;
}

const MOCK: StammkundeData = {
  ist_stammkunde: true,
  vorname: 'Alex',
  bestellungen_gesamt: 7,
  letzte_bestellung_datum: new Date(Date.now() - 5 * 24 * 3600_000).toISOString(),
  letzte_bestellung_betrag_eur: 28.50,
  treuepunkte: 142,
  naechste_belohnung_punkte: 150,
};

function relativDate(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600_000));
  if (diff === 0) return 'heute';
  if (diff === 1) return 'gestern';
  if (diff < 7) return `vor ${diff} Tagen`;
  if (diff < 30) return `vor ${Math.floor(diff / 7)} Wochen`;
  return `vor ${Math.floor(diff / 30)} Monat(en)`;
}

export function Phase1027StammkundenBadge({ locationId, className }: Props) {
  const [data, setData] = useState<StammkundeData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = `stammkunden-badge-dismissed-${locationId}`;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(key);
      if (stored) {
        const ts = parseInt(stored, 10);
        // Re-show after 24h
        if (Date.now() - ts < 24 * 3600_000) { setDismissed(true); return; }
      }
    }

    async function load() {
      try {
        // Try real API; fall back to mock
        const res = await fetch(`/api/delivery/storefront/stammkunde?location_id=${locationId}`);
        if (res.ok) {
          const json: StammkundeData = await res.json();
          if (json.ist_stammkunde) setData(json);
        } else {
          // Demo: show mock for dev
          if (process.env.NODE_ENV === 'development') setData(MOCK);
        }
      } catch {
        if (process.env.NODE_ENV === 'development') setData(MOCK);
      }
    }

    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  function dismiss() {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`stammkunden-badge-dismissed-${locationId}`, String(Date.now()));
    }
  }

  if (dismissed || !data || !data.ist_stammkunde) return null;

  const pctToReward = data.naechste_belohnung_punkte
    ? Math.min(100, Math.round((data.treuepunkte / data.naechste_belohnung_punkte) * 100))
    : null;

  return (
    <div className={cn('relative rounded-xl border border-matcha-200 dark:border-matcha-800 bg-gradient-to-br from-matcha-50 to-white dark:from-matcha-900/20 dark:to-zinc-900 shadow-sm overflow-hidden', className)}>
      {/* Dismiss */}
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 rounded-full p-1 hover:bg-black/10 transition text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="h-5 w-5 text-matcha-600 fill-matcha-100" />
          <span className="text-sm font-bold text-matcha-700 dark:text-matcha-300">
            Willkommen zurück{data.vorname ? `, ${data.vorname}` : ''}! 👋
          </span>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
          Schön, dich wieder zu sehen! Du hast bereits {data.bestellungen_gesamt} Bestellungen bei uns aufgegeben.
        </p>

        {/* Letzte Bestellung */}
        {data.letzte_bestellung_datum && (
          <div className="rounded-lg border border-matcha-100 dark:border-matcha-800 bg-white dark:bg-zinc-800 px-3 py-2 mb-3 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <div className="text-xs text-zinc-700 dark:text-zinc-300">
              Letzte Bestellung: <span className="font-semibold">{relativDate(data.letzte_bestellung_datum)}</span>
              {data.letzte_bestellung_betrag_eur && (
                <span className="text-zinc-500"> · {data.letzte_bestellung_betrag_eur.toFixed(2)} €</span>
              )}
            </div>
          </div>
        )}

        {/* Treuepunkte */}
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-200" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Treuepunkte</span>
            </div>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{data.treuepunkte} P</span>
          </div>
          {pctToReward !== null && data.naechste_belohnung_punkte && (
            <>
              <div className="h-1.5 rounded-full bg-amber-200 dark:bg-amber-900 overflow-hidden">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pctToReward}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                Noch {data.naechste_belohnung_punkte - data.treuepunkte} Punkte bis zur nächsten Belohnung
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
