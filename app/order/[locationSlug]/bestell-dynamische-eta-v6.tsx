'use client';

import { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, AlertTriangle, Zap, Star, Navigation2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderPhase = 'bestaetigt' | 'zubereitung' | 'abholung' | 'unterwegs' | 'geliefert';
type ETAConfidence = 'hoch' | 'mittel' | 'gering';

interface TrackingData {
  order_id: string;
  order_number: string;
  phase: OrderPhase;
  eta_min: number | null;
  eta_sek: number | null;
  eta_confidence: ETAConfidence;
  eta_updated_ago_sek: number;
  fahrer_name: string | null;
  fahrer_bewertung: number | null;
  fahrer_distanz_km: number | null;
  ziel_adresse: string;
  verzoegerung_min: number | null;
  kuechen_auslastung: 'normal' | 'hoch' | 'kritisch';
  navi_live_url: string | null;
}

const MOCK: TrackingData = {
  order_id: 'demo',
  order_number: '#1102',
  phase: 'unterwegs',
  eta_min: 8,
  eta_sek: 470,
  eta_confidence: 'hoch',
  eta_updated_ago_sek: 22,
  fahrer_name: 'Marco M.',
  fahrer_bewertung: 4.9,
  fahrer_distanz_km: 1.3,
  ziel_adresse: 'Pontstraße 42, 52062 Aachen',
  verzoegerung_min: null,
  kuechen_auslastung: 'normal',
  navi_live_url: null,
};

const PHASES: { id: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { id:'bestaetigt',  label:'Bestätigt',   icon:<CheckCircle2 className="w-4 h-4" /> },
  { id:'zubereitung', label:'Zubereitung', icon:<ChefHat className="w-4 h-4" /> },
  { id:'abholung',    label:'Abholung',    icon:<Bike className="w-4 h-4" /> },
  { id:'unterwegs',   label:'Unterwegs',   icon:<Navigation2 className="w-4 h-4" /> },
  { id:'geliefert',   label:'Geliefert',   icon:<CheckCircle2 className="w-4 h-4" /> },
];

const PHASE_IDX: Record<OrderPhase, number> = {
  bestaetigt:0, zubereitung:1, abholung:2, unterwegs:3, geliefert:4,
};

const CONFIDENCE_COLORS: Record<ETAConfidence, string> = {
  hoch:   'text-emerald-400',
  mittel: 'text-amber-400',
  gering: 'text-red-400',
};

function useCountdown(etaSek: number | null) {
  const [rem, setRem] = useState(etaSek ?? 0);
  useEffect(() => {
    if (etaSek == null) return;
    setRem(etaSek);
    const iv = setInterval(() => setRem(r => Math.max(0, r - 1)), 1_000);
    return () => clearInterval(iv);
  }, [etaSek]);
  return rem;
}

function fmtRemaining(sec: number) {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

interface Props {
  orderId?: string | null;
  locationId?: string | null;
}

export function BestellDynamischeEtaV6({ orderId, locationId }: Props) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const remaining = useCountdown(data.eta_sek);

  useEffect(() => {
    if (!orderId && !locationId) { setData(MOCK); return; }
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/tracking/${orderId ?? 'demo'}`);
        if (res.ok) {
          const json = await res.json();
          if (active && json) { setData(json); setLastUpdate(Date.now()); }
        } else {
          if (active) setData(MOCK);
        }
      } catch {
        if (active) setData(MOCK);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => { active = false; clearInterval(iv); };
  }, [orderId, locationId]);

  const phaseIdx = PHASE_IDX[data.phase];
  const isUnterwegs = data.phase === 'unterwegs';
  const isGeliefert = data.phase === 'geliefert';
  const hasDelay = (data.verzoegerung_min ?? 0) > 0;

  const etaMinDisplay = data.eta_min != null ? (data.eta_min <= 1 ? '< 1' : data.eta_min) : '—';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden max-w-sm mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 px-4 py-3 flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-slate-400">Bestellung</span>
          <span className="text-sm font-bold text-white">{data.order_number}</span>
        </div>
        <div className="flex-1" />
        {loading && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
        <div className="text-right">
          <div className="text-xs text-slate-400">Zuletzt</div>
          <div className="text-xs text-slate-300">{data.eta_updated_ago_sek}s ago</div>
        </div>
      </div>

      {/* Phase-Stepper */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-0">
          {PHASES.map((p, i) => {
            const done  = i < phaseIdx;
            const aktiv = i === phaseIdx;
            const future = i > phaseIdx;
            return (
              <div key={p.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center transition-all',
                    done  ? 'bg-emerald-500 text-white' :
                    aktiv ? 'bg-blue-500 text-white ring-2 ring-blue-300 dark:ring-blue-500/50' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-400')}>
                    {p.icon}
                  </div>
                  <span className={cn('text-[9px] text-center leading-tight whitespace-nowrap',
                    aktiv ? 'text-blue-500 dark:text-blue-400 font-medium' :
                    done  ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400')}>
                    {p.label}
                  </span>
                </div>
                {i < PHASES.length - 1 && (
                  <div className={cn('flex-1 h-0.5 mb-4 mx-0.5 transition-all',
                    i < phaseIdx ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ETA Hero */}
      {!isGeliefert && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4">
          {/* Countdown */}
          {data.eta_sek != null && (
            <div className="flex flex-col items-center">
              <span className={cn('text-3xl font-mono font-bold tabular-nums',
                remaining <= 60 ? 'text-red-500' : remaining <= 180 ? 'text-amber-500' : 'text-blue-500')}>
                {fmtRemaining(remaining)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Countdown</span>
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {etaMinDisplay} min
              </span>
              <span className={cn('text-xs font-medium', CONFIDENCE_COLORS[data.eta_confidence])}>
                ({data.eta_confidence})
              </span>
            </div>

            {hasDelay && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                +{data.verzoegerung_min} min Verzögerung
              </div>
            )}

            {data.kuechen_auslastung !== 'normal' && (
              <div className={cn('flex items-center gap-1.5 mt-1 text-xs',
                data.kuechen_auslastung === 'kritisch' ? 'text-red-500' : 'text-amber-500')}>
                <Zap className="w-3.5 h-3.5" />
                Küche {data.kuechen_auslastung}
              </div>
            )}
          </div>
        </div>
      )}

      {isGeliefert && (
        <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Zugestellt! Guten Appetit 🍽️</p>
        </div>
      )}

      {/* Fahrer-Info */}
      {isUnterwegs && data.fahrer_name && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {data.fahrer_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{data.fahrer_name}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {data.fahrer_bewertung && (
                  <span className="flex items-center gap-0.5 text-amber-500">
                    <Star className="w-3 h-3" />{data.fahrer_bewertung}
                  </span>
                )}
                {data.fahrer_distanz_km && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" />{data.fahrer_distanz_km}km entfernt
                  </span>
                )}
              </div>
            </div>
            {data.navi_live_url && (
              <a href={data.navi_live_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors">
                <Navigation2 className="w-3.5 h-3.5" />Live
              </a>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />{data.ziel_adresse}
          </p>
        </div>
      )}
    </div>
  );
}
