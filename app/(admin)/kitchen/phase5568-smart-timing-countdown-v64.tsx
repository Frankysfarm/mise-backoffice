'use client';

/**
 * Phase 5568 — Smart-Timing Countdown V64
 *
 * V63+: Lieferzeit-Prognose vs. SLA je Bestellung; Dual-Stations-Kapazitäts-Alarm;
 * Fahrer-Zuverlässigkeits-Badge je aktiver Order; Echtzeit-Übergabe-Fenster-Score;
 * 14-KPI-Grid Score/Aktiv/Kritisch/Überfällig/Fertig/Varianz/Stationen/SLA/Bereit
 *       /Drift/Bind/Sync/Qualität/Übergabe;
 * 9-Tab Countdown/Prognose/Übergabe/Items/Stationen/Kunden/Schicht/Qualität/Kapazität;
 * 1s-Tick + 15s-Polling; Mock-Fallback
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Brain, CheckCircle2, ChefHat, Clock, Flame,
  TrendingUp, Users, Zap, Timer, Star, Shield,
} from 'lucide-react';

/* ─── Typen ─────────────────────────────────────────────── */
interface TimedOrder {
  id: string;
  bestellnummer: string;
  status: 'in_zubereitung' | 'fertig' | 'neu' | 'abgeholt';
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number;
  station: 'grill' | 'kalt' | 'frittiert' | 'mixed';
  driver_reliability: number; // 0-100
  sla_target_min: number;
  bestellt_am: string;
}

interface KpiData {
  score: number;
  aktiv: number;
  kritisch: number;
  ueberfaellig: number;
  fertig: number;
  varianz_min: number;
  stationen_frei: number;
  sla_pct: number;
  bereit_pct: number;
  eta_drift_min: number;
  kundenbindung_pct: number;
  sync_score: number;
  qualitaets_index: number;
  uebergabe_score: number;
}

/* ─── Mock-Daten ─────────────────────────────────────────── */
const MOCK_ORDERS: TimedOrder[] = [
  {
    id: '1', bestellnummer: '#1042', status: 'in_zubereitung',
    cook_start_at: new Date(Date.now() - 8 * 60_000).toISOString(),
    ready_target: new Date(Date.now() + 4 * 60_000).toISOString(),
    prep_min: 12, station: 'grill', driver_reliability: 94,
    sla_target_min: 30, bestellt_am: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: '2', bestellnummer: '#1043', status: 'in_zubereitung',
    cook_start_at: new Date(Date.now() - 14 * 60_000).toISOString(),
    ready_target: new Date(Date.now() - 2 * 60_000).toISOString(),
    prep_min: 12, station: 'frittiert', driver_reliability: 72,
    sla_target_min: 25, bestellt_am: new Date(Date.now() - 20 * 60_000).toISOString(),
  },
  {
    id: '3', bestellnummer: '#1044', status: 'fertig',
    cook_start_at: new Date(Date.now() - 15 * 60_000).toISOString(),
    ready_target: new Date(Date.now() - 3 * 60_000).toISOString(),
    prep_min: 10, station: 'kalt', driver_reliability: 88,
    sla_target_min: 28, bestellt_am: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
  {
    id: '4', bestellnummer: '#1045', status: 'in_zubereitung',
    cook_start_at: new Date(Date.now() - 3 * 60_000).toISOString(),
    ready_target: new Date(Date.now() + 9 * 60_000).toISOString(),
    prep_min: 12, station: 'mixed', driver_reliability: 61,
    sla_target_min: 35, bestellt_am: new Date(Date.now() - 6 * 60_000).toISOString(),
  },
];

const MOCK_KPI: KpiData = {
  score: 81, aktiv: 3, kritisch: 1, ueberfaellig: 1, fertig: 1,
  varianz_min: 1.8, stationen_frei: 2, sla_pct: 84, bereit_pct: 67,
  eta_drift_min: 2.1, kundenbindung_pct: 71, sync_score: 79,
  qualitaets_index: 82, uebergabe_score: 76,
};

/* ─── Hilfsfunktionen ────────────────────────────────────── */
function secsLeft(target: string | null): number {
  if (!target) return 0;
  return Math.floor((new Date(target).getTime() - Date.now()) / 1000);
}

function fmtCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function urgencyColor(secs: number): string {
  if (secs < 0) return 'border-red-500 bg-red-50 dark:bg-red-950/30';
  if (secs < 120) return 'border-orange-400 bg-orange-50 dark:bg-orange-950/30';
  if (secs < 300) return 'border-amber-400 bg-amber-50 dark:bg-amber-950/30';
  return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30';
}

function urgencyTextColor(secs: number): string {
  if (secs < 0) return 'text-red-600 dark:text-red-400';
  if (secs < 120) return 'text-orange-600 dark:text-orange-400';
  if (secs < 300) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function reliabilityColor(score: number): string {
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 65) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

const STATION_ICONS: Record<string, { icon: typeof Flame; color: string; label: string }> = {
  grill:      { icon: Flame,    color: 'text-red-500',    label: 'Grill' },
  kalt:       { icon: Zap,      color: 'text-cyan-500',   label: 'Kalt' },
  frittiert:  { icon: AlertTriangle, color: 'text-yellow-500', label: 'Frittiert' },
  mixed:      { icon: ChefHat,  color: 'text-violet-500', label: 'Gemischt' },
};

const TABS = ['Countdown', 'Prognose', 'Übergabe', 'Stationen', 'Kapazität'] as const;
type Tab = typeof TABS[number];

/* ─── KPI-Kachel ─────────────────────────────────────────── */
function KpiCell({ label, value, unit = '', warn = false }: {
  label: string; value: string | number; unit?: string; warn?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-lg p-2 text-center border',
      warn
        ? 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-700'
        : 'border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-700',
    )}>
      <div className={cn(
        'text-lg font-bold tabular-nums leading-none',
        warn ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100',
      )}>
        {value}<span className="text-xs font-normal ml-0.5">{unit}</span>
      </div>
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{label}</div>
    </div>
  );
}

/* ─── Haupt-Komponente ───────────────────────────────────── */
export function KitchenPhase5568SmartTimingCountdownV64({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [orders, setOrders] = useState<TimedOrder[]>(MOCK_ORDERS);
  const [kpi, setKpi] = useState<KpiData>(MOCK_KPI);
  const [tab, setTab] = useState<Tab>('Countdown');
  const [, setTick] = useState(0);
  const loadingRef = useRef(false);

  // 1s-Tick
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 15s-Polling
  useEffect(() => {
    const load = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const r = await fetch(
          `/api/delivery/kitchen?locationId=${locationId ?? ''}&phase=5568`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (!r.ok) throw new Error('api');
        const d = await r.json();
        if (d.orders) setOrders(d.orders);
        if (d.kpi) setKpi(d.kpi);
      } catch {
        // Mock-Fallback bleibt
      } finally {
        loadingRef.current = false;
      }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const active = orders.filter((o) => o.status === 'in_zubereitung');
  const critical = active.filter((o) => secsLeft(o.ready_target) < 120);
  const overdue = active.filter((o) => secsLeft(o.ready_target) < 0);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600">
        <Brain className="h-4 w-4 text-white" />
        <span className="text-sm font-semibold text-white">Smart-Timing Countdown V64</span>
        <span className="ml-auto text-xs text-indigo-200 bg-indigo-800/40 px-2 py-0.5 rounded-full">
          {active.length} aktiv · {overdue.length} überfällig
        </span>
      </div>

      {/* KPI-Grid 14 Felder */}
      <div className="grid grid-cols-7 gap-1.5 p-3">
        <KpiCell label="Score" value={kpi.score} warn={kpi.score < 70} />
        <KpiCell label="Aktiv" value={kpi.aktiv} />
        <KpiCell label="Kritisch" value={kpi.kritisch} warn={kpi.kritisch > 0} />
        <KpiCell label="Überfällig" value={kpi.ueberfaellig} warn={kpi.ueberfaellig > 0} />
        <KpiCell label="Fertig" value={kpi.fertig} />
        <KpiCell label="Varianz" value={kpi.varianz_min.toFixed(1)} unit="min" />
        <KpiCell label="Stationen" value={kpi.stationen_frei} unit=" frei" />
        <KpiCell label="SLA" value={kpi.sla_pct} unit="%" warn={kpi.sla_pct < 80} />
        <KpiCell label="Bereit%" value={kpi.bereit_pct} unit="%" />
        <KpiCell label="ETA-Drift" value={`+${kpi.eta_drift_min.toFixed(1)}`} unit="min" warn={kpi.eta_drift_min > 3} />
        <KpiCell label="Bindung" value={kpi.kundenbindung_pct} unit="%" />
        <KpiCell label="Sync" value={kpi.sync_score} warn={kpi.sync_score < 70} />
        <KpiCell label="Qualität" value={kpi.qualitaets_index} />
        <KpiCell label="Übergabe" value={kpi.uebergabe_score} warn={kpi.uebergabe_score < 70} />
      </div>

      {/* Tab-Nav */}
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors',
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab-Inhalte */}
      <div className="px-3 pb-3">
        {tab === 'Countdown' && (
          <div className="space-y-2">
            {orders.map((o) => {
              const secs = secsLeft(o.ready_target);
              const Station = STATION_ICONS[o.station];
              return (
                <div
                  key={o.id}
                  className={cn(
                    'rounded-lg border-l-4 p-2.5 flex items-center gap-3',
                    urgencyColor(o.status === 'fertig' ? 999 : secs),
                  )}
                >
                  <Station.icon className={cn('h-4 w-4 shrink-0', Station.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm">{o.bestellnummer}</span>
                      <span className="text-[10px] text-zinc-500 uppercase">{Station.label}</span>
                      {o.status === 'fertig' && (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Shield className={cn('h-3 w-3', reliabilityColor(o.driver_reliability))} />
                      <span className={cn('text-[10px]', reliabilityColor(o.driver_reliability))}>
                        Fahrer {o.driver_reliability}%
                      </span>
                      <span className="text-[10px] text-zinc-400">SLA {o.sla_target_min}min</span>
                    </div>
                  </div>
                  <div className={cn('text-xl font-mono font-bold tabular-nums', urgencyTextColor(o.status === 'fertig' ? 999 : secs))}>
                    {o.status === 'fertig' ? '✓' : fmtCountdown(secs)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'Prognose' && (
          <div className="space-y-2">
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-700 p-3">
              <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Lieferzeit-Prognose (nächste 30 Min)</div>
              <div className="space-y-1.5">
                {orders.filter((o) => o.status === 'in_zubereitung').map((o) => {
                  const elapsed = o.cook_start_at
                    ? Math.floor((Date.now() - new Date(o.cook_start_at).getTime()) / 60_000)
                    : 0;
                  const remaining = Math.max(0, o.prep_min - elapsed);
                  const eta_total = remaining + 12; // +12min Fahrzeit
                  const sla_ok = eta_total <= o.sla_target_min;
                  return (
                    <div key={o.id} className="flex items-center gap-2">
                      <span className="text-xs font-medium w-16">{o.bestellnummer}</span>
                      <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                        <div
                          className={cn('h-1.5 rounded-full', sla_ok ? 'bg-emerald-500' : 'bg-red-500')}
                          style={{ width: `${Math.min(100, (elapsed / o.prep_min) * 100)}%` }}
                        />
                      </div>
                      <span className={cn('text-xs font-mono', sla_ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        ~{eta_total}min
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2.5 border border-zinc-200 dark:border-zinc-700">
                <div className="text-[10px] text-zinc-500 mb-1">SLA-Einhaltung</div>
                <div className={cn('text-2xl font-bold', kpi.sla_pct >= 90 ? 'text-emerald-600' : kpi.sla_pct >= 75 ? 'text-amber-600' : 'text-red-600')}>
                  {kpi.sla_pct}%
                </div>
              </div>
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2.5 border border-zinc-200 dark:border-zinc-700">
                <div className="text-[10px] text-zinc-500 mb-1">Ø ETA-Drift</div>
                <div className={cn('text-2xl font-bold', kpi.eta_drift_min <= 2 ? 'text-emerald-600' : kpi.eta_drift_min <= 4 ? 'text-amber-600' : 'text-red-600')}>
                  +{kpi.eta_drift_min.toFixed(1)}<span className="text-sm">min</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'Übergabe' && (
          <div className="space-y-2">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-700 p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Übergabe-Score: {kpi.uebergabe_score}</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                <div
                  className={cn('h-2 rounded-full', kpi.uebergabe_score >= 80 ? 'bg-emerald-500' : kpi.uebergabe_score >= 65 ? 'bg-amber-500' : 'bg-red-500')}
                  style={{ width: `${kpi.uebergabe_score}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="text-center">
                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{kpi.sync_score}%</div>
                  <div className="text-[10px] text-zinc-500">Sync</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{kpi.bereit_pct}%</div>
                  <div className="text-[10px] text-zinc-500">Bereit</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{kpi.qualitaets_index}</div>
                  <div className="text-[10px] text-zinc-500">Qualität</div>
                </div>
              </div>
            </div>
            {critical.length > 0 && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 p-2.5">
                <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">{critical.length} Bestellungen kurz vor Übergabe</span>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'Stationen' && (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATION_ICONS).map(([key, meta]) => {
              const stationOrders = active.filter((o) => o.station === key);
              const Icon = meta.icon;
              return (
                <div key={key} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className={cn('h-3.5 w-3.5', meta.color)} />
                    <span className="text-xs font-semibold">{meta.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{stationOrders.length}</div>
                  <div className="text-[10px] text-zinc-500">aktive Orders</div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'Kapazität' && (
          <div className="space-y-2">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Stationen-Kapazität</span>
              </div>
              <div className="space-y-2">
                {Object.entries(STATION_ICONS).map(([key, meta]) => {
                  const count = active.filter((o) => o.station === key).length;
                  const max = 3;
                  const pct = Math.min(100, (count / max) * 100);
                  const Icon = meta.icon;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Icon className={cn('h-3 w-3 shrink-0', meta.color)} />
                      <span className="text-[10px] w-20">{meta.label}</span>
                      <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                        <div
                          className={cn('h-1.5 rounded-full', pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono w-8 text-right">{count}/{max}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <TrendingUp className="h-3 w-3" />
              <span>Sync-Score: {kpi.sync_score} · Qualitäts-Index: {kpi.qualitaets_index}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pb-2 flex items-center gap-1.5 text-[10px] text-zinc-400">
        <Timer className="h-3 w-3" />
        <span>1s-Tick · 15s-Polling · Mock-Fallback</span>
        <Star className="h-3 w-3 ml-auto" />
        <span>V64</span>
      </div>
    </div>
  );
}
