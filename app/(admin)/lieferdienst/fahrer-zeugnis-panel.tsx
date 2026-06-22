'use client';

/**
 * FahrerZeugnisPanel — Phase 432
 *
 * Manager-Panel: Monatliche Leistungszeugnisse aller Fahrer.
 * Grade-Badge, KPI-Übersicht, JSON-Export, Zeugnis-Generierung.
 * Integration: lieferdienst/client.tsx nach FahrerIncentivePanel.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Award, Download, RefreshCw, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

interface ZeugnisData {
  schichtenAnzahl:    number;
  lieferungenGesamt:  number;
  puenktlichkeitsPct: number | null;
  compositeScore:     number | null;
  verdienstEur:       number | null;
  topZone:            string | null;
  scoreTrend:         number | null;
  scoreTrendPct:      number | null;
  avgDeliveryMin:     number | null;
  erzielteBoni:       number;
  bonusSummeEur:      number | null;
  highlights:         string[];
  bewertungstext:     string;
}

interface Zeugnis {
  id:         string;
  driverId:   string;
  driverName: string | null;
  monat:      string;
  grade:      ScoreGrade;
  daten:      ZeugnisData;
  erstelltAm: string;
}

interface Props {
  locationId: string | null;
}

const GRADE_COLOR: Record<ScoreGrade, string> = {
  'A+': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'A':  'bg-green-100 text-green-800 border-green-300',
  'B':  'bg-blue-100 text-blue-800 border-blue-300',
  'C':  'bg-amber-100 text-amber-800 border-amber-300',
  'D':  'bg-red-100 text-red-800 border-red-300',
};

function MonatLabel({ monat }: { monat: string }) {
  const d = new Date(monat);
  return (
    <span className="text-xs text-zinc-500 font-mono">
      {d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
    </span>
  );
}

function TrendIcon({ trend }: { trend: number | null }) {
  if (trend === null) return <Minus className="h-3.5 w-3.5 text-zinc-400" />;
  if (trend > 1)  return <TrendingUp   className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend < -1) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-zinc-400" />;
}

function exportJson(zeugnis: Zeugnis) {
  const blob = new Blob([JSON.stringify(zeugnis, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const name = (zeugnis.driverName ?? zeugnis.driverId).replace(/\s+/g, '_');
  a.href     = url;
  a.download = `zeugnis_${name}_${zeugnis.monat}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function FahrerZeugnisPanel({ locationId }: Props) {
  const [open,      setOpen]      = useState(false);
  const [zeugnisse, setZeugnisse] = useState<Zeugnis[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/delivery/admin/fahrer-zeugnis?location_id=${locationId}&limit=60`);
      const json = await res.json() as { zeugnisse?: Zeugnis[] };
      setZeugnisse(json.zeugnisse ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (open && locationId) load();
  }, [open, load, locationId]);

  const handleGenerate = async () => {
    if (!locationId) return;
    setGenerating(true);
    try {
      await fetch('/api/delivery/admin/fahrer-zeugnis', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'generate', location_id: locationId }),
      });
      await load();
    } finally {
      setGenerating(false);
    }
  };

  // Gruppierung nach Monat
  const byMonth: Record<string, Zeugnis[]> = {};
  for (const z of zeugnisse) {
    if (!byMonth[z.monat]) byMonth[z.monat] = [];
    byMonth[z.monat].push(z);
  }
  const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

  const gradeStats = (list: Zeugnis[]) => {
    const counts: Record<ScoreGrade, number> = { 'A+': 0, A: 0, B: 0, C: 0, D: 0 };
    for (const z of list) counts[z.grade]++;
    return counts;
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-violet-500" />
          <span className="font-semibold text-zinc-800">Fahrer-Leistungszeugnisse</span>
          {zeugnisse.length > 0 && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              {zeugnisse.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-5 pb-5 pt-4 space-y-4">
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !locationId}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              {generating ? 'Generiere…' : 'Zeugnisse generieren'}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Aktualisieren
            </button>
          </div>

          {loading && (
            <p className="text-sm text-zinc-400">Lädt…</p>
          )}

          {!loading && zeugnisse.length === 0 && (
            <p className="text-sm text-zinc-400">Noch keine Zeugnisse vorhanden. Zeugnisse werden monatlich am 1. des Monats generiert.</p>
          )}

          {/* Monate */}
          {months.map(monat => {
            const list  = byMonth[monat];
            const stats = gradeStats(list);
            return (
              <div key={monat} className="space-y-2">
                <div className="flex items-center justify-between">
                  <MonatLabel monat={monat} />
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    {(['A+', 'A', 'B', 'C', 'D'] as ScoreGrade[]).map(g => stats[g] > 0 && (
                      <span key={g} className={cn('rounded border px-1.5 py-0.5 font-semibold text-[10px]', GRADE_COLOR[g])}>
                        {g}: {stats[g]}
                      </span>
                    ))}
                  </div>
                </div>

                {list.map(z => {
                  const isExpanded = expandedId === z.id;
                  const d = z.daten;
                  return (
                    <div key={z.id} className="rounded-xl border border-zinc-100 bg-zinc-50 overflow-hidden">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : z.id)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            'rounded-lg border px-2.5 py-0.5 text-sm font-bold',
                            GRADE_COLOR[z.grade],
                          )}>
                            {z.grade}
                          </span>
                          <span className="font-medium text-zinc-800 text-sm">
                            {z.driverName ?? z.driverId}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500">
                            {d.lieferungenGesamt} Ldg. · {d.schichtenAnzahl} Schichten
                          </span>
                          {d.compositeScore != null && (
                            <span className="text-xs font-mono text-zinc-600">
                              Score {d.compositeScore.toFixed(1)}
                            </span>
                          )}
                          <TrendIcon trend={d.scoreTrend} />
                          <button
                            onClick={e => { e.stopPropagation(); exportJson(z); }}
                            className="rounded p-1 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700"
                            title="JSON exportieren"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-zinc-100 px-4 pb-4 pt-3 space-y-3">
                          {/* KPI-Grid */}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                              { label: 'Schichten',   value: String(d.schichtenAnzahl) },
                              { label: 'Lieferungen', value: String(d.lieferungenGesamt) },
                              { label: 'Pünktlichkeit', value: d.puenktlichkeitsPct != null ? `${d.puenktlichkeitsPct.toFixed(1)} %` : '—' },
                              { label: 'Ø Lieferzeit', value: d.avgDeliveryMin != null ? `${d.avgDeliveryMin.toFixed(0)} min` : '—' },
                              { label: 'Score', value: d.compositeScore != null ? d.compositeScore.toFixed(1) : '—' },
                              { label: 'Verdienst', value: d.verdienstEur != null ? `${d.verdienstEur.toFixed(2)} €` : '—' },
                              { label: 'Top-Zone', value: d.topZone ?? '—' },
                              { label: 'Boni erreicht', value: d.erzielteBoni > 0 ? `${d.erzielteBoni}× (${d.bonusSummeEur?.toFixed(2) ?? '0'} €)` : '0' },
                            ].map(kpi => (
                              <div key={kpi.label} className="rounded-lg bg-white border border-zinc-100 px-3 py-2">
                                <p className="text-[10px] text-zinc-400 uppercase tracking-wide">{kpi.label}</p>
                                <p className="font-semibold text-zinc-800 text-sm mt-0.5">{kpi.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Trend */}
                          {d.scoreTrend !== null && (
                            <div className={cn(
                              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                              d.scoreTrend > 0 ? 'bg-emerald-50 text-emerald-700' : d.scoreTrend < 0 ? 'bg-red-50 text-red-700' : 'bg-zinc-50 text-zinc-500',
                            )}>
                              <TrendIcon trend={d.scoreTrend} />
                              Score-Trend vs. Vorvormonat: {d.scoreTrend > 0 ? '+' : ''}{d.scoreTrend.toFixed(1)} Pkt.
                              {d.scoreTrendPct !== null && ` (${d.scoreTrendPct > 0 ? '+' : ''}${d.scoreTrendPct.toFixed(1)} %)`}
                            </div>
                          )}

                          {/* Bewertungstext */}
                          <p className="text-sm text-zinc-600 italic leading-relaxed">{d.bewertungstext}</p>

                          {/* Highlights */}
                          {d.highlights.length > 0 && (
                            <ul className="space-y-1">
                              {d.highlights.map((h, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                                  <span className="mt-0.5 text-violet-400">•</span>
                                  {h}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
