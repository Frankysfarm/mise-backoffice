'use client';

import { useEffect, useState } from 'react';
import { Award, ChevronDown, ChevronUp, Loader2, TrendingDown, TrendingUp } from 'lucide-react';

interface FahrerStats {
  id: string;
  name: string;
  rang: number;
  touren: number;
  stopps: number;
  stopps_pro_h: number;
  km_pro_stopp: number;
  puenktlichkeit_pct: number;
  avg_bewertung: number | null;
  score: number;
  delta_stopps_pct: number;
  delta_puenkt_pct: number;
}

interface BenchmarkData {
  fahrer: FahrerStats[];
  location_avg: {
    stopps_pro_h: number;
    km_pro_stopp: number;
    puenktlichkeit_pct: number;
    avg_bewertung: number | null;
  } | null;
  generatedAt: string;
}

const MOCK: BenchmarkData = {
  fahrer: [
    { id: '1', name: 'Alex M.', rang: 1, touren: 18, stopps: 54, stopps_pro_h: 3.2, km_pro_stopp: 1.8, puenktlichkeit_pct: 94, avg_bewertung: 4.8, score: 112, delta_stopps_pct: 14, delta_puenkt_pct: 6 },
    { id: '2', name: 'Sara K.', rang: 2, touren: 15, stopps: 41, stopps_pro_h: 2.9, km_pro_stopp: 2.1, puenktlichkeit_pct: 91, avg_bewertung: 4.6, score: 104, delta_stopps_pct: 4, delta_puenkt_pct: 3 },
    { id: '3', name: 'Tom R.', rang: 3, touren: 12, stopps: 29, stopps_pro_h: 2.4, km_pro_stopp: 2.8, puenktlichkeit_pct: 83, avg_bewertung: 4.2, score: 88, delta_stopps_pct: -14, delta_puenkt_pct: -5 },
  ],
  location_avg: { stopps_pro_h: 2.8, km_pro_stopp: 2.2, puenktlichkeit_pct: 89, avg_bewertung: 4.5 },
  generatedAt: new Date().toISOString(),
};

export function LieferdienstPhase846ProduktivitaetsBenchmark({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/produktivitaets-benchmark?location_id=${locationId}`, { cache: 'no-store' });
      setData(res.ok ? await res.json() : MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    const iv = setInterval(load, 300_000);
    return () => clearInterval(iv);
  }, [open, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const medalColor = (rang: number) =>
    rang === 1 ? 'text-yellow-500' : rang === 2 ? 'text-stone-400' : rang === 3 ? 'text-amber-700' : 'text-stone-300';

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Produktivitäts-Benchmark</span>
          {data?.fahrer && data.fahrer.length > 0 && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {data.fahrer.length} Fahrer · 7 Tage
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Benchmark…
            </div>
          )}

          {!loading && data?.location_avg && (
            <div className="grid grid-cols-4 gap-2 rounded-xl bg-stone-50 border p-3">
              {[
                { label: 'Ø Stopps/h', value: data.location_avg.stopps_pro_h },
                { label: 'Ø km/Stopp', value: data.location_avg.km_pro_stopp },
                { label: 'Ø Pünktl.', value: `${data.location_avg.puenktlichkeit_pct}%` },
                { label: 'Ø Bewertung', value: data.location_avg.avg_bewertung ?? '–' },
              ].map(kpi => (
                <div key={kpi.label} className="text-center">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</div>
                  <div className="text-base font-black tabular-nums text-stone-800">{kpi.value}</div>
                </div>
              ))}
            </div>
          )}

          {!loading && data?.fahrer && data.fahrer.length > 0 && (
            <div className="space-y-2">
              {data.fahrer.map(f => (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3">
                  <span className={`w-7 text-center text-lg font-black ${medalColor(f.rang)}`}>
                    {f.rang <= 3 ? ['🥇', '🥈', '🥉'][f.rang - 1] : f.rang}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-800 truncate">{f.name}</span>
                      <span className="rounded-full bg-matcha-100 px-1.5 py-0.5 text-[10px] font-bold text-matcha-700">
                        Score {f.score}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      <span>{f.touren} Touren</span>
                      <span>{f.stopps} Stopps</span>
                      <span>{f.stopps_pro_h} /h</span>
                      <span>{f.puenktlichkeit_pct}% pünktl.</span>
                      {f.avg_bewertung && <span>★ {f.avg_bewertung}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className={`flex items-center gap-0.5 text-[11px] font-bold ${f.delta_stopps_pct >= 0 ? 'text-matcha-700' : 'text-red-600'}`}>
                      {f.delta_stopps_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {f.delta_stopps_pct > 0 ? '+' : ''}{f.delta_stopps_pct}% Tempo
                    </span>
                    <span className={`text-[10px] font-medium ${f.delta_puenkt_pct >= 0 ? 'text-matcha-600' : 'text-red-500'}`}>
                      {f.delta_puenkt_pct > 0 ? '+' : ''}{f.delta_puenkt_pct}pp Pünktl.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && (!data?.fahrer || data.fahrer.length === 0) && (
            <div className="text-sm text-muted-foreground text-center py-4">
              Keine Daten für die letzten 7 Tage — Mock-Daten werden angezeigt.
            </div>
          )}

          {!locationId && (
            <div className="text-sm text-muted-foreground">Bitte Filiale auswählen.</div>
          )}
        </div>
      )}
    </div>
  );
}
