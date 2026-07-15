'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

/**
 * Phase 1652 — Tages-Kosten-Ampel (Kitchen)
 *
 * Materialkosten-Hochrechnung vs. Tages-Budget:
 * Ampel Normal/Achtung/Kritisch + Balken-Chart je Stunde.
 * Props-basiert, useMemo.
 */

interface Order {
  id: string;
  status: string;
  bestellt_am?: string | null;
  gesamtbetrag?: number | null;
}

interface Props {
  orders: Order[];
  tagesBudget?: number;
}

type AmpelStufe = 'normal' | 'achtung' | 'kritisch';

const KOSTEN_ANTEIL = 0.30; // Materialkosten-Anteil am Umsatz (30%)

const STUFE: Record<AmpelStufe, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  normal:   { label: 'Im Rahmen',  color: 'text-matcha-700 dark:text-matcha-300',  bg: 'bg-matcha-50 dark:bg-matcha-900/20',  border: 'border-matcha-200 dark:border-matcha-700', icon: CheckCircle2 },
  achtung:  { label: 'Achtung',    color: 'text-amber-700 dark:text-amber-300',    bg: 'bg-amber-50 dark:bg-amber-900/20',    border: 'border-amber-200 dark:border-amber-700',  icon: TrendingUp   },
  kritisch: { label: 'Kritisch',   color: 'text-red-700 dark:text-red-300',        bg: 'bg-red-50 dark:bg-red-900/20',        border: 'border-red-200 dark:border-red-700',      icon: AlertTriangle },
};

function calcStufe(kosten: number, budget: number): AmpelStufe {
  const pct = budget > 0 ? kosten / budget : 0;
  if (pct < 0.75) return 'normal';
  if (pct < 0.95) return 'achtung';
  return 'kritisch';
}

function fmt(n: number) {
  return (n / 100).toFixed(2).replace('.', ',') + ' €';
}

export function KitchenPhase1652TagesKostenAmpel({ orders, tagesBudget = 30000 }: Props) {
  const [open, setOpen] = useState(true);

  const { kostenHeute, stunden, stufe } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const tagesOrders = orders.filter(o => {
      if (!o.bestellt_am) return false;
      return new Date(o.bestellt_am) >= todayStart;
    });

    const umsatz = tagesOrders.reduce((sum, o) => sum + (o.gesamtbetrag ?? 0), 0);
    const kostenHeute = Math.round(umsatz * KOSTEN_ANTEIL);

    // Balken je Stunde (0–23)
    const byHour: number[] = Array(24).fill(0);
    for (const o of tagesOrders) {
      if (!o.bestellt_am) continue;
      const h = new Date(o.bestellt_am).getHours();
      byHour[h] += (o.gesamtbetrag ?? 0) * KOSTEN_ANTEIL;
    }

    // Nur Stunden mit Daten ab 6 Uhr
    const stunden = byHour
      .map((v, h) => ({ h, v: Math.round(v) }))
      .filter(({ h }) => h >= 6 && h <= now.getHours());

    return { kostenHeute, stunden, stufe: calcStufe(kostenHeute, tagesBudget) };
  }, [orders, tagesBudget]);

  const pct = Math.min(100, Math.round((kostenHeute / tagesBudget) * 100));
  const cfg = STUFE[stufe];
  const Icon = cfg.icon;
  const maxBarV = Math.max(1, ...stunden.map(s => s.v));

  return (
    <div className={cn('rounded-xl border p-3 mb-3', cfg.bg, cfg.border)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Euro className={cn('h-4 w-4 shrink-0', cfg.color)} />
        <span className={cn('text-sm font-semibold flex-1', cfg.color)}>
          Tages-Kosten-Ampel
        </span>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', cfg.color, cfg.border, cfg.bg)}>
          <Icon className="inline h-3 w-3 mr-1" />{cfg.label}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Kosten vs Budget */}
          <div className="flex items-end justify-between text-xs">
            <span className="text-muted-foreground">Materialkosten heute</span>
            <span className={cn('font-bold text-sm', cfg.color)}>{fmt(kostenHeute)}</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', stufe === 'normal' ? 'bg-matcha-500' : stufe === 'achtung' ? 'bg-amber-400' : 'bg-red-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 €</span>
            <span className="font-medium">{pct}% von {fmt(tagesBudget)}</span>
            <span>{fmt(tagesBudget)}</span>
          </div>

          {/* Stunden-Balken-Chart */}
          {stunden.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Kosten je Stunde</div>
              <div className="flex items-end gap-0.5 h-12">
                {stunden.map(({ h, v }) => (
                  <div key={h} className="flex flex-col items-center flex-1 gap-0.5">
                    <div
                      className={cn('w-full rounded-sm', stufe === 'normal' ? 'bg-matcha-400' : stufe === 'achtung' ? 'bg-amber-400' : 'bg-red-400')}
                      style={{ height: `${Math.round((v / maxBarV) * 100)}%`, minHeight: v > 0 ? 4 : 0 }}
                      title={`${h}:00 — ${fmt(v)}`}
                    />
                    <span className="text-[9px] text-muted-foreground">{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
