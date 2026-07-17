'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react';
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
    { zone: 'A', name: 'Express',    aktiveBestellungen: 3, kapazitaet: 5, auslastungPct: 60,  status: 'ok',       aktiveFahrer: 2 },
    { zone: 'B', name: 'Standard',   aktiveBestellungen: 7, kapazitaet: 8, auslastungPct: 88,  status: 'hoch',     aktiveFahrer: 3 },
    { zone: 'C', name: 'Weit',       aktiveBestellungen: 8, kapazitaet: 6, auslastungPct: 133, status: 'kritisch', aktiveFahrer: 2 },
    { zone: 'D', name: 'Außerhalb',  aktiveBestellungen: 1, kapazitaet: 4, auslastungPct: 25,  status: 'ok',       aktiveFahrer: 1 },
  ],
};

function AmpelBadge({ status }: { status: ZoneRow['status'] }) {
  const cls = status === 'kritisch' ? 'bg-red-100 text-red-700 border-red-200'
            : status === 'hoch'     ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-green-100 text-green-700 border-green-200';
  const label = status === 'kritisch' ? 'Kritisch' : status === 'hoch' ? 'Hoch' : 'Normal';
  return (
    <span className={cn('text-[9px] font-bold rounded-full border px-1.5 py-0.5 uppercase tracking-wide', cls)}>
      {label}
    </span>
  );
}

function AuslastungsBalken({ pct, status }: { pct: number; status: ZoneRow['status'] }) {
  const barColor = status === 'kritisch' ? 'bg-red-500' : status === 'hoch' ? 'bg-amber-400' : 'bg-green-500';
  const width = Math.min(pct, 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${width}%` }} />
    </div>
  );
}

interface Props { locationId: string | null }

export function DispatchPhase2114ZonenAuslastungsBoard({ locationId }: Props) {
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
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const kritisch = data.zonen.filter(z => z.status === 'kritisch');

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Zonen-Auslastung</span>
        {data.alarm && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {kritisch.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                {kritisch.map(z => z.name).join(', ')} überlastet — mehr Fahrer einteilen
              </p>
            </div>
          )}

          <div className="space-y-2">
            {data.zonen.map(z => (
              <div key={z.zone} className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-foreground w-6 text-center">{z.zone}</span>
                  <span className="text-[11px] font-semibold text-foreground flex-1">{z.name}</span>
                  <AmpelBadge status={z.status} />
                  <span className="text-[10px] font-black tabular-nums text-foreground">{z.auslastungPct}%</span>
                </div>
                <AuslastungsBalken pct={z.auslastungPct} status={z.status} />
                <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>{z.aktiveBestellungen}/{z.kapazitaet} Bestellungen</span>
                  <span className="flex items-center gap-0.5">
                    <Users className="h-2.5 w-2.5" />{z.aktiveFahrer} Fahrer
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
