'use client';

/**
 * Phase 5585 — Dynamische ETA Live-Tracking V22
 *
 * V21+: KI-Lieferzeitprognose mit Konfidenz-Pfeil (hoch/mittel/niedrig);
 * Küchen-Transparenz-Score (Kochfortschritt-Badge für den Kunden sichtbar);
 * Fahrer-Profil-Live-Badge (Name + Bewertung + Fotoavatar-Initialen);
 * Bonus-Punkte-Preview (Treuepunkte für diese Lieferung);
 * Animierter ETA-Ring (SVG-Kreisbogen);
 * 30s-Polling; Mock-Fallback
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Brain, ChefHat, CheckCircle2, Clock, Gift, RefreshCw, Star, Truck, Zap } from 'lucide-react';

type Phase = 'eingang' | 'kueche' | 'bereit' | 'unterwegs' | 'naehe' | 'geliefert';
type Konfidenz = 'hoch' | 'mittel' | 'niedrig';

interface TrackingData {
  phase: Phase;
  eta_min: number;
  eta_sekunden: number;
  fahrer_name: string;
  fahrer_bewertung: number;
  distanz_km: number;
  naechster_stopp: number;
  kuechen_score: number;
  ki_konfidenz: Konfidenz;
  ki_delta_min: number;
  bonus_punkte: number;
  bewertungs_stars: number | null;
}

const PHASES: { id: Phase; label: string; kurztext: string }[] = [
  { id: 'eingang', label: 'Eingegangen', kurztext: 'Bestätigt' },
  { id: 'kueche', label: 'In der Küche', kurztext: 'Zubereitung' },
  { id: 'bereit', label: 'Bereit', kurztext: 'Verpackt' },
  { id: 'unterwegs', label: 'Unterwegs', kurztext: 'Fahrer' },
  { id: 'naehe', label: 'Fast da!', kurztext: '<5 min' },
  { id: 'geliefert', label: 'Geliefert', kurztext: '✓' },
];

const MOCK: TrackingData = {
  phase: 'unterwegs',
  eta_min: 11,
  eta_sekunden: 665,
  fahrer_name: 'Mehmet K.',
  fahrer_bewertung: 4.8,
  distanz_km: 2.1,
  naechster_stopp: 1,
  kuechen_score: 94,
  ki_konfidenz: 'hoch',
  ki_delta_min: -1,
  bonus_punkte: 48,
  bewertungs_stars: null,
};

function phaseIndex(p: Phase) { return PHASES.findIndex(x => x.id === p); }

function fmtTime(s: number) {
  if (s <= 0) return '0:00';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function konfidenzColor(k: Konfidenz) {
  if (k === 'hoch') return 'text-emerald-400';
  if (k === 'mittel') return 'text-amber-400';
  return 'text-red-400';
}

function konfidenzLabel(k: Konfidenz) {
  if (k === 'hoch') return 'KI-Konfidenz hoch ▲';
  if (k === 'mittel') return 'KI-Konfidenz mittel –';
  return 'KI-Konfidenz niedrig ▼';
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function EtaRing({ progress, label }: { progress: number; label: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, progress));
  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="#34d399" strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-white/90 font-bold text-sm leading-none">{label}</div>
        <div className="text-white/40 text-[9px]">min</div>
      </div>
    </div>
  );
}

export function StorefrontPhase5585DynamischeEtaLiveTrackingV22({
  orderId, locationId,
}: { orderId?: string | null; locationId?: string | null }) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [tick, setTick] = useState(0);
  const [stars, setStars] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    if (!orderId && !locationId) return;
    try {
      const params = new URLSearchParams();
      if (orderId) params.set('orderId', orderId);
      if (locationId) params.set('locationId', locationId);
      const res = await fetch(`/api/delivery/tracking?${params}`);
      if (res.ok) { const j = await res.json(); if (j) setData(j); }
    } catch { /* use mock */ }
  };

  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    pollRef.current = setInterval(() => { setLoading(true); fetchData().finally(() => setLoading(false)); }, 30000);
    fetchData();
    return () => { clearInterval(tickRef.current!); clearInterval(pollRef.current!); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, locationId]);

  const idx = phaseIndex(data.phase);
  const totalSec = data.eta_min * 60;
  const remainSec = Math.max(0, totalSec - tick);
  const progress = totalSec > 0 ? 1 - remainSec / totalSec : 1;
  const isDelivered = data.phase === 'geliefert';
  const isNaehe = data.phase === 'naehe';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-emerald-400" />
          <span className="font-semibold text-white/90">Live-Tracking V22</span>
        </div>
        {loading && <RefreshCw size={12} className="animate-spin text-white/30" />}
      </div>

      {/* Phase Timeline */}
      <div className="flex items-center gap-0">
        {PHASES.map((p, i) => {
          const done = i < idx;
          const active = i === idx;
          const future = i > idx;
          return (
            <div key={p.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] transition-all',
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400' : 'bg-white/5 border border-white/20 text-white/30')}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={cn('text-[8px] mt-0.5 truncate max-w-[44px] text-center',
                  done ? 'text-emerald-400' : active ? 'text-white/80' : 'text-white/30')}>
                  {p.kurztext}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-0.5 rounded', done ? 'bg-emerald-500' : 'bg-white/10')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Main ETA area */}
      {isDelivered ? (
        <div className="text-center space-y-2">
          <div className="text-4xl">🎉</div>
          <div className="text-white/90 font-bold text-lg">Geliefert!</div>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setStars(s)}
                className={cn('transition-colors', (stars ?? 0) >= s ? 'text-amber-400' : 'text-white/20')}>
                <Star size={22} fill={(stars ?? 0) >= s ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          {stars && <div className="text-white/60 text-xs">{stars} Stern{stars !== 1 ? 'e' : ''} gegeben – danke!</div>}
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <EtaRing progress={progress} label={String(Math.ceil(remainSec / 60))} />
          <div className="flex-1 space-y-1.5">
            <div className="text-white/90 font-bold text-base">{fmtTime(remainSec)}</div>
            <div className={cn('text-xs font-medium', PHASES[idx]?.id === 'naehe' ? 'text-emerald-400 animate-pulse' : 'text-white/60')}>
              {PHASES[idx]?.label}
            </div>
            <div className={cn('text-[11px]', konfidenzColor(data.ki_konfidenz))}>
              <Brain size={10} className="inline mr-0.5" />{konfidenzLabel(data.ki_konfidenz)}
              {data.ki_delta_min !== 0 && (
                <span className="ml-1 text-[10px]">({data.ki_delta_min > 0 ? '+' : ''}{data.ki_delta_min} min)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {isNaehe && !isDelivered && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-center animate-pulse">
          <span className="text-emerald-300 font-medium text-sm">🚴 Dein Fahrer ist fast da!</span>
        </div>
      )}

      {/* Fahrer-Profil */}
      {!isDelivered && (
        <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {initials(data.fahrer_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white/80 font-medium truncate">{data.fahrer_name}</div>
            <div className="flex items-center gap-1">
              <Star size={11} className="text-amber-400 fill-amber-400" />
              <span className="text-white/50 text-[11px]">{data.fahrer_bewertung.toFixed(1)}</span>
              <span className="text-white/30 text-[11px]">· {data.distanz_km.toFixed(1)} km entfernt</span>
            </div>
          </div>
          {data.naechster_stopp === 1 && (
            <span className="text-emerald-400 text-[10px] font-medium">Nächster Stopp: Du</span>
          )}
        </div>
      )}

      {/* Küchen-Transparenz + Bonus */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg bg-white/5 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[10px] text-white/50 mb-0.5">
            <ChefHat size={10} /> Küchen-Score
          </div>
          <div className={cn('font-bold text-sm', data.kuechen_score >= 90 ? 'text-emerald-400' : data.kuechen_score >= 70 ? 'text-amber-400' : 'text-red-400')}>
            {data.kuechen_score}%
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1">
            <div className={cn('h-full rounded-full', data.kuechen_score >= 90 ? 'bg-emerald-500' : 'bg-amber-500')}
              style={{ width: `${data.kuechen_score}%` }} />
          </div>
        </div>
        <div className="flex-1 rounded-lg bg-white/5 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[10px] text-white/50 mb-0.5">
            <Gift size={10} /> Treuepunkte
          </div>
          <div className="font-bold text-sm text-fuchsia-400">+{data.bonus_punkte} P</div>
          <div className="text-[9px] text-white/30 mt-0.5">Für diese Lieferung</div>
        </div>
      </div>
    </div>
  );
}
