'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';

interface FahrerEffizienz {
  driver_id: string;
  fahrer_name: string;
  effizienz_score: number;
  touren_anzahl: number;
  lieferungen_pro_h: number;
  km_pro_tour: number;
  schicht_dauer_h: number;
  stufe: 'top' | 'gut' | 'mittel' | 'niedrig';
}

interface Props {
  locationId: string | null;
}

function heatColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500 text-white';
  if (score >= 60) return 'bg-lime-400 text-lime-900';
  if (score >= 40) return 'bg-amber-400 text-amber-900';
  return 'bg-red-400 text-white';
}

function stufeLabel(stufe: FahrerEffizienz['stufe']): string {
  switch (stufe) {
    case 'top': return 'Top';
    case 'gut': return 'Gut';
    case 'mittel': return 'Mittel';
    case 'niedrig': return 'Niedrig';
  }
}

export function DispatchPhase782FahrerEffizienzHeatmap({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerEffizienz[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-touren-effizienz?location_id=${locationId}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.ok && Array.isArray(json.fahrer)) {
          setFahrer(json.fahrer);
        }
      } catch {
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && fahrer.length === 0) return null;

  const maxScore = Math.max(...fahrer.map((f) => f.effizienz_score), 1);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700">
        <Flame className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Phase 782 · Fahrer-Effizienz-Heatmap
        </span>
        <span className="ml-auto text-[10px] text-slate-400">30s • heute</span>
      </div>

      {loading && fahrer.length === 0 ? (
        <div className="px-4 py-3 text-xs text-slate-400">Lade…</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {fahrer.map((f) => {
            const barPct = Math.round((f.effizienz_score / 100) * 100);
            const heat = heatColor(f.effizienz_score);
            const relPct = Math.round((f.effizienz_score / maxScore) * 100);

            return (
              <div key={f.driver_id} className="flex items-center gap-3 px-4 py-2.5">
                {/* Score-Kachel (Heatmap-Cell) */}
                <div
                  className={`shrink-0 w-12 h-10 rounded-lg flex flex-col items-center justify-center text-center ${heat}`}
                  style={{ opacity: 0.5 + (relPct / 200) }}
                >
                  <span className="text-sm font-black tabular-nums leading-none">{f.effizienz_score}</span>
                  <span className="text-[7px] font-bold uppercase leading-none mt-0.5">{stufeLabel(f.stufe)}</span>
                </div>

                {/* Name + Bars */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {f.fahrer_name}
                    </span>
                    <span className="text-[9px] text-slate-400 shrink-0 ml-2">
                      {f.touren_anzahl} Tour{f.touren_anzahl !== 1 ? 'en' : ''} · {f.lieferungen_pro_h}/h
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        f.effizienz_score >= 80 ? 'bg-emerald-500' :
                        f.effizienz_score >= 60 ? 'bg-lime-500' :
                        f.effizienz_score >= 40 ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[9px] text-slate-400">
                    <span>{f.schicht_dauer_h}h Schicht</span>
                    <span>{f.km_pro_tour} km/Tour</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legende */}
      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3 flex-wrap">
        {[
          { label: '≥80 Top', color: 'bg-emerald-500' },
          { label: '≥60 Gut', color: 'bg-lime-400' },
          { label: '≥40 Mittel', color: 'bg-amber-400' },
          { label: '<40 Niedrig', color: 'bg-red-400' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} />
            <span className="text-[9px] text-slate-500 dark:text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
