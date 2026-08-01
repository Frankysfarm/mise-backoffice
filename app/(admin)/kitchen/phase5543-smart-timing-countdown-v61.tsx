'use client';

import { useState, useEffect, useRef } from 'react';
import { Timer, AlertCircle, CheckCircle2, ChefHat, Truck, Zap, BarChart2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5543 — Smart-Timing Countdown V61
// V60+: Schichtstart-Pünktlichkeit-Indikator je Fahrer (Ampel pünktlich/leicht/verspätet);
// Kundenbindungs-Potential-Score je Bestellung (Stammkunde-Badge);
// Stations-Kapazitäts-Prognose +20min mit Engpass-Alert;
// Optimaler-Übergabe-Zeitfenster-Indikator ±min;
// 11-KPI-Grid Score/Aktiv/Kritisch/Überfällig/Fertig/Varianz/Stationen/SLA/Bereit/Drift/Bind;
// 6-Tab Countdown/Prognose/Übergabe/Items/Stationen/Kunden; 1s-Tick+15s-Polling; Mock-Fallback

type Tier = 'ok' | 'warn' | 'critical' | 'overdue';
type Tab = 'countdown' | 'prognose' | 'uebergabe' | 'items' | 'stationen' | 'kunden';
type BridgeStatus = 'synced' | 'drift' | 'lost';
type Station = 'wok' | 'grill' | 'fritteur' | 'salat';
type FahrerPuenktlichkeit = 'puenktlich' | 'leicht' | 'verspaetet';

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
  stammkunde: boolean;
  kundenbindungs_score: number;
  fahrer_puenktlichkeit: FahrerPuenktlichkeit;
  uebergabe_fenster_min: number;
}

interface StationLoad {
  station: Station;
  label: string;
  active: number;
  capacity: number;
  avg_sec: number;
  prognose_20min: number;
  correction_delta_min: number;
  engpass: boolean;
}

const MOCK: OrderTiming[] = [
  { id: 'o1', bestellnummer: 'B-1091', kunde: 'Petra L.', typ: 'Burger', seconds_remaining: 520, driver_eta_sec: 460,
    bridge_status: 'synced', sla_breach_in_sec: 1080, station: 'grill', prio_score: 88, prio_reason: 'Fahrer nah · SLA ok',
    items: [{ id: 'i1', name: 'Burger Deluxe', kategorie: 'Haupt', sec_remaining: 520 }],
    planned_sec: 480, status: 'cooking', stammkunde: true, kundenbindungs_score: 92, fahrer_puenktlichkeit: 'puenktlich', uebergabe_fenster_min: -1 },
  { id: 'o2', bestellnummer: 'B-1092', kunde: 'Marc T.', typ: 'Wok', seconds_remaining: 190, driver_eta_sec: 620,
    bridge_status: 'drift', sla_breach_in_sec: 460, station: 'wok', prio_score: 96, prio_reason: 'SLA Risiko · Fahrer weit',
    items: [{ id: 'i3', name: 'Wok Gemüse', kategorie: 'Haupt', sec_remaining: 190 }],
    planned_sec: 300, status: 'cooking', stammkunde: false, kundenbindungs_score: 44, fahrer_puenktlichkeit: 'leicht', uebergabe_fenster_min: 2 },
  { id: 'o3', bestellnummer: 'B-1093', kunde: 'Julia W.', typ: 'Salat', seconds_remaining: -90, driver_eta_sec: 120,
    bridge_status: 'synced', sla_breach_in_sec: null, station: 'salat', prio_score: 99, prio_reason: 'Überfällig · sofort',
    items: [{ id: 'i5', name: 'Caesar Salat', kategorie: 'Vorspeise', sec_remaining: -90 }],
    planned_sec: 180, status: 'ready', stammkunde: true, kundenbindungs_score: 78, fahrer_puenktlichkeit: 'verspaetet', uebergabe_fenster_min: 0 },
  { id: 'o4', bestellnummer: 'B-1094', kunde: 'Kai R.', typ: 'Frites', seconds_remaining: 800, driver_eta_sec: null,
    bridge_status: 'lost', sla_breach_in_sec: 1580, station: 'fritteur', prio_score: 62, prio_reason: 'Kein Fahrer · SLA ok',
    items: [{ id: 'i6', name: 'Pommes frites', kategorie: 'Haupt', sec_remaining: 800 }],
    planned_sec: 780, status: 'cooking', stammkunde: false, kundenbindungs_score: 31, fahrer_puenktlichkeit: 'puenktlich', uebergabe_fenster_min: 3 },
];

const MOCK_STATIONS: StationLoad[] = [
  { station: 'grill',    label: 'Grill',    active: 2, capacity: 3, avg_sec: 420, prognose_20min: 90, correction_delta_min: -1, engpass: false },
  { station: 'wok',      label: 'Wok',      active: 2, capacity: 2, avg_sec: 360, prognose_20min: 100, correction_delta_min: +2, engpass: true  },
  { station: 'fritteur', label: 'Fritteur', active: 1, capacity: 2, avg_sec: 300, prognose_20min: 65, correction_delta_min:  0, engpass: false },
  { station: 'salat',    label: 'Salat',    active: 0, capacity: 2, avg_sec: 180, prognose_20min: 20, correction_delta_min: -1, engpass: false },
];

const MOCK_KPI = {
  score: 81, aktiv: 4, kritisch: 1, ueberfaellig: 1, fertig: 2, varianz: 1.4,
  stationen: 4, sla_risiko: 1, bereit: 1, drift: -0.8, bind: 78,
};

const BRIDGE_CONFIG: Record<BridgeStatus, { label: string; cls: string }> = {
  synced: { label: 'Sync',  cls: 'text-emerald-400' },
  drift:  { label: 'Drift', cls: 'text-yellow-400'  },
  lost:   { label: 'Lost',  cls: 'text-red-400'     },
};

const PUENKTLICHKEIT_CONFIG: Record<FahrerPuenktlichkeit, { label: string; cls: string }> = {
  puenktlich: { label: '✓ Pünktl.', cls: 'text-emerald-400' },
  leicht:     { label: '~Leicht',   cls: 'text-yellow-400'  },
  verspaetet: { label: '⚠ Versp.',  cls: 'text-red-400'     },
};

function getTier(sec: number): Tier {
  if (sec > 600) return 'ok';
  if (sec > 300) return 'warn';
  if (sec >= 0)  return 'critical';
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

const TABS: { key: Tab; label: string }[] = [
  { key: 'countdown', label: 'Countdown' },
  { key: 'prognose',  label: 'Prognose'  },
  { key: 'uebergabe', label: 'Übergabe'  },
  { key: 'items',     label: 'Items'     },
  { key: 'stationen', label: 'Stationen' },
  { key: 'kunden',    label: 'Kunden'    },
];

export function KitchenPhase5543SmartTimingCountdownV61({ locationId }: { locationId: string | null }) {
  const [orders, setOrders] = useState<OrderTiming[]>(MOCK);
  const [stations, setStations] = useState<StationLoad[]>(MOCK_STATIONS);
  const [kpi, setKpi] = useState(MOCK_KPI);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('countdown');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/kitchen/smart-timing-v61?location_id=${locationId}`);
      if (r.ok) { const d = await r.json(); setOrders(d.orders ?? MOCK); setStations(d.stations ?? MOCK_STATIONS); setKpi(d.kpi ?? MOCK_KPI); }
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    pollRef.current  = setInterval(load, 15_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current)  clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const live = orders.map(o => ({ ...o, seconds_remaining: o.status === 'cooking' ? o.seconds_remaining - tick : o.seconds_remaining }));
  const sorted = [...live].sort((a, b) => a.seconds_remaining - b.seconds_remaining);

  return (
    <Card className="bg-gray-900 border-gray-700/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-bold text-white">Smart-Timing V61</span>
        </div>
        <span className="text-[10px] text-gray-500">Score: <span className="text-indigo-400 font-bold">{kpi.score}</span></span>
      </div>

      {/* 11-KPI-Grid */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: 'Aktiv',    val: kpi.aktiv,     cls: 'text-blue-400' },
          { label: 'Kritisch', val: kpi.kritisch,  cls: 'text-orange-400' },
          { label: 'Überfäll.', val: kpi.ueberfaellig, cls: 'text-red-400' },
          { label: 'Fertig',   val: kpi.fertig,    cls: 'text-emerald-400' },
          { label: 'Varianz',  val: `${kpi.varianz}σ`, cls: 'text-purple-400' },
          { label: 'Station.', val: kpi.stationen, cls: 'text-cyan-400' },
          { label: 'SLA-Risk', val: kpi.sla_risiko, cls: 'text-yellow-400' },
          { label: 'Bereit',   val: kpi.bereit,    cls: 'text-teal-400' },
          { label: 'Drift',    val: `${kpi.drift}σ`, cls: 'text-pink-400' },
          { label: 'Bindung',  val: `${kpi.bind}%`, cls: 'text-rose-400' },
          { label: 'Score',    val: kpi.score,     cls: 'text-indigo-400' },
        ].map(k => (
          <div key={k.label} className="rounded bg-gray-800 py-1">
            <div className="text-[9px] text-gray-500">{k.label}</div>
            <div className={cn('text-xs font-bold', k.cls)}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn('text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'countdown' && (
        <div className="space-y-1.5">
          {sorted.filter(o => o.status !== 'picked_up').map(o => {
            const tier = getTier(o.seconds_remaining);
            return (
              <div key={o.id} className={cn('rounded p-2 space-y-1', TIER_BG[tier])}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400">{o.bestellnummer}</span>
                    {o.stammkunde && <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1 rounded">Stammkunde</span>}
                    <span className="text-[10px] text-gray-300">{o.kunde}</span>
                  </div>
                  <span className={cn('text-xs font-mono font-bold', TIER_TEXT[tier])}>{fmt(o.seconds_remaining)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-800">
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, (o.seconds_remaining / o.planned_sec) * 100))}%`, backgroundColor: TIER_COLOR[tier] }} />
                  </div>
                  <span className={cn('text-[9px]', BRIDGE_CONFIG[o.bridge_status].cls)}>{BRIDGE_CONFIG[o.bridge_status].label}</span>
                  <span className={cn('text-[9px]', PUENKTLICHKEIT_CONFIG[o.fahrer_puenktlichkeit].cls)}>{PUENKTLICHKEIT_CONFIG[o.fahrer_puenktlichkeit].label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'prognose' && (
        <div className="space-y-1">
          {stations.map(s => (
            <div key={s.station} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-16">{s.label}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-800">
                <div className={cn('h-2 rounded-full transition-all', s.engpass ? 'bg-red-500' : 'bg-indigo-500')}
                  style={{ width: `${s.prognose_20min}%` }} />
              </div>
              <span className="text-[10px] text-gray-300 w-8 text-right">{s.prognose_20min}%</span>
              {s.engpass && <span className="text-[9px] text-red-400">⚠ Engpass</span>}
            </div>
          ))}
          <div className="text-[9px] text-gray-500 pt-1">Auslastungs-Prognose +20 Min je Station</div>
        </div>
      )}

      {tab === 'uebergabe' && (
        <div className="space-y-1">
          {sorted.filter(o => o.status !== 'picked_up').map(o => (
            <div key={o.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
              <span className="text-[10px] text-gray-400 w-14">{o.bestellnummer}</span>
              <span className="flex-1 text-[10px] text-gray-300">{o.typ}</span>
              <span className={cn('text-[10px] font-mono',
                o.uebergabe_fenster_min < 0 ? 'text-emerald-400' : o.uebergabe_fenster_min <= 1 ? 'text-yellow-400' : 'text-orange-400')}>
                {o.uebergabe_fenster_min >= 0 ? `+${o.uebergabe_fenster_min}min` : `${o.uebergabe_fenster_min}min`}
              </span>
            </div>
          ))}
          <div className="text-[9px] text-gray-500 pt-1">Optimales Übergabe-Zeitfenster je Bestellung</div>
        </div>
      )}

      {tab === 'items' && (
        <div className="space-y-1">
          {sorted.flatMap(o => o.items.map(item => (
            <div key={item.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
              <span className="text-[9px] text-gray-500 w-20 truncate">{o.bestellnummer}</span>
              <span className="flex-1 text-[10px] text-white truncate">{item.name}</span>
              <span className="text-[9px] text-gray-400">{item.kategorie}</span>
              <span className={cn('text-[10px] font-mono', getTier(item.sec_remaining) === 'overdue' ? 'text-red-400' : 'text-gray-300')}>
                {fmt(item.sec_remaining)}
              </span>
            </div>
          )))}
        </div>
      )}

      {tab === 'stationen' && (
        <div className="space-y-1">
          {stations.map(s => (
            <div key={s.station} className="rounded bg-gray-800 px-2 py-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white font-medium">{s.label}</span>
                <span className="text-[9px] text-gray-400">{s.active}/{s.capacity} Kapazität</span>
                {s.engpass && <span className="text-[9px] text-red-400">⚠ Engpass</span>}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-700">
                  <div className={cn('h-1.5 rounded-full', s.engpass ? 'bg-red-500' : s.active / s.capacity > 0.7 ? 'bg-yellow-400' : 'bg-emerald-500')}
                    style={{ width: `${(s.active / s.capacity) * 100}%` }} />
                </div>
                <span className={cn('text-[9px] font-mono', s.correction_delta_min !== 0 ? 'text-yellow-400' : 'text-gray-500')}>
                  {s.correction_delta_min > 0 ? `+${s.correction_delta_min}min` : s.correction_delta_min === 0 ? 'ok' : `${s.correction_delta_min}min`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'kunden' && (
        <div className="space-y-1">
          {sorted.filter(o => o.status !== 'picked_up').map(o => (
            <div key={o.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
              <span className="text-[10px] text-gray-400 w-14">{o.bestellnummer}</span>
              <span className="flex-1 text-[10px] text-gray-300 truncate">{o.kunde}</span>
              {o.stammkunde && <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1 rounded">♥ Stamm</span>}
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-12 rounded-full bg-gray-700">
                  <div className="h-1.5 rounded-full bg-rose-400 transition-all" style={{ width: `${o.kundenbindungs_score}%` }} />
                </div>
                <span className="text-[9px] text-rose-400">{o.kundenbindungs_score}</span>
              </div>
            </div>
          ))}
          <div className="text-[9px] text-gray-500 pt-1">Kundenbindungs-Score je Bestellung</div>
        </div>
      )}
    </Card>
  );
}
