'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type FahrerEintrag = {
  driver_id?: string;
  fahrer_id?: string;
  name: string;
  lieferungen?: number;
  stopps?: number;
  km_gefahren?: number;
  km?: number;
  gesamtkosten?: number;
  einnahmen?: number;
  umsatz?: number;
  kosten_pro_lieferung: number;
  kosten_pro_km?: number;
  marge_prozent?: number;
  ekv?: number;
  rang?: number;
};

type ApiResponse = {
  fahrer: FahrerEintrag[];
  avg_kosten_pro_lieferung?: number;
  team_ø_kosten?: number;
  avg_ekv?: number;
  team_ø_marge?: number;
};

function mockDaten(): ApiResponse {
  return {
    fahrer: [
      { driver_id: 'f1', name: 'Max M.', lieferungen: 14, km_gefahren: 38, gesamtkosten: 109, einnahmen: 420, kosten_pro_lieferung: 7.79, ekv: 74, rang: 1 },
      { driver_id: 'f2', name: 'Anna S.', lieferungen: 11, km_gefahren: 45, gesamtkosten: 108, einnahmen: 310, kosten_pro_lieferung: 9.78, ekv: 65, rang: 2 },
      { driver_id: 'f3', name: 'Luca B.', lieferungen: 8, km_gefahren: 52, gesamtkosten: 91, einnahmen: 190, kosten_pro_lieferung: 11.4, ekv: 52, rang: 3 },
    ],
    avg_kosten_pro_lieferung: 9.66,
    avg_ekv: 64,
  };
}

export function DispatchPhase1055FahrerKostenEffizienzBoard({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/fahrer-kosten-effizienz?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        throw new Error('api error');
      }
    } catch {
      setData(mockDaten());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  const teamOeKosten = data?.avg_kosten_pro_lieferung ?? data?.team_ø_kosten ?? 0;
  const fahrer = data?.fahrer ?? [];

  if (!loading && fahrer.length === 0) return null;

  const rangEmoji = (rang: number) => rang === 1 ? '🥇' : rang === 2 ? '🥈' : rang === 3 ? '🥉' : `${rang}.`;

  return (
    <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingDown size={16} className="text-teal-600 dark:text-teal-400" />
          <span className="font-semibold text-teal-800 dark:text-teal-200 text-sm">
            Fahrer-Kosten-Effizienz — Ranking heute
          </span>
          {teamOeKosten > 0 && (
            <span className="ml-2 rounded-full bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5">
              Team-Ø {teamOeKosten.toFixed(2)} €/Lief.
            </span>
          )}
        </div>
        {loading ? (
          <Loader2 size={14} className="animate-spin text-teal-400" />
        ) : open ? (
          <ChevronUp size={14} className="text-teal-500" />
        ) : (
          <ChevronDown size={14} className="text-teal-500" />
        )}
      </button>

      {open && data && fahrer.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          {fahrer.map((f, idx) => {
            const rang = f.rang ?? idx + 1;
            const kpl = f.kosten_pro_lieferung;
            const vsTeam = teamOeKosten > 0 ? ((kpl - teamOeKosten) / teamOeKosten) * 100 : 0;
            const effizienter = vsTeam < -5;
            const teurer = vsTeam > 5;
            const stopps = f.lieferungen ?? f.stopps ?? 0;
            const km = f.km_gefahren ?? f.km ?? 0;
            const ekv = f.ekv ?? f.marge_prozent ?? 0;

            return (
              <div
                key={f.driver_id ?? f.fahrer_id ?? idx}
                className={cn(
                  'rounded-xl border p-3',
                  rang === 1
                    ? 'bg-white dark:bg-teal-900/30 border-teal-200 dark:border-teal-700'
                    : 'bg-white/70 dark:bg-teal-950/40 border-teal-100 dark:border-teal-800'
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{rangEmoji(rang)}</span>
                    <span className="text-sm font-bold text-teal-900 dark:text-teal-100">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black tabular-nums text-teal-800 dark:text-teal-200">
                      {kpl.toFixed(2)} €
                    </span>
                    {effizienter ? (
                      <TrendingUp size={12} className="text-matcha-600 dark:text-matcha-400" />
                    ) : teurer ? (
                      <TrendingDown size={12} className="text-red-500 dark:text-red-400" />
                    ) : (
                      <Minus size={12} className="text-muted-foreground" />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-teal-600 dark:text-teal-400">
                  <span>{stopps} Lief.</span>
                  <span>{km} km</span>
                  {ekv > 0 && (
                    <span className={cn(
                      'font-bold rounded px-1',
                      ekv >= 70 ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300'
                        : ekv >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    )}>
                      EKV {ekv}%
                    </span>
                  )}
                  {vsTeam !== 0 && (
                    <span className={cn('ml-auto font-semibold', effizienter ? 'text-matcha-600 dark:text-matcha-400' : teurer ? 'text-red-500' : 'text-muted-foreground')}>
                      {vsTeam > 0 ? '+' : ''}{Math.round(vsTeam)}% vs. Ø
                    </span>
                  )}
                </div>

                {/* Kosten-Balken relativ zum Team-Ø */}
                {teamOeKosten > 0 && (
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', effizienter ? 'bg-matcha-500' : teurer ? 'bg-red-400' : 'bg-amber-400')}
                      style={{ width: `${Math.min(100, (kpl / (teamOeKosten * 1.5)) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-[10px] text-teal-400 dark:text-teal-500">
            Kosten = Lohn (÷ Stopps) + 0,25 €/km · Aktualisiert alle 5 Min
          </p>
        </div>
      )}
    </div>
  );
}
