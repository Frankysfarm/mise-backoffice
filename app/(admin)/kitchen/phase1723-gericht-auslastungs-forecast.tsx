'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 1723 — Gericht-Auslastungs-Forecast (Kitchen)
 *
 * Prognose wie viele Portionen je Gericht in der nächsten Stunde erwartet werden,
 * basierend auf aktuellem Bestelltrend (letzte 30 Min hochgerechnet).
 * Ampel niedrig/normal/hoch/kritisch. rein Props-basiert, useMemo.
 */

interface OrderItem {
  name?: string | null;
  quantity?: number | null;
}

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  bestellt_am?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

type AmpelStufe = 'niedrig' | 'normal' | 'hoch' | 'kritisch';

interface GerichtForecast {
  name: string;
  aktuelleStunde: number;
  prognoseNaechsteStunde: number;
  stufe: AmpelStufe;
}

const ACTIVE_STATUS = new Set([
  'accepted', 'confirmed', 'preparing', 'in_progress',
  'in_zubereitung', 'bestätigt', 'angenommen', 'pending',
]);

function ampelStufe(prognose: number): AmpelStufe {
  if (prognose >= 10) return 'kritisch';
  if (prognose >= 6)  return 'hoch';
  if (prognose >= 2)  return 'normal';
  return 'niedrig';
}

const STUFE_COLOR: Record<AmpelStufe, string> = {
  niedrig:  'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  normal:   'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700',
  hoch:     'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
  kritisch: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
};

const STUFE_TEXT: Record<AmpelStufe, string> = {
  niedrig:  'text-slate-600 dark:text-slate-400',
  normal:   'text-emerald-700 dark:text-emerald-300',
  hoch:     'text-amber-700 dark:text-amber-300',
  kritisch: 'text-red-700 dark:text-red-300',
};

const STUFE_BAR: Record<AmpelStufe, string> = {
  niedrig:  'bg-slate-400',
  normal:   'bg-emerald-500',
  hoch:     'bg-amber-500',
  kritisch: 'bg-red-500',
};

const STUFE_LABEL: Record<AmpelStufe, string> = {
  niedrig:  'Niedrig',
  normal:   'Normal',
  hoch:     'Hoch',
  kritisch: 'Kritisch',
};

export function KitchenPhase1723GerichtAuslastungsForecast({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const forecast = useMemo((): GerichtForecast[] => {
    const nowMs = Date.now();
    const vor30MinMs = nowMs - 30 * 60_000;
    const vor60MinMs = nowMs - 60 * 60_000;

    const letzteStunde: Record<string, number> = {};
    const letzte30Min: Record<string, number> = {};

    for (const o of orders) {
      const ts = o.bestellt_am ?? o.created_at;
      if (!ts) continue;
      const t = new Date(ts).getTime();
      const items = o.items ?? [];

      for (const item of items) {
        const name = item.name?.trim();
        if (!name) continue;
        const qty = item.quantity ?? 1;

        if (t >= vor60MinMs) {
          letzteStunde[name] = (letzteStunde[name] ?? 0) + qty;
        }
        if (t >= vor30MinMs) {
          letzte30Min[name] = (letzte30Min[name] ?? 0) + qty;
        }
      }
    }

    const allNames = new Set([...Object.keys(letzteStunde), ...Object.keys(letzte30Min)]);

    return Array.from(allNames)
      .map(name => {
        const aktuelleStunde = letzteStunde[name] ?? 0;
        const rate30 = letzte30Min[name] ?? 0;
        const prognose = Math.round(rate30 * 2);
        return {
          name,
          aktuelleStunde,
          prognoseNaechsteStunde: prognose,
          stufe: ampelStufe(prognose),
        };
      })
      .sort((a, b) => b.prognoseNaechsteStunde - a.prognoseNaechsteStunde)
      .slice(0, 8);
  }, [orders]);

  if (!forecast.length) return null;

  const kritischAnzahl = forecast.filter(f => f.stufe === 'kritisch').length;
  const maxPrognose = Math.max(...forecast.map(f => f.prognoseNaechsteStunde), 1);

  return (
    <div className={cn(
      'rounded-xl border p-3 mb-3',
      kritischAnzahl > 0
        ? 'border-red-200 dark:border-red-700 bg-red-50/30 dark:bg-red-950/10'
        : 'border-border bg-background',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          Gericht-Prognose
          <span className="text-xs font-normal text-muted-foreground">(nächste Stunde)</span>
          {kritischAnzahl > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">
              {kritischAnzahl} kritisch
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {kritischAnzahl > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-700 bg-red-100 dark:bg-red-900/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                Kapazitätsengpass erwartet — {kritischAnzahl} Gericht{kritischAnzahl > 1 ? 'e' : ''} kritisch!
              </span>
            </div>
          )}

          {forecast.map(g => {
            const barPct = Math.min(100, (g.prognoseNaechsteStunde / maxPrognose) * 100);
            return (
              <div key={g.name} className={cn(
                'rounded-lg border px-3 py-2',
                STUFE_COLOR[g.stufe],
              )}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium truncate text-foreground">{g.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      Letzte h: {g.aktuelleStunde}
                    </span>
                    <span className={cn('text-xs font-bold', STUFE_TEXT[g.stufe])}>
                      ~{g.prognoseNaechsteStunde} erw.
                    </span>
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold',
                      g.stufe === 'kritisch' ? 'bg-red-500 text-white' :
                      g.stufe === 'hoch' ? 'bg-amber-400 text-white' :
                      g.stufe === 'normal' ? 'bg-emerald-500 text-white' :
                      'bg-slate-300 text-slate-700',
                    )}>
                      {STUFE_LABEL[g.stufe]}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className={cn('h-1.5 rounded-full transition-all', STUFE_BAR[g.stufe])}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground pt-1">
            Prognose: Hochrechnung der letzten 30 Min auf die nächste Stunde
          </p>
        </div>
      )}
    </div>
  );
}
