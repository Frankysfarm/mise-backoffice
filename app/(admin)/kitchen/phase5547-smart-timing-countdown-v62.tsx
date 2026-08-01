'use client';

import { useState, useEffect, useRef } from 'react';
import { Timer, AlertCircle, CheckCircle2, ChefHat, Truck, Zap, BarChart2, Moon, TrendingDown, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5547 — Smart-Timing Countdown V62
// V61+: Schichtende-Prognose (verbleibende Kapazität bis Schichtschluss);
// Bestellrückstand-Ampel (grün/gelb/rot je nach offener Bestelllast vs. Kapazität);
// Multi-Stations-Sync-Score (wie gut alle Stationen synchron laufen, 0–100);
// Übergabe-Erfolgsquote live (Übergaben pünktlich / gesamt %);
// 12-KPI-Grid Score/Aktiv/Kritisch/Überfällig/Fertig/Varianz/Stationen/SLA/Bereit/Drift/Bind/Sync;
// 7-Tab Countdown/Prognose/Übergabe/Items/Stationen/Kunden/Schicht; 1s-Tick+15s-Polling; Mock-Fallback

type Tier = 'ok' | 'warn' | 'critical' | 'overdue';
type Tab = 'countdown' | 'prognose' | 'uebergabe' | 'items' | 'stationen' | 'kunden' | 'schicht';
type BridgeStatus = 'synced' | 'drift' | 'lost';
type Station = 'wok' | 'grill' | 'fritteur' | 'salat';
type RueckstandAmpel = 'gruen' | 'gelb' | 'rot';

interface ItemRow { id: string; name: string; kategorie: string; sec_remaining: number }
interface OrderTiming {
  id: string; bestellnummer: string; kunde: string; typ: string;
  seconds_remaining: number; driver_eta_sec: number | null;
  bridge_status: BridgeStatus; sla_breach_in_sec: number | null;
  items: ItemRow[]; station: Station; prio_score: number; prio_reason: string;
  planned_sec: number; status: 'cooking' | 'ready' | 'picked_up';
  stammkunde: boolean; kundenbindungs_score: number; uebergabe_ok: boolean;
}

interface StationLoad {
  station: Station; label: string; active: number; capacity: number;
  avg_sec: number; prognose_20min: number; sync_score: number; engpass: boolean;
}

interface SchichtInfo {
  ende_in_min: number; offene_bestellungen: number; kapazitaet_rest: number;
  rueckstand_ampel: RueckstandAmpel; uebergabe_erfolgsquote_pct: number;
  sync_score: number;
}

const MOCK: OrderTiming[] = [
  { id: 'o1', bestellnummer: 'B-1101', kunde: 'Petra L.', typ: 'Burger', seconds_remaining: 480,
    driver_eta_sec: 420, bridge_status: 'synced', sla_breach_in_sec: 960, station: 'grill',
    prio_score: 89, prio_reason: 'Fahrer nah · SLA ok', planned_sec: 480, status: 'cooking',
    stammkunde: true, kundenbindungs_score: 91, uebergabe_ok: true,
    items: [{ id: 'i1', name: 'Burger Deluxe', kategorie: 'Haupt', sec_remaining: 480 }] },
  { id: 'o2', bestellnummer: 'B-1102', kunde: 'Marc T.', typ: 'Wok', seconds_remaining: 175,
    driver_eta_sec: 600, bridge_status: 'drift', sla_breach_in_sec: 420, station: 'wok',
    prio_score: 97, prio_reason: 'SLA Risiko · Fahrer weit', planned_sec: 300, status: 'cooking',
    stammkunde: false, kundenbindungs_score: 42, uebergabe_ok: false,
    items: [{ id: 'i2', name: 'Wok Gemüse', kategorie: 'Haupt', sec_remaining: 175 }] },
  { id: 'o3', bestellnummer: 'B-1103', kunde: 'Julia W.', typ: 'Salat', seconds_remaining: -95,
    driver_eta_sec: 110, bridge_status: 'synced', sla_breach_in_sec: null, station: 'salat',
    prio_score: 100, prio_reason: 'Überfällig · sofort', planned_sec: 180, status: 'ready',
    stammkunde: true, kundenbindungs_score: 79, uebergabe_ok: true,
    items: [{ id: 'i3', name: 'Caesar Salat', kategorie: 'Vorspeise', sec_remaining: -95 }] },
  { id: 'o4', bestellnummer: 'B-1104', kunde: 'Kai R.', typ: 'Frites', seconds_remaining: 820,
    driver_eta_sec: null, bridge_status: 'lost', sla_breach_in_sec: 1600, station: 'fritteur',
    prio_score: 63, prio_reason: 'Kein Fahrer · SLA ok', planned_sec: 780, status: 'cooking',
    stammkunde: false, kundenbindungs_score: 29, uebergabe_ok: true,
    items: [{ id: 'i4', name: 'Pommes frites', kategorie: 'Haupt', sec_remaining: 820 }] },
];

const MOCK_STATIONS: StationLoad[] = [
  { station: 'grill',    label: 'Grill',    active: 2, capacity: 3, avg_sec: 420, prognose_20min: 88, sync_score: 92, engpass: false },
  { station: 'wok',      label: 'Wok',      active: 2, capacity: 2, avg_sec: 360, prognose_20min: 100, sync_score: 61, engpass: true  },
  { station: 'fritteur', label: 'Fritteur', active: 1, capacity: 2, avg_sec: 300, prognose_20min: 62, sync_score: 84, engpass: false },
  { station: 'salat',    label: 'Salat',    active: 0, capacity: 2, avg_sec: 180, prognose_20min: 18, sync_score: 98, engpass: false },
];

const MOCK_SCHICHT: SchichtInfo = {
  ende_in_min: 73, offene_bestellungen: 3, kapazitaet_rest: 22,
  rueckstand_ampel: 'gelb', uebergabe_erfolgsquote_pct: 87, sync_score: 84,
};

const MOCK_KPI = {
  score: 83, aktiv: 4, kritisch: 1, ueberfaellig: 1, fertig: 2,
  varianz: 1.3, stationen: 4, sla_risiko: 1, bereit: 1, drift: -0.7, bind: 76, sync: 84,
};

const RUECKSTAND_COLOR: Record<RueckstandAmpel, string> = {
  gruen: 'text-emerald-400', gelb: 'text-yellow-400', rot: 'text-red-400',
};

const BRIDGE_CONFIG: Record<BridgeStatus, { label: string; cls: string }> = {
  synced: { label: 'Sync',  cls: 'text-emerald-400' },
  drift:  { label: 'Drift', cls: 'text-yellow-400'  },
  lost:   { label: 'Lost',  cls: 'text-red-400'     },
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
  { key: 'schicht',   label: 'Schicht'   },
];

export function KitchenPhase5547SmartTimingCountdownV62({ locationId }: { locationId: string | null }) {
  const [orders, setOrders] = useState<OrderTiming[]>(MOCK);
  const [stations, setStations] = useState<StationLoad[]>(MOCK_STATIONS);
  const [schicht, setSchicht] = useState<SchichtInfo>(MOCK_SCHICHT);
  const [kpi, setKpi] = useState(MOCK_KPI);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('countdown');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/kitchen/smart-timing-v62?location_id=${locationId}`);
      if (r.ok) {
        const d = await r.json();
        setOrders(d.orders ?? MOCK);
        setStations(d.stations ?? MOCK_STATIONS);
        setSchicht(d.schicht ?? MOCK_SCHICHT);
        setKpi(d.kpi ?? MOCK_KPI);
      }
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
          <Timer className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-bold text-white">Smart-Timing V62</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] font-bold', RUECKSTAND_COLOR[schicht.rueckstand_ampel])}>
            ● {schicht.offene_bestellungen} offen
          </span>
          <span className="text-[10px] text-gray-500">Score: <span className="text-violet-400 font-bold">{kpi.score}</span></span>
        </div>
      </div>

      {/* 12-KPI-Grid */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: 'Aktiv',    val: kpi.aktiv,        cls: 'text-blue-400' },
          { label: 'Kritisch', val: kpi.kritisch,     cls: 'text-orange-400' },
          { label: 'Überfäll.',val: kpi.ueberfaellig, cls: 'text-red-400' },
          { label: 'Fertig',   val: kpi.fertig,       cls: 'text-emerald-400' },
          { label: 'Varianz',  val: `${kpi.varianz}σ`, cls: 'text-purple-400' },
          { label: 'Station.', val: kpi.stationen,    cls: 'text-cyan-400' },
          { label: 'SLA-Risk', val: kpi.sla_risiko,   cls: 'text-yellow-400' },
          { label: 'Bereit',   val: kpi.bereit,       cls: 'text-teal-400' },
          { label: 'Drift',    val: `${kpi.drift}σ`,  cls: 'text-pink-400' },
          { label: 'Bindung',  val: `${kpi.bind}%`,   cls: 'text-rose-400' },
          { label: 'Sync',     val: kpi.sync,         cls: 'text-indigo-400' },
          { label: 'Score',    val: kpi.score,        cls: 'text-violet-400' },
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
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
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
                  {!o.uebergabe_ok && <span className="text-[9px] text-red-400">⚠ Überg.</span>}
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
                <div className={cn('h-2 rounded-full transition-all', s.engpass ? 'bg-red-500' : 'bg-violet-500')}
                  style={{ width: `${s.prognose_20min}%` }} />
              </div>
              <span className="text-[10px] text-gray-300 w-8 text-right">{s.prognose_20min}%</span>
              {s.engpass && <span className="text-[9px] text-red-400">⚠</span>}
            </div>
          ))}
          <div className="text-[9px] text-gray-500 pt-1">Auslastungs-Prognose +20 Min je Station</div>
        </div>
      )}

      {tab === 'uebergabe' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between rounded bg-gray-800 px-2 py-1">
            <span className="text-[10px] text-gray-400">Übergabe-Erfolgsquote</span>
            <span className={cn('text-xs font-bold', schicht.uebergabe_erfolgsquote_pct >= 90 ? 'text-emerald-400' : schicht.uebergabe_erfolgsquote_pct >= 75 ? 'text-yellow-400' : 'text-red-400')}>
              {schicht.uebergabe_erfolgsquote_pct}%
            </span>
          </div>
          {sorted.filter(o => o.status !== 'picked_up').map(o => (
            <div key={o.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
              <span className="text-[10px] text-gray-400 w-14">{o.bestellnummer}</span>
              <span className="flex-1 text-[10px] text-gray-300">{o.typ}</span>
              <span className={cn('text-[9px] rounded px-1', o.uebergabe_ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                {o.uebergabe_ok ? '✓ OK' : '⚠ Risk'}
              </span>
            </div>
          ))}
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
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-gray-400">{s.active}/{s.capacity}</span>
                  <span className={cn('text-[9px]', s.sync_score >= 85 ? 'text-emerald-400' : s.sync_score >= 65 ? 'text-yellow-400' : 'text-red-400')}>
                    Sync {s.sync_score}
                  </span>
                  {s.engpass && <span className="text-[9px] text-red-400">⚠</span>}
                </div>
              </div>
              <div className="flex-1 h-1.5 rounded-full bg-gray-700">
                <div className={cn('h-1.5 rounded-full', s.engpass ? 'bg-red-500' : s.active / s.capacity > 0.7 ? 'bg-yellow-400' : 'bg-emerald-500')}
                  style={{ width: `${(s.active / s.capacity) * 100}%` }} />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded bg-indigo-900/30 px-2 py-1 mt-1">
            <span className="text-[9px] text-gray-400">Multi-Stations-Sync</span>
            <span className={cn('text-xs font-bold', schicht.sync_score >= 85 ? 'text-emerald-400' : schicht.sync_score >= 65 ? 'text-yellow-400' : 'text-red-400')}>
              {schicht.sync_score}/100
            </span>
          </div>
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
                  <div className="h-1.5 rounded-full bg-rose-400" style={{ width: `${o.kundenbindungs_score}%` }} />
                </div>
                <span className="text-[9px] text-rose-400">{o.kundenbindungs_score}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'schicht' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded bg-gray-800 p-2 text-center">
              <div className="text-[9px] text-gray-500">Schicht-Ende in</div>
              <div className="text-sm font-bold text-violet-400">{schicht.ende_in_min} Min</div>
            </div>
            <div className="rounded bg-gray-800 p-2 text-center">
              <div className="text-[9px] text-gray-500">Restkapazität</div>
              <div className="text-sm font-bold text-cyan-400">{schicht.kapazitaet_rest} Bstl.</div>
            </div>
            <div className="rounded bg-gray-800 p-2 text-center">
              <div className="text-[9px] text-gray-500">Übergabe-Erfolg</div>
              <div className={cn('text-sm font-bold', schicht.uebergabe_erfolgsquote_pct >= 90 ? 'text-emerald-400' : 'text-yellow-400')}>
                {schicht.uebergabe_erfolgsquote_pct}%
              </div>
            </div>
            <div className="rounded bg-gray-800 p-2 text-center">
              <div className="text-[9px] text-gray-500">Rückstand</div>
              <div className={cn('text-sm font-bold', RUECKSTAND_COLOR[schicht.rueckstand_ampel])}>
                {schicht.rueckstand_ampel === 'gruen' ? 'OK' : schicht.rueckstand_ampel === 'gelb' ? 'Mittel' : 'Hoch'}
              </div>
            </div>
          </div>
          <div className="text-[9px] text-gray-500 text-center">Schichtende-Prognose · Bestellrückstand-Ampel</div>
        </div>
      )}
    </Card>
  );
}
