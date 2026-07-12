'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1195 — Zone-Wartezeit-Analyse (Dispatch)
// Ø-Wartezeit Bestellung→Zuteilung je Zone letzte 2h + Längstwartende Bestellung

interface Props { locationId: string | null }

type ZoneWaiting = {
  zone: string;
  avg_wait_min: number;
  order_count: number;
  longest_wait_min: number | null;
  laengste_bestell_nr: string | null;
};

type ApiData = {
  zonen: ZoneWaiting[];
  gesamt_avg_wait_min: number;
  laengste_warte_min: number | null;
  laengste_bestell_nr: string | null;
  generiert_am: string;
};

const MOCK: ApiData = {
  zonen: [
    { zone: 'Nord', avg_wait_min: 12, order_count: 8, longest_wait_min: 24, laengste_bestell_nr: 'B-0042' },
    { zone: 'Mitte', avg_wait_min: 7, order_count: 15, longest_wait_min: 19, laengste_bestell_nr: 'B-0039' },
    { zone: 'Süd', avg_wait_min: 18, order_count: 5, longest_wait_min: 31, laengste_bestell_nr: 'B-0035' },
    { zone: 'West', avg_wait_min: 5, order_count: 11, longest_wait_min: 9, laengste_bestell_nr: 'B-0044' },
  ],
  gesamt_avg_wait_min: 11,
  laengste_warte_min: 31,
  laengste_bestell_nr: 'B-0035',
  generiert_am: new Date().toISOString(),
};

function level(min: number): 'ok' | 'warnung' | 'kritisch' {
  if (min <= 8) return 'ok';
  if (min <= 16) return 'warnung';
  return 'kritisch';
}

const LEVEL_STYLES = {
  ok:       { bar: 'bg-matcha-400',   badge: 'bg-matcha-500 text-white',   text: 'text-matcha-600 dark:text-matcha-400'  },
  warnung:  { bar: 'bg-amber-400',    badge: 'bg-amber-500 text-white',    text: 'text-amber-600 dark:text-amber-400'    },
  kritisch: { bar: 'bg-red-500',      badge: 'bg-red-600 text-white',      text: 'text-red-600 dark:text-red-400'        },
};

export function DispatchPhase1195ZoneWartezeitAnalyse({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/zone-wartezeit-analyse?location_id=${encodeURIComponent(locationId)}`);
      setData(r.ok ? await r.json() as ApiData : MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => void load(), 90000);
    return () => clearInterval(id);
  }, [load]);

  const d = data ?? MOCK;
  const maxWait = Math.max(...d.zonen.map(z => z.avg_wait_min), 1);

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="h-4 w-4 text-sky-500 shrink-0" />
          <span className="font-bold text-sm text-sky-700 dark:text-sky-300">Zone-Wartezeit-Analyse</span>
          <span className="rounded-full bg-sky-500 text-white text-[10px] font-black px-2 py-0.5">
            Ø {d.gesamt_avg_wait_min} Min
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-sky-500" />}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-sky-400" />
          : <ChevronDown className="h-4 w-4 text-sky-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Longest wait alert */}
          {d.laengste_warte_min !== null && d.laengste_warte_min > 15 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm font-bold text-red-700 dark:text-red-300">
                Längste Wartezeit: <span className="font-black">{d.laengste_warte_min} Min</span>
                {d.laengste_bestell_nr && ` · ${d.laengste_bestell_nr}`}
              </span>
            </div>
          )}

          {/* Zone bars */}
          <div className="space-y-2">
            {d.zonen.map(z => {
              const lv = level(z.avg_wait_min);
              const st = LEVEL_STYLES[lv];
              const widthPct = Math.round((z.avg_wait_min / maxWait) * 100);
              return (
                <div key={z.zone} className="rounded-lg bg-white dark:bg-black/20 border border-sky-200 dark:border-sky-700 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-sky-500 shrink-0" />
                      <span className="text-xs font-bold text-foreground">Zone {z.zone}</span>
                      <span className="text-[9px] text-muted-foreground">({z.order_count} Bestell.)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {z.longest_wait_min !== null && (
                        <span className={cn('text-[9px] font-medium', st.text)}>max {z.longest_wait_min} Min</span>
                      )}
                      <span className={cn('rounded-full text-[9px] font-black px-2 py-0.5', st.badge)}>
                        Ø {z.avg_wait_min} Min
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-sky-100 dark:bg-sky-900 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', st.bar)}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground px-1">Letzte 2 Stunden. Grün ≤8 Min · Amber ≤16 Min · Rot &gt;16 Min.</p>
        </div>
      )}
    </div>
  );
}
