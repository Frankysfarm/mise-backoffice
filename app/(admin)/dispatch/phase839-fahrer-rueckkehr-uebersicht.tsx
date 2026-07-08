'use client';

import { useEffect, useState } from 'react';
import { MapPin, Clock, Navigation } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface FahrerRueckkehr {
  fahrer_id: string;
  fahrer_name: string;
  aktive_stopps: number;
  rueckkehr_eta_min: number;
  rueckkehr_uhrzeit: string;
  km_zum_ziel: number | null;
  status: 'unterwegs' | 'letzter_stopp' | 'fast_zurueck';
}

interface ApiData {
  fahrer: FahrerRueckkehr[];
  generatedAt: string;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Max M.', aktive_stopps: 1, rueckkehr_eta_min: 12, rueckkehr_uhrzeit: '18:45', km_zum_ziel: 2.3, status: 'letzter_stopp' },
    { fahrer_id: '2', fahrer_name: 'Anna K.', aktive_stopps: 3, rueckkehr_eta_min: 28, rueckkehr_uhrzeit: '19:01', km_zum_ziel: 5.8, status: 'unterwegs' },
    { fahrer_id: '3', fahrer_name: 'Tom R.', aktive_stopps: 0, rueckkehr_eta_min: 6, rueckkehr_uhrzeit: '18:39', km_zum_ziel: 0.8, status: 'fast_zurueck' },
  ],
  generatedAt: new Date().toISOString(),
};

function statusConfig(s: FahrerRueckkehr['status']) {
  if (s === 'fast_zurueck') return { label: 'Fast zurück', cls: 'bg-matcha-100 text-matcha-700' };
  if (s === 'letzter_stopp') return { label: 'Letzter Stopp', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'Unterwegs', cls: 'bg-blue-100 text-blue-700' };
}

export function DispatchPhase839FahrerRueckkehrUebersicht({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/fahrer-rueckkehr-uebersicht?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || data.fahrer.length === 0) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.rueckkehr_eta_min - b.rueckkehr_eta_min);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <Navigation className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-char">Fahrer-Rückkehr Live</div>
          <div className="text-xs text-stone-400">{sorted.length} Fahrer unterwegs · 30s Refresh</div>
        </div>
        <span className="text-[10px] text-stone-400">
          {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="divide-y divide-stone-50">
        {sorted.map((f, i) => {
          const conf = statusConfig(f.status);
          return (
            <div key={f.fahrer_id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-600 shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-char truncate">{f.fahrer_name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${conf.cls}`}>
                    {conf.label}
                  </span>
                  {f.aktive_stopps > 0 && (
                    <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />{f.aktive_stopps} Stopp{f.aktive_stopps !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-black tabular-nums text-char">
                  {f.rueckkehr_eta_min < 1 ? 'Jetzt' : `${f.rueckkehr_eta_min} Min`}
                </div>
                <div className="text-[10px] text-stone-400 flex items-center gap-0.5 justify-end">
                  <Clock className="h-3 w-3" />{f.rueckkehr_uhrzeit} Uhr
                  {f.km_zum_ziel != null && (
                    <span className="ml-1">· {f.km_zum_ziel} km</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
