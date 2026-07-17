'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageOpen, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerVoll {
  fahrer_id: string;
  fahrer_name: string;
  touren_gesamt: number;
  abgeschlossen: number;
  abgebrochen: number;
  quote_pct: number;
}

interface ApiData {
  fahrer: FahrerVoll[];
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'a', fahrer_name: 'Max Müller',   touren_gesamt: 12, abgeschlossen: 12, abgebrochen: 0, quote_pct: 100 },
    { fahrer_id: 'b', fahrer_name: 'Anna Schmidt',  touren_gesamt: 10, abgeschlossen: 9,  abgebrochen: 1, quote_pct: 90  },
    { fahrer_id: 'c', fahrer_name: 'Klaus Weber',   touren_gesamt: 8,  abgeschlossen: 5,  abgebrochen: 2, quote_pct: 62.5 },
  ],
};

interface Props { locationId: string | null }

export function KitchenPhase2137TeillieferungsMonitor({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-touren-vollstaendigkeit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const teillieferungen = useMemo(
    () => data.fahrer.filter(f => f.abgebrochen > 0).sort((a, b) => b.abgebrochen - a.abgebrochen),
    [data.fahrer],
  );

  const totalTeil   = teillieferungen.reduce((s, f) => s + f.abgebrochen, 0);
  const eskalation  = totalTeil > 2;
  const hasAlert    = teillieferungen.length > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <PackageOpen className={cn('h-4 w-4 shrink-0', eskalation ? 'text-red-500' : hasAlert ? 'text-amber-500' : 'text-muted-foreground')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Teillieferungs-Monitor</span>
        {hasAlert && (
          <span className={cn(
            'flex items-center gap-1 text-[9px] font-bold rounded-full border px-2 py-0.5',
            eskalation
              ? 'text-red-600 bg-red-100 border-red-200'
              : 'text-amber-700 bg-amber-100 border-amber-200',
          )}>
            <AlertTriangle className="h-2.5 w-2.5" />{totalTeil} TEILLIEFERUNGEN
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {eskalation && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                Eskalation: {totalTeil} Teillieferungen heute — Dispatch benachrichtigen
              </p>
            </div>
          )}

          {!hasAlert ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">
              Keine Teillieferungen heute — alles vollständig abgeliefert
            </p>
          ) : (
            <div className="space-y-1.5">
              {teillieferungen.map(f => {
                const fehlend = f.touren_gesamt - f.abgeschlossen - f.abgebrochen;
                return (
                  <div key={f.fahrer_id} className={cn(
                    'rounded-lg border px-3 py-2 space-y-1',
                    f.abgebrochen >= 2 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200',
                  )}>
                    <div className="flex items-center gap-2">
                      <PackageOpen className={cn('h-3.5 w-3.5 shrink-0', f.abgebrochen >= 2 ? 'text-red-500' : 'text-amber-500')} />
                      <span className="text-[11px] font-semibold flex-1 truncate">{f.fahrer_name}</span>
                      <span className={cn('text-[10px] font-bold tabular-nums', f.abgebrochen >= 2 ? 'text-red-600' : 'text-amber-700')}>
                        {f.abgebrochen} fehlende Stopps
                      </span>
                    </div>
                    <div className="flex gap-3 text-[9px] text-muted-foreground ml-5">
                      <span>{f.abgeschlossen}/{f.touren_gesamt} abgeliefert</span>
                      {fehlend > 0 && <span>{fehlend} offen</span>}
                      <span>{f.quote_pct}% Index</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
