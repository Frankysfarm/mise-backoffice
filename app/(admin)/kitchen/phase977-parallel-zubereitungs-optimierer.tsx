'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Layers, Zap, Clock, CheckCircle2 } from 'lucide-react';

/**
 * Phase 977 — Parallel-Zubereitungs-Optimierer (Kitchen)
 *
 * Schlägt vor welche Bestellungen parallel gestartet werden sollen
 * um maximalen Küchendurchsatz zu erreichen. Client-seitig via useMemo.
 */

interface Order {
  id: string;
  status: string;
  bestellnummer?: string | null;
  items?: Array<{ name?: string; title?: string; prep_time?: number }> | null;
  artikel?: Array<{ name?: string; title?: string }> | null;
  positionen?: Array<{ name?: string; title?: string }> | null;
  created_at?: string | null;
  promised_at?: string | null;
}

interface Props {
  orders: Order[];
}

interface ParallelGruppe {
  id: string;
  bestellungen: Array<{
    bestellnummer: string;
    items: string[];
    prep_min: number;
  }>;
  zeitersparnis_min: number;
  empfehlung: string;
}

const WARTE_STATUSES = ['neu', 'bestätigt', 'eingegangen', 'accepted', 'confirmed'];
const ACTIVE_STATUSES = ['in_zubereitung', 'zubereitung', 'preparing', 'in_preparation'];

// Schätze Zubereitungszeit in Minuten basierend auf Artikelanzahl und Namen
function estimatePrepMin(order: Order): number {
  const arr = order.items ?? order.artikel ?? order.positionen ?? [];
  const base = Math.max(8, arr.length * 3);
  const hasComplex = arr.some((i: { name?: string; title?: string }) => {
    const t = (i.name ?? i.title ?? '').toLowerCase();
    return t.includes('steak') || t.includes('schnitzel') || t.includes('auflauf') || t.includes('pizza');
  });
  return hasComplex ? base + 5 : base;
}

function getItemNames(order: Order): string[] {
  const arr = order.items ?? order.artikel ?? order.positionen ?? [];
  return arr.map((i: { name?: string; title?: string }) => i.name ?? i.title ?? '').filter(Boolean).slice(0, 3);
}

function getBnr(order: Order): string {
  return order.bestellnummer ?? order.id.slice(-4).toUpperCase();
}

// Prüfe ob zwei Bestellungen gut parallel laufen können (ähnliche Prepzeit + unterschiedliche Stationen)
function canParallel(a: Order, b: Order): boolean {
  const aNames = getItemNames(a).join(' ').toLowerCase();
  const bNames = getItemNames(b).join(' ').toLowerCase();
  // Nicht sinnvoll wenn beide denselben Engpass haben (z.B. beide Pizza)
  const aGroupe = aNames.includes('pizza') ? 'pizza' : aNames.includes('suppe') ? 'suppe' : 'grill';
  const bGroupe = bNames.includes('pizza') ? 'pizza' : bNames.includes('suppe') ? 'suppe' : 'grill';
  return aGroupe !== bGroupe;
}

export function KitchenPhase977ParallelZubereitungsOptimierer({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const gruppen = useMemo<ParallelGruppe[]>(() => {
    const wartend = orders.filter(o => WARTE_STATUSES.includes(o.status));
    const aktiv   = orders.filter(o => ACTIVE_STATUSES.includes(o.status));

    if (wartend.length < 2) return [];

    const result: ParallelGruppe[] = [];
    const verwendet = new Set<string>();

    // Finde Paare oder Tripel die gut parallel gehen
    for (let i = 0; i < wartend.length; i++) {
      if (verwendet.has(wartend[i].id)) continue;
      const gruppe: typeof wartend = [wartend[i]];
      for (let j = i + 1; j < wartend.length && gruppe.length < 3; j++) {
        if (verwendet.has(wartend[j].id)) continue;
        if (canParallel(gruppe[gruppe.length - 1], wartend[j])) {
          gruppe.push(wartend[j]);
        }
      }
      if (gruppe.length < 2) continue;

      const prepZeiten = gruppe.map(estimatePrepMin);
      const sequenziell = prepZeiten.reduce((a, b) => a + b, 0);
      const parallel = Math.max(...prepZeiten);
      const ersparnis = Math.round(sequenziell - parallel);

      if (ersparnis > 0) {
        gruppe.forEach(o => verwendet.add(o.id));
        result.push({
          id: `grp-${result.length + 1}`,
          bestellungen: gruppe.map((o, idx) => ({
            bestellnummer: getBnr(o),
            items: getItemNames(o),
            prep_min: prepZeiten[idx],
          })),
          zeitersparnis_min: ersparnis,
          empfehlung: gruppe.length === 3
            ? 'Drei Stationen gleichzeitig — max. Durchsatz!'
            : 'Zwei Stationen gleichzeitig starten.',
        });
      }
    }

    // Priorität nach Zeitersparnis
    return result.sort((a, b) => b.zeitersparnis_min - a.zeitersparnis_min).slice(0, 4);
  }, [orders]);

  const aktivAnzahl = orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length;
  const gesamtersparnis = gruppen.reduce((s, g) => s + g.zeitersparnis_min, 0);

  if (gruppen.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden" data-kitchen-phase="977">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Layers className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="font-bold text-sm flex-1">Parallel-Zubereitungs-Optimierer</span>
        {gesamtersparnis > 0 && (
          <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 text-[10px] font-black">
            −{gesamtersparnis} Min gespart
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Info-Zeile */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground border-t pt-3">
            <span><span className="font-bold text-foreground">{gruppen.length}</span> Parallelgruppe{gruppen.length !== 1 ? 'n' : ''}</span>
            <span>·</span>
            <span><span className="font-bold text-foreground">{aktivAnzahl}</span> aktiv in Küche</span>
            <span>·</span>
            <span className="text-blue-600 font-bold">~{gesamtersparnis} Min Gesamt-Ersparnis</span>
          </div>

          {gruppen.map((g, gIdx) => (
            <div key={g.id} className="rounded-xl border bg-blue-50/50 dark:bg-blue-950/10 overflow-hidden">
              {/* Gruppe Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-100/60 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800">
                <Zap className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="text-[11px] font-black text-blue-800 dark:text-blue-200">
                  Gruppe {gIdx + 1} — {g.empfehlung}
                </span>
                <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                  <Clock className="h-3 w-3" />
                  −{g.zeitersparnis_min} Min
                </div>
              </div>

              {/* Bestellungen */}
              <div className="divide-y divide-blue-100 dark:divide-blue-900/40">
                {g.bestellungen.map((b, bIdx) => (
                  <div key={bIdx} className="flex items-start gap-3 px-3 py-2">
                    <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                      {bIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black">#{b.bestellnummer}</span>
                        <span className="text-[10px] text-muted-foreground">~{b.prep_min} Min</span>
                      </div>
                      {b.items.length > 0 && (
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {b.items.join(' · ')}
                        </div>
                      )}
                    </div>
                    <CheckCircle2 className={cn(
                      'h-4 w-4 shrink-0 mt-0.5',
                      bIdx === 0 ? 'text-blue-600' : 'text-blue-400',
                    )} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="text-[10px] text-muted-foreground text-center pt-1">
            Zeitersparnis durch gleichzeitigen Start auf separaten Stationen
          </div>
        </div>
      )}
    </div>
  );
}
