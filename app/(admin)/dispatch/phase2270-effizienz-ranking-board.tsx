'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Gauge } from 'lucide-react';

type FahrerEffizienz = {
  fahrer_id: string;
  fahrer_name: string;
  touren_heute: number;
  schicht_stunden: number;
  touren_pro_std: number;
  avg_stopps_je_tour: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
};

type ApiData = {
  fahrer: FahrerEffizienz[];
  team_avg_touren_pro_std: number;
  alert_count: number;
};

function ampelLabel(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function rowBg(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (a === 'gelb') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function rowText(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300';
}

function trendIcon(t: 'steigend' | 'fallend' | 'stabil'): string {
  if (t === 'steigend') return '↑';
  if (t === 'fallend') return '↓';
  return '→';
}

function podiumBadge(rang: number): string {
  if (rang === 1) return '🥇';
  if (rang === 2) return '🥈';
  if (rang === 3) return '🥉';
  return '';
}

function teamColor(tph: number): string {
  if (tph >= 2) return 'text-green-600 dark:text-green-400';
  if (tph >= 1.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function teamTipp(tph: number): string {
  if (tph >= 2.5) return 'Exzellente Tour-Effizienz — Team läuft auf Hochtouren!';
  if (tph >= 2) return 'Gute Effizienz — weiter optimieren für noch mehr Touren pro Stunde.';
  if (tph >= 1.5) return 'Effizienz mittelmäßig — Routen-Optimierung oder Bündelung prüfen.';
  return 'Effizienz unter Ziel (<1,5/Std) — Dispatcher: Routen prüfen, Wartezeiten reduzieren!';
}

export function DispatchPhase2270EffizienzRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tour-effizienz?location_id=${locationId}`);
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

  const alertFahrer = useMemo(() => data?.fahrer.filter((f) => f.ampel === 'rot') ?? [], [data]);
  const teamColor_ = useMemo(() => (data ? teamColor(data.team_avg_touren_pro_std) : 'text-gray-600'), [data]);

  if (!locationId) return null;

  const borderFarbe =
    data && data.team_avg_touren_pro_std < 1.5
      ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
      : data && data.team_avg_touren_pro_std < 2
      ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30'
      : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30';

  return (
    <div className={`rounded-xl border p-4 mb-3 ${borderFarbe}`}>
      <button className="w-full flex items-center justify-between gap-2" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Tour-Effizienz Ranking</span>
          {data && (
            <span className={`text-xs font-bold ${teamColor_}`}>
              Ø {data.team_avg_touren_pro_std.toFixed(2)}/Std
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {data ? (
            <>
              {/* Team KPI */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 text-center">
                  <div className={`text-xl font-bold ${teamColor_}`}>
                    {data.team_avg_touren_pro_std.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Ø Touren/Std</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 text-center">
                  <div className={`text-xl font-bold ${data.alert_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {data.alert_count}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Fahrer unter 1,5/Std</div>
                </div>
              </div>

              {/* Dispatcher-Tipp */}
              <p className="text-xs text-gray-600 dark:text-gray-400 italic">{teamTipp(data.team_avg_touren_pro_std)}</p>

              {/* Alert-Banner */}
              {alertFahrer.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 p-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 dark:text-red-300">
                    <strong>{alertFahrer.length} Fahrer unter 1,5 Touren/Std:</strong>{' '}
                    {alertFahrer.map((f) => f.fahrer_name).join(', ')}
                  </div>
                </div>
              )}

              {/* Fahrer-Ranking */}
              <div className="space-y-1.5">
                {data.fahrer.map((f) => (
                  <div key={f.fahrer_id} className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 ${rowBg(f.ampel)}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">{podiumBadge(f.rang) || ampelLabel(f.ampel)}</span>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      <span className={`font-bold ${rowText(f.ampel)}`}>
                        {f.touren_pro_std.toFixed(2)}/Std
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {f.touren_heute} Tour{f.touren_heute !== 1 ? 'en' : ''}
                      </span>
                      <span className={f.trend === 'steigend' ? 'text-green-600 dark:text-green-400' : f.trend === 'fallend' ? 'text-red-500' : 'text-gray-400'}>
                        {trendIcon(f.trend)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">Lade Tour-Effizienz…</div>
          )}
        </div>
      )}
    </div>
  );
}
