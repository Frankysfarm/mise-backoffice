'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bell, CheckCircle2, ChevronDown, ChevronUp, Clock, Shield, X } from 'lucide-react';

/**
 * Phase 1044 — Allergen-Eskalations-Flow (Kitchen)
 *
 * Automatische Erkennung komplexer Allergen-Bestellungen → Weiterleitung an Küchenleiter.
 * Acknowledge-Button quittiert die Eskalation (localStorage-Persistenz je Bestell-ID).
 */

interface Item {
  name?: string;
  title?: string;
  quantity?: number;
}

interface Order {
  id: string;
  bestellnummer?: string;
  status: string;
  kunde_notiz?: string | null;
  items?: Item[] | null;
}

interface Props {
  orders: Order[];
}

const ALLERGEN_MAP: Record<string, { label: string; emoji: string; severity: number }> = {
  erdnuss:    { label: 'Erdnuss',      emoji: '🥜', severity: 10 },
  nuss:       { label: 'Nüsse',        emoji: '🌰', severity: 9  },
  gluten:     { label: 'Gluten',       emoji: '🌾', severity: 7  },
  fisch:      { label: 'Fisch',        emoji: '🐟', severity: 8  },
  garnele:    { label: 'Meeresfrüchte', emoji: '🦐', severity: 8 },
  milch:      { label: 'Laktose',      emoji: '🥛', severity: 6  },
  käse:       { label: 'Laktose',      emoji: '🥛', severity: 6  },
  ei:         { label: 'Ei',           emoji: '🥚', severity: 6  },
  sesam:      { label: 'Sesam',        emoji: '🌿', severity: 7  },
  soja:       { label: 'Soja',         emoji: '🫘', severity: 5  },
  sellerie:   { label: 'Sellerie',     emoji: '🌿', severity: 5  },
  senf:       { label: 'Senf',         emoji: '💛', severity: 5  },
};

const ESKALATIONS_NOTIZ = /allergi|intoleran|unverträgl|anaphylax|epipen|halal|koscher|vegan\s+streng|ohne.*milch|ohne.*gluten|laktose|glutenfrei|nuss.*frei|erdnuss/i;

interface EskalierteOrder {
  id: string;
  bestellnummer: string;
  allergene: string[];
  notiz: string | null;
  schweregrad: number;
  seit: string;
}

const LS_KEY = 'phase1044_acknowledged';

function getAcknowledged(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function acknowledge(orderId: string) {
  const s = getAcknowledged();
  s.add(orderId);
  try { localStorage.setItem(LS_KEY, JSON.stringify([...s])); } catch {}
}

function detectAllergene(order: Order): string[] {
  const text = [
    order.kunde_notiz ?? '',
    ...(order.items ?? []).map(i => i.name ?? i.title ?? ''),
  ].join(' ').toLowerCase();

  return Object.entries(ALLERGEN_MAP)
    .filter(([kw]) => text.includes(kw))
    .sort((a, b) => b[1].severity - a[1].severity)
    .map(([, v]) => v.label)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 4);
}

function isKomplex(order: Order): boolean {
  if (ESKALATIONS_NOTIZ.test(order.kunde_notiz ?? '')) return true;
  const allergens = detectAllergene(order);
  return allergens.length >= 2;
}

const ACTIVE = ['neu', 'angenommen', 'in_zubereitung', 'in_bearbeitung'];

export function KitchenPhase1044AllergenEskalationsFlow({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const prevIds = useRef<Set<string>>(new Set());
  const [alertOrder, setAlertOrder] = useState<string | null>(null);

  useEffect(() => {
    setAcknowledged(getAcknowledged());
  }, []);

  const activeOrders = orders.filter(o => ACTIVE.includes(o.status));
  const eskaliert: EskalierteOrder[] = activeOrders
    .filter(o => isKomplex(o) && !acknowledged.has(o.id))
    .map(o => ({
      id: o.id,
      bestellnummer: o.bestellnummer ?? o.id.slice(-4),
      allergene: detectAllergene(o),
      notiz: o.kunde_notiz ?? null,
      schweregrad: detectAllergene(o).reduce((max, lbl) => {
        const entry = Object.values(ALLERGEN_MAP).find(v => v.label === lbl);
        return Math.max(max, entry?.severity ?? 0);
      }, 0),
      seit: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    }))
    .sort((a, b) => b.schweregrad - a.schweregrad);

  useEffect(() => {
    const newIds = new Set(eskaliert.map(e => e.id));
    for (const id of newIds) {
      if (!prevIds.current.has(id)) {
        setAlertOrder(id);
        const t = setTimeout(() => setAlertOrder(null), 4000);
        return () => clearTimeout(t);
      }
    }
    prevIds.current = newIds;
  });

  function handleAcknowledge(orderId: string) {
    acknowledge(orderId);
    setAcknowledged(getAcknowledged());
  }

  const totalCount = eskaliert.length;
  const kritischCount = eskaliert.filter(e => e.schweregrad >= 8).length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-red-500" />
          <span className="text-sm font-bold">Allergen-Eskalations-Flow</span>
          {kritischCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
              ⚠ {kritischCount} Kritisch
            </span>
          )}
          {totalCount > 0 && kritischCount === 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {totalCount} offen
            </span>
          )}
          {totalCount === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 size={9} /> Alle quittiert
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {alertOrder && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-white text-xs font-bold animate-bounce">
              <Bell size={14} />
              Neue Allergen-Eskalation — Küchenleiter informieren!
            </div>
          )}

          {eskaliert.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Keine offenen Allergen-Eskalationen. Alle komplexen Bestellungen quittiert.
            </p>
          ) : (
            eskaliert.map(e => (
              <div
                key={e.id}
                className={cn(
                  'rounded-lg border p-3 space-y-2',
                  e.schweregrad >= 8
                    ? 'border-red-300 bg-red-50'
                    : e.schweregrad >= 6
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-yellow-200 bg-yellow-50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={cn(
                        'h-4 w-4 shrink-0',
                        e.schweregrad >= 8 ? 'text-red-600' : e.schweregrad >= 6 ? 'text-amber-600' : 'text-yellow-600',
                      )}
                    />
                    <span className="text-sm font-bold">#{e.bestellnummer}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                        e.schweregrad >= 8
                          ? 'bg-red-500 text-white'
                          : e.schweregrad >= 6
                          ? 'bg-amber-400 text-white'
                          : 'bg-yellow-300 text-yellow-900',
                      )}
                    >
                      {e.schweregrad >= 8 ? 'Kritisch' : e.schweregrad >= 6 ? 'Hoch' : 'Mittel'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock size={10} />
                    {e.seit}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {e.allergene.map(a => (
                    <span key={a} className="rounded-full bg-white border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      {Object.values(ALLERGEN_MAP).find(v => v.label === a)?.emoji ?? '⚠'} {a}
                    </span>
                  ))}
                </div>

                {e.notiz && (
                  <p className="text-[11px] text-muted-foreground italic bg-white/70 rounded px-2 py-1 border border-dashed border-amber-200">
                    "{e.notiz}"
                  </p>
                )}

                <button
                  onClick={() => handleAcknowledge(e.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition"
                >
                  <CheckCircle2 size={13} />
                  Küchenleiter informiert — Quittieren
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
