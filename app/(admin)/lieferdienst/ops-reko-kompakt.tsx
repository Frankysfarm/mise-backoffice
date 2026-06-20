'use client';

import { useEffect, useState, useCallback } from 'react';
import { Lightbulb, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stats {
  totalActive: number;
  criticalCount: number;
  highCount: number;
  resolvedToday: number;
}

interface Dashboard {
  active: Array<{ id: string; priority: string; title: string }>;
  stats: Stats;
}

export function LieferdienstOpsRekoKompakt({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/ops-recommendations');
      if (res.ok) setData(await res.json() as Dashboard);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 90_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Empfehlungen laden…</span>
      </div>
    );
  }

  if (!data) return null;

  const { stats } = data;
  const allGood = stats.totalActive === 0;

  const urgencyColor = stats.criticalCount > 0
    ? 'border-red-200 bg-red-50'
    : stats.highCount > 0
    ? 'border-amber-200 bg-amber-50'
    : 'border-matcha-200 bg-matcha-50';

  const topReco = data.active[0];

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', urgencyColor)}>
      <div className="flex items-center gap-3">
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          allGood ? 'bg-matcha-100 text-matcha-700' : 'bg-amber-100 text-amber-700',
        )}>
          {allGood ? <CheckCircle2 className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
        </div>
        <div>
          <div className="text-sm font-bold text-char">Ops-Empfehlungen</div>
          <div className="text-xs text-stone-400">
            {allGood
              ? 'Alle Systeme im grünen Bereich'
              : `${stats.totalActive} aktiv · ${stats.resolvedToday} heute erledigt`}
          </div>
        </div>
        {!allGood && (
          <div className="ml-auto flex gap-1.5">
            {stats.criticalCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white">
                <AlertTriangle className="h-2.5 w-2.5" />
                {stats.criticalCount}
              </span>
            )}
            {stats.highCount > 0 && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-white">
                {stats.highCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Aktiv',     value: stats.totalActive,   color: allGood ? 'text-matcha-700' : 'text-amber-700' },
          { label: 'Kritisch',  value: stats.criticalCount, color: stats.criticalCount > 0 ? 'text-red-600' : 'text-stone-400' },
          { label: 'Hoch',      value: stats.highCount,     color: stats.highCount > 0 ? 'text-amber-600' : 'text-stone-400' },
          { label: 'Erledigt',  value: stats.resolvedToday, color: 'text-matcha-700' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl bg-white/60 p-2 text-center">
            <div className={cn('text-lg font-black tabular-nums', kpi.color)}>{kpi.value}</div>
            <div className="text-[9px] font-semibold text-stone-400">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Top reco preview */}
      {topReco && (
        <div className="rounded-xl bg-white/60 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-0.5">
            Nächste Empfehlung
          </div>
          <div className="text-xs font-bold text-char truncate">{topReco.title}</div>
        </div>
      )}
    </div>
  );
}
