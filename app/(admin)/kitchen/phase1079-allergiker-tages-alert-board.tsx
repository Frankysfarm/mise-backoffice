'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1079 — Allergiker-Tages-Alert-Board (Kitchen)
 *
 * Alle Bestellungen mit Allergen-Flags der letzten 2h + Farbampel nach Schwere.
 * Kritisch (Rot): Nüsse, Fisch — können lebensbedrohlich sein.
 * Warnung (Orange): Gluten, Laktose, Ei.
 * Hinweis (Gelb): Soja, Sellerie.
 */

interface Item { name?: string; title?: string }
interface Order { id: string; status: string; created_at?: string | null; bestellnummer?: string | null; items?: Item[] | null }
interface Props { orders: Order[] }

type Schwere = 'kritisch' | 'warnung' | 'hinweis';

const ALLERGENE = [
  { key: 'nuesse',   label: 'Nüsse',         emoji: '🥜', schwere: 'kritisch' as Schwere, keywords: ['nuss', 'mandel', 'cashew', 'walnuss', 'erdnuss', 'pesto', 'tahini', 'sesam', 'haselnuss'] },
  { key: 'fisch',    label: 'Fisch/Meeresf.', emoji: '🐟', schwere: 'kritisch' as Schwere, keywords: ['fisch', 'lachs', 'thunfisch', 'shrimp', 'garnele', 'crevette', 'sushi', 'calamari', 'hering'] },
  { key: 'gluten',   label: 'Gluten',         emoji: '🌾', schwere: 'warnung' as Schwere,  keywords: ['brot', 'brötchen', 'burger', 'schnitzel', 'pasta', 'nudel', 'pizza', 'wrap', 'paniert', 'mehl', 'weizenmehl'] },
  { key: 'laktose',  label: 'Laktose',        emoji: '🥛', schwere: 'warnung' as Schwere,  keywords: ['käse', 'sahne', 'butter', 'milch', 'joghurt', 'creme', 'cream', 'quark', 'mozarella', 'parmesan'] },
  { key: 'ei',       label: 'Ei',             emoji: '🥚', schwere: 'warnung' as Schwere,  keywords: ['ei', 'mayo', 'mayonnaise', 'omelette', 'rührei', 'spiegelei', 'frittata'] },
  { key: 'soja',     label: 'Soja',           emoji: '🫘', schwere: 'hinweis' as Schwere,  keywords: ['soja', 'tofu', 'edamame', 'miso', 'teriyaki'] },
  { key: 'sellerie', label: 'Sellerie',       emoji: '🌿', schwere: 'hinweis' as Schwere,  keywords: ['sellerie', 'selleriesalat', 'selleriesuppe', 'knollensellerie', 'staudensellerie'] },
];

const ZWEI_STUNDEN = 2 * 3600_000;

function matchAllergen(itemName: string, keywords: string[]): boolean {
  const low = itemName.toLowerCase();
  return keywords.some(kw => low.includes(kw));
}

const SCHWERE_CONFIG: Record<Schwere, { border: string; bg: string; badge: string; label: string }> = {
  kritisch: { border: 'border-red-400', bg: 'bg-red-50 dark:bg-red-900/20', badge: 'bg-red-100 text-red-700 border-red-300', label: 'Kritisch' },
  warnung:  { border: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', badge: 'bg-orange-100 text-orange-700 border-orange-300', label: 'Warnung' },
  hinweis:  { border: 'border-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20', badge: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Hinweis' },
};

interface AllergenAlert {
  allergen: (typeof ALLERGENE)[number];
  bestellungen: { nr: string; items: string[] }[];
}

export function KitchenPhase1079AllergikerTagesAlertBoard({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const alerts: AllergenAlert[] = useMemo(() => {
    const cutoff = Date.now() - ZWEI_STUNDEN;
    const recent = orders.filter(o => {
      if (!o.created_at) return true;
      return new Date(o.created_at).getTime() >= cutoff;
    });

    return ALLERGENE.map(a => {
      const bestellungen = recent
        .filter(o => ['pending', 'neu', 'angenommen', 'confirmed', 'in_preparation', 'zubereitung'].includes(o.status ?? ''))
        .map(o => {
          const matched = (o.items ?? [])
            .filter(i => matchAllergen(i.name ?? i.title ?? '', a.keywords))
            .map(i => i.name ?? i.title ?? '');
          return matched.length > 0 ? { nr: o.bestellnummer ?? o.id.slice(-6), items: matched } : null;
        })
        .filter(Boolean) as { nr: string; items: string[] }[];

      return { allergen: a, bestellungen };
    }).filter(a => a.bestellungen.length > 0)
      .sort((a, b) => {
        const order: Record<Schwere, number> = { kritisch: 0, warnung: 1, hinweis: 2 };
        return order[a.allergen.schwere] - order[b.allergen.schwere] || b.bestellungen.length - a.bestellungen.length;
      });
  }, [orders]);

  const kritischCount = alerts.filter(a => a.allergen.schwere === 'kritisch').reduce((s, a) => s + a.bestellungen.length, 0);
  const gesamtCount = alerts.reduce((s, a) => s + a.bestellungen.length, 0);

  if (alerts.length === 0) return null;

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', kritischCount > 0 ? 'border-red-400' : 'border-orange-300')}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-3 transition', kritischCount > 0 ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100/70' : 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100/50')}
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className={cn('h-4 w-4', kritischCount > 0 ? 'text-red-600' : 'text-orange-500')} />
          <span className="text-sm font-bold">Allergiker-Alert — letzte 2h</span>
          {kritischCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              {kritischCount}× kritisch
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{gesamtCount} Bestellungen betroffen</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y divide-border">
          {alerts.map(({ allergen, bestellungen }) => {
            const cfg = SCHWERE_CONFIG[allergen.schwere];
            return (
              <div key={allergen.key} className={cn('px-4 py-3', cfg.bg)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{allergen.emoji}</span>
                    <span className="text-sm font-bold">{allergen.label}</span>
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black', cfg.badge)}>
                      {cfg.label}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">{bestellungen.length} Bestellungen</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {bestellungen.map((b) => (
                    <div key={b.nr} className={cn('rounded-lg border px-2 py-1 text-[11px] font-medium', cfg.border, 'bg-white/60 dark:bg-black/20')}>
                      <span className="font-black">#{b.nr}</span>
                      <span className="text-muted-foreground ml-1 truncate max-w-[120px] inline-block align-bottom">{b.items.slice(0, 2).join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="px-4 py-2 bg-muted/20">
            <p className="text-[10px] text-muted-foreground">
              <AlertTriangle className="inline h-2.5 w-2.5 mr-0.5 text-amber-500" />
              Keyword-basiert · Letzte 2h · Nur aktive Bestellungen
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
