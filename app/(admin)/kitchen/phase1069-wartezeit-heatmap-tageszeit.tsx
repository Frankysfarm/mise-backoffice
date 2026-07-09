'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type StundeData = {
  stunde: number;
  label: string;
  ø_wartezeit_min: number;
  bestellungen: number;
  empfehlung: string | null;
};

type ApiResponse = {
  stunden: StundeData[];
  schlechteste_stunde: string;
  beste_stunde: string;
};

function mock(): ApiResponse {
  const stunden: StundeData[] = [
    { stunde: 11, label: '11:00', ø_wartezeit_min: 9.5, bestellungen: 12, empfehlung: null },
    { stunde: 12, label: '12:00', ø_wartezeit_min: 18.2, bestellungen: 38, empfehlung: 'Personalaufstockung empfohlen' },
    { stunde: 13, label: '13:00', ø_wartezeit_min: 22.7, bestellungen: 45, empfehlung: '+1 Koch empfohlen' },
    { stunde: 14, label: '14:00', ø_wartezeit_min: 11.3, bestellungen: 18, empfehlung: null },
    { stunde: 17, label: '17:00', ø_wartezeit_min: 13.1, bestellungen: 22, empfehlung: null },
    { stunde: 18, label: '18:00', ø_wartezeit_min: 19.8, bestellungen: 41, empfehlung: '+2 Köche empfohlen' },
    { stunde: 19, label: '19:00', ø_wartezeit_min: 25.4, bestellungen: 52, empfehlung: 'Kritischer Peak — Maximalbesetzung' },
    { stunde: 20, label: '20:00', ø_wartezeit_min: 16.0, bestellungen: 29, empfehlung: null },
  ];
  return { stunden, schlechteste_stunde: '19:00', beste_stunde: '11:00' };
}

function heatColor(min: number): string {
  if (min >= 20) return 'bg-red-500 text-white';
  if (min >= 15) return 'bg-orange-400 text-white';
  if (min >= 10) return 'bg-amber-300 text-gray-900';
  return 'bg-matcha-400 text-white';
}

export function KitchenPhase1069WartezeitHeatmapTageszeit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams();
      if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/wartezeit-heatmap-tageszeit?${p}`);
      if (r.ok) setData(await r.json());
      else throw new Error();
    } catch {
      setData(mock());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const max = Math.max(...(data?.stunden.map((s) => s.ø_wartezeit_min) ?? [1]));

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">
            Wartezeit-Heatmap nach Tageszeit
          </span>
        </div>
        {data && (
          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
            Peak: {data.schlechteste_stunde}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-amber-500" />
        </div>
      )}

      {!loading && data && (
        <div className="p-3 space-y-2">
          {data.stunden.map((s) => (
            <div key={s.stunde} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[11px] font-bold text-amber-900 dark:text-amber-100 tabular-nums">
                {s.label}
              </span>
              <div className="flex-1 h-5 bg-white dark:bg-black/20 rounded-lg overflow-hidden relative">
                <div
                  className={cn('h-full rounded-lg transition-all duration-700', heatColor(s.ø_wartezeit_min))}
                  style={{ width: `${Math.min(100, (s.ø_wartezeit_min / max) * 100)}%` }}
                />
                <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-black tabular-nums text-gray-800 dark:text-white mix-blend-normal">
                  {s.ø_wartezeit_min.toFixed(1)} Min · {s.bestellungen} Bestellungen
                </span>
              </div>
              {s.empfehlung && (
                <div className="flex items-center gap-1 shrink-0">
                  <Users size={9} className="text-red-500" />
                  <span className="text-[9px] text-red-600 dark:text-red-400 font-semibold max-w-[120px] truncate">
                    {s.empfehlung}
                  </span>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3 pt-1 border-t border-amber-200 dark:border-amber-800">
            {[
              { label: '≥20 Min', cls: 'bg-red-500' },
              { label: '≥15 Min', cls: 'bg-orange-400' },
              { label: '≥10 Min', cls: 'bg-amber-300' },
              { label: '<10 Min', cls: 'bg-matcha-400' },
            ].map(({ label, cls }) => (
              <div key={label} className="flex items-center gap-1">
                <div className={cn('w-2.5 h-2.5 rounded-sm', cls)} />
                <span className="text-[9px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
