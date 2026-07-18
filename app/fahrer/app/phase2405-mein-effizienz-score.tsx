'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface FaktorDetails {
  f_touren: number;
  f_reaktion: number;
  f_abbruch: number;
  f_km: number;
  f_pause: number;
}

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  faktoren: FaktorDetails;
  touren: number;
  reaktion_sek: number;
  abbruch_pct: number;
  km_pro_tour: number;
  pause_min: number;
}

interface ApiData {
  fahrer_single: FahrerScore;
  team_avg_score: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-red-50 border-red-200 text-red-800';
}

function ampelText(a: string) {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-yellow-600';
  return 'text-red-600';
}

function ampelBar(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function faktorBar(score: number) {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function coachingTipp(f: FahrerScore): string {
  if (f.score >= 75) return 'Top-Performance! Alle Faktoren im grünen Bereich. Weiter so!';
  if (f.score >= 50) {
    const schwach = [];
    if (f.faktoren.f_reaktion < 60) schwach.push('Reaktionszeit verbessern (Ziel ≤60s)');
    if (f.faktoren.f_abbruch < 60) schwach.push('Abbruchquote senken (Ziel <5%)');
    if (f.faktoren.f_touren < 60) schwach.push('Mehr Touren annehmen (Ziel 6–10)');
    if (f.faktoren.f_km < 60) schwach.push('Kürzere Routen wählen (Ziel 3–8 km)');
    if (f.faktoren.f_pause < 60) schwach.push('Pausen optimieren (Ziel 5–20 Min)');
    return schwach.length ? `Verbesserungspotenzial: ${schwach[0]}.` : 'Leistung ok — kleine Verbesserungen möglich.';
  }
  return 'Score unter 50 — bitte mit dem Dispatcher sprechen. Fokus: Reaktionszeit und Touren-Stabilität verbessern.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const FAKTOR_LABELS = [
  { key: 'f_touren' as const, label: 'Touren/Schicht', gewicht: '30%' },
  { key: 'f_reaktion' as const, label: 'Reaktionszeit', gewicht: '20%' },
  { key: 'f_abbruch' as const, label: 'Abbruchquote', gewicht: '20%' },
  { key: 'f_km' as const, label: 'km/Tour', gewicht: '15%' },
  { key: 'f_pause' as const, label: 'Pausenzeit', gewicht: '15%' },
];

export function FahrerPhase2405MeinEffizienzScore({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-effizienz-score?location_id=${locationId}&driver_id=${driverId}`,
      );
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const f = data?.fahrer_single;

  return (
    <div className={`rounded-xl border mb-3 ${f ? ampelBg(f.ampel) : 'bg-indigo-50 border-indigo-200'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Star size={16} className={f ? ampelText(f.ampel) : 'text-indigo-600'} />
          <span className={`font-semibold text-sm ${f ? ampelText(f.ampel) : 'text-indigo-800'}`}>
            Mein Effizienz-Score {f ? `— ${f.score}/100` : ''}
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!f ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {/* Hero score */}
              <div className="text-center py-2">
                <div className={`text-5xl font-bold ${ampelText(f.ampel)}`}>{f.score}</div>
                <div className="text-xs text-gray-500 mt-1">von 100 Punkten</div>
              </div>

              {/* Overall score bar */}
              <div className="space-y-1">
                <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${ampelBar(f.ampel)}`}
                    style={{ width: `${f.score}%` }}
                  />
                  <div className="absolute top-0 h-full border-l-2 border-yellow-600 opacity-70" style={{ left: '50%' }} />
                  <div className="absolute top-0 h-full border-l-2 border-green-700 opacity-70" style={{ left: '75%' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span className="text-red-500">0</span>
                  <span className="text-yellow-600">50</span>
                  <span className="text-green-700">75</span>
                  <span className="text-green-700">100</span>
                </div>
              </div>

              {/* 5-Faktor breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">Aufschlüsselung (5 Faktoren)</p>
                {FAKTOR_LABELS.map(({ key, label, gewicht }) => {
                  const val = f.faktoren[key];
                  return (
                    <div key={key} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">{label} <span className="text-gray-400">({gewicht})</span></span>
                        <span className="font-semibold">{val}/100</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${faktorBar(val)}`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{f.score_vw}</div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendIcon trend={f.trend} />
                    <span className="text-sm font-bold text-gray-800">
                      {f.trend_delta > 0 ? '+' : ''}{f.trend_delta}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">Trend vs. VW</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">75</div>
                  <div className="text-xs text-gray-500">Ziel</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{data!.team_avg_score}</div>
                  <div className="text-xs text-gray-500">Team-Ø</div>
                </div>
              </div>

              {/* Coaching tip */}
              <div className="rounded-lg bg-white/50 border border-white p-3 text-xs text-gray-700">
                💡 {coachingTipp(f)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
