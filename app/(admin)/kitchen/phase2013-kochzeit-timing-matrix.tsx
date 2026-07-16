'use client';

import { useMemo, useState } from 'react';
import { Target, Timer, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  typ: string;
}

interface MatrixRow {
  id: string;
  bestellnummer: string;
  typ: string;
  bestelltUm: string;
  fertigUm: string;
  kochstartIn: number;
  ampel: 'gruen' | 'amber' | 'rot';
}

const AMPEL_STYLE: Record<string, { dot: string; text: string }> = {
  gruen: { dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  rot:   { dot: 'bg-red-500',   text: 'text-red-600 dark:text-red-400'   },
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function kochstartAmpel(startInMin: number): 'gruen' | 'amber' | 'rot' {
  if (startInMin > 5) return 'gruen';
  if (startInMin >= 0) return 'amber';
  return 'rot';
}

export function KitchenPhase2013KochzeitTimingMatrix({
  orders,
}: {
  orders: Order[];
}) {
  const [offen, setOffen] = useState(true);

  const rows = useMemo((): MatrixRow[] => {
    const now = Date.now();
    const relevant = orders.filter(
      (o) => o.status === 'neu' || o.status === 'bestätigt' || o.status === 'in_zubereitung',
    );

    return relevant.map((o) => {
      const prepMin = o.geschaetzte_zubereitung_min ?? 15;
      const bestelltMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
      const fertigMs = now + prepMin * 60 * 1000;
      const elapsedMin = (now - bestelltMs) / 60_000;
      const kochstartIn = Math.round(prepMin - elapsedMin);

      return {
        id: o.id,
        bestellnummer: o.bestellnummer ?? o.id.slice(0, 6).toUpperCase(),
        typ: o.typ === 'delivery' ? 'Lieferung' : 'Abholung',
        bestelltUm: formatTime(bestelltMs),
        fertigUm: formatTime(fertigMs),
        kochstartIn,
        ampel: kochstartAmpel(kochstartIn),
      };
    });
  }, [orders]);

  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
            Kochzeit-Timing-Matrix
          </span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
            {rows.length} Bestellungen
          </span>
        </div>
        {offen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 text-left font-medium">Bestellung</th>
                <th className="px-3 py-2 text-left font-medium">Typ</th>
                <th className="px-3 py-2 text-left font-medium">
                  <div className="flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    Zubereitung
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-medium">Fertig um</th>
                <th className="px-3 py-2 text-left font-medium">Ampel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((row) => {
                const c = AMPEL_STYLE[row.ampel];
                return (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">
                      #{row.bestellnummer}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {row.typ}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {row.kochstartIn > 0
                        ? `in ${row.kochstartIn} Min`
                        : row.kochstartIn === 0
                        ? 'Jetzt starten'
                        : `${Math.abs(row.kochstartIn)} Min zu spät`}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                      {row.fertigUm}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
                        <span className={cn('font-semibold', c.text)}>
                          {row.ampel === 'gruen' ? 'Noch Zeit' : row.ampel === 'amber' ? 'Jetzt!' : 'Zu spät'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[9px] text-slate-400 text-right px-4 py-2">Optimaler Kochstart · Lieferung & Abholung</p>
        </div>
      )}
    </div>
  );
}
