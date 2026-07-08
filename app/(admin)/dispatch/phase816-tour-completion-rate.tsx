'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface CompletionData {
  abgeschlossen: number;
  aktiv: number;
  geplant: number;
  gesamt: number;
  completionPct: number;
}

const MOCK: CompletionData = {
  abgeschlossen: 18,
  aktiv: 5,
  geplant: 3,
  gesamt: 26,
  completionPct: 69,
};

interface Props {
  locationId: string | null;
}

export function DispatchPhase816TourCompletionRate({ locationId }: Props) {
  const [data, setData] = useState<CompletionData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/tour-completion-rate?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? MOCK);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) return null;
  if (!data) return null;

  const pct = data.gesamt > 0 ? Math.round((data.abgeschlossen / data.gesamt) * 100) : 0;
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-blue-500';

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground">Tour-Abschlussrate (Heute)</span>
        <span className="text-sm font-bold tabular-nums text-foreground">{pct}%</span>
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center gap-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-base font-bold tabular-nums text-emerald-700">{data.abgeschlossen}</span>
          <span className="text-[9px] text-emerald-600 uppercase tracking-wide">Fertig</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 p-2">
          <Circle className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-base font-bold tabular-nums text-blue-700">{data.aktiv}</span>
          <span className="text-[9px] text-blue-600 uppercase tracking-wide">Aktiv</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted p-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-base font-bold tabular-nums text-foreground">{data.geplant}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Geplant</span>
        </div>
      </div>
    </div>
  );
}
