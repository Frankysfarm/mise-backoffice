'use client';

import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Truck, ChefHat, Package, Navigation2, Zap, AlertTriangle, Star } from 'lucide-react';

type Phase = 'bestellt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface EtaResponse {
  order_id: string;
  phase: Phase;
  eta_min: number;
  eta_max_min: number;
  eta_sek_verbleibend: number;
  konfidenz_pct: number;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  fahrer_eta_min: number | null;
  verzoegerung_min: number;
  verzoegerungs_grund: string | null;
  bewertung_moeglich: boolean;
}

const MOCK: EtaResponse = {
  order_id: 'demo',
  phase: 'unterwegs',
  eta_min: 8,
  eta_max_min: 12,
  eta_sek_verbleibend: 480,
  konfidenz_pct: 85,
  fahrer_name: 'Marco S.',
  fahrer_distanz_km: 1.4,
  fahrer_eta_min: 8,
  verzoegerung_min: 0,
  verzoegerungs_grund: null,
  bewertung_moeglich: false,
};

const PHASES: { key: Phase; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'bestellt', label: 'Bestellt', icon: Package },
  { key: 'in_zubereitung', label: 'Küche', icon: ChefHat },
  { key: 'fertig', label: 'Bereit', icon: CheckCircle2 },
  { key: 'unterwegs', label: 'Unterwegs', icon: Truck },
  { key: 'geliefert', label: 'Geliefert', icon: CheckCircle2 },
];

const PHASE_ORDER: Phase[] = ['bestellt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function phaseIndex(p: Phase) {
  return PHASE_ORDER.indexOf(p);
}

function fmt(sek: number) {
  if (sek <= 0) return '0:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Phase4475DynamischeEtaLiveTrackingV6({ orderId, locationSlug }: { orderId?: string; locationSlug?: string }) {
  const [data, setData] = useState<EtaResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/eta/${orderId}`);
        if (r.ok) {
          const json = await r.json();
          if (json?.phase) setData(json as EtaResponse);
        }
      } catch { /* Mock-Fallback */ }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [orderId]);

  const sekLeft = Math.max(0, data.eta_sek_verbleibend - tick);
  const totalSek = data.eta_min * 60;
  const progPct = totalSek > 0 ? Math.min(100, ((totalSek - sekLeft) / totalSek) * 100) : 0;
  const phaseIdx = phaseIndex(data.phase);
  const isGeliefert = data.phase === 'geliefert';

  const etaColor = data.verzoegerung_min > 5 ? 'text-red-400' : data.verzoegerung_min > 0 ? 'text-yellow-400' : 'text-green-400';
  const konfColor = data.konfidenz_pct >= 80 ? 'text-green-400' : data.konfidenz_pct >= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-300">Live-Tracking V6</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] ${konfColor}`}>Konfidenz {data.konfidenz_pct}%</span>
        </div>
      </div>

      {/* Verzögerung */}
      {data.verzoegerung_min > 0 && (
        <div className="flex items-center gap-1.5 rounded bg-yellow-900/25 border border-yellow-700/35 px-2 py-1">
          <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
          <span className="text-xs text-yellow-300">
            +{data.verzoegerung_min} min Verzögerung{data.verzoegerungs_grund ? ` — ${data.verzoegerungs_grund}` : ''}
          </span>
        </div>
      )}

      {/* ETA Countdown */}
      {!isGeliefert ? (
        <div className="text-center py-2">
          <div className={`text-4xl font-mono font-bold tabular-nums ${etaColor}`}>{fmt(sekLeft)}</div>
          <div className="text-xs text-slate-400 mt-1">
            ETA {data.eta_min}–{data.eta_max_min} min
          </div>
          <div className="mt-2 mx-auto w-full h-2 rounded bg-slate-700/50">
            <div
              className={`h-2 rounded transition-all ${data.verzoegerung_min > 0 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${progPct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-3">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-1" />
          <div className="text-sm font-semibold text-green-300">Zugestellt!</div>
        </div>
      )}

      {/* Phase-Timeline */}
      <div className="flex items-center gap-0.5">
        {PHASES.map((ph, i) => {
          const done = i < phaseIdx;
          const current = i === phaseIdx;
          const Icon = ph.icon;
          return (
            <React.Fragment key={ph.key}>
              <div className="flex flex-col items-center flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                  done ? 'border-green-500 bg-green-900/40' :
                  current ? 'border-blue-400 bg-blue-900/40 ring-1 ring-blue-400/40' :
                  'border-slate-600 bg-slate-800/30'
                }`}>
                  <Icon className={`w-3 h-3 ${done ? 'text-green-400' : current ? 'text-blue-400' : 'text-slate-600'}`} />
                </div>
                <span className={`text-[8px] mt-0.5 ${current ? 'text-blue-300 font-medium' : done ? 'text-green-400' : 'text-slate-600'}`}>
                  {ph.label}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <div className={`h-px flex-1 mb-3 ${i < phaseIdx ? 'bg-green-600' : 'bg-slate-700'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Fahrer Info */}
      {data.fahrer_name && data.phase === 'unterwegs' && (
        <div className="rounded-lg border border-blue-700/30 bg-blue-950/15 p-2">
          <div className="flex items-center gap-2">
            <Navigation2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-slate-200">{data.fahrer_name}</span>
            {data.fahrer_distanz_km && (
              <span className="text-[10px] text-slate-500 ml-auto">
                <MapPin className="w-2.5 h-2.5 inline mr-0.5" />{data.fahrer_distanz_km.toFixed(1)} km entfernt
              </span>
            )}
          </div>
          {data.fahrer_eta_min && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] text-slate-400">Fahrer-ETA: {data.fahrer_eta_min} min</span>
            </div>
          )}
          {/* Proximity pulsebar */}
          {data.fahrer_distanz_km && (
            <div className="mt-1.5 w-full h-1 rounded bg-slate-700/50">
              <div
                className="h-1 rounded bg-blue-400 transition-all"
                style={{ width: `${Math.min(100, Math.max(5, 100 - (data.fahrer_distanz_km / 5) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Bewertung nach Zustellung */}
      {isGeliefert && (
        <div className="text-center space-y-1">
          <div className="text-xs text-slate-400">Wie war deine Lieferung?</div>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setRating(n)}>
                <Star className={`w-5 h-5 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`} />
              </button>
            ))}
          </div>
          {rating > 0 && <div className="text-[10px] text-green-400">Danke für dein Feedback!</div>}
        </div>
      )}
    </div>
  );
}

