'use client';

import React, { useEffect, useState } from 'react';

interface BonusSchwelle {
  key: string;
  label: string;
  einheit: string;
  ziel: number;
  aktuell: number;
  pct: number;
  erreicht: boolean;
  bonus_eur: number;
}

interface BonusChancenData {
  driver_id: string;
  name: string;
  schwellen: BonusSchwelle[];
  total_erreichbar_eur: number;
  total_erreicht_eur: number;
  ampel: 'nah' | 'mittel' | 'weit';
  ablauf_datum: string;
}

interface Props {
  locationId: string | null;
}

const AMPEL = {
  nah:   { badge: 'bg-emerald-100 border-emerald-300 text-emerald-800', dot: 'bg-emerald-500', label: 'Nah am Bonus' },
  mittel: { badge: 'bg-amber-100  border-amber-300  text-amber-800',   dot: 'bg-amber-400',   label: 'Auf dem Weg' },
  weit:  { badge: 'bg-rose-100   border-rose-300   text-rose-800',    dot: 'bg-rose-500',    label: 'Weit entfernt' },
};

const MOCK_DRIVERS: BonusChancenData[] = [
  {
    driver_id: 'f1', name: 'Max M.', ampel: 'nah',
    total_erreichbar_eur: 33, total_erreicht_eur: 10,
    ablauf_datum: new Date(Date.now() + 2 * 86400_000).toISOString(),
    schwellen: [
      { key: 'stopps', label: 'Stopps', einheit: 'Stopps', ziel: 25, aktuell: 22, pct: 88, erreicht: false, bonus_eur: 10 },
      { key: 'umsatz', label: 'Umsatz', einheit: '€', ziel: 500, aktuell: 310, pct: 62, erreicht: false, bonus_eur: 15 },
      { key: 'bewertung', label: 'Bewertung', einheit: '★', ziel: 4.7, aktuell: 4.8, pct: 100, erreicht: true, bonus_eur: 8 },
    ],
  },
  {
    driver_id: 'f2', name: 'Anna S.', ampel: 'mittel',
    total_erreichbar_eur: 33, total_erreicht_eur: 0,
    ablauf_datum: new Date(Date.now() + 2 * 86400_000).toISOString(),
    schwellen: [
      { key: 'stopps', label: 'Stopps', einheit: 'Stopps', ziel: 25, aktuell: 14, pct: 56, erreicht: false, bonus_eur: 10 },
      { key: 'umsatz', label: 'Umsatz', einheit: '€', ziel: 500, aktuell: 230, pct: 46, erreicht: false, bonus_eur: 15 },
      { key: 'bewertung', label: 'Bewertung', einheit: '★', ziel: 4.7, aktuell: 4.4, pct: 94, erreicht: false, bonus_eur: 8 },
    ],
  },
];

function daysLeft(isoDate: string): number {
  return Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400_000));
}

export function DispatchPhase1589FahrerBonusChancenWidget({ locationId }: Props) {
  const [data, setData] = useState<BonusChancenData[]>(MOCK_DRIVERS);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/driver/bonus-chancen?driver_id=all&location_id=${locationId}`,
        );
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) setData(json);
          else if (json.driver_id) setData([json]);
        }
      } catch {
        // keep mock
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 15 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!open) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-600 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Fahrer-Bonus-Chancen</span>
        {loading && <span className="text-xs text-white/60">Lädt…</span>}
        <button onClick={() => setOpen(false)} className="text-lg leading-none text-white/60 hover:text-white">×</button>
      </div>

      <div className="divide-y divide-gray-100">
        {data.map((driver: BonusChancenData) => {
          const amp = AMPEL[driver.ampel as keyof typeof AMPEL];
          const days = daysLeft(driver.ablauf_datum);
          return (
            <div key={driver.driver_id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-800">{driver.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-semibold ${amp.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${amp.dot}`} />
                    {amp.label}
                  </span>
                  <span className="text-xs text-gray-400">{days}T verbleib.</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {driver.schwellen.map((s) => (
                  <div key={s.key}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-500">{s.label}</span>
                      <span className={`font-semibold ${s.erreicht ? 'text-emerald-600' : 'text-gray-700'}`}>
                        {s.aktuell}{s.einheit === '€' ? ' €' : s.einheit === '★' ? ' ★' : ''} / {s.ziel}{s.einheit === '€' ? ' €' : s.einheit === '★' ? ' ★' : ''}
                        {s.erreicht ? ' ✓' : ''}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${s.erreicht ? 'bg-emerald-500' : 'bg-matcha-400'}`}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex justify-between text-xs">
                <span className="text-gray-400">
                  Erreichbar: <span className="font-bold text-gray-700">{driver.total_erreichbar_eur} €</span>
                </span>
                <span className="text-gray-400">
                  Erreicht: <span className="font-bold text-emerald-600">{driver.total_erreicht_eur} €</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
