'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Clock, MapPin, CheckCircle, Package, ChefHat, Bike,
  Star, AlertTriangle, Zap, Navigation, ThumbsUp, RefreshCw
} from 'lucide-react';

type Phase = 'bestellt' | 'gekocht' | 'verpackt' | 'fahrer' | 'nah' | 'geliefert';
type EtaKonfidenz = 'hoch' | 'mittel' | 'niedrig';

interface TrackingData {
  phase: Phase;
  eta_min: number;
  eta_sek_rest: number; // seconds within current minute
  konfidenz: EtaKonfidenz;
  konfidenz_pct: number;
  fahrer_name: string | null;
  fahrer_distanz_m: number | null;
  kuechenzeit_pct: number; // 0-100 küche progress
  verpackt_pct: number;
  verspätung_min: number; // negative = früher
  wetter_hinweis: string | null;
  stopp_countdown: number | null; // stops before me
  bewertung_abgegeben: boolean;
}

function mockData(): TrackingData {
  return {
    phase: 'fahrer',
    eta_min: 12,
    eta_sek_rest: 34,
    konfidenz: 'hoch',
    konfidenz_pct: 87,
    fahrer_name: 'Maximilian K.',
    fahrer_distanz_m: 1800,
    kuechenzeit_pct: 100,
    verpackt_pct: 100,
    verspätung_min: -1,
    wetter_hinweis: null,
    stopp_countdown: 1,
    bewertung_abgegeben: false,
  };
}

const PHASES: { id: Phase; label: string; icon: React.ElementType }[] = [
  { id: 'bestellt', label: 'Bestellt', icon: CheckCircle },
  { id: 'gekocht', label: 'In Küche', icon: ChefHat },
  { id: 'verpackt', label: 'Verpackt', icon: Package },
  { id: 'fahrer', label: 'Unterwegs', icon: Bike },
  { id: 'nah', label: 'Fast da!', icon: Navigation },
  { id: 'geliefert', label: 'Geliefert', icon: Star },
];

function phaseIndex(p: Phase) {
  return PHASES.findIndex(x => x.id === p);
}

function konfidenzColor(k: EtaKonfidenz) {
  if (k === 'hoch') return 'text-emerald-400';
  if (k === 'mittel') return 'text-amber-400';
  return 'text-orange-400';
}

function konfidenzBg(k: EtaKonfidenz) {
  if (k === 'hoch') return 'bg-emerald-500/10 border-emerald-500/30';
  if (k === 'mittel') return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-orange-500/10 border-orange-500/30';
}

export function StorefrontPhase5537DynamischeEtaLiveTrackingV21({
  orderId,
}: {
  orderId?: string;
}) {
  const [data, setData] = useState<TrackingData>(mockData());
  const [sek, setSek] = useState(0); // seconds elapsed
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/eta-tracking?orderId=${orderId}`);
      if (r.ok) {
        const json = await r.json();
        setData(json);
        setSek(0);
      }
    } catch {
      // mock fallback
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // 30s polling
  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  // 1s countdown tick
  useEffect(() => {
    const id = setInterval(() => setSek(s => s + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const etaRestSek = Math.max(0, (data.eta_min * 60 + data.eta_sek_rest) - sek);
  const etaMin = Math.floor(etaRestSek / 60);
  const etaSek = etaRestSek % 60;
  const currentPhaseIdx = phaseIndex(data.phase);
  const isDelivered = data.phase === 'geliefert';
  const isNah = data.phase === 'nah' || (data.fahrer_distanz_m !== null && data.fahrer_distanz_m < 500);

  function handleRate(stars: number) {
    setRating(stars);
    setRated(true);
  }

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-[#0f0f1a] p-4 space-y-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Live-Tracking V21</h3>
          <p className="text-[10px] text-slate-400">ETA · Präzisions-Countdown · KI-Konfidenz</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="w-3 h-3 text-violet-400 animate-spin" />}
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${konfidenzBg(data.konfidenz)} ${konfidenzColor(data.konfidenz)}`}>
            {data.konfidenz === 'hoch' ? 'Hohe Genauigkeit' : data.konfidenz === 'mittel' ? 'Mittlere Genauigkeit' : 'Niedrige Genauigkeit'}
          </span>
        </div>
      </div>

      {/* ETA Hero */}
      {!isDelivered ? (
        <div className="rounded-xl bg-gradient-to-br from-violet-900/40 to-indigo-900/30 border border-violet-500/20 p-4 text-center">
          <p className="text-[10px] text-slate-400 mb-1">Geschätzte Ankunft in</p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold text-white tabular-nums">{etaMin}</span>
            <span className="text-xl text-slate-300">min</span>
            <span className="text-3xl font-bold text-violet-300 tabular-nums">{String(etaSek).padStart(2, '0')}</span>
            <span className="text-sm text-slate-400">sek</span>
          </div>
          {data.verspätung_min < 0 && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <ThumbsUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">{Math.abs(data.verspätung_min)} min früher als geplant</span>
            </div>
          )}
          {data.verspätung_min > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-400">ca. {data.verspätung_min} min Verzögerung</span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-gradient-to-br from-emerald-900/40 to-green-900/20 border border-emerald-500/30 p-4 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-lg font-bold text-white">Geliefert!</p>
          <p className="text-xs text-emerald-400">Guten Appetit!</p>
          {!rated && (
            <div className="mt-3">
              <p className="text-[10px] text-slate-400 mb-2">Wie war Ihre Lieferung?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    onClick={() => handleRate(s)}
                    className={`text-xl transition-transform hover:scale-110 ${s <= rating ? 'text-amber-400' : 'text-slate-600'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          )}
          {rated && (
            <div className="mt-2 text-emerald-400 text-xs">Danke für Ihre Bewertung! {'★'.repeat(rating)}</div>
          )}
        </div>
      )}

      {/* Fast-da pulse banner */}
      {isNah && !isDelivered && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-300 font-semibold">
            {data.fahrer_distanz_m !== null ? `Fahrer ist nur ${(data.fahrer_distanz_m / 1000).toFixed(1)} km entfernt!` : 'Fahrer ist fast da!'}
          </span>
        </div>
      )}

      {/* Wetter-Hinweis */}
      {data.wetter_hinweis && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-300">{data.wetter_hinweis}</span>
        </div>
      )}

      {/* 6-Phasen-Timeline */}
      <div className="space-y-2">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Bestellstatus</p>
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-white/10" />
          <div className="space-y-2">
            {PHASES.map((phase, idx) => {
              const done = idx < currentPhaseIdx;
              const active = idx === currentPhaseIdx;
              const Icon = phase.icon;
              return (
                <div key={phase.id} className="flex items-center gap-3 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 transition-all
                    ${done ? 'bg-emerald-500 border-emerald-400' :
                    active ? 'bg-violet-600 border-violet-400 animate-pulse' :
                    'bg-slate-800 border-slate-700'}`}>
                    <Icon className={`w-3.5 h-3.5 ${done || active ? 'text-white' : 'text-slate-500'}`} />
                  </div>
                  <div className="flex-1">
                    <span className={`text-xs font-semibold ${done ? 'text-emerald-400' : active ? 'text-white' : 'text-slate-500'}`}>
                      {phase.label}
                    </span>
                    {active && data.phase === 'gekocht' && (
                      <div className="mt-0.5 h-1 rounded bg-white/10">
                        <div className="h-full rounded bg-amber-500 transition-all" style={{ width: `${data.kuechenzeit_pct}%` }} />
                      </div>
                    )}
                    {active && data.phase === 'verpackt' && (
                      <div className="mt-0.5 h-1 rounded bg-white/10">
                        <div className="h-full rounded bg-violet-500 transition-all" style={{ width: `${data.verpackt_pct}%` }} />
                      </div>
                    )}
                  </div>
                  {done && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fahrer-Info + Stopp-Countdown */}
      {data.fahrer_name && !isDelivered && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-violet-400" />
              <div>
                <p className="text-xs font-semibold text-white">{data.fahrer_name}</p>
                <p className="text-[10px] text-slate-400">Ihr Fahrer</p>
              </div>
            </div>
            <div className="text-right">
              {data.fahrer_distanz_m !== null && (
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <MapPin className="w-3 h-3" />
                  <span>{data.fahrer_distanz_m < 1000 ? `${data.fahrer_distanz_m}m` : `${(data.fahrer_distanz_m / 1000).toFixed(1)}km`} entfernt</span>
                </div>
              )}
              {data.stopp_countdown !== null && data.stopp_countdown > 0 && (
                <p className="text-[10px] text-amber-400">{data.stopp_countdown} Stopp{data.stopp_countdown !== 1 ? 's' : ''} vor Ihnen</p>
              )}
              {data.stopp_countdown === 0 && (
                <p className="text-[10px] text-emerald-400">Nächster Stopp: Sie!</p>
              )}
            </div>
          </div>
          {/* Distanz-Annäherungs-Balken */}
          {data.fahrer_distanz_m !== null && (
            <div className="mt-2">
              <div className="h-1.5 rounded bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded bg-gradient-to-r from-violet-500 to-emerald-500 transition-all"
                  style={{ width: `${Math.max(5, 100 - (data.fahrer_distanz_m / 50))}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                <span>Restaurant</span>
                <span>Sie</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KI-Konfidenz-Ring (simple bar) */}
      <div className={`rounded-lg border p-3 ${konfidenzBg(data.konfidenz)}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Zap className={`w-3 h-3 ${konfidenzColor(data.konfidenz)}`} />
            <span className="text-[10px] text-slate-400">KI-ETA-Konfidenz</span>
          </div>
          <span className={`text-xs font-bold ${konfidenzColor(data.konfidenz)}`}>{data.konfidenz_pct}%</span>
        </div>
        <div className="h-1.5 rounded bg-white/10">
          <div
            className={`h-full rounded ${data.konfidenz === 'hoch' ? 'bg-emerald-500' : data.konfidenz === 'mittel' ? 'bg-amber-500' : 'bg-orange-500'}`}
            style={{ width: `${data.konfidenz_pct}%` }}
          />
        </div>
        <p className="text-[9px] text-slate-500 mt-1">Basierend auf Küche, Verkehr und Fahrerstatus</p>
      </div>
    </div>
  );
}
