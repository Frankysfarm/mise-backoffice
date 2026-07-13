'use client';

// Phase 1245 — Zutaten-Alarm (Kitchen)
// Wenn bestimmte Items in den letzten 30 Min häufiger als Schwelle bestellt → Alarm "Zutat X prüfen"
// Props-basiert (orders) · useMemo · Schwelle: >5 Bestellungen / 30 Min

import { useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name?: string;
  quantity?: number;
}

interface Order {
  id: string;
  created_at?: string | null;
  status?: string;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
  schwelle?: number; // Bestellungen in 30 Min ab der Alarm
}

interface ZutatenMap {
  [item: string]: string[]; // Artikel → Zutaten-Alarme
}

const ITEM_ZUTATEN_ALARM: ZutatenMap = {
  'burger': ['Hackfleisch prüfen', 'Brötchen prüfen'],
  'pizza': ['Teig prüfen', 'Tomatensauce prüfen', 'Käse prüfen'],
  'salat': ['Salatblätter prüfen', 'Dressing prüfen'],
  'pasta': ['Nudeln prüfen', 'Sauce prüfen'],
  'pommes': ['Kartoffeln prüfen', 'Frittierfett prüfen'],
  'döner': ['Fleisch prüfen', 'Fladenbrot prüfen', 'Soße prüfen'],
  'sandwich': ['Brot prüfen', 'Beläge prüfen'],
  'wrap': ['Tortilla prüfen', 'Füllung prüfen'],
  'suppe': ['Brühe prüfen', 'Einlage prüfen'],
  'dessert': ['Zuckerwaren prüfen'],
};

function findZutatenAlarm(itemName: string): string[] {
  const lower = itemName.toLowerCase();
  for (const [key, zutaten] of Object.entries(ITEM_ZUTATEN_ALARM)) {
    if (lower.includes(key)) return zutaten;
  }
  return [];
}

interface AlarmEintrag {
  item: string;
  anzahl: number;
  zutaten: string[];
  stufe: 'warnung' | 'kritisch';
}

export function KitchenPhase1245ZutatenAlarm({ orders, schwelle = 5 }: Props) {
  const [open, setOpen] = useState(true);

  const alarme = useMemo<AlarmEintrag[]>(() => {
    const now = Date.now();
    const window30 = 30 * 60 * 1000;

    // Filter: nur Bestellungen der letzten 30 Min, nicht storniert
    const recent = orders.filter((o) => {
      if (!o.created_at) return false;
      if (o.status === 'cancelled' || o.status === 'CANCELLED') return false;
      return now - new Date(o.created_at).getTime() <= window30;
    });

    // Count items
    const itemCount: Record<string, number> = {};
    recent.forEach((o) => {
      (o.items ?? []).forEach((it) => {
        if (!it.name) return;
        const n = it.name.toLowerCase().trim();
        itemCount[n] = (itemCount[n] ?? 0) + (it.quantity ?? 1);
      });
    });

    // Build alarms for items above threshold
    const result: AlarmEintrag[] = [];
    for (const [item, anzahl] of Object.entries(itemCount)) {
      if (anzahl < schwelle) continue;
      const zutaten = findZutatenAlarm(item);
      if (zutaten.length === 0) continue;
      result.push({
        item,
        anzahl,
        zutaten,
        stufe: anzahl >= schwelle * 2 ? 'kritisch' : 'warnung',
      });
    }

    return result.sort((a, b) => b.anzahl - a.anzahl);
  }, [orders, schwelle]);

  if (alarme.length === 0) return null;

  const kritisch = alarme.filter((a) => a.stufe === 'kritisch').length;

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden',
        kritisch > 0
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
          : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10',
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-5 py-4 border-b transition',
          kritisch > 0
            ? 'border-red-200 dark:border-red-800 hover:bg-red-100/50 dark:hover:bg-red-900/20'
            : 'border-amber-200 dark:border-amber-800 hover:bg-amber-100/50 dark:hover:bg-amber-900/20',
        )}
      >
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            kritisch > 0
              ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
              : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
          )}
        >
          <AlertCircle className={cn('h-4 w-4', kritisch > 0 && 'animate-pulse')} />
        </div>
        <div className="flex-1 text-left">
          <div className={cn('text-sm font-bold', kritisch > 0 ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200')}>
            Zutaten-Alarm
          </div>
          <div className={cn('text-xs', kritisch > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
            {alarme.length} Artikel über Schwelle · letzte 30 Min
            {kritisch > 0 && <span className="font-bold ml-1">· {kritisch} KRITISCH</span>}
          </div>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-black text-white',
            kritisch > 0 ? 'bg-red-600 animate-pulse' : 'bg-amber-500',
          )}
        >
          {alarme.length}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {alarme.map((alarm) => (
            <div
              key={alarm.item}
              className={cn(
                'rounded-xl border p-3',
                alarm.stufe === 'kritisch'
                  ? 'bg-white dark:bg-stone-900 border-red-200 dark:border-red-700'
                  : 'bg-white dark:bg-stone-900 border-amber-200 dark:border-amber-700',
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Package className={cn('h-3.5 w-3.5', alarm.stufe === 'kritisch' ? 'text-red-500' : 'text-amber-500')} />
                <span className="text-xs font-bold text-stone-800 dark:text-stone-100 capitalize">{alarm.item}</span>
                <span
                  className={cn(
                    'ml-auto rounded-full px-2 py-0.5 text-[9px] font-black',
                    alarm.stufe === 'kritisch'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                  )}
                >
                  {alarm.anzahl}× bestellt
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {alarm.zutaten.map((z) => (
                  <span
                    key={z}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold',
                      alarm.stufe === 'kritisch'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700',
                    )}
                  >
                    <AlertCircle className="h-2.5 w-2.5" />
                    {z}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="text-[10px] text-stone-400 dark:text-stone-500">
            Schwelle: {schwelle} Bestellungen / 30 Min
          </div>
        </div>
      )}
    </div>
  );
}
