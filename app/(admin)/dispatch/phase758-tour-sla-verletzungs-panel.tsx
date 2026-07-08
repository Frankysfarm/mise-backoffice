'use client';

import { useCallback, useEffect, useState } from 'react';
import { Siren, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string | null;
  slaMinus?: number;
}

interface SlaPanelEintrag {
  batch_id: string;
  driver_name: string;
  dauer_min: number;
  ueberzogen_min: number;
  stops: number;
}

const MOCK: SlaPanelEintrag[] = [
  { batch_id: '1', driver_name: 'Max M.', dauer_min: 62, ueberzogen_min: 17, stops: 2 },
  { batch_id: '2', driver_name: 'Lukas B.', dauer_min: 58, ueberzogen_min: 13, stops: 1 },
];

export function DispatchPhase758TourSlaPanelVerletzung({ locationId, slaMinus = 45 }: Props) {
  const [data, setData] = useState<SlaPanelEintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-sla-verletzung?location_id=${locationId}&sla_min=${slaMinus}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.verletzungen)) {
          setData(json.verletzungen);
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [locationId, slaMinus]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!loading && data.length === 0) return null;

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${data.length > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-card'}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Siren className={`h-4 w-4 ${data.length > 0 ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
          <span className="text-sm font-semibold">SLA-Verletzungen</span>
          {!loading && data.length > 0 && (
            <span className="text-xs bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-full px-2 py-0.5 font-semibold">
              {data.length} Tour{data.length !== 1 ? 'en' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-16 animate-pulse rounded bg-muted" />
          ) : (
            data.map((e) => (
              <div key={e.batch_id} className="flex items-center gap-3 rounded-lg bg-red-100/50 dark:bg-red-950/30 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{e.driver_name}</p>
                  <p className="text-[10px] text-muted-foreground">{e.dauer_min} Min gesamt · {e.stops} Stop{e.stops !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums shrink-0">
                  +{e.ueberzogen_min} Min
                </span>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">SLA {slaMinus} Min · 1-Min Update</p>
        </div>
      )}
    </div>
  );
}
