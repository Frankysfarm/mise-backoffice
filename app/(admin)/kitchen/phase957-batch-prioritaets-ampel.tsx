'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlarmClock, ChevronDown, ChevronUp, Zap } from 'lucide-react';

/**
 * Phase 957 — Batch-Prioritäts-Ampel (Kitchen)
 *
 * Automatische Priorisierung von Bestellungen nach Lieferzeit-Deadline.
 * Ampel: Grün (>20 Min), Amber (10–20 Min), Rot (<10 Min).
 * Client-seitig, kein API-Call.
 */

interface Order {
  id: string;
  status: string;
  bestellnummer?: string | null;
  promised_at?: string | null;
  lieferzeit?: string | null;
  delivery_time?: string | null;
  estimated_delivery?: string | null;
  bestellt_am?: string | null;
  created_at?: string | null;
  delivery_type?: string | null;
  lieferung?: boolean | null;
}

interface Props {
  orders: Order[];
}

type Prioritaet = 'kritisch' | 'hoch' | 'normal';

interface PrioritaetsBestellung {
  id: string;
  bestellnummer: string;
  minutenBisDeadline: number;
  prioritaet: Prioritaet;
  deadlineLabel: string;
}

const ACTIVE_STATUSES = [
  'neu', 'new', 'pending', 'bestätigt', 'confirmed',
  'zubereitung', 'in_preparation', 'preparing', 'in_kitchen',
];

function getDeadlineMs(order: Order): number | null {
  const raw = order.promised_at ?? order.lieferzeit ?? order.delivery_time ?? order.estimated_delivery;
  if (raw) return new Date(raw).getTime();
  // Fallback: Bestellzeit + 45 Min bei Lieferung, 25 Min bei Abholung
  const base = order.bestellt_am ?? order.created_at;
  if (!base) return null;
  const isDelivery = order.delivery_type === 'lieferung' || order.lieferung === true;
  return new Date(base).getTime() + (isDelivery ? 45 : 25) * 60_000;
}

function minutenBis(deadlineMs: number): number {
  return Math.round((deadlineMs - Date.now()) / 60_000);
}

function getPrioritaet(min: number): Prioritaet {
  if (min < 10) return 'kritisch';
  if (min < 20) return 'hoch';
  return 'normal';
}

function deadlineLabel(min: number): string {
  if (min <= 0) return 'ÜBERFÄLLIG';
  if (min < 1) return '<1 Min';
  return `${min} Min`;
}

export function KitchenPhase957BatchPrioritaetsAmpel({ orders }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const prioList = useMemo<PrioritaetsBestellung[]>(() => {
    const active = orders.filter((o) => ACTIVE_STATUSES.includes((o.status ?? '').toLowerCase()));
    return active
      .map((o): PrioritaetsBestellung | null => {
        const dl = getDeadlineMs(o);
        if (!dl) return null;
        const min = minutenBis(dl);
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? `#${o.id.slice(-4).toUpperCase()}`,
          minutenBisDeadline: min,
          prioritaet: getPrioritaet(min),
          deadlineLabel: deadlineLabel(min),
        };
      })
      .filter((x): x is PrioritaetsBestellung => x !== null)
      .sort((a, b) => a.minutenBisDeadline - b.minutenBisDeadline);
  }, [orders]);

  const kritisch = prioList.filter((p) => p.prioritaet === 'kritisch');
  const hoch = prioList.filter((p) => p.prioritaet === 'hoch');

  if (prioList.length === 0) return null;

  return (
    <section className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <AlarmClock className="h-5 w-5 text-orange-500" />
          <span className="font-semibold text-stone-800">Prioritäts-Ampel</span>
          {kritisch.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              {kritisch.length} KRITISCH
            </span>
          )}
          {hoch.length > 0 && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-stone-900">
              {hoch.length} DRINGEND
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronUp className="h-4 w-4 text-stone-400" />}
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-2">
          {prioList.slice(0, 8).map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center justify-between rounded-xl px-3 py-2',
                p.prioritaet === 'kritisch' && 'bg-red-50 border border-red-200 animate-pulse',
                p.prioritaet === 'hoch' && 'bg-amber-50 border border-amber-200',
                p.prioritaet === 'normal' && 'bg-green-50 border border-green-100',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-3 w-3 rounded-full',
                    p.prioritaet === 'kritisch' && 'bg-red-500',
                    p.prioritaet === 'hoch' && 'bg-amber-400',
                    p.prioritaet === 'normal' && 'bg-green-400',
                  )}
                />
                <span className="text-sm font-medium text-stone-800">{p.bestellnummer}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {p.prioritaet === 'kritisch' && <Zap className="h-3.5 w-3.5 text-red-500" />}
                <span
                  className={cn(
                    'text-sm font-bold',
                    p.prioritaet === 'kritisch' && 'text-red-600',
                    p.prioritaet === 'hoch' && 'text-amber-600',
                    p.prioritaet === 'normal' && 'text-green-600',
                  )}
                >
                  {p.deadlineLabel}
                </span>
              </div>
            </div>
          ))}
          {prioList.length > 8 && (
            <p className="text-center text-xs text-stone-400">+{prioList.length - 8} weitere</p>
          )}
          <div className="flex gap-3 pt-1 text-xs text-stone-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> {'<'}10 Min</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> 10–20 Min</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400" /> {'>'}20 Min</span>
          </div>
        </div>
      )}
    </section>
  );
}
