'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Moon, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1131 — Nacht-Schicht-Planung (Dispatch)
// Übersicht kommende 12h: Fahrerverfügbarkeit, Bestellprognose, empfohlene Besetzung

interface Props {
  locationId: string | null;
}

type StundenSlot = {
  stunde: string;
  bestellungen_prognose: number;
  fahrer_verfuegbar: number;
  fahrer_empfohlen: number;
  status: 'ok' | 'unterbesetzt' | 'kritisch';
};

type ApiResponse = {
  slots: StundenSlot[];
  fahrer_total_verfuegbar: number;
  peak_stunde: string;
  peak_bestellungen: number;
  fehlende_fahrer: number;
  generiert_am: string;
};

const MOCK: ApiResponse = {
  slots: [
    { stunde: '18:00', bestellungen_prognose: 12, fahrer_verfuegbar: 4, fahrer_empfohlen: 3, status: 'ok' },
    { stunde: '19:00', bestellungen_prognose: 22, fahrer_verfuegbar: 4, fahrer_empfohlen: 5, status: 'unterbesetzt' },
    { stunde: '20:00', bestellungen_prognose: 28, fahrer_verfuegbar: 3, fahrer_empfohlen: 6, status: 'kritisch' },
    { stunde: '21:00', bestellungen_prognose: 24, fahrer_verfuegbar: 3, fahrer_empfohlen: 5, status: 'unterbesetzt' },
    { stunde: '22:00', bestellungen_prognose: 18, fahrer_verfuegbar: 2, fahrer_empfohlen: 4, status: 'unterbesetzt' },
    { stunde: '23:00', bestellungen_prognose: 10, fahrer_verfuegbar: 2, fahrer_empfohlen: 2, status: 'ok' },
    { stunde: '00:00', bestellungen_prognose: 5,  fahrer_verfuegbar: 1, fahrer_empfohlen: 1, status: 'ok' },
  ],
  fahrer_total_verfuegbar: 4,
  peak_stunde: '20:00',
  peak_bestellungen: 28,
  fehlende_fahrer: 3,
  generiert_am: new Date().toISOString(),
};

function slotColor(s: StundenSlot['status']) {
  if (s === 'kritisch')    return 'bg-red-500';
  if (s === 'unterbesetzt') return 'bg-amber-400';
  return 'bg-emerald-500';
}

function slotText(s: StundenSlot['status']) {
  if (s === 'kritisch')    return 'text-red-600 dark:text-red-400';
  if (s === 'unterbesetzt') return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

export function DispatchPhase1131NachtSchichtPlanung({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/nacht-schicht-planung?location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) throw new Error('fetch');
      setData(await res.json() as ApiResponse);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const fehlend = data?.fehlende_fahrer ?? 0;
  const hasWarnung = fehlend > 0;

  return (
    <div className={cn(
      'rounded-xl border shadow-sm overflow-hidden',
      hasWarnung
        ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
        : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20'
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          <span className="font-bold text-sm text-indigo-700 dark:text-indigo-300">Nacht-Schicht-Planung</span>
          {fehlend > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" /> {fehlend} Fahrer fehlen
            </span>
          )}
          {fehlend === 0 && data && (
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
              Besetzung OK
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {loading && <span className="text-[10px] text-muted-foreground">…</span>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && data && (
        <div className="px-4 pb-4 space-y-3 border-t border-indigo-200/50 dark:border-indigo-800/50 pt-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/70 dark:bg-white/5 p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-indigo-600 dark:text-indigo-400 mb-0.5">
                <Users className="h-3 w-3" />
              </div>
              <div className="text-lg font-black text-foreground">{data.fahrer_total_verfuegbar}</div>
              <div className="text-[9px] text-muted-foreground">Verfügbar</div>
            </div>
            <div className="rounded-lg bg-white/70 dark:bg-white/5 p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 mb-0.5">
                <TrendingUp className="h-3 w-3" />
              </div>
              <div className="text-lg font-black text-foreground">{data.peak_bestellungen}</div>
              <div className="text-[9px] text-muted-foreground">Peak {data.peak_stunde}</div>
            </div>
            <div className={cn('rounded-lg bg-white/70 dark:bg-white/5 p-2 text-center')}>
              <div className={cn('text-lg font-black', fehlend > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {fehlend > 0 ? `-${fehlend}` : '✓'}
              </div>
              <div className="text-[9px] text-muted-foreground">{fehlend > 0 ? 'Fehlend' : 'Besetzt'}</div>
            </div>
          </div>

          {/* Stunden-Timeline */}
          <div className="space-y-1.5">
            {data.slots.map(slot => {
              const maxBestellungen = Math.max(...data.slots.map(s => s.bestellungen_prognose), 1);
              const barPct = Math.round((slot.bestellungen_prognose / maxBestellungen) * 100);
              return (
                <div key={slot.stunde} className="flex items-center gap-2">
                  <div className="w-12 shrink-0 text-[10px] font-mono text-muted-foreground">{slot.stunde}</div>
                  <div className="flex-1 h-5 bg-black/5 dark:bg-white/10 rounded overflow-hidden">
                    <div
                      className={cn('h-full rounded transition-all duration-500', slotColor(slot.status))}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <div className="w-16 shrink-0 flex items-center justify-end gap-1">
                    <span className="text-[10px] text-muted-foreground">{slot.bestellungen_prognose} Bst.</span>
                    <span className={cn('text-[10px] font-bold tabular-nums', slotText(slot.status))}>
                      {slot.fahrer_verfuegbar}/{slot.fahrer_empfohlen}F
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground text-right">F = Verfügbar/Empfohlen · 10-Min-Aktualisierung</p>
        </div>
      )}
    </div>
  );
}
