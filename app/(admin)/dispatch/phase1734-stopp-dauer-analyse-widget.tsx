'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, AlertTriangle, Trophy } from 'lucide-react';

/**
 * Phase 1734 — Stopp-Dauer-Analyse-Widget (Dispatch)
 *
 * Phase1732-API: Ø Dwell-Time je Fahrer + Ausreißer-Alert;
 * 30-Min-Polling; in dispatch/client.tsx.
 */

interface FahrerStoppDauer {
  driver_id: string;
  fahrer_name: string;
  stopps_heute: number;
  avg_dwell_min: number;
  ausreisser: number;
  effizienz_rank: number;
  alert: boolean;
}

interface StoppDauerEintrag {
  stopp_typ: string;
  durchschnitt_min: number;
  anzahl: number;
  ausreisser_anzahl: number;
}

interface StoppDauerResponse {
  typen: StoppDauerEintrag[];
  fahrer: FahrerStoppDauer[];
  location_id: string;
  datum: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const MOCK: StoppDauerResponse = {
  typen: [
    { stopp_typ: 'Lieferung', durchschnitt_min: 4.2, anzahl: 34, ausreisser_anzahl: 5 },
    { stopp_typ: 'Abholung Küche', durchschnitt_min: 2.5, anzahl: 18, ausreisser_anzahl: 2 },
  ],
  fahrer: [
    { driver_id: 'd1', fahrer_name: 'Mehmet A.', stopps_heute: 14, avg_dwell_min: 3.1, ausreisser: 1, effizienz_rank: 1, alert: false },
    { driver_id: 'd2', fahrer_name: 'Julia S.',  stopps_heute: 12, avg_dwell_min: 4.5, ausreisser: 3, effizienz_rank: 2, alert: false },
    { driver_id: 'd3', fahrer_name: 'Kevin R.',  stopps_heute: 10, avg_dwell_min: 7.8, ausreisser: 6, effizienz_rank: 3, alert: true  },
  ],
  location_id: 'mock',
  datum: new Date().toISOString().split('T')[0],
  generiert_am: new Date().toISOString(),
};

export function DispatchPhase1734StoppDauerAnalyseWidget({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<StoppDauerResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/stopp-dauer-analyse?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const hasAlert = data?.fahrer.some(f => f.alert) ?? false;

  return (
    <div className={cn(
      'rounded-xl border p-3 mb-3',
      hasAlert
        ? 'border-red-200 dark:border-red-800 bg-red-50/20 dark:bg-red-950/10'
        : 'border-orange-200 dark:border-orange-800 bg-orange-50/20 dark:bg-orange-950/10',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className={cn(
          'flex items-center gap-2 text-sm font-bold',
          hasAlert ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300',
        )}>
          <Clock className="h-4 w-4" />
          Stopp-Dauer-Analyse
          {hasAlert && (
            <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">
              <AlertTriangle className="h-3 w-3" />
              Alert
            </span>
          )}
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading && !data && (
            <p className="text-xs text-muted-foreground animate-pulse">Lade…</p>
          )}

          {data && (
            <>
              {/* Stopp-Typ-Übersicht */}
              {data.typen.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Ø Dwell-Zeit je Stopp-Typ</p>
                  <div className="space-y-1.5">
                    {data.typen.map(t => (
                      <div key={t.stopp_typ} className="flex items-center gap-2">
                        <span className="w-32 shrink-0 text-[11px] text-muted-foreground truncate">{t.stopp_typ}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', t.durchschnitt_min <= 4 ? 'bg-green-500' : t.durchschnitt_min <= 7 ? 'bg-amber-500' : 'bg-red-500')}
                            style={{ width: `${Math.min(100, (t.durchschnitt_min / 15) * 100)}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right text-[11px] font-bold tabular-nums">
                          {t.durchschnitt_min} Min
                        </span>
                        <span className="w-12 shrink-0 text-right text-[10px] text-muted-foreground">
                          n={t.anzahl}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fahrer-Ranking */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Effizienz-Ranking Fahrer</p>
                <div className="space-y-1.5">
                  {data.fahrer.map(f => (
                    <div
                      key={f.driver_id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-2.5 py-2',
                        f.alert
                          ? 'border-red-200 dark:border-red-700 bg-red-50/40 dark:bg-red-900/20'
                          : 'border-border/50 bg-background/50',
                      )}
                    >
                      <span className="w-5 shrink-0 text-center text-[11px] font-black text-muted-foreground">
                        {f.effizienz_rank === 1 ? <Trophy className="h-3.5 w-3.5 text-yellow-500 mx-auto" /> : `#${f.effizienz_rank}`}
                      </span>
                      <span className="flex-1 text-[12px] font-semibold truncate">{f.fahrer_name}</span>
                      <span className="text-[11px] tabular-nums font-bold">
                        {f.avg_dwell_min} Min
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {f.stopps_heute} Stopps
                      </span>
                      {f.alert && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground">
                30-Min-Polling · Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
