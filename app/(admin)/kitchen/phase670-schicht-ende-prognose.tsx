'use client';

import { useEffect, useState } from 'react';
import { Clock, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiResponse {
  ok: boolean;
  signal: 'grün' | 'gelb' | 'rot';
  offeneBestellungen: number;
  inZubereitung: number;
  fertigWartend: number;
  prognoseWarteMin: number | null;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase670SchichtEndePrognose({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        const json: ApiResponse = await res.json();
        if (active) setData(json);
      } catch {
        // silent
      }
    }

    load();
    const id = setInterval(load, 60_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!data?.ok) return null;

  // Schicht-Ende-Prognose: wie lange bis alle offenen Bestellungen erledigt sind
  // Durchschnitt: 8 Min/Bestellung Zubereitung
  const AVG_PREP_MIN = 8;
  const offeneGesamt = data.offeneBestellungen + data.inZubereitung;
  const prognoseMin = data.prognoseWarteMin ?? Math.round(offeneGesamt * AVG_PREP_MIN);

  const now = new Date();
  const endeUhrzeit = new Date(now.getTime() + prognoseMin * 60_000);
  const endeStr = endeUhrzeit.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const farbe =
    offeneGesamt === 0 ? 'text-green-600 dark:text-green-400' :
    offeneGesamt <= 4  ? 'text-blue-600 dark:text-blue-400' :
    offeneGesamt <= 9  ? 'text-amber-600 dark:text-amber-500' :
    'text-red-600 dark:text-red-400';

  const bgFarbe =
    offeneGesamt === 0 ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' :
    offeneGesamt <= 4  ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' :
    offeneGesamt <= 9  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' :
    'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';

  return (
    <div className={cn('rounded-xl border p-4 mb-4', bgFarbe)}>
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock className={cn('w-4 h-4', farbe)} />
          <span className={cn('font-semibold text-sm', farbe)}>
            Schicht-Ende-Prognose
          </span>
          {offeneGesamt === 0 && (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="mt-3">
          {offeneGesamt === 0 ? (
            <p className="text-sm text-green-700 dark:text-green-300 font-medium">
              Alle Bestellungen erledigt — Küche im freien Lauf.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Prognose Ende</span>
                <span className={cn('text-lg font-bold', farbe)}>{endeStr} Uhr</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Verbleibend</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  ~{prognoseMin} Min
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="text-center">
                  <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{data.offeneBestellungen}</div>
                  <div className="text-xs text-slate-500">Offen</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{data.inZubereitung}</div>
                  <div className="text-xs text-slate-500">In Arbeit</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">{data.fertigWartend}</div>
                  <div className="text-xs text-slate-500">Fertig/Warte</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
