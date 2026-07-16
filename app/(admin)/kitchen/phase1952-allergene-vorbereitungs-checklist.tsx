'use client';

import { useMemo, useState } from 'react';
import { ShieldAlert, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  created_at?: string;
  status?: string;
  items?: Array<{ name?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

type AllergenKey = 'nuesse' | 'gluten' | 'laktose' | 'fisch';

interface AllergenConfig {
  label: string;
  keywords: string[];
  color: string;
  bg: string;
}

const ALLERGENE: Record<AllergenKey, AllergenConfig> = {
  nuesse:  { label: 'Nüsse',   keywords: ['nuss', 'nüsse', 'mandel', 'cashew', 'walnuss', 'haselnuss', 'erdnuss', 'pistazie', 'pekan'],  color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700' },
  gluten:  { label: 'Gluten',  keywords: ['brot', 'brötchen', 'pasta', 'mehl', 'weizen', 'gerste', 'roggen', 'dinkel', 'semmel', 'schnitzel', 'panier'], color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700' },
  laktose: { label: 'Laktose', keywords: ['käse', 'sahne', 'butter', 'milch', 'quark', 'joghurt', 'mozzarella', 'parmesan', 'crème'],    color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' },
  fisch:   { label: 'Fisch',   keywords: ['fisch', 'lachs', 'thunfisch', 'forelle', 'kabeljau', 'hering', 'makrele', 'shrimp', 'garnele', 'meeresfrüchte'], color: 'text-cyan-700 dark:text-cyan-300',   bg: 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700' },
};

function allergenFlags(order: Order): AllergenKey[] {
  const text = [
    ...(order.items ?? []).map((i) => i.name ?? ''),
    String(order['notes'] ?? ''),
    String(order['comment'] ?? ''),
  ]
    .join(' ')
    .toLowerCase();

  return (Object.keys(ALLERGENE) as AllergenKey[]).filter((key) =>
    ALLERGENE[key].keywords.some((kw) => text.includes(kw)),
  );
}

const WARN_MIN = 10;

export default function KitchenPhase1952AllergenVorbereitungsChecklist({
  orders,
  className,
}: {
  orders: Order[];
  className?: string;
}) {
  const [offen, setOffen] = useState(true);
  const [bestaetigt, setBestaetigt] = useState<Set<string>>(new Set());

  const bestellungenMitAllergen = useMemo(() => {
    const aktiv = orders.filter((o) =>
      o.status === 'pending' || o.status === 'in_progress' || o.status === 'preparing',
    );

    return aktiv
      .map((o) => ({ order: o, flags: allergenFlags(o), alter: Math.round((Date.now() - new Date(o.created_at ?? Date.now()).getTime()) / 60000) }))
      .filter((e) => e.flags.length > 0);
  }, [orders]);

  const unbestaetigt = bestellungenMitAllergen.filter((e) => !bestaetigt.has(e.order.id));
  const ueberfaelligAlert = unbestaetigt.filter((e) => e.alter >= WARN_MIN);

  const toggleBestaetigt = (id: string) => {
    setBestaetigt((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
            Allergene-Vorbereitungs-Checklist
          </span>
          {bestellungenMitAllergen.length > 0 && (
            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">
              {bestellungenMitAllergen.length} Bestellung{bestellungenMitAllergen.length !== 1 ? 'en' : ''}
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          {ueberfaelligAlert.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                {ueberfaelligAlert.length} Allergen-Bestellung{ueberfaelligAlert.length !== 1 ? 'en' : ''} seit über {WARN_MIN} Min unbestätigt!
              </p>
            </div>
          )}

          {bestellungenMitAllergen.length === 0 ? (
            <p className="px-4 py-4 text-xs text-slate-400 text-center">
              Keine Allergen-Bestellungen aktiv.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {bestellungenMitAllergen.map(({ order, flags, alter }) => {
                const checked = bestaetigt.has(order.id);
                const warn = !checked && alter >= WARN_MIN;

                return (
                  <div
                    key={order.id}
                    className={cn(
                      'px-4 py-3 flex items-start gap-3',
                      checked ? 'opacity-50' : warn ? 'bg-red-50 dark:bg-red-900/10' : '',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBestaetigt(order.id)}
                      className="mt-1 w-4 h-4 accent-green-600 cursor-pointer"
                      aria-label={`Bestätigt: Bestellung ${order.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          #{String(order.id).slice(-6).toUpperCase()}
                        </span>
                        <span className={cn(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded',
                          warn
                            ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500',
                        )}>
                          {alter} Min
                        </span>
                        {warn && (
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {flags.map((key) => {
                          const cfg = ALLERGENE[key];
                          return (
                            <span
                              key={key}
                              className={cn(
                                'text-[9px] font-bold px-2 py-0.5 rounded-full border',
                                cfg.bg,
                                cfg.color,
                              )}
                            >
                              {cfg.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
