'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1854 — Liefertreue-Cockpit (Fahrer-App)
 *
 * Zeigt eigene SLA-Quote (on-time %) vs. Team-Durchschnitt.
 * Quelle: /api/delivery/admin/liefertreue-monitor (Phase 1851 API, Fahrer-Slice).
 * Nur wenn isOnline=true; Collapsible; 30-Min-Polling.
 */

interface FahrerSla {
  fahrer_id: string;
  fahrer_name: string;
  ontime: number;
  etwas_spaet: number;
  sehr_spaet: number;
  gesamt: number;
  quote: number;
}

interface SlaResponse {
  sla_quote: number;
  fahrer: FahrerSla[];
}

const MOCK_RESPONSE: SlaResponse = {
  sla_quote: 78,
  fahrer: [
    { fahrer_id: 'self', fahrer_name: 'Ich', ontime: 12, etwas_spaet: 2, sehr_spaet: 1, gesamt: 15, quote: 80 },
    { fahrer_id: 'f2', fahrer_name: 'Lisa K.', ontime: 10, etwas_spaet: 3, sehr_spaet: 1, gesamt: 14, quote: 71 },
    { fahrer_id: 'f3', fahrer_name: 'Tom S.', ontime: 8, etwas_spaet: 2, sehr_spaet: 1, gesamt: 11, quote: 73 },
  ],
};

function quoteFarbe(q: number) {
  if (q >= 80) return 'text-matcha-600 dark:text-matcha-400';
  if (q >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1854LiefertreueCockpit({ driverId, locationId, isOnline, className }: Props) {
  const [offen, setOffen] = useState(false);
  const [data, setData] = useState<SlaResponse | null>(null);

  useEffect(() => {
    if (!locationId || !isOnline) return;
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/liefertreue-monitor?location_id=${locationId}`);
        if (res.ok && alive) setData(await res.json());
      } catch {
        if (alive) setData(MOCK_RESPONSE);
      }
    }
    load();
    const id = setInterval(load, 30 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [locationId, isOnline]);

  if (!isOnline) return null;
  const d = data ?? MOCK_RESPONSE;

  const eigener = driverId ? d.fahrer.find((f) => f.fahrer_id === driverId) : d.fahrer[0];
  const teamQuote = d.sla_quote;
  const eigenQuote = eigener?.quote ?? teamQuote;
  const diff = eigenQuote - teamQuote;
  const trend = Math.abs(diff) < 2 ? 'flat' : diff > 0 ? 'up' : 'down';

  return (
    <div className={cn('rounded-2xl border bg-card/60 shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-white/5 transition-colors"
      >
        <Target className={cn('h-4 w-4 shrink-0', quoteFarbe(eigenQuote))} />
        <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">Meine Liefertreue</span>
        <span className={cn('ml-1 text-sm font-black tabular-nums', quoteFarbe(eigenQuote))}>{eigenQuote}%</span>
        <div className="ml-auto flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-matcha-400" />}
          {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
          {trend === 'flat' && <Minus className="h-3.5 w-3.5 text-blue-300" />}
          {offen ? <ChevronUp className="h-4 w-4 text-blue-300" /> : <ChevronDown className="h-4 w-4 text-blue-300" />}
        </div>
      </button>

      {offen && (
        <div className="px-4 py-3 space-y-3">
          {/* Eigen vs. Team */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center">
              <p className="text-[9px] text-blue-300">Meine Quote</p>
              <p className={cn('text-lg font-black tabular-nums', quoteFarbe(eigenQuote))}>{eigenQuote}%</p>
              <p className="text-[9px] text-blue-300 mt-0.5">{eigener?.ontime ?? '–'} von {eigener?.gesamt ?? '–'} on-time</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center">
              <p className="text-[9px] text-blue-300">Team-Ø</p>
              <p className="text-lg font-black tabular-nums text-blue-100">{teamQuote}%</p>
              <p className="text-[9px] text-blue-300 mt-0.5">
                {diff > 0 ? `+${diff}% besser` : diff < 0 ? `${diff}% unter Schnitt` : 'im Schnitt'}
              </p>
            </div>
          </div>

          {/* Fortschrittsbalken */}
          {eigener && (
            <div className="space-y-1.5">
              {[
                { label: 'On-Time', val: eigener.ontime, total: eigener.gesamt, bar: 'bg-matcha-500' },
                { label: 'Etwas spät', val: eigener.etwas_spaet, total: eigener.gesamt, bar: 'bg-amber-400' },
                { label: 'Sehr spät', val: eigener.sehr_spaet, total: eigener.gesamt, bar: 'bg-red-500' },
              ].map(({ label, val, total, bar }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-20 text-[9px] text-blue-300 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', bar)} style={{ width: `${total > 0 ? (val / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[9px] text-blue-200 font-bold tabular-nums w-4 text-right">{val}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[9px] text-blue-400 text-right">Alle 30 Min aktualisiert · SLA = Lieferung &lt;30 Min</p>
        </div>
      )}
    </div>
  );
}
