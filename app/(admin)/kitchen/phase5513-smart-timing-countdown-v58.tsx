'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, Flame, ChefHat, Truck, AlertCircle, CheckCircle2, ArrowRightLeft, Zap, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5513 — Smart-Timing Countdown V58
// V57+: Küchen↔Dispatch Bridge Score (Sync-Status grün/gelb/rot);
// Dual-ETA-Sync-Ring: Küche-Restzeit vs. Fahrer-ETA nebeneinander;
// SLA-Commitment-Band: Überfälligkeits-Prognose +5/+10/+15min;
// Item-Level-Countdown mit Kategorie-Icon;
// 8-KPI-Grid Score/Aktiv/Kritisch/Überfällig/Fertig/Bridge/SLA/Velocity;
// 4-Tab Countdown/Bridge/SLA/Items; 1s-Tick + 15s-Polling; Mock-Fallback

type Tier = 'ok' | 'warn' | 'critical' | 'overdue';
type Tab = 'countdown' | 'bridge' | 'sla' | 'items';
type Kategorie = 'vorspeise' | 'hauptgang' | 'nachtisch' | 'getraenk';
type BridgeStatus = 'synced' | 'drift' | 'lost';

interface ItemRow { id: string; name: string; kategorie: Kategorie; sec_remaining: number }
interface OrderTiming {
  id: string;
  bestellnummer: string;
  kunde: string;
  seconds_remaining: number;
  driver_eta_sec: number | null;
  bridge_status: BridgeStatus;
  sla_breach_in_sec: number | null;
  items: ItemRow[];
  status: 'cooking' | 'ready' | 'picked_up';
}

const MOCK: OrderTiming[] = [
  {
    id: 'o1', bestellnummer: 'B-1061', kunde: 'Petra L.', seconds_remaining: 680, driver_eta_sec: 540,
    bridge_status: 'synced', sla_breach_in_sec: 1200,
    items: [{ id: 'i1', name: 'Burger Deluxe', kategorie: 'hauptgang', sec_remaining: 680 }, { id: 'i2', name: 'Cola', kategorie: 'getraenk', sec_remaining: 120 }],
    status: 'cooking',
  },
  {
    id: 'o2', bestellnummer: 'B-1062', kunde: 'Marc T.', seconds_remaining: 310, driver_eta_sec: 700,
    bridge_status: 'drift', sla_breach_in_sec: 600,
    items: [{ id: 'i3', name: 'Caesar Salat', kategorie: 'vorspeise', sec_remaining: 90 }, { id: 'i4', name: 'Pizza Margherita', kategorie: 'hauptgang', sec_remaining: 310 }],
    status: 'cooking',
  },
  {
    id: 'o3', bestellnummer: 'B-1063', kunde: 'Julia W.', seconds_remaining: -120, driver_eta_sec: 180,
    bridge_status: 'synced', sla_breach_in_sec: null,
    items: [{ id: 'i5', name: 'Tiramisu', kategorie: 'nachtisch', sec_remaining: -120 }],
    status: 'ready',
  },
  {
    id: 'o4', bestellnummer: 'B-1064', kunde: 'Kai R.', seconds_remaining: 920, driver_eta_sec: null,
    bridge_status: 'lost', sla_breach_in_sec: 1800,
    items: [{ id: 'i6', name: 'Pasta Bolognese', kategorie: 'hauptgang', sec_remaining: 920 }],
    status: 'cooking',
  },
  {
    id: 'o5', bestellnummer: 'B-1065', kunde: 'Anna M.', seconds_remaining: 150, driver_eta_sec: 200,
    bridge_status: 'drift', sla_breach_in_sec: 300,
    items: [{ id: 'i7', name: 'Falafel Bowl', kategorie: 'hauptgang', sec_remaining: 150 }, { id: 'i8', name: 'Latte', kategorie: 'getraenk', sec_remaining: 50 }],
    status: 'cooking',
  },
];

const KATEGORIE_ICON: Record<Kategorie, string> = { vorspeise: '🥗', hauptgang: '🍽️', nachtisch: '🍮', getraenk: '🥤' };
const BRIDGE_CONFIG: Record<BridgeStatus, { label: string; cls: string; dot: string }> = {
  synced: { label: 'Sync',  cls: 'text-emerald-400', dot: 'bg-emerald-400' },
  drift:  { label: 'Drift', cls: 'text-yellow-400',  dot: 'bg-yellow-400'  },
  lost:   { label: 'Lost',  cls: 'text-red-400',     dot: 'bg-red-400'     },
};

function getTier(sec: number): Tier {
  if (sec > 600) return 'ok';
  if (sec > 300) return 'warn';
  if (sec >= 0) return 'critical';
  return 'overdue';
}

const TIER_STYLES: Record<Tier, { ring: string; text: string; bg: string; label: string }> = {
  ok:       { ring: 'ring-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'OK' },
  warn:     { ring: 'ring-yellow-400',  text: 'text-yellow-300',  bg: 'bg-yellow-400/10',  label: 'Bald' },
  critical: { ring: 'ring-red-500',     text: 'text-red-400',     bg: 'bg-red-500/10',     label: 'Kritisch' },
  overdue:  { ring: 'ring-red-600',     text: 'text-red-300',     bg: 'bg-red-600/15',     label: 'Überfällig' },
};

function fmtSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

function DualEtaRing({ cookSec, driverSec }: { cookSec: number; driverSec: number | null }) {
  const r = 22; const circ = 2 * Math.PI * r;
  const maxSec = 1200;
  const cookFrac = Math.max(0, Math.min(1, cookSec / maxSec));
  const drFrac = driverSec != null ? Math.max(0, Math.min(1, driverSec / maxSec)) : null;
  const cookColor = cookSec <= 0 ? '#22c55e' : cookSec < 300 ? '#ef4444' : cookSec < 600 ? '#eab308' : '#6366f1';
  const syncOk = driverSec != null && Math.abs(cookSec - driverSec) < 120;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="56" height="56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={cookColor} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - cookFrac)}
          strokeLinecap="round" transform="rotate(-90 28 28)" />
        {drFrac != null && (
          <circle cx="28" cy="28" r={r - 6} fill="none" stroke={syncOk ? '#22c55e' : '#f59e0b'} strokeWidth="3"
            strokeDasharray={2 * Math.PI * (r - 6)} strokeDashoffset={2 * Math.PI * (r - 6) * (1 - drFrac)}
            strokeLinecap="round" transform="rotate(-90 28 28)" opacity="0.7" />
        )}
        <text x="28" y="26" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="bold" fill={cookColor}>
          {fmtSec(cookSec)}
        </text>
        {driverSec != null && (
          <text x="28" y="36" textAnchor="middle" dominantBaseline="central" fontSize="6" fill={syncOk ? '#22c55e' : '#f59e0b'}>
            🚴{fmtSec(driverSec)}
          </text>
        )}
      </svg>
      <span className={cn('text-[9px]', syncOk ? 'text-emerald-400' : driverSec == null ? 'text-zinc-500' : 'text-yellow-400')}>
        {driverSec == null ? 'kein Fahrer' : syncOk ? 'Sync ✓' : 'Drift!'}
      </span>
    </div>
  );
}

interface Props { locationId: string | null; className?: string }

export function KitchenPhase5513SmartTimingCountdownV58({ locationId, className }: Props) {
  const [orders, setOrders] = useState<OrderTiming[]>(MOCK);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('countdown');

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/kitchen/timing?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.orders)) setOrders(json.orders);
      }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 15_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const ticked = orders.map(o => ({
    ...o,
    seconds_remaining: o.status === 'cooking' ? o.seconds_remaining - tick : o.seconds_remaining,
    driver_eta_sec: o.driver_eta_sec != null && o.status !== 'picked_up' ? o.driver_eta_sec - tick : o.driver_eta_sec,
    items: o.items.map(it => ({ ...it, sec_remaining: it.sec_remaining - tick })),
    sla_breach_in_sec: o.sla_breach_in_sec != null ? o.sla_breach_in_sec - tick : null,
  }));

  const active = ticked.filter(o => o.status === 'cooking').length;
  const critical = ticked.filter(o => o.status === 'cooking' && getTier(o.seconds_remaining) === 'critical').length;
  const overdue = ticked.filter(o => getTier(o.seconds_remaining) === 'overdue').length;
  const ready = ticked.filter(o => o.status === 'ready').length;
  const syncedBridge = ticked.filter(o => o.bridge_status === 'synced').length;
  const slaRisk = ticked.filter(o => o.sla_breach_in_sec != null && o.sla_breach_in_sec < 600).length;
  const velocity = Math.round((ready / Math.max(1, ticked.length)) * 100);
  const bridgeScore = Math.round((syncedBridge / Math.max(1, ticked.length)) * 100);

  const kpiGrid = [
    { label: 'Bridge', value: `${bridgeScore}%`, alert: bridgeScore < 70 },
    { label: 'Aktiv', value: String(active), alert: active > 8 },
    { label: 'Kritisch', value: String(critical), alert: critical > 0 },
    { label: 'Überfällig', value: String(overdue), alert: overdue > 0 },
    { label: 'Fertig', value: String(ready), alert: false },
    { label: 'SLA-Risiko', value: String(slaRisk), alert: slaRisk > 0 },
    { label: 'Sync', value: String(syncedBridge), alert: false },
    { label: 'Velocity', value: `${velocity}%`, alert: velocity < 60 },
  ];

  const TABS: { key: Tab; label: string }[] = [
    { key: 'countdown', label: 'Countdown' },
    { key: 'bridge', label: 'Bridge' },
    { key: 'sla', label: 'SLA' },
    { key: 'items', label: 'Items' },
  ];

  return (
    <Card className={cn('bg-zinc-900 border-zinc-700/50 p-4 space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-xs font-semibold text-zinc-100">Smart-Timing V58</span>
        <span className="ml-auto text-[10px] text-zinc-500">Küche↔Dispatch Bridge</span>
        {overdue > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />{overdue} überfällig
          </span>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {kpiGrid.map(k => (
          <div key={k.label} className={cn('rounded-md px-2 py-1.5 text-center', k.alert ? 'bg-red-500/10 ring-1 ring-red-500/30' : 'bg-zinc-800')}>
            <p className={cn('text-sm font-bold', k.alert ? 'text-red-400' : 'text-zinc-100')}>{k.value}</p>
            <p className="text-[9px] text-zinc-500 leading-none mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex-1 text-[10px] py-1 rounded-md transition-colors',
              tab === t.key ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'countdown' && (
        <div className="space-y-2">
          {ticked.filter(o => o.status !== 'picked_up').map(o => {
            const tier = getTier(o.seconds_remaining);
            const ts = TIER_STYLES[tier];
            return (
              <div key={o.id} className={cn('rounded-lg px-3 py-2 ring-1 flex items-center gap-3', ts.bg, ts.ring)}>
                <DualEtaRing cookSec={o.seconds_remaining} driverSec={o.driver_eta_sec} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-100 truncate">{o.bestellnummer} · {o.kunde}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('text-[10px] font-medium', ts.text)}>{ts.label}</span>
                    <span className={cn('text-[10px]', BRIDGE_CONFIG[o.bridge_status].cls)}>
                      <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-0.5', BRIDGE_CONFIG[o.bridge_status].dot)} />
                      {BRIDGE_CONFIG[o.bridge_status].label}
                    </span>
                  </div>
                </div>
                {o.status === 'ready' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              </div>
            );
          })}
          {ticked.filter(o => o.status !== 'picked_up').length === 0 && (
            <p className="text-center text-xs text-zinc-500 py-3">Keine aktiven Bestellungen</p>
          )}
        </div>
      )}

      {tab === 'bridge' && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {(['synced', 'drift', 'lost'] as BridgeStatus[]).map(bs => {
              const count = ticked.filter(o => o.bridge_status === bs).length;
              const cfg = BRIDGE_CONFIG[bs];
              return (
                <div key={bs} className="bg-zinc-800 rounded-lg p-3 text-center">
                  <p className={cn('text-xl font-bold', cfg.cls)}>{count}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{cfg.label}</p>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-500 text-center">Bridge-Score: {bridgeScore}% · Ziel &gt;85%</p>
          <div className="space-y-1.5">
            {ticked.map(o => (
              <div key={o.id} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-1.5">
                <span className={cn('w-2 h-2 rounded-full shrink-0', BRIDGE_CONFIG[o.bridge_status].dot)} />
                <span className="text-xs text-zinc-200 flex-1">{o.bestellnummer}</span>
                <span className={cn('text-[10px]', BRIDGE_CONFIG[o.bridge_status].cls)}>
                  {BRIDGE_CONFIG[o.bridge_status].label}
                </span>
                <ArrowRightLeft className="w-3 h-3 text-zinc-600" />
                <span className="text-[10px] text-zinc-400">
                  {o.driver_eta_sec != null ? `🚴 ${fmtSec(o.driver_eta_sec)}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'sla' && (
        <div className="space-y-2">
          {slaRisk > 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-300">{slaRisk} Bestellung{slaRisk > 1 ? 'en' : ''} nähert sich dem SLA-Limit</span>
            </div>
          )}
          <div className="space-y-1.5">
            {ticked.map(o => {
              const sla = o.sla_breach_in_sec;
              const color = sla == null ? 'text-emerald-400' : sla < 300 ? 'text-red-400' : sla < 600 ? 'text-yellow-400' : 'text-emerald-400';
              const pct = sla != null ? Math.max(0, Math.min(100, (sla / 1800) * 100)) : 100;
              return (
                <div key={o.id} className="bg-zinc-800 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-200">{o.bestellnummer} · {o.kunde}</span>
                    <span className={cn('text-xs font-medium', color)}>
                      {sla == null ? 'SLA OK ✓' : `Breach in ${fmtSec(sla)}`}
                    </span>
                  </div>
                  <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', sla == null ? 'bg-emerald-500' : sla < 300 ? 'bg-red-500' : sla < 600 ? 'bg-yellow-500' : 'bg-emerald-500')}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'items' && (
        <div className="space-y-2">
          {ticked.flatMap(o => o.items).map(item => {
            const tier = getTier(item.sec_remaining);
            const ts = TIER_STYLES[tier];
            return (
              <div key={item.id} className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5 ring-1', ts.bg, ts.ring)}>
                <span className="text-base">{KATEGORIE_ICON[item.kategorie]}</span>
                <span className="flex-1 text-xs text-zinc-200 truncate">{item.name}</span>
                <span className={cn('text-xs font-mono font-semibold', ts.text)}>{fmtSec(item.sec_remaining)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
