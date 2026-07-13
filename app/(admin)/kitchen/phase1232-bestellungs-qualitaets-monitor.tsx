'use client';

// Phase 1232 — Bestellungs-Qualitäts-Monitor (Kitchen)
// Verfolgt Qualitätsprobleme: fehlende Artikel, Beschwerden, Retouren
// Props-basiert (orders); farbkodierte Ampel je Qualitäts-Kategorie

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, XCircle, MinusCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name?: string;
  quantity?: number;
  notes?: string;
}

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  items?: OrderItem[] | null;
  notes?: string | null;
  cancelled_reason?: string | null;
  complaint?: string | null;
}

interface Props {
  orders: Order[];
}

type QualitaetsLevel = 'gut' | 'ok' | 'warnung' | 'kritisch';

interface KategorieStat {
  label: string;
  anzahl: number;
  anteil_pct: number;
  level: QualitaetsLevel;
}

const LEVEL_COLORS: Record<QualitaetsLevel, string> = {
  gut: 'text-emerald-600 dark:text-emerald-400',
  ok: 'text-blue-600 dark:text-blue-400',
  warnung: 'text-amber-600 dark:text-amber-400',
  kritisch: 'text-red-600 dark:text-red-400',
};

const LEVEL_BG: Record<QualitaetsLevel, string> = {
  gut: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  ok: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  warnung: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  kritisch: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
};

const LEVEL_ICONS: Record<QualitaetsLevel, React.ReactNode> = {
  gut: <CheckCircle2 className="h-3.5 w-3.5" />,
  ok: <MinusCircle className="h-3.5 w-3.5" />,
  warnung: <AlertCircle className="h-3.5 w-3.5" />,
  kritisch: <XCircle className="h-3.5 w-3.5" />,
};

function anteilLevel(pct: number, thresholds: [number, number]): QualitaetsLevel {
  const [warn, krit] = thresholds;
  if (pct === 0) return 'gut';
  if (pct < warn) return 'ok';
  if (pct < krit) return 'warnung';
  return 'kritisch';
}

export function KitchenPhase1232BestellungsQualitaetsMonitor({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const total = orders.length;
    if (total === 0) return null;

    const storniert = orders.filter((o) => o.status === 'cancelled' || o.status === 'storniert').length;
    const mitBeschwerden = orders.filter(
      (o) => o.complaint || (o.notes && o.notes.toLowerCase().includes('beschwerde')),
    ).length;
    const mitFehlendItems = orders.filter((o) =>
      o.items?.some((it) => it.notes && it.notes.toLowerCase().includes('fehlt')),
    ).length;
    const kritischeLaenge = orders.filter((o) => {
      if (!o.created_at) return false;
      const ageMin = (Date.now() - new Date(o.created_at).getTime()) / 60000;
      return ageMin > 40 && o.status !== 'delivered' && o.status !== 'cancelled';
    }).length;

    const kategorien: KategorieStat[] = [
      {
        label: 'Stornierungen',
        anzahl: storniert,
        anteil_pct: Math.round((storniert / total) * 100),
        level: anteilLevel((storniert / total) * 100, [5, 15]),
      },
      {
        label: 'Beschwerden',
        anzahl: mitBeschwerden,
        anteil_pct: Math.round((mitBeschwerden / total) * 100),
        level: anteilLevel((mitBeschwerden / total) * 100, [3, 10]),
      },
      {
        label: 'Fehlende Artikel',
        anzahl: mitFehlendItems,
        anteil_pct: Math.round((mitFehlendItems / total) * 100),
        level: anteilLevel((mitFehlendItems / total) * 100, [2, 8]),
      },
      {
        label: 'Überschreitung 40 Min',
        anzahl: kritischeLaenge,
        anteil_pct: Math.round((kritischeLaenge / total) * 100),
        level: anteilLevel((kritischeLaenge / total) * 100, [10, 25]),
      },
    ];

    const gesamtProbleme = storniert + mitBeschwerden + mitFehlendItems + kritischeLaenge;
    const gesamtPct = Math.round((gesamtProbleme / (total * 4)) * 100);
    const gesamtLevel: QualitaetsLevel = gesamtPct <= 2 ? 'gut' : gesamtPct <= 8 ? 'ok' : gesamtPct <= 18 ? 'warnung' : 'kritisch';

    return { total, kategorien, gesamtLevel, gesamtProbleme };
  }, [orders]);

  if (!stats) return null;

  const headerColor = stats.gesamtLevel === 'kritisch'
    ? 'border-red-200 dark:border-red-800'
    : stats.gesamtLevel === 'warnung'
    ? 'border-amber-200 dark:border-amber-800'
    : 'border-emerald-200 dark:border-emerald-800';

  return (
    <div className={cn('rounded-xl border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden', headerColor)}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition"
      >
        <ShieldCheck className={cn('h-4 w-4 shrink-0', LEVEL_COLORS[stats.gesamtLevel])} />
        <span className="font-bold text-sm text-foreground flex-1">Qualitäts-Monitor</span>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', LEVEL_BG[stats.gesamtLevel], LEVEL_COLORS[stats.gesamtLevel])}>
          {stats.gesamtLevel === 'gut' ? 'Alles OK' : stats.gesamtLevel === 'ok' ? 'Gut' : stats.gesamtLevel === 'warnung' ? 'Prüfen' : 'Kritisch'}
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">{stats.total} Bestellungen</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {stats.kategorien.map((kat) => (
            <div
              key={kat.label}
              className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', LEVEL_BG[kat.level])}
            >
              <span className={cn(LEVEL_COLORS[kat.level])}>{LEVEL_ICONS[kat.level]}</span>
              <span className="text-xs font-medium flex-1 text-foreground">{kat.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{kat.anzahl}×</span>
              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    kat.level === 'gut' ? 'bg-emerald-500' : kat.level === 'ok' ? 'bg-blue-500' : kat.level === 'warnung' ? 'bg-amber-500' : 'bg-red-500',
                  )}
                  style={{ width: `${Math.min(100, kat.anteil_pct * 5)}%` }}
                />
              </div>
              <span className={cn('text-xs font-bold tabular-nums w-8 text-right', LEVEL_COLORS[kat.level])}>
                {kat.anteil_pct}%
              </span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground pt-1">
            Schicht: {stats.total} Bestellungen · {stats.gesamtProbleme} Qualitätsereignisse
          </p>
        </div>
      )}
    </div>
  );
}
