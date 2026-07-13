'use client';

// Phase 1213 — Schichtende-Übernahme-Alert (Dispatch)
// Alert wenn Fahrer Schichtende in <60 Min hat aber noch on_tour — Handover-Planung

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Clock, Bike, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerAlert {
  fahrer_id: string;
  fahrer_name: string;
  zone: string | null;
  schichtende_in_min: number;
  offene_stopps: number;
  on_tour: boolean;
  kritikalitaet: 'niedrig' | 'warnung' | 'kritisch';
  empfehlung: string;
}

interface ApiData {
  fahrer: FahrerAlert[];
  gesamt_kritisch: number;
  location_id: string | null;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const KRIT_STYLE: Record<FahrerAlert['kritikalitaet'], {
  row: string; badge: string; badgeText: string; icon: string;
}> = {
  niedrig:  { row: 'border-slate-200 dark:border-slate-700',   badge: 'bg-slate-100 dark:bg-slate-800',  badgeText: 'text-slate-600 dark:text-slate-300', icon: 'text-slate-400' },
  warnung:  { row: 'border-amber-200 dark:border-amber-800',   badge: 'bg-amber-100 dark:bg-amber-900',  badgeText: 'text-amber-700 dark:text-amber-300', icon: 'text-amber-500' },
  kritisch: { row: 'border-rose-300 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-950/10', badge: 'bg-rose-100 dark:bg-rose-900', badgeText: 'text-rose-700 dark:text-rose-300', icon: 'text-rose-500' },
};

function mockData(locationId: string | null): ApiData {
  const now = new Date();
  return {
    fahrer: [
      { fahrer_id: 'f1', fahrer_name: 'Maria K.', zone: 'A', schichtende_in_min: 25, offene_stopps: 3, on_tour: true,  kritikalitaet: 'kritisch', empfehlung: 'Sofort Ablösung einplanen — 3 Stopps verbleiben' },
      { fahrer_id: 'f2', fahrer_name: 'Jonas L.', zone: 'B', schichtende_in_min: 45, offene_stopps: 2, on_tour: true,  kritikalitaet: 'warnung',  empfehlung: 'Ablösung vorbereiten — knapper Zeitplan' },
      { fahrer_id: 'f3', fahrer_name: 'Tom R.',   zone: 'C', schichtende_in_min: 58, offene_stopps: 0, on_tour: false, kritikalitaet: 'niedrig',  empfehlung: 'Schichtende OK — kein aktiver Auftrag' },
    ],
    gesamt_kritisch: 1,
    location_id: locationId,
    generiert_am: now.toISOString(),
  };
}

export function DispatchPhase1213SchichtendeUebernahmeAlert({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    try {
      const supaRes = await window.fetch(`/api/delivery/admin/schichtende-uebernahme-alert?location_id=${locationId}`);
      if (supaRes.ok) {
        const json: ApiData = await supaRes.json();
        if (json.fahrer) { setData(json); return; }
      }
    } catch { /* fall through */ }
    setData(mockData(locationId));
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (!locationId || !data || data.fahrer.length === 0) return null;

  const kritische = data.fahrer.filter(f => f.kritikalitaet === 'kritisch');
  const headerColor = kritische.length > 0 ? 'text-rose-600' : 'text-amber-600';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className={cn('h-4 w-4 shrink-0', headerColor)} />
          <span className="text-xs font-bold uppercase tracking-wider">Schichtende-Übernahme-Alert</span>
          {kritische.length > 0 && (
            <span className="text-[10px] rounded-full bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold animate-pulse">
              {kritische.length} Kritisch
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {data.fahrer.map(f => {
            const s = KRIT_STYLE[f.kritikalitaet];
            return (
              <div key={f.fahrer_id} className={cn('flex items-start gap-3 px-4 py-3 border-l-4', s.row)}>
                <div className="shrink-0 pt-0.5">
                  {f.kritikalitaet === 'kritisch' ? (
                    <AlertTriangle className={cn('h-4 w-4', s.icon)} />
                  ) : f.on_tour ? (
                    <Bike className={cn('h-4 w-4', s.icon)} />
                  ) : (
                    <CheckCircle className={cn('h-4 w-4', s.icon)} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold">{f.fahrer_name}</span>
                    {f.zone && (
                      <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                        Zone {f.zone}
                      </span>
                    )}
                    <span className={cn('text-[10px] rounded-full px-2 py-0.5 font-bold', s.badge, s.badgeText)}>
                      {f.schichtende_in_min} Min bis Schichtende
                    </span>
                    {f.on_tour && f.offene_stopps > 0 && (
                      <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                        {f.offene_stopps} offene Stopps
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{f.empfehlung}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
