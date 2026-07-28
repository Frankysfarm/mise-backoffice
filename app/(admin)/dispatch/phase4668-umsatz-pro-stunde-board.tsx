'use client';

import { useEffect, useState } from 'react';
import { Euro, TrendingDown, TrendingUp, Minus, WifiOff, AlertTriangle } from 'lucide-react';

interface FahrerUmsatzRow {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  rang: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerUmsatzRow[];
  team_avg_umsatz: number;
  alert_count: number;
  gesamt?: number;
}

function DeltaIcon({ rang }: { rang: number }) {
  if (rang === 1) return <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />;
  if (rang <= 2) return <Minus className="w-3 h-3 text-gray-400" />;
  return <TrendingDown className="w-3 h-3 text-red-500 dark:text-red-400" />;
}

function ampelDot(ampel: 'gruen' | 'gelb' | 'rot') {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb') return 'bg-yellow-400';
  return 'bg-red-500';
}

export function DispatchPhase4668UmsatzProStundeBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-stunde${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Umsatz/h nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-48" />;
  }

  const maxUph = Math.max(...data.fahrer.map(f => f.umsatz_pro_stunde), 1);
  const hoechste = data.fahrer[0];
  const niedrigste = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5 justify-between">
        <div className="flex items-center gap-1.5">
          <Euro className="w-4 h-4 text-amber-800 dark:text-amber-400" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Umsatz pro Stunde</span>
        </div>
        <span className="text-[10px] text-gray-400">{data.fahrer.length} Fahrer · 30 Tage</span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-1">
        <div className="bg-amber-50 dark:bg-amber-950 rounded-lg px-2 py-1.5 text-center">
          <div className="text-base font-extrabold text-amber-800 dark:text-amber-300">{hoechste?.umsatz_pro_stunde ?? 0}€</div>
          <div className="text-[9px] text-gray-500 truncate">{hoechste?.fahrer_name ?? '–'}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-center">
          <div className="text-base font-extrabold text-gray-700 dark:text-gray-300">{data.team_avg_umsatz}€</div>
          <div className="text-[9px] text-gray-500">Team-Ø</div>
        </div>
        <div className="bg-red-50 dark:bg-red-950 rounded-lg px-2 py-1.5 text-center">
          <div className="text-base font-extrabold text-red-600 dark:text-red-400">{niedrigste?.umsatz_pro_stunde ?? 0}€</div>
          <div className="text-[9px] text-gray-500 truncate">{niedrigste?.fahrer_name ?? '–'}</div>
        </div>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950 rounded-lg px-2 py-1.5">
          <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-[10px] text-red-700 dark:text-red-300 font-medium">
            {data.alert_count} Fahrer mit niedrigem Umsatz/h
          </span>
        </div>
      )}

      {/* Per-Fahrer Bars */}
      <div className="space-y-1.5">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
              <span className="text-[9px] text-gray-500 w-4 shrink-0">#{f.rang}</span>
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{f.fahrer_name}</span>
              <div className="flex items-center gap-0.5">
                <DeltaIcon rang={f.rang} />
                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">{f.umsatz_pro_stunde}€/h</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                <div
                  className="bg-amber-500 dark:bg-amber-400 h-2 rounded-full"
                  style={{ width: `${(f.umsatz_pro_stunde / maxUph) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1.5">
        <span>Ziel: <span className="font-medium text-amber-800 dark:text-amber-300">≥ 20€/h</span></span>
        <span className="text-[10px] text-gray-400">30-Min-Update</span>
      </div>
    </div>
  );
}
