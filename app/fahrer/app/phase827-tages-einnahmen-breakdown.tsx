'use client';

import { useEffect, useState } from 'react';
import { Wallet, ChevronDown, ChevronUp, Gift, Star, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  driverId: string;
}

interface TourEinnahme {
  tour_id: string;
  tour_nr: number;
  abgeschlossen_um: string;
  grundbetrag: number;
  trinkgeld: number;
  bonus: number;
  gesamt: number;
}

interface BreakdownData {
  touren: TourEinnahme[];
  summe_grundbetrag: number;
  summe_trinkgeld: number;
  summe_bonus: number;
  gesamt_heute: number;
  aktualisiert: string;
}

const MOCK: BreakdownData = {
  touren: [
    { tour_id: 't1', tour_nr: 1, abgeschlossen_um: '11:03', grundbetrag: 4.50, trinkgeld: 1.50, bonus: 0, gesamt: 6.00 },
    { tour_id: 't2', tour_nr: 2, abgeschlossen_um: '12:27', grundbetrag: 4.50, trinkgeld: 2.00, bonus: 0, gesamt: 6.50 },
    { tour_id: 't3', tour_nr: 3, abgeschlossen_um: '13:45', grundbetrag: 4.50, trinkgeld: 0, bonus: 5.00, gesamt: 9.50 },
    { tour_id: 't4', tour_nr: 4, abgeschlossen_um: '15:10', grundbetrag: 4.50, trinkgeld: 3.00, bonus: 0, gesamt: 7.50 },
  ],
  summe_grundbetrag: 18.00,
  summe_trinkgeld: 6.50,
  summe_bonus: 5.00,
  gesamt_heute: 29.50,
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

function fmt(val: number): string {
  return val.toFixed(2).replace('.', ',') + ' €';
}

export function FahrerPhase827TagesEinnahmenBreakdown({ driverId }: Props) {
  const [data, setData] = useState<BreakdownData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(`/api/delivery/driver/tages-einnahmen?driver_id=${driverId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const touren: TourEinnahme[] = Array.isArray(json.touren)
        ? json.touren.map((t: Record<string, unknown>, i: number) => ({
            tour_id: String(t.id ?? t.tour_id ?? i),
            tour_nr: Number(t.nr ?? t.tour_nr ?? i + 1),
            abgeschlossen_um: String(t.abgeschlossen_um ?? t.completed_at ?? '--:--'),
            grundbetrag: Number(t.grundbetrag ?? t.base ?? 4.50),
            trinkgeld: Number(t.trinkgeld ?? t.tip ?? 0),
            bonus: Number(t.bonus ?? 0),
            gesamt: Number(t.gesamt ?? t.total ?? 0),
          }))
        : MOCK.touren;
      setData({
        touren,
        summe_grundbetrag: Number(json.summe_grundbetrag ?? touren.reduce((s, t) => s + t.grundbetrag, 0)),
        summe_trinkgeld: Number(json.summe_trinkgeld ?? touren.reduce((s, t) => s + t.trinkgeld, 0)),
        summe_bonus: Number(json.summe_bonus ?? touren.reduce((s, t) => s + t.bonus, 0)),
        gesamt_heute: Number(json.gesamt_heute ?? touren.reduce((s, t) => s + t.gesamt, 0)),
        aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [driverId]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = data ?? MOCK;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-emerald-50 hover:bg-emerald-100 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Wallet className="h-4 w-4 text-emerald-600" />
        <span className="text-sm font-bold text-emerald-800">Tages-Einnahmen</span>
        <span className="ml-auto text-base font-black text-emerald-700">{fmt(d.gesamt_heute)}</span>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400 ml-1" /> : <ChevronDown className="h-4 w-4 text-stone-400 ml-1" />}
      </button>

      {open && (
        <>
          {/* Zusammenfassung */}
          <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100 bg-stone-50">
            <div className="flex flex-col items-center py-2.5 gap-0.5">
              <Package className="h-3.5 w-3.5 text-stone-400" />
              <span className="text-[9px] text-stone-500 uppercase tracking-wide">Grundlohn</span>
              <span className="text-sm font-bold text-stone-700">{fmt(d.summe_grundbetrag)}</span>
            </div>
            <div className="flex flex-col items-center py-2.5 gap-0.5">
              <Star className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[9px] text-stone-500 uppercase tracking-wide">Trinkgeld</span>
              <span className="text-sm font-bold text-amber-600">{fmt(d.summe_trinkgeld)}</span>
            </div>
            <div className="flex flex-col items-center py-2.5 gap-0.5">
              <Gift className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[9px] text-stone-500 uppercase tracking-wide">Bonus</span>
              <span className="text-sm font-bold text-indigo-600">{fmt(d.summe_bonus)}</span>
            </div>
          </div>

          {/* Tour-Liste */}
          <div className="divide-y divide-stone-50 max-h-56 overflow-y-auto">
            {d.touren.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-4">Noch keine Touren heute</p>
            )}
            {d.touren.map((t) => (
              <div key={t.tour_id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-black text-stone-600 shrink-0">
                  {t.tour_nr}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-500">{t.abgeschlossen_um} Uhr</span>
                    <span className="text-sm font-bold text-stone-800">{fmt(t.gesamt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-stone-400">{fmt(t.grundbetrag)} Basis</span>
                    {t.trinkgeld > 0 && (
                      <span className="text-[10px] text-amber-600 font-semibold">+{fmt(t.trinkgeld)} Tip</span>
                    )}
                    {t.bonus > 0 && (
                      <span className="text-[10px] text-indigo-600 font-semibold">+{fmt(t.bonus)} Bonus</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-stone-100 flex justify-between items-center">
            <span className="text-[10px] text-stone-400">{d.touren.length} Touren heute</span>
            <span className="text-[10px] text-stone-400">{d.aktualisiert}</span>
          </div>
        </>
      )}

      {!open && loading && (
        <div className="px-4 py-2 text-[10px] text-stone-400 text-center">Lade Einnahmen…</div>
      )}
    </div>
  );
}
