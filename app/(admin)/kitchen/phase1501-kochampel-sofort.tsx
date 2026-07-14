'use client';

import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Flame, CheckCircle2, ChefHat } from 'lucide-react';

// Phase 1501 — Kochampel Sofort
// Zeigt die 3 dringendsten aktiven Bestellungen mit großen Countdown-Zahlen
// und 4-stufiger Farbampel (Grün/Gelb/Orange/Rot), optimiert für Sichtbarkeit
// aus mehreren Metern Entfernung in der Küche.

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  typ?: string;
  items?: { name: string; menge: number }[];
}

interface Props {
  orders: Order[];
}

type Dringlichkeit = 'ok' | 'bald' | 'dringend' | 'kritisch';

function classifyDringlichkeit(restSek: number): Dringlichkeit {
  if (restSek > 8 * 60) return 'ok';
  if (restSek > 3 * 60) return 'bald';
  if (restSek >= 0)    return 'dringend';
  return 'kritisch';
}

const CONFIG: Record<Dringlichkeit, { bg: string; border: string; text: string; label: string; pulse: boolean }> = {
  ok:       { bg: 'bg-emerald-50',   border: 'border-emerald-300', text: 'text-emerald-800', label: 'OK',       pulse: false },
  bald:     { bg: 'bg-yellow-50',    border: 'border-yellow-400',  text: 'text-yellow-800',  label: 'Bald',     pulse: false },
  dringend: { bg: 'bg-orange-50',    border: 'border-orange-400',  text: 'text-orange-800',  label: 'Jetzt!',   pulse: true  },
  kritisch: { bg: 'bg-red-50',       border: 'border-red-500',     text: 'text-red-800',     label: 'Überfällig', pulse: true },
};

function formatCountdown(sek: number): string {
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sek < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase1501KochampelSofort({ orders }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const aktiv = useMemo(() => {
    const now = Date.now();
    return orders
      .filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status))
      .map(o => {
        const bestelltMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
        const zielpMin = o.geschaetzte_zubereitung_min ?? 15;
        const zielMs = bestelltMs + zielpMin * 60_000;
        const restSek = Math.round((zielMs - now) / 1000);
        const d = classifyDringlichkeit(restSek);
        return { ...o, restSek, d };
      })
      .sort((a, b) => a.restSek - b.restSek)
      .slice(0, 3);
  }, [orders]);

  if (aktiv.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-stone-50">
        <ChefHat className="w-4 h-4 text-stone-600" />
        <span className="text-[11px] font-black uppercase tracking-widest text-stone-600">
          Kochampel Sofort — Top {aktiv.length} dringend
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
        {aktiv.map((o, i) => {
          const cfg = CONFIG[o.d];
          return (
            <div
              key={o.id}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 px-4 py-5 text-center transition-all',
                cfg.bg,
                cfg.pulse && 'animate-pulse',
              )}
            >
              {/* Rang */}
              <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.text, 'opacity-60')}>
                #{i + 1} · {cfg.label}
              </span>

              {/* Countdown (groß) */}
              <span className={cn('font-mono text-5xl font-black tabular-nums leading-none', cfg.text)}>
                {formatCountdown(o.restSek)}
              </span>

              {/* Bestellnummer */}
              <span className={cn('text-xs font-semibold', cfg.text, 'opacity-80')}>
                #{o.bestellnummer ?? o.id.slice(-4)}
              </span>

              {/* Items */}
              {(o.items?.length ?? 0) > 0 && (
                <span className="text-[10px] text-stone-500 max-w-[120px] truncate">
                  {o.items!.map(it => `${it.menge}× ${it.name}`).join(', ')}
                </span>
              )}

              {/* Dringlichkeits-Icon */}
              <div className={cn('mt-1 flex items-center gap-1 text-[10px] font-bold', cfg.text)}>
                {o.d === 'kritisch' && <Flame className="w-3.5 h-3.5" />}
                {o.d === 'dringend' && <AlertTriangle className="w-3.5 h-3.5" />}
                {o.d === 'bald'     && <Clock className="w-3.5 h-3.5" />}
                {o.d === 'ok'       && <CheckCircle2 className="w-3.5 h-3.5" />}
                {o.d === 'kritisch' ? 'Überfällig!' : o.d === 'dringend' ? 'Jetzt kochen!' : o.d === 'bald' ? 'Bald fertig' : 'Im Plan'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
