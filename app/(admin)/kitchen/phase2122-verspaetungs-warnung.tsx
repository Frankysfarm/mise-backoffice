'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, AlertTriangle, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoppAbweichung {
  stop_id: string;
  order_id: string;
  fahrer_name: string;
  adresse: string | null;
  zone: string | null;
  delta_min: number;
  abweichung: 'ok' | 'warnung' | 'kritisch';
  eskalation: boolean;
}

interface ApiData {
  stopps: StoppAbweichung[];
  eskalierend: number;
  ø_delta_min: number;
}

const MOCK: ApiData = {
  eskalierend: 1,
  ø_delta_min: 6.3,
  stopps: [
    { stop_id: 's1', order_id: 'o1', fahrer_name: 'Jonas L.', adresse: 'Bahnhofstr. 5', zone: 'B', delta_min: 14, abweichung: 'kritisch', eskalation: true  },
    { stop_id: 's2', order_id: 'o2', fahrer_name: 'Maria K.', adresse: 'Hauptstr. 12',  zone: 'A', delta_min: 8,  abweichung: 'warnung',  eskalation: false },
    { stop_id: 's3', order_id: 'o3', fahrer_name: 'Tom R.',   adresse: 'Müllerstr. 8',  zone: 'C', delta_min: -3, abweichung: 'ok',       eskalation: false },
  ],
};

interface Props { locationId?: string | null }

export function KitchenPhase2122VerspaetungsWarnung({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/eta-abweichungs-monitor?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const verspaetet = data.stopps.filter(s => s.delta_min > 0);
  const kritisch   = data.stopps.filter(s => s.abweichung === 'kritisch');
  const alarm      = data.eskalierend > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Clock className="h-4 w-4 text-red-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Verspätungs-Warnung</span>
        {alarm && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" /> {data.eskalierend} KRITISCH
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {/* KPI */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-muted/20 p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase">Verspätet</p>
              <p className={cn('text-base font-black tabular-nums', verspaetet.length > 0 ? 'text-red-600' : 'text-green-600')}>{verspaetet.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase">Kritisch</p>
              <p className={cn('text-base font-black tabular-nums', kritisch.length > 0 ? 'text-red-600' : 'text-green-600')}>{kritisch.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase">Ø Delta</p>
              <p className={cn('text-base font-black tabular-nums', data.ø_delta_min > 5 ? 'text-amber-600' : 'text-green-600')}>
                {data.ø_delta_min > 0 ? '+' : ''}{data.ø_delta_min.toFixed(0)}m
              </p>
            </div>
          </div>

          {verspaetet.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">Alle Lieferungen im Zeitplan ✓</p>
          ) : (
            <div className="space-y-1.5">
              {data.stopps
                .filter(s => s.delta_min > 0)
                .sort((a, b) => b.delta_min - a.delta_min)
                .map(s => (
                <div key={s.stop_id} className={cn(
                  'rounded-lg border p-2.5 space-y-1',
                  s.abweichung === 'kritisch' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                )}>
                  <div className="flex items-center gap-2">
                    {s.abweichung === 'kritisch'
                      ? <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      : <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    }
                    <span className={cn('text-[11px] font-bold flex-1', s.abweichung === 'kritisch' ? 'text-red-700' : 'text-amber-700')}>
                      {s.fahrer_name}
                    </span>
                    <span className={cn(
                      'text-[12px] font-black tabular-nums',
                      s.abweichung === 'kritisch' ? 'text-red-600' : 'text-amber-600'
                    )}>
                      +{s.delta_min} Min
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-5 text-[9px] text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{s.adresse ?? 'Adresse unbekannt'}</span>
                    {s.zone && <span className="font-bold">· Zone {s.zone}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
