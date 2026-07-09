'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type SchichtSlot = {
  stunde: number;
  eingeplant: number;
  mindestbesetzung: number;
  bestaetigt: number;
  status: 'ok' | 'eng' | 'luecke';
};

type Prognose = {
  naechste_schicht_start: string;
  slots: SchichtSlot[];
  gesamt_eingeplant: number;
  gesamt_mindest: number;
  luecken: number;
};

const MOCK: Prognose = {
  naechste_schicht_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  gesamt_eingeplant: 6,
  gesamt_mindest: 8,
  luecken: 2,
  slots: [
    { stunde: 11, eingeplant: 3, bestaetigt: 2, mindestbesetzung: 3, status: 'ok' },
    { stunde: 12, eingeplant: 4, bestaetigt: 3, mindestbesetzung: 5, status: 'eng' },
    { stunde: 13, eingeplant: 5, bestaetigt: 4, mindestbesetzung: 6, status: 'eng' },
    { stunde: 14, eingeplant: 6, bestaetigt: 5, mindestbesetzung: 6, status: 'ok' },
    { stunde: 15, eingeplant: 4, bestaetigt: 3, mindestbesetzung: 6, status: 'luecke' },
    { stunde: 16, eingeplant: 2, bestaetigt: 2, mindestbesetzung: 5, status: 'luecke' },
    { stunde: 17, eingeplant: 5, bestaetigt: 4, mindestbesetzung: 5, status: 'ok' },
    { stunde: 18, eingeplant: 6, bestaetigt: 6, mindestbesetzung: 6, status: 'ok' },
  ],
};

function StatusBadge({ status }: { status: SchichtSlot['status'] }) {
  const map = {
    ok: 'bg-matcha-100 text-matcha-700',
    eng: 'bg-amber-100 text-amber-700',
    luecke: 'bg-red-100 text-red-700 animate-pulse',
  };
  const labels = { ok: 'OK', eng: 'Eng', luecke: 'Lücke' };
  return (
    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', map[status])}>
      {labels[status]}
    </span>
  );
}

export function DispatchPhase1045FahrerSchichtPrognosBoard({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [prognose, setPrognose] = useState<Prognose | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!locationId) {
        setPrognose(MOCK);
        setLoading(false);
        return;
      }
      fetch(`/api/delivery/admin/schicht-forecast?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (d?.slots && Array.isArray(d.slots) && d.slots.length > 0) {
            setPrognose(d as Prognose);
          } else {
            setPrognose(MOCK);
          }
        })
        .catch(() => { if (!cancelled) setPrognose(MOCK); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const luecken = prognose?.slots.filter((s) => s.status === 'luecke').length ?? 0;
  const maxEingeplant = Math.max(...(prognose?.slots.map((s) => Math.max(s.eingeplant, s.mindestbesetzung)) ?? [1]));

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Users className={cn('h-4 w-4', luecken > 0 ? 'text-red-500' : 'text-matcha-600')} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Schicht-Prognose
          </span>
          {!loading && prognose && (
            <>
              <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
                {prognose.gesamt_eingeplant}/{prognose.gesamt_mindest} Fahrer
              </span>
              {luecken > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
                  {luecken} Lücke{luecken > 1 ? 'n' : ''}
                </span>
              )}
            </>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Schicht-Prognose…
            </div>
          ) : !prognose ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Keine Daten verfügbar</div>
          ) : (
            <>
              {/* Lücken-Alert */}
              {luecken > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50/80 border-b border-red-100 dark:bg-red-950/20">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 animate-pulse" />
                  <span className="text-xs font-semibold text-red-700">
                    {luecken} Stunde{luecken > 1 ? 'n' : ''} unter Mindestbesetzung — zusätzliche Fahrer einplanen!
                  </span>
                </div>
              )}

              {/* Bar chart of slots */}
              <div className="p-4 space-y-2">
                {prognose.slots.map((slot) => {
                  const eingePct = Math.round((slot.eingeplant / maxEingeplant) * 100);
                  const mindestPct = Math.round((slot.mindestbesetzung / maxEingeplant) * 100);
                  return (
                    <div key={slot.stunde} className="flex items-center gap-3">
                      <div className="w-8 text-[11px] tabular-nums font-bold text-muted-foreground text-right shrink-0">
                        {slot.stunde}h
                      </div>
                      <div className="flex-1 relative h-5 rounded overflow-hidden bg-muted">
                        {/* Eingeplant bar */}
                        <div
                          className={cn(
                            'absolute inset-y-0 left-0 rounded transition-all',
                            slot.status === 'luecke' ? 'bg-red-400' :
                            slot.status === 'eng' ? 'bg-amber-400' :
                            'bg-matcha-400',
                          )}
                          style={{ width: `${eingePct}%` }}
                        />
                        {/* Mindestbesetzung line */}
                        <div
                          className="absolute inset-y-0 w-0.5 bg-foreground/40 z-10"
                          style={{ left: `${mindestPct}%` }}
                          title={`Mindest: ${slot.mindestbesetzung}`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] tabular-nums font-semibold">
                          {slot.bestaetigt}/{slot.eingeplant}
                        </span>
                        <StatusBadge status={slot.status} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="border-t px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground bg-muted/20">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded bg-foreground/40" />
                  Strich = Mindestbesetzung
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded bg-matcha-400" />
                  Bestätigt/Eingeplant
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
