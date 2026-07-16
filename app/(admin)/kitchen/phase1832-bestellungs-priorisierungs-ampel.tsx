'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Flame, Clock } from 'lucide-react';

/**
 * Phase 1832 — Bestellungs-Priorisierungs-Ampel (Kitchen)
 *
 * Aktive Bestellungen sortiert nach Dringlichkeit (ETA-Nähe + Komplexität).
 * Ampel grün/gelb/rot je Bestellung; Alert bei rot. useMemo; Collapsible.
 */

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  eta_minutes?: number;
  etaMinuten?: number;
  items?: { name?: string; menge?: number; quantity?: number }[];
  produkte?: { name?: string; menge?: number; quantity?: number }[];
  order_number?: string | number;
  orderNumber?: string | number;
}

interface Props {
  orders: Order[];
  rotSchwelle?: number;
  gelbSchwelle?: number;
  className?: string;
}

type Ampel = 'gruen' | 'gelb' | 'rot';

interface BestellungPrio {
  id: string;
  bezeichnung: string;
  minutenAktiv: number;
  etaMinuten: number;
  verbleibendMinuten: number;
  komplexitaet: number;
  ampel: Ampel;
  dringlichkeitScore: number;
}

const AKTIVE_STATUS = new Set([
  'new', 'confirmed', 'accepted', 'preparing', 'in_progress', 'in_zubereitung',
]);

const AMPEL_STYLE: Record<Ampel, { bg: string; border: string; text: string; badge: string; dot: string; balken: string }> = {
  gruen: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-800',
    text: 'text-matcha-700 dark:text-matcha-300',
    badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
    dot: 'bg-matcha-500',
    balken: 'bg-matcha-400',
  },
  gelb: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-400',
    balken: 'bg-amber-400',
  },
  rot: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    dot: 'bg-red-500',
    balken: 'bg-red-500',
  },
};

function ampelBerechnen(verbleibend: number, aktiv: number): Ampel {
  if (verbleibend <= 0) return 'rot';
  if (verbleibend <= 5 || aktiv > 25) return 'rot';
  if (verbleibend <= 10 || aktiv > 15) return 'gelb';
  return 'gruen';
}

function dringlichkeitBerechnen(verbleibend: number, komplexitaet: number): number {
  const zeitScore = verbleibend <= 0 ? 100 : Math.max(0, 100 - verbleibend * 4);
  const komplexScore = Math.min(100, komplexitaet * 10);
  return Math.round(zeitScore * 0.7 + komplexScore * 0.3);
}

export function KitchenPhase1832BestellungsPriorisierungsAmpel({
  orders,
  rotSchwelle = 5,
  gelbSchwelle = 10,
  className,
}: Props) {
  const [open, setOpen] = useState(true);

  const prioListe = useMemo((): BestellungPrio[] => {
    const jetzt = Date.now();

    return orders
      .filter(o => !o.status || AKTIVE_STATUS.has(o.status))
      .map(o => {
        const erstelltAm = o.created_at ?? o.createdAt;
        const minutenAktiv = erstelltAm
          ? Math.round((jetzt - new Date(erstelltAm).getTime()) / 60_000)
          : 0;
        const etaMinuten = o.eta_minutes ?? o.etaMinuten ?? 30;
        const verbleibendMinuten = etaMinuten - minutenAktiv;
        const items = o.items ?? o.produkte ?? [];
        const komplexitaet = items.reduce((s, i) => s + (i.menge ?? i.quantity ?? 1), 0);

        const nr = o.order_number ?? o.orderNumber ?? o.id.slice(-4);
        return {
          id: o.id,
          bezeichnung: `#${nr}`,
          minutenAktiv,
          etaMinuten,
          verbleibendMinuten,
          komplexitaet,
          ampel: ampelBerechnen(verbleibendMinuten, minutenAktiv),
          dringlichkeitScore: dringlichkeitBerechnen(verbleibendMinuten, komplexitaet),
        };
      })
      .sort((a, b) => b.dringlichkeitScore - a.dringlichkeitScore);
  }, [orders]);

  const rotAnzahl = useMemo(() => prioListe.filter(b => b.ampel === 'rot').length, [prioListe]);
  const gelbAnzahl = useMemo(() => prioListe.filter(b => b.ampel === 'gelb').length, [prioListe]);

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Bestellungs-Priorität</span>
          {rotAnzahl > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />{rotAnzahl} Kritisch
            </span>
          )}
          {rotAnzahl === 0 && gelbAnzahl > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              {gelbAnzahl} Dringend
            </span>
          )}
          {rotAnzahl === 0 && gelbAnzahl === 0 && prioListe.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-matcha-100 dark:bg-matcha-900/40 px-2 py-0.5 text-[10px] font-semibold text-matcha-700 dark:text-matcha-300">
              <CheckCircle2 className="h-3 w-3" />Alles grün
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-1">{prioListe.length} aktiv</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-1.5">
          {prioListe.length === 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border px-3 py-3">
              <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
              <span className="text-xs text-muted-foreground">Keine aktiven Bestellungen.</span>
            </div>
          )}

          {rotAnzahl > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                {rotAnzahl} Bestellung{rotAnzahl > 1 ? 'en' : ''} überfällig oder kritisch — sofort bearbeiten!
              </span>
            </div>
          )}

          {prioListe.map(b => {
            const s = AMPEL_STYLE[b.ampel];
            const fortschrittPct = Math.min(100, Math.max(0, (b.minutenAktiv / b.etaMinuten) * 100));
            return (
              <div key={b.id} className={cn('rounded-xl border px-3 py-2', s.bg, s.border)}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                    <span className={cn('text-xs font-bold', s.text)}>{b.bezeichnung}</span>
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {b.komplexitaet} Pos.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Clock className={cn('h-3 w-3', s.text)} />
                    <span className={cn('text-[10px] font-bold tabular-nums', s.text)}>
                      {b.verbleibendMinuten > 0
                        ? `${b.verbleibendMinuten} Min`
                        : `+${Math.abs(b.verbleibendMinuten)} Min`}
                    </span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', s.badge)}>
                      {b.ampel === 'rot' ? 'Kritisch' : b.ampel === 'gelb' ? 'Dringend' : 'OK'}
                    </span>
                  </div>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', s.balken)}
                    style={{ width: `${fortschrittPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] text-muted-foreground">{b.minutenAktiv} Min aktiv</span>
                  <span className="text-[9px] text-muted-foreground">Ziel: {b.etaMinuten} Min</span>
                </div>
              </div>
            );
          })}

          {prioListe.length > 0 && (
            <div className="flex gap-4 pt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" />Pünktlich
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />Dringend (≤{gelbSchwelle} Min)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Kritisch (≤{rotSchwelle} Min)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
