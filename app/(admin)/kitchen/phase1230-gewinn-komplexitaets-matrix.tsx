'use client';

// Phase 1230 — Gewinn-Komplexitäts-Matrix (Kitchen)
// Kombiniert Phase1204 (Komplexitäts-Heatmap) mit Phase1221 Gewinnmarge
// Tabellarische Darstellung: Stunde × Komplexität + Bestellwert-Hochrechnung
// Props-basiert (orders); useMemo

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name?: string;
  quantity?: number;
  allergens?: string[];
  price?: number;
}

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  items?: OrderItem[] | null;
  total_price?: number | null;
}

interface Props {
  orders: Order[];
}

type Stunde = {
  stunde: number;
  label: string;
  count: number;
  avg_komplexitaet: number;
  avg_bestellwert: number;
  bruttogewinn_est: number;
  komplex_level: 'niedrig' | 'mittel' | 'hoch' | 'peak';
  gewinn_level: 'schwach' | 'normal' | 'stark' | 'top';
};

function allergenCount(items: OrderItem[]): number {
  const allergens = new Set<string>();
  for (const it of items) {
    for (const a of it.allergens ?? []) allergens.add(a.toLowerCase());
  }
  return allergens.size;
}

function komplexLevel(score: number): Stunde['komplex_level'] {
  if (score >= 8) return 'peak';
  if (score >= 5) return 'hoch';
  if (score >= 3) return 'mittel';
  return 'niedrig';
}

function gewinnLevel(gewinn: number): Stunde['gewinn_level'] {
  if (gewinn >= 25) return 'top';
  if (gewinn >= 15) return 'stark';
  if (gewinn >= 5) return 'normal';
  return 'schwach';
}

const KOMPLEX_BG: Record<Stunde['komplex_level'], string> = {
  niedrig: 'bg-emerald-100 dark:bg-emerald-900/30',
  mittel: 'bg-yellow-100 dark:bg-yellow-900/30',
  hoch: 'bg-orange-100 dark:bg-orange-900/30',
  peak: 'bg-red-100 dark:bg-red-900/30',
};

const GEWINN_TEXT: Record<Stunde['gewinn_level'], string> = {
  schwach: 'text-stone-400',
  normal: 'text-amber-600 dark:text-amber-400',
  stark: 'text-emerald-600 dark:text-emerald-400',
  top: 'text-emerald-700 dark:text-emerald-300 font-black',
};

const FAHRER_ANTEIL = 0.15;
const KOSTEN_PRO_BESTELLUNG_EST = 0.9; // Fahrtkosten-Anteil je Bestellung

export function KitchenPhase1230GewinnKomplexitaetsMatrix({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const stundenData = useMemo<Stunde[]>(() => {
    if (!orders.length) return [];

    const buckets: Record<number, { komplexScores: number[]; bestellwerte: number[] }> = {};

    for (const order of orders) {
      if (!order.created_at) continue;
      const stunde = new Date(order.created_at).getHours();
      if (!buckets[stunde]) buckets[stunde] = { komplexScores: [], bestellwerte: [] };

      const items = order.items ?? [];
      const artikelAnzahl = items.reduce((s, it) => s + (it.quantity ?? 1), 0);
      const allergens = allergenCount(items);
      const score = artikelAnzahl * (1 + allergens);
      buckets[stunde].komplexScores.push(score);

      const bestellwert = order.total_price ?? items.reduce((s, it) => s + ((it.price ?? 0) * (it.quantity ?? 1)), 0);
      buckets[stunde].bestellwerte.push(bestellwert);
    }

    return Object.entries(buckets)
      .map(([h, { komplexScores, bestellwerte }]) => {
        const stunde = Number(h);
        const avg_komplexitaet = Math.round((komplexScores.reduce((s, v) => s + v, 0) / Math.max(komplexScores.length, 1)) * 10) / 10;
        const avg_bestellwert = Math.round((bestellwerte.reduce((s, v) => s + v, 0) / Math.max(bestellwerte.length, 1)) * 100) / 100;
        const bruttogewinn_est = Math.round(
          (avg_bestellwert * (1 - FAHRER_ANTEIL) - KOSTEN_PRO_BESTELLUNG_EST) * 100,
        ) / 100;

        return {
          stunde,
          label: `${stunde.toString().padStart(2, '0')}:00`,
          count: komplexScores.length,
          avg_komplexitaet,
          avg_bestellwert,
          bruttogewinn_est,
          komplex_level: komplexLevel(avg_komplexitaet),
          gewinn_level: gewinnLevel(bruttogewinn_est),
        };
      })
      .sort((a, b) => a.stunde - b.stunde);
  }, [orders]);

  if (!stundenData.length) return null;

  const maxKomplex = Math.max(1, ...stundenData.map((s) => s.avg_komplexitaet));
  const maxGewinn = Math.max(1, ...stundenData.map((s) => Math.abs(s.bruttogewinn_est)));

  // Insight: peak-hour mit höchstem Gewinn
  const bestHour = stundenData.reduce((best, s) =>
    s.bruttogewinn_est > best.bruttogewinn_est ? s : best,
    stundenData[0],
  );

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 transition"
      >
        <BarChart2 className="h-4 w-4 text-violet-500 shrink-0" />
        <span className="font-bold text-sm text-foreground flex-1">Gewinn-Komplexitäts-Matrix</span>
        <span className="text-[10px] text-muted-foreground">
          Peak: {bestHour.label}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Stunde × Komplexität + geschätzter Bruttogewinn (nach Fahrer-Anteil &amp; Fahrtkosten)
          </p>

          {/* Tabelle */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-y-1">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="text-left pr-2 pb-1">Stunde</th>
                  <th className="text-center pb-1">Aufträge</th>
                  <th className="text-left pb-1 pl-2">Komplexität</th>
                  <th className="text-right pb-1">Ø Bestellwert</th>
                  <th className="text-right pb-1">Ø Gewinn</th>
                </tr>
              </thead>
              <tbody>
                {stundenData.map((s) => (
                  <tr key={s.stunde} className="align-middle">
                    <td className="font-bold text-foreground pr-2 tabular-nums">{s.label}</td>
                    <td className="text-center tabular-nums text-muted-foreground">{s.count}</td>
                    <td className="pl-2">
                      <div className={cn('rounded-md px-2 py-0.5 flex items-center gap-1.5', KOMPLEX_BG[s.komplex_level])}>
                        {/* Mini-Balken */}
                        <div className="h-2 rounded-full bg-current opacity-40 transition-all" style={{ width: `${Math.round((s.avg_komplexitaet / maxKomplex) * 48)}px`, minWidth: '4px' }} />
                        <span className="tabular-nums">{s.avg_komplexitaet.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {s.avg_bestellwert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>
                    <td className={cn('text-right tabular-nums', GEWINN_TEXT[s.gewinn_level])}>
                      {s.bruttogewinn_est >= 0 ? '+' : ''}{s.bruttogewinn_est.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Insight */}
          <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 px-3 py-2">
            <div className="text-[10px] font-bold text-violet-700 dark:text-violet-300">
              Bestes Gewinn-Fenster: {bestHour.label} Uhr
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Komplexität {bestHour.avg_komplexitaet.toFixed(1)} · Ø Gewinn +{bestHour.bruttogewinn_est.toFixed(2)} €
              {bestHour.komplex_level === 'niedrig' || bestHour.komplex_level === 'mittel'
                ? ' — effiziente Stunde (niedrige Komplexität, guter Gewinn)'
                : ' — hohe Auslastung, guter Gewinn'}
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground">
            Schätzung: 15% Fahrer-Anteil + 0,90 € Fahrtkosten je Bestellung
          </div>
        </div>
      )}
    </div>
  );
}
