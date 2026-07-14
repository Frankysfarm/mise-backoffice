'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { History, ChevronDown, ChevronUp, Package, RefreshCw } from 'lucide-react';
import type { BestellHistorieEintrag } from '@/app/api/delivery/public/bestellhistorie/route';

// Phase 1453 — Bestellhistorie-Mini-Widget (Storefront)
// Letzte 3 Bestellungen (Datum + Artikel + Status); localStorage-Fallback; ausklappbar; nach Phase1448

const STORAGE_KEY = 'bestellhistorie_cache';
const POLL_MS = 10 * 60 * 1000;

interface Props {
  locationId: string;
  customerId?: string | null;
}

const STATUS_CONFIG: Record<string, { cls: string; label: string }> = {
  geliefert:   { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Geliefert' },
  unterwegs:   { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', label: 'Unterwegs' },
  in_zubereitung: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', label: 'In Zubereitung' },
  storniert:   { cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', label: 'Storniert' },
};

function statusConfig(status: string): { cls: string; label: string } {
  return STATUS_CONFIG[status] ?? { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', label: status };
}

function formatDatum(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

function loadFromStorage(): BestellHistorieEintrag[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BestellHistorieEintrag[];
  } catch {
    return null;
  }
}

function saveToStorage(data: BestellHistorieEintrag[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export function BestellhistorieMiniWidget({ locationId, customerId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [bestellungen, setBestellungen] = useState<BestellHistorieEintrag[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!customerId) {
      setBestellungen(loadFromStorage());
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/public/bestellhistorie?location_id=${locationId}&customer_id=${customerId}`,
      );
      if (res.ok) {
        const json = await res.json();
        const list = json.bestellungen as BestellHistorieEintrag[];
        setBestellungen(list);
        saveToStorage(list);
        return;
      }
    } catch {
      // fallthrough
    } finally {
      setLoading(false);
    }
    setBestellungen(loadFromStorage());
  }, [locationId, customerId]);

  useEffect(() => {
    if (!mounted) return;
    load();
    if (customerId) {
      timerRef.current = setInterval(load, POLL_MS);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, mounted, customerId]);

  if (!mounted || !bestellungen || bestellungen.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      {/* Header-Button */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <History className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Letzte Bestellungen
        </span>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
        <span className="text-[10px] text-slate-400 shrink-0">{bestellungen.length}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-3">
          {bestellungen.map(b => {
            const sc = statusConfig(b.status);
            const artikelText = b.artikel
              .slice(0, 3)
              .map(a => `${a.menge > 1 ? `${a.menge}× ` : ''}${a.name}`)
              .join(', ');
            const mehrArtikel = b.artikel.length > 3 ? ` +${b.artikel.length - 3}` : '';
            return (
              <div
                key={b.order_id}
                className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <Package className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {formatDatum(b.datum)}
                      </span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', sc.cls)}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                      {artikelText}{mehrArtikel}
                    </p>
                  </div>
                  <span className="text-xs font-black tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                    {b.gesamtpreis_eur.toFixed(2).replace('.', ',')} €
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
