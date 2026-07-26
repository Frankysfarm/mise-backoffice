'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Bike, MapPin, Clock, Star, CheckCircle2, AlertTriangle, TrendingUp, Target, Route } from 'lucide-react';

interface StoppDot {
  stopp_nr: number;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | 'verpasst';
  eta_min: number | null;
  adresse_kurz: string;
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  bewertung: number;
  aktive_stopps: number;
  geliefert: number;
  gesamt_stopps: number;
  stopps: StoppDot[];
  alert: boolean;
}

interface FlotteKpi {
  avg_score: number;
  top_score: number;
  aktive_fahrer: number;
  alert_count: number;
}

const MOCK_FAHRER: FahrerTour[] = [
  {
    fahrer_id: 'f1', fahrer_name: 'Max M.', score: 92, score_delta: 3, puenktlichkeit_pct: 94,
    avg_lieferzeit_min: 21, bewertung: 4.8, aktive_stopps: 2, geliefert: 3, gesamt_stopps: 5, alert: false,
    stopps: [
      { stopp_nr: 1, status: 'geliefert', eta_min: null, adresse_kurz: 'Pontstr. 12' },
      { stopp_nr: 2, status: 'geliefert', eta_min: null, adresse_kurz: 'Berliner Ring 4' },
      { stopp_nr: 3, status: 'geliefert', eta_min: null, adresse_kurz: 'Markt 7' },
      { stopp_nr: 4, status: 'unterwegs', eta_min: 8, adresse_kurz: 'Habsburgerallee 2' },
      { stopp_nr: 5, status: 'ausstehend', eta_min: 18, adresse_kurz: 'Trierer Str. 3' },
    ],
  },
  {
    fahrer_id: 'f2', fahrer_name: 'Sara K.', score: 78, score_delta: -2, puenktlichkeit_pct: 81,
    avg_lieferzeit_min: 26, bewertung: 4.4, aktive_stopps: 3, geliefert: 1, gesamt_stopps: 4, alert: false,
    stopps: [
      { stopp_nr: 1, status: 'geliefert', eta_min: null, adresse_kurz: 'Jakobstr. 5' },
      { stopp_nr: 2, status: 'unterwegs', eta_min: 11, adresse_kurz: 'Grünewaldstr. 9' },
      { stopp_nr: 3, status: 'ausstehend', eta_min: 22, adresse_kurz: 'Boxgraben 12' },
      { stopp_nr: 4, status: 'ausstehend', eta_min: 33, adresse_kurz: 'Vaalser Str. 1' },
    ],
  },
  {
    fahrer_id: 'f3', fahrer_name: 'Tim B.', score: 61, score_delta: -8, puenktlichkeit_pct: 65,
    avg_lieferzeit_min: 34, bewertung: 3.9, aktive_stopps: 2, geliefert: 0, gesamt_stopps: 3, alert: true,
    stopps: [
      { stopp_nr: 1, status: 'unterwegs', eta_min: 14, adresse_kurz: 'Herzogstr. 22' },
      { stopp_nr: 2, status: 'ausstehend', eta_min: 28, adresse_kurz: 'Körnerstr. 8' },
      { stopp_nr: 3, status: 'ausstehend', eta_min: 41, adresse_kurz: 'Westpark 5' },
    ],
  },
];

const MOCK_FLOTTE: FlotteKpi = { avg_score: 77, top_score: 92, aktive_fahrer: 3, alert_count: 1 };

function scoreFarbe(score: number) {
  if (score >= 85) return { bg: 'bg-emerald-500', txt: 'text-emerald-700', ring: 'ring-emerald-300' };
  if (score >= 70) return { bg: 'bg-yellow-400', txt: 'text-yellow-700', ring: 'ring-yellow-200' };
  return              { bg: 'bg-red-500',     txt: 'text-red-700',     ring: 'ring-red-300' };
}

function stoppFarbe(status: StoppDot['status']) {
  if (status === 'geliefert')  return 'bg-emerald-500';
  if (status === 'unterwegs')  return 'bg-blue-500 animate-pulse';
  if (status === 'verpasst')   return 'bg-red-500';
  return 'bg-slate-300';
}

export function DispatchPhase3954TourScoreVisualisierungUltimate({ locationId }: { locationId: string | null }) {
  const [fahrer, setFahrer] = useState<FahrerTour[]>(MOCK_FAHRER);
  const [flotte, setFlotte] = useState<FlotteKpi>(MOCK_FLOTTE);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-routen-score?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.fahrer)) setFahrer(d.fahrer);
        if (d.flotte) setFlotte(d.flotte);
      }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  return (
    <div className="rounded-xl border border-amber-100 bg-white p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="font-semibold text-sm text-slate-800">Tour-Score · Visualisierung Ultimate</span>
        {loading && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {flotte.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
            <AlertTriangle className="h-3 w-3" /> {flotte.alert_count} Alert
          </span>
        )}
      </div>

      {/* Flotten-KPI */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Trophy, label: 'Ø Score', value: flotte.avg_score.toString() },
          { icon: Star, label: 'Top Score', value: flotte.top_score.toString() },
          { icon: Bike, label: 'Fahrer', value: flotte.aktive_fahrer.toString() },
          { icon: AlertTriangle, label: 'Alerts', value: flotte.alert_count.toString() },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-lg bg-amber-50 px-2 py-1.5 text-center">
            <Icon className="h-3 w-3 text-amber-500 mx-auto mb-0.5" />
            <div className="text-[10px] text-slate-500">{label}</div>
            <div className="text-sm font-bold text-slate-800 tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {/* Fahrer Score Cards */}
      <div className="space-y-2">
        {fahrer.map((f) => {
          const farbe = scoreFarbe(f.score);
          const fortschrittPct = Math.round((f.geliefert / Math.max(1, f.gesamt_stopps)) * 100);
          const isExpanded = expanded === f.fahrer_id;

          return (
            <div
              key={f.fahrer_id}
              className={`rounded-lg border p-3 cursor-pointer transition-all ${f.alert ? 'border-red-300 bg-red-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
              onClick={() => setExpanded(isExpanded ? null : f.fahrer_id)}
            >
              {/* Fahrer Header */}
              <div className="flex items-center gap-3 mb-2">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ${farbe.bg} ${farbe.ring}`}>
                  {f.score}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{f.fahrer_name}</span>
                    {f.alert && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                    <span className={`text-xs font-medium ${f.score_delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {f.score_delta >= 0 ? '+' : ''}{f.score_delta}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                    <span><Clock className="inline h-2.5 w-2.5 mr-0.5" />{f.avg_lieferzeit_min} min</span>
                    <span><CheckCircle2 className="inline h-2.5 w-2.5 mr-0.5" />{f.puenktlichkeit_pct}%</span>
                    <span><Star className="inline h-2.5 w-2.5 mr-0.5" />{f.bewertung.toFixed(1)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">{f.geliefert}/{f.gesamt_stopps} Stopps</div>
                  <div className="text-[10px] text-slate-400">{fortschrittPct}%</div>
                </div>
              </div>

              {/* Score Balken */}
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                <div className={`h-full ${farbe.bg} rounded-full transition-all duration-700`} style={{ width: `${f.score}%` }} />
              </div>

              {/* Stopp-Dot-Timeline */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {f.stopps.map((s) => (
                  <div
                    key={s.stopp_nr}
                    className={`h-3 w-3 rounded-full ${stoppFarbe(s.status)}`}
                    title={`Stopp ${s.stopp_nr}: ${s.adresse_kurz}${s.eta_min ? ` – ETA ${s.eta_min} min` : ''}`}
                  />
                ))}
                <span className="text-[10px] text-slate-400 ml-1">
                  {f.aktive_stopps} aktiv
                </span>
              </div>

              {/* Expandierter Stopp-Detail */}
              {isExpanded && (
                <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
                  {f.stopps.map((s) => (
                    <div key={s.stopp_nr} className="flex items-center gap-2 text-xs">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${stoppFarbe(s.status).replace(' animate-pulse', '')}`} />
                      <span className="text-slate-600 truncate flex-1">{s.stopp_nr}. {s.adresse_kurz}</span>
                      {s.eta_min && <span className="text-slate-400 shrink-0">~{s.eta_min} min</span>}
                      <span className={`text-[10px] shrink-0 ${s.status === 'geliefert' ? 'text-emerald-600' : s.status === 'unterwegs' ? 'text-blue-600' : s.status === 'verpasst' ? 'text-red-600' : 'text-slate-400'}`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                  <div className="pt-1 grid grid-cols-3 gap-1 text-[10px]">
                    <div className="text-center"><span className="text-slate-400">Pünktl.</span><br /><span className={`font-semibold ${f.puenktlichkeit_pct >= 85 ? 'text-emerald-600' : 'text-red-600'}`}>{f.puenktlichkeit_pct}%</span></div>
                    <div className="text-center"><span className="text-slate-400">Lieferzeit</span><br /><span className={`font-semibold ${f.avg_lieferzeit_min <= 25 ? 'text-emerald-600' : 'text-orange-600'}`}>{f.avg_lieferzeit_min} min</span></div>
                    <div className="text-center"><span className="text-slate-400">Bewertung</span><br /><span className={`font-semibold ${f.bewertung >= 4.5 ? 'text-emerald-600' : 'text-yellow-600'}`}>★{f.bewertung.toFixed(1)}</span></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!locationId && (
        <div className="text-xs text-slate-400 text-center">Filiale auswählen für Live-Daten</div>
      )}
    </div>
  );
}
