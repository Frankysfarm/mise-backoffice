'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Bike, Package, Star, Navigation2, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Phase {
  id: string;
  label: string;
  icon: string;
  done: boolean;
  aktiv: boolean;
  eta_label: string | null;
  konfidenz_pct?: number | null;
}

interface ApiResponse {
  order_id: string;
  status: string;
  eta_min_low: number;
  eta_min_high: number;
  eta_label: string;
  konfidenz_pct: number;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  phasen: Phase[];
  bewertung_prompt: boolean;
  delivered_at: string | null;
  live_update_secs: number;
}

const MOCK: ApiResponse = {
  order_id: 'mock-001',
  status: 'unterwegs',
  eta_min_low: 8,
  eta_min_high: 14,
  eta_label: '8–14 Min',
  konfidenz_pct: 85,
  fahrer_name: 'Kai B.',
  fahrer_distanz_km: 1.4,
  bewertung_prompt: false,
  delivered_at: null,
  live_update_secs: 20,
  phasen: [
    { id: 'bestaetigt', label: 'Bestätigt',      icon: '✅', done: true,  aktiv: false, eta_label: null,    konfidenz_pct: 100 },
    { id: 'kueche',     label: 'In Zubereitung', icon: '👨‍🍳', done: true,  aktiv: false, eta_label: null,    konfidenz_pct: 100 },
    { id: 'fertig',     label: 'Abholbereit',    icon: '📦', done: true,  aktiv: false, eta_label: null,    konfidenz_pct: 100 },
    { id: 'unterwegs',  label: 'Unterwegs',      icon: '🚲', done: false, aktiv: true,  eta_label: '~11 Min', konfidenz_pct: 85 },
    { id: 'geliefert',  label: 'Geliefert',      icon: '🎉', done: false, aktiv: false, eta_label: null,    konfidenz_pct: null },
  ],
};

function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  return now;
}

function EtaRing({ low, high, konfidenz }: { low: number; high: number; konfidenz: number }) {
  const mid = Math.round((low + high) / 2);
  const r = 42;
  const circ = 2 * Math.PI * r;
  const filled = (konfidenz / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 108, height: 108 }}>
      <svg width={108} height={108} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={54} cy={54} r={r} fill="none" stroke="#1e3a5f" strokeWidth={8} />
        <circle cx={54} cy={54} r={r} fill="none" stroke="#3b82f6" strokeWidth={8}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-blue-300 leading-none">{mid}</span>
        <span className="text-[10px] text-slate-400">Min</span>
        <span className="text-[9px] text-slate-500">{konfidenz}%</span>
      </div>
    </div>
  );
}

function KonfidenzBar({ pct }: { pct: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
        <span>ETA-Konfidenz</span><span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-700/50">
        <div className={cn('h-1.5 rounded-full transition-all',
          pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400')}
             style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Phase5142DynamischeEtaLiveTrackingV6({ orderId }: { orderId: string | null }) {
  const now = useNow();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const nextFetch = useRef<number>(Date.now());

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!orderId) { setData(MOCK); setLoading(false); return; }
        const res = await fetch(`/api/delivery/eta?order_id=${orderId}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json() as ApiResponse;
        if (active) {
          setData(json);
          setLoading(false);
          nextFetch.current = Date.now() + (json.live_update_secs ?? 20) * 1000;
        }
      } catch {
        if (active) { setData(MOCK); setLoading(false); nextFetch.current = Date.now() + 20_000; }
      }
    }
    load();
    const iv = setInterval(load, 20_000);
    return () => { active = false; clearInterval(iv); };
  }, [orderId]);

  useEffect(() => {
    const remaining = Math.max(0, Math.ceil((nextFetch.current - now) / 1000));
    setCountdown(remaining);
  }, [now]);

  if (loading) return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-400 text-sm">
      Lade Tracking…
    </div>
  );
  if (!data) return null;

  if (data.status === 'geliefert' || data.delivered_at) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-4xl mb-2">🎉</div>
        <div className="text-lg font-bold text-emerald-700 mb-1">Geliefert!</div>
        <div className="text-sm text-emerald-600 mb-4">Deine Bestellung ist angekommen.</div>
        {data.bewertung_prompt && (
          <button className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-5 py-2 rounded-full font-medium transition-colors flex items-center gap-2 mx-auto">
            <Star className="w-4 h-4" /> Jetzt bewerten
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-[#1a1a2e] text-white px-4 py-3 flex items-center gap-3">
        <Activity className="w-4 h-4 text-blue-300" />
        <span className="text-sm font-semibold">Live ETA-Tracking V6</span>
        <span className="ml-auto text-[10px] text-slate-400">Update in {countdown ?? '…'}s</span>
      </div>

      {/* ETA Ring + Info */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
        <EtaRing low={data.eta_min_low} high={data.eta_min_high} konfidenz={data.konfidenz_pct} />
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <div className="text-lg font-bold text-slate-900">{data.eta_label}</div>
            <div className="text-sm text-slate-500">Geschätzte Restzeit</div>
          </div>
          {data.fahrer_name && (
            <div className="flex items-center gap-1.5 text-sm text-slate-700">
              <Bike className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-medium">{data.fahrer_name}</span>
              {data.fahrer_distanz_km != null && (
                <span className="text-slate-400 text-xs">· {data.fahrer_distanz_km}km</span>
              )}
            </div>
          )}
          {data.fahrer_distanz_km != null && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Navigation2 className="w-3 h-3 text-slate-400" />
              <span>Noch {data.fahrer_distanz_km}km entfernt</span>
            </div>
          )}
          <KonfidenzBar pct={data.konfidenz_pct} />
        </div>
      </div>

      {/* ETA Bereich */}
      <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-blue-700 font-medium">ETA-Bereich</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-600">Frühestens {data.eta_min_low} Min</span>
            <div className="h-3 w-px bg-blue-300" />
            <span className="text-xs text-blue-600">Spätestens {data.eta_min_high} Min</span>
          </div>
        </div>
        <div className="mt-2 h-2 rounded-full bg-blue-100 relative">
          <div className="absolute inset-y-0 rounded-full bg-blue-400 opacity-30"
               style={{ left: `${(data.eta_min_low / 30) * 100}%`, right: `${100 - (data.eta_min_high / 30) * 100}%` }} />
          <div className="absolute inset-y-0 w-1 rounded-full bg-blue-500"
               style={{ left: `${(((data.eta_min_low + data.eta_min_high) / 2) / 30) * 100}%` }} />
        </div>
      </div>

      {/* Phasen-Timeline */}
      <div className="px-5 py-4 space-y-0">
        {data.phasen.map((phase, i) => (
          <div key={phase.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 transition-all',
                phase.done ? 'border-emerald-400 bg-emerald-50' :
                  phase.aktiv ? 'border-blue-400 bg-blue-50' :
                    'border-slate-200 bg-white'
              )}>
                {phase.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                  phase.aktiv ? <Zap className="w-4 h-4 text-blue-500 animate-pulse" /> :
                    <span className="text-slate-300 text-xs">{phase.icon}</span>}
              </div>
              {i < data.phasen.length - 1 && (
                <div className={cn('w-0.5 h-6 mt-0.5', phase.done ? 'bg-emerald-300' : 'bg-slate-200')} />
              )}
            </div>
            <div className="flex-1 pb-4 min-w-0">
              <div className="flex items-center justify-between">
                <span className={cn('text-sm font-medium',
                  phase.done ? 'text-emerald-700' : phase.aktiv ? 'text-blue-700' : 'text-slate-400')}>
                  {phase.label}
                </span>
                <div className="flex items-center gap-1">
                  {phase.eta_label && (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full',
                      phase.aktiv ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500')}>
                      {phase.eta_label}
                    </span>
                  )}
                  {phase.konfidenz_pct != null && phase.aktiv && (
                    <span className="text-[10px] text-slate-400">{phase.konfidenz_pct}%</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
