'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Flame, Clock } from 'lucide-react';

/**
 * Phase 1872 — Bestellrückstand-Ampel-V2 (Kitchen)
 *
 * Eskalation grün/gelb/rot mit Zeitstempel-Anzeige je Bestellung.
 * Zeigt Eingang-Timestamp + Minuten in Zubereitung.
 * useMemo; Collapsible.
 */

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  order_number?: string | number;
  orderNumber?: string | number;
  items?: { name?: string; menge?: number; quantity?: number }[];
  produkte?: { name?: string; menge?: number; quantity?: number }[];
}

type Ampel = 'gruen' | 'gelb' | 'rot';

interface RueckstandEntry {
  id: string;
  nr: string;
  min: number;
  eingang: string;
  ampel: Ampel;
  artikel: number;
}

const STATUS_AKTIV = new Set([
  'preparing', 'in_progress', 'in_zubereitung', 'confirmed', 'accepted',
]);

const AMPEL_CFG: Record<Ampel, {
  bg: string; border: string; text: string; dot: string; badge: string; label: string;
}> = {
  gruen: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/20',
    border: 'border-matcha-200 dark:border-matcha-800',
    text: 'text-matcha-700 dark:text-matcha-300',
    dot: 'bg-matcha-400',
    badge: 'bg-matcha-100 text-matcha-800 dark:bg-matcha-900/40 dark:text-matcha-200',
    label: 'Läuft',
  },
  gelb: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400 animate-pulse',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    label: 'Dringend',
  },
  rot: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500 animate-pulse',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    label: 'Kritisch',
  },
};

interface Props {
  orders: Order[];
  gelbSchwelleMin?: number;
  rotSchwelleMin?: number;
  className?: string;
}

function zeitstempel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function KitchenPhase1872BestellrueckstandAmpelV2({
  orders,
  gelbSchwelleMin = 15,
  rotSchwelleMin = 25,
  className,
}: Props) {
  const [offen, setOffen] = useState(true);

  const { eintraege, gesamtAmpel } = useMemo(() => {
    const jetzt = Date.now();
    const liste: RueckstandEntry[] = orders
      .filter((o) => !o.status || STATUS_AKTIV.has(o.status))
      .map((o) => {
        const erstelltRaw = o.created_at ?? o.createdAt ?? '';
        const min = erstelltRaw
          ? Math.floor((jetzt - new Date(erstelltRaw).getTime()) / 60_000)
          : 0;
        const items = o.items ?? o.produkte ?? [];
        const nr = String(o.order_number ?? o.orderNumber ?? o.id.slice(-4));
        const ampel: Ampel = min >= rotSchwelleMin ? 'rot' : min >= gelbSchwelleMin ? 'gelb' : 'gruen';
        return {
          id: o.id,
          nr: `#${nr}`,
          min,
          eingang: erstelltRaw ? zeitstempel(erstelltRaw) : '—',
          ampel,
          artikel: items.reduce((s: number, i) => s + (i.menge ?? i.quantity ?? 1), 0),
        };
      })
      .sort((a, b) => b.min - a.min);

    const rotAnzahl = liste.filter((e) => e.ampel === 'rot').length;
    const gelbAnzahl = liste.filter((e) => e.ampel === 'gelb').length;
    const gesamt: Ampel = rotAnzahl > 0 ? 'rot' : gelbAnzahl > 0 ? 'gelb' : 'gruen';

    return { eintraege: liste, gesamtAmpel: gesamt };
  }, [orders, gelbSchwelleMin, rotSchwelleMin]);

  const rotAnzahl = eintraege.filter((e) => e.ampel === 'rot').length;
  const gelbAnzahl = eintraege.filter((e) => e.ampel === 'gelb').length;

  if (eintraege.length === 0) {
    return (
      <div className={cn('rounded-2xl border bg-card px-4 py-3 flex items-center gap-2', className)}>
        <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
        <span className="text-xs text-muted-foreground">Rückstand-Ampel: Alle Bestellungen im Zeitplan.</span>
      </div>
    );
  }

  const cfg = AMPEL_CFG[gesamtAmpel];

  return (
    <div className={cn('rounded-2xl border shadow-sm overflow-hidden', cfg.border, className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className={cn('w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors', cfg.bg)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {gesamtAmpel === 'rot' ? (
            <Flame className="h-4 w-4 text-red-600 shrink-0" />
          ) : gesamtAmpel === 'gelb' ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
          )}
          <span className={cn('text-sm font-bold', cfg.text)}>Rückstand-Ampel V2</span>
          {rotAnzahl > 0 && (
            <span className="rounded-full bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 px-2 py-0.5 text-[10px] font-black">
              {rotAnzahl} Kritisch
            </span>
          )}
          {gelbAnzahl > 0 && (
            <span className="rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-2 py-0.5 text-[10px] font-bold">
              {gelbAnzahl} Dringend
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-1">{eintraege.length} aktiv</span>
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="divide-y">
          {eintraege.map((e) => {
            const s = AMPEL_CFG[e.ampel];
            const barW = Math.min(100, (e.min / 35) * 100);
            return (
              <div key={e.id} className={cn('px-4 py-2.5', s.bg)}>
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                  <span className={cn('text-xs font-bold', s.text)}>{e.nr}</span>
                  <span className="text-[10px] text-muted-foreground">{e.artikel} Pos.</span>
                  <div className="flex-1" />
                  <Clock className={cn('h-3 w-3 shrink-0', s.text)} />
                  <span className={cn('text-sm font-black tabular-nums', s.text)}>{e.min} Min</span>
                  <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 font-bold', s.badge)}>{s.label}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground shrink-0">Eingang {e.eingang}</span>
                  <div className="flex-1 h-1 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500',
                        e.ampel === 'rot' ? 'bg-red-500' : e.ampel === 'gelb' ? 'bg-amber-400' : 'bg-matcha-400',
                      )}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="px-4 py-2 flex gap-4 text-[10px] text-muted-foreground bg-muted/10">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-matcha-400 inline-block" />Läuft (&lt;{gelbSchwelleMin} Min)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />Dringend (&gt;{gelbSchwelleMin} Min)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Kritisch (&gt;{rotSchwelleMin} Min)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
