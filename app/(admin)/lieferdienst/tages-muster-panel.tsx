'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, BarChart3, Clock, TrendingUp } from 'lucide-react';

// ── Typen ──────────────────────────────────────────────────────────────────────

type PeakKlasse = 'low' | 'normal' | 'peak' | 'high';

interface PrognoseStunde {
  stundeUtc:        number;
  stundeLabel:      string;
  istVergangenheit: boolean;
  avgBestellungen:  number;
  avgUmsatzEur:     number;
  peakKlasse:       PeakKlasse;
}

interface TagesBlock {
  wochentag:      number;
  wochentagLabel: string;
  stunden:        PrognoseStunde[];
}

interface Prognose {
  locationId:            string;
  heute:                 TagesBlock;
  morgen:                TagesBlock;
  letzteAktualisierung:  string | null;
}

interface MusterStunde {
  wochentag:       number;
  wochentagLabel:  string;
  stunde:          number;
  stundeLabel:     string;
  avgBestellungen: number;
  avgUmsatzEur:    number;
  p75Bestellungen: number;
  peakKlasse:      PeakKlasse;
  basisTage:       number;
}

interface MusterTag {
  wochentag:      number;
  wochentagLabel: string;
  stunden:        MusterStunde[];
  peakStunden:    number[];
  maxAvgStunde:   number;
  totalAvgBest:   number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const PEAK_COLORS: Record<PeakKlasse, string> = {
  low:    'bg-stone-100 text-stone-400',
  normal: 'bg-sky-50 text-sky-600',
  peak:   'bg-amber-100 text-amber-700',
  high:   'bg-rose-100 text-rose-700',
};

const PEAK_CELL_BG: Record<PeakKlasse, string> = {
  low:    'bg-stone-50',
  normal: 'bg-sky-50/60',
  peak:   'bg-amber-50',
  high:   'bg-rose-50',
};

const PEAK_LABEL: Record<PeakKlasse, string> = {
  low:    'Ruhig',
  normal: 'Normal',
  peak:   'Peak',
  high:   'Hochbetrieb',
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function fmtTs(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

// ── Heute/Morgen Balken-Chart ─────────────────────────────────────────────────

function TagBarChart({ block, title }: { block: TagesBlock; title: string }) {
  const maxAvg = Math.max(...block.stunden.map(s => s.avgBestellungen), 1);
  const aktivStunden = block.stunden.filter(s => s.avgBestellungen > 0);

  if (aktivStunden.length === 0) {
    return (
      <div className="text-xs text-stone-400 text-center py-4">Keine Daten für {block.wochentagLabel}</div>
    );
  }

  return (
    <div>
      <div className="text-xs font-semibold text-stone-500 mb-2">{title} — {block.wochentagLabel}</div>
      <div className="flex items-end gap-0.5 h-16">
        {block.stunden.map(s => {
          const h = Math.round((s.avgBestellungen / maxAvg) * 100);
          const isPast = s.istVergangenheit;
          const barBg =
            s.peakKlasse === 'high'   ? 'bg-rose-400'  :
            s.peakKlasse === 'peak'   ? 'bg-amber-400' :
            s.peakKlasse === 'low'    ? 'bg-stone-200' :
            isPast                    ? 'bg-sky-200'   : 'bg-sky-400';

          return (
            <div
              key={s.stundeUtc}
              className="flex-1 flex flex-col justify-end group relative"
              title={`${s.stundeLabel}: Ø ${s.avgBestellungen.toFixed(1)} Bestell. · ${fmtEur(s.avgUmsatzEur)}`}
            >
              <div
                className={`rounded-t-sm transition-all ${barBg} ${isPast ? 'opacity-40' : 'opacity-90'}`}
                style={{ height: `${Math.max(h, s.avgBestellungen > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-stone-300">00:00</span>
        <span className="text-[9px] text-stone-300">12:00</span>
        <span className="text-[9px] text-stone-300">23:00</span>
      </div>
    </div>
  );
}

// ── Nächste Stunden Vorschau ──────────────────────────────────────────────────

function NaechsteStundenPanel({ stunden }: { stunden: PrognoseStunde[] }) {
  const upcoming = stunden.filter(s => !s.istVergangenheit).slice(0, 6);
  if (upcoming.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="text-xs font-semibold text-stone-500 mb-2">Nächste Stunden (heute)</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {upcoming.map(s => (
          <div
            key={s.stundeUtc}
            className={`rounded-xl p-2 text-center ${PEAK_CELL_BG[s.peakKlasse]}`}
          >
            <div className="text-[11px] font-bold text-stone-700">{s.stundeLabel}</div>
            <div className="text-lg font-black tabular-nums text-stone-800 leading-tight">
              {s.avgBestellungen.toFixed(1)}
            </div>
            <div className="text-[9px] text-stone-400">Best./h</div>
            <div className={`mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold inline-block ${PEAK_COLORS[s.peakKlasse]}`}>
              {PEAK_LABEL[s.peakKlasse]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Wochenmuster Heatmap ──────────────────────────────────────────────────────

function WochenmusterHeatmap({ muster }: { muster: MusterTag[] }) {
  if (muster.length === 0) return (
    <div className="text-xs text-stone-400 text-center py-4">Keine Musterdaten verfügbar</div>
  );

  const allAvgs = muster.flatMap(t => t.stunden.map(s => s.avgBestellungen));
  const maxVal = Math.max(...allAvgs, 1);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        <div className="text-xs font-semibold text-stone-500 mb-2">Wochenmuster (Heatmap — Ø Bestellungen/h)</div>

        {/* Stunden-Header */}
        <div className="flex gap-px mb-1">
          <div className="w-8 shrink-0" />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[8px] text-stone-300">
              {h % 4 === 0 ? `${(h + 2) % 24}` : ''}
            </div>
          ))}
        </div>

        {muster.map(tag => (
          <div key={tag.wochentag} className="flex items-center gap-px mb-0.5">
            <div className="w-8 shrink-0 text-[10px] font-semibold text-stone-500 text-right pr-1">
              {tag.wochentagLabel}
            </div>
            {Array.from({ length: 24 }, (_, h) => {
              const stunde = tag.stunden.find(s => s.stunde === h);
              const intensity = stunde ? stunde.avgBestellungen / maxVal : 0;
              const pk = stunde?.peakKlasse ?? 'low';
              const bg =
                intensity === 0 ? 'bg-stone-50' :
                pk === 'high'   ? `bg-rose-${Math.min(Math.round(intensity * 4 + 1) * 100, 500) as 100|200|300|400|500}` :
                pk === 'peak'   ? `bg-amber-${Math.min(Math.round(intensity * 3 + 1) * 100, 400) as 100|200|300|400}` :
                pk === 'low'    ? 'bg-stone-100' :
                                  `bg-sky-${Math.min(Math.round(intensity * 2 + 1) * 100, 300) as 100|200|300}`;

              return (
                <div
                  key={h}
                  className={`flex-1 h-5 rounded-sm ${bg} transition-colors cursor-default`}
                  title={stunde
                    ? `${tag.wochentagLabel} ${stunde.stundeLabel}: Ø ${stunde.avgBestellungen.toFixed(1)} Bestell. · ${fmtEur(stunde.avgUmsatzEur)} · ${PEAK_LABEL[pk]}`
                    : `${tag.wochentagLabel} ${(h + 2) % 24}:00: keine Daten`
                  }
                />
              );
            })}
          </div>
        ))}

        {/* Legende */}
        <div className="flex items-center gap-3 mt-2">
          {(['low', 'normal', 'peak', 'high'] as PeakKlasse[]).map(pk => (
            <div key={pk} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-sm ${PEAK_CELL_BG[pk]}`} />
              <span className="text-[9px] text-stone-400">{PEAK_LABEL[pk]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

interface Props {
  locationId: string | null;
}

export function TagesMusterPanel({ locationId }: Props) {
  const [open, setOpen]           = useState(false);
  const [prognose, setPrognose]   = useState<Prognose | null>(null);
  const [muster, setMuster]       = useState<MusterTag[]>([]);
  const [loading, setLoading]     = useState(false);
  const [computing, setComputing] = useState(false);
  const [tab, setTab]             = useState<'prognose' | 'heatmap'>('prognose');
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId || !open) return;
    setLoading(true);
    try {
      const [pRes, mRes] = await Promise.all([
        fetch(`/api/delivery/admin/tages-muster?location_id=${encodeURIComponent(locationId)}&action=prognose`),
        fetch(`/api/delivery/admin/tages-muster?location_id=${encodeURIComponent(locationId)}&action=muster`),
      ]);
      const pData = await pRes.json() as { ok: boolean; prognose?: Prognose };
      const mData = await mRes.json() as { ok: boolean; muster?: MusterTag[] };
      if (pData.ok && pData.prognose) setPrognose(pData.prognose);
      if (mData.ok && mData.muster)   setMuster(mData.muster);
      setLastFetch(new Date());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId, open]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => { void load(); }, 10 * 60_000);
    return () => clearInterval(id);
  }, [open, load]);

  const handleCompute = async () => {
    if (!locationId) return;
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/tages-muster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', location_id: locationId }),
      });
      await load();
    } catch { /* ignore */ } finally {
      setComputing(false);
    }
  };

  const hasData  = prognose !== null && muster.length > 0;
  const noData   = !loading && prognose === null;

  // KPIs aus Heute
  const heutePeakStunden = prognose?.heute.stunden.filter(
    s => s.peakKlasse === 'peak' || s.peakKlasse === 'high'
  ) ?? [];
  const heuteMaxStunde = prognose?.heute.stunden.reduce(
    (best, s) => s.avgBestellungen > best.avgBestellungen ? s : best,
    prognose?.heute.stunden[0]
  );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 border-b border-stone-100 hover:bg-stone-50 transition-colors"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-char">Tages-Muster-Erkennung</div>
            <div className="text-xs text-stone-400">
              {hasData && heuteMaxStunde && heuteMaxStunde.avgBestellungen > 0
                ? `Hochbetrieb heute ~${heuteMaxStunde.stundeLabel} · ${heutePeakStunden.length} Peak-Stunden`
                : 'Stündliche Muster · Wöchentliche Heatmap'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              {muster.length} Tage analysiert
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {loading && (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!loading && noData && (
            <div className="text-center py-8 space-y-3">
              <BarChart3 className="h-8 w-8 text-stone-300 mx-auto" />
              <div className="text-sm text-stone-500">Noch keine Muster berechnet</div>
              <div className="text-xs text-stone-400">
                Berechne stündliche Bestell-Muster aus den letzten 90 Tagen
              </div>
              <button
                onClick={handleCompute}
                disabled={computing}
                className="mt-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {computing ? 'Berechne…' : 'Jetzt berechnen'}
              </button>
            </div>
          )}

          {!loading && hasData && (
            <>
              {/* Tab-Wechsler */}
              <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
                {(['prognose', 'heatmap'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                      tab === t ? 'bg-white shadow-sm text-violet-700' : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {t === 'prognose' ? (
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />Heute &amp; Morgen
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3" />Wochenmuster
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {tab === 'prognose' && prognose && (
                <div className="space-y-4">
                  {/* KPI-Zeile */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-violet-50 p-3 text-center">
                      <div className="text-lg font-black tabular-nums text-violet-700">
                        {heutePeakStunden.length}
                      </div>
                      <div className="text-[10px] font-semibold text-stone-500">Peak-Stunden</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3 text-center">
                      <div className="text-lg font-black tabular-nums text-amber-700">
                        {heuteMaxStunde?.stundeLabel ?? '–'}
                      </div>
                      <div className="text-[10px] font-semibold text-stone-500">Hochbetrieb</div>
                    </div>
                    <div className="rounded-xl bg-sky-50 p-3 text-center">
                      <div className="text-lg font-black tabular-nums text-sky-700">
                        {fmtEur(prognose.heute.stunden.reduce((s, h) => s + h.avgUmsatzEur, 0))}
                      </div>
                      <div className="text-[10px] font-semibold text-stone-500">Ø Tagesumsatz</div>
                    </div>
                  </div>

                  {/* Balken-Charts */}
                  <TagBarChart block={prognose.heute} title="Heute" />
                  <NaechsteStundenPanel stunden={prognose.heute.stunden} />
                  <TagBarChart block={prognose.morgen} title="Morgen" />
                </div>
              )}

              {tab === 'heatmap' && (
                <WochenmusterHeatmap muster={muster} />
              )}
            </>
          )}

          {/* Footer */}
          {open && (
            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <div className="text-[11px] text-stone-400">
                {lastFetch
                  ? `Aktualisiert ${lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                  : prognose?.letzteAktualisierung
                  ? `Berechnet ${fmtTs(prognose.letzteAktualisierung)}`
                  : ''}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCompute}
                  disabled={computing}
                  className="flex items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 ${computing ? 'animate-spin' : ''}`} />
                  Neu berechnen
                </button>
                <button
                  onClick={load}
                  className="flex items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
