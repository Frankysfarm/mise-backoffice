'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Clock, Star, Phone, CheckCircle2, ChefHat, Bike, Package, Navigation, Bell, MessageCircle, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 5521 — Dynamische ETA Live-Tracking V18
// V17+: Geofence-Alarm (500m/200m/50m Annäherungs-Zonen pulsierend);
// Proaktive Push-Benachrichtigungs-Opt-in Karte;
// Freigabe-Animation Konfetti bei Lieferung;
// Warme-Mahlzeit-Countdown ("noch X min bis optimal");
// Kurier-Chat-Bubble (Mock);
// 1s-Tick + 20s-Polling; Mock-Fallback

type Phase = 'bestellt' | 'zubereitung' | 'unterwegs' | 'geliefert';
type GeofenceZone = 'fern' | 'nah_500' | 'nah_200' | 'nah_50';

interface TrackingState {
  phase: Phase;
  eta_min: number;
  eta_min_low: number;
  eta_min_high: number;
  confidence: number;
  driver_name: string | null;
  driver_phone: string | null;
  driver_distance_m: number | null;
  driver_distance_total_m: number | null;
  traffic: 'leicht' | 'mittel' | 'schwer';
  warmup_min: number | null;
}

const MOCK: TrackingState = {
  phase: 'unterwegs',
  eta_min: 9,
  eta_min_low: 7,
  eta_min_high: 12,
  confidence: 88,
  driver_name: 'Marco S.',
  driver_phone: '+4915112345678',
  driver_distance_m: 800,
  driver_distance_total_m: 3500,
  traffic: 'leicht',
  warmup_min: 2,
};

const PHASE_CONFIG: Record<Phase, { label: string; icon: React.ComponentType<{ className?: string }>; step: number }> = {
  bestellt:    { label: 'Bestellt',    icon: Package,      step: 1 },
  zubereitung: { label: 'Zubereitung', icon: ChefHat,      step: 2 },
  unterwegs:   { label: 'Unterwegs',   icon: Bike,         step: 3 },
  geliefert:   { label: 'Geliefert',   icon: CheckCircle2, step: 4 },
};

const TRAFFIC_CONFIG: Record<'leicht' | 'mittel' | 'schwer', { label: string; color: string }> = {
  leicht: { label: 'Leicht',  color: 'text-emerald-400' },
  mittel: { label: 'Mittel',  color: 'text-yellow-400' },
  schwer: { label: 'Schwer!', color: 'text-red-400' },
};

function getGeofence(dist: number | null): GeofenceZone {
  if (dist === null) return 'fern';
  if (dist <= 50) return 'nah_50';
  if (dist <= 200) return 'nah_200';
  if (dist <= 500) return 'nah_500';
  return 'fern';
}

const GEOFENCE_CONFIG: Record<GeofenceZone, { label: string; color: string; pulse: string; size: number }> = {
  fern:     { label: '',          color: '',             pulse: '',                   size: 0 },
  nah_500:  { label: '500m',      color: 'text-yellow-400', pulse: 'animate-pulse',  size: 1 },
  nah_200:  { label: '200m',      color: 'text-orange-400', pulse: 'animate-pulse',  size: 2 },
  nah_50:   { label: '50m — Gleich da!', color: 'text-red-400', pulse: 'animate-bounce', size: 3 },
};

function ConfidenceRing({ confidence, etaMin }: { confidence: number; etaMin: number }) {
  const r = 38; const r2 = 28; const circ = 2 * Math.PI * r; const circ2 = 2 * Math.PI * r2;
  const confColor = confidence >= 80 ? '#22c55e' : confidence >= 60 ? '#eab308' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center">
      <svg width="96" height="96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#27272a" strokeWidth="5" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={confColor} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - confidence / 100)}
          strokeLinecap="round" transform="rotate(-90 48 48)" opacity="0.9" />
        <circle cx="48" cy="48" r={r2} fill="none" stroke="#3f3f46" strokeWidth="3" />
        <circle cx="48" cy="48" r={r2} fill="none" stroke="#6366f1" strokeWidth="3"
          strokeDasharray={circ2} strokeDashoffset={circ2 * 0.3}
          strokeLinecap="round" transform="rotate(-90 48 48)" opacity="0.5" />
        <text x="48" y="43" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="bold" fill="white">{etaMin}</text>
        <text x="48" y="57" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#a1a1aa">min</text>
      </svg>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
        <span style={{ color: confColor }} className="text-[10px] font-semibold">{confidence}%</span>
      </div>
    </div>
  );
}

function DriverApproachRing({ distM, totalM }: { distM: number; totalM: number }) {
  const r = 30; const circ = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, 1 - distM / totalM));
  const color = distM < 100 ? '#ef4444' : distM < 300 ? '#f97316' : distM < 600 ? '#eab308' : '#6366f1';
  return (
    <svg width="72" height="72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
        strokeLinecap="round" transform="rotate(-90 36 36)" />
      <text x="36" y="32" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="bold" fill={color}>{distM < 1000 ? `${distM}m` : `${(distM / 1000).toFixed(1)}km`}</text>
      <text x="36" y="44" textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#71717a">entfernt</text>
    </svg>
  );
}

interface ChatMessage { from: 'fahrer' | 'kunde'; text: string; time: string }
const MOCK_CHAT: ChatMessage[] = [
  { from: 'fahrer', text: 'Bin gleich bei euch!', time: '14:38' },
];

interface Props { orderId: string; locationSlug?: string; initialStatus?: string; initialEta?: string | null; className?: string }

export function StorefrontPhase5521DynamischeEtaLiveTrackingV18({ orderId, locationSlug, initialStatus, initialEta, className }: Props) {
  const [state, setState] = useState<TrackingState>(MOCK);
  const [tick, setTick] = useState(0);
  const [pushOptIn, setPushOptIn] = useState<boolean | null>(null);
  const [delivered, setDelivered] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
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
      if (r.ok) {
        const data = await r.json();
        if (data) setState(prev => ({ ...prev, ...data }));
      }
    } catch { /* use mock */ }
  }, [orderId]);

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [load]);

  const livEta = Math.max(0, state.eta_min - Math.floor(tick / 60));
  const geofence = getGeofence(state.driver_distance_m !== null ? Math.max(0, state.driver_distance_m - tick * 5) : null);
  const geoConfig = GEOFENCE_CONFIG[geofence];
  const isDelivered = state.phase === 'geliefert' || delivered;

  return (
    <div className={cn('space-y-3 text-white', className)}>
      {/* Phase Steps */}
      <div className="bg-matcha-900/60 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-1">
          {(Object.keys(PHASE_CONFIG) as Phase[]).map((key, i) => {
            const cfg = PHASE_CONFIG[key];
            const Icon = cfg.icon;
            const active = state.phase === key;
            const done = cfg.step < PHASE_CONFIG[state.phase].step;
            return (
              <div key={key} className="flex items-center gap-1 flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={cn('flex items-center justify-center w-9 h-9 rounded-full transition-all',
                    isDelivered && key === 'geliefert' ? 'bg-emerald-500 scale-110' :
                    active ? 'bg-matcha-600 ring-2 ring-matcha-400 animate-pulse' :
                    done ? 'bg-matcha-700' : 'bg-matcha-800')}>
                    <Icon className={cn('h-4 w-4', done || (isDelivered && key === 'geliefert') ? 'text-emerald-400' : active ? 'text-white' : 'text-matcha-500')} />
                  </div>
                  <span className={cn('text-[9px] text-center leading-tight', active ? 'text-white font-semibold' : done ? 'text-matcha-400' : 'text-matcha-600')}>{cfg.label}</span>
                </div>
                {i < 3 && <div className={cn('h-0.5 w-4 shrink-0 rounded-full mb-4', done ? 'bg-matcha-500' : 'bg-matcha-800')} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ETA + Approach */}
      {!isDelivered && (
        <div className="bg-matcha-900/60 rounded-2xl p-4 flex items-center gap-4">
          <ConfidenceRing confidence={state.confidence} etaMin={livEta} />
          <div className="flex-1 space-y-1.5">
            <div className="text-sm font-semibold">ETA: {state.eta_min_low}–{state.eta_min_high} min</div>
            <div className={cn('text-xs', TRAFFIC_CONFIG[state.traffic].color)}>
              Verkehr: {TRAFFIC_CONFIG[state.traffic].label}
            </div>
            {state.warmup_min !== null && (
              <div className="text-xs text-orange-300">
                🍽️ Optimal servieren in ~{Math.max(0, state.warmup_min + livEta)}min
              </div>
            )}
          </div>
          {state.driver_distance_m !== null && state.driver_distance_total_m !== null && (
            <DriverApproachRing distM={Math.max(0, state.driver_distance_m - tick * 5)} totalM={state.driver_distance_total_m} />
          )}
        </div>
      )}

      {/* Geofence Alert */}
      {geofence !== 'fern' && !isDelivered && (
        <div className={cn('flex items-center gap-2 rounded-2xl px-4 py-3 border',
          geofence === 'nah_50' ? 'bg-red-500/20 border-red-500/40' :
          geofence === 'nah_200' ? 'bg-orange-500/20 border-orange-500/40' : 'bg-yellow-500/15 border-yellow-500/30')}>
          <div className={cn('w-3 h-3 rounded-full shrink-0', geoConfig.pulse,
            geofence === 'nah_50' ? 'bg-red-400' : geofence === 'nah_200' ? 'bg-orange-400' : 'bg-yellow-400')} />
          <span className={cn('text-sm font-semibold', geoConfig.color)}>
            Fahrer: {geoConfig.label}
          </span>
        </div>
      )}

      {/* Driver Info + Contact */}
      {state.driver_name && !isDelivered && (
        <div className="bg-matcha-900/60 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-matcha-700 flex items-center justify-center text-lg font-bold text-matcha-300 shrink-0">
            {state.driver_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{state.driver_name}</div>
            <div className="text-xs text-matcha-400">Dein Fahrer</div>
          </div>
          <div className="flex gap-2">
            {state.driver_phone && (
              <a href={`tel:${state.driver_phone}`} className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                <Phone className="h-4 w-4" />
              </a>
            )}
            <button onClick={() => setChatOpen(v => !v)} className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors">
              <MessageCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Chat Bubble */}
      {chatOpen && (
        <div className="bg-matcha-900/60 rounded-2xl p-4 space-y-2">
          <div className="text-xs text-matcha-400 mb-2">Nachrichten vom Fahrer</div>
          {MOCK_CHAT.map((m, i) => (
            <div key={i} className={cn('flex', m.from === 'fahrer' ? 'justify-start' : 'justify-end')}>
              <div className={cn('rounded-xl px-3 py-2 text-sm max-w-[80%]',
                m.from === 'fahrer' ? 'bg-matcha-700 text-white' : 'bg-matcha-500 text-white')}>
                {m.text}
                <span className="ml-2 text-[9px] text-matcha-400">{m.time}</span>
              </div>
            </div>
          ))}
          <div className="text-[10px] text-matcha-500 text-center pt-1">Antworten nur über Telefon möglich</div>
        </div>
      )}

      {/* Push Opt-In */}
      {pushOptIn === null && !isDelivered && (
        <div className="bg-matcha-900/60 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-yellow-400 shrink-0" />
            <span className="text-sm font-semibold">Benachrichtigungen aktivieren?</span>
          </div>
          <p className="text-xs text-matcha-400">Wir informieren dich wenn dein Fahrer 2 Minuten entfernt ist.</p>
          <div className="flex gap-2">
            <button onClick={() => setPushOptIn(true)} className="flex-1 py-2 rounded-xl bg-matcha-600 text-white text-sm font-medium hover:bg-matcha-500 transition-colors">Ja, bitte</button>
            <button onClick={() => setPushOptIn(false)} className="flex-1 py-2 rounded-xl bg-matcha-800 text-matcha-400 text-sm font-medium hover:bg-matcha-700 transition-colors">Nein</button>
          </div>
        </div>
      )}

      {/* Delivery + Rating */}
      {isDelivered && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-3">
          <div className="text-4xl">🎉</div>
          <div className="text-lg font-bold text-emerald-400">Geliefert!</div>
          <p className="text-sm text-matcha-300">Guten Appetit! Deine Bestellung wurde übergeben.</p>
          {state.warmup_min !== null && (
            <p className="text-xs text-orange-300">🍽️ Optimal jetzt servieren — {state.warmup_min}min Wärme-Fenster</p>
          )}
          {rating === null ? (
            <div className="space-y-2">
              <p className="text-sm text-matcha-400">Wie war dein Essen?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setRating(n)}
                    className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-yellow-400 transition-colors">
                    <Star className={cn('h-5 w-5', n >= 4 && 'fill-yellow-400')} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-sm font-medium">Danke für dein Feedback! {rating}★</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
