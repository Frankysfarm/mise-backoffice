'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, Clock, Loader2, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1100 — Schicht-Endzeit-Warnung (Dispatch)
// Alert wenn Fahrer in <30 Min Schichtende hat, aber noch offene Stops

interface Props { locationId: string | null }

type WarnLevel = 'kritisch' | 'warnung' | 'ok';

type FahrerWarnung = {
  fahrer_id: string;
  name: string;
  zone: string;
  schicht_ende_in_min: number;
  offene_stopps: number;
  warn_level: WarnLevel;
  empfehlung: string;
};

type ApiData = {
  warnungen: FahrerWarnung[];
  kritisch_anzahl: number;
  location_id: string | null;
  generiert_am: string;
};

const MOCK: ApiData = {
  warnungen: [
    {
      fahrer_id: 'f1',
      name: 'Ahmed K.',
      zone: 'B',
      schicht_ende_in_min: 12,
      offene_stopps: 3,
      warn_level: 'kritisch',
      empfehlung: 'Stops sofort umrouten oder Schicht verlängern',
    },
    {
      fahrer_id: 'f3',
      name: 'Julia T.',
      zone: 'A',
      schicht_ende_in_min: 25,
      offene_stopps: 2,
      warn_level: 'warnung',
      empfehlung: 'Ggf. letzten Stop umrouten',
    },
    {
      fahrer_id: 'f2',
      name: 'Marcus B.',
      zone: 'C',
      schicht_ende_in_min: 58,
      offene_stopps: 4,
      warn_level: 'ok',
      empfehlung: '',
    },
  ],
  kritisch_anzahl: 1,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

const WARN_STYLES: Record<WarnLevel, string> = {
  kritisch: 'border-red-300 bg-red-50 dark:bg-red-900/10',
  warnung: 'border-amber-300 bg-amber-50 dark:bg-amber-900/10',
  ok: 'border-border bg-muted/20',
};

const WARN_BADGE: Record<WarnLevel, string> = {
  kritisch: 'bg-red-100 text-red-700 border-red-300',
  warnung: 'bg-amber-100 text-amber-700 border-amber-300',
  ok: 'bg-green-100 text-green-700 border-green-300',
};

const WARN_LABEL: Record<WarnLevel, string> = {
  kritisch: 'Kritisch',
  warnung: 'Warnung',
  ok: 'OK',
};

export function DispatchPhase1100SchichtEndzeitWarnung({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/schicht-endzeit-warnung?location_id=${locationId}`,
      );
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 60_000); // 1-min polling
    return () => clearInterval(id);
  }, [load]);

  const displayed = data ?? (locationId ? null : MOCK);
  const warnFahrer = (displayed?.warnungen ?? []).filter(w => w.warn_level !== 'ok');

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Schicht-Endzeit-Warnung
          </span>
          {warnFahrer.length > 0 && (
            <span className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-bold',
              (displayed?.kritisch_anzahl ?? 0) > 0
                ? 'bg-red-100 text-red-700 border-red-300'
                : 'bg-amber-100 text-amber-700 border-amber-300',
            )}>
              {warnFahrer.length} Fahrer
              {(displayed?.kritisch_anzahl ?? 0) > 0
                ? ` · ${displayed!.kritisch_anzahl} kritisch`
                : ''}
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !displayed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Schicht-Daten…
            </div>
          )}

          {displayed && (
            <>
              {(displayed.warnungen ?? []).length === 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <UserCheck className="h-4 w-4" />
                  Alle Fahrer haben ausreichend Zeit bis Schichtende.
                </div>
              )}

              <div className="space-y-2">
                {(displayed.warnungen ?? [])
                  .sort((a, b) => a.schicht_ende_in_min - b.schicht_ende_in_min)
                  .map(w => (
                    <div
                      key={w.fahrer_id}
                      className={cn('rounded-xl border p-3', WARN_STYLES[w.warn_level])}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">{w.name}</span>
                        <span className="text-xs text-muted-foreground">Zone {w.zone}</span>
                        <span className={cn(
                          'rounded-full border px-1.5 py-0.5 text-[10px] font-bold',
                          WARN_BADGE[w.warn_level],
                        )}>
                          {WARN_LABEL[w.warn_level]}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Schichtende in <span className={cn(
                            'font-bold ml-0.5',
                            w.schicht_ende_in_min <= 15 ? 'text-red-600' : 'text-amber-600',
                          )}>
                            {w.schicht_ende_in_min} Min
                          </span>
                        </span>
                        <span>
                          <span className="font-medium text-foreground">{w.offene_stopps}</span> offene Stops
                        </span>
                      </div>
                      {w.empfehlung && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          <AlertOctagon className="h-3 w-3 shrink-0" />
                          {w.empfehlung}
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              <p className="text-[10px] text-muted-foreground text-right">
                Aktualisiert: {new Date(displayed.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · 1-Min-Polling
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
