'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, RefreshCw, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1394 — Bestellhistorie-Schnellreorder (Storefront)
 *
 * Letzte 3 Bestellungen aus localStorage mit 1-Tap-Reorder-Button.
 * Artikel werden direkt in den Warenkorb übernommen.
 * Nach Phase1389 in storefront.tsx einbinden.
 */

const LS_HISTORY_KEY = (locationId: string) => `mise_order_history_${locationId}`;
const MAX_HISTORY = 3;

export interface HistoryItem {
  id: string;
  name: string;
  price: number;
  [key: string]: unknown;
}

export interface HistoryEntry {
  bestellnummer: string | null;
  items: Array<{ item: HistoryItem; qty: number }>;
  gesamtbetrag: number;
  bestellt_am: string;
  locationId: string;
}

/** Beim Abschicken einer Bestellung aufrufen, um sie zu speichern */
export function saveOrderToHistory(entry: HistoryEntry, locationId: string) {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY(locationId));
    const history: HistoryEntry[] = raw ? JSON.parse(raw) : [];
    // Neueste zuerst, max MAX_HISTORY Einträge
    const updated = [entry, ...history.filter((h) => h.bestellnummer !== entry.bestellnummer)].slice(0, MAX_HISTORY);
    localStorage.setItem(LS_HISTORY_KEY(locationId), JSON.stringify(updated));
  } catch { /* ignore */ }
}

interface Props {
  locationId: string;
  onReorder: (items: Array<{ item: HistoryItem; qty: number }>) => void;
}

function zeitLabel(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `vor ${diffD} Tag${diffD === 1 ? '' : 'en'}`;
}

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function StorefrontPhase1394BestellhistorieSchnellreorder({ locationId, onReorder }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [reorderedIdx, setReorderedIdx] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_HISTORY_KEY(locationId));
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [locationId]);

  const handleReorder = useCallback((entry: HistoryEntry, idx: number) => {
    onReorder(entry.items);
    setReorderedIdx(idx);
    setTimeout(() => setReorderedIdx(null), 2500);
  }, [onReorder]);

  if (history.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Letzte Bestellungen</span>
      </div>
      {history.map((entry, idx) => (
        <div
          key={entry.bestellnummer ?? idx}
          className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {entry.bestellnummer && (
                <span className="text-xs text-muted-foreground font-mono">#{entry.bestellnummer}</span>
              )}
              <span className="text-xs text-muted-foreground">{zeitLabel(entry.bestellt_am)}</span>
            </div>
            <p className="text-sm text-foreground truncate">
              {entry.items.map((i) => `${i.qty}× ${i.item.name}`).join(', ')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {entry.items.length} Artikel · {euro(entry.gesamtbetrag)}
            </p>
          </div>
          <button
            onClick={() => handleReorder(entry, idx)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0',
              reorderedIdx === idx
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-primary/10 text-primary hover:bg-primary/20',
            )}
          >
            {reorderedIdx === idx ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Hinzugefügt
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Nochmal
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
