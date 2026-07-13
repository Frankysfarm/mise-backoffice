'use client';

import { useMemo } from 'react';
import { AlertCircle, ChefHat, Flame, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1382 — Sonderwunsch-Häufigkeits-Karte (Kitchen)
 *
 * Analysiert alle aktiven Bestellungen auf Sonderwünsche/Notizen je Gericht.
 * Zeigt Top-8 Sonderwunsch-Muster farbkodiert nach Komplexität:
 *   Grün   = einfach (z.B. "ohne Zwiebeln")
 *   Amber  = mittel  (z.B. "extra scharf", "doppelte Portion")
 *   Rot    = komplex (z.B. Allergie-Hinweise, mehrere Änderungen)
 *
 * Props-basiert — kein API-Aufruf. Nach Phase1377 in kitchen/client.tsx.
 */

interface OrderItem {
  name?: string | null;
  sonderwunsch?: string | null;
  notiz?: string | null;
  quantity?: number | null;
}

interface Order {
  id: string;
  status: string;
  items?: OrderItem[] | null;
  sonderwunsch?: string | null;
  notiz?: string | null;
  bestellnummer?: string | null;
}

interface Props {
  orders: Order[];
}

type Komplexitaet = 'einfach' | 'mittel' | 'komplex';

interface SonderwunschEintrag {
  text: string;
  haeufigkeit: number;
  gerichte: string[];
  komplexitaet: Komplexitaet;
}

const AKTIV_STATUS = new Set(['neu', 'angenommen', 'zubereitung', 'confirmed', 'preparing', 'in_progress']);

const KOMPLEX_KEYWORDS = ['allergi', 'unverträglich', 'intoleranz', 'vegan', 'vegetar', 'halal', 'kosher', 'ohne fleisch'];
const MITTEL_KEYWORDS = ['extra', 'doppelt', 'scharf', 'mehr', 'weniger', 'groß', 'klein', 'zusätzlich', 'besonders'];

function bewertKomplexitaet(text: string): Komplexitaet {
  const lower = text.toLowerCase();
  if (KOMPLEX_KEYWORDS.some((k) => lower.includes(k))) return 'komplex';
  if (MITTEL_KEYWORDS.some((k) => lower.includes(k))) return 'mittel';
  return 'einfach';
}

const KOMPLEXITAET_CONFIG: Record<Komplexitaet, {
  label: string;
  color: string;
  bg: string;
  border: string;
  badge: string;
  icon: React.ReactNode;
}> = {
  einfach: {
    label: 'Einfach',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    icon: <Star className="h-3 w-3" />,
  },
  mittel: {
    label: 'Mittel',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-700',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    icon: <Flame className="h-3 w-3" />,
  },
  komplex: {
    label: 'Komplex',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-700',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

export function KitchenPhase1382SonderwunschHaeufigkeitsKarte({ orders }: Props) {
  const eintraege = useMemo<SonderwunschEintrag[]>(() => {
    const aktiv = orders.filter((o) => AKTIV_STATUS.has(o.status));
    const map = new Map<string, { haeufigkeit: number; gerichte: Set<string> }>();

    for (const order of aktiv) {
      const wuensche: { text: string; gericht: string }[] = [];

      // Order-Level Sonderwunsch
      if (order.sonderwunsch?.trim()) {
        wuensche.push({ text: order.sonderwunsch.trim(), gericht: `#${order.bestellnummer ?? order.id.slice(0, 6)}` });
      }
      if (order.notiz?.trim()) {
        wuensche.push({ text: order.notiz.trim(), gericht: `#${order.bestellnummer ?? order.id.slice(0, 6)}` });
      }

      // Item-Level Sonderwünsche
      for (const item of order.items ?? []) {
        const text = item.sonderwunsch?.trim() ?? item.notiz?.trim() ?? '';
        if (text) {
          wuensche.push({ text, gericht: item.name?.trim() ?? 'Artikel' });
        }
      }

      for (const { text, gericht } of wuensche) {
        // Normalize: lowercase, truncate to 60 chars for grouping
        const key = text.toLowerCase().slice(0, 60);
        if (!map.has(key)) {
          map.set(key, { haeufigkeit: 0, gerichte: new Set() });
        }
        const entry = map.get(key)!;
        entry.haeufigkeit++;
        entry.gerichte.add(gericht);
      }
    }

    return Array.from(map.entries())
      .map(([key, val]) => ({
        text: key.charAt(0).toUpperCase() + key.slice(1),
        haeufigkeit: val.haeufigkeit,
        gerichte: Array.from(val.gerichte),
        komplexitaet: bewertKomplexitaet(key),
      }))
      .sort((a, b) => b.haeufigkeit - a.haeufigkeit)
      .slice(0, 8);
  }, [orders]);

  const komplexCount = eintraege.filter((e) => e.komplexitaet === 'komplex').length;

  if (eintraege.length === 0) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/20">
      <div className="mb-3 flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <span className="text-sm font-semibold text-violet-800 dark:text-violet-300">
          Sonderwunsch-Häufigkeits-Karte
        </span>
        {komplexCount > 0 && (
          <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
            {komplexCount} komplex
          </span>
        )}
      </div>

      <div className="space-y-2">
        {eintraege.map((eintrag, idx) => {
          const cfg = KOMPLEXITAET_CONFIG[eintrag.komplexitaet];
          return (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-2.5',
                cfg.bg,
                cfg.border
              )}
            >
              {/* Rang */}
              <div className={cn('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold', cfg.badge)}>
                {idx + 1}
              </div>

              {/* Inhalt */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('text-xs font-medium leading-snug', cfg.color)}>
                    {eintrag.text.length > 80 ? eintrag.text.slice(0, 77) + '…' : eintrag.text}
                  </p>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <span className={cn('flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium', cfg.badge)}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                    <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                      ×{eintrag.haeufigkeit}
                    </span>
                  </div>
                </div>
                {eintrag.gerichte.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {eintrag.gerichte.slice(0, 3).join(', ')}
                    {eintrag.gerichte.length > 3 && ` +${eintrag.gerichte.length - 3}`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-right text-xs text-violet-600 dark:text-violet-400">
        {eintraege.length} Muster aus aktiven Bestellungen
      </p>
    </div>
  );
}
