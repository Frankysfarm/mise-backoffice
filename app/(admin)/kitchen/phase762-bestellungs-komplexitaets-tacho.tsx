'use client';

import { useMemo, useState } from 'react';
import { Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface OrderItem {
  name: string;
  menge: number;
}

interface Order {
  id: string;
  status?: string;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
}

const KOMPLEXE_KEYWORDS = ['pizza', 'burger', 'grill', 'steak', 'risotto', 'pasta', 'schnitzel', 'fisch', 'sushi'];
const EINFACHE_KEYWORDS = ['salat', 'suppe', 'brot', 'snack', 'cola', 'wasser', 'kaffee'];

function itemKomplexitaet(name: string): number {
  const lower = name.toLowerCase();
  if (KOMPLEXE_KEYWORDS.some((k) => lower.includes(k))) return 3;
  if (EINFACHE_KEYWORDS.some((k) => lower.includes(k))) return 1;
  return 2;
}

function komplexitaetFarbe(score: number) {
  if (score >= 70) return { balken: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Hoch' };
  if (score >= 40) return { balken: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Mittel' };
  return { balken: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'Niedrig' };
}

export function KitchenPhase762BestellungsKomplexitaetsTacho({ orders }: Props) {
  const [offen, setOffen] = useState(false);

  const { score, aktiveBestellungen, gesamtItems } = useMemo(() => {
    const aktiv = orders.filter((o) =>
      ['pending', 'confirmed', 'preparing', 'new', 'in_kitchen'].includes(o.status ?? '')
    );
    let totalKomplexitaet = 0;
    let gesamtItems = 0;
    for (const o of aktiv) {
      for (const item of o.items ?? []) {
        const k = itemKomplexitaet(item.name) * item.menge;
        totalKomplexitaet += k;
        gesamtItems += item.menge;
      }
    }
    const maxErwartet = Math.max(aktiv.length * 3 * 2.5, 1);
    const score = Math.min(100, Math.round((totalKomplexitaet / maxErwartet) * 100));
    return { score, aktiveBestellungen: aktiv.length, gesamtItems };
  }, [orders]);

  const farbe = komplexitaetFarbe(score);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Zap className={`h-4 w-4 ${score >= 70 ? 'text-red-500 animate-pulse' : 'text-amber-400'}`} />
          <span className="text-sm font-semibold">Küchen-Komplexität</span>
          <span className={`text-xs font-bold ${farbe.text}`}>{farbe.label} · {score}%</span>
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          {/* Tacho-Balken */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Komplexitäts-Score</span>
              <span className={`font-bold ${farbe.text}`}>{score} / 100</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${farbe.balken}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Aktive Bestellungen</p>
              <p className="text-xl font-black">{aktiveBestellungen}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Gesamt Artikel</p>
              <p className="text-xl font-black">{gesamtItems}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Score basiert auf Artikel-Komplexität × Menge aller aktiven Bestellungen.
          </p>
        </div>
      )}
    </div>
  );
}
