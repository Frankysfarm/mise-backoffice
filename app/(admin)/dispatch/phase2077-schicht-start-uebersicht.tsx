'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, ChevronDown, ChevronUp, AlertTriangle, Users, Timer } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  generiert_am: string;
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const MOCK: ApiData = {
  fahrer: [
    { driver_id: 'm1', name: 'Anna M.', schicht_start: new Date(Date.now() - 5 * 3600_000).toISOString(), schicht_dauer_min: 300, touren_heute: 7, letzte_tour_ende: new Date(Date.now() - 15 * 60_000).toISOString(), idle_luecken_min: 12, ueberstunden: false, ueberstunden_min: 0 },
    { driver_id: 'm2', name: 'Ben K.', schicht_start: new Date(Date.now() - 9.5 * 3600_000).toISOString(), schicht_dauer_min: 570, touren_heute: 14, letzte_tour_ende: new Date(Date.now() - 8 * 60_000).toISOString(), idle_luecken_min: 38, ueberstunden: true, ueberstunden_min: 90 },
    { driver_id: 'm3', name: 'Clara S.', schicht_start: new Date(Date.now() - 3 * 3600_000).toISOString(), schicht_dauer_min: 180, touren_heute: 4, letzte_tour_ende: new Date(Date.now() - 25 * 60_000).toISOString(), idle_luecken_min: 8, ueberstunden: false, ueberstunden_min: 0 },
  ],
  team_avg_dauer_min: 350,
  ueberstunden_count: 1,
  generiert_am: new Date().toISOString(),
};

export function DispatchPhase2077SchichtStartUebersicht({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schicht-start?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 15 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const NORMALSCHICHT = 480;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b text-left"
        onClick={() => setOpen(o => !o)}
      >
        <Clock className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Schicht-Start-Übersicht
        </span>
        {data.ueberstunden_count > 0 && (
          <Badge className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5">
            {data.ueberstunden_count} Überstunden
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/40 p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
                <Users className="h-3 w-3" /> Fahrer
              </div>
              <div className="text-xl font-black tabular-nums">{data.fahrer.length}</div>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-center">
              <div className="text-[10px] text-blue-600 uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
                <Timer className="h-3 w-3" /> Team-Ø Schicht
              </div>
              <div className="text-xl font-black tabular-nums text-blue-700">
                {formatMin(data.team_avg_dauer_min)}
              </div>
            </div>
            <div className={cn(
              'rounded-xl p-3 text-center',
              data.ueberstunden_count > 0 ? 'bg-red-50' : 'bg-green-50',
            )}>
              <div className={cn(
                'text-[10px] uppercase tracking-wide mb-1 flex items-center justify-center gap-1',
                data.ueberstunden_count > 0 ? 'text-red-600' : 'text-green-600',
              )}>
                <AlertTriangle className="h-3 w-3" /> Überstunden
              </div>
              <div className={cn(
                'text-xl font-black tabular-nums',
                data.ueberstunden_count > 0 ? 'text-red-700' : 'text-green-700',
              )}>
                {data.ueberstunden_count}
              </div>
            </div>
          </div>

          {/* Überstunden-Alert */}
          {data.ueberstunden_count > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">
                {data.ueberstunden_count} Fahrer {data.ueberstunden_count === 1 ? 'hat' : 'haben'} Überstunden —
                Schicht-Ablösung prüfen.
              </p>
            </div>
          )}

          {/* Fahrer-Zeitlinie */}
          <div className="space-y-2">
            {data.fahrer.map(f => {
              const pct = Math.min(100, Math.round((f.schicht_dauer_min / NORMALSCHICHT) * 100));
              const hasIdleAlert = f.idle_luecken_min > 30;

              return (
                <div
                  key={f.driver_id}
                  className={cn(
                    'rounded-xl border px-3 py-2.5',
                    f.ueberstunden ? 'bg-red-50 border-red-200' : hasIdleAlert ? 'bg-amber-50 border-amber-200' : 'bg-muted/30 border-border',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold truncate">{f.name}</span>
                    <span className="text-[9px] text-muted-foreground ml-auto shrink-0">
                      Start: {formatTime(f.schicht_start)}
                    </span>
                    {f.ueberstunden && (
                      <Badge className="bg-red-500 text-white text-[9px] px-1.5 py-0">
                        +{formatMin(f.ueberstunden_min)} ÜS
                      </Badge>
                    )}
                    {hasIdleAlert && !f.ueberstunden && (
                      <Badge className="bg-amber-400 text-white text-[9px] px-1.5 py-0">
                        Lücke {formatMin(f.idle_luecken_min)}
                      </Badge>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          f.ueberstunden ? 'bg-red-500' : pct >= 75 ? 'bg-amber-400' : 'bg-blue-500',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums shrink-0 w-14 text-right">
                      {formatMin(f.schicht_dauer_min)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] text-muted-foreground">
                      {f.touren_heute} Tour{f.touren_heute !== 1 ? 'en' : ''} heute
                    </span>
                    {f.letzte_tour_ende && (
                      <span className="text-[9px] text-muted-foreground">
                        Letzte: {formatTime(f.letzte_tour_ende)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[9px] text-muted-foreground text-right">
            Normalschicht 8h · aktualisiert {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </Card>
  );
}
