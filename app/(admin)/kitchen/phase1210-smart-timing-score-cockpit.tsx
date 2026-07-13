'use client';

// Phase 1210 — Smart-Timing-Score-Cockpit (Kitchen)
// Unified Echtzeit-Cockpit: Performance-Ring + 6-stufige Farbkodierung + Countdown je Bestellung
// Zeigt: Pünktlichkeits-Score (0-100), farbcodierte Kacheln je Bestellung, Überfällig-Alarm

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, Flame, AlertTriangle, CheckCircle2, Target } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  [k: string]: unknown;
}

interface Timing {
  order_id: string;
  cook_start_at?: string | null;
  ready_target?: string | null;
  prep_min?: number | null;
  status: string;
}

type ColorTier = 'fertig' | 'ok' | 'bald' | 'warnung' | 'kritisch' | 'ueberfaellig';

const TIER_CFG: Record<ColorTier, { bg: string; border: string; text: string; label: string; ring: string }> = {
  fertig:      { bg: 'bg-matcha-50',  border: 'border-matcha-400',  text: 'text-matcha-700',  label: 'Fertig',      ring: '#22c55e' },
  ok:          { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', label: '≤5 Min',      ring: '#10b981' },
  bald:        { bg: 'bg-yellow-50',  border: 'border-yellow-300',  text: 'text-yellow-700',  label: '5-10 Min',    ring: '#eab308' },
  warnung:     { bg: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-700',  label: '10-20 Min',   ring: '#f97316' },
  kritisch:    { bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-700',     label: '20-35 Min',   ring: '#ef4444' },
  ueberfaellig:{ bg: 'bg-stone-100',  border: 'border-stone-500',   text: 'text-stone-800',   label: 'Überfällig',  ring: '#292524' },
};

function getTier(secLeft: number | null): ColorTier {
  if (secLeft === null) return 'warnung';
  if (secLeft <= 0)    return 'ueberfaellig';
  if (secLeft <= 300)  return 'ok';
  if (secLeft <= 600)  return 'bald';
  if (secLeft <= 1200) return 'warnung';
  if (secLeft <= 2100) return 'kritisch';
  return 'ueberfaellig';
}

function fmtTime(sec: number): string {
  if (sec <= 0) return '✓';
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function PerfRing({ score }: { score: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx="40" cy="40" r={r}
        fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="44" textAnchor="middle" className="font-black" fontSize="16" fontWeight="900" fill={color}>
        {score}
      </text>
      <text x="40" y="57" textAnchor="middle" fontSize="8" fill="#9ca3af">Pünktl.</text>
    </svg>
  );
}

export function KitchenPhase1210SmartTimingScoreCockpit({ orders, timings }: { orders: Order[]; timings: Timing[] }) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const timingMap = new Map(timings.map(t => [t.order_id, t]));
  const now = Date.now();

  const activeOrders = orders.filter(o =>
    ['angenommen', 'in_zubereitung', 'bereit', 'bestätigt', 'neu'].includes(o.status)
  );

  if (activeOrders.length === 0) return null;

  type Row = { order: Order; tier: ColorTier; secLeft: number | null; readyAt: Date | null };

  const rows: Row[] = activeOrders.map(o => {
    const tm = timingMap.get(o.id);
    let secLeft: number | null = null;
    let readyAt: Date | null = null;

    if (tm?.ready_target) {
      readyAt = new Date(tm.ready_target);
      secLeft = Math.round((readyAt.getTime() - now) / 1000);
    } else if (tm?.cook_start_at && tm.prep_min) {
      readyAt = new Date(new Date(tm.cook_start_at).getTime() + tm.prep_min * 60_000);
      secLeft = Math.round((readyAt.getTime() - now) / 1000);
    } else if (o.bestellt_am && o.geschaetzte_zubereitung_min) {
      readyAt = new Date(new Date(o.bestellt_am as string).getTime() + (o.geschaetzte_zubereitung_min as number) * 60_000);
      secLeft = Math.round((readyAt.getTime() - now) / 1000);
    }

    return { order: o, tier: getTier(secLeft), secLeft, readyAt };
  }).sort((a, b) => {
    const tierOrder: ColorTier[] = ['ueberfaellig', 'kritisch', 'warnung', 'bald', 'ok', 'fertig'];
    return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
  });

  // Pünktlichkeits-Score: Anteil nicht-kritischer und nicht-überfälliger Bestellungen
  const onTimeCount = rows.filter(r => ['ok', 'bald', 'fertig'].includes(r.tier)).length;
  const score = rows.length > 0 ? Math.round((onTimeCount / rows.length) * 100) : 100;

  const overdueRows = rows.filter(r => r.tier === 'ueberfaellig');
  const criticalRows = rows.filter(r => r.tier === 'kritisch');

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Smart-Timing-Score-Cockpit</span>
          <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
            {activeOrders.length} aktiv
          </span>
          {overdueRows.length > 0 && (
            <span className="text-[10px] rounded-full bg-red-100 border border-red-300 px-2 py-0.5 font-bold text-red-700 animate-pulse">
              {overdueRows.length} Überfällig
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 space-y-4">
          {/* Header: Performance-Ring + KPI-Kacheln */}
          <div className="flex items-center gap-4">
            <PerfRing score={score} />
            <div className="grid grid-cols-3 gap-2 flex-1">
              {(['ok','bald','warnung','kritisch','ueberfaellig'] as ColorTier[]).map(tier => {
                const cfg = TIER_CFG[tier];
                const cnt = rows.filter(r => r.tier === tier).length;
                return (
                  <div key={tier} className={cn('rounded-lg border px-2 py-1.5 text-center', cfg.bg, cfg.border)}>
                    <div className={cn('text-lg font-black tabular-nums', cfg.text)}>{cnt}</div>
                    <div className={cn('text-[9px] font-bold uppercase', cfg.text)}>{cfg.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Überfällig-Alert */}
          {overdueRows.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 animate-pulse" />
              <span className="text-xs font-bold text-red-700">
                {overdueRows.length} Bestellung{overdueRows.length > 1 ? 'en' : ''} überfällig —
                sofort fertigstellen!
              </span>
            </div>
          )}

          {/* Bestellungs-Kacheln */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {rows.map(({ order, tier, secLeft, readyAt }) => {
              const cfg = TIER_CFG[tier];
              const num = (order.bestellnummer as string | undefined) ?? order.id.slice(-4).toUpperCase();
              const isOverdue = tier === 'ueberfaellig';
              return (
                <div
                  key={order.id}
                  className={cn(
                    'rounded-xl border-2 px-3 py-2.5 flex flex-col gap-1 transition-all',
                    cfg.bg, cfg.border,
                    isOverdue && 'animate-pulse',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px] font-black uppercase tracking-wide', cfg.text)}>#{num}</span>
                    <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold border', cfg.bg, cfg.border, cfg.text)}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className={cn('font-mono text-2xl font-black tabular-nums leading-none', cfg.text)}>
                    {secLeft !== null ? fmtTime(secLeft) : '—'}
                  </div>
                  {readyAt && (
                    <div className="text-[9px] text-muted-foreground">
                      Ziel: {readyAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Kritisch-Warning */}
          {criticalRows.length > 0 && overdueRows.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <Flame className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-[11px] font-semibold text-red-700">
                {criticalRows.length} Bestellung{criticalRows.length > 1 ? 'en' : ''} im kritischen Bereich — bitte beschleunigen
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
