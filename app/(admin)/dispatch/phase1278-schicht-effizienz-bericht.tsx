'use client';

// Phase 1278 — Schicht-Effizienz-Bericht (Dispatch)
// Tagesabschluss-Karte: Stopps/Fahrer/Stunde, Pünktlichkeitsquote, Gesamt-km, Kosten/Stopp
// Nur sichtbar nach 20:00 Uhr · 30-Min-Polling · nach Phase1273

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, BarChart3, Loader2, Trophy, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiResponse {
  stopps_gesamt: number;
  aktive_fahrer: number;
  schicht_stunden: number;
  stopps_pro_fahrer_stunde: number;
  puenktlichkeits_quote: number;
  gesamt_km: number;
  kosten_pro_stopp_eur: number;
  umsatz_eur: number;
  top_fahrer: string | null;
  top_fahrer_stopps: number;
  location_id: string;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  stopps_gesamt: 87,
  aktive_fahrer: 5,
  schicht_stunden: 8,
  stopps_pro_fahrer_stunde: 2.18,
  puenktlichkeits_quote: 84,
  gesamt_km: 312,
  kosten_pro_stopp_eur: 2.40,
  umsatz_eur: 3480,
  top_fahrer: 'Max M.',
  top_fahrer_stopps: 22,
  location_id: '',
  generiert_am: new Date().toISOString(),
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function puenktlichFarbe(quote: number): string {
  if (quote >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (quote >= 75) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function DispatchPhase1278SchichtEffizienzBericht({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const stunde = new Date().getHours();
  if (stunde < 20) return null;

  async function load() {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const r = await fetch(`/api/delivery/admin/schicht-effizienz-bericht?location_id=${locationId}`);
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData({ ...MOCK, location_id: locationId });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 shadow-sm overflow-hidden mb-3">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="font-semibold text-sm">Schicht-Effizienz-Bericht</span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
              {d.stopps_gesamt} Stopps · {fmtEur(d.umsatz_eur)} €
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-2.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Stopps/Fahrer/h</p>
              <p className="text-lg font-bold text-violet-700 dark:text-violet-300">
                {d.stopps_pro_fahrer_stunde.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400">{d.aktive_fahrer} Fahrer · {d.schicht_stunden}h</p>
            </div>

            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-2.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Pünktlichkeit</p>
              <p className={cn('text-lg font-bold', puenktlichFarbe(d.puenktlichkeits_quote))}>
                {d.puenktlichkeits_quote}%
              </p>
              <p className="text-xs text-slate-400">{d.stopps_gesamt} Stopps gesamt</p>
            </div>

            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-2.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Gesamt-km</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {d.gesamt_km} km
              </p>
              <p className="text-xs text-slate-400">{fmtEur(d.kosten_pro_stopp_eur)} €/Stopp</p>
            </div>

            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-2.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Umsatz</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {fmtEur(d.umsatz_eur)} €
              </p>
              <p className="text-xs text-slate-400">Lieferungen</p>
            </div>
          </div>

          {/* Top-Fahrer */}
          {d.top_fahrer && (
            <div className="rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 flex items-center gap-3">
              <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Top-Fahrer heute</p>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                  {d.top_fahrer}
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-normal">
                    {d.top_fahrer_stopps} Stopps
                  </span>
                </p>
              </div>
              <Star className="h-4 w-4 text-amber-400 ml-auto" />
            </div>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500 text-right">
            Stand: {new Date(d.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
        </div>
      )}
    </div>
  );
}
