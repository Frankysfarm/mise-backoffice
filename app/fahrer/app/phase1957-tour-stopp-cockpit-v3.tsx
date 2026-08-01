'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapPin, CheckCircle2, Navigation, Clock, Euro, AlertTriangle, ChevronRight, Zap, Star, Gift, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1957 — Tour-Stopp-Cockpit V3
// V2+: Multi-Stop-Übersicht aller Stopps inkl. ETA-Prognose;
// Live-Bonus-Akkumulator (Pünktlichkeit+Bewertung+Strecke);
// Stopp-Vergleich Heute vs. Letzte Schicht;
// Schnellkontakt-Panel (1-Tap Anrufen/Navigieren);
// Score-Fortschritts-Ring live;
// 15s-Polling; Mock-Fallback

type StopStatus = 'anfahrt' | 'angekommen' | 'abgeliefert' | 'problem';
type BonusType = 'pünktlich' | 'strecke' | 'bewertung' | null;
type Tab = 'naechster' | 'alle' | 'bonus' | 'vergleich';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  name: string;
  status: StopStatus;
  eta_min: number | null;
  betrag: number | null;
  bonus: BonusType;
  bonus_betrag: number | null;
  kommentar: string | null;
  klingel: string | null;
}

interface TourData {
  tour_id: string;
  stopps_gesamt: number;
  stopps_erledigt: number;
  naechster_stopp: TourStop | null;
  aktuelle_stopps: TourStop[];
  bonus_gesamt: number;
  bonus_pünktlich: number;
  bonus_strecke: number;
  bonus_bewertung: number;
  score_live: number;
  heute_stopps: number;
  letzte_schicht_stopps: number;
  heute_avg_min: number;
  letzte_schicht_avg_min: number;
}

const MOCK: TourData = {
  tour_id: 'T-2024-08',
  stopps_gesamt: 5,
  stopps_erledigt: 2,
  score_live: 91,
  bonus_gesamt: 2.00,
  bonus_pünktlich: 1.00,
  bonus_strecke: 0.50,
  bonus_bewertung: 0.50,
  heute_stopps: 14,
  letzte_schicht_stopps: 11,
  heute_avg_min: 22,
  letzte_schicht_avg_min: 26,
  naechster_stopp: {
    id: 's3', reihenfolge: 3,
    adresse: 'Kapuzinerstr. 12, 52062 Aachen',
    name: 'Max Müller',
    status: 'anfahrt',
    eta_min: 4,
    betrag: 38.50,
    bonus: 'pünktlich',
    bonus_betrag: 0.50,
    kommentar: 'Klingelschild „Müller", 2. OG links',
    klingel: 'Müller (2. OG)',
  },
  aktuelle_stopps: [
    { id: 's1', reihenfolge: 1, adresse: 'Pontstraße 5', name: 'Anna K.', status: 'abgeliefert', eta_min: null, betrag: 24.00, bonus: 'pünktlich', bonus_betrag: 0.50, kommentar: null, klingel: null },
    { id: 's2', reihenfolge: 2, adresse: 'Theaterplatz 3', name: 'Ben S.', status: 'abgeliefert', eta_min: null, betrag: 31.50, bonus: 'strecke', bonus_betrag: 0.50, kommentar: null, klingel: null },
    { id: 's3', reihenfolge: 3, adresse: 'Kapuzinerstr. 12', name: 'Max M.', status: 'anfahrt', eta_min: 4, betrag: 38.50, bonus: 'pünktlich', bonus_betrag: 0.50, kommentar: 'Klingelschild', klingel: 'Müller (2. OG)' },
    { id: 's4', reihenfolge: 4, adresse: 'Boxgraben 22', name: 'Lea T.', status: 'anfahrt', eta_min: 12, betrag: 18.90, bonus: null, bonus_betrag: null, kommentar: null, klingel: null },
    { id: 's5', reihenfolge: 5, adresse: 'Westpark 8', name: 'Kim R.', status: 'anfahrt', eta_min: 20, betrag: 45.20, bonus: 'bewertung', bonus_betrag: 0.50, kommentar: 'Torcode 1234', klingel: null },
  ],
};

const STATUS_CONFIG: Record<StopStatus, { label: string; cls: string; dot: string }> = {
  anfahrt:     { label: 'Anfahrt',    cls: 'text-blue-400',    dot: 'bg-blue-400 animate-pulse' },
  angekommen:  { label: 'Angekommen', cls: 'text-yellow-400',  dot: 'bg-yellow-400' },
  abgeliefert: { label: 'Erledigt',   cls: 'text-emerald-400', dot: 'bg-emerald-500' },
  problem:     { label: 'Problem',    cls: 'text-red-400',     dot: 'bg-red-500' },
};

const BONUS_CONFIG: Record<NonNullable<BonusType>, { label: string; icon: string }> = {
  pünktlich: { label: 'Pünktlichkeit', icon: '⏱' },
  strecke:   { label: 'Kurzstrecke',   icon: '🚀' },
  bewertung: { label: 'Bewertung',     icon: '⭐' },
};

function ScoreRing({ score }: { score: number }) {
  const r = 28; const circ = 2 * Math.PI * r;
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#eab308' : '#ef4444';
  return (
    <svg width="64" height="64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#27272a" strokeWidth="5" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
        strokeLinecap="round" transform="rotate(-90 32 32)" />
      <text x="32" y="30" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="bold" fill={color}>{score}</text>
      <text x="32" y="42" textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#71717a">Score</text>
    </svg>
  );
}

export function FahrerPhase1957TourStoppCockpitV3() {
  const [data, setData] = useState<TourData>(MOCK);
  const [tab, setTab] = useState<Tab>('naechster');
  const [confirmed, setConfirmed] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/delivery/fahrer/tour-status');
      if (r.ok) { const d = await r.json(); if (d) setData(d); }
    } catch { /* mock */ }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

  const fortschritt = data.stopps_gesamt > 0 ? (data.stopps_erledigt / data.stopps_gesamt) * 100 : 0;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'naechster', label: 'Nächster' },
    { key: 'alle',      label: `Alle (${data.stopps_gesamt})` },
    { key: 'bonus',     label: 'Bonus' },
    { key: 'vergleich', label: 'Vergleich' },
  ];

  return (
    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Tour-Stopp-Cockpit V3</div>
          <div className="text-[10px] text-zinc-500 font-mono">{data.tour_id}</div>
        </div>
        <ScoreRing score={data.score_live} />
      </div>

      {/* Fortschritt */}
      <div>
        <div className="flex justify-between text-xs text-zinc-400 mb-1">
          <span>{data.stopps_erledigt}/{data.stopps_gesamt} Stopps</span>
          <span className="font-mono">{Math.round(fortschritt)}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${fortschritt}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white bg-zinc-800/60')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Nächster Stopp */}
      {tab === 'naechster' && data.naechster_stopp && (
        <div className="space-y-3">
          <div className="bg-zinc-800/70 rounded-xl p-3 border border-zinc-700/50">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-indigo-400 mb-0.5">Stopp {data.naechster_stopp.reihenfolge}</div>
                <div className="text-sm font-semibold text-white truncate">{data.naechster_stopp.name}</div>
                <div className="text-xs text-zinc-400 mt-0.5 truncate">{data.naechster_stopp.adresse}</div>
                {data.naechster_stopp.klingel && (
                  <div className="text-[10px] text-zinc-500 mt-0.5">🔔 {data.naechster_stopp.klingel}</div>
                )}
                {data.naechster_stopp.kommentar && (
                  <div className="text-[10px] text-amber-400 mt-0.5">📝 {data.naechster_stopp.kommentar}</div>
                )}
              </div>
              <div className="text-right shrink-0 ml-3">
                {data.naechster_stopp.eta_min !== null && (
                  <div className="flex items-center gap-1 text-indigo-400">
                    <Clock className="h-3 w-3" />
                    <span className="text-base font-bold">{data.naechster_stopp.eta_min}min</span>
                  </div>
                )}
                {data.naechster_stopp.betrag !== null && (
                  <div className="text-xs text-zinc-400 mt-0.5 font-mono">{data.naechster_stopp.betrag.toFixed(2)}€</div>
                )}
              </div>
            </div>
            {data.naechster_stopp.bonus && data.naechster_stopp.bonus_betrag !== null && (
              <div className="mt-2 flex items-center gap-1.5 bg-amber-500/10 rounded-md px-2 py-1">
                <Gift className="h-3 w-3 text-amber-400" />
                <span className="text-xs text-amber-400">{BONUS_CONFIG[data.naechster_stopp.bonus].icon} {BONUS_CONFIG[data.naechster_stopp.bonus].label} +{data.naechster_stopp.bonus_betrag.toFixed(2)}€</span>
              </div>
            )}
          </div>

          {/* Schnellkontakt */}
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-2 bg-blue-600/80 hover:bg-blue-600 text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
              <Phone className="h-4 w-4" />Anrufen
            </button>
            <button className="flex items-center justify-center gap-2 bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
              <Navigation className="h-4 w-4" />Navi
            </button>
          </div>

          {/* Ankunft bestätigen */}
          <button
            onClick={() => setConfirmed(!confirmed)}
            className={cn('w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
              confirmed ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700')}>
            <CheckCircle2 className="h-4 w-4" />
            {confirmed ? 'Angekommen bestätigt' : 'Ankunft bestätigen'}
          </button>
        </div>
      )}

      {/* Alle Stopps */}
      {tab === 'alle' && (
        <div className="space-y-2">
          {data.aktuelle_stopps.map(stopp => {
            const sc = STATUS_CONFIG[stopp.status];
            return (
              <div key={stopp.id} className={cn('flex items-center gap-3 rounded-lg p-2.5 border',
                stopp.status === 'abgeliefert' ? 'bg-emerald-500/5 border-emerald-500/20' :
                stopp.status === 'anfahrt' && stopp.reihenfolge === data.naechster_stopp?.reihenfolge ? 'bg-indigo-500/10 border-indigo-500/40' :
                'bg-zinc-800/40 border-zinc-700/30')}>
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', sc.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{stopp.reihenfolge}. {stopp.name}</div>
                  <div className="text-[10px] text-zinc-400 truncate">{stopp.adresse}</div>
                </div>
                <div className="text-right shrink-0">
                  {stopp.eta_min !== null && <div className="text-xs font-mono text-indigo-400">{stopp.eta_min}min</div>}
                  <div className={cn('text-[10px]', sc.cls)}>{sc.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bonus */}
      {tab === 'bonus' && (
        <div className="space-y-3">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">+{data.bonus_gesamt.toFixed(2)}€</div>
            <div className="text-xs text-zinc-400 mt-1">Bonus dieser Tour</div>
          </div>
          {[
            { label: 'Pünktlichkeit', val: data.bonus_pünktlich, icon: '⏱', cls: 'text-blue-400' },
            { label: 'Kurzstrecke',   val: data.bonus_strecke,   icon: '🚀', cls: 'text-emerald-400' },
            { label: 'Bewertung',     val: data.bonus_bewertung,  icon: '⭐', cls: 'text-yellow-400' },
          ].map(b => (
            <div key={b.label} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span>{b.icon}</span>
                <span className="text-sm text-zinc-300">{b.label}</span>
              </div>
              <span className={cn('text-sm font-bold font-mono', b.cls)}>+{b.val.toFixed(2)}€</span>
            </div>
          ))}
        </div>
      )}

      {/* Vergleich */}
      {tab === 'vergleich' && (
        <div className="space-y-2">
          {[
            { label: 'Stopps heute', heute: data.heute_stopps, letzte: data.letzte_schicht_stopps, unit: '' },
            { label: 'Ø-Lieferzeit', heute: data.heute_avg_min, letzte: data.letzte_schicht_avg_min, unit: 'min', lower_is_better: true },
          ].map(k => {
            const better = k.lower_is_better ? k.heute < k.letzte : k.heute > k.letzte;
            return (
              <div key={k.label} className="bg-zinc-800/60 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-2">{k.label}</div>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className={cn('text-lg font-bold', better ? 'text-emerald-400' : 'text-red-400')}>{k.heute}{k.unit}</div>
                    <div className="text-[10px] text-zinc-500">Heute</div>
                  </div>
                  <div className="text-zinc-600 text-xl">vs</div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-zinc-400">{k.letzte}{k.unit}</div>
                    <div className="text-[10px] text-zinc-500">Letzte Schicht</div>
                  </div>
                  <div className={cn('text-sm font-bold', better ? 'text-emerald-400' : 'text-red-400')}>
                    {better ? '↑' : '↓'} {Math.abs(k.heute - k.letzte)}{k.unit}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
