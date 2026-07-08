'use client';

import { useEffect, useState } from 'react';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerEffizienz {
  driver_id: string;
  fahrer_name: string;
  touren_anzahl: number;
  gesamt_stopps: number;
  gesamt_km: number;
  lieferungen_pro_h: number;
  km_pro_tour: number;
  schicht_dauer_h: number;
  effizienz_score: number;
  stufe: 'top' | 'gut' | 'mittel' | 'niedrig';
}

interface BatchPrognose {
  batch_id: string;
  driver_name: string;
  aktuelle_stopps_gesamt: number;
  erledigte_stopps: number;
  verbleibende_stopps: number;
  rueckkehr_prognose_min: number;
  status: 'unterwegs' | 'fast_fertig' | 'zurueck';
}

interface Props {
  locationId: string | null;
}

const STUFE_STYLES = {
  top:     { dot: 'bg-green-500', label: 'Top', text: 'text-green-700 dark:text-green-400' },
  gut:     { dot: 'bg-blue-500',  label: 'Gut', text: 'text-blue-700 dark:text-blue-400' },
  mittel:  { dot: 'bg-amber-500', label: 'Mittel', text: 'text-amber-700 dark:text-amber-500' },
  niedrig: { dot: 'bg-slate-400', label: 'Niedrig', text: 'text-slate-600 dark:text-slate-400' },
};

export function DispatchPhase671FahrerVerfuegbarkeitsAmpel({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerEffizienz[]>([]);
  const [batches, setBatches] = useState<BatchPrognose[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      try {
        const [effRes, batchRes] = await Promise.all([
          fetch(`/api/delivery/admin/fahrer-touren-effizienz?location_id=${locationId}`, { cache: 'no-store' }),
          fetch(`/api/delivery/admin/batch-rueckkehr-prognose?location_id=${locationId}`, { cache: 'no-store' }),
        ]);
        const effJson = await effRes.json();
        const batchJson = await batchRes.json();
        if (active) {
          setFahrer(effJson.ok ? effJson.fahrer : []);
          setBatches(batchJson.ok ? batchJson.batches : []);
        }
      } catch {
        // silent
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  // Merge: fahrer + aktive Batch-Prognosen für Rückkehr-ETA
  const batchByDriver = new Map<string, BatchPrognose[]>();
  for (const b of batches) {
    // match by name (best effort - we don't have driver_id in batch prognose endpoint)
    const f = fahrer.find((x) => x.fahrer_name === b.driver_name);
    if (f) {
      const arr = batchByDriver.get(f.driver_id) ?? [];
      arr.push(b);
      batchByDriver.set(f.driver_id, arr);
    }
  }

  const verfuegbar = fahrer.filter((f) => !batchByDriver.has(f.driver_id) || batchByDriver.get(f.driver_id)!.every((b) => b.status === 'zurueck'));
  const unterwegs = fahrer.filter((f) => (batchByDriver.get(f.driver_id) ?? []).some((b) => b.status !== 'zurueck'));

  if (fahrer.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 mb-4">
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
            Fahrer-Verfügbarkeits-Ampel
          </span>
          <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
            {verfuegbar.length} frei
          </span>
          {unterwegs.length > 0 && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
              {unterwegs.length} unterwegs
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {fahrer.map((f) => {
            const aktiveBatches = batchByDriver.get(f.driver_id) ?? [];
            const istUnterwegs = aktiveBatches.some((b) => b.status !== 'zurueck');
            const naechsteRueckkehr = aktiveBatches.length > 0
              ? Math.min(...aktiveBatches.map((b) => b.rueckkehr_prognose_min))
              : null;
            const s = STUFE_STYLES[f.stufe];

            return (
              <div
                key={f.driver_id}
                className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full flex-shrink-0',
                      istUnterwegs ? 'bg-amber-400' : 'bg-green-500',
                    )}
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {f.fahrer_name}
                  </span>
                  <span className={cn('text-xs font-medium', s.text)}>
                    {s.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  {istUnterwegs && naechsteRueckkehr !== null ? (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      ~{naechsteRueckkehr} Min
                    </span>
                  ) : (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Verfügbar
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {f.touren_anzahl} Touren · {f.lieferungen_pro_h}/h
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
