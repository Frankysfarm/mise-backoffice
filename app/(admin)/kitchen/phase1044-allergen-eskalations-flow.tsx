'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Bell, Check, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderItem = {
  name: string;
  allergies?: string[];
  quantity?: number;
};

type Order = {
  id: string;
  bestellnummer?: string;
  items: OrderItem[];
  status?: string;
};

type EskalierteBestellung = {
  orderId: string;
  bestellnummer: string;
  allergene: string[];
  items: string[];
  stufe: 'kritisch' | 'hoch';
  acknowledged: boolean;
};

const ALLERGEN_LABELS: Record<string, string> = {
  A: 'Gluten 🌾',
  B: 'Krebstiere 🦐',
  C: 'Ei 🥚',
  D: 'Fisch 🐟',
  E: 'Erdnuss 🥜',
  F: 'Soja 🫘',
  G: 'Milch 🥛',
  H: 'Schalenfrüchte 🌰',
  L: 'Sellerie 🌿',
  M: 'Senf 🟡',
  N: 'Sesam',
  O: 'Schwefeldioxid',
  P: 'Lupinen',
  R: 'Weichtiere',
};

const KRITISCHE_ALLERGENE = new Set(['E', 'H', 'B', 'R']);

function detectAllergyKeywords(name: string): string[] {
  const lower = name.toLowerCase();
  const found: string[] = [];
  if (lower.includes('nuss') || lower.includes('mandel') || lower.includes('erdnuss')) found.push('E', 'H');
  if (lower.includes('gluten') || lower.includes('weizen') || lower.includes('mehl')) found.push('A');
  if (lower.includes('laktose') || lower.includes('käse') || lower.includes('sahne') || lower.includes('butter') || lower.includes('milch')) found.push('G');
  if (lower.includes('ei') || lower.includes('mayo')) found.push('C');
  if (lower.includes('fisch') || lower.includes('lachs') || lower.includes('thun')) found.push('D');
  if (lower.includes('soja') || lower.includes('tofu')) found.push('F');
  if (lower.includes('sellerie')) found.push('L');
  if (lower.includes('sesam')) found.push('N');
  return [...new Set(found)];
}

export function KitchenPhase1044AllergenEskalationsFlow({
  orders,
}: {
  orders: Order[];
}) {
  const [open, setOpen] = useState(true);
  const [acked, setAcked] = useState<Set<string>>(new Set());

  const eskaliert = useMemo<EskalierteBestellung[]>(() => {
    const active = orders.filter((o) => !['done', 'rejected', 'abgeholt'].includes(o.status ?? ''));
    return active
      .map((o): EskalierteBestellung | null => {
        const allAllergene: string[] = [];
        const affectedItems: string[] = [];

        for (const item of o.items) {
          const itemAllergene = [
            ...(item.allergies ?? []),
            ...detectAllergyKeywords(item.name),
          ];
          if (itemAllergene.length > 0) {
            allAllergene.push(...itemAllergene);
            affectedItems.push(item.name);
          }
        }

        const unique = [...new Set(allAllergene)];
        if (unique.length === 0) return null;

        const hasCritical = unique.some((a) => KRITISCHE_ALLERGENE.has(a));
        const stufe: 'kritisch' | 'hoch' = hasCritical ? 'kritisch' : 'hoch';

        return {
          orderId: o.id,
          bestellnummer: o.bestellnummer ?? o.id.slice(0, 6),
          allergene: unique,
          items: [...new Set(affectedItems)],
          stufe,
          acknowledged: acked.has(o.id),
        };
      })
      .filter((x): x is EskalierteBestellung => x !== null)
      .sort((a, b) => {
        if (a.stufe === 'kritisch' && b.stufe !== 'kritisch') return -1;
        if (a.stufe !== 'kritisch' && b.stufe === 'kritisch') return 1;
        if (!a.acknowledged && b.acknowledged) return -1;
        if (a.acknowledged && !b.acknowledged) return 1;
        return 0;
      });
  }, [orders, acked]);

  const unacked = eskaliert.filter((e) => !e.acknowledged);
  const kritisch = unacked.filter((e) => e.stufe === 'kritisch').length;

  if (eskaliert.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className={cn('h-4 w-4', kritisch > 0 ? 'text-red-600 animate-pulse' : 'text-amber-500')} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Allergen-Eskalation
          </span>
          {unacked.length > 0 && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              kritisch > 0 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-700',
            )}>
              {unacked.length} unbestätigt{kritisch > 0 ? ` · ${kritisch} kritisch` : ''}
            </span>
          )}
          {unacked.length === 0 && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              alle bestätigt
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {eskaliert.map((e) => (
            <div
              key={e.orderId}
              className={cn(
                'px-4 py-3 flex items-start gap-3',
                e.stufe === 'kritisch' && !e.acknowledged ? 'bg-red-50/70 dark:bg-red-950/20' : '',
                e.stufe === 'hoch' && !e.acknowledged ? 'bg-amber-50/50 dark:bg-amber-950/10' : '',
                e.acknowledged ? 'opacity-60' : '',
              )}
            >
              <div className="shrink-0 mt-0.5">
                {e.stufe === 'kritisch'
                  ? <AlertTriangle className={cn('h-4 w-4', e.acknowledged ? 'text-muted-foreground' : 'text-red-600 animate-pulse')} />
                  : <Bell className={cn('h-4 w-4', e.acknowledged ? 'text-muted-foreground' : 'text-amber-500')} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black">#{e.bestellnummer}</span>
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                    e.stufe === 'kritisch' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800',
                  )}>
                    {e.stufe}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap gap-1">
                  {e.allergene.map((a) => (
                    <span key={a} className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-800">
                      {ALLERGEN_LABELS[a] ?? a}
                    </span>
                  ))}
                </div>

                <div className="mt-1 text-[10px] text-muted-foreground truncate">
                  {e.items.slice(0, 3).join(' · ')}{e.items.length > 3 ? ` +${e.items.length - 3}` : ''}
                </div>
              </div>

              <button
                onClick={() => setAcked((prev) => new Set([...prev, e.orderId]))}
                disabled={e.acknowledged}
                className={cn(
                  'shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                  e.acknowledged
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : 'bg-matcha-600 hover:bg-matcha-500 text-white',
                )}
              >
                <Check size={11} />
                {e.acknowledged ? 'OK' : 'Bestätigen'}
              </button>
            </div>
          ))}

          <div className="px-4 py-2 bg-muted/20 text-[10px] text-muted-foreground">
            Küchenleiter muss kritische Allergene (Nüsse, Meeresfrüchte) persönlich bestätigen
          </div>
        </div>
      )}
    </div>
  );
}
