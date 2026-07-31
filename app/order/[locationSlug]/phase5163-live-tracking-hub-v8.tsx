'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Bike, Package, Star, Navigation2, Activity, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 5163 — Live-Tracking-Hub V8 (Storefront)
// Phasen-Timeline mit animiertem aktiv-Indikator;
// ETA-Konfidenz-Ring (Dual-Arc: ETA-Fenster + Konfidenz-Fill);
// Fahrer-Distanz-Balken mit Animations-Dot;
// Dynamische ETA mit Live-Update-Countdown;
// Bewertungs-Prompt nach Lieferung;
// 20-Sek-Polling; Mock-Fallback

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
  fahrer_distanz_pct: number | null;
  phasen: Phase[];
  bewertung_prompt: boolean;
  delivered_at: string | null;
  live_update_secs: number;
}

const MOCK: ApiResponse = {
  order_id: 'mock-v8',
  status: 'unterwegs',
  eta_min_low: 7,
  eta_min_high: 12,
  eta_label: '7–12 Min',
  konfidenz_pct: 88,
  fahrer_name: 'Kai B.',
  fahrer_distanz_km: 1.1,
  fahrer_distanz_pct: 68,
  bewertung_prompt: false,
  delivered_at: null,
  live_update_secs: 20,
  phasen: [
    { id: 'bestaetigt', label: 'Bestätigt',      icon: '✅', done: true,  aktiv: false, eta_label: null,    konfidenz_pct: 100 },
    { id: 'kueche',     label: 'Zubereitung',    icon: '👨‍🍳', done: true,  aktiv: false, eta_label: null,    konfidenz_pct: 100 },
    { id: 'fertig',     label: 'Abholbereit',    icon: '📦', done: true,  aktiv: false, eta_label: null,    konfidenz_pct: 100 },
    { id: 'unterwegs',  label: 'Unterwegs',      icon: '🚲', done: false, aktiv: true,  eta_label: '~9 Min', konfidenz_pct: 88 },
    { id: 'geliefert',  label: 'Geliefert',      icon: '🎉', done: false, aktiv: false, eta_label: null,    konfidenz_pct: null },
  ],
};

function useCountdown(pollSecs: number): number {
  const [rem, setRem] = useState(pollSecs);
  useEffect(() => {
    setRem(pollSecs);
    const iv = setInterval(() => setRem(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(iv);
  }, [pollSecs]);
  return rem;
}

function EtaConfidenceRing({ low, high, konfidenz }: { low: number; high: number; konfidenz: number }) {
  const mid = Math.round((low + high) / 2);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const konfPct = konfidenz / 100;
  const konfColor = konfidenz >= 80 ? '#10b981' : konfidenz >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
        {/* Track */}
        <circle cx="40" cy="40" r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
        {/* ETA window arc (full) */}
        <circle cx="40" cy="40" r={r} fill="none" stroke="#334155" strokeWidth="6"
          strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={`${circ * 0.125}`}
          strokeLinecap="round"
        />
        {/* Confidence fill */}
        <circle cx="40" cy="40" r={r} fill="none" stroke={konfColor} strokeWidth="6"
          strokeDasharray={`${circ * 0.75 * konfPct} ${circ}`} strokeDashoffset={`${circ * 0.125}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white">{mid}</span>
        <span className="text-[10px] text-gray-400">Min</span>
      </div>
    </div>
  );
}

export function Phase5163LiveTrackingHubV8({ orderId }: { orderId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [useMock, setUseMock] = useState(false);
  const [pollSecs, setPollSecs] = useState(20);
  const countdown = useCountdown(pollSecs);
  const [showBewertung, setShowBewertung] = useState(false);

  async function load() {
    if (!orderId) { setUseMock(true); return; }
    try {
      const res = await fetch(`/api/delivery/public/tracking-status?order_id=${orderId}`);
      if (!res.ok) { setUseMock(true); return; }
      const d: ApiResponse = await res.json();
      setData(d);
      setPollSecs(d.live_update_secs ?? 20);
      setUseMock(false);
      if (d.bewertung_prompt) setShowBewertung(true);
    } catch { setUseMock(true); }
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (countdown === 0) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const delivered = data.status === 'geliefert' || data.delivered_at != null;

  if (delivered && !showBewertung) {
    return (
      <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/30 px-6 py-8 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <div className="text-lg font-bold text-white mb-1">Bestellung geliefert!</div>
        <div className="text-sm text-gray-400 mb-4">Guten Appetit!</div>
        <button
          onClick={() => setShowBewertung(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
        >
          Bewertung abgeben <Star className="w-3.5 h-3.5 inline ml-1" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-700/30 bg-indigo-950/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-indigo-700/20 flex items-center justify-between bg-indigo-900/20">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-200">Live-Tracking</span>
          {useMock && <span className="text-[10px] text-gray-500 bg-slate-800 px-1.5 rounded">Demo</span>}
        </div>
        <div className="text-[10px] text-gray-500">Update in {countdown}s</div>
      </div>

      {/* ETA Ring + Fahrer */}
      <div className="px-4 py-5 flex items-center gap-5 border-b border-indigo-700/20">
        <EtaConfidenceRing low={data.eta_min_low} high={data.eta_min_high} konfidenz={data.konfidenz_pct} />
        <div className="flex-1 space-y-2">
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Ankunft in ca.</div>
            <div className="text-xl font-bold text-white">{data.eta_label}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', data.konfidenz_pct >= 80 ? 'bg-emerald-400' : data.konfidenz_pct >= 60 ? 'bg-amber-400' : 'bg-red-400')} />
            <span className="text-[10px] text-gray-400">Konfidenz {data.konfidenz_pct}%</span>
          </div>
          {data.fahrer_name && (
            <div className="flex items-center gap-1.5 text-xs text-gray-300">
              <Bike className="w-3.5 h-3.5 text-blue-400" />{data.fahrer_name}
              {data.fahrer_distanz_km != null && <span className="text-gray-500">· {data.fahrer_distanz_km.toFixed(1)} km weg</span>}
            </div>
          )}
        </div>
      </div>

      {/* Fahrer-Distanz-Balken */}
      {data.fahrer_distanz_pct != null && (
        <div className="px-4 py-2 border-b border-indigo-700/20">
          <div className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1">
            <Navigation2 className="w-3 h-3 text-blue-400" />Fahrer auf dem Weg
          </div>
          <div className="relative h-2 rounded-full bg-slate-700/50 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-1000" style={{ width: `${data.fahrer_distanz_pct}%` }} />
            <div className="absolute top-0 h-2 w-2 bg-blue-300 rounded-full -translate-y-0 shadow-[0_0_8px_2px_rgba(59,130,246,0.6)]" style={{ left: `calc(${data.fahrer_distanz_pct}% - 4px)` }} />
          </div>
          <div className="flex items-center justify-between mt-1 text-[9px] text-gray-600">
            <span>Restaurant</span>
            <span>Du</span>
          </div>
        </div>
      )}

      {/* Phasen Timeline */}
      <div className="px-4 py-4">
        <div className="space-y-3">
          {data.phasen.map((p, i) => {
            const isLast = i === data.phasen.length - 1;
            return (
              <div key={p.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0',
                    p.done ? 'bg-emerald-500/20 text-emerald-400' : p.aktiv ? 'bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/50 ring-offset-1 ring-offset-slate-950' : 'bg-slate-700/50 text-gray-600')}>
                    {p.done ? '✓' : p.icon}
                  </div>
                  {!isLast && <div className={cn('w-0.5 mt-1 flex-1', p.done ? 'bg-emerald-500/30 h-5' : 'bg-slate-700/30 h-5')} />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-sm font-medium', p.done ? 'text-emerald-300' : p.aktiv ? 'text-white' : 'text-gray-500')}>
                      {p.label}
                    </span>
                    {p.aktiv && p.eta_label && (
                      <span className="flex items-center gap-1 text-xs text-blue-400">
                        <Clock className="w-3 h-3" />{p.eta_label}
                      </span>
                    )}
                    {p.done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  {p.aktiv && <span className="text-[10px] text-blue-400 animate-pulse">● Aktuell</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bewertungs-Prompt */}
      {showBewertung && (
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-3">
            <div className="text-xs font-semibold text-amber-200 mb-2 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-400" />Wie war deine Bestellung?
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} className="flex-1 text-2xl hover:scale-110 transition-transform" onClick={() => setShowBewertung(false)}>
                  {n <= 3 ? '⭐' : '⭐'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
