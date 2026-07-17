'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';

type RisikoStufe = 'niedrig' | 'mittel' | 'hoch';

interface FahrerRisiko {
  driver_id: string;
  fahrer_name: string;
  verspaetungen_3_tage: number;
  schicht_fehlzeiten: number;
  risiko_score: number;
  risiko_stufe: RisikoStufe;
  letzter_vorfall: string | null;
}

interface ApiData {
  fahrer: FahrerRisiko[];
  gesamt_risiko: RisikoStufe;
  hoch_risiko_anzahl: number;
}

function AmpelIcon({ stufe }: { stufe: RisikoStufe }) {
  if (stufe === 'hoch') return <ShieldAlert className="w-4 h-4 text-red-500" />;
  if (stufe === 'mittel') return <ShieldQuestion className="w-4 h-4 text-yellow-500" />;
  return <ShieldCheck className="w-4 h-4 text-green-500" />;
}

function ampelColor(stufe: RisikoStufe) {
  if (stufe === 'hoch') return 'text-red-600 dark:text-red-400';
  if (stufe === 'mittel') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

function ampelBg(stufe: RisikoStufe) {
  if (stufe === 'hoch') return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  if (stufe === 'mittel') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
}

export function DispatchPhase2217AusfallrisikoBord({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-ausfallrisiko?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-ausfallrisiko';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const rotFahrer = data.fahrer.filter((f) => f.risiko_stufe === 'hoch');
  const sorted = [...data.fahrer].sort((a, b) => b.risiko_score - a.risiko_score);
  const top3 = sorted.slice(0, 3);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Ausfallrisiko-Board</span>
        <div className="flex items-center gap-2">
          {rotFahrer.length > 1 && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {rotFahrer.length} Rot
            </span>
          )}
          <span className="text-xs text-gray-400">
            {data.fahrer.length} Fahrer
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {rotFahrer.length > 1 && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Kapazitäts-Alert:</strong> {rotFahrer.map((f) => f.fahrer_name).join(', ')} haben hohes Ausfallrisiko — Verstärkung prüfen!
              </span>
            </div>
          )}

          <div className="space-y-2">
            {top3.map((f, i) => (
              <div
                key={f.driver_id}
                className={cn(
                  'rounded-lg border px-3 py-2',
                  i === 0 && f.risiko_stufe === 'hoch' ? ampelBg('hoch') : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <AmpelIcon stufe={f.risiko_stufe} />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{f.fahrer_name}</span>
                    {i === 0 && <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 rounded">#1 Risiko</span>}
                  </div>
                  <span className={cn('text-sm font-bold', ampelColor(f.risiko_stufe))}>
                    Score {f.risiko_score}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>⚠ {f.verspaetungen_3_tage} Verspät.</span>
                  <span>✕ {f.schicht_fehlzeiten} Fehlzeiten</span>
                  {f.letzter_vorfall && (
                    <span className="ml-auto">
                      Letzter: {new Date(f.letzter_vorfall).toLocaleDateString('de-DE')}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {sorted.slice(3).map((f) => (
              <div key={f.driver_id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <AmpelIcon stufe={f.risiko_stufe} />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{f.fahrer_name}</span>
                </div>
                <span className={cn('text-xs font-semibold', ampelColor(f.risiko_stufe))}>
                  Score {f.risiko_score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
