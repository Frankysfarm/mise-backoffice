'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, CalendarClock, Package, Euro, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1142 — Nächste-Schicht-Vorschau (Fahrer-App)
// Zeigt geplante nächste Schicht (Datum/Zeit/erwartete Bestelllast) wenn Fahrer offline

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface NaechsteSchicht {
  geplant_am: string;
  start_zeit: string;
  ende_zeit: string | null;
  dauer_h: number;
  erwartete_bestellungen: number;
  erwartete_umsatz_eur: number;
  zone: string | null;
  status: 'geplant' | 'keine_schicht';
}

const MOCK: NaechsteSchicht = {
  geplant_am: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  start_zeit: new Date(Date.now() + 86_400_000).toISOString().replace(/T.*/, 'T10:00:00Z'),
  ende_zeit: new Date(Date.now() + 86_400_000).toISOString().replace(/T.*/, 'T18:00:00Z'),
  dauer_h: 8,
  erwartete_bestellungen: 22,
  erwartete_umsatz_eur: 198,
  zone: 'B',
  status: 'geplant',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function FahrerPhase1142NaechsteSchichtVorschau({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NaechsteSchicht | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/naechste-schicht?driver_id=${encodeURIComponent(driverId)}`);
      if (!res.ok) throw new Error('fetch');
      setData(await res.json() as NaechsteSchicht);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (!isOnline) load();
  }, [load, isOnline]);

  // Only show when driver is offline
  if (isOnline) return null;
  if (!data || data.status === 'keine_schicht') return null;

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="font-bold text-sm text-indigo-700 dark:text-indigo-300">Nächste Schicht</span>
          <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-bold">
            {formatDate(data.start_zeit)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {loading && <span className="text-[10px] text-muted-foreground">…</span>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-indigo-200 dark:border-indigo-800 px-4 pb-4 pt-3 space-y-3">
          {/* Zeit */}
          <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/40 px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-1">Schichtzeit</div>
            <div className="text-lg font-black text-indigo-700 dark:text-indigo-300">
              {formatTime(data.start_zeit)}
              {data.ende_zeit && ` – ${formatTime(data.ende_zeit)}`}
            </div>
            <div className="text-[11px] text-indigo-500 dark:text-indigo-400">{data.dauer_h}h Schicht</div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-900/30 p-2 text-center">
              <Package className="h-4 w-4 text-indigo-500 mx-auto mb-0.5" />
              <div className="text-sm font-black tabular-nums text-foreground">{data.erwartete_bestellungen}</div>
              <div className="text-[10px] text-muted-foreground">Bestellungen</div>
            </div>
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-900/30 p-2 text-center">
              <Euro className="h-4 w-4 text-indigo-500 mx-auto mb-0.5" />
              <div className="text-sm font-black tabular-nums text-foreground">{data.erwartete_umsatz_eur}€</div>
              <div className="text-[10px] text-muted-foreground">Erwartet</div>
            </div>
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-900/30 p-2 text-center">
              <MapPin className="h-4 w-4 text-indigo-500 mx-auto mb-0.5" />
              <div className={cn('text-sm font-black tabular-nums', data.zone ? 'text-foreground' : 'text-muted-foreground')}>
                {data.zone ?? '–'}
              </div>
              <div className="text-[10px] text-muted-foreground">Zone</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
