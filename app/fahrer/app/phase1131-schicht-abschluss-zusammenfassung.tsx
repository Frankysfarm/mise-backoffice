'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Star, Clock, MapPin, Euro, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1131 — Schicht-Abschluss-Zusammenfassung (Fahrer-App)
// Tages-Zusammenfassung nach Schichtende: Stopps, km, Umsatz, Trinkgeld, Score

interface Props {
  driverId: string;
  isOnline: boolean;
  schichtBeendet?: boolean;
}

type ApiData = {
  fahrer_id: string;
  fahrer_name: string;
  schicht_start: string | null;
  schicht_ende: string | null;
  schicht_dauer_min: number;
  stopps_gesamt: number;
  km_gesamt: number;
  umsatz_eur: number;
  trinkgeld_eur: number;
  puenktlichkeit_pct: number;
  score: number;
  score_label: 'Ausgezeichnet' | 'Gut' | 'Befriedigend' | 'Verbesserungsbedarf';
  generiert_am: string;
};

const MOCK: ApiData = {
  fahrer_id: '',
  fahrer_name: 'Fahrer',
  schicht_start: new Date(Date.now() - 8 * 3600000).toISOString(),
  schicht_ende: new Date().toISOString(),
  schicht_dauer_min: 480,
  stopps_gesamt: 22,
  km_gesamt: 54,
  umsatz_eur: 680,
  trinkgeld_eur: 34,
  puenktlichkeit_pct: 88,
  score: 82,
  score_label: 'Gut',
  generiert_am: new Date().toISOString(),
};

const SCORE_COLOR: Record<ApiData['score_label'], string> = {
  'Ausgezeichnet':       'text-emerald-400',
  'Gut':                 'text-sky-400',
  'Befriedigend':        'text-amber-400',
  'Verbesserungsbedarf': 'text-red-400',
};

const SCORE_BG: Record<ApiData['score_label'], string> = {
  'Ausgezeichnet':       'bg-emerald-500/20 border-emerald-500/40',
  'Gut':                 'bg-sky-500/20 border-sky-500/40',
  'Befriedigend':        'bg-amber-500/20 border-amber-500/40',
  'Verbesserungsbedarf': 'bg-red-500/20 border-red-500/40',
};

function formatDauer(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;
  return (
    <svg width="112" height="112" viewBox="0 0 112 112">
      <circle cx="56" cy="56" r={R} fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
      <circle
        cx="56" cy="56" r={R} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={C} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 56 56)"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x="56" y="51" textAnchor="middle" fontSize="22" fontWeight="bold" fill="white">{pct}</text>
      <text x="56" y="67" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.7)">Punkte</text>
    </svg>
  );
}

const RING_COLOR: Record<ApiData['score_label'], string> = {
  'Ausgezeichnet':       '#34d399',
  'Gut':                 '#38bdf8',
  'Befriedigend':        '#fbbf24',
  'Verbesserungsbedarf': '#f87171',
};

export function FahrerPhase1131SchichtAbschlussZusammenfassung({ driverId, isOnline, schichtBeendet }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/driver/schicht-abschluss-zusammenfassung?driver_id=${driverId}`);
      if (r.ok) setData(await r.json() as ApiData);
      else setData({ ...MOCK, fahrer_id: driverId });
    } catch { setData({ ...MOCK, fahrer_id: driverId }); } finally { setLoading(false); }
  }, [driverId]);

  useEffect(() => { void load(); }, [load]);

  if (!isOnline && !schichtBeendet) return null;

  const d = data ?? { ...MOCK, fahrer_id: driverId };

  return (
    <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400 shrink-0" />
          <span className="font-bold text-sm text-white">Schicht-Zusammenfassung</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-white/50" />}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-white/70" />
          : <ChevronDown className="h-4 w-4 text-white/70" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Score Ring */}
          <div className="flex flex-col items-center gap-2">
            <ProgressRing pct={d.score} color={RING_COLOR[d.score_label]} />
            <span className={cn('text-sm font-bold', SCORE_COLOR[d.score_label])}>
              {d.score_label}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <MapPin className="h-3.5 w-3.5" />, label: 'Stopps', value: String(d.stopps_gesamt) },
              { icon: <Clock className="h-3.5 w-3.5" />, label: 'Schichtdauer', value: formatDauer(d.schicht_dauer_min) },
              { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Gefahren', value: `${d.km_gesamt} km` },
              { icon: <Euro className="h-3.5 w-3.5" />, label: 'Umsatz', value: `${d.umsatz_eur.toFixed(0)} €` },
            ].map(({ icon, label, value }) => (
              <div key={label} className="rounded-lg bg-white/10 p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1 text-white/60 text-[11px]">
                  {icon} {label}
                </div>
                <p className="text-white font-bold text-base">{value}</p>
              </div>
            ))}
          </div>

          {/* Trinkgeld + Pünktlichkeit */}
          <div className={cn('rounded-lg border p-3 flex justify-between items-center', SCORE_BG[d.score_label])}>
            <div className="text-center">
              <p className="text-[11px] text-white/60">Trinkgeld</p>
              <p className="text-white font-bold text-lg">{d.trinkgeld_eur.toFixed(2)} €</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-[11px] text-white/60">Pünktlichkeit</p>
              <p className="text-white font-bold text-lg">{d.puenktlichkeit_pct}%</p>
            </div>
          </div>

          <p className="text-[11px] text-white/40 text-center">
            Schicht: {d.schicht_start ? new Date(d.schicht_start).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }) : '—'} –{' '}
            {d.schicht_ende ? new Date(d.schicht_ende).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
        </div>
      )}
    </div>
  );
}
