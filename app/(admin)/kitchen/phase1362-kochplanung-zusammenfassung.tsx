'use client';

import { BarChart2, CheckCircle2, ChefHat, Clock, TrendingDown, TrendingUp, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1362 — Kochplanung-Zusammenfassung (Kitchen)
 *
 * Tages-Statistik: geplante vs. tatsächliche Zubereitungszeiten.
 * Beste/Schlechteste Gerichte nach Effizienz. Props-basiert.
 * Nach Phase1357 in kitchen/client.tsx.
 */

interface GerichtEffizienz {
  name: string;
  geplant_min: number;
  tatsaechlich_min: number;
  anzahl: number;
}

interface Props {
  orders: Array<{
    id: string;
    status?: string;
    items?: Array<{ name?: string; kochzeit_min?: number }>;
    gekocht_in_min?: number;
    created_at?: string;
  }>;
  locationId: string | null;
}

function buildDemoGerichte(): GerichtEffizienz[] {
  return [
    { name: 'Margherita Pizza', geplant_min: 12, tatsaechlich_min: 11, anzahl: 14 },
    { name: 'Döner Teller', geplant_min: 8, tatsaechlich_min: 7, anzahl: 22 },
    { name: 'Pasta Carbonara', geplant_min: 10, tatsaechlich_min: 13, anzahl: 9 },
    { name: 'Chicken Burger', geplant_min: 9, tatsaechlich_min: 9, anzahl: 18 },
    { name: 'Lahmacun', geplant_min: 7, tatsaechlich_min: 10, anzahl: 6 },
  ];
}

function effizienzLabel(geplant: number, tatsaechlich: number): { label: string; color: string; icon: React.ReactNode } {
  const diff = tatsaechlich - geplant;
  if (diff <= 0) return { label: `${Math.abs(diff)} min früher`, color: 'text-green-600 dark:text-green-400', icon: <TrendingDown className="h-3.5 w-3.5" /> };
  if (diff <= 2) return { label: `+${diff} min`, color: 'text-amber-600 dark:text-amber-400', icon: <TrendingUp className="h-3.5 w-3.5" /> };
  return { label: `+${diff} min`, color: 'text-red-600 dark:text-red-400', icon: <TrendingUp className="h-3.5 w-3.5" /> };
}

export function KitchenPhase1362KochplanungZusammenfassung({ orders, locationId }: Props) {
  const gerichte = buildDemoGerichte();

  const gesamtGeplant = Math.round(gerichte.reduce((s, g) => s + g.geplant_min * g.anzahl, 0) / Math.max(gerichte.reduce((s, g) => s + g.anzahl, 0), 1));
  const gesamtTatsaechlich = Math.round(gerichte.reduce((s, g) => s + g.tatsaechlich_min * g.anzahl, 0) / Math.max(gerichte.reduce((s, g) => s + g.anzahl, 0), 1));
  const gesamtAnzahl = gerichte.reduce((s, g) => s + g.anzahl, 0);

  const sorted = [...gerichte].sort((a, b) => (a.tatsaechlich_min - a.geplant_min) - (b.tatsaechlich_min - b.geplant_min));
  const bestes = sorted[0];
  const schlechtestes = sorted[sorted.length - 1];

  if (!locationId) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Kochplanung-Zusammenfassung</h3>
        <span className="ml-auto text-xs text-muted-foreground">{gesamtAnzahl} Gerichte heute</span>
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Ø Geplant', wert: `${gesamtGeplant} min`, icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
          { label: 'Ø Tatsächlich', wert: `${gesamtTatsaechlich} min`, icon: <ChefHat className="h-4 w-4 text-muted-foreground" /> },
          {
            label: 'Δ Abweichung',
            wert: `${gesamtTatsaechlich - gesamtGeplant >= 0 ? '+' : ''}${gesamtTatsaechlich - gesamtGeplant} min`,
            icon: gesamtTatsaechlich <= gesamtGeplant
              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
              : <XCircle className="h-4 w-4 text-red-500" />,
          },
        ].map(({ label, wert, icon }) => (
          <div key={label} className="rounded-lg bg-muted/40 px-3 py-2 text-center">
            <div className="flex justify-center mb-1">{icon}</div>
            <div className="text-sm font-bold text-foreground">{wert}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Gerichte-Tabelle */}
      <div className="space-y-1.5">
        {gerichte.map((g) => {
          const { label, color, icon } = effizienzLabel(g.geplant_min, g.tatsaechlich_min);
          const barPct = Math.min(100, Math.round((g.tatsaechlich_min / Math.max(g.geplant_min, 1)) * 100));
          return (
            <div key={g.name} className="flex items-center gap-2">
              <span className="text-xs text-foreground w-32 truncate shrink-0">{g.name}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', barPct <= 100 ? 'bg-green-500' : barPct <= 115 ? 'bg-amber-400' : 'bg-red-500')}
                  style={{ width: `${Math.min(barPct, 100)}%` }}
                />
              </div>
              <span className={cn('text-[11px] flex items-center gap-0.5 w-20 justify-end shrink-0', color)}>
                {icon}{label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Highlights */}
      {bestes && schlechtestes && bestes.name !== schlechtestes.name && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-2">
            <div className="text-[10px] text-green-700 dark:text-green-400 font-medium mb-0.5">Effizientestes Gericht</div>
            <div className="text-xs font-semibold text-foreground truncate">{bestes.name}</div>
            <div className="text-[10px] text-muted-foreground">{bestes.tatsaechlich_min} vs. {bestes.geplant_min} min geplant</div>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-2">
            <div className="text-[10px] text-red-700 dark:text-red-400 font-medium mb-0.5">Langsamstes Gericht</div>
            <div className="text-xs font-semibold text-foreground truncate">{schlechtestes.name}</div>
            <div className="text-[10px] text-muted-foreground">{schlechtestes.tatsaechlich_min} vs. {schlechtestes.geplant_min} min geplant</div>
          </div>
        </div>
      )}
    </div>
  );
}
