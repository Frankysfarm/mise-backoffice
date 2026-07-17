'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, ChevronDown, ChevronUp, AlertTriangle, Coffee, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FahrerSchichtInfo {
  driver_id: string;
  name: string;
  schicht_start: string | null;
  schicht_dauer_min: number;
  touren_heute: number;
  letzte_tour_ende: string | null;
  idle_luecken_min: number;
  ueberstunden: boolean;
  ueberstunden_min: number;
}

interface ApiData {
  fahrer: FahrerSchichtInfo[];
  team_avg_dauer_min: number;
  ueberstunden_count: number;
}

const NORMALSCHICHT_MIN = 480; // 8h

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK_FAHRER: FahrerSchichtInfo = {
  driver_id: 'mock',
  name: 'Demo Fahrer',
  schicht_start: new Date(Date.now() - 6 * 3600_000).toISOString(),
  schicht_dauer_min: 360,
  touren_heute: 9,
  letzte_tour_ende: new Date(Date.now() - 10 * 60_000).toISOString(),
  idle_luecken_min: 15,
  ueberstunden: false,
  ueberstunden_min: 0,
};

export function FahrerPhase2078MeineSchichtDauer({ driverId, locationId, isOnline }: Props) {
  const [myData, setMyData] = useState<FahrerSchichtInfo | null>(null);
  const [teamAvg, setTeamAvg] = useState<number>(NORMALSCHICHT_MIN);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setMyData(MOCK_FAHRER); setTeamAvg(420); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schicht-start?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      const json: ApiData = await res.json();
      setTeamAvg(json.team_avg_dauer_min);
      const me = driverId ? json.fahrer.find(f => f.driver_id === driverId) : null;
      setMyData(me ?? MOCK_FAHRER);
    } catch {
      setMyData(MOCK_FAHRER);
      setTeamAvg(420);
    }
  }, [driverId, locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 30 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !myData) return null;

  const pct = Math.min(100, Math.round((myData.schicht_dauer_min / NORMALSCHICHT_MIN) * 100));
  const vsTeam = myData.schicht_dauer_min - teamAvg;
  const needsPause = myData.schicht_dauer_min > 360; // >6h empfehle Pause

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b text-left"
        onClick={() => setOpen(o => !o)}
      >
        <Clock className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Meine Schicht-Dauer
        </span>
        {myData.ueberstunden && (
          <span className="ml-2 text-[10px] font-bold text-red-600 bg-red-100 rounded px-1.5 py-0.5">
            Überstunden
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Ring gauge */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                <circle
                  cx="40" cy="40" r="32"
                  fill="none"
                  stroke={myData.ueberstunden ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#3b82f6'}
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - pct / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-sm font-black tabular-nums', myData.ueberstunden ? 'text-red-600' : 'text-foreground')}>
                  {pct}%
                </span>
                <span className="text-[8px] text-muted-foreground">von 8h</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 p-2 text-center">
                  <div className="text-[9px] text-muted-foreground uppercase">Schichtdauer</div>
                  <div className="text-sm font-black tabular-nums">{formatMin(myData.schicht_dauer_min)}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 text-center">
                  <div className="text-[9px] text-muted-foreground uppercase">Touren</div>
                  <div className="text-sm font-black tabular-nums">{myData.touren_heute}</div>
                </div>
              </div>

              {/* vs Team */}
              <div className={cn(
                'rounded-lg p-2 flex items-center gap-1.5',
                vsTeam > 60 ? 'bg-red-50' : vsTeam > 0 ? 'bg-amber-50' : 'bg-green-50',
              )}>
                <TrendingUp className={cn('h-3 w-3 shrink-0', vsTeam > 0 ? 'text-amber-600' : 'text-green-600')} />
                <span className={cn('text-[10px] font-bold', vsTeam > 60 ? 'text-red-700' : vsTeam > 0 ? 'text-amber-700' : 'text-green-700')}>
                  {vsTeam > 0 ? `+${formatMin(vsTeam)} vs. Team-Ø` : `${formatMin(Math.abs(vsTeam))} unter Team-Ø`}
                </span>
              </div>
            </div>
          </div>

          {/* Überstunden-Warnung */}
          {myData.ueberstunden && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">
                Du hast {formatMin(myData.ueberstunden_min)} Überstunden — bitte mit dem Dispatch sprechen.
              </p>
            </div>
          )}

          {/* Pausen-Empfehlung */}
          {needsPause && !myData.ueberstunden && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <Coffee className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Du bist seit über 6 Stunden im Einsatz — denk an eine kurze Pause!
              </p>
            </div>
          )}

          {/* Idle-Lücken-Info */}
          {myData.idle_luecken_min > 30 && (
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
              Idle-Lücken heute: <span className="font-bold">{formatMin(myData.idle_luecken_min)}</span> — kurze Wartezeiten sind normal.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
