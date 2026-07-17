'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, MapPin, ChevronDown, ChevronUp, ArrowRightLeft } from 'lucide-react';
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
  alarm: true,
  zonen: [
    { zone: 'A', name: 'Express',   aktiveBestellungen: 3, kapazitaet: 5, auslastungPct: 60,  status: 'ok',       aktiveFahrer: 2 },
    { zone: 'B', name: 'Standard',  aktiveBestellungen: 7, kapazitaet: 8, auslastungPct: 88,  status: 'hoch',     aktiveFahrer: 3 },
    { zone: 'C', name: 'Weit',      aktiveBestellungen: 8, kapazitaet: 6, auslastungPct: 133, status: 'kritisch', aktiveFahrer: 2 },
    { zone: 'D', name: 'Außerhalb', aktiveBestellungen: 1, kapazitaet: 4, auslastungPct: 25,  status: 'ok',       aktiveFahrer: 1 },
  ],
};

interface Props { locationId?: string | null }

export function KitchenPhase2117ZonenUeberlastAlert({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/liefergebiet-auslastung?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const ueberlastet = data.zonen.filter(z => z.status === 'kritisch');
  const hoch        = data.zonen.filter(z => z.status === 'hoch');
  const entlastet   = data.zonen.filter(z => z.status === 'ok' && z.auslastungPct < 60);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <MapPin className="h-4 w-4 text-red-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Zonen-Überlast</span>
        {data.alarm && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" /> ALARM
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {ueberlastet.length === 0 && hoch.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">Alle Zonen im Normbereich ✓</p>
          ) : (
            <>
              {ueberlastet.map(z => (
                <div key={z.zone} className="rounded-lg bg-red-50 border border-red-200 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    <span className="text-[11px] font-bold text-red-700 flex-1">
                      Zone {z.zone} — {z.name}: {z.auslastungPct}% Auslastung
                    </span>
                    <span className="text-[9px] text-red-600 font-bold">KRITISCH</span>
                  </div>
                  <p className="text-[10px] text-red-600 ml-5">
                    {z.aktiveBestellungen}/{z.kapazitaet} Bestellungen · {z.aktiveFahrer} Fahrer
                  </p>
                  {entlastet.length > 0 && (
                    <div className={cn('flex items-center gap-1.5 ml-5 text-[10px] text-red-700 font-medium')}>
                      <ArrowRightLeft className="h-3 w-3" />
                      Fahrer umleiten nach: {entlastet.map(e => `Zone ${e.zone} (${e.auslastungPct}%)`).join(', ')}
                    </div>
                  )}
                </div>
              ))}

              {hoch.map(z => (
                <div key={z.zone} className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="text-[11px] font-semibold text-amber-700 flex-1">
                      Zone {z.zone} — {z.name}: {z.auslastungPct}% — Beobachten
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {data.zonen.map(z => (
              <div key={z.zone} className={cn(
                'rounded-lg border p-2 text-center',
                z.status === 'kritisch' ? 'bg-red-50 border-red-200'
                : z.status === 'hoch'   ? 'bg-amber-50 border-amber-200'
                : 'bg-muted/20'
              )}>
                <p className="text-[9px] text-muted-foreground">{z.zone}</p>
                <p className={cn(
                  'text-[12px] font-black tabular-nums',
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
