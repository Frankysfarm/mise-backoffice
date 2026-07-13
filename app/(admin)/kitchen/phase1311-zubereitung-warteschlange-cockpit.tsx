'use client';

// Phase 1311 — Zubereitung-Warteschlange-Cockpit (Kitchen)
// Liste aller offenen Bestellungen sortiert nach Dringlichkeit + Ampel-Status + Zubereitungszeit-Schätzung
// Props-basiert · nach Phase1305

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_number?: string | number;
  status?: string;
  status_label?: string;
  created_at?: string;
  eta_pickup?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  item_count?: number;
}

interface Props {
  orders: Order[];
}

type Dringlichkeit = 'ueberfaellig' | 'kritisch' | 'dringend' | 'normal' | 'erledigt';

interface BestellungRow {
  order: Order;
  dringlichkeit: Dringlichkeit;
  verbleibendMin: number | null;
  geschaetztMin: number;
  label: string;
}

const FERTIG_STATUS = ['ready', 'done', 'prepared', 'fertig', 'delivered', 'completed'];
const AKTIV_STATUS  = ['confirmed', 'preparing', 'in_preparation', 'cooking', 'kocht', 'pending'];

const DRING_CFG: Record<Dringlichkeit, { bg: string; border: string; text: string; badge: string; label: string }> = {
  ueberfaellig: { bg: 'bg-red-50 dark:bg-red-950/30',    border: 'border-red-300 dark:border-red-700',    text: 'text-red-700 dark:text-red-300',    badge: 'bg-red-500 text-white',              label: 'ÜBERFÄLLIG' },
  kritisch:     { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-500 text-white',           label: 'KRITISCH' },
  dringend:     { bg: 'bg-amber-50 dark:bg-amber-950/30',  border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-700 dark:text-amber-300',   badge: 'bg-amber-400 text-white',            label: 'Dringend' },
  normal:       { bg: 'bg-card',                            border: 'border-border',                            text: 'text-foreground',                       badge: 'bg-muted text-muted-foreground',     label: 'Normal' },
  erledigt:     { bg: 'bg-emerald-50/50 dark:bg-emerald-950/10', border: 'border-emerald-100 dark:border-emerald-900', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', label: 'Fertig' },
};

function minutenBis(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return (new Date(iso).getTime() - Date.now()) / 60000;
}

function bestimmeDringlichkeit(verbleibend: number | null, status: string | undefined): Dringlichkeit {
  const fertig = FERTIG_STATUS.includes(status ?? '');
  if (fertig) return 'erledigt';
  if (verbleibend === null) return 'normal';
  if (verbleibend < 0) return 'ueberfaellig';
  if (verbleibend < 3) return 'kritisch';
  if (verbleibend < 8) return 'dringend';
  return 'normal';
}

const DRING_ORDER: Dringlichkeit[] = ['ueberfaellig', 'kritisch', 'dringend', 'normal', 'erledigt'];

function baueListe(orders: Order[]): BestellungRow[] {
  return orders
    .filter((o) => AKTIV_STATUS.includes(o.status ?? '') || FERTIG_STATUS.includes(o.status ?? ''))
    .map((o) => {
      const verbleibend = minutenBis(o.eta_pickup);
      const geschaetztMin = o.geschaetzte_zubereitung_min ?? 15;
      const dring = bestimmeDringlichkeit(verbleibend, o.status);
      const label =
        dring === 'erledigt' ? 'Fertig' :
        verbleibend === null ? '— Min' :
        verbleibend < 0 ? `${Math.abs(Math.round(verbleibend))} Min überfällig` :
        `${Math.round(verbleibend)} Min verbleibend`;
      return { order: o, dringlichkeit: dring, verbleibendMin: verbleibend, geschaetztMin, label };
    })
    .sort((a, b) => DRING_ORDER.indexOf(a.dringlichkeit) - DRING_ORDER.indexOf(b.dringlichkeit));
}

export function KitchenPhase1311ZubereitungWarteschlangeKockpit({ orders }: Props) {
  const [offen, setOffen] = useState(true);

  const liste = useMemo(() => baueListe(orders), [orders]);
  const aktiv  = liste.filter((r) => r.dringlichkeit !== 'erledigt');
  const fertig = liste.filter((r) => r.dringlichkeit === 'erledigt');

  const kritischAnzahl = liste.filter((r) => r.dringlichkeit === 'ueberfaellig' || r.dringlichkeit === 'kritisch').length;

  return (
    <div className="rounded-xl border bg-card mb-3 overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition"
      >
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold">Zubereitung-Warteschlange</span>
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
            {aktiv.length} aktiv
          </span>
          {kritischAnzahl > 0 && (
            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">
              {kritischAnzahl}!
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="px-3 pb-3 space-y-1.5">
          {liste.length === 0 && (
            <div className="flex items-center gap-2 py-3 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs">Keine offenen Bestellungen</span>
            </div>
          )}

          {aktiv.map(({ order, dringlichkeit, geschaetztMin, label }) => {
            const cfg = DRING_CFG[dringlichkeit];
            return (
              <div key={order.id} className={cn('rounded-lg border px-3 py-2', cfg.bg, cfg.border)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', cfg.badge)}>
                      {cfg.label}
                    </span>
                    <span className="text-xs font-semibold truncate">
                      #{order.order_number ?? order.id.slice(0, 6)}
                    </span>
                    {order.item_count != null && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{order.item_count} Items</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    <Clock className={cn('h-3 w-3', cfg.text)} />
                    <span className={cn('text-[11px] font-bold tabular-nums', cfg.text)}>{label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">Schätzung: {geschaetztMin} Min</span>
                  {(dringlichkeit === 'ueberfaellig' || dringlichkeit === 'kritisch') && (
                    <AlertTriangle className={cn('h-2.5 w-2.5 ml-0.5', cfg.text)} />
                  )}
                </div>
              </div>
            );
          })}

          {fertig.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] text-muted-foreground mb-1">Fertig ({fertig.length})</p>
              {fertig.slice(0, 3).map(({ order }) => (
                <div key={order.id} className="flex items-center gap-2 py-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">#{order.order_number ?? order.id.slice(0, 6)}</span>
                </div>
              ))}
              {fertig.length > 3 && (
                <p className="text-[10px] text-muted-foreground">+ {fertig.length - 3} weitere fertig</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
