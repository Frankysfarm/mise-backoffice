'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1130 — Zutaten-Schwund-Warnung (Kitchen)
// Alert wenn Verbrauch einer Zutat 20% über Prognose liegt (mögliche Fehler oder Verlust)

interface Props {
  locationId: string | null;
}

type ZutatWarnung = {
  zutat: string;
  prognose_einheiten: number;
  verbrauch_einheiten: number;
  abweichung_pct: number;
  status: 'ok' | 'warnung' | 'kritisch';
};

type ApiResponse = {
  warnungen: ZutatWarnung[];
  gesamt_ok: number;
  gesamt_warnung: number;
  gesamt_kritisch: number;
  generiert_am: string;
};

const MOCK: ApiResponse = {
  warnungen: [
    { zutat: 'Tomatensauce',   prognose_einheiten: 40, verbrauch_einheiten: 52, abweichung_pct: 30, status: 'kritisch' },
    { zutat: 'Mozzarella',     prognose_einheiten: 30, verbrauch_einheiten: 37, abweichung_pct: 23, status: 'warnung' },
    { zutat: 'Rucola',         prognose_einheiten: 15, verbrauch_einheiten: 14, abweichung_pct: -7, status: 'ok' },
    { zutat: 'Pizzateig 30cm', prognose_einheiten: 60, verbrauch_einheiten: 62, abweichung_pct: 3,  status: 'ok' },
    { zutat: 'Parmesan',       prognose_einheiten: 20, verbrauch_einheiten: 25, abweichung_pct: 25, status: 'warnung' },
  ],
  gesamt_ok: 2,
  gesamt_warnung: 2,
  gesamt_kritisch: 1,
  generiert_am: new Date().toISOString(),
};

function statusColor(s: ZutatWarnung['status']) {
  if (s === 'kritisch') return 'text-red-600 dark:text-red-400';
  if (s === 'warnung')  return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function statusBg(s: ZutatWarnung['status']) {
  if (s === 'kritisch') return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  if (s === 'warnung')  return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
  return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
}

export function KitchenPhase1130ZutatenSchwundWarnung({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/zutaten-schwund-warnung?location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) throw new Error('fetch');
      setData(await res.json() as ApiResponse);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const kritischCount = data?.gesamt_kritisch ?? 0;
  const warnungCount = data?.gesamt_warnung ?? 0;
  const hasAlert = kritischCount > 0 || warnungCount > 0;

  const headerColor = kritischCount > 0
    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    : warnungCount > 0
    ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
    : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20';

  const headerTextColor = kritischCount > 0
    ? 'text-red-700 dark:text-red-300'
    : warnungCount > 0
    ? 'text-amber-700 dark:text-amber-300'
    : 'text-emerald-700 dark:text-emerald-300';

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', headerColor)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {hasAlert
            ? <AlertTriangle className={cn('h-4 w-4', headerTextColor)} />
            : <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          }
          <span className={cn('font-bold text-sm', headerTextColor)}>Zutaten-Schwund</span>
          {kritischCount > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-[10px] font-bold">
              {kritischCount} kritisch
            </span>
          )}
          {warnungCount > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
              {warnungCount} Warnung
            </span>
          )}
          {!hasAlert && (
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
              Alles im Soll
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {loading && <span className="text-[10px] text-muted-foreground">…</span>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && data && (
        <div className="px-4 pb-4 space-y-2 border-t border-inherit pt-3">
          <p className="text-[10px] text-muted-foreground">
            Verbrauch &gt;20% über Prognose = möglicher Fehler oder Schwund. Prüfe betroffene Zutaten.
          </p>
          {data.warnungen
            .sort((a, b) => b.abweichung_pct - a.abweichung_pct)
            .map(w => (
              <div key={w.zutat} className={cn('rounded-lg border px-3 py-2 flex items-center justify-between gap-2', statusBg(w.status))}>
                <div>
                  <div className={cn('font-semibold text-sm', statusColor(w.status))}>{w.zutat}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Prognose: {w.prognose_einheiten} · Verbrauch: {w.verbrauch_einheiten}
                  </div>
                </div>
                <div className={cn('font-black text-sm tabular-nums', statusColor(w.status))}>
                  {w.abweichung_pct > 0 ? '+' : ''}{w.abweichung_pct}%
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
