'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, ChevronDown, ChevronUp, Zap } from 'lucide-react';

/**
 * Phase 967 — Rezept-Komplexitäts-Indikator (Kitchen)
 *
 * Bewertet Zubereitungs-Komplexität je aktiver Bestellung (einfach/mittel/komplex)
 * basierend auf Artikel-Anzahl + Zubereitungsaufwand (Keyword-Scoring).
 * Client-seitig via useMemo. Keine API nötig.
 */

interface OrderItem {
  name?: string | null;
  artikel?: string | null;
  title?: string | null;
  quantity?: number | null;
  menge?: number | null;
  count?: number | null;
}

interface Order {
  id: string;
  status: string;
  bestellnummer?: string | null;
  order_number?: string | null;
  items?: OrderItem[] | null;
  artikel?: OrderItem[] | null;
  positionen?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

type Komplexitaet = 'einfach' | 'mittel' | 'komplex';

interface BestellungKomplexitaet {
  id: string;
  bestellnummer: string;
  artikelAnzahl: number;
  komplexitaet: Komplexitaet;
  score: number;
  hauptartikel: string;
}

const ACTIVE_STATUSES = [
  'neu', 'new', 'pending', 'bestätigt', 'confirmed',
  'zubereitung', 'in_preparation', 'preparing', 'in_kitchen',
];

// Artikel-Keywords nach Aufwand-Score (1=leicht, 2=mittel, 3=aufwändig)
const AUFWAND_MAP: Array<{ keywords: string[]; aufwand: number }> = [
  { keywords: ['salat', 'salad', 'bowl', 'wrap'], aufwand: 1 },
  { keywords: ['sandwich', 'toast', 'baguette'], aufwand: 1 },
  { keywords: ['burger', 'hotdog'], aufwand: 2 },
  { keywords: ['pasta', 'spaghetti', 'penne', 'nudel'], aufwand: 2 },
  { keywords: ['pizza', 'flammkuchen'], aufwand: 2 },
  { keywords: ['suppe', 'soup', 'eintopf'], aufwand: 2 },
  { keywords: ['risotto', 'gnocchi'], aufwand: 3 },
  { keywords: ['schnitzel', 'steak', 'braten'], aufwand: 3 },
  { keywords: ['auflauf', 'gratiniert', 'überbacken'], aufwand: 3 },
  { keywords: ['sushi', 'ramen', 'dim sum'], aufwand: 3 },
  { keywords: ['seafood', 'lachs', 'garnele', 'fisch'], aufwand: 2 },
  { keywords: ['hähnchen', 'chicken', 'geflügel'], aufwand: 2 },
];

function itemAufwand(name: string): number {
  const lower = name.toLowerCase();
  for (const { keywords, aufwand } of AUFWAND_MAP) {
    if (keywords.some((k) => lower.includes(k))) return aufwand;
  }
  return 1;
}

function calcKomplexitaet(order: Order): { score: number; artikelAnzahl: number; hauptartikel: string } {
  const items = order.items ?? order.artikel ?? order.positionen ?? [];
  let score = 0;
  let artikelAnzahl = 0;
  let hauptartikel = 'Unbekannt';
  let maxAufwand = 0;

  for (const item of items) {
    const name = item.name ?? item.artikel ?? item.title ?? '';
    const menge = item.quantity ?? item.menge ?? item.count ?? 1;
    const aufwand = itemAufwand(name);
    score += aufwand * menge;
    artikelAnzahl += menge;
    if (aufwand > maxAufwand && name) {
      maxAufwand = aufwand;
      hauptartikel = name;
    }
  }

  // Vielfalt-Bonus: viele verschiedene Artikel erhöhen Komplexität
  if (items.length >= 4) score += 2;
  if (items.length >= 6) score += 2;

  return { score, artikelAnzahl, hauptartikel };
}

function scoreToKomplexitaet(score: number, artikelAnzahl: number): Komplexitaet {
  if (score >= 8 || artikelAnzahl >= 5) return 'komplex';
  if (score >= 4 || artikelAnzahl >= 3) return 'mittel';
  return 'einfach';
}

const KOMPLEXITAET_CONFIG: Record<Komplexitaet, { label: string; color: string; bg: string; border: string; dot: string }> = {
  einfach: {
    label: 'Einfach',
    color: 'text-matcha-700',
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-800',
    dot: 'bg-matcha-500',
  },
  mittel: {
    label: 'Mittel',
    color: 'text-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  komplex: {
    label: 'Komplex',
    color: 'text-red-700',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500 animate-pulse',
  },
};

export function KitchenPhase967RezeptKomplexitaetsIndikator({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const bestellungen = useMemo<BestellungKomplexitaet[]>(() => {
    return orders
      .filter((o) => ACTIVE_STATUSES.includes(o.status))
      .map((o) => {
        const { score, artikelAnzahl, hauptartikel } = calcKomplexitaet(o);
        const komplexitaet = scoreToKomplexitaet(score, artikelAnzahl);
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? o.order_number ?? o.id.slice(-4),
          artikelAnzahl,
          komplexitaet,
          score,
          hauptartikel,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [orders]);

  const komplexCount = bestellungen.filter((b) => b.komplexitaet === 'komplex').length;
  const mittelCount = bestellungen.filter((b) => b.komplexitaet === 'mittel').length;

  if (bestellungen.length === 0) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/20 p-4 mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-violet-600" />
          <span className="font-semibold text-sm text-violet-900 dark:text-violet-100">
            Rezept-Komplexität
          </span>
          {komplexCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white animate-pulse">
              {komplexCount} Komplex
            </span>
          )}
          {mittelCount > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
              {mittelCount} Mittel
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-violet-600" /> : <ChevronDown className="h-4 w-4 text-violet-600" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {bestellungen.slice(0, 8).map((b) => {
            const cfg = KOMPLEXITAET_CONFIG[b.komplexitaet];
            return (
              <div
                key={b.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
                  cfg.bg,
                  cfg.border,
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn('h-2 w-2 shrink-0 rounded-full', cfg.dot)} />
                  <span className="font-mono text-xs text-muted-foreground shrink-0">
                    #{b.bestellnummer}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {b.hauptartikel}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {b.artikelAnzahl} Artikel
                  </span>
                  <span className={cn('text-[11px] font-bold rounded-full px-1.5 py-0.5', cfg.color)}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}

          {bestellungen.length > 8 && (
            <p className="text-xs text-muted-foreground pl-1">
              +{bestellungen.length - 8} weitere Bestellungen
            </p>
          )}

          <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-matcha-500" /> Einfach (1–2 Artikel)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Mittel (3–4 Artikel)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Komplex (≥5 / Aufwand hoch)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
