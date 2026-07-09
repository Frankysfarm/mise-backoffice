'use client';

import { useEffect, useState } from 'react';
import { Clock, RotateCcw, Package, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type HistorieBestellung = {
  id: string;
  bestellnummer: string;
  datum: string;
  gesamtbetrag: number;
  artikel: string[];
  status: string;
};

function formatEuro(val: number): string {
  return val.toFixed(2).replace('.', ',') + ' €';
}

function formatDatum(iso: string): string {
  const d = new Date(iso);
  const heute = new Date();
  const gestern = new Date(heute);
  gestern.setDate(heute.getDate() - 1);
  if (d.toDateString() === heute.toDateString()) return 'Heute';
  if (d.toDateString() === gestern.toDateString()) return 'Gestern';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

type Props = {
  locationSlug: string;
  onWiederholen?: (bestellung: HistorieBestellung) => void;
};

export function Phase1072BestellhistorieWidget({ locationSlug, onWiederholen }: Props) {
  const [bestellungen, setBestellungen] = useState<HistorieBestellung[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/order/bestellhistorie?location_slug=${encodeURIComponent(locationSlug)}&limit=3`);
        if (r.ok) {
          const j = await r.json();
          setBestellungen(j.bestellungen ?? []);
        }
      } catch {
        /* no history available */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [locationSlug]);

  if (loading || bestellungen.length === 0) return null;

  return (
    <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 border-b border-purple-200 dark:border-purple-800"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-bold text-purple-800 dark:text-purple-200 uppercase tracking-wider">
            Deine letzten Bestellungen
          </span>
        </div>
        <ChevronRight
          size={14}
          className={cn('text-purple-500 transition-transform', expanded && 'rotate-90')}
        />
      </button>

      {expanded && (
        <div className="p-3 space-y-2">
          {bestellungen.map((b) => (
            <div
              key={b.id}
              className="rounded-xl bg-white dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Package size={11} className="text-purple-500 shrink-0" />
                  <span className="text-xs font-bold text-gray-900 dark:text-white">#{b.bestellnummer}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDatum(b.datum)}</span>
                </div>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  {formatEuro(b.gesamtbetrag)}
                </span>
              </div>

              <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-2 truncate">
                {b.artikel.slice(0, 3).join(' · ')}
                {b.artikel.length > 3 && ` +${b.artikel.length - 3}`}
              </p>

              {onWiederholen && (
                <button
                  onClick={() => onWiederholen(b)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 transition-colors"
                >
                  <RotateCcw size={11} />
                  Wiederholen
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!expanded && (
        <div className="px-4 py-2 flex items-center gap-2">
          {bestellungen.slice(0, 3).map((b) => (
            <span key={b.id} className="text-[10px] text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full font-semibold">
              {formatDatum(b.datum)} · {formatEuro(b.gesamtbetrag)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
