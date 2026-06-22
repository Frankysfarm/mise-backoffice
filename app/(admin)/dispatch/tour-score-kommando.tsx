'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Clock, Euro, MapPin, Route, Star, Target, TrendingUp, Trophy, Truck, Zap,
} from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  gesamtbetrag: number;
  bestellt_am: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  zone?: string | null;
  kunde_name: string;
};

type Batch = {
  id: string;
  status: string;
  driver_id: string | null;
  total_eta_min: number | null;
  total_distance_km?: number | null;
  zone?: string | null;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  status?: {
    ist_online: boolean;
    aktueller_batch_id: string | null;
  } | null;
};

interface Props {
  orders: Order[];
  batches: Batch[];
  drivers: Driver[];
}

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set(n => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);
}

function waitMin(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function etaUrgency(etaIso: string | null): 'ok' | 'tight' | 'late' {
  if (!etaIso) return 'ok';
  const secsLeft = (new Date(etaIso).getTime() - Date.now()) / 1000;
  if (secsLeft < -60) return 'late';
  if (secsLeft < 900) return 'tight';
  return 'ok';
}

function calcDispatchScore(order: Order): number {
  let score = 50;
  const wait = waitMin(order.bestellt_am);
  score += Math.min(30, wait * 2);
  const urgency = etaUrgency(order.eta_latest ?? order.eta_earliest);
  if (urgency === 'late')  score += 20;
  if (urgency === 'tight') score += 10;
  if (order.gesamtbetrag > 30) score += 10;
  if (order.gesamtbetrag > 50) score += 5;
  return Math.min(100, score);
}

function ScoreRing({ score }: { score: number }) {
  const r = 16, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    score >= 80 ? 'stroke-red-500' :
    score >= 65 ? 'stroke-amber-400' :
    'stroke-matcha-500';
  const textColor =
    score >= 80 ? 'text-red-600' :
    score >= 65 ? 'text-amber-600' :
    'text-matcha-700';

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: 40, height: 40 }}>
      <svg width={40} height={40} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={20} cy={20} r={r} fill="none" strokeWidth={3.5} className="stroke-border" />
        <circle cx={20} cy={20} r={r} fill="none" strokeWidth={3.5} strokeLinecap="round"
          className={color} strokeDasharray={`${dash} ${circ}`} />
      </svg>
      <span className={cn('relative text-[10px] font-black tabular-nums', textColor)}>{score}</span>
    </div>
  );
}

function formatEta(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function DispatchTourScoreKommando({ orders, batches, drivers }: Props) {
  useTick();

  const availableDrivers = useMemo(() =>
    drivers.filter(d => d.status?.ist_online && !d.status.aktueller_batch_id),
    [drivers]
  );

  const readyOrders = useMemo(() =>
    orders
      .filter(o => o.status === 'fertig')
      .map(o => ({ order: o, score: calcDispatchScore(o) }))
      .sort((a, b) => b.score - a.score),
    [orders]
  );

  const activeBatches = useMemo(() =>
    batches.filter(b =>
      ['unterwegs', 'aktiv', 'on_route', 'assigned', 'pickup'].includes(b.status)
    ),
    [batches]
  );

  const scoreAvg = readyOrders.length > 0
    ? Math.round(readyOrders.reduce((s, r) => s + r.score, 0) / readyOrders.length)
    : 0;

  const criticalCount = readyOrders.filter(r => r.score >= 80).length;

  if (readyOrders.length === 0 && activeBatches.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Target className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score-Kommando</span>
        <div className="ml-auto flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span className="animate-pulse rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
              {criticalCount} kritisch
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {availableDrivers.length} Fahrer frei
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        <div className="flex flex-col items-center py-2.5">
          <span className="font-mono text-xl font-black text-red-600 tabular-nums leading-none">
            {readyOrders.length}
          </span>
          <span className="text-[9px] text-muted-foreground mt-0.5">Wartend</span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span className="font-mono text-xl font-black text-matcha-700 tabular-nums leading-none">
            {activeBatches.length}
          </span>
          <span className="text-[9px] text-muted-foreground mt-0.5">Aktive Touren</span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span className={cn(
            'font-mono text-xl font-black tabular-nums leading-none',
            scoreAvg >= 75 ? 'text-red-600' : scoreAvg >= 55 ? 'text-amber-600' : 'text-matcha-700',
          )}>
            {scoreAvg}
          </span>
          <span className="text-[9px] text-muted-foreground mt-0.5">Ø Dringlichkeit</span>
        </div>
      </div>

      {/* Ready orders ranked by score */}
      {readyOrders.length > 0 && (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Dispatch-Ranking — Fertige Bestellungen
            </span>
          </div>
          {readyOrders.slice(0, 6).map(({ order, score }, idx) => {
            const wait = waitMin(order.bestellt_am);
            const urgency = etaUrgency(order.eta_latest ?? order.eta_earliest);
            const urgencyStyle = urgency === 'late'
              ? 'border-red-200 bg-red-50'
              : urgency === 'tight'
              ? 'border-amber-200 bg-amber-50'
              : 'border-border bg-muted/30';

            return (
              <div key={order.id} className={cn(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2',
                urgencyStyle,
              )}>
                {/* Rank */}
                <span className="w-4 shrink-0 text-[10px] font-black text-muted-foreground text-center">
                  {idx + 1}
                </span>

                {/* Score ring */}
                <ScoreRing score={score} />

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-black text-foreground">
                      #{order.bestellnummer.slice(-4)}
                    </span>
                    {order.zone && (
                      <span className="rounded bg-background border px-1 text-[9px] font-bold text-muted-foreground">
                        {order.zone}
                      </span>
                    )}
                    {urgency !== 'ok' && (
                      <AlertTriangle className={cn(
                        'h-3 w-3 shrink-0',
                        urgency === 'late' ? 'text-red-500 animate-pulse' : 'text-amber-500',
                      )} />
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {order.kunde_name}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-col items-end gap-0.5 shrink-0 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {wait} Min warten
                  </span>
                  <span className="flex items-center gap-0.5 font-bold text-foreground">
                    <Euro className="h-2.5 w-2.5" />
                    {order.gesamtbetrag.toFixed(2)}
                  </span>
                  {(order.eta_earliest || order.eta_latest) && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      ETA {formatEta(order.eta_latest ?? order.eta_earliest)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active batches summary */}
      {activeBatches.length > 0 && (
        <div className="border-t border-border p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Truck className="h-3 w-3 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Aktive Touren
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {activeBatches.map(b => {
              const driver = drivers.find(d => d.id === b.driver_id);
              const name = driver ? `${driver.vorname[0]}. ${driver.nachname}` : 'Fahrer';
              return (
                <div key={b.id} className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                  <Truck className="h-3 w-3" />
                  <span>{name}</span>
                  {b.total_eta_min && (
                    <span className="text-blue-500">~{b.total_eta_min} Min</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available drivers */}
      {availableDrivers.length > 0 && (
        <div className="border-t border-border px-4 py-2.5 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-matcha-600" />
          <span className="text-[10px] text-muted-foreground">
            Verfügbar:
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {availableDrivers.map(d => (
              <span key={d.id} className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
                {d.vorname} {d.nachname[0]}.
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
