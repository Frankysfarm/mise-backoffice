'use client';

/**
 * Phase 562 — Lieferdienst: Fahrer-Pausen-Dashboard
 *
 * Zeigt für alle aktiven Fahrer die Pausen-Empfehlung basierend auf
 * Schichtdauer, Touren-Count und letzter Aktivität.
 *
 * Farbkodierung:
 *   dringend      → rot (>5h aktiv, gesetzliche Pause)
 *   jetzt_optimal → grün (Tour fertig, ideale Pausenzeit)
 *   empfohlen     → amber (>3.5h aktiv, Pause nach Tour)
 *   optional      → blau (>3h aktiv, optional)
 *   kein_bedarf   → grau
 *
 * Polling: 60s
 */

import { useEffect, useState } from 'react';
import { Coffee, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

type PausenLevel = 'jetzt_optimal' | 'empfohlen' | 'dringend' | 'optional' | 'kein_bedarf';

interface FahrerPausenEmpfehlung {
  driverId: string;
  fahrerName: string;
  schichtStartedAt: string;
  aktiveStunden: number;
  absolvierteTouren: number;
  hatAktiveTour: boolean;
  letzteAktivitaetVorMin: number | null;
  empfehlungLevel: PausenLevel;
  empfehlungText: string;
  empfohlenePauseDauer: number;
  pausenFensterLabel: string;
}

interface Summary {
  gesamtFahrer: number;
  dringendCount: number;
  empfohlenCount: number;
  optimalCount: number;
  handlungsbedarfSofort: boolean;
}

interface ApiResponse {
  ok: boolean;
  fahrer: FahrerPausenEmpfehlung[];
  summary: Summary;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const LEVEL_CONFIG: Record<PausenLevel, {
  bg: string; border: string; text: string; badgeBg: string; badgeText: string; icon: React.ReactNode; label: string;
}> = {
  dringend: {
    bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700',
    badgeBg: 'bg-red-600', badgeText: 'text-white', label: 'Dringend',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  jetzt_optimal: {
    bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700',
    badgeBg: 'bg-emerald-500', badgeText: 'text-white', label: 'Jetzt optimal',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  empfohlen: {
    bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
    badgeBg: 'bg-amber-400', badgeText: 'text-white', label: 'Empfohlen',
    icon: <Coffee className="h-3.5 w-3.5" />,
  },
  optional: {
    bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700',
    badgeBg: 'bg-blue-400', badgeText: 'text-white', label: 'Optional',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  kein_bedarf: {
    bg: 'bg-muted/30', border: 'border-border', text: 'text-muted-foreground',
    badgeBg: 'bg-muted', badgeText: 'text-muted-foreground', label: 'Kein Bedarf',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
};

function ShiftBar({ aktiveStunden }: { aktiveStunden: number }) {
  const pct   = Math.min(100, (aktiveStunden / 8) * 100);
  const color = aktiveStunden >= 5 ? 'bg-red-500' : aktiveStunden >= 3.5 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] tabular-nums text-muted-foreground shrink-0 w-12 text-right">
        {aktiveStunden.toFixed(1)}h / 8h
      </span>
    </div>
  );
}

export function LieferdienstPhase562FahrerPausenDashboard({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-pausen-empfehlung?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) setData(await res.json() as ApiResponse);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const urgent    = data?.summary.handlungsbedarfSofort ?? false;
  const dringend  = data?.summary.dringendCount ?? 0;
  const empfohlen = data?.summary.empfohlenCount ?? 0;

  const visibleFahrer = data?.fahrer.filter(f => f.empfehlungLevel !== 'kein_bedarf') ?? [];

  return (
    <Card className={cn('overflow-hidden', urgent && 'border-red-300')}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
          urgent ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-muted/50',
        )}
      >
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
          urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
        )}>
          <Coffee className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground flex items-center gap-2">
            Fahrer-Pausen-Empfehlungen
            {dringend > 0 && (
              <span className="rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px] font-black">
                {dringend} dringend
              </span>
            )}
            {empfohlen > 0 && dringend === 0 && (
              <span className="rounded-full bg-amber-400 text-white px-2 py-0.5 text-[10px] font-black">
                {empfohlen} empfohlen
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {data ? `${data.summary.gesamtFahrer} aktive Fahrer analysiert` : 'Lade…'}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {loading && (
            <div className="text-sm text-muted-foreground text-center py-3 animate-pulse">
              Analysiere Fahrer-Schichten…
            </div>
          )}

          {!loading && !locationId && (
            <div className="text-sm text-muted-foreground">Bitte Filiale auswählen.</div>
          )}

          {!loading && data && visibleFahrer.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div className="text-sm text-green-700 font-medium">
                Alle aktiven Fahrer haben ausreichend Pausen eingehalten.
              </div>
            </div>
          )}

          {!loading && data && visibleFahrer.length > 0 && (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-center">
                  <div className="text-lg font-black text-red-700 tabular-nums">{dringend}</div>
                  <div className="text-[9px] text-red-600 font-semibold">Dringend</div>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-center">
                  <div className="text-lg font-black text-amber-700 tabular-nums">{empfohlen}</div>
                  <div className="text-[9px] text-amber-600 font-semibold">Empfohlen</div>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-center">
                  <div className="text-lg font-black text-blue-700 tabular-nums">{data.summary.optimalCount}</div>
                  <div className="text-[9px] text-blue-600 font-semibold">Jetzt optimal</div>
                </div>
              </div>

              {/* Driver cards */}
              <div className="space-y-2">
                {visibleFahrer.map(f => {
                  const cfg = LEVEL_CONFIG[f.empfehlungLevel];
                  return (
                    <div key={f.driverId} className={cn('rounded-xl border p-3 space-y-2', cfg.bg, cfg.border)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-xs font-bold', cfg.text)}>{f.fahrerName}</span>
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                              cfg.badgeBg, cfg.badgeText,
                            )}>
                              {cfg.icon}
                              {cfg.label}
                            </span>
                          </div>
                          <div className={cn('text-[10px] mt-0.5', cfg.text)}>
                            {f.empfehlungText}
                          </div>
                        </div>
                        {f.empfohlenePauseDauer > 0 && (
                          <div className="shrink-0 text-right">
                            <div className={cn('text-sm font-black tabular-nums', cfg.text)}>
                              {f.empfohlenePauseDauer} Min
                            </div>
                            <div className="text-[9px] text-muted-foreground">Pause</div>
                          </div>
                        )}
                      </div>

                      <ShiftBar aktiveStunden={f.aktiveStunden} />

                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={cn('text-[10px]', cfg.text)}>
                          {f.absolvierteTouren} Tour{f.absolvierteTouren !== 1 ? 'en' : ''}
                        </span>
                        {f.hatAktiveTour && (
                          <span className="text-[10px] text-muted-foreground">• Tour läuft</span>
                        )}
                        {f.letzteAktivitaetVorMin !== null && (
                          <span className="text-[10px] text-muted-foreground">
                            • Zuletzt aktiv: {f.letzteAktivitaetVorMin} Min ago
                          </span>
                        )}
                        <span className={cn('text-[10px] ml-auto font-medium', cfg.text)}>
                          {f.pausenFensterLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[10px] text-muted-foreground text-right">
                Aktualisiert: {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 60s-Intervall
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
