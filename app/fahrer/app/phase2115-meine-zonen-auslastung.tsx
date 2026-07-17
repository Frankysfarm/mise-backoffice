'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneRow {
  zone: string;
  name: string;
  aktiveBestellungen: number;
  kapazitaet: number;
  auslastungPct: number;
  status: 'ok' | 'hoch' | 'kritisch';
  aktiveFahrer: number;
}

interface ApiData {
  zonen: ZoneRow[];
  alarm: boolean;
}

const MOCK: ApiData = {
  alarm: false,
  zonen: [
    { zone: 'B', name: 'Standard', aktiveBestellungen: 5, kapazitaet: 8, auslastungPct: 63, status: 'ok', aktiveFahrer: 3 },
    { zone: 'A', name: 'Express',  aktiveBestellungen: 3, kapazitaet: 5, auslastungPct: 60, status: 'ok', aktiveFahrer: 2 },
    { zone: 'C', name: 'Weit',     aktiveBestellungen: 5, kapazitaet: 6, auslastungPct: 83, status: 'hoch', aktiveFahrer: 2 },
    { zone: 'D', name: 'Außerhalb',aktiveBestellungen: 1, kapazitaet: 4, auslastungPct: 25, status: 'ok', aktiveFahrer: 1 },
  ],
};

interface Props {
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2115MeineZonenAuslastung({ locationId, isOnline }: Props) {
  const [open, setOpen]       = useState(false);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/liefergebiet-auslastung?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId, isOnline]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const meineZone = data.zonen[0];
  const zoneFull = meineZone?.status === 'kritisch';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Meine Zone</span>
        {zoneFull && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && meineZone && (
        <div className="p-3 space-y-3">
          <div className={cn(
            'rounded-xl p-4 text-center space-y-1',
            meineZone.status === 'kritisch' ? 'bg-red-50 border border-red-200'
            : meineZone.status === 'hoch'   ? 'bg-amber-50 border border-amber-200'
            : 'bg-green-50 border border-green-200'
          )}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Zone {meineZone.zone} — {meineZone.name}</p>
            <p className={cn(
              'text-3xl font-black tabular-nums',
              meineZone.status === 'kritisch' ? 'text-red-600' : meineZone.status === 'hoch' ? 'text-amber-600' : 'text-green-600'
            )}>
              {meineZone.auslastungPct}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              {meineZone.aktiveBestellungen} von {meineZone.kapazitaet} Bestellungen aktiv
            </p>
          </div>

          {zoneFull && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-[11px] text-red-700 font-medium">Zone voll — Dispatch kontaktieren für Umleitung</p>
            </div>
          )}

          {meineZone.status === 'hoch' && !zoneFull && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-[11px] text-amber-700 font-medium">Zone stark belastet — zügig abliefern</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {data.zonen.map(z => (
              <div key={z.zone} className={cn(
                'rounded-lg border p-2 text-center',
                z.zone === meineZone.zone ? 'border-blue-400 bg-blue-50' : 'bg-muted/20'
              )}>
                <p className="text-[9px] text-muted-foreground">{z.name}</p>
                <p className={cn(
                  'text-[13px] font-black tabular-nums',
                  z.status === 'kritisch' ? 'text-red-600' : z.status === 'hoch' ? 'text-amber-600' : 'text-green-600'
                )}>{z.auslastungPct}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
