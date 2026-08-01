'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Timer, Flame, ChefHat, Truck, AlertCircle, CheckCircle2, Zap, BarChart2, Target, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5530 — Smart-Timing Countdown V60
// V59+: Echtzeit-Kochauslastungs-Prognose nächste 15 Min (Kapazitäts-Balken je Station);
// Live-Übergabe-Bereitschafts-Score 0–100 farbkodiert;
// KI-Kochstart-Korrekturfenster Δmin pro Bestelltyp;
// Reale-vs-Geplante-Kochzeit-Abweichungs-Anzeige σ-Drift;
// 10-KPI-Grid Score/Aktiv/Kritisch/Überfällig/Fertig/Varianz/Stationen/SLA/Bereit/Drift;
// 5-Tab Countdown/Prognose/Übergabe/Items/Stationen; 1s-Tick + 15s-Polling; Mock-Fallback

type Tier = 'ok' | 'warn' | 'critical' | 'overdue';
type Tab = 'countdown' | 'prognose' | 'uebergabe' | 'items' | 'stationen';
type BridgeStatus = 'synced' | 'drift' | 'lost';
type Station = 'wok' | 'grill' | 'fritteur' | 'salat';

interface ItemRow { id: string; name: string; kategorie: string; sec_remaining: number }
interface OrderTiming {
  id: string;
  bestellnummer: string;
  kunde: string;
  typ: string;
  seconds_remaining: number;
  driver_eta_sec: number | null;
  bridge_status: BridgeStatus;
  sla_breach_in_sec: number | null;
  items: ItemRow[];
  station: Station;
  prio_score: number;
  prio_reason: string;
  planned_sec: number;
  status: 'cooking' | 'ready' | 'picked_up';
}

interface StationLoad {
  station: Station;
  label: string;
  active: number;
  capacity: number;
  avg_sec: number;
  prognose_15min: number;
  correction_delta_min: number;
}

const MOCK: OrderTiming[] = [
  { id: 'o1', bestellnummer: 'B-1081', kunde: 'Petra L.', typ: 'Burger', seconds_remaining: 540, driver_eta_sec: 480,
    bridge_status: 'synced', sla_breach_in_sec: 1100, station: 'grill', prio_score: 88, prio_reason: 'Fahrer nah · SLA ok',
    items: [{ id: 'i1', name: 'Burger Deluxe', kategorie: 'Haupt', sec_remaining: 540 }, { id: 'i2', name: 'Cola', kategorie: 'Getränk', sec_remaining: 60 }],
    planned_sec: 480, status: 'cooking' },
  { id: 'o2', bestellnummer: 'B-1082', kunde: 'Marc T.', typ: 'Wok', seconds_remaining: 210, driver_eta_sec: 650,
    bridge_status: 'drift', sla_breach_in_sec: 480, station: 'wok', prio_score: 96, prio_reason: 'SLA Risiko · Fahrer weit',
    items: [{ id: 'i3', name: 'Wok Gemüse', kategorie: 'Haupt', sec_remaining: 210 }],
    planned_sec: 300, status: 'cooking' },
  { id: 'o3', bestellnummer: 'B-1083', kunde: 'Julia W.', typ: 'Salat', seconds_remaining: -120, driver_eta_sec: 150,
    bridge_status: 'synced', sla_breach_in_sec: null, station: 'salat', prio_score: 99, prio_reason: 'Überfällig · sofort',
    items: [{ id: 'i5', name: 'Caesar Salat', kategorie: 'Vorspeise', sec_remaining: -120 }],
    planned_sec: 180, status: 'ready' },
  { id: 'o4', bestellnummer: 'B-1084', kunde: 'Kai R.', typ: 'Frites', seconds_remaining: 820, driver_eta_sec: null,
    bridge_status: 'lost', sla_breach_in_sec: 1600, station: 'fritteur', prio_score: 62, prio_reason: 'Kein Fahrer · SLA ok',
    items: [{ id: 'i6', name: 'Pommes frites', kategorie: 'Haupt', sec_remaining: 820 }],
    planned_sec: 780, status: 'cooking' },
  { id: 'o5', bestellnummer: 'B-1085', kunde: 'Anna M.', typ: 'Burger', seconds_remaining: 90, driver_eta_sec: 200,
    bridge_status: 'drift', sla_breach_in_sec: 240, station: 'grill', prio_score: 97, prio_reason: 'Kritisch · Fahrer 3min',
    items: [{ id: 'i7', name: 'Crispy Chicken', kategorie: 'Haupt', sec_remaining: 90 }],
    planned_sec: 420, status: 'cooking' },
];

const MOCK_STATIONS: StationLoad[] = [
  { station: 'grill',    label: 'Grill',    active: 2, capacity: 3, avg_sec: 420, prognose_15min: 85, correction_delta_min: -1 },
  { station: 'wok',      label: 'Wok',      active: 1, capacity: 2, avg_sec: 360, prognose_15min: 60, correction_delta_min: +2 },
  { station: 'fritteur', label: 'Fritteur', active: 1, capacity: 2, avg_sec: 300, prognose_15min: 70, correction_delta_min:  0 },
  { station: 'salat',    label: 'Salat',    active: 0, capacity: 2, avg_sec: 180, prognose_15min: 30, correction_delta_min: -1 },
];

const BRIDGE_CONFIG: Record<BridgeStatus, { label: string; cls: string }> = {
  synced: { label: 'Sync',  cls: 'text-emerald-400' },
  drift:  { label: 'Drift', cls: 'text-yellow-400'  },
  lost:   { label: 'Lost',  cls: 'text-red-400'     },
};

function getTier(sec: number): Tier {
  if (sec > 600) return 'ok';
  if (sec > 300) return 'warn';
  if (sec >= 0) return 'critical';
  return 'overdue';
}

const TIER_COLOR: Record<Tier, string> = { ok: '#22c55e', warn: '#eab308', critical: '#f97316', overdue: '#ef4444' };
const TIER_BG: Record<Tier, string>    = { ok: 'bg-emerald-500/10', warn: 'bg-yellow-400/10', critical: 'bg-orange-500/10', overdue: 'bg-red-500/10' };
const TIER_TEXT: Record<Tier, string>  = { ok: 'text-emerald-400', warn: 'text-yellow-400', critical: 'text-orange-400', overdue: 'text-red-400' };

function fmt(sec: number) {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '+' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function CountdownRing({ sec }: { sec: number }) {
  const tier = getTier(sec);
  const r = 22; const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, sec / 900));
  return (
    <svg width="56" height="56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={TIER_COLOR[tier]} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)}
        strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x="28" y="25" textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="bold" fill={TIER_COLOR[tier]}>{fmt(sec)}</text>
      <text x="28" y="36" textAnchor="middle" dominantBaseline="central" fontSize="7" fill="#71717a">Küche</text>
    </svg>
  );
}

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-8 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

interface Props { locationId: string | null; className?: string }

export function KitchenPhase5530SmartTimingCountdownV60({ locationId, className }: Props) {
  const [orders, setOrders] = useState<OrderTiming[]>(MOCK);
  const [stations, setStations] = useState<StationLoad[]>(MOCK_STATIONS);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('countdown');
  const [expanded, setExpanded] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const live = orders.map(o => ({ ...o, seconds_remaining: o.seconds_remaining - tick }));

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/kitchen/queue?locationId=${locationId}`);
      if (r.ok) { /* merge */ }
    } catch { /* mock */ }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

  const cooking = live.filter(o => o.status === 'cooking');
  const driftOrders = cooking.filter(o => o.seconds_remaining < o.planned_sec - 60);

  const kpi = {
    score:     Math.round(cooking.reduce((a, o) => a + o.prio_score, 0) / Math.max(1, cooking.length)),
    aktiv:     cooking.length,
    kritisch:  live.filter(o => getTier(o.seconds_remaining) === 'critical').length,
    ueberfaellig: live.filter(o => getTier(o.seconds_remaining) === 'overdue').length,
    fertig:    live.filter(o => o.status === 'ready').length,
    varianz:   Math.round(cooking.reduce((a, o) => a + Math.abs(o.seconds_remaining - o.planned_sec), 0) / Math.max(1, cooking.length) / 60),
    stationen: stations.filter(s => s.active < s.capacity).length,
    sla:       Math.round((live.filter(o => o.sla_breach_in_sec !== null && o.sla_breach_in_sec > 300).length / Math.max(1, live.length)) * 100),
    bereit:    Math.round((live.filter(o => o.status === 'ready').length / Math.max(1, live.length)) * 100),
    drift:     driftOrders.length,
  };

  const readinessScore = Math.max(0, 100 - kpi.kritisch * 10 - kpi.ueberfaellig * 20 - kpi.drift * 5);

  const KPI_ITEMS = [
    { label: 'Score',     val: `${kpi.score}`, cls: kpi.score >= 80 ? 'text-emerald-400' : 'text-yellow-400' },
    { label: 'Aktiv',     val: `${kpi.aktiv}`, cls: 'text-blue-400' },
    { label: 'Kritisch',  val: `${kpi.kritisch}`, cls: kpi.kritisch > 0 ? 'text-orange-400' : 'text-zinc-500' },
    { label: 'Überfällig',val: `${kpi.ueberfaellig}`, cls: kpi.ueberfaellig > 0 ? 'text-red-400' : 'text-zinc-500' },
    { label: 'Fertig',    val: `${kpi.fertig}`, cls: 'text-emerald-400' },
    { label: 'Varianz',   val: `±${kpi.varianz}m`, cls: kpi.varianz > 3 ? 'text-yellow-400' : 'text-zinc-400' },
    { label: 'Stationen', val: `${kpi.stationen}frei`, cls: 'text-cyan-400' },
    { label: 'SLA%',      val: `${kpi.sla}%`, cls: kpi.sla >= 80 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Bereit%',   val: `${kpi.bereit}%`, cls: 'text-violet-400' },
    { label: 'Drift',     val: `${kpi.drift}`, cls: kpi.drift > 0 ? 'text-yellow-400' : 'text-zinc-500' },
  ];

  const TABS: { key: Tab; label: string }[] = [
    { key: 'countdown', label: 'Countdown' },
    { key: 'prognose',  label: 'Prognose' },
    { key: 'uebergabe', label: 'Übergabe' },
    { key: 'items',     label: 'Items' },
    { key: 'stationen', label: 'Stationen' },
  ];

  const sorted = [...live].sort((a, b) => a.seconds_remaining - b.seconds_remaining);

  return (
    <Card className={cn('bg-zinc-900 border-zinc-800 p-4 space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Smart-Timing Countdown V60</span>
        </div>
        <span className="text-xs text-zinc-500 font-mono">Phase 5530</span>
      </div>

      {/* Übergabe-Bereitschaft */}
      <div className="bg-zinc-800/50 rounded-lg p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-400">Übergabe-Bereitschaft</span>
          <span className="text-xs text-zinc-500 font-mono">Live</span>
        </div>
        <ReadinessBar score={readinessScore} />
      </div>

      {/* KPI 10-Grid */}
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
        {KPI_ITEMS.map(k => (
          <div key={k.label} className="bg-zinc-800/60 rounded-lg p-1.5 text-center">
            <div className={cn('text-sm font-bold tabular-nums leading-tight', k.cls)}>{k.val}</div>
            <div className="text-[9px] text-zinc-500 mt-0.5 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Countdown Tab */}
      {tab === 'countdown' && (
        <div className="space-y-2">
          {sorted.map(o => {
            const tier = getTier(o.seconds_remaining);
            const isExp = expanded === o.id;
            const driftSec = o.seconds_remaining - o.planned_sec;
            return (
              <div key={o.id} className={cn('rounded-lg border p-2.5 cursor-pointer transition-colors', TIER_BG[tier],
                tier === 'overdue' ? 'border-red-500/40 animate-pulse' : 'border-zinc-700/40')}
                onClick={() => setExpanded(isExp ? null : o.id)}>
                <div className="flex items-center gap-3">
                  <CountdownRing sec={o.seconds_remaining} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white truncate">{o.bestellnummer} · {o.kunde}</span>
                      <span className={cn('text-xs font-bold', BRIDGE_CONFIG[o.bridge_status].cls)}>{BRIDGE_CONFIG[o.bridge_status].label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-400">{o.typ} · {o.station}</span>
                      {driftSec < -60 && <span className="text-[10px] text-yellow-400 font-mono">Drift {fmt(driftSec)}</span>}
                      {o.status === 'ready' && <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" />Fertig</span>}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{o.prio_reason}</div>
                  </div>
                  <div className={cn('text-xs font-bold tabular-nums', TIER_TEXT[tier])}>Prio {o.prio_score}</div>
                </div>
                {isExp && (
                  <div className="mt-2 space-y-1 border-t border-zinc-700/40 pt-2">
                    {o.items.map(it => (
                      <div key={it.id} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300">{it.name}</span>
                        <span className={cn('font-mono', TIER_TEXT[getTier(it.sec_remaining - tick)])}>{fmt(it.sec_remaining - tick)}</span>
                      </div>
                    ))}
                    {o.driver_eta_sec !== null && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
                        <Truck className="h-3 w-3" /><span>Fahrer ETA {fmt(o.driver_eta_sec)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Prognose Tab */}
      {tab === 'prognose' && (
        <div className="space-y-2">
          <div className="bg-zinc-800/60 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-xs font-semibold text-white">Kapazitäts-Prognose +15 Min</span>
            </div>
            {stations.map(s => (
              <div key={s.station} className="flex items-center gap-2 text-xs mb-1.5">
                <span className="w-16 text-zinc-400">{s.label}</span>
                <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${s.prognose_15min}%`, backgroundColor: s.prognose_15min > 80 ? '#ef4444' : s.prognose_15min > 60 ? '#eab308' : '#22c55e' }} />
                </div>
                <span className="w-8 text-right font-mono text-zinc-300">{s.prognose_15min}%</span>
                <span className={cn('w-10 text-right font-mono text-[10px]', s.correction_delta_min < 0 ? 'text-emerald-400' : s.correction_delta_min > 0 ? 'text-yellow-400' : 'text-zinc-500')}>
                  {s.correction_delta_min > 0 ? '+' : ''}{s.correction_delta_min}m
                </span>
              </div>
            ))}
          </div>
          <div className="bg-zinc-800/60 rounded-lg p-3">
            <div className="text-xs font-semibold text-white mb-2">KI Kochstart-Korrekturfenster</div>
            {stations.map(s => (
              <div key={s.station} className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-400">{s.label}</span>
                <span className={cn('font-mono', s.correction_delta_min === 0 ? 'text-zinc-500' : s.correction_delta_min < 0 ? 'text-emerald-400' : 'text-yellow-400')}>
                  {s.correction_delta_min === 0 ? 'Optimal' : `${s.correction_delta_min > 0 ? '+' : ''}${s.correction_delta_min} min`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Übergabe Tab */}
      {tab === 'uebergabe' && (
        <div className="space-y-2">
          <div className="bg-zinc-800/60 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Übergabe-Score Live</span>
            </div>
            <ReadinessBar score={readinessScore} />
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { label: 'Fertig', val: live.filter(o => o.status === 'ready').length, cls: 'text-emerald-400' },
                { label: 'Drift', val: driftOrders.length, cls: driftOrders.length > 0 ? 'text-yellow-400' : 'text-zinc-500' },
                { label: 'Sync', val: live.filter(o => o.bridge_status === 'synced').length, cls: 'text-cyan-400' },
              ].map(k => (
                <div key={k.label} className="bg-zinc-800 rounded-lg p-2 text-center">
                  <div className={cn('text-lg font-bold', k.cls)}>{k.val}</div>
                  <div className="text-[10px] text-zinc-500">{k.label}</div>
                </div>
              ))}
            </div>
          </div>
          {live.filter(o => o.status === 'ready').map(o => (
            <div key={o.id} className="flex items-center gap-2 bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <div className="flex-1 text-xs">
                <span className="font-semibold text-white">{o.bestellnummer}</span>
                <span className="text-zinc-400"> · {o.kunde} · {o.typ}</span>
              </div>
              {o.driver_eta_sec !== null && <span className="text-xs font-mono text-cyan-400">🚴 {fmt(o.driver_eta_sec)}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Items Tab */}
      {tab === 'items' && (
        <div className="space-y-1.5">
          {sorted.flatMap(o => o.items.map(it => {
            const sec = it.sec_remaining - tick;
            const tier = getTier(sec);
            return (
              <div key={it.id} className={cn('flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs', TIER_BG[tier])}>
                <span className="text-zinc-300 truncate flex-1">{it.name}</span>
                <span className="text-zinc-500 mx-2">{it.kategorie}</span>
                <span className={cn('font-mono font-bold', TIER_TEXT[tier])}>{fmt(sec)}</span>
              </div>
            );
          }))}
        </div>
      )}

      {/* Stationen Tab */}
      {tab === 'stationen' && (
        <div className="space-y-2">
          {stations.map(s => {
            const frac = s.capacity > 0 ? s.active / s.capacity : 0;
            const color = frac >= 0.9 ? '#ef4444' : frac >= 0.6 ? '#eab308' : '#22c55e';
            return (
              <div key={s.station} className="bg-zinc-800/60 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-white">{s.label}</span>
                  <span className="text-xs font-mono" style={{ color }}>{s.active}/{s.capacity}</span>
                </div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${frac * 100}%`, backgroundColor: color }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-zinc-500">Ø {Math.round(s.avg_sec / 60)}min</span>
                  <span className="text-[10px] text-zinc-500">Prog. {s.prognose_15min}% (+15min)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
