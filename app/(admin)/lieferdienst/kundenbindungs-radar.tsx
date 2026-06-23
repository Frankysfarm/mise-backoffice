'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Trophy } from 'lucide-react';

type Segmentierung = 'champion' | 'loyal' | 'at_risk' | 'lost';

interface SegmentStats {
  segmentierung:  Segmentierung;
  count:          number;
  avgScore:       number;
  avgBestellwert: number;
  avgFrequenz:    number;
}

interface KundenScore {
  id:                string;
  kundeTelefon:      string;
  kundeName:         string | null;
  score:             number;
  segmentierung:     Segmentierung;
  bestellfrequenz:   number | null;
  avgBestellwert:    number | null;
  letzteBestellung:  string | null;
  stornorate:        number | null;
  bestellungenTotal: number;
}

interface Dashboard {
  totalKunden:   number;
  avgScore:      number | null;
  segmentStats:  SegmentStats[];
  topKunden:     KundenScore[];
  atRiskKunden:  KundenScore[];
  berechnetAm:   string | null;
}

const SEGMENT_CONFIG: Record<Segmentierung, { label: string; color: string; bg: string; ring: string }> = {
  champion: { label: 'Champions',  color: 'text-violet-700', bg: 'bg-violet-50',  ring: 'bg-violet-500' },
  loyal:    { label: 'Stamm',      color: 'text-blue-700',   bg: 'bg-blue-50',    ring: 'bg-blue-500'   },
  at_risk:  { label: 'Risiko',     color: 'text-amber-700',  bg: 'bg-amber-50',   ring: 'bg-amber-400'  },
  lost:     { label: 'Verloren',   color: 'text-red-700',    bg: 'bg-red-50',     ring: 'bg-red-400'    },
};

function scoreColor(s: number) {
  if (s >= 75) return 'text-violet-700';
  if (s >= 50) return 'text-blue-700';
  if (s >= 25) return 'text-amber-700';
  return 'text-red-600';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function fmtEur(v: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Minimales Pie-Chart-SVG (keine externen Libraries)
function PieChart({ stats, total }: { stats: SegmentStats[]; total: number }) {
  if (total === 0) return <div className="h-32 w-32 rounded-full bg-stone-100 mx-auto" />;

  const segments: Segmentierung[] = ['champion', 'loyal', 'at_risk', 'lost'];
  const colors: Record<Segmentierung, string> = {
    champion: '#8b5cf6',
    loyal:    '#3b82f6',
    at_risk:  '#fbbf24',
    lost:     '#f87171',
  };

  let cumulAngle = -Math.PI / 2; // Start oben
  const cx = 60;
  const cy = 60;
  const r  = 55;

  const paths: { d: string; color: string; seg: Segmentierung }[] = [];

  for (const seg of segments) {
    const s     = stats.find((st) => st.segmentierung === seg);
    const count = s?.count ?? 0;
    if (count === 0) continue;
    const angle = (count / total) * 2 * Math.PI;
    const x1    = cx + r * Math.cos(cumulAngle);
    const y1    = cy + r * Math.sin(cumulAngle);
    const x2    = cx + r * Math.cos(cumulAngle + angle);
    const y2    = cy + r * Math.sin(cumulAngle + angle);
    const large = angle > Math.PI ? 1 : 0;
    paths.push({
      d:     `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      color: colors[seg],
      seg,
    });
    cumulAngle += angle;
  }

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto">
      {paths.map((p) => (
        <path key={p.seg} d={p.d} fill={p.color} stroke="white" strokeWidth="2" />
      ))}
    </svg>
  );
}

export function KundenbindungsRadar({ locationId }: { locationId: string | null }) {
  const [open, setOpen]         = useState(false);
  const [data, setData]         = useState<Dashboard | null>(null);
  const [loading, setLoading]   = useState(false);
  const [computing, setComp]    = useState(false);
  const locationRef             = useRef(locationId);
  locationRef.current           = locationId;

  const load = useCallback(async () => {
    const loc = locationRef.current;
    if (!loc) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/kundenbindung?location_id=${encodeURIComponent(loc)}&action=dashboard`);
      const j = await r.json() as { dashboard?: Dashboard };
      if (j.dashboard) setData(j.dashboard);
    } catch {/* ignore */}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open && locationId) load();
  }, [open, locationId, load]);

  const handleCompute = async () => {
    if (!locationId) return;
    setComp(true);
    try {
      await fetch('/api/delivery/admin/kundenbindung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', location_id: locationId }),
      });
      await load();
    } catch {/* ignore */}
    finally { setComp(false); }
  };

  const total     = data?.totalKunden ?? 0;
  const avgScore  = data?.avgScore ?? null;
  const atRiskCnt = (data?.segmentStats.find((s) => s.segmentierung === 'at_risk')?.count ?? 0)
                  + (data?.segmentStats.find((s) => s.segmentierung === 'lost')?.count ?? 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Heart className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-char">Kundenbindungs-Radar</div>
            <div className="text-xs text-stone-400">
              {total > 0
                ? `${total} Kunden · Ø Score ${avgScore?.toFixed(1) ?? '—'}`
                : 'Segmentierung: Champion / Stamm / Risiko / Verloren'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {atRiskCnt > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              {atRiskCnt} Risiko
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-100 p-5 space-y-5">
          {/* Toolbar */}
          <div className="flex items-center justify-end">
            <button
              onClick={handleCompute}
              disabled={computing}
              className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${computing ? 'animate-spin' : ''}`} />
              Neu berechnen
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : !data || total === 0 ? (
            <p className="text-center text-sm text-stone-400 py-6">
              Keine Kunden-Scores vorhanden. Berechnung starten.
            </p>
          ) : (
            <>
              {/* Pie-Chart + Segment-Legenden */}
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <PieChart stats={data.segmentStats} total={total} />
                <div className="grid grid-cols-2 gap-2 flex-1 w-full">
                  {data.segmentStats.map((s) => {
                    const cfg = SEGMENT_CONFIG[s.segmentierung];
                    const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                    return (
                      <div key={s.segmentierung} className={`rounded-xl ${cfg.bg} p-3`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className={`h-2.5 w-2.5 rounded-full ${cfg.ring}`} />
                          <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <div className={`text-xl font-black tabular-nums ${cfg.color}`}>{s.count}</div>
                        <div className="text-[10px] text-stone-500 mt-0.5">{pct}% · Ø {s.avgScore.toFixed(0)} Pkt</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top-10 Kunden */}
              {data.topKunden.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-3.5 w-3.5 text-violet-600" />
                    <span className="text-xs font-bold text-char">Top-10 Kunden</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-stone-400">
                          <th className="pb-1.5 pr-3 font-semibold">Kunde</th>
                          <th className="pb-1.5 pr-3 font-semibold text-right">Score</th>
                          <th className="pb-1.5 pr-3 font-semibold text-right">Bestellungen</th>
                          <th className="pb-1.5 pr-3 font-semibold text-right">Ø Wert</th>
                          <th className="pb-1.5 font-semibold text-right">Letzte Bestellung</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {data.topKunden.map((k) => {
                          const cfg = SEGMENT_CONFIG[k.segmentierung];
                          return (
                            <tr key={k.id} className="hover:bg-stone-50">
                              <td className="py-1.5 pr-3">
                                <div className="font-semibold text-char">{k.kundeName ?? k.kundeTelefon}</div>
                                {k.kundeName && (
                                  <div className="text-[10px] text-stone-400">{k.kundeTelefon}</div>
                                )}
                              </td>
                              <td className="py-1.5 pr-3 text-right">
                                <span className={`font-black ${scoreColor(k.score)}`}>{k.score.toFixed(0)}</span>
                              </td>
                              <td className="py-1.5 pr-3 text-right text-stone-600">{k.bestellungenTotal}</td>
                              <td className="py-1.5 pr-3 text-right text-stone-600">{fmtEur(k.avgBestellwert)}</td>
                              <td className="py-1.5 text-right">
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
                                  {fmtDate(k.letzteBestellung)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* At-Risk Kunden */}
              {data.atRiskKunden.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-char">Risiko-Kunden</span>
                    <span className="text-[10px] text-stone-400">(Reaktivierung empfohlen)</span>
                  </div>
                  <div className="space-y-1.5">
                    {data.atRiskKunden.slice(0, 10).map((k) => (
                      <div key={k.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2">
                        <div>
                          <div className="text-xs font-semibold text-char">{k.kundeName ?? k.kundeTelefon}</div>
                          <div className="text-[10px] text-stone-500">
                            {k.bestellungenTotal} Bestellungen · Letzte: {fmtDate(k.letzteBestellung)}
                          </div>
                        </div>
                        <span className={`text-sm font-black ${scoreColor(k.score)}`}>{k.score.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.berechnetAm && (
                <p className="text-[10px] text-stone-400 text-right">
                  Berechnet: {new Date(data.berechnetAm).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
