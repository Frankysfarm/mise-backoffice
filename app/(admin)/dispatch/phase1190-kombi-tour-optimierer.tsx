'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, GitMerge, Clock, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1190 — Kombi-Tour-Optimierer (Dispatch)
// Zeigt welche 2 wartenden Einzeltouren zur günstigsten Kombi-Route gebündelt werden könnten

interface Props { locationId: string | null }

type KombiKandidat = {
  tour_a_id: string;
  tour_a_adresse: string;
  tour_a_zone: string;
  tour_b_id: string;
  tour_b_adresse: string;
  tour_b_zone: string;
  zeitersparnis_min: number;
  distanz_ersparnis_km: number;
  kombi_eta_min: number;
  empfehlung: 'stark' | 'mittel' | 'schwach';
};

type ApiData = {
  kandidaten: KombiKandidat[];
  wartende_bestellungen: number;
  potenzielle_ersparnis_min: number;
  location_id: string | null;
  generiert_am: string;
};

const EMPFEHLUNG_COLOR: Record<KombiKandidat['empfehlung'], string> = {
  stark: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
  mittel: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  schwach: 'bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300 border-slate-300 dark:border-slate-700',
};

const EMPFEHLUNG_LABEL: Record<KombiKandidat['empfehlung'], string> = {
  stark: '⭐ Stark empfohlen',
  mittel: 'Empfohlen',
  schwach: 'Möglich',
};

export function DispatchPhase1190KombiTourOptimierer({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/kombi-tour-optimierer?location_id=${encodeURIComponent(locationId)}`);
      if (r.ok) setData(await r.json() as ApiData);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => void load(), 90000);
    return () => clearInterval(id);
  }, [load]);

  if (!locationId) return null;
  if (!data && !loading) return null;

  const kandidaten = data?.kandidaten ?? [];

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden border-violet-200 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-violet-500 shrink-0" />
          <span className="font-bold text-sm text-violet-700 dark:text-violet-300">Kombi-Tour-Optimierer</span>
          {data && (
            <span className="rounded-full bg-violet-500 text-white text-[10px] font-black px-2 py-0.5">
              {data.wartende_bestellungen} wartend
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-violet-400" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-violet-500" /> : <ChevronDown className="h-4 w-4 text-violet-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {data && (
            <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30 rounded-lg px-3 py-2">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Potenzielle Gesamt-Ersparnis: <strong>{data.potenzielle_ersparnis_min} Min</strong> durch Kombi-Touren</span>
            </div>
          )}

          {kandidaten.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Kombi-Kandidaten verfügbar.</p>
          )}

          <div className="space-y-2">
            {kandidaten.map((k, i) => (
              <div
                key={`${k.tour_a_id}-${k.tour_b_id}`}
                className={cn(
                  'rounded-lg border p-3 space-y-2',
                  'bg-white dark:bg-black/20 border-violet-200 dark:border-violet-700',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wide">
                    Kombi #{i + 1} · Zone {k.tour_a_zone}
                  </span>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', EMPFEHLUNG_COLOR[k.empfehlung])}>
                    {EMPFEHLUNG_LABEL[k.empfehlung]}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-black text-violet-400 mt-0.5 shrink-0">A</span>
                    <span className="text-xs text-foreground truncate">{k.tour_a_adresse}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-black text-violet-400 mt-0.5 shrink-0">B</span>
                    <span className="text-xs text-foreground truncate">{k.tour_b_adresse}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1 border-t border-violet-100 dark:border-violet-800">
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3 text-emerald-500" />
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">−{k.zeitersparnis_min} Min</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Route className="h-3 w-3 text-sky-500" />
                    <span className="font-bold text-sky-600 dark:text-sky-400">−{k.distanz_ersparnis_km} km</span>
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground">
                    ETA ~{k.kombi_eta_min} Min
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
