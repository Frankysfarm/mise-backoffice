'use client';

/**
 * UmsatzPrognosePanel — Phase 420
 *
 * Umsatz-Prognose-Dashboard für den Lieferdienst-Admin:
 * - Tagesvorhersage: erwarteter Umsatz + Konfidenz-Balken + 80%-Band
 * - 7-Tage-Vorschau-Chart (Recharts BarChart mit Fehlerbalken-Overlay)
 * - Trend-Indikator (up/stable/down) + Gesamt-7-Tage-Summe
 * - Historische Ist-Daten (Balken in grau) vs. Prognose (Balken in grün)
 * - 10-Min-Polling, collapsible
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  BarChart3,
  Euro,
  Target,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ComposedChart,
  ErrorBar,
} from 'recharts';
import { cn } from '@/lib/utils';

// ── Typen ──────────────────────────────────────────────────────────────────────

type TrendRichtung = 'up' | 'stable' | 'down';

interface TagesPrognose {
  prognoseDatum:        string;
  wochentag:            number;
  wochentagLabel:       string;
  erwarteterUmsatzEur:  number;
  konfidenz:            number;
  rangeLowEur:          number;
  rangeHighEur:         number;
  basisSnapshots:       number;
  trendRichtung:        TrendRichtung;
  avgUmsatzLetzterMonat: number | null;
}

interface UmsatzPrognoseData {
  locationId:           string;
  berechnungen:         TagesPrognose[];
  berechnungen7TageEur: number;
  trendRichtung:        TrendRichtung;
  letzteAktualisierung: string;
}

interface HistoryRow {
  snapshotDate:     string;
  revenueEur:       number;
  deliveryCount:    number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function fmtEurCompact(v: number): string {
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.', ',') + 'k €';
  return v.toFixed(0) + ' €';
}

function konfidenzLabel(k: number): { label: string; color: string } {
  if (k >= 0.7) return { label: 'hoch',   color: 'text-emerald-700 bg-emerald-50' };
  if (k >= 0.4) return { label: 'mittel', color: 'text-amber-700 bg-amber-50' };
  return               { label: 'niedrig', color: 'text-red-700 bg-red-50' };
}

const TREND_ICONS: Record<TrendRichtung, React.ReactNode> = {
  up:     <TrendingUp  className="h-4 w-4 text-emerald-600" />,
  stable: <Minus       className="h-4 w-4 text-stone-400" />,
  down:   <TrendingDown className="h-4 w-4 text-red-500" />,
};

const TREND_COLORS: Record<TrendRichtung, string> = {
  up:     'text-emerald-600',
  stable: 'text-stone-500',
  down:   'text-red-500',
};

// ── Tooltip ────────────────────────────────────────────────────────────────────

function PrognoseTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TagesPrognose & { istEur?: number } }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-lg text-xs">
      <div className="font-bold text-char mb-1">{d.wochentagLabel} · {d.prognoseDatum}</div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-emerald-700 font-semibold">{fmtEur(d.erwarteterUmsatzEur)}</span>
        <span className="text-stone-400">Prognose</span>
      </div>
      <div className="text-stone-400">Band: {fmtEur(d.rangeLowEur)} – {fmtEur(d.rangeHighEur)}</div>
      {d.avgUmsatzLetzterMonat != null && (
        <div className="text-stone-400 mt-1">Ø letzter Monat: {fmtEur(d.avgUmsatzLetzterMonat)}</div>
      )}
      {d.istEur != null && <div className="text-stone-600 mt-1">Ist: {fmtEur(d.istEur)}</div>}
      <div className="mt-1.5">
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', konfidenzLabel(d.konfidenz).color)}>
          Konfidenz {Math.round(d.konfidenz * 100)}%
        </span>
        <span className="ml-1 text-stone-400">({d.basisSnapshots} Wochen)</span>
      </div>
    </div>
  );
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────

interface Props {
  locationId: string | null;
}

export function UmsatzPrognosePanel({ locationId }: Props) {
  const [open, setOpen]           = useState(false);
  const [prognose, setPrognose]   = useState<UmsatzPrognoseData | null>(null);
  const [history, setHistory]     = useState<HistoryRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [computing, setComputing] = useState(false);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const [prog, hist] = await Promise.all([
        fetch(`/api/delivery/admin/umsatz-prognose?location_id=${locationId}`)
          .then(r => r.json() as Promise<UmsatzPrognoseData>),
        fetch(`/api/delivery/admin/umsatz-prognose?location_id=${locationId}&action=history&days=30`)
          .then(r => r.json() as Promise<{ history: HistoryRow[] }>),
      ]);
      setPrognose(prog);
      setHistory(hist.history ?? []);
      setLastFetch(new Date());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  // Lazy-Polling: nur wenn geöffnet
  useEffect(() => {
    if (!open) { timerRef.current && clearInterval(timerRef.current); return; }
    load();
    timerRef.current = setInterval(load, 10 * 60 * 1000);
    return () => { timerRef.current && clearInterval(timerRef.current); };
  }, [open, load]);

  const handleCompute = async () => {
    if (!locationId || computing) return;
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/umsatz-prognose', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'compute', location_id: locationId }),
      });
      await load();
    } finally {
      setComputing(false);
    }
  };

  // Chart-Daten: Letzte 14 Ist-Tage + 7 Prognose-Tage
  const chartData = (() => {
    const histMap: Record<string, number> = {};
    for (const h of history) histMap[h.snapshotDate] = h.revenueEur;

    const istPunkte = history.slice(-14).map(h => ({
      label:                h.snapshotDate.slice(5),  // MM-DD
      prognoseDatum:        h.snapshotDate,
      wochentagLabel:       '',
      istEur:               h.revenueEur,
      erwarteterUmsatzEur:  null,
      rangeLowEur:          0,
      rangeHighEur:         0,
      konfidenz:            0,
      basisSnapshots:       0,
      avgUmsatzLetzterMonat: null,
      trendRichtung:        'stable' as TrendRichtung,
      wochentag:            0,
      isPrognose:           false,
    }));

    const prognosePunkte = (prognose?.berechnungen ?? []).map(p => ({
      label:                p.wochentagLabel,
      prognoseDatum:        p.prognoseDatum,
      wochentagLabel:       p.wochentagLabel,
      istEur:               histMap[p.prognoseDatum] ?? null,
      erwarteterUmsatzEur:  p.erwarteterUmsatzEur,
      rangeLowEur:          p.rangeLowEur,
      rangeHighEur:         p.rangeHighEur,
      konfidenz:            p.konfidenz,
      basisSnapshots:       p.basisSnapshots,
      avgUmsatzLetzterMonat: p.avgUmsatzLetzterMonat,
      trendRichtung:        p.trendRichtung,
      wochentag:            p.wochentag,
      isPrognose:           true,
    }));

    return [...istPunkte, ...prognosePunkte];
  })();

  const heute = prognose?.berechnungen?.[0];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-char">Umsatz-Prognose</div>
            <div className="text-xs text-stone-400">
              {prognose
                ? `7-Tage: ${fmtEur(prognose.berechnungen7TageEur)} · Trend: ${prognose.trendRichtung}`
                : 'Vorhersage der nächsten 7 Tage'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prognose && (
            <span className="flex items-center gap-1">
              {TREND_ICONS[prognose.trendRichtung]}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 pb-5 pt-4 space-y-5">

          {/* Lade-Zustand */}
          {loading && !prognose && (
            <div className="flex items-center gap-2 text-stone-400 text-sm py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Prognose wird geladen…</span>
            </div>
          )}

          {/* Heutiger KPI */}
          {heute && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                    Heute · {heute.wochentagLabel}
                  </div>
                  <div className="text-3xl font-black text-char tabular-nums">
                    {fmtEur(heute.erwarteterUmsatzEur)}
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    Band: {fmtEur(heute.rangeLowEur)} – {fmtEur(heute.rangeHighEur)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-semibold',
                    konfidenzLabel(heute.konfidenz).color,
                  )}>
                    {Math.round(heute.konfidenz * 100)}% Konfidenz
                  </span>
                  <div className="flex items-center gap-1.5 text-sm">
                    {TREND_ICONS[heute.trendRichtung]}
                    <span className={cn('font-semibold text-xs', TREND_COLORS[heute.trendRichtung])}>
                      {heute.trendRichtung === 'up' ? 'Wachstum' : heute.trendRichtung === 'down' ? 'Rückgang' : 'Stabil'}
                    </span>
                  </div>
                  {heute.avgUmsatzLetzterMonat != null && (
                    <div className="text-[10px] text-stone-400">
                      Ø letzter Monat: {fmtEur(heute.avgUmsatzLetzterMonat)}
                    </div>
                  )}
                </div>
              </div>

              {/* Konfidenz-Balken */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-stone-400 mb-1">
                  <span>Konfidenz</span>
                  <span>{Math.round(heute.konfidenz * 100)}% ({heute.basisSnapshots} Wochen Basis)</span>
                </div>
                <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round(heute.konfidenz * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 7-Tage KPI-Grid */}
          {prognose && prognose.berechnungen.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                7-Tage-Vorschau
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {prognose.berechnungen.map((p, i) => (
                  <div
                    key={p.prognoseDatum}
                    className={cn(
                      'rounded-lg p-2 text-center',
                      i === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-stone-50 border border-stone-100',
                    )}
                  >
                    <div className="text-[10px] font-semibold text-stone-500">{p.wochentagLabel}</div>
                    <div className={cn('text-xs font-bold tabular-nums mt-0.5', i === 0 ? 'text-emerald-700' : 'text-char')}>
                      {fmtEurCompact(p.erwarteterUmsatzEur)}
                    </div>
                    <div className="flex justify-center mt-1">
                      {TREND_ICONS[p.trendRichtung]}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-stone-400">7-Tage-Gesamt</span>
                <span className="text-sm font-bold text-char tabular-nums">
                  {fmtEur(prognose.berechnungen7TageEur)}
                </span>
              </div>
            </div>
          )}

          {/* Combo-Chart: Ist (grau) + Prognose (grün) */}
          {chartData.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                Verlauf + Prognose
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtEurCompact}
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip content={(props) => (
                    <PrognoseTooltip
                      active={props.active}
                      payload={props.payload as unknown as Array<{ payload: TagesPrognose & { istEur?: number } }>}
                    />
                  )} />
                  <ReferenceLine
                    x={prognose?.berechnungen?.[0]?.wochentagLabel}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  {/* Ist-Balken (grau) */}
                  <Bar dataKey="istEur" name="Ist" radius={[3, 3, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.isPrognose ? '#d1fae5' : '#e7e5e4'} />
                    ))}
                  </Bar>
                  {/* Prognose-Balken (grün, transparent) */}
                  <Bar dataKey="erwarteterUmsatzEur" name="Prognose" radius={[3, 3, 0, 0]} fill="#10b981" fillOpacity={0.7}>
                    <ErrorBar dataKey="rangeHighEur" width={4} strokeWidth={2} stroke="#059669" direction="y" />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-1 text-[10px] text-stone-400 justify-end">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-stone-300 inline-block" />Ist</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />Prognose</span>
              </div>
            </div>
          )}

          {/* Leer-Zustand */}
          {!loading && !prognose && (
            <div className="flex flex-col items-center gap-2 py-8 text-stone-400 text-sm">
              <Target className="h-8 w-8 text-stone-300" />
              <span>Noch keine Prognose berechnet.</span>
              <button
                onClick={handleCompute}
                disabled={computing}
                className="mt-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {computing ? 'Berechne…' : 'Jetzt berechnen'}
              </button>
            </div>
          )}

          {/* Footer */}
          {prognose && (
            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCompute}
                  disabled={computing || loading}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                >
                  {computing
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />}
                  Neu berechnen
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                {lastFetch && (
                  <>
                    <Calendar className="h-3 w-3" />
                    <span>Aktualisiert {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
