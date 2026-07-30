'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, Clock, Zap, AlertTriangle, CheckCircle2, Flame, TrendingUp, TrendingDown, Minus, Target, Layers } from 'lucide-react';

// Phase 5030 — Smart-Timing Countdown V31
// Stations-Heatmap (Grill/Friture/Kalt/Pasta) + 9-stufige Ampel
// Batch-Koordinations-Score + KI-Kochstart je Order + Fahrer-ETA-Sync
// 1-Sek-Tick + 15-Sek-Polling; Mock-Fallback

interface OrderRow {
  id: string;
  nr: string;
  restzeit_sek: number;
  kochzeit_soll_min: number;
  station: 'grill' | 'friture' | 'kalt' | 'pasta' | 'mixed';
  ampel: 'super_ok' | 'ok' | 'gruen' | 'gelb' | 'orange' | 'rot' | 'kritisch' | 'super_kritisch' | 'fertig';
  batch: string | null;
  fahrer_eta_min: number | null;
  prio: number;
  ki_tipp: string | null;
  batch_eff_pct: number | null;
}

interface StationHeat {
  station: 'grill' | 'friture' | 'kalt' | 'pasta';
  label: string;
  emoji: string;
  auslastung_pct: number;
  kritisch_count: number;
}

interface SchichtKpi {
  score: number;
  fertig_heute: number;
  puenktlichkeit_pct: number;
  akt_durchsatz_ph: number;
  kritisch_count: number;
  batch_eff_pct: number;
  trend: 'up' | 'down' | 'flat';
}

interface ApiData {
  orders: OrderRow[];
  stationen: StationHeat[];
  kpis: SchichtKpi;
  naechstes_fertig: string | null;
  alert: string | null;
}

const MOCK: ApiData = {
  kpis: { score: 88, fertig_heute: 47, puenktlichkeit_pct: 92, akt_durchsatz_ph: 25, kritisch_count: 2, batch_eff_pct: 86, trend: 'up' },
  naechstes_fertig: '#1051',
  alert: null,
  stationen: [
    { station: 'grill',   label: 'Grill',     emoji: '🔥', auslastung_pct: 75, kritisch_count: 1 },
    { station: 'friture', label: 'Fritteuse', emoji: '🍟', auslastung_pct: 90, kritisch_count: 1 },
    { station: 'kalt',    label: 'Kalt',      emoji: '🥗', auslastung_pct: 50, kritisch_count: 0 },
    { station: 'pasta',   label: 'Pasta',     emoji: '🍝', auslastung_pct: 30, kritisch_count: 0 },
  ],
  orders: [
    { id: '1', nr: '#1049', restzeit_sek: 45,  kochzeit_soll_min: 12, station: 'friture', ampel: 'super_kritisch', batch: 'A', fahrer_eta_min: 1,  prio: 100, ki_tipp: 'SOFORT starten!',         batch_eff_pct: 95 },
    { id: '2', nr: '#1050', restzeit_sek: 120, kochzeit_soll_min: 8,  station: 'grill',   ampel: 'kritisch',      batch: 'A', fahrer_eta_min: 3,  prio: 95,  ki_tipp: 'Fahrer wartet in 3 min', batch_eff_pct: 90 },
    { id: '3', nr: '#1051', restzeit_sek: 240, kochzeit_soll_min: 15, station: 'kalt',    ampel: 'orange',        batch: 'B', fahrer_eta_min: 8,  prio: 70,  ki_tipp: null,                     batch_eff_pct: 80 },
    { id: '4', nr: '#1052', restzeit_sek: 480, kochzeit_soll_min: 12, station: 'pasta',   ampel: 'gelb',          batch: null, fahrer_eta_min: 14, prio: 55, ki_tipp: null,                     batch_eff_pct: null },
    { id: '5', nr: '#1053', restzeit_sek: 720, kochzeit_soll_min: 10, station: 'grill',   ampel: 'gruen',         batch: 'B', fahrer_eta_min: 20, prio: 40,  ki_tipp: null,                     batch_eff_pct: 75 },
    { id: '6', nr: '#1048', restzeit_sek: 0,   kochzeit_soll_min: 9,  station: 'kalt',    ampel: 'fertig',        batch: 'A', fahrer_eta_min: 0,  prio: 20,  ki_tipp: null,                     batch_eff_pct: 100 },
  ],
};

const AMPEL_CONFIG: Record<OrderRow['ampel'], { bg: string; border: string; badge: string; label: string; pulse: boolean }> = {
  super_kritisch: { bg: 'bg-red-100',    border: 'border-red-500',    badge: 'bg-red-600 text-white',      label: 'KRITISCH!', pulse: true  },
  kritisch:       { bg: 'bg-orange-50',  border: 'border-orange-400', badge: 'bg-orange-500 text-white',   label: 'Kritisch',  pulse: true  },
  rot:            { bg: 'bg-red-50',     border: 'border-red-300',    badge: 'bg-red-500 text-white',      label: 'Überfällig',pulse: true  },
  orange:         { bg: 'bg-amber-50',   border: 'border-amber-300',  badge: 'bg-amber-500 text-white',    label: 'Eile',      pulse: false },
  gelb:           { bg: 'bg-yellow-50',  border: 'border-yellow-300', badge: 'bg-yellow-500 text-black',   label: 'Knapp',     pulse: false },
  gruen:          { bg: 'bg-green-50',   border: 'border-green-200',  badge: 'bg-green-500 text-white',    label: 'OK',        pulse: false },
  ok:             { bg: 'bg-emerald-50', border: 'border-emerald-200',badge: 'bg-emerald-400 text-white',  label: 'Gut',       pulse: false },
  super_ok:       { bg: 'bg-teal-50',    border: 'border-teal-200',   badge: 'bg-teal-500 text-white',     label: 'Sehr gut',  pulse: false },
  fertig:         { bg: 'bg-matcha-50',  border: 'border-matcha-300', badge: 'bg-matcha-600 text-white',   label: 'Fertig ✓',  pulse: false },
};

const HEAT_COLOR: Record<number, string> = {
  0: 'bg-sky-100 text-sky-700',
  1: 'bg-green-100 text-green-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-red-100 text-red-700',
};

function heatLevel(pct: number) {
  if (pct >= 85) return 3;
  if (pct >= 60) return 2;
  if (pct >= 35) return 1;
  return 0;
}

function fmt(sek: number) {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function KitchenPhase5030SmartTimingCountdownV31() {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    try {
      const r = await fetch('/api/delivery/admin/kitchen-smart-timing', { cache: 'no-store' });
      if (!r.ok) throw new Error('api');
      setData(await r.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(() => setTick((n) => n + 1), 1000);
    pollRef.current = setInterval(fetchData, 15_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const d = data ?? MOCK;
  const sorted = [...d.orders].sort((a, b) => b.prio - a.prio);
  const active = sorted.filter((o) => o.ampel !== 'fertig');
  const done = sorted.filter((o) => o.ampel === 'fertig');
  const kpis = d.kpis;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 bg-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5" />
          <span className="font-bold text-sm tracking-wide">Smart-Timing V31</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs opacity-80">Pünktl. {kpis.puenktlichkeit_pct}%</span>
          <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${kpis.score >= 85 ? 'bg-green-500' : kpis.score >= 70 ? 'bg-amber-400 text-black' : 'bg-red-500'}`}>
            <Target className="h-3 w-3" />
            Score {kpis.score}
            {kpis.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : kpis.trend === 'down' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </div>
        </div>
      </div>

      {/* Alert */}
      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {d.alert}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-6 border-b border-indigo-100 divide-x divide-indigo-100">
        {[
          { label: 'Score', val: kpis.score, suffix: '' },
          { label: 'Fertig', val: kpis.fertig_heute, suffix: '' },
          { label: 'Kritisch', val: kpis.kritisch_count, suffix: '', warn: kpis.kritisch_count > 0 },
          { label: 'Durchsatz', val: kpis.akt_durchsatz_ph, suffix: '/h' },
          { label: 'Batch-Eff', val: kpis.batch_eff_pct, suffix: '%' },
          { label: 'Pünktl.', val: kpis.puenktlichkeit_pct, suffix: '%' },
        ].map((k) => (
          <div key={k.label} className={`px-3 py-2 text-center ${k.warn ? 'bg-red-50' : ''}`}>
            <div className={`text-sm font-black ${k.warn ? 'text-red-600' : 'text-foreground'}`}>{k.val}{k.suffix}</div>
            <div className="text-[10px] text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Station Heatmap */}
      <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-indigo-100">
        {d.stationen.map((s) => {
          const lvl = heatLevel(s.auslastung_pct);
          const cls = HEAT_COLOR[lvl];
          return (
            <div key={s.station} className={`rounded-lg px-2 py-2 ${cls} flex items-center gap-2`}>
              <span className="text-lg">{s.emoji}</span>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{s.label}</div>
                <div className="text-[10px] font-mono">{s.auslastung_pct}%{s.kritisch_count > 0 ? ` · ⚠${s.kritisch_count}` : ''}</div>
                <div className="mt-1 h-1 rounded-full bg-black/10">
                  <div className="h-1 rounded-full bg-current" style={{ width: `${s.auslastung_pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nächstes fertig */}
      {d.naechstes_fertig && (
        <div className="flex items-center gap-2 px-4 py-2 bg-matcha-50 border-b border-matcha-200 text-matcha-700 text-xs font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Nächstes fertig: <strong>{d.naechstes_fertig}</strong>
        </div>
      )}

      {/* Order Cards */}
      {loading ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground animate-pulse">Lade Daten…</div>
      ) : (
        <div className="p-3 space-y-2">
          {active.map((o) => {
            const cfg = AMPEL_CONFIG[o.ampel];
            const restSek = Math.max(0, o.restzeit_sek - tick);
            const donePct = o.restzeit_sek > 0 ? Math.min(100, ((o.kochzeit_soll_min * 60 - restSek) / (o.kochzeit_soll_min * 60)) * 100) : 100;
            const barCls = donePct >= 95 ? 'bg-matcha-500' : donePct >= 80 ? 'bg-amber-400' : donePct >= 60 ? 'bg-orange-400' : 'bg-indigo-400';
            return (
              <div key={o.id} className={`rounded-xl border-2 p-3 ${cfg.bg} ${cfg.border} ${cfg.pulse ? 'animate-pulse' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm">{o.nr}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}>{cfg.label}</span>
                    {o.batch && <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-bold">Batch {o.batch}</span>}
                    <span className="text-[10px] text-muted-foreground">{o.station}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {o.fahrer_eta_min != null && o.fahrer_eta_min <= 5 && (
                      <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600">
                        <Zap className="h-3 w-3" />
                        {o.fahrer_eta_min}m
                      </div>
                    )}
                    <span className={`font-black text-base font-mono ${o.ampel === 'super_kritisch' || o.ampel === 'kritisch' ? 'text-red-600' : 'text-foreground'}`}>
                      {fmt(restSek)}
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                    <div className={`h-2 rounded-full transition-all ${barCls}`} style={{ width: `${donePct}%` }} />
                  </div>
                </div>
                {o.ki_tipp && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-indigo-700 font-medium">
                    <Flame className="h-3 w-3 text-orange-500" />
                    {o.ki_tipp}
                  </div>
                )}
                {o.batch_eff_pct != null && (
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    Batch-Eff: <strong>{o.batch_eff_pct}%</strong>
                  </div>
                )}
              </div>
            );
          })}
          {done.length > 0 && (
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
              <CheckCircle2 className="h-3 w-3 text-matcha-500" />
              {done.length} fertig: {done.map((o) => o.nr).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
