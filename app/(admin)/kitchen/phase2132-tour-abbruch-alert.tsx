'use client';

import { useCallback, useEffect, useState } from 'react';
import { XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerQuote {
  driver_id: string;
  fahrer_name: string;
  gesamt: number;
  abgeschlossen: number;
  abgebrochen: number;
  quote: number;
}

interface ApiData {
  fahrer: FahrerQuote[];
  team_avg_quote: number;
  alert_count: number;
}

const MOCK: ApiData = {
  team_avg_quote: 88,
  alert_count: 1,
  fahrer: [
    { driver_id: 'a', fahrer_name: 'Max Müller',   gesamt: 12, abgeschlossen: 12, abgebrochen: 0, quote: 100 },
    { driver_id: 'b', fahrer_name: 'Anna Schmidt',  gesamt: 10, abgeschlossen: 9,  abgebrochen: 1, quote: 90  },
    { driver_id: 'c', fahrer_name: 'Klaus Weber',   gesamt: 8,  abgeschlossen: 6,  abgebrochen: 2, quote: 75  },
  ],
};

interface Props { locationId: string | null }

export function KitchenPhase2132TourAbbruchAlert({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/tour-abschlussquote?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const mitAbbruch   = data.fahrer.filter(f => f.abgebrochen > 0);
  const totalAbbruch = mitAbbruch.reduce((s, f) => s + f.abgebrochen, 0);
  const kritisch     = totalAbbruch >= 3;
  const hasAlert     = totalAbbruch > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <XCircle className={cn('h-4 w-4 shrink-0', kritisch ? 'text-red-500' : hasAlert ? 'text-amber-500' : 'text-muted-foreground')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Tour-Abbruch-Alert</span>
        {hasAlert && (
          <span className={cn(
            'flex items-center gap-1 text-[9px] font-bold rounded-full border px-2 py-0.5',
            kritisch
              ? 'text-red-600 bg-red-100 border-red-200'
              : 'text-amber-700 bg-amber-100 border-amber-200',
          )}>
            <AlertTriangle className="h-2.5 w-2.5" />{totalAbbruch} ABBRÜCHE
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* KPI-Row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Abbrüche heute', value: totalAbbruch, warn: totalAbbruch >= 3 },
              { label: 'Betroffene Fahrer', value: mitAbbruch.length, warn: false },
              { label: 'Team-Ø Quote', value: `${data.team_avg_quote}%`, warn: data.team_avg_quote < 80 },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-muted/30 border p-2 text-center">
                <p className="text-[9px] text-muted-foreground uppercase leading-tight">{k.label}</p>
                <p className={cn('text-base font-black tabular-nums', k.warn ? 'text-red-600' : '')}>{k.value}</p>
              </div>
            ))}
          </div>

          {kritisch && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                Kritisch: {totalAbbruch} Tour-Abbrüche heute — Dispatch informieren
              </p>
            </div>
          )}

          {!hasAlert ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">
              Keine Tour-Abbrüche heute
            </p>
          ) : (
            <div className="space-y-1.5">
              {mitAbbruch.map(f => (
                <div key={f.driver_id} className={cn(
                  'rounded-lg border px-3 py-2 flex items-center gap-2',
                  f.abgebrochen >= 2 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200',
                )}>
                  <XCircle className={cn('h-3.5 w-3.5 shrink-0', f.abgebrochen >= 2 ? 'text-red-500' : 'text-amber-500')} />
                  <span className="text-[11px] font-semibold flex-1 truncate">{f.fahrer_name}</span>
                  <span className={cn('text-[10px] font-bold tabular-nums', f.abgebrochen >= 2 ? 'text-red-600' : 'text-amber-700')}>
                    {f.abgebrochen}× abgebrochen
                  </span>
                  <span className="text-[9px] text-muted-foreground">{f.quote}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
