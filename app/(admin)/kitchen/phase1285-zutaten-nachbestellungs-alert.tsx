'use client';

// Phase 1285 — Zutaten-Nachbestellungs-Alert (Kitchen)
// Wenn bestimmte Items in letzter Stunde >X mal bestellt: geschätzter Restbestand + Nachbestellungs-Empfehlung + Timer
// Props-basiert (orders); useMemo; nur sichtbar wenn Alarme vorhanden

import { useMemo, useState } from 'react';
import { AlertTriangle, Bell, ChevronDown, ChevronUp, Package, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name?: string | null;
  quantity?: number;
  menge?: number;
  item?: { name?: string | null; kategorie?: string | null } | null;
}

interface Order {
  id: string;
  status?: string | null;
  created_at?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

// Mapping Artikel → Zutaten + Einheit + Schwelle/h
const ZUTATEN_MAP: Record<string, { zutaten: string[]; einheit: string; bestand_einheiten: number; schwelle: number }> = {
  'burger':    { zutaten: ['Brioche-Brötchen', 'Rinderhack', 'Cheddar'],  einheit: 'Portionen', bestand_einheiten: 20, schwelle: 6 },
  'pizza':     { zutaten: ['Pizzateig', 'Tomatensauce', 'Mozzarella'],    einheit: 'Teigböden', bestand_einheiten: 25, schwelle: 7 },
  'pommes':    { zutaten: ['Kartoffeln (TK)'],                             einheit: 'kg',        bestand_einheiten: 10, schwelle: 8 },
  'salat':     { zutaten: ['Eisbergsalat', 'Cherrytomaten'],               einheit: 'Köpfe',     bestand_einheiten: 8,  schwelle: 5 },
  'lemonade':  { zutaten: ['Zitronensaft', 'Zucker', 'Mineralwasser'],    einheit: 'L Saft',    bestand_einheiten: 5,  schwelle: 10 },
  'wrap':      { zutaten: ['Wraptortilla', 'Sauerrahm'],                   einheit: 'Stück',     bestand_einheiten: 30, schwelle: 6 },
  'pasta':     { zutaten: ['Nudeln', 'Tomatensauce'],                      einheit: 'Portionen', bestand_einheiten: 18, schwelle: 6 },
  'chicken':   { zutaten: ['Hähnchenbrustfilet', 'Panade'],               einheit: 'Portionen', bestand_einheiten: 22, schwelle: 6 },
};

type Dringlichkeit = 'kritisch' | 'warnung';

interface Alarm {
  artikelName: string;
  anzahlLetzteStunde: number;
  zutaten: string[];
  einheit: string;
  geschaetzterRestbestand: number;
  dringlichkeit: Dringlichkeit;
  empfehlung: string;
}

const LEVEL_STYLE: Record<Dringlichkeit, { bg: string; border: string; badge: string; icon: string }> = {
  kritisch: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-300 dark:border-red-700',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    icon: 'text-red-500',
  },
  warnung: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-300 dark:border-amber-700',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    icon: 'text-amber-500',
  },
};

const AKTIV_STATUS = new Set(['new', 'confirmed', 'in_progress', 'preparing']);
const NACHBESTELLUNGS_SCHWELLE = 5;

export function KitchenPhase1285ZutatenNachbestellungsAlert({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const alarme = useMemo<Alarm[]>(() => {
    const jetzt = Date.now();
    const eineStundeVorher = jetzt - 60 * 60 * 1000;

    // Count items ordered in the last hour (active + recent orders)
    const itemCount = new Map<string, number>();
    for (const order of orders) {
      const orderZeit = order.created_at ? new Date(order.created_at).getTime() : 0;
      if (orderZeit < eineStundeVorher) continue;
      for (const item of order.items ?? []) {
        const nameRaw = item.item?.name ?? item.name ?? '';
        const name = nameRaw.toLowerCase();
        const menge = item.quantity ?? item.menge ?? 1;
        for (const key of Object.keys(ZUTATEN_MAP)) {
          if (name.includes(key)) {
            itemCount.set(key, (itemCount.get(key) ?? 0) + menge);
            break;
          }
        }
      }
    }

    const result: Alarm[] = [];
    for (const [key, anzahl] of itemCount.entries()) {
      const info = ZUTATEN_MAP[key];
      if (!info || anzahl < NACHBESTELLUNGS_SCHWELLE) continue;
      const verbraucht = anzahl;
      const geschaetzterRestbestand = Math.max(0, info.bestand_einheiten - verbraucht);
      const dringlichkeit: Dringlichkeit = geschaetzterRestbestand <= 3 || anzahl >= info.schwelle * 2 ? 'kritisch' : 'warnung';
      result.push({
        artikelName: key.charAt(0).toUpperCase() + key.slice(1),
        anzahlLetzteStunde: anzahl,
        zutaten: info.zutaten,
        einheit: info.einheit,
        geschaetzterRestbestand,
        dringlichkeit,
        empfehlung: geschaetzterRestbestand <= 3
          ? 'Sofort nachbestellen!'
          : `Noch ca. ${geschaetzterRestbestand} ${info.einheit} vorhanden – bald nachbestellen.`,
      });
    }

    return result.sort((a, b) => {
      if (a.dringlichkeit === 'kritisch' && b.dringlichkeit !== 'kritisch') return -1;
      if (a.dringlichkeit !== 'kritisch' && b.dringlichkeit === 'kritisch') return 1;
      return a.geschaetzterRestbestand - b.geschaetzterRestbestand;
    });
  }, [orders]);

  if (alarme.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-amber-100/40 dark:hover:bg-amber-950/30 transition-colors"
      >
        <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
        <span className="flex-1 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
          Nachbestellungs-Alarm
        </span>
        <span className="rounded-full bg-amber-600 text-white text-[10px] font-black px-2 py-0.5">
          {alarme.length} Artikel
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
      </button>

      {open && (
        <div className="border-t border-amber-200 dark:border-amber-800 px-4 py-3 space-y-2.5">
          {alarme.map(alarm => {
            const style = LEVEL_STYLE[alarm.dringlichkeit];
            return (
              <div
                key={alarm.artikelName}
                className={cn('rounded-lg border p-3', style.bg, style.border)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', style.icon)} />
                  <span className="font-bold text-sm text-foreground">{alarm.artikelName}</span>
                  <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[10px] font-black', style.badge)}>
                    {alarm.dringlichkeit === 'kritisch' ? 'Kritisch' : 'Warnung'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] mb-2">
                  <div className="text-muted-foreground">Letzte Stunde:</div>
                  <div className="font-bold tabular-nums text-foreground">{alarm.anzahlLetzteStunde}× bestellt</div>
                  <div className="text-muted-foreground">Restbestand ~:</div>
                  <div className={cn('font-bold tabular-nums', alarm.geschaetzterRestbestand <= 3 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                    {alarm.geschaetzterRestbestand} {alarm.einheit}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {alarm.zutaten.map(z => (
                    <span key={z} className="inline-flex items-center gap-0.5 rounded-full bg-white/70 dark:bg-black/20 border border-current/20 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Package className="h-2.5 w-2.5" />
                      {z}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <ShoppingCart className={cn('h-3 w-3 shrink-0', style.icon)} />
                  <span className={style.icon}>{alarm.empfehlung}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
