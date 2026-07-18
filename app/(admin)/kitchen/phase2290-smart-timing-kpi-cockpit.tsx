'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChefHat, CheckCircle2, ChevronDown, ChevronUp, Clock, Flame, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Typen ─────────────────────────────────────────────────────────────── */
type PrepOrder = {
  order_id: string;
  bestellnummer: string;
  begonnen_am: string;
  ziel_min: number;
  status: 'kocht' | 'warten' | 'fertig';
};

type ApiData = {
  aktive_bestellungen: PrepOrder[];
  avg_prep_min: number;
  on_time_pct: number;
  alert_count: number;
  schicht_ziel_min: number;
};

/* ── Hilfsfunktionen ────────────────────────────────────────────────────── */
function verstricheneMinuten(begonnen_am: string): number {
  return Math.round((Date.now() - new Date(begonnen_am).getTime()) / 60000);
}

type Ampel = 'gruen' | 'gelb' | 'rot';

function getAmpel(verstrich: number, ziel: number): Ampel {
  const ratio = verstrich / ziel;
  if (ratio >= 1.1) return 'rot';
  if (ratio >= 0.85) return 'gelb';
  return 'gruen';
}

const AMPEL_STYLE: Record<Ampel, { bg: string; text: string; bar: string; badge: string }> = {
  gruen: {
    bg:    'bg-green-50 dark:bg-green-950/20',
    text:  'text-green-700 dark:text-green-300',
    bar:   'bg-green-500',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  },
  gelb: {
    bg:    'bg-amber-50 dark:bg-amber-950/20',
    text:  'text-amber-700 dark:text-amber-300',
    bar:   'bg-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
  rot: {
    bg:    'bg-red-50 dark:bg-red-950/20',
    text:  'text-red-700 dark:text-red-300',
    bar:   'bg-red-500',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  },
};

/* ── Countdown-Karte pro Bestellung ─────────────────────────────────────── */
function PrepCard({ order, tick }: { order: PrepOrder; tick: number }) {
  const verstrich = verstricheneMinuten(order.begonnen_am);
  const ampel = getAmpel(verstrich, order.ziel_min);
  const s = AMPEL_STYLE[ampel];
  const restMin = Math.max(0, order.ziel_min - verstrich);
  const barPct = Math.min(100, (verstrich / order.ziel_min) * 100);

  return (
    <div className={cn('rounded-xl border p-3 transition-colors', s.bg,
      ampel === 'rot' ? 'border-red-200 dark:border-red-800' :
      ampel === 'gelb' ? 'border-amber-200 dark:border-amber-800' :
      'border-green-200 dark:border-green-800'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <ChefHat className={cn('h-3.5 w-3.5', s.text)} />
          <span className="text-xs font-bold tabular-nums">#{order.bestellnummer}</span>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', s.badge)}>
          {ampel === 'rot' ? '⚡ Überzogen' : ampel === 'gelb' ? '⏳ Bald fällig' : '✓ Im Plan'}
        </span>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden mb-2">
        <div
          className={cn('h-full rounded-full transition-all duration-1000', s.bar)}
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground tabular-nums">{verstrich} Min verstrich.</span>
        <span className={cn('font-black tabular-nums text-sm', s.text)}>
          {restMin > 0 ? `${restMin} Min` : 'Zeit!'}
        </span>
        <span className="text-muted-foreground tabular-nums">Ziel: {order.ziel_min} Min</span>
      </div>
    </div>
  );
}

/* ── Mock-Daten (wenn API nicht verfügbar) ──────────────────────────────── */
function getMockData(): ApiData {
  const now = new Date();
  return {
    aktive_bestellungen: [
      { order_id: '1', bestellnummer: '2847', begonnen_am: new Date(now.getTime() - 6 * 60000).toISOString(), ziel_min: 12, status: 'kocht' },
      { order_id: '2', bestellnummer: '2848', begonnen_am: new Date(now.getTime() - 10 * 60000).toISOString(), ziel_min: 10, status: 'kocht' },
      { order_id: '3', bestellnummer: '2849', begonnen_am: new Date(now.getTime() - 3 * 60000).toISOString(), ziel_min: 14, status: 'kocht' },
    ],
    avg_prep_min: 11.4,
    on_time_pct: 82,
    alert_count: 1,
    schicht_ziel_min: 12,
  };
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function KitchenPhase2290SmartTimingKpiCockpit({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/kitchen-sync?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(getMockData());
      }
    } catch {
      setData(getMockData());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const dataId = setInterval(load, 30 * 1000);
    const tickId = setInterval(() => setTick(t => t + 1), 10 * 1000);
    return () => { clearInterval(dataId); clearInterval(tickId); };
  }, [load]);

  const teamAmpel = useMemo<Ampel>(() => {
    if (!data) return 'gruen';
    if (data.on_time_pct < 70) return 'rot';
    if (data.on_time_pct < 85) return 'gelb';
    return 'gruen';
  }, [data]);

  const s = AMPEL_STYLE[teamAmpel];

  if (!locationId) return null;

  return (
    <div className="rounded-xl border bg-card p-4 mb-3 space-y-3">
      {/* Header */}
      <button
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', s.bg)}>
            <Flame className={cn('h-4 w-4', s.text)} />
          </span>
          <div className="text-left">
            <p className="text-sm font-bold leading-tight">Smart-Timing Cockpit</p>
            <p className="text-[10px] text-muted-foreground">Countdown · Farbkodierung · Echtzeit</p>
          </div>
          {data && (
            <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold ml-1', s.badge)}>
              {data.on_time_pct}% pünktlich
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <>
          {/* KPI-Leiste */}
          {data && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/30 p-2 text-center">
                <p className="text-lg font-black tabular-nums text-foreground">{data.aktive_bestellungen.length}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Aktiv</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 text-center">
                <p className={cn('text-lg font-black tabular-nums', s.text)}>{data.avg_prep_min.toFixed(1)}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Ø Min</p>
              </div>
              <div className={cn('rounded-lg p-2 text-center', s.bg)}>
                <p className={cn('text-lg font-black tabular-nums', s.text)}>{data.on_time_pct}%</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Im Plan</p>
              </div>
            </div>
          )}

          {/* Alert-Banner */}
          {data && data.alert_count > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span><strong>{data.alert_count} Bestellung{data.alert_count > 1 ? 'en' : ''}</strong> überzieht die Zubereitungszeit</span>
            </div>
          )}

          {/* Countdown-Kacheln */}
          {data && data.aktive_bestellungen.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Live-Countdown
              </p>
              {data.aktive_bestellungen.map(order => (
                <PrepCard key={order.order_id} order={order} tick={tick} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-muted/20 py-4 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-matcha-500" />
              Keine aktiven Zubereitungen
            </div>
          )}

          {/* Ziel-Hinweis */}
          {data && (
            <p className={cn('rounded-lg px-3 py-2 text-[10px]',
              teamAmpel === 'gruen' ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300' :
              teamAmpel === 'gelb' ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300' :
              'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
            )}>
              {teamAmpel === 'gruen'
                ? `Ausgezeichnet! Zubereitungszeit Ø ${data.avg_prep_min.toFixed(1)} Min — Ziel ${data.schicht_ziel_min} Min erreicht.`
                : teamAmpel === 'gelb'
                ? `Achtung: Ø ${data.avg_prep_min.toFixed(1)} Min — Ziel ${data.schicht_ziel_min} Min. Tempo halten!`
                : `Kritisch: Ø ${data.avg_prep_min.toFixed(1)} Min — ${data.on_time_pct}% pünktlich. Sofort optimieren!`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
