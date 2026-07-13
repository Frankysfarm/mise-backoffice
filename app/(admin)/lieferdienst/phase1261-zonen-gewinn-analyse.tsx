'use client';

// Phase 1261 — Zonen-Gewinn-Analyse (Lieferdienst)
// Nutzt /api/delivery/admin/lieferzonen-gewinn:
// Umsatz je Zone − Fahrtkosten → Gewinn + Effizienz-Ranking
// Props: locationId · 15-Min-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, Loader2, MapPin, Euro, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZonenGewinn {
  zone: string;
  umsatz_eur: number;
  fahrtkosten_eur: number;
  gewinn_eur: number;
  bestellungen: number;
  gewinn_pro_bestellung: number;
  effizienz: 'top' | 'gut' | 'mittel' | 'niedrig';
}

interface ApiResponse {
  zonen: ZonenGewinn[];
  beste_zone: string | null;
  gesamt_umsatz_eur: number;
  gesamt_gewinn_eur: number;
  location_id: string;
  generiert_am: string;
}

const EFF_STYLE = {
  top:    { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Top' },
  gut:    { badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', label: 'Gut' },
  mittel: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', label: 'Mittel' },
  niedrig:{ badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', label: 'Niedrig' },
};

function fmt(eur: number) { return eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const MOCK: ApiResponse = {
  zonen: [
    { zone: 'Nord', umsatz_eur: 1240, fahrtkosten_eur: 126, gewinn_eur: 1114, bestellungen: 34, gewinn_pro_bestellung: 32.76, effizienz: 'top' },
    { zone: 'Süd',  umsatz_eur: 980,  fahrtkosten_eur: 178, gewinn_eur: 802,  bestellungen: 26, gewinn_pro_bestellung: 30.85, effizienz: 'top' },
    { zone: 'Ost',  umsatz_eur: 670,  fahrtkosten_eur: 95,  gewinn_eur: 575,  bestellungen: 18, gewinn_pro_bestellung: 31.94, effizienz: 'top' },
    { zone: 'West', umsatz_eur: 420,  fahrtkosten_eur: 138, gewinn_eur: 282,  bestellungen: 11, gewinn_pro_bestellung: 25.64, effizienz: 'gut' },
  ],
  beste_zone: 'Nord',
  gesamt_umsatz_eur: 3310,
  gesamt_gewinn_eur: 2773,
  location_id: '', generiert_am: new Date().toISOString(),
};

export function LieferdienstPhase1261ZonenGewinnAnalyse({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const r = await fetch(`/api/delivery/admin/lieferzonen-gewinn?location_id=${locationId}`);
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData({ ...MOCK, location_id: locationId });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); const t = setInterval(load, 15 * 60_000); return () => clearInterval(t); }, [locationId]);

  const d = data ?? MOCK;
  const maxGewinn = Math.max(...d.zonen.map(z => z.gewinn_eur), 1);

  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 shadow-sm overflow-hidden mb-3">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <span className="font-semibold text-sm">Zonen-Gewinn-Analyse</span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
              {d.beste_zone ? `Beste Zone: ${d.beste_zone}` : `${d.zonen.length} Zonen`}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-2.5 flex items-center gap-2">
              <Euro className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Gesamt-Umsatz</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{fmt(d.gesamt_umsatz_eur)} €</p>
              </div>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-2.5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Gesamt-Gewinn</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{fmt(d.gesamt_gewinn_eur)} €</p>
              </div>
            </div>
          </div>

          {/* Zone rows */}
          <div className="space-y-2">
            {d.zonen.map(z => {
              const barPct = (z.gewinn_eur / maxGewinn) * 100;
              const ef = EFF_STYLE[z.effizienz];
              return (
                <div key={z.zone} className="rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-teal-500" />
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{z.zone}</span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-xs font-medium', ef.badge)}>{ef.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <Truck className="h-3 w-3" />
                        {fmt(z.fahrtkosten_eur)} €
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">{fmt(z.gewinn_eur)} €</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {z.bestellungen} Bestellungen · {fmt(z.gewinn_pro_bestellung)} €/Bestell.
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 text-right">
            Stand: {new Date(d.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
        </div>
      )}
    </div>
  );
}
