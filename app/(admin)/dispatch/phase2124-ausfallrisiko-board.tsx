'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, UserX, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type RisikoStufe = 'niedrig' | 'mittel' | 'hoch';

interface FahrerRisiko {
  driver_id: string;
  fahrer_name: string;
  verspaetungen_3_tage: number;
  schicht_fehlzeiten: number;
  risiko_score: number;
  risiko_stufe: RisikoStufe;
}

interface ApiData {
  fahrer: FahrerRisiko[];
  gesamt_risiko: RisikoStufe;
  hoch_risiko_anzahl: number;
}

const MOCK: ApiData = {
  gesamt_risiko: 'hoch',
  hoch_risiko_anzahl: 1,
  fahrer: [
    { driver_id: 'a', fahrer_name: 'Max Müller',   verspaetungen_3_tage: 4, schicht_fehlzeiten: 1, risiko_score: 9, risiko_stufe: 'hoch' },
    { driver_id: 'b', fahrer_name: 'Anna Schmidt',  verspaetungen_3_tage: 2, schicht_fehlzeiten: 0, risiko_score: 4, risiko_stufe: 'mittel' },
    { driver_id: 'c', fahrer_name: 'Klaus Weber',   verspaetungen_3_tage: 0, schicht_fehlzeiten: 0, risiko_score: 1, risiko_stufe: 'niedrig' },
  ],
};

function RisikoBadge({ stufe }: { stufe: RisikoStufe }) {
  const cls = stufe === 'hoch'    ? 'bg-red-100 text-red-700 border-red-200'
            : stufe === 'mittel'  ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-green-100 text-green-700 border-green-200';
  const label = stufe === 'hoch' ? 'Hoch' : stufe === 'mittel' ? 'Mittel' : 'Niedrig';
  return (
    <span className={cn('text-[9px] font-bold rounded-full border px-1.5 py-0.5 uppercase tracking-wide', cls)}>
      {label}
    </span>
  );
}

interface Props { locationId: string | null }

export function DispatchPhase2124AusfallrisikoBoard({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-ausfallrisiko?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const hochRisiko = data.fahrer.filter(f => f.risiko_stufe === 'hoch');
  const hasAlert   = hochRisiko.length > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Ausfallrisiko-Board</span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{hochRisiko.length} KRITISCH
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {hasAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                {hochRisiko.map(f => f.fahrer_name).join(', ')} — Coaching-Gespräch empfohlen
              </p>
            </div>
          )}

          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.driver_id} className={cn(
                'rounded-lg border p-2.5 space-y-1',
                f.risiko_stufe === 'hoch'   ? 'bg-red-50 border-red-200'
                : f.risiko_stufe === 'mittel' ? 'bg-amber-50 border-amber-200'
                : 'bg-muted/20'
              )}>
                <div className="flex items-center gap-2">
                  <UserX className={cn('h-3.5 w-3.5 shrink-0',
                    f.risiko_stufe === 'hoch' ? 'text-red-500' : f.risiko_stufe === 'mittel' ? 'text-amber-500' : 'text-muted-foreground'
                  )} />
                  <span className="text-[11px] font-semibold flex-1 truncate">{f.fahrer_name}</span>
                  <RisikoBadge stufe={f.risiko_stufe} />
                  <span className="text-[10px] font-black tabular-nums">{f.risiko_score}</span>
                </div>
                <div className="flex gap-3 text-[9px] text-muted-foreground ml-5">
                  <span>{f.verspaetungen_3_tage} Verspät. (3 Tage)</span>
                  <span>{f.schicht_fehlzeiten} Fehlzeiten</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
