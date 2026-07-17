'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flame, Trophy, AlertTriangle, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerBonusRow {
  driver_id: string;
  name: string;
  touren_abgeschlossen: number;
  bonus_punkte: number;
  streak_count: number;
  multiplikator: number;
  alert_null_touren: boolean;
}

interface ApiData {
  fahrer: FahrerBonusRow[];
  team_gesamt_bonus: number;
  top_fahrer: string | null;
  alert_null_touren_count: number;
}

const MOCK: ApiData = {
  team_gesamt_bonus: 260,
  top_fahrer: 'Max M.',
  alert_null_touren_count: 1,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   touren_abgeschlossen: 5, bonus_punkte: 150, streak_count: 5, multiplikator: 2.0, alert_null_touren: false },
    { driver_id: 'd2', name: 'Sarah K.', touren_abgeschlossen: 3, bonus_punkte:  90, streak_count: 3, multiplikator: 1.5, alert_null_touren: false },
    { driver_id: 'd3', name: 'Tom B.',   touren_abgeschlossen: 1, bonus_punkte:  20, streak_count: 1, multiplikator: 1.0, alert_null_touren: false },
    { driver_id: 'd4', name: 'Anna L.',  touren_abgeschlossen: 0, bonus_punkte:   0, streak_count: 0, multiplikator: 1.0, alert_null_touren: true  },
  ],
};

function MultiChip({ multi }: { multi: number }) {
  const color = multi >= 2.0 ? 'bg-orange-100 text-orange-700 border-orange-200'
              : multi >= 1.5 ? 'bg-amber-100 text-amber-700 border-amber-200'
              : 'bg-muted text-muted-foreground border-border';
  return (
    <span className={cn('text-[9px] font-black rounded-full border px-1.5 py-0.5 tabular-nums', color)}>
      ×{multi.toFixed(1)}
    </span>
  );
}

interface Props { locationId: string | null }

export function DispatchPhase2109TourBonusBoard({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/tour-abschluss-bonus?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const nullCount = data.alert_null_touren_count;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Tour-Bonus</span>
        {nullCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">
            <AlertTriangle className="h-3 w-3" /> {nullCount} ohne Tour
          </span>
        )}
        {loading && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-center">
              <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Team-Bonus</div>
              <div className="text-xl font-black tabular-nums text-amber-700">{data.team_gesamt_bonus} Pkt</div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Top Fahrer</div>
              <div className="text-xs font-bold text-foreground truncate mt-0.5">{data.top_fahrer ?? '–'}</div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Max ×</div>
              <div className="text-xl font-black text-orange-600">×2,0</div>
            </div>
          </div>

          {/* 0-Touren alert */}
          {nullCount > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                {nullCount} Fahrer noch ohne abgeschlossene Tour — Status prüfen
              </p>
            </div>
          )}

          {/* Driver ranking */}
          <div className="space-y-2">
            {data.fahrer.map((f, i) => (
              <div key={f.driver_id} className={cn('rounded-lg border px-3 py-2', f.alert_null_touren ? 'bg-red-50 border-red-200' : 'bg-muted/20')}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                    i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-amber-200 text-amber-900' : 'bg-muted text-muted-foreground',
                  )}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold flex-1">{f.name}</span>
                  <MultiChip multi={f.multiplikator} />
                  <span className={cn('text-sm font-black tabular-nums', f.bonus_punkte > 0 ? 'text-amber-700' : 'text-muted-foreground')}>
                    {f.bonus_punkte} Pkt
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                  <span>{f.touren_abgeschlossen} Touren</span>
                  {f.streak_count >= 3 && (
                    <span className="flex items-center gap-0.5 text-orange-600 font-bold">
                      <Flame className="h-2.5 w-2.5" />{f.streak_count}-Tour-Streak
                    </span>
                  )}
                  {f.alert_null_touren && (
                    <span className="text-red-600 font-bold flex items-center gap-0.5">
                      <Zap className="h-2.5 w-2.5" />Noch keine Tour
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-muted-foreground text-right">30-Min-Polling · Heute</p>
        </div>
      )}
    </div>
  );
}
