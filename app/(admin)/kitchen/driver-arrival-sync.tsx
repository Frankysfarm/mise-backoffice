'use client';

/**
 * KitchenDriverArrivalSync
 * Synchronisiert Küchenbestellungen mit der Fahrerankunftszeit.
 * Zeigt für jede Bestellung in Zubereitung eine farbkodierte Karte:
 *   GRÜN  → fertig bevor Fahrer ankommt (>5 Min Vorlauf)
 *   AMBER → gerade rechtzeitig fertig (2–5 Min Vorlauf)
 *   ROT   → gefährdet, Bestellung evtl. nicht rechtzeitig fertig (<2 Min)
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  GitMerge,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Bike,
  User,
  MapPin,
  Timer,
} from 'lucide-react';

// ─── Typen ───────────────────────────────────────────────────────────────────

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  geschaetzte_zubereitung_min: number | null;
  bestellt_am: string | null;
  fertig_am: string | null;
  delivery_zone: string | null;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  status: {
    ist_online: boolean;
    aktueller_batch_id: string | null;
    last_update: string | null;
  } | null;
};

type SyncStatus = 'green' | 'amber' | 'red';

type OrderSyncInfo = {
  order: Order;
  secsRemaining: number;
  isOverdue: boolean;
  syncStatus: SyncStatus;
  /** Sekunden, um die die Bestellung früher (positiv) oder später (negativ)
   *  fertig ist als der geschätzte Fahrerankunftszeitpunkt. */
  leadTimeSecs: number;
};

// ─── Konstanten ───────────────────────────────────────────────────────────────

/** Typische Fahrtzeit Fahrer → Restaurant, falls keine Echtzeitdaten vorliegen */
const DEFAULT_DRIVER_ARRIVAL_SECS = 8 * 60; // 8 Minuten

const SYNC_META: Record<
  SyncStatus,
  {
    border: string;
    bg: string;
    headerBg: string;
    badgeBg: string;
    badgeText: string;
    text: string;
    barColor: string;
    label: string;
    subLabel: string;
    icon: React.ElementType;
  }
> = {
  green: {
    border: 'border-matcha-400',
    bg: 'bg-matcha-50',
    headerBg: 'bg-matcha-50',
    badgeBg: 'bg-matcha-100',
    badgeText: 'text-matcha-700',
    text: 'text-matcha-700',
    barColor: 'bg-matcha-500',
    label: 'Im Zeitplan',
    subLabel: '> 5 Min Vorlauf',
    icon: CheckCircle2,
  },
  amber: {
    border: 'border-amber-400',
    bg: 'bg-amber-50',
    headerBg: 'bg-amber-50',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    text: 'text-amber-700',
    barColor: 'bg-amber-400',
    label: 'Knapp',
    subLabel: '2–5 Min Vorlauf',
    icon: Clock,
  },
  red: {
    border: 'border-red-400',
    bg: 'bg-red-50',
    headerBg: 'bg-red-50',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    text: 'text-red-700',
    barColor: 'bg-red-500',
    label: 'Gefährdet',
    subLabel: '< 2 Min – Eile!',
    icon: AlertTriangle,
  },
};

// ─── Interner Tick-Hook (1-Sekunden-Intervall) ────────────────────────────────

function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(iv);
  }, []);
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatCountdown(secsLeft: number): string {
  const abs = Math.abs(Math.floor(secsLeft));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secsLeft < 0 ? '+' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function computeSecsRemaining(order: Order, now: number): number {
  if (order.fertig_am) return 0;
  const prepSecs = (order.geschaetzte_zubereitung_min ?? 15) * 60;
  if (!order.bestellt_am) return prepSecs;
  const elapsedSecs = (now - new Date(order.bestellt_am).getTime()) / 1_000;
  return prepSecs - elapsedSecs;
}

/** Schätzt die Ankunftszeit des Fahrers in Sekunden basierend auf verfügbaren Fahrern. */
function estimateDriverArrivalSecs(drivers: Driver[]): number {
  const online = drivers.filter((d) => d.status?.ist_online);
  const free   = online.filter((d) => !d.status?.aktueller_batch_id);
  if (free.length > 0) return 4 * 60;   // freier Fahrer → ca. 4 Min
  if (online.length > 0) return 8 * 60; // beschäftigt → ca. 8 Min
  return 12 * 60;                        // kein Fahrer → konservative Schätzung
}

function computeSyncStatus(leadTimeSecs: number): SyncStatus {
  if (leadTimeSecs > 5 * 60)  return 'green';
  if (leadTimeSecs >= 2 * 60) return 'amber';
  return 'red';
}

// ─── Einzelne Bestell-Karte ───────────────────────────────────────────────────

function SyncCard({ info }: { info: OrderSyncInfo }) {
  useTick();

  const { order, secsRemaining, isOverdue, syncStatus, leadTimeSecs } = info;
  const meta = SYNC_META[syncStatus];
  const Icon = meta.icon;

  const absLeadMin = Math.round(Math.abs(leadTimeSecs) / 60);
  const leadSign   = leadTimeSecs < 0 ? '-' : '+';

  // Zubereitungsfortschritt 0–100 %
  const prepTotal = (order.geschaetzte_zubereitung_min ?? 15) * 60;
  const elapsed   = Math.max(0, prepTotal - secsRemaining);
  const progressPct = prepTotal > 0
    ? Math.min(100, Math.max(0, (elapsed / prepTotal) * 100))
    : 0;

  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 p-3 flex flex-col gap-2.5 transition-all duration-300',
        meta.border,
        meta.bg,
        syncStatus === 'red' && isOverdue && 'animate-pulse',
      )}
    >
      {/* Status-Badge + Zone */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black',
            meta.badgeBg,
            meta.badgeText,
          )}
        >
          <Icon className="h-3 w-3 shrink-0" />
          {meta.label}
        </span>
        {order.delivery_zone && (
          <span className="flex items-center gap-0.5 rounded-full bg-white/70 border px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground shrink-0">
            <MapPin className="h-2.5 w-2.5" />
            Zone&nbsp;{order.delivery_zone}
          </span>
        )}
      </div>

      {/* Countdown + Bestellinfo */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center shrink-0">
          <span className={cn('font-mono text-2xl font-black tabular-nums leading-none', meta.text)}>
            {formatCountdown(secsRemaining)}
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground mt-0.5 uppercase tracking-wide">
            {isOverdue ? 'Überfällig!' : 'verbleibend'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-black truncate">{order.bestellnummer}</div>
          <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
            <User className="h-2.5 w-2.5 shrink-0" />
            {order.kunde_name}
          </div>
        </div>
      </div>

      {/* Fahrer-Vorlauf-Indikator */}
      <div className={cn('flex items-center justify-between rounded-lg px-2 py-1.5', meta.badgeBg)}>
        <div className="flex items-center gap-1 text-[10px] font-bold">
          <Bike className="h-3 w-3 shrink-0" />
          <span className="text-muted-foreground">Fahrer-Vorlauf:</span>
        </div>
        <span className={cn('font-mono text-[11px] font-black tabular-nums', meta.text)}>
          {leadSign}{absLeadMin}&nbsp;Min
        </span>
      </div>

      {/* Zubereitungsfortschritt */}
      <div>
        <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
          <span>Zubereitung</span>
          <span>{meta.subLabel}</span>
        </div>
        <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-1000', meta.barColor)}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function KitchenDriverArrivalSync({
  orders,
  drivers,
}: {
  orders: Order[];
  drivers: Driver[];
}) {
  useTick();

  const cookingOrders = orders.filter((o) => o.status === 'in_zubereitung');
  if (cookingOrders.length === 0) return null;

  const now = Date.now();
  const driverArrivalSecs = estimateDriverArrivalSecs(drivers);

  const syncInfos: OrderSyncInfo[] = cookingOrders.map((order) => {
    const secsRemaining = computeSecsRemaining(order, now);
    const isOverdue     = secsRemaining < 0;
    // Vorlaufzeit: positive Zahl = Küche fertig VOR Fahrer
    const leadTimeSecs  = secsRemaining - driverArrivalSecs;
    const syncStatus    = computeSyncStatus(leadTimeSecs);
    return { order, secsRemaining, isOverdue, syncStatus, leadTimeSecs };
  });

  // Sortierung: rot → amber → grün; innerhalb gleicher Status: kürzeste Zeit zuerst
  const sortedInfos = [...syncInfos].sort((a, b) => {
    const priority: SyncStatus[] = ['red', 'amber', 'green'];
    const diff = priority.indexOf(a.syncStatus) - priority.indexOf(b.syncStatus);
    return diff !== 0 ? diff : a.secsRemaining - b.secsRemaining;
  });

  const greenCount  = syncInfos.filter((i) => i.syncStatus === 'green').length;
  const amberCount  = syncInfos.filter((i) => i.syncStatus === 'amber').length;
  const redCount    = syncInfos.filter((i) => i.syncStatus === 'red').length;

  const onlineDrivers    = drivers.filter((d) => d.status?.ist_online).length;
  const availableDrivers = drivers.filter((d) => d.status?.ist_online && !d.status?.aktueller_batch_id).length;

  const overallStatus: SyncStatus = redCount > 0 ? 'red' : amberCount > 0 ? 'amber' : 'green';
  const overallMeta = SYNC_META[overallStatus];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* ── Header ── */}
      <div className={cn('flex items-center gap-2 px-3 py-2.5 border-b', overallMeta.headerBg)}>
        <GitMerge className={cn('h-4 w-4 shrink-0', overallMeta.text)} />
        <span className="text-sm font-black text-foreground">
          Küche &amp; Fahrer-Sync
        </span>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', overallMeta.badgeBg, overallMeta.badgeText)}>
          {cookingOrders.length} in Zubereitung
        </span>

        {/* Fahrer-Kurzinfo */}
        <div className="ml-auto flex items-center gap-1.5">
          <Bike className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground">{onlineDrivers} online</span>
          {availableDrivers > 0 && (
            <span className="rounded-full bg-matcha-100 text-matcha-700 px-1.5 py-0.5 text-[9px] font-black">
              {availableDrivers} frei
            </span>
          )}
          {onlineDrivers === 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[9px] font-black animate-pulse">
              Kein Fahrer online
            </span>
          )}
        </div>
      </div>

      {/* ── Status-Leiste ── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/20 flex-wrap">
        <Timer className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
          Sync-Status
        </span>
        {greenCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black">
            <CheckCircle2 className="h-2.5 w-2.5" />
            {greenCount} im Plan
          </span>
        )}
        {amberCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-black">
            <Clock className="h-2.5 w-2.5" />
            {amberCount} knapp
          </span>
        )}
        {redCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            {redCount} gefährdet
          </span>
        )}
        <span className="ml-auto text-[9px] text-muted-foreground">
          Fahrer-ETA&nbsp;~{Math.round(driverArrivalSecs / 60)}&nbsp;Min
        </span>
      </div>

      {/* ── Karten-Grid ── */}
      <div className="p-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sortedInfos.map((info) => (
          <SyncCard key={info.order.id} info={info} />
        ))}
      </div>

      {/* ── Legende ── */}
      <div className="flex items-center gap-3 flex-wrap px-3 pb-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" />
          &gt; 5 Min Vorlauf
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
          2–5 Min Vorlauf
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
          &lt; 2 Min – Kritisch
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          Live · 1s
        </span>
      </div>
    </div>
  );
}
