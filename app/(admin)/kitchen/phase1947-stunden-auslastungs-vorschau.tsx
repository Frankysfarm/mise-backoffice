'use client';

import { useMemo, useState } from 'react';
import { Clock, ChevronUp, ChevronDown, Zap, Coffee, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  created_at?: string;
  status?: string;
  [key: string]: unknown;
}

interface StundenVorschau {
  stunde: number;
  label: string;
  anzahl: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  empfehlung: string;
}

const EMPFEHLUNG: Record<string, string> = {
  rot: 'Jetzt vorbereiten — hohe Auslastung erwartet!',
  gelb: 'Normale Auslastung — alles bereit halten.',
  gruen: 'Ruhige Phase — gute Zeit für Reinigung.',
};

export default function KitchenPhase1947StundenAuslastungsVorschau({
  orders,
  className,
}: {
  orders: Order[];
  className?: string;
}) {
  const [offen, setOffen] = useState(true);

  const prognose = useMemo((): StundenVorschau[] => {
    const jetzt = new Date();
    const stundenMap = new Map<number, number>();

    for (const o of orders) {
      const ts = o.created_at ? new Date(o.created_at) : null;
      if (!ts) continue;
      const diffMs = jetzt.getTime() - ts.getTime();
      if (diffMs < 0 || diffMs > 7 * 24 * 60 * 60 * 1000) continue;
      const stunde = ts.getHours();
      stundenMap.set(stunde, (stundenMap.get(stunde) ?? 0) + 1);
    }

    const alle = Array.from(stundenMap.values());
    const avg = alle.length > 0 ? alle.reduce((s, v) => s + v, 0) / alle.length : 1;

    return [1, 2, 3].map((offset) => {
      const stunde = (jetzt.getHours() + offset) % 24;
      const anzahl = stundenMap.get(stunde) ?? 0;
      const ampel: StundenVorschau['ampel'] =
        anzahl >= avg * 1.5 ? 'rot' : anzahl >= avg ? 'gelb' : 'gruen';
      return {
        stunde,
        label: `${String(stunde).padStart(2, '0')}:00 Uhr`,
        anzahl,
        ampel,
        empfehlung: EMPFEHLUNG[ampel],
      };
    });
  }, [orders]);

  const AMPEL_COLORS = {
    rot: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      dot: 'bg-red-500',
      Icon: AlertTriangle,
    },
    gelb: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-400',
      Icon: Zap,
    },
    gruen: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
      dot: 'bg-green-500',
      Icon: Coffee,
    },
  };

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Stunden-Auslastungs-Vorschau</span>
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 space-y-2">
          {prognose.map((p, i) => {
            const c = AMPEL_COLORS[p.ampel];
            const { Icon } = c;
            return (
              <div key={i} className={cn('rounded-xl border px-3 py-2.5', c.bg, c.border)}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
                    <span className={cn('text-sm font-bold', c.text)}>{p.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon className={cn('w-3.5 h-3.5', c.text)} />
                    <span className={cn('text-xs font-semibold', c.text)}>
                      {p.anzahl > 0 ? `~${p.anzahl} Best.` : 'Wenig'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 pl-4">{p.empfehlung}</p>
              </div>
            );
          })}

          {orders.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-1">Keine Verlaufsdaten für Prognose.</p>
          )}
        </div>
      )}
    </div>
  );
}
