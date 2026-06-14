'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, RefreshCw, Users } from 'lucide-react';

interface CoverageGap {
  slot_start: string;
  scheduled_drivers: number;
  min_drivers: number;
  target_drivers: number;
  gap: number;
  covered: boolean;
}

interface CoverageData {
  coverage: CoverageGap[];
  summary: {
    total_slots: number;
    covered_slots: number;
    uncovered_slots: number;
    worst_gap: number;
  };
  requirements: {
    id: string;
    day_of_week: number;
    hour_of_day: number;
    min_drivers: number;
    target_drivers: number;
  }[];
}

const HOURS_OPTIONS = [12, 24, 48] as const;

function gapColor(gap: number, covered: boolean) {
  if (!covered || gap < 0) return 'bg-red-50 border-red-200 text-red-700';
  if (gap === 0) return 'bg-amber-50 border-amber-100 text-amber-700';
  return 'bg-matcha-50 border-matcha-100 text-matcha-700';
}

export function CoverageClient({ locationId }: { locationId: string }) {
  const [hours, setHours] = useState<12 | 24 | 48>(24);
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [gapsOnly, setGapsOnly] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/coverage?location_id=${locationId}&hours=${hours}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.summary) setData(d as CoverageData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, hours]);

  useEffect(() => { load(); }, [load]);

  const slots = gapsOnly
    ? (data?.coverage ?? []).filter(s => !s.covered || s.gap < 0)
    : (data?.coverage ?? []);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {HOURS_OPTIONS.map(h => (
          <button
            key={h}
            onClick={() => setHours(h)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              hours === h
                ? 'bg-matcha-700 text-white border-matcha-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {h}h
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer ml-2">
          <input type="checkbox" className="accent-matcha-700" checked={gapsOnly} onChange={e => setGapsOnly(e.target.checked)} />
          Nur Unterdeckungen
        </label>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Summary KPIs */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Zeitslots</div>
            <div className="font-display text-2xl font-black">{data.summary.total_slots}</div>
          </div>
          <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Abgedeckt</div>
            <div className="font-display text-2xl font-black text-matcha-700">{data.summary.covered_slots}</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', data.summary.uncovered_slots > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Unterdeckt</div>
            <div className={cn('font-display text-2xl font-black', data.summary.uncovered_slots > 0 ? 'text-red-700' : '')}>{data.summary.uncovered_slots}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Max. Lücke</div>
            <div className={cn('font-display text-2xl font-black', data.summary.worst_gap < 0 ? 'text-red-700' : 'text-matcha-700')}>
              {data.summary.worst_gap > 0 ? '+' : ''}{data.summary.worst_gap}
            </div>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Schichtabdeckung…</div>}

      {!loading && data && slots.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <CheckCircle2 className="h-4 w-4 text-matcha-600" />
          {gapsOnly ? 'Keine Unterdeckungen in diesem Zeitraum.' : 'Keine Daten.'}
        </div>
      )}

      {!loading && data && slots.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Users className="h-4 w-4 text-matcha-700" />
            <span className="font-semibold text-sm">Stundenslots – nächste {hours}h</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Uhrzeit</th>
                  <th className="text-left px-4 py-2">Eingeplant</th>
                  <th className="text-left px-4 py-2">Minimum</th>
                  <th className="text-left px-4 py-2">Ziel</th>
                  <th className="text-left px-4 py-2">Lücke</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2.5 text-sm font-medium tabular-nums">
                      {new Date(s.slot_start).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-sm tabular-nums font-bold">{s.scheduled_drivers}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">{s.min_drivers}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">{s.target_drivers}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', gapColor(s.gap, s.covered))}>
                        {s.gap > 0 ? '+' : ''}{s.gap}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.covered
                        ? <span className="text-[11px] text-matcha-700 font-bold">✓ Abgedeckt</span>
                        : <span className="text-[11px] text-red-700 font-bold">✗ Unterdeckt</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
