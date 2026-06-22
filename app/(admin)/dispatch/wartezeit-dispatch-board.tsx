'use client';

/**
 * WartezeitDispatchBoard — Phase 419
 *
 * Dispatch-Ansicht der Wartezeit-Pipeline:
 * - Funnel-Visualisierung (Küche → Abholung → Zustellung)
 * - Engpass-Indikator mit Handlungsempfehlung
 * - Fahrer-Rangliste nach Abholwartezeit
 * - 2-Min-Polling, collapsible
 */

import { useCallback, useEffect, useState } from 'react';
import { Clock, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, CheckCircle2, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ──────────────────────────────────────────────────────────────────────

type Ampel = 'gruen' | 'gelb' | 'rot';

interface Phase {
  name:     string;
  avgMin:   number | null;
  zielMin:  number;
  deltaMin: number | null;
  ampel:    Ampel;
  anteil:   number;
}

interface Kpis {
  gesamtMin:          number | null;
  kuechemin:          number | null;
  abholungMin:        number | null;
  zustellungMin:      number | null;
  anzahlBestellungen: number;
  engpass:            string;
  engpassDeltaMin:    number | null;
}

interface Dashboard {
  kpis:   Kpis;
  phasen: Phase[];
}

interface FahrerEntry {
  fahrerId:       string;
  initials:       string;
  fahrerName:     string | null;
  abholungAvgMin: number | null;
  touren:         number;
  ampel:          Ampel;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const AMPEL_STYLE: Record<Ampel, { dot: string; text: string; bg: string }> = {
  gruen: { dot: 'bg-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50' },
  gelb:  { dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50'  },
  rot:   { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50'    },
};

const ENGPASS_LABELS: Record<string, string> = {
  kueche:      'Küche (Prep)',
  abholung:    'Abholung (Pickup)',
  zustellung:  'Zustellung (Fahrt)',
  keine:       'Kein Engpass',
};

const ENGPASS_TIPPS: Record<string, string> = {
  kueche:     'Küche priorisieren — Fahrer müssen warten. Batch-Grouping oder zusätzliche Station erwägen.',
  abholung:   'Fahrer kommen zu spät zur Abholung. Push-Benachrichtigung an Fahrer senden.',
  zustellung: 'Fahrzeit zu lang — Zonen-Optimierung oder mehr Fahrer in Randgebieten prüfen.',
  keine:      'Alle Phasen im Zielkorridor. Weiter so!',
};

const fmt = (min: number | null): string => {
  if (min === null) return '—';
  return `${min.toFixed(1)}'`;
};

// ── Komponente ─────────────────────────────────────────────────────────────────

export function WartezeitDispatchBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen]           = useState(true);
  const [tab, setTab]             = useState<'pipeline' | 'fahrer'>('pipeline');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [fahrer, setFahrer]       = useState<FahrerEntry[] | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(() => {
    if (!locationId) return;
    return fetch(`/api/delivery/admin/wartezeit-analyse?location_id=${encodeURIComponent(locationId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.phasen) setDashboard(d as Dashboard); })
      .catch(() => {});
  }, [locationId]);

  const loadFahrer = useCallback(() => {
    if (!locationId) return;
    return fetch(`/api/delivery/admin/wartezeit-analyse?action=fahrer&location_id=${encodeURIComponent(locationId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.fahrer) setFahrer(d.fahrer); })
      .catch(() => {});
  }, [locationId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDashboard(), loadFahrer()]);
    setRefreshing(false);
  }, [loadDashboard, loadFahrer]);

  useEffect(() => {
    if (!open) return;
    Promise.all([loadDashboard(), loadFahrer()]).finally(() => setLoading(false));
    const t = setInterval(refresh, 120_000);
    return () => clearInterval(t);
  }, [open, loadDashboard, loadFahrer, refresh]);

  if (!locationId) return null;

  const kpis = dashboard?.kpis;
  const phasen = dashboard?.phasen ?? [];
  const engpassKey = kpis?.engpass ?? 'keine';
  const engpassAmpel: Ampel = engpassKey === 'keine' ? 'gruen' : kpis && kpis.engpassDeltaMin && kpis.engpassDeltaMin > 5 ? 'rot' : 'gelb';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Wartezeit-Pipeline</div>
            <div className="text-xs text-stone-400">Küche → Abholung → Zustellung</div>
          </div>
          {kpis && (
            <div className={cn(
              'ml-3 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
              AMPEL_STYLE[engpassAmpel].bg,
              AMPEL_STYLE[engpassAmpel].text,
            )}>
              <div className={cn('h-1.5 w-1.5 rounded-full', AMPEL_STYLE[engpassAmpel].dot)} />
              {fmt(kpis.gesamtMin)} Gesamt
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); refresh(); }}
            className="rounded-full p-1.5 hover:bg-stone-100 transition text-stone-400"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-6 gap-2 text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Lade Daten…</span>
            </div>
          )}

          {!loading && (
            <>
              {/* Tabs */}
              <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
                {(['pipeline', 'fahrer'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-xs font-bold transition',
                      tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700',
                    )}
                  >
                    {t === 'pipeline' ? 'Pipeline' : 'Fahrer'}
                  </button>
                ))}
              </div>

              {tab === 'pipeline' && (
                <div className="space-y-3">
                  {/* Engpass-Banner */}
                  {kpis && (
                    <div className={cn(
                      'rounded-xl p-3 flex gap-2.5',
                      AMPEL_STYLE[engpassAmpel].bg,
                    )}>
                      {engpassKey === 'keine'
                        ? <CheckCircle2 className={cn('h-4 w-4 shrink-0 mt-0.5', AMPEL_STYLE[engpassAmpel].text)} />
                        : <AlertTriangle className={cn('h-4 w-4 shrink-0 mt-0.5', AMPEL_STYLE[engpassAmpel].text)} />
                      }
                      <div>
                        <div className={cn('text-xs font-bold', AMPEL_STYLE[engpassAmpel].text)}>
                          Engpass: {ENGPASS_LABELS[engpassKey] ?? engpassKey}
                          {kpis.engpassDeltaMin != null && kpis.engpassDeltaMin > 0 && (
                            <span className="ml-1 font-normal">
                              (+{kpis.engpassDeltaMin.toFixed(1)} Min über Ziel)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {ENGPASS_TIPPS[engpassKey]}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phasen-Funnel */}
                  <div className="space-y-2">
                    {phasen.map(p => {
                      const ac = AMPEL_STYLE[p.ampel];
                      return (
                        <div key={p.name} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className={cn('h-2 w-2 rounded-full', ac.dot)} />
                              <span className="text-[11px] font-bold text-stone-700">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn('text-xs font-black tabular-nums', ac.text)}>
                                {fmt(p.avgMin)}
                              </span>
                              <span className="text-[10px] text-stone-400">/ Ziel {p.zielMin}'</span>
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all duration-700', {
                                'bg-matcha-400': p.ampel === 'gruen',
                                'bg-amber-400':  p.ampel === 'gelb',
                                'bg-red-400':    p.ampel === 'rot',
                              })}
                              style={{ width: `${Math.min(100, (p.avgMin ?? 0) / (p.zielMin * 2) * 100)}%` }}
                            />
                          </div>
                          <div className="text-[9px] text-stone-400 text-right">{p.anteil}% der Gesamtzeit</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Gesamt-KPI */}
                  {kpis && (
                    <div className="flex gap-2 pt-1">
                      <div className="flex-1 rounded-xl bg-stone-50 border border-stone-100 p-3 text-center">
                        <div className="text-lg font-black tabular-nums text-stone-800">{fmt(kpis.gesamtMin)}</div>
                        <div className="text-[9px] text-stone-400 font-semibold uppercase tracking-wide">Ø Gesamt</div>
                      </div>
                      <div className="flex-1 rounded-xl bg-stone-50 border border-stone-100 p-3 text-center">
                        <div className="text-lg font-black tabular-nums text-stone-800">{kpis.anzahlBestellungen}</div>
                        <div className="text-[9px] text-stone-400 font-semibold uppercase tracking-wide">Bestellungen</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'fahrer' && (
                <div className="space-y-2">
                  {(!fahrer || fahrer.length === 0) ? (
                    <div className="text-sm text-stone-400 text-center py-4">
                      <Users className="h-5 w-5 mx-auto mb-1 opacity-30" />
                      Keine Fahrer-Daten (letzte 7 Tage).
                    </div>
                  ) : (
                    fahrer.slice(0, 8).map((f, i) => {
                      const ac = AMPEL_STYLE[f.ampel];
                      return (
                        <div key={f.fahrerId} className="flex items-center gap-3">
                          <div className="w-5 text-[11px] font-bold text-stone-400 text-right">{i + 1}</div>
                          <div className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black',
                            ac.bg,
                            ac.text,
                          )}>
                            {f.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold text-stone-700 truncate">
                              {f.fahrerName ?? 'Unbekannt'}
                            </div>
                            <div className="text-[9px] text-stone-400">{f.touren} Touren (7T)</div>
                          </div>
                          <div className={cn('text-xs font-black tabular-nums', ac.text)}>
                            {fmt(f.abholungAvgMin)}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {fahrer && fahrer.length > 0 && (
                    <div className="text-[9px] text-stone-400 pt-1">
                      Abholwartezeit je Fahrer (Ø letzte 7 Tage) — Ziel: 5 Min
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
