'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MessageSquare, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerRisiko {
  driver_id: string;
  fahrer_name: string;
  verspaetungen_3_tage: number;
  risiko_score: number;
  risiko_stufe: 'niedrig' | 'mittel' | 'hoch';
}

interface ApiData {
  fahrer: FahrerRisiko[];
  hoch_risiko_anzahl: number;
}

const MOCK: ApiData = {
  hoch_risiko_anzahl: 1,
  fahrer: [
    { driver_id: 'a', fahrer_name: 'Max Müller',  verspaetungen_3_tage: 4, risiko_score: 9, risiko_stufe: 'hoch' },
    { driver_id: 'b', fahrer_name: 'Anna Schmidt', verspaetungen_3_tage: 2, risiko_score: 4, risiko_stufe: 'mittel' },
    { driver_id: 'c', fahrer_name: 'Klaus Weber',  verspaetungen_3_tage: 0, risiko_score: 1, risiko_stufe: 'niedrig' },
  ],
};

interface Props { locationId?: string | null }

export function KitchenPhase2127FahrerCoachingAlert({ locationId }: Props) {
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
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const coachingNötig = data.fahrer.filter(f => f.verspaetungen_3_tage >= 2 || f.risiko_stufe === 'hoch');
  const hasAlert = coachingNötig.length > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <MessageSquare className="h-4 w-4 text-purple-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Fahrer-Coaching</span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{coachingNötig.length} empfohlen
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {coachingNötig.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              <p className="text-[11px] text-muted-foreground">Alle Fahrer im grünen Bereich ✓</p>
            </div>
          ) : (
            <>
              {coachingNötig.map(f => (
                <div key={f.driver_id} className={cn(
                  'rounded-lg border p-2.5',
                  f.risiko_stufe === 'hoch' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                )}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', f.risiko_stufe === 'hoch' ? 'text-red-600' : 'text-amber-600')} />
                    <span className={cn('text-[11px] font-semibold flex-1', f.risiko_stufe === 'hoch' ? 'text-red-700' : 'text-amber-700')}>
                      {f.fahrer_name}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{f.verspaetungen_3_tage}× verspätet</span>
                  </div>
                  <p className={cn('text-[10px] ml-5 mt-0.5', f.risiko_stufe === 'hoch' ? 'text-red-600' : 'text-amber-600')}>
                    Dispatch informieren → Coaching-Gespräch empfohlen
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
