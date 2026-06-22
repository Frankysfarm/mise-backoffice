'use client';

/**
 * WartezeitStatsPanel — Phase 419
 *
 * Statistiken-Dashboard für Wartezeiten im Lieferdienst:
 * - 4 KPI-Kacheln (Gesamt, Küche, Abholung, Zustellung)
 * - Engpass-Ampel mit Empfehlung
 * - 7-Tage-Trend-Chart (Balken)
 * - Fahrer-Rangliste (Abholwartezeit)
 * - 5-Min-Polling, collapsible
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ──────────────────────────────────────────────────────────────────────

type Ampel = 'gruen' | 'gelb' | 'rot';

interface Kpis {
  gesamtMin:          number | null;
  kuechemin:          number | null;
  abholungMin:        number | null;
  zustellungMin:      number | null;
  anzahlBestellungen: number;
  engpass:            string;
  engpassDeltaMin:    number | null;
}

interface Phase {
  name:    string;
  avgMin:  number | null;
  zielMin: number;
  ampel:   Ampel;
}

interface TrendRow {
  tag:        string;
  gesamtMin:  number | null;
  kuechemin:  number | null;
  anzahl:     number;
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

const AMPEL: Record<Ampel, { bg: string; text: string; dot: string; border: string }> = {
  gruen: { bg: 'bg-matcha-50', text: 'text-matcha-700', dot: 'bg-matcha-500', border: 'border-matcha-200' },
  gelb:  { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',  border: 'border-amber-200'  },
  rot:   { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-red-200'    },
};

const ENGPASS_LABELS: Record<string, string> = {
  kueche:     'Küche',
  abholung:   'Abholung',
  zustellung: 'Zustellung',
  keine:      'Kein Engpass',
};

const fmt = (min: number | null): string => min !== null ? `${min.toFixed(1)}'` : '—';

function trendIcon(rows: TrendRow[]): JSX.Element {
  if (rows.length < 2) return <Minus className="h-3 w-3" />;
  const last  = rows[rows.length - 1].gesamtMin ?? 0;
  const prev  = rows[rows.length - 2].gesamtMin ?? 0;
  const delta = last - prev;
  if (delta >  1) return <TrendingUp  className="h-3 w-3 text-red-500" />;
  if (delta < -1) return <TrendingDown className="h-3 w-3 text-matcha-600" />;
  return <Minus className="h-3 w-3 text-stone-400" />;
}

// ── Komponente ─────────────────────────────────────────────────────────────────

export function WartezeitStatsPanel({ locationId }: { locationId: string | null }) {
  const [open, setOpen]     = useState(false);
  const [tab, setTab]       = useState<'uebersicht' | 'trend' | 'fahrer'>('uebersicht');
  const [kpis, setKpis]     = useState<Kpis | null>(null);
  const [phasen, setPhasen] = useState<Phase[]>([]);
  const [trend, setTrend]   = useState<TrendRow[]>([]);
  const [fahrer, setFahrer] = useState<FahrerEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(async (showLoading = false) => {
    if (!locationId) return;
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const [dash, trendRes, fahrerRes] = await Promise.all([
        fetch(`/api/delivery/admin/wartezeit-analyse?location_id=${encodeURIComponent(locationId)}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/delivery/admin/wartezeit-analyse?action=trend&location_id=${encodeURIComponent(locationId)}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/delivery/admin/wartezeit-analyse?action=fahrer&location_id=${encodeURIComponent(locationId)}`).then(r => r.ok ? r.json() : null),
      ]);
      if (dash?.kpis) { setKpis(dash.kpis); setPhasen(dash.phasen ?? []); }
      if (trendRes?.trend) setTrend(trendRes.trend);
      if (fahrerRes?.fahrer) setFahrer(fahrerRes.fahrer);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    loadAll(true);
    timerRef.current = setInterval(() => loadAll(false), 300_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, loadAll]);

  if (!locationId) return null;

  const engpassKey = kpis?.engpass ?? 'keine';
  const engpassAmpel: Ampel = engpassKey === 'keine' ? 'gruen' : (kpis?.engpassDeltaMin ?? 0) > 5 ? 'rot' : 'gelb';

  const trendMax = Math.max(...trend.map(r => r.gesamtMin ?? 0), 1);

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
            <div className="text-sm font-bold text-stone-800">Wartezeit-Statistiken</div>
            <div className="text-xs text-stone-400">Pipeline-Analyse · 8h-Fenster</div>
          </div>
          {kpis && (
            <div className={cn(
              'ml-2 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
              AMPEL[engpassAmpel].bg,
              AMPEL[engpassAmpel].text,
            )}>
              <div className={cn('h-1.5 w-1.5 rounded-full', AMPEL[engpassAmpel].dot)} />
              {fmt(kpis.gesamtMin)} Ø
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <button
              onClick={e => { e.stopPropagation(); loadAll(false); }}
              className="rounded-full p-1.5 hover:bg-stone-100 transition text-stone-400"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Lade Wartezeiten…</span>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
                {(['uebersicht', 'trend', 'fahrer'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-[11px] font-bold transition',
                      tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700',
                    )}
                  >
                    {t === 'uebersicht' ? 'Übersicht' : t === 'trend' ? '7-Tage-Trend' : 'Fahrer'}
                  </button>
                ))}
              </div>

              {/* ── Übersicht ── */}
              {tab === 'uebersicht' && kpis && (
                <div className="space-y-3">
                  {/* 4 KPI-Kacheln */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: 'Gesamt',     val: kpis.gesamtMin,     ziel: 35 },
                      { label: 'Küche',      val: kpis.kuechemin,     ziel: 15 },
                      { label: 'Abholung',   val: kpis.abholungMin,   ziel:  5 },
                      { label: 'Zustellung', val: kpis.zustellungMin, ziel: 15 },
                    ].map(kpi => {
                      const delta = kpi.val !== null ? kpi.val - kpi.ziel : null;
                      const amp: Ampel = delta === null ? 'gruen' : delta <= 2 ? 'gruen' : delta <= 6 ? 'gelb' : 'rot';
                      return (
                        <div key={kpi.label} className={cn('rounded-xl p-3 border', AMPEL[amp].bg, AMPEL[amp].border)}>
                          <div className={cn('text-lg font-black tabular-nums', AMPEL[amp].text)}>
                            {fmt(kpi.val)}
                          </div>
                          <div className="text-[9px] font-semibold text-stone-500 uppercase tracking-wide mt-0.5">
                            {kpi.label}
                          </div>
                          <div className="text-[9px] text-stone-400">Ziel {kpi.ziel}'</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Engpass */}
                  <div className={cn('rounded-xl p-3 flex gap-2.5 border', AMPEL[engpassAmpel].bg, AMPEL[engpassAmpel].border)}>
                    {engpassKey === 'keine'
                      ? <CheckCircle2 className={cn('h-4 w-4 shrink-0', AMPEL[engpassAmpel].text)} />
                      : <AlertTriangle className={cn('h-4 w-4 shrink-0', AMPEL[engpassAmpel].text)} />
                    }
                    <div>
                      <div className={cn('text-xs font-bold', AMPEL[engpassAmpel].text)}>
                        {engpassKey === 'keine' ? 'Alle Phasen im Zielkorridor' : `Engpass: ${ENGPASS_LABELS[engpassKey]}`}
                        {kpis.engpassDeltaMin != null && kpis.engpassDeltaMin > 0 && (
                          <span className="font-normal"> (+{kpis.engpassDeltaMin.toFixed(1)} Min)</span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-500 mt-0.5">
                        {kpis.anzahlBestellungen} Bestellungen analysiert (letzte 8h)
                      </div>
                    </div>
                  </div>

                  {/* Phasen-Balken */}
                  <div className="space-y-2">
                    {phasen.map(p => {
                      const amp = p.ampel as Ampel;
                      return (
                        <div key={p.name} className="flex items-center gap-3">
                          <div className="w-24 text-[10px] font-bold text-stone-600 truncate shrink-0">{p.name.split(' ')[0]}</div>
                          <div className="flex-1 h-3 rounded-full bg-stone-100 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', {
                                'bg-matcha-400': amp === 'gruen',
                                'bg-amber-400':  amp === 'gelb',
                                'bg-red-400':    amp === 'rot',
                              })}
                              style={{ width: `${Math.min(100, ((p.avgMin ?? 0) / (p.zielMin * 2)) * 100)}%` }}
                            />
                          </div>
                          <div className={cn('w-10 text-right text-xs font-black tabular-nums', AMPEL[amp].text)}>
                            {fmt(p.avgMin)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 7-Tage-Trend ── */}
              {tab === 'trend' && (
                <div className="space-y-2">
                  {trend.length === 0 ? (
                    <div className="text-sm text-stone-400 text-center py-4">Noch keine Trend-Daten.</div>
                  ) : (
                    <>
                      <div className="flex items-end gap-1.5 h-24">
                        {trend.map(row => {
                          const h = Math.max(4, ((row.gesamtMin ?? 0) / trendMax) * 100);
                          const amp: Ampel = (row.gesamtMin ?? 0) > 40 ? 'rot' : (row.gesamtMin ?? 0) > 35 ? 'gelb' : 'gruen';
                          return (
                            <div key={row.tag} className="flex flex-col items-center gap-1 flex-1">
                              <div className="text-[9px] text-stone-500 tabular-nums">
                                {row.gesamtMin !== null ? row.gesamtMin.toFixed(0) : '—'}
                              </div>
                              <div
                                className={cn('w-full rounded-t-sm', {
                                  'bg-matcha-400': amp === 'gruen',
                                  'bg-amber-400':  amp === 'gelb',
                                  'bg-red-400':    amp === 'rot',
                                })}
                                style={{ height: `${h}%` }}
                              />
                              <div className="text-[8px] text-stone-400">
                                {new Date(row.tag).toLocaleDateString('de-DE', { weekday: 'short' })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                        {trendIcon(trend)}
                        Ø Gesamtlieferzeit letzte 7 Tage (Ziel: 35 Min)
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Fahrer ── */}
              {tab === 'fahrer' && (
                <div className="space-y-2">
                  {fahrer.length === 0 ? (
                    <div className="text-sm text-stone-400 text-center py-4">Keine Fahrer-Daten (7 Tage).</div>
                  ) : (
                    <>
                      {fahrer.slice(0, 8).map((f, i) => {
                        const amp = f.ampel as Ampel;
                        return (
                          <div key={f.fahrerId} className="flex items-center gap-3">
                            <span className="w-4 text-[10px] text-stone-400 font-bold">{i + 1}</span>
                            <div className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                              AMPEL[amp].bg, AMPEL[amp].text,
                            )}>
                              {f.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-bold text-stone-800 truncate">{f.fahrerName ?? 'Unbekannt'}</div>
                              <div className="text-[9px] text-stone-400">{f.touren} Touren</div>
                            </div>
                            <div className={cn('text-xs font-black tabular-nums', AMPEL[amp].text)}>
                              {fmt(f.abholungAvgMin)}
                            </div>
                          </div>
                        );
                      })}
                      <div className="text-[9px] text-stone-400 pt-1">
                        Abholwartezeit je Fahrer · Ziel: 5 Min · letzte 7 Tage
                      </div>
                    </>
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
