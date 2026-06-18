'use client';

import * as React from 'react';

// Mock — API-Anbindung folgt
type FahrerStatus = 'Aktiv' | 'Pause' | 'Bereit';

interface FahrerEntry {
  id: string;
  name: string;
  initials: string;
  status: FahrerStatus;
  toursHeute: number;
  auslastung: number;
}

function getMockFahrer(): FahrerEntry[] {
  const drivers = [
    { name: 'Max Müller', initials: 'MM' },
    { name: 'Jana Koch', initials: 'JK' },
    { name: 'Tom Schulz', initials: 'TS' },
    { name: 'Lena Bauer', initials: 'LB' },
    { name: 'Erik Vogel', initials: 'EV' },
    { name: 'Sara Weiß', initials: 'SW' },
  ];
  const statuses: FahrerStatus[] = ['Aktiv', 'Pause', 'Bereit'];
  return drivers.map((d, i) => ({
    id: `f-${i}`,
    name: d.name,
    initials: d.initials,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    toursHeute: Math.floor(Math.random() * 7) + 2,
    auslastung: Math.floor(Math.random() * 70) + 25,
  }));
}

function auslastungColor(pct: number): string {
  if (pct <= 70) return 'bg-green-500';
  if (pct <= 90) return 'bg-amber-500';
  return 'bg-red-500';
}

function statusBadge(status: FahrerStatus): string {
  if (status === 'Aktiv') return 'text-green-700 bg-green-50 border-green-200';
  if (status === 'Pause') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-matcha-700 bg-matcha-50 border-matcha-200';
}

interface Props {
  locationId: string;
}

export function FahrerAuslastungsMatrix({ locationId: _locationId }: Props) {
  const [fahrer, setFahrer] = React.useState<FahrerEntry[]>(() => getMockFahrer());

  React.useEffect(() => {
    const iv = setInterval(() => setFahrer(getMockFahrer()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const gesamtAuslastung = Math.round(
    fahrer.reduce((sum, f) => sum + f.auslastung, 0) / fahrer.length,
  );

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-matcha-700">Fahrer-Auslastung</span>
        <span className="text-xs text-matcha-500">{fahrer.length} Fahrer</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {fahrer.map((f) => (
          <div
            key={f.id}
            className="rounded-lg border border-matcha-200 bg-white p-3 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-matcha-100 text-matcha-700 text-xs font-bold flex items-center justify-center shrink-0">
                {f.initials}
              </span>
              <span className="text-xs font-medium text-gray-700 truncate">{f.name}</span>
            </div>

            <span className={`text-xs font-medium border rounded-full px-2 py-0.5 self-start ${statusBadge(f.status)}`}>
              {f.status}
            </span>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{f.toursHeute} Touren</span>
              <span className="font-semibold text-gray-700">{f.auslastung}%</span>
            </div>

            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${auslastungColor(f.auslastung)}`}
                style={{ width: `${f.auslastung}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Gesamt-Auslastung */}
      <div className="rounded-lg border border-matcha-200 bg-white p-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-matcha-700">Auslastung gesamt</span>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${auslastungColor(gesamtAuslastung)}`}
              style={{ width: `${gesamtAuslastung}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gray-700">{gesamtAuslastung}%</span>
        </div>
      </div>
    </div>
  );
}
