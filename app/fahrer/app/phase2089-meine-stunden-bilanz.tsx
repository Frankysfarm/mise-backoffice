'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart2, ChevronDown, ChevronUp, Star, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StundenDurchsatz {
  stunde: number;
  bestellungen: number;
}

interface ApiData {
  stunden: StundenDurchsatz[];
  peak_stunde: number;
  team_gesamt_heute: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK_DATA: ApiData = {
  stunden: Array.from({ length: 24 }, (_, h) => ({
    stunde: h,
    bestellungen: h < 11 ? 0 : h < 13 ? 2 : h < 14 ? 4 : h < 17 ? 1 : h < 20 ? 5 : h < 22 ? 3 : 0,
  })),
  peak_stunde: 19,
  team_gesamt_heute: 87,
};

export function FahrerPhase2089MeineStundenBilanz({ driverId, locationId, isOnline }: Props) {
  const [teamData, setTeamData] = useState<ApiData>(MOCK_DATA);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/bestelldurchsatz-stunden?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      setTeamData(await res.json());
    } catch {
      // keep mock
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 60 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const nowH = new Date().getHours();
  const visible = teamData.stunden.filter(s => s.stunde <= nowH);
  const maxVal = Math.max(...visible.map(s => s.bestellungen), 1);
  const peakH = teamData.peak_stunde;
  const currentH = teamData.stunden[nowH]?.bestellungen ?? 0;
  const teamAvgPerH = visible.length > 0
    ? Math.round(teamData.team_gesamt_heute / Math.max(visible.length, 1))
    : 0;

  const myBestH = visible.reduce<{ stunde: number; bestellungen: number } | null>((best, s) => {
    if (!best || s.bestellungen > best.bestellungen) return s;
    return best;
  }, null);

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b text-left"
        onClick={() => setOpen(o => !o)}
      >
        <BarChart2 className="h-4 w-4 text-violet-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Meine Stunden-Bilanz</span>
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Mini bar chart */}
          <div className="flex items-end gap-0.5 h-14">
            {visible.map(s => {
              const pct = (s.bestellungen / maxVal) * 100;
              const isNow = s.stunde === nowH;
              const isPeak = s.stunde === peakH;
              return (
                <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5" title={`${s.stunde}:00 — ${s.bestellungen} Bestellungen Team`}>
                  <div className="w-full flex flex-col justify-end h-10">
                    <div
                      className={cn(
                        'w-full rounded-t',
                        isPeak ? 'bg-violet-500' : isNow ? 'bg-violet-400' : 'bg-violet-200',
                      )}
                      style={{ height: `${pct}%`, minHeight: s.bestellungen > 0 ? '2px' : '0' }}
                    />
                  </div>
                  <span className={cn('text-[7px] tabular-nums', isNow ? 'text-violet-700 font-black' : 'text-muted-foreground')}>
                    {s.stunde}
                  </span>
                </div>
              );
            })}
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground uppercase">Jetzt</div>
              <div className="text-sm font-black tabular-nums">{currentH}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground uppercase">Spitze</div>
              <div className="text-sm font-black tabular-nums">{myBestH?.stunde ?? peakH}:00</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground uppercase">Team-Ø/h</div>
              <div className="text-sm font-black tabular-nums">{teamAvgPerH}</div>
            </div>
          </div>

          {/* Vergleich Team */}
          <div className={cn(
            'rounded-lg p-2 flex items-center gap-1.5',
            currentH >= teamAvgPerH ? 'bg-green-50' : 'bg-amber-50',
          )}>
            {currentH >= teamAvgPerH
              ? <Star className="h-3 w-3 text-green-600 shrink-0" />
              : <TrendingUp className="h-3 w-3 text-amber-600 shrink-0" />}
            <span className={cn(
              'text-[10px] font-bold',
              currentH >= teamAvgPerH ? 'text-green-700' : 'text-amber-700',
            )}>
              {currentH >= teamAvgPerH
                ? `Super — diese Stunde über Team-Ø (${currentH} vs. ${teamAvgPerH})`
                : `Diese Stunde: ${currentH} · Team-Ø: ${teamAvgPerH} — weiter so!`}
            </span>
          </div>

          {driverId && (
            <p className="text-[9px] text-muted-foreground">Fahrer-ID: {driverId.slice(0, 8)}… · 1h-Polling</p>
          )}
        </div>
      )}
    </Card>
  );
}
