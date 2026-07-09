'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpCircle, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Phase 913 — Zonen-Priorisierungs-Override (Dispatch)
 *
 * Manuelle Priorisierung einer Zone A/B/C/D bei Engpass.
 * Priorität: hoch / normal / niedrig — wird per API persistiert und
 * steht dem Dispatch-Algorithmus als Override-Signal zur Verfügung.
 */

interface Props {
  locationId: string | null;
}

type Prioritaet = 'hoch' | 'normal' | 'niedrig';

interface ZoneState {
  zone: string;
  prioritaet: Prioritaet;
  saving: boolean;
  saved: boolean;
}

const ZONES = ['A', 'B', 'C', 'D'];

const ZONE_COLOR: Record<string, string> = {
  A: 'matcha',
  B: 'blue',
  C: 'amber',
  D: 'rose',
};

const PRIO_COLOR: Record<Prioritaet, string> = {
  hoch: 'bg-red-500 text-white border-red-500',
  normal: 'bg-matcha-500 text-white border-matcha-500',
  niedrig: 'bg-stone-300 text-stone-700 border-stone-300',
};

const PRIO_LABEL: Record<Prioritaet, string> = {
  hoch: 'Hoch',
  normal: 'Normal',
  niedrig: 'Niedrig',
};

export function DispatchPhase913ZonenPriorisierungsOverride({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [zones, setZones] = useState<ZoneState[]>(
    ZONES.map((z) => ({ zone: z, prioritaet: 'normal', saving: false, saved: false })),
  );
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/zonen-priorisierungs-override?location_id=${locationId}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const overrides: { zone: string; prioritaet: Prioritaet }[] = json.overrides ?? [];
      setZones((prev) =>
        prev.map((z) => {
          const hit = overrides.find((o) => o.zone === z.zone);
          return hit ? { ...z, prioritaet: hit.prioritaet } : z;
        }),
      );
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const setPrioritaet = async (zone: string, prioritaet: Prioritaet) => {
    if (!locationId) return;
    setZones((prev) =>
      prev.map((z) => (z.zone === zone ? { ...z, saving: true, saved: false } : z)),
    );
    try {
      await fetch('/api/delivery/admin/zonen-priorisierungs-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, zone, prioritaet }),
      });
      setZones((prev) =>
        prev.map((z) =>
          z.zone === zone ? { ...z, prioritaet, saving: false, saved: true } : z,
        ),
      );
      setTimeout(() =>
        setZones((prev) =>
          prev.map((z) => (z.zone === zone ? { ...z, saved: false } : z)),
        ), 2000);
    } catch {
      setZones((prev) =>
        prev.map((z) => (z.zone === zone ? { ...z, saving: false } : z)),
      );
    }
  };

  const hochCount = zones.filter((z) => z.prioritaet === 'hoch').length;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted/30 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <ArrowUpCircle className={cn('h-4 w-4 shrink-0', hochCount > 0 ? 'text-red-500' : 'text-muted-foreground')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-foreground">
          Zonen-Priorisierung
        </span>
        {hochCount > 0 && (
          <span className="rounded-full bg-red-100 dark:bg-red-900/40 border border-red-300 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300">
            {hochCount} hoch
          </span>
        )}
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <span className="text-[10px] text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground mb-3">
            Setze eine Zone auf „Hoch", um sie bei Dispatch bevorzugt zu bedienen.
          </p>
          {zones.map((z) => (
            <div key={z.zone} className="flex items-center gap-3">
              <span className={cn(
                'w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-black border-2',
                `border-${ZONE_COLOR[z.zone]}-400 text-${ZONE_COLOR[z.zone]}-700 dark:text-${ZONE_COLOR[z.zone]}-300 bg-${ZONE_COLOR[z.zone]}-50 dark:bg-${ZONE_COLOR[z.zone]}-950/30`,
              )}>
                {z.zone}
              </span>
              <span className="text-xs font-semibold text-foreground w-16 shrink-0">
                Zone {z.zone}
              </span>
              <div className="flex gap-1.5 flex-1">
                {(['hoch', 'normal', 'niedrig'] as Prioritaet[]).map((p) => (
                  <button
                    key={p}
                    disabled={z.saving}
                    onClick={() => setPrioritaet(z.zone, p)}
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition',
                      z.prioritaet === p
                        ? PRIO_COLOR[p]
                        : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted',
                    )}
                  >
                    {PRIO_LABEL[p]}
                  </button>
                ))}
              </div>
              <div className="w-5 shrink-0 flex items-center justify-center">
                {z.saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {z.saved && <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
