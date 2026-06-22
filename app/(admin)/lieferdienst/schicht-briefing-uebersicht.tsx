'use client';

/**
 * SchichtBriefingUebersicht — Phase 429
 *
 * Manager-Panel: Zeigt alle heutigen Schicht-Briefings mit
 * Gesehen-Status und Kurzübersicht je Fahrer.
 * Integration: lieferdienst/client.tsx nach SchichtOptimierungsPanel
 */

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, RefreshCw, CheckCircle, Clock, ChevronDown, ChevronUp, Zap, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Briefing {
  id:                    string;
  driverId:              string;
  driverName:            string;
  schichtStart:          string;
  erwarteteBestellungen: number;
  spitzenstunde:         number | null;
  topZone:               string | null;
  peakKlasseSchicht:     'low' | 'normal' | 'peak' | 'high' | null;
  driverScore:           number | null;
  driverKategorie:       'elite' | 'gut' | 'durchschnitt' | 'auffällig' | null;
  gesehenAm:             string | null;
}

interface Props {
  locationId: string | null;
}

const PEAK_BADGE: Record<string, { cls: string; label: string }> = {
  high:   { cls: 'bg-rose-100 text-rose-700',   label: 'Hochbetrieb' },
  peak:   { cls: 'bg-amber-100 text-amber-700',  label: 'Stoßzeit'   },
  normal: { cls: 'bg-sky-100 text-sky-700',      label: 'Normal'     },
  low:    { cls: 'bg-muted text-muted-foreground',label: 'Ruhig'     },
};

const KAT_BADGE: Record<string, string> = {
  elite:        'bg-violet-100 text-violet-700',
  gut:          'bg-matcha-100 text-matcha-700',
  durchschnitt: 'bg-sky-50 text-sky-700',
  auffällig:    'bg-red-100 text-red-700',
};

const ZONE_DOT: Record<string, string> = {
  A: 'bg-matcha-500', B: 'bg-sky-500', C: 'bg-amber-500', D: 'bg-red-500',
};

export function SchichtBriefingUebersicht({ locationId }: Props) {
  const [briefings, setBriefings] = useState<Briefing[] | null>(null);
  const [open, setOpen]           = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId || !open) return;
    const res = await fetch(
      `/api/delivery/admin/schicht-briefing?location_id=${locationId}`,
    );
    if (!res.ok) return;
    const json = await res.json() as { ok: boolean; briefings: Briefing[] };
    if (json.ok) {
      setBriefings(json.briefings ?? []);
      setLastUpdated(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    }
  }, [locationId, open]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const generate = async () => {
    if (!locationId) return;
    setGenerating(true);
    await fetch('/api/delivery/admin/schicht-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', location_id: locationId }),
    });
    setGenerating(false);
    await load();
  };

  const seenCount  = briefings?.filter((b) => b.gesehenAm).length ?? 0;
  const totalCount = briefings?.length ?? 0;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors border-b"
      >
        <ClipboardList className="h-4 w-4 text-violet-500 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider">Schicht-Briefings Heute</span>
        {briefings !== null && (
          <span className="ml-1 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5">
            {seenCount}/{totalCount} gesehen
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[9px] text-muted-foreground hidden sm:inline">
              {lastUpdated}
            </span>
          )}
          {open
            ? <ChevronUp   className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Actions */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Briefings werden 4h vor Schichtbeginn automatisch generiert.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void load()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                Laden
              </button>
              <button
                onClick={() => void generate()}
                disabled={generating}
                className="flex items-center gap-1.5 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {generating
                  ? <RefreshCw className="h-3 w-3 animate-spin" />
                  : <Zap className="h-3 w-3" />}
                {generating ? 'Generiere…' : 'Jetzt generieren'}
              </button>
            </div>
          </div>

          {/* Loading */}
          {briefings === null && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty */}
          {briefings !== null && briefings.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Keine Briefings für heute — klicke "Jetzt generieren".
            </div>
          )}

          {/* List */}
          {briefings !== null && briefings.length > 0 && (
            <div className="divide-y rounded-xl border overflow-hidden">
              {briefings.map((b) => {
                const peak    = PEAK_BADGE[b.peakKlasseSchicht ?? 'normal'] ?? PEAK_BADGE['normal'];
                const katCls  = KAT_BADGE[b.driverKategorie ?? 'durchschnitt'] ?? KAT_BADGE['durchschnitt'];
                const dotCls  = ZONE_DOT[b.topZone ?? ''] ?? 'bg-muted-foreground';
                const startFmt = new Date(b.schichtStart).toLocaleTimeString('de-DE', {
                  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
                });

                return (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 bg-card hover:bg-muted/30 transition-colors">
                    {/* Seen icon */}
                    <div className="shrink-0">
                      {b.gesehenAm
                        ? <CheckCircle className="h-4 w-4 text-matcha-500" />
                        : <Clock       className="h-4 w-4 text-muted-foreground" />}
                    </div>

                    {/* Driver name + time */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{b.driverName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {startFmt} Uhr · {b.erwarteteBestellungen} Bestell.
                      </div>
                    </div>

                    {/* Zone dot */}
                    {b.topZone && (
                      <div className="flex items-center gap-1 shrink-0">
                        <div className={cn('w-2 h-2 rounded-full', dotCls)} />
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {b.topZone}
                        </span>
                      </div>
                    )}

                    {/* Score */}
                    {b.driverScore !== null && (
                      <div className={cn('flex items-center gap-0.5 shrink-0', katCls, 'rounded-full px-2 py-0.5 text-[10px] font-bold')}>
                        <Star className="h-2.5 w-2.5" />
                        {b.driverScore}
                      </div>
                    )}

                    {/* Peak badge */}
                    <div className={cn('shrink-0 text-[9px] font-bold rounded-full px-2 py-0.5', peak.cls)}>
                      {peak.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {briefings !== null && briefings.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <div className="text-lg font-black">{totalCount}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Briefings</div>
              </div>
              <div className="rounded-lg bg-matcha-50 p-2 text-center">
                <div className="text-lg font-black text-matcha-700">{seenCount}</div>
                <div className="text-[9px] text-matcha-600 uppercase tracking-wide">Gelesen</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <div className="text-lg font-black">{totalCount - seenCount}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Ausstehend</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
