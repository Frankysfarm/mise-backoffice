'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

type FahrerW = {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_ueber8min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerW[];
  team_avg_min: number;
  alert_count: number;
};

function barColor(a: FahrerW['ampel']): string {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-400';
  return 'bg-red-500';
}

export function KitchenPhase2268WartezeitTicker({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/fahrer-abholwartezeit?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertFahrer = useMemo(
    () => (data?.fahrer ?? []).filter(f => f.ampel === 'rot'),
    [data],
  );

  const teamAmpelColor = useMemo((): string => {
    const avg = data?.team_avg_min ?? 0;
    if (avg <= 4) return 'text-green-600';
    if (avg <= 8) return 'text-yellow-600';
    return 'text-red-600';
  }, [data]);

  if (!locationId || (!loading && !data)) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Abholwartezeit</span>
          {data && (
            <span className={`rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold ${teamAmpelColor}`}>
              Team-Ø {data.team_avg_min} Min
            </span>
          )}
          {(data?.alert_count ?? 0) > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {data!.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {loading && <p className="text-xs text-muted-foreground">Lade Wartezeiten…</p>}

          {!loading && data && (
            <>
              {/* Team KPI */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/20 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Team-Ø</div>
                  <div className={`text-lg font-black tabular-nums ${teamAmpelColor}`}>{data.team_avg_min} Min</div>
                </div>
                <div className={`rounded-lg border p-2 text-center ${data.alert_count > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alerts &gt;8 Min</div>
                  <div className={`text-lg font-black tabular-nums ${data.alert_count > 0 ? 'text-red-600' : 'text-green-600'}`}>{data.alert_count}</div>
                </div>
              </div>

              {/* Alert Banner */}
              {alertFahrer.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 dark:text-red-300">
                    <span className="font-bold">{alertFahrer.length} Fahrer warten zu lang:</span>{' '}
                    {alertFahrer.map(f => `${f.fahrer_name} (${f.avg_min} Min)`).join(', ')} — Dispatcher benachrichtigen!
                  </div>
                </div>
              )}

              {/* Driver Bars */}
              <div className="space-y-1.5">
                {data.fahrer.map(f => (
                  <div key={f.fahrer_id} className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-muted-foreground w-20 shrink-0 truncate">{f.fahrer_name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor(f.ampel)}`}
                        style={{ width: `${Math.min(100, (f.avg_min / 15) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums text-muted-foreground w-12 text-right shrink-0">{f.avg_min} Min</span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground">
                Ampel: 🟢 ≤4 Min · 🟡 ≤8 Min · 🔴 &gt;8 Min. Aktualisierung alle 15 Min.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
