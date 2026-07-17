'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerEffizienz {
  fahrer_id: string;
  name: string;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  touren_pro_stunde: number;
}

interface ZoneStats {
  zone: string;
  bestellungen_1h: number;
}

interface EffizienzData {
  fahrer: FahrerEffizienz[];
  team_durchschnitt: number;
}

interface AuslastungData {
  zonen?: ZoneStats[];
}

const MOCK_EFFIZIENZ: EffizienzData = {
  team_durchschnitt: 62,
  fahrer: [
    { fahrer_id: 'f1', name: 'Max Müller',   score: 88, ampel: 'gruen', touren_pro_stunde: 2.1 },
    { fahrer_id: 'f2', name: 'Lena Schmidt',  score: 62, ampel: 'gelb',  touren_pro_stunde: 1.6 },
    { fahrer_id: 'f3', name: 'Tom Becker',    score: 45, ampel: 'rot',   touren_pro_stunde: 0.9 },
  ],
};

interface Props { locationId: string | null }

export function KitchenPhase2142KapazitaetsWarnung({ locationId }: Props) {
  const [open, setOpen]               = useState(true);
  const [effizienz, setEffizienz]     = useState<EffizienzData>(MOCK_EFFIZIENZ);
  const [aufkommen, setAufkommen]     = useState<number>(0);
  const [loading, setLoading]         = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const [eR, aR] = await Promise.all([
        fetch(`/api/delivery/admin/fahrer-schicht-effizienz?location_id=${locationId}`, { cache: 'no-store' }),
        fetch(`/api/delivery/admin/durchschnittsliefer-zeit?location_id=${locationId}`,  { cache: 'no-store' }),
      ]);
      if (eR.ok) setEffizienz(await eR.json());
      if (aR.ok) {
        const d: AuslastungData = await aR.json();
        const total = (d.zonen ?? []).reduce((s: number, z: ZoneStats) => s + z.bestellungen_1h, 0);
        setAufkommen(total);
      }
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const teamScore      = effizienz.team_durchschnitt;
  const hoheAuslastung = aufkommen > 15;
  const niedrigeEffiz  = teamScore < 70;
  const kritisch       = niedrigeEffiz && hoheAuslastung;
  const hasAlert       = niedrigeEffiz || hoheAuslastung;

  const schwachefahrer = useMemo(
    () => effizienz.fahrer.filter(f => f.score < 70).sort((a, b) => a.score - b.score),
    [effizienz.fahrer],
  );

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Users className={cn('h-4 w-4 shrink-0', kritisch ? 'text-red-500' : hasAlert ? 'text-amber-500' : 'text-muted-foreground')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Kapazitäts-Warnung</span>
        {kritisch && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />KRITISCH
          </span>
        )}
        {!kritisch && hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />WARNUNG
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className={cn(
              'rounded-lg border px-3 py-2',
              niedrigeEffiz ? 'bg-red-50 border-red-200' : 'bg-muted/20',
            )}>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Effizienz</p>
              <p className={cn('text-lg font-black tabular-nums', niedrigeEffiz ? 'text-red-600' : 'text-green-600')}>
                {teamScore}
              </p>
              <p className="text-[9px] text-muted-foreground">Ziel: 70+</p>
            </div>
            <div className={cn(
              'rounded-lg border px-3 py-2',
              hoheAuslastung ? 'bg-amber-50 border-amber-200' : 'bg-muted/20',
            )}>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Aufkommen / Std.</p>
              <p className={cn('text-lg font-black tabular-nums', hoheAuslastung ? 'text-amber-600' : 'text-green-600')}>
                {aufkommen}
              </p>
              <p className="text-[9px] text-muted-foreground">Hoch ab 15</p>
            </div>
          </div>

          {kritisch && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                Hohes Aufkommen bei niedriger Effizienz — Kapazitätsprobleme möglich. Dispatcher benachrichtigen.
              </p>
            </div>
          )}

          {schwachefahrer.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Effizienz unter 70</p>
              {schwachefahrer.map(f => (
                <div key={f.fahrer_id} className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-medium flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] font-bold text-amber-700 tabular-nums">{f.score} Pkt.</span>
                  <span className="text-[9px] text-muted-foreground">{f.touren_pro_stunde} T/h</span>
                </div>
              ))}
            </div>
          )}

          {!hasAlert && (
            <p className="text-[11px] text-muted-foreground text-center py-1">
              Kapazität im grünen Bereich — keine Warnung
            </p>
          )}
        </div>
      )}
    </div>
  );
}
