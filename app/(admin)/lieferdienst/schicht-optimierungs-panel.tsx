'use client';

/**
 * SchichtOptimierungsPanel — Phase 428
 *
 * Wochentag-Picker mit stündlichen Fahrer-Empfehlungen basierend auf
 * dem Tages-Muster-Optimierer. Zeigt Empfehlung vs. Ist-Besetzung
 * mit Ampelfarben und Konfidenz-Balken.
 */

import { useEffect, useState, useCallback } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, RefreshCw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ──────────────────────────────────────────────────────────────────────

interface StundeVorschlag {
  wochentag:               number;
  stunde:                  number;
  empfohlene_fahrer_anzahl: number;
  konfidenz:               number;
  tages_muster_basis:      number;
  avg_bestellungen:        number;
  peak_klasse:             string | null;
  ist_fahrer:              number;
  berechnet_am?:           string;
}

interface VorschlaegeTag {
  wochentag:      number;
  wochentagLabel: string;
  stunden:        StundeVorschlag[];
}

interface ApiResponse {
  locationId:  string;
  vorschlaege: VorschlaegeTag[];
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const DOW_LABELS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DOW_SHORT       = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const BERLIN_OFFSET_H = 2; // UTC+2 Näherung (CEST)

function berlinH(utcH: number): string {
  const h = (utcH + BERLIN_OFFSET_H) % 24;
  return String(h).padStart(2, '0') + ':00';
}

type Ampel = 'ok' | 'knapp' | 'kritisch' | 'idle';

function getAmpel(empfohlen: number, ist: number): Ampel {
  if (empfohlen <= 1 && ist === 0) return 'idle';
  if (ist >= empfohlen)            return 'ok';
  if (ist >= empfohlen - 1)        return 'knapp';
  return 'kritisch';
}

const AMPEL_CFG: Record<Ampel, { bg: string; badge: string; label: string }> = {
  ok:       { bg: 'bg-matcha-50',  badge: 'bg-matcha-500 text-white',  label: '✓' },
  knapp:    { bg: 'bg-amber-50',   badge: 'bg-amber-400 text-white',   label: '~' },
  kritisch: { bg: 'bg-red-50',     badge: 'bg-red-500 text-white',     label: '!' },
  idle:     { bg: 'bg-stone-50',   badge: 'bg-stone-300 text-white',   label: '–' },
};

const PEAK_COLOR: Record<string, string> = {
  high:   'text-red-600 font-bold',
  peak:   'text-amber-600 font-semibold',
  normal: 'text-stone-500',
  low:    'text-stone-400',
};

// ── Komponente ────────────────────────────────────────────────────────────────

interface Props {
  locationId: string | null;
}

export function SchichtOptimierungsPanel({ locationId }: Props) {
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [computing, setComputing] = useState(false);
  const [data,      setData]      = useState<VorschlaegeTag[]>([]);
  const [activeDow, setActiveDow] = useState<number>(new Date().getDay());
  const [lastCalc,  setLastCalc]  = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/delivery/admin/schicht-optimierer?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json.vorschlaege ?? []);

      // letztes Berechnungsdatum aus den Daten ableiten
      const allStunden = json.vorschlaege.flatMap(t => t.stunden);
      if (allStunden.length > 0) {
        const latestIso = allStunden[allStunden.length - 1]?.berechnet_am as string | undefined;
        if (latestIso) {
          setLastCalc(
            new Date(latestIso).toLocaleString('de-DE', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
            }),
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const compute = useCallback(async () => {
    if (!locationId) return;
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/schicht-optimierer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'compute', location_id: locationId }),
      });
      await load();
    } finally {
      setComputing(false);
    }
  }, [locationId, load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!locationId) return null;

  const todayTag = data.find(t => t.wochentag === activeDow);

  // Nur Stunden mit Aktivität oder Bedarf (6–23 Uhr UTC = 8–1 Uhr Berlin)
  const stundenVisible = (todayTag?.stunden ?? []).filter(s => s.stunde >= 6 && s.stunde <= 22);

  // KPI-Zusammenfassung für aktiven Tag
  const totalEmpfohlen = stundenVisible.reduce((s, r) => s + r.empfohlene_fahrer_anzahl, 0);
  const totalIst       = stundenVisible.reduce((s, r) => s + r.ist_fahrer, 0);
  const countKritisch  = stundenVisible.filter(s => getAmpel(s.empfohlene_fahrer_anzahl, s.ist_fahrer) === 'kritisch').length;
  const hasData        = data.length > 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Schicht-Auslastungs-Optimierer
          </span>
          {countKritisch > 0 && (
            <span className="text-[9px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">
              {countKritisch} unterbesetzt
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastCalc && (
            <span className="text-[9px] text-muted-foreground hidden sm:block">
              Stand: {lastCalc}
            </span>
          )}
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-100 px-4 pb-4 pt-3 space-y-3">
          {/* Aktionsleiste */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              Empfohlene Fahrerzahl je Stunde aus Tages-Muster-Analyse (90 Tage).
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => void compute()}
                disabled={computing}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                <Zap className={cn('h-3 w-3', computing && 'animate-pulse')} />
                {computing ? 'Berechne…' : 'Neu berechnen'}
              </button>
              <button
                onClick={() => void load()}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Fehler */}
          {error && (
            <div className="text-[11px] text-red-600 bg-red-50 rounded px-3 py-2">{error}</div>
          )}

          {/* Kein Datensatz — Hinweis */}
          {!hasData && !loading && !error && (
            <div className="text-center py-6 text-[12px] text-muted-foreground">
              <p>Noch keine Vorschläge berechnet.</p>
              <p className="mt-1 text-[11px]">Klicke auf „Neu berechnen" um Vorschläge aus dem Tages-Muster zu generieren.</p>
            </div>
          )}

          {hasData && (
            <>
              {/* Wochentag-Picker */}
              <div className="flex gap-1 flex-wrap">
                {DOW_SHORT.map((label, dow) => {
                  const tag       = data.find(t => t.wochentag === dow);
                  const hasTag    = !!tag;
                  const isToday   = dow === new Date().getDay();
                  const isActive  = dow === activeDow;
                  const stunden   = (tag?.stunden ?? []).filter(s => s.stunde >= 6 && s.stunde <= 22);
                  const kritisch  = stunden.filter(s => getAmpel(s.empfohlene_fahrer_anzahl, s.ist_fahrer) === 'kritisch').length;
                  return (
                    <button
                      key={dow}
                      onClick={() => setActiveDow(dow)}
                      className={cn(
                        'relative flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors',
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                        !hasTag && 'opacity-40',
                      )}
                    >
                      {label}
                      {isToday && (
                        <span className={cn(
                          'text-[8px] font-normal',
                          isActive ? 'text-indigo-200' : 'text-indigo-500',
                        )}>
                          heute
                        </span>
                      )}
                      {kritisch > 0 && !isActive && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-white text-[7px] flex items-center justify-center">
                          {kritisch}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tages-Überschrift + KPIs */}
              {todayTag && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-stone-700">
                    {DOW_LABELS_LONG[activeDow]}
                  </span>
                  <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
                    <span>
                      Ø Bedarf: <strong className="text-foreground">{totalEmpfohlen}</strong> Fahrer-Stunden
                    </span>
                    <span>
                      Geplant: <strong className={cn('font-bold', totalIst >= totalEmpfohlen ? 'text-matcha-600' : 'text-red-600')}>
                        {totalIst}
                      </strong>
                    </span>
                    {countKritisch > 0 && (
                      <span className="text-red-600 font-semibold">
                        {countKritisch} Stunden unterbesetzt
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Stunden-Tabelle */}
              {stundenVisible.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground border-b border-stone-100">
                        <th className="text-left py-1.5 pr-3 font-semibold w-16">Uhrzeit</th>
                        <th className="text-right py-1.5 px-2 font-semibold">Ø Bestellungen</th>
                        <th className="text-right py-1.5 px-2 font-semibold">Empfohlen</th>
                        <th className="text-right py-1.5 px-2 font-semibold">Geplant</th>
                        <th className="text-center py-1.5 pl-2 font-semibold w-16">Status</th>
                        <th className="text-left py-1.5 pl-3 font-semibold">Konfidenz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stundenVisible.map(s => {
                        const ampel  = getAmpel(s.empfohlene_fahrer_anzahl, s.ist_fahrer);
                        const cfg    = AMPEL_CFG[ampel];
                        const pctBar = Math.round(s.konfidenz * 100);
                        const pkCls  = PEAK_COLOR[s.peak_klasse ?? 'normal'] ?? PEAK_COLOR['normal'];
                        return (
                          <tr
                            key={s.stunde}
                            className={cn(
                              'border-b border-stone-50 transition-colors',
                              cfg.bg,
                            )}
                          >
                            <td className="py-1.5 pr-3 font-mono font-semibold text-stone-700">
                              {berlinH(s.stunde)}
                            </td>
                            <td className={cn('py-1.5 px-2 text-right tabular-nums', pkCls)}>
                              {s.avg_bestellungen.toFixed(1)}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-stone-700">
                              {s.empfohlene_fahrer_anzahl}
                            </td>
                            <td className={cn(
                              'py-1.5 px-2 text-right tabular-nums font-bold',
                              ampel === 'ok' || ampel === 'idle' ? 'text-matcha-700' : ampel === 'knapp' ? 'text-amber-700' : 'text-red-700',
                            )}>
                              {s.ist_fahrer}
                            </td>
                            <td className="py-1.5 pl-2 text-center">
                              <span className={cn(
                                'inline-flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-black',
                                cfg.badge,
                              )}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="py-1.5 pl-3">
                              <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-16 bg-stone-200 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      pctBar >= 80 ? 'bg-matcha-500' : pctBar >= 50 ? 'bg-amber-400' : 'bg-stone-400',
                                    )}
                                    style={{ width: `${pctBar}%` }}
                                  />
                                </div>
                                <span className="text-[9px] text-muted-foreground tabular-nums">
                                  {pctBar}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground py-4">
                  Keine Daten für {DOW_LABELS_LONG[activeDow]}.
                </p>
              )}

              {/* Legende */}
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-1 border-t border-stone-100">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-matcha-500" />
                  OK — ausreichend Fahrer
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                  Knapp — 1 Fahrer unter Bedarf
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  Kritisch — &gt;1 Fahrer unter Bedarf
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
