'use client';

import { useEffect, useState } from 'react';
import { Timer, MapPin, Truck, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchPrognose {
  batch_id: string;
  driver_name: string;
  aktuelle_stopps_gesamt: number;
  erledigte_stopps: number;
  verbleibende_stopps: number;
  gestartet_vor_min: number;
  min_pro_stopp_avg: number;
  rueckkehr_prognose_min: number;
  status: 'unterwegs' | 'fast_fertig' | 'zurueck';
}

interface ApiResponse {
  ok: boolean;
  batches: BatchPrognose[];
  aktive_touren: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

function StatusBadge({ status }: { status: BatchPrognose['status'] }) {
  if (status === 'fast_fertig') {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
        Kommt bald
      </span>
    );
  }
  if (status === 'zurueck') {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
        Zurück
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      Unterwegs
    </span>
  );
}

export function DispatchPhase666BatchRueckkehrPrognose({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/batch-rueckkehr-prognose?location_id=${locationId}`);
        const json = await res.json() as ApiResponse;
        if (active) setData(json);
      } catch {
        // noop
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && data?.batches.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold">Tour-Rückkehr-Prognose</span>
          {data && (
            <span className="text-xs text-muted-foreground">
              ({data.aktive_touren} aktiv)
            </span>
          )}
          {loading && !data && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {loading && !data && (
            <p className="text-xs text-muted-foreground py-2">Lade Touren…</p>
          )}
          {data?.batches.map((b) => {
            const progressPct = b.aktuelle_stopps_gesamt > 0
              ? Math.round((b.erledigte_stopps / b.aktuelle_stopps_gesamt) * 100)
              : 0;
            const barColor =
              b.status === 'fast_fertig' ? 'bg-emerald-500' :
              b.status === 'zurueck' ? 'bg-blue-500' :
              'bg-amber-500';

            return (
              <div key={b.batch_id} className="rounded-lg border border-border bg-background px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{b.driver_name}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {b.erledigte_stopps}/{b.aktuelle_stopps_gesamt} Stopps
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Timer className="h-3 w-3" />
                        Gestartet vor {b.gestartet_vor_min}m
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', barColor)}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-black font-mono tabular-nums text-foreground">
                      ~{b.rueckkehr_prognose_min}m
                    </div>
                    <div className="text-[10px] text-muted-foreground">Rückkehr</div>
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && !data?.batches.length && (
            <p className="text-xs text-muted-foreground text-center py-2">Keine aktiven Touren</p>
          )}
        </div>
      )}
    </div>
  );
}
