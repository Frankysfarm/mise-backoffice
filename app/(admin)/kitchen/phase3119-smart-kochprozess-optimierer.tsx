'use client';
import { useEffect, useState } from 'react';
import { Zap, TrendingUp, AlertTriangle, ChefHat } from 'lucide-react';

interface KategorieStat {
  kategorie: string;
  avg_min: number;
  ziel_min: number;
  abweichung_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  tipp: string | null;
}

interface ApiData {
  kategorien: KategorieStat[];
  gesamt_effizienz_pct: number;
  beste_kategorie: string | null;
  schlechteste_kategorie: string | null;
}

const MOCK: ApiData = {
  kategorien: [
    { kategorie: 'Pizza', avg_min: 12.4, ziel_min: 12, abweichung_pct: 3, ampel: 'gruen', tipp: null },
    { kategorie: 'Burger', avg_min: 9.8, ziel_min: 8, abweichung_pct: 22, ampel: 'gelb', tipp: 'Parallelgrillen einsetzen' },
    { kategorie: 'Salat', avg_min: 5.2, ziel_min: 5, abweichung_pct: 4, ampel: 'gruen', tipp: null },
    { kategorie: 'Pasta', avg_min: 16.1, ziel_min: 12, abweichung_pct: 34, ampel: 'rot', tipp: 'Nudelwasser vorheizen' },
  ],
  gesamt_effizienz_pct: 78,
  beste_kategorie: 'Salat',
  schlechteste_kategorie: 'Pasta',
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb: 'bg-amber-500',
  rot: 'bg-red-500',
};
const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-emerald-600 dark:text-emerald-400',
  gelb: 'text-amber-600 dark:text-amber-400',
  rot: 'text-red-600 dark:text-red-400',
};

export function KitchenPhase3119SmartKochprozessOptimierer() {
  const [data, setData] = useState<ApiData>(MOCK);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/delivery/admin/kochprozess-optimierer', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {}
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  const effizienzColor = data.gesamt_effizienz_pct >= 90 ? 'text-emerald-600' : data.gesamt_effizienz_pct >= 70 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-sm">Smart Kochprozess-Optimierer</span>
        </div>
        <div className={`text-xl font-bold ${effizienzColor}`}>{data.gesamt_effizienz_pct}%</div>
      </div>

      {data.schlechteste_kategorie && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Optimierungspotenzial: <strong>{data.schlechteste_kategorie}</strong></span>
        </div>
      )}

      <div className="space-y-2">
        {data.kategorien.map((k) => {
          const barWidth = Math.min(100, (k.ziel_min / k.avg_min) * 100);
          return (
            <div key={k.kategorie} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{k.kategorie}</span>
                <span className={AMPEL_TEXT[k.ampel]}>
                  {k.avg_min.toFixed(1)}' <span className="text-zinc-400">(Ziel {k.ziel_min}')</span>
                </span>
              </div>
              <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${AMPEL_BG[k.ampel]}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              {k.tipp && (
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Zap className="w-3 h-3 text-amber-500" /> {k.tipp}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.beste_kategorie && (
        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="w-3 h-3" /> Beste Kategorie: <strong>{data.beste_kategorie}</strong>
        </div>
      )}
    </div>
  );
}
