'use client';

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

// Phase 1568 — Zubereitungs-Rückstand-Anzeige (Kitchen)
// Zeigt Anzahl Bestellungen die länger als Ziel-Prepzeit in Zubereitung sind.
// Ampel (grün/gelb/rot) + Countdown zum ältesten Rückstand.
// Ziel-Prepzeit: 12 Minuten. Props-basiert.

const ZIEL_PREP_MIN = 12;

interface Order {
  id: string;
  status?: string | null;
  accepted_at?: string | null;
  ready_at?: string | null;
}

interface Props {
  orders: Order[];
}

type Ampel = 'gruen' | 'gelb' | 'rot';

function ampelFor(anzahl: number): Ampel {
  if (anzahl === 0) return 'gruen';
  if (anzahl <= 2) return 'gelb';
  return 'rot';
}

const AMPEL_CONFIG: Record<Ampel, { label: string; border: string; bg: string; text: string; bar: string }> = {
  gruen: {
    label: 'Kein Rückstand',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    bar: 'bg-emerald-400',
  },
  gelb: {
    label: 'Leichter Rückstand',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    bar: 'bg-amber-400',
  },
  rot: {
    label: 'Kritischer Rückstand',
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-700',
    bar: 'bg-red-500',
  },
};

export function KitchenPhase1568ZubereitungsRueckstandAnzeige({ orders }: Props) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const { rueckstand, aeltesterMin, ampel } = useMemo(() => {
    const now = Date.now();
    const preparing = orders.filter(
      (o) => o.status === 'preparing' && o.accepted_at && !o.ready_at,
    );
    const ueberfaellig = preparing
      .map((o) => {
        const elapsed = (now - new Date(o.accepted_at!).getTime()) / 60000;
        return { id: o.id, elapsed };
      })
      .filter((o) => o.elapsed > ZIEL_PREP_MIN)
      .sort((a, b) => b.elapsed - a.elapsed);

    const aeltester = ueberfaellig[0]?.elapsed ?? 0;
    return {
      rueckstand: ueberfaellig.length,
      aeltesterMin: Math.round(aeltester),
      ampel: ampelFor(ueberfaellig.length),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]);

  const cfg = AMPEL_CONFIG[ampel];

  return (
    <div className={cn('rounded-xl border p-3 mb-2', cfg.border, cfg.bg)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {ampel === 'gruen' ? (
            <CheckCircle2 className={cn('h-3.5 w-3.5', cfg.text)} />
          ) : (
            <AlertTriangle className={cn('h-3.5 w-3.5', cfg.text)} />
          )}
          <span className={cn('text-xs font-bold', cfg.text)}>Zubereitung: {cfg.label}</span>
          {rueckstand > 0 && (
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', cfg.text, 'bg-white/60')}>
              {rueckstand} Bestellung{rueckstand !== 1 ? 'en' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/60 p-2 text-center">
              <div className={cn('text-xl font-black tabular-nums', cfg.text)}>{rueckstand}</div>
              <div className="text-[10px] text-muted-foreground">Überfällig (&gt;{ZIEL_PREP_MIN} Min)</div>
            </div>
            <div className="rounded-lg bg-white/60 p-2 text-center">
              <Clock className={cn('mx-auto h-3.5 w-3.5 mb-0.5', cfg.text)} />
              <div className={cn('text-xl font-black tabular-nums', cfg.text)}>
                {rueckstand > 0 ? `${aeltesterMin} Min` : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">Ältester Rückstand</div>
            </div>
          </div>
          {rueckstand > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Überfälligkeits-Druck</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', cfg.bar)}
                  style={{ width: `${Math.min(100, (rueckstand / 6) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {rueckstand === 0 && (
            <p className="text-[11px] text-emerald-700">Alle Bestellungen im Zielkorridor ({ZIEL_PREP_MIN} Min).</p>
          )}
        </div>
      )}
    </div>
  );
}
