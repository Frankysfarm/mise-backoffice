'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1144 — Koch-Rückstand-Ampel (Kitchen)
// Vergleich eingehende Bestellrate vs. Fertigstellungsrate → zeigt ob Küche im Rückstand ist

interface Order {
  id: string;
  created_at?: string;
  completed_at?: string;
  status?: string;
  prep_time?: number;
  estimated_prep_time?: number;
}

interface Props {
  orders: Order[];
}

type Ampel = 'gruen' | 'gelb' | 'rot';

export function KitchenPhase1144KochRueckstandAmpel({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const { ampel, eingehend, fertig, rueckstand, label, avgPrepMin, inZubereitung } = useMemo(() => {
    const nowMs = Date.now();
    const fensterMs = 30 * 60 * 1000; // letzte 30 Minuten

    const recent = orders.filter(o => {
      if (!o.created_at) return false;
      return nowMs - new Date(o.created_at).getTime() < fensterMs;
    });

    const eingehend = recent.length;

    const fertigRecent = recent.filter(o =>
      o.status === 'ready' || o.status === 'delivered' || o.status === 'completed'
    ).length;

    const inZubereitung = orders.filter(o =>
      o.status === 'accepted' || o.status === 'cooking' || o.status === 'preparing'
    ).length;

    const prepTimes = recent
      .filter(o => o.prep_time ?? o.estimated_prep_time)
      .map(o => (o.prep_time ?? o.estimated_prep_time ?? 15));
    const avgPrepMin = prepTimes.length
      ? Math.round(prepTimes.reduce((s, v) => s + v, 0) / prepTimes.length)
      : 15;

    const rueckstand = Math.max(0, eingehend - fertigRecent);
    const ratio = eingehend > 0 ? fertigRecent / eingehend : 1;

    let ampel: Ampel;
    let label: string;
    if (inZubereitung === 0 && eingehend === 0) {
      ampel = 'gruen';
      label = 'Küche ruhig — keine aktiven Bestellungen';
    } else if (ratio >= 0.85 || rueckstand <= 1) {
      ampel = 'gruen';
      label = 'Küche im Takt — kein Rückstand';
    } else if (ratio >= 0.6 || rueckstand <= 3) {
      ampel = 'gelb';
      label = `Leichter Rückstand — ${rueckstand} Bestellung${rueckstand !== 1 ? 'en' : ''} offen`;
    } else {
      ampel = 'rot';
      label = `Rückstand kritisch — ${rueckstand} Bestellungen im Verzug`;
    }

    return { ampel, eingehend, fertig: fertigRecent, rueckstand, label, avgPrepMin, inZubereitung };
  }, [orders]);

  const colors: Record<Ampel, { border: string; bg: string; text: string; dot: string }> = {
    gruen: {
      border: 'border-emerald-200 dark:border-emerald-800',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
    },
    gelb: {
      border: 'border-amber-200 dark:border-amber-800',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500 animate-pulse',
    },
    rot: {
      border: 'border-red-200 dark:border-red-800',
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      dot: 'bg-red-500 animate-pulse',
    },
  };

  const c = colors[ampel];
  const Icon = ampel === 'gruen' ? CheckCircle2 : ampel === 'gelb' ? AlertTriangle : Flame;

  return (
    <div className={cn('rounded-xl border overflow-hidden shadow-sm', c.border, c.bg)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={cn('inline-block h-2.5 w-2.5 rounded-full', c.dot)} />
          <Icon className={cn('h-4 w-4', c.text)} />
          <span className={cn('font-bold text-sm', c.text)}>Koch-Rückstand-Ampel</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold bg-white/60 dark:bg-black/20', c.text)}>
            {label}
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className={cn('border-t px-4 pb-4 pt-3 space-y-3', c.border)}>
          {/* KPI-Kacheln */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Eingegangen (30 Min)', value: eingehend, icon: Clock },
              { label: 'Fertiggestellt', value: fertig, icon: CheckCircle2 },
              { label: 'In Zubereitung', value: inZubereitung, icon: Flame },
            ].map(({ label: l, value, icon: Ic }) => (
              <div key={l} className="rounded-lg border border-white/50 dark:border-black/20 bg-white/60 dark:bg-black/20 p-2 text-center">
                <Ic className={cn('mx-auto h-4 w-4 mb-0.5', c.text)} />
                <div className={cn('text-lg font-black tabular-nums', c.text)}>{value}</div>
                <div className="text-[9px] font-medium text-muted-foreground leading-tight">{l}</div>
              </div>
            ))}
          </div>

          {/* Fortschrittsbalken Fertigstellungsrate */}
          {eingehend > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Fertigstellungsrate (letzte 30 Min)</span>
                <span>{eingehend > 0 ? Math.round((fertig / eingehend) * 100) : 100}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/50 dark:bg-black/30 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500',
                    ampel === 'gruen' ? 'bg-emerald-500' : ampel === 'gelb' ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${eingehend > 0 ? Math.min(100, (fertig / eingehend) * 100) : 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Ø Zubereitungszeit */}
          <div className="flex items-center gap-2 rounded-lg bg-white/60 dark:bg-black/20 px-3 py-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Ø Zubereitungszeit</span>
            <span className={cn('ml-auto text-sm font-black tabular-nums', c.text)}>{avgPrepMin} Min</span>
          </div>

          {rueckstand > 0 && (
            <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', c.border, 'bg-white/40 dark:bg-black/20')}>
              <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', c.text)} />
              <span className={cn('text-[11px] font-bold', c.text)}>
                {rueckstand} Bestellung{rueckstand !== 1 ? 'en' : ''} noch nicht fertiggestellt — Priorisierung prüfen
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
