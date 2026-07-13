'use client';

// Phase 1260 — Schicht-Abschluss-Schnappschuss (Kitchen)
// Wenn keine aktiven Orders mehr: Zusammenfassung der Schicht
// (Bestellungen / Umsatz / Ø-Zeit / bester Artikel)
// Props: orders · nur sichtbar wenn keine aktiven Orders

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Star, Clock, Package, TrendingUp } from 'lucide-react';

interface Order {
  id: string;
  status?: string;
  total_amount?: number | null;
  created_at?: string | null;
  items?: Array<{ name?: string; quantity?: number }>;
  delivered_at?: string | null;
  estimated_delivery_at?: string | null;
}

interface Props {
  orders: Order[];
}

const AKTIVE_STATUSES = new Set([
  'confirmed', 'preparing', 'ready', 'dispatched',
  'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs',
]);

const ABGESCHLOSSEN_STATUSES = new Set([
  'delivered', 'completed', 'geliefert', 'abgeschlossen',
]);

export function KitchenPhase1260SchichtAbschlussSchnappschuss({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { aktiveOrders, snapshot } = useMemo(() => {
    const aktive = orders.filter(o => AKTIVE_STATUSES.has(o.status ?? ''));
    const abgeschlossen = orders.filter(o => ABGESCHLOSSEN_STATUSES.has(o.status ?? ''));

    // Gesamtbestellungen (aktive + abgeschlossene)
    const gesamt = orders.length;

    // Umsatz
    const umsatz = abgeschlossen.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);

    // Ø-Lieferzeit
    let schnittMin: number | null = null;
    const deltas = abgeschlossen
      .map(o => {
        const start = new Date(o.created_at ?? '').getTime();
        const end = new Date(o.delivered_at ?? o.estimated_delivery_at ?? '').getTime();
        return (end - start) / 60_000;
      })
      .filter(d => d > 0 && d < 180);
    if (deltas.length > 0) {
      schnittMin = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
    }

    // Bester Artikel (häufigste Bestellung)
    const artikelCount: Record<string, number> = {};
    for (const o of orders) {
      for (const item of o.items ?? []) {
        const n = (item.name ?? '').trim();
        if (!n) continue;
        artikelCount[n] = (artikelCount[n] ?? 0) + (item.quantity ?? 1);
      }
    }
    const besterArtikel = Object.entries(artikelCount).sort((a, b) => b[1] - a[1])[0];

    return {
      aktiveOrders: aktive,
      snapshot: {
        gesamt,
        abgeschlossen: abgeschlossen.length,
        umsatz_eur: Math.round(umsatz * 100) / 100,
        schnitt_lieferzeit_min: schnittMin,
        bester_artikel: besterArtikel ? { name: besterArtikel[0], menge: besterArtikel[1] } : null,
      },
    };
  }, [orders]);

  // Nur sichtbar wenn keine aktiven Orders
  if (aktiveOrders.length > 0 || orders.length === 0) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-white bg-gradient-to-r from-matcha-600 to-emerald-600"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="text-sm font-bold flex-1 text-left">Schicht-Abschluss</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 font-bold">
          {snapshot.abgeschlossen} Bestellungen fertig
        </span>
        {open ? <ChevronUp className="h-4 w-4 opacity-80" /> : <ChevronDown className="h-4 w-4 opacity-80" />}
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-background">
          <div className="text-center">
            <div className="text-4xl mb-1">🎉</div>
            <div className="text-sm font-semibold text-foreground">Alle Bestellungen abgeschlossen!</div>
            <div className="text-xs text-muted-foreground mt-0.5">Hier ist eure Schicht-Zusammenfassung</div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 dark:border-matcha-800 p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Package className="h-3.5 w-3.5 text-matcha-600" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-matcha-600">Bestellungen</span>
              </div>
              <div className="text-3xl font-black tabular-nums text-matcha-700 dark:text-matcha-400">
                {snapshot.abgeschlossen}
              </div>
              <div className="text-[10px] text-muted-foreground">von {snapshot.gesamt} gesamt</div>
            </div>

            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Umsatz</span>
              </div>
              <div className="text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                {snapshot.umsatz_eur.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </div>
            </div>

            {snapshot.schnitt_lieferzeit_min !== null && (
              <div className="rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="h-3.5 w-3.5 text-sky-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-sky-600">Ø Lieferzeit</span>
                </div>
                <div className="text-2xl font-black tabular-nums text-sky-700 dark:text-sky-400">
                  {snapshot.schnitt_lieferzeit_min} Min
                </div>
              </div>
            )}

            {snapshot.bester_artikel && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="h-3.5 w-3.5 text-amber-600 fill-amber-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Bestseller</span>
                </div>
                <div className="text-sm font-black text-amber-700 dark:text-amber-400 truncate">
                  {snapshot.bester_artikel.name}
                </div>
                <div className="text-[10px] text-muted-foreground">{snapshot.bester_artikel.menge}× bestellt</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
