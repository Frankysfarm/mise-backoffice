'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Clock, Star, CheckCircle2, ChefHat, Bike, Package, Navigation, MessageCircle, Users, Zap, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 5530 — Dynamische ETA Live-Tracking V19
// V18+: Community-Lieferzeit-Vergleich (Wie schnell ist das Gebiet heute? Ampel grün/gelb/rot);
// Restaurant-Qualitäts-Badge (Heutige Schicht-Bewertung ★ live);
// Fahrer-Energie-Anzeige (Schichtdauer-basierter Fitness-Indikator);
// Bestellhistorie-Schnellhinweis (letztes Gericht + Nachbestellungs-CTA);
// Echtzeit-Fahrer-Nähe-Animation (Puls-Wellen SVG 3-Zonen);
// 1s-Tick + 20s-Polling; Mock-Fallback

type Phase = 'bestellt' | 'zubereitung' | 'unterwegs' | 'geliefert';
type GeofenceZone = 'fern' | 'nah_500' | 'nah_200' | 'nah_50';
type CommunitySpeed = 'schnell' | 'normal' | 'langsam';

interface TrackingState {
  phase: Phase;
  eta_min: number;
  eta_min_low: number;
  eta_min_high: number;
  confidence: number;
  driver_name: string | null;
  driver_distance_m: number | null;
  driver_schicht_h: number;
  restaurant_rating_heute: number;
  community_avg_min: number;
  community_speed: CommunitySpeed;
  last_order_name: string | null;
  last_order_date: string | null;
  warmup_min: number | null;
}

const MOCK: TrackingState = {
  phase: 'unterwegs',
  eta_min: 8,
  eta_min_low: 6,
  eta_min_high: 11,
  confidence: 91,
  driver_name: 'Marco S.',
  driver_distance_m: 650,
  driver_schicht_h: 2.5,
  restaurant_rating_heute: 4.8,
  community_avg_min: 24,
  community_speed: 'schnell',
  last_order_name: 'Burger Deluxe + Pommes',
  last_order_date: '15.07.',
  warmup_min: 1,
};

const PHASE_CONFIG: Record<Phase, { label: string; step: number }> = {
  bestellt:    { label: 'Bestellt',    step: 1 },
  zubereitung: { label: 'Zubereitung', step: 2 },
  unterwegs:   { label: 'Unterwegs',   step: 3 },
  geliefert:   { label: 'Geliefert',   step: 4 },
};

const COMMUNITY_CONFIG: Record<CommunitySpeed, { label: string; color: string; ring: string }> = {
  schnell:  { label: 'Schnell heute!', color: 'text-emerald-400', ring: '#22c55e' },
  normal:   { label: 'Normales Tempo', color: 'text-yellow-400',  ring: '#eab308' },
  langsam:  { label: 'Etwas langsamer', color: 'text-red-400',   ring: '#ef4444' },
};

function getGeofence(dist: number | null): GeofenceZone {
  if (dist === null) return 'fern';
  if (dist <= 50)  return 'nah_50';
  if (dist <= 200) return 'nah_200';
  if (dist <= 500) return 'nah_500';
  return 'fern';
}

function energieLabel(h: number): { label: string; color: string } {
  if (h < 3) return { label: 'Frisch', color: 'text-emerald-400' };
  if (h < 5.5) return { label: 'Fit', color: 'text-yellow-400' };
  return { label: 'Erfahren', color: 'text-blue-400' };
}

function PulseRing({ zone }: { zone: GeofenceZone }) {
  const active = zone !== 'fern';
  const veryClose = zone === 'nah_50' || zone === 'nah_200';
  return (
    <svg width="80" height="80" className="mx-auto">
      {/* Outer ring */}
      <circle cx="40" cy="40" r="36" fill="none" stroke={zone === 'nah_500' || veryClose ? '#3b82f6' : '#27272a'} strokeWidth="1.5"
        className={veryClose ? 'animate-ping' : ''} opacity="0.4" />
      {/* Mid ring */}
      <circle cx="40" cy="40" r="26" fill="none" stroke={veryClose ? '#3b82f6' : '#27272a'} strokeWidth="1.5"
        className={zone === 'nah_200' || zone === 'nah_50' ? 'animate-ping' : ''} opacity="0.6" />
      {/* Inner ring */}
      <circle cx="40" cy="40" r="16" fill="none" stroke={zone === 'nah_50' ? '#3b82f6' : '#27272a'} strokeWidth="1.5"
        className={zone === 'nah_50' ? 'animate-ping' : ''} opacity="0.8" />
      {/* Center dot */}
      <circle cx="40" cy="40" r="7" fill={active ? '#3b82f6' : '#3f3f46'} />
      <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fontSize="8" fill="white">🚴</text>
    </svg>
  );
}

interface Props {
  orderId: string;
  locationSlug?: string;
  initialStatus?: string;
  initialEta?: number | null;
  className?: string;
}

export function StorefrontPhase5530DynamischeEtaLiveTrackingV19({ orderId, locationSlug, initialStatus, initialEta, className }: Props) {
  const [state, setState] = useState<TrackingState>({ ...MOCK, eta_min: initialEta ?? MOCK.eta_min, phase: (initialStatus as Phase) ?? MOCK.phase });
  const [tick, setTick] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const r = await fetch(`/api/delivery/customer/tracking?orderId=${orderId}`);
      if (r.ok) { const d = await r.json(); if (d?.phase) setState(prev => ({ ...prev, ...d })); }
    } catch { /* mock */ }
  }, [orderId]);

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [load]);

  const liveEta = Math.max(0, state.eta_min * 60 - tick);
  const liveEtaMin = Math.floor(liveEta / 60);
  const liveEtaSec = liveEta % 60;
  const currentStep = PHASE_CONFIG[state.phase].step;
  const zone = getGeofence(state.driver_distance_m);
  const community = COMMUNITY_CONFIG[state.community_speed];
  const energie = energieLabel(state.driver_schicht_h);

  return (
    <div className={cn('bg-white rounded-2xl shadow-md overflow-hidden font-sans', className)}>
      {/* Phase Timeline */}
      <div className="bg-matcha-900 px-4 py-3">
        <div className="flex items-center justify-between">
          {(['bestellt', 'zubereitung', 'unterwegs', 'geliefert'] as Phase[]).map((p, i) => (
            <div key={p} className="flex items-center">
              <div className={cn('flex flex-col items-center gap-1',)}>
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                  currentStep > i + 1 ? 'bg-emerald-500 text-white' :
                  currentStep === i + 1 ? 'bg-blue-500 text-white animate-pulse' :
                  'bg-zinc-700 text-zinc-400')}>
                  {currentStep > i + 1 ? '✓' : i + 1}
                </div>
                <span className="text-[8px] text-zinc-400 text-center leading-tight">{PHASE_CONFIG[p].label}</span>
              </div>
              {i < 3 && <div className={cn('h-0.5 w-8 sm:w-12 mx-1', currentStep > i + 1 ? 'bg-emerald-500' : 'bg-zinc-700')} />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* ETA Countdown */}
        {state.phase !== 'geliefert' && (
          <div className="text-center">
            <div className="text-4xl font-bold text-matcha-900 tabular-nums">
              {liveEtaMin}<span className="text-2xl text-matcha-500">:{String(liveEtaSec).padStart(2, '0')}</span>
            </div>
            <div className="text-sm text-matcha-500 mt-1">
              ETA {state.eta_min_low}–{state.eta_min_high} min · Konfidenz {state.confidence}%
            </div>
            {state.warmup_min !== null && (
              <div className="text-xs text-orange-600 mt-0.5">🌡️ Noch {state.warmup_min} min optimal warm</div>
            )}
          </div>
        )}

        {state.phase === 'geliefert' && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
            <div className="text-lg font-bold text-matcha-900">Geliefert! 🎉</div>
          </div>
        )}

        {/* Fahrer + Puls */}
        {state.phase === 'unterwegs' && state.driver_name && (
          <div className="flex items-center gap-4 bg-matcha-50 rounded-xl p-3">
            <PulseRing zone={zone} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-matcha-900">{state.driver_name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('text-xs font-medium', energie.color)}>{energie.label}</span>
                {state.driver_distance_m !== null && (
                  <span className="text-xs text-matcha-500">· {state.driver_distance_m}m entfernt</span>
                )}
              </div>
              {zone !== 'fern' && (
                <div className="text-[10px] text-blue-600 mt-0.5 font-medium animate-pulse">
                  {zone === 'nah_50' ? '🟢 Fast da!' : zone === 'nah_200' ? '🔵 Fast da!' : '🔵 In der Nähe'}
                </div>
              )}
              <button onClick={() => setChatOpen(!chatOpen)}
                className="mt-1 flex items-center gap-1 text-[10px] text-matcha-400 hover:text-matcha-600 transition-colors">
                <MessageCircle className="h-3 w-3" /><span>Fahrer kontaktieren</span>
              </button>
            </div>
          </div>
        )}

        {chatOpen && (
          <div className="bg-matcha-50 rounded-xl p-3 border border-matcha-100">
            <div className="text-xs text-matcha-600 text-center">Chat noch nicht verfügbar — rufe an</div>
          </div>
        )}

        {/* Community-Vergleich + Restaurant-Bewertung */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-matcha-50 rounded-xl p-2.5 text-center">
            <div className={cn('text-sm font-bold', community.color)}>{community.label}</div>
            <div className="text-[10px] text-matcha-400 mt-0.5">Ø {state.community_avg_min} min heute</div>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <Users className="h-3 w-3 text-matcha-400" />
              <span className="text-[10px] text-matcha-400">Gebiet</span>
            </div>
          </div>
          <div className="bg-matcha-50 rounded-xl p-2.5 text-center">
            <div className="text-sm font-bold text-yellow-500">★ {state.restaurant_rating_heute}</div>
            <div className="text-[10px] text-matcha-400 mt-0.5">Bewertung heute</div>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <ChefHat className="h-3 w-3 text-matcha-400" />
              <span className="text-[10px] text-matcha-400">Restaurant</span>
            </div>
          </div>
        </div>

        {/* Letzte Bestellung */}
        {state.last_order_name && (
          <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-2.5 border border-amber-100">
            <Zap className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-amber-600">Letzte Bestellung ({state.last_order_date})</div>
              <div className="text-xs font-medium text-amber-900 truncate">{state.last_order_name}</div>
            </div>
            <button className="text-[10px] font-semibold text-amber-600 bg-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
              Nochmal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
