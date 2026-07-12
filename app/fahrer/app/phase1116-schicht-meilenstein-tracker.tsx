'use client';

import { useCallback, useEffect, useState } from 'react';
import { Award, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1116 — Schicht-Meilenstein-Tracker (Fahrer-App)
// Zeigt erreichte Meilensteine der aktuellen Schicht + Fortschritt zum nächsten

interface Props {
  driverId: string;
  isOnline: boolean;
}

type MeilensteinStatus = 'erreicht' | 'naechster' | 'offen';

type Meilenstein = {
  id: string;
  label: string;
  ziel: number;
  einheit: string;
  badge: string;
  status: MeilensteinStatus;
  aktuell: number;
};

type ApiData = {
  stopps_heute: number;
  km_heute: number;
  umsatz_heute: number;
  trinkgeld_heute: number;
  driver_id: string;
  generiert_am: string;
};

const MOCK: ApiData = {
  stopps_heute: 7,
  km_heute: 42,
  umsatz_heute: 185,
  trinkgeld_heute: 8.5,
  driver_id: 'mock',
  generiert_am: new Date().toISOString(),
};

const POLL_MS = 5 * 60_000;

function buildMeilensteine(data: ApiData): Meilenstein[] {
  const stopps = data.stopps_heute;
  const km = Math.round(data.km_heute);
  const umsatz = Math.round(data.umsatz_heute);

  const defs: Omit<Meilenstein, 'status' | 'aktuell'>[] = [
    { id: 's5', label: '5 Stopps', ziel: 5, einheit: 'Stopps', badge: '⭐' },
    { id: 's10', label: '10 Stopps', ziel: 10, einheit: 'Stopps', badge: '🏅' },
    { id: 's15', label: '15 Stopps', ziel: 15, einheit: 'Stopps', badge: '🏆' },
    { id: 's20', label: '20 Stopps', ziel: 20, einheit: 'Stopps', badge: '👑' },
    { id: 'k30', label: '30 km', ziel: 30, einheit: 'km', badge: '🚴' },
    { id: 'k60', label: '60 km', ziel: 60, einheit: 'km', badge: '🛵' },
    { id: 'u100', label: '100 € Umsatz', ziel: 100, einheit: '€', badge: '💰' },
    { id: 'u200', label: '200 € Umsatz', ziel: 200, einheit: '€', badge: '💎' },
  ];

  const getAktuell = (d: Omit<Meilenstein, 'status' | 'aktuell'>) => {
    if (d.einheit === 'km') return km;
    if (d.einheit === '€') return umsatz;
    return stopps;
  };

  let nextSet = false;
  return defs
    .sort((a, b) => a.ziel - b.ziel)
    .map(d => {
      const aktuell = getAktuell(d);
      const erreicht = aktuell >= d.ziel;
      let status: MeilensteinStatus;
      if (erreicht) {
        status = 'erreicht';
      } else if (!nextSet) {
        status = 'naechster';
        nextSet = true;
      } else {
        status = 'offen';
      }
      return { ...d, status, aktuell };
    });
}

export function FahrerPhase1116SchichtMeilensteinTracker({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${driverId}`);
      if (!r.ok) throw new Error('api');
      const json = await r.json();
      setData({
        stopps_heute: json.stopps ?? json.total_stopps ?? MOCK.stopps_heute,
        km_heute: json.total_km ?? json.km ?? MOCK.km_heute,
        umsatz_heute: json.umsatz ?? json.total_umsatz ?? MOCK.umsatz_heute,
        trinkgeld_heute: json.trinkgeld ?? json.total_trinkgeld ?? MOCK.trinkgeld_heute,
        driver_id: driverId,
        generiert_am: new Date().toISOString(),
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline && !data) return null;

  const meilensteine = data ? buildMeilensteine(data) : [];
  const erreicht = meilensteine.filter(m => m.status === 'erreicht');
  const naechster = meilensteine.find(m => m.status === 'naechster');

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0" />
          <span className="text-sm font-bold text-foreground">Schicht-Meilensteine</span>
          {erreicht.length > 0 && (
            <span className="rounded-full bg-matcha-500 text-white text-[9px] font-bold px-1.5 py-0.5">
              {erreicht.length} erreicht
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Next milestone progress */}
          {naechster && (
            <div className="rounded-lg bg-matcha-50 dark:bg-matcha-900/20 border border-matcha-200 dark:border-matcha-800 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-matcha-700 dark:text-matcha-300">
                  Nächstes Ziel: {naechster.badge} {naechster.label}
                </span>
                <span className="text-xs font-bold tabular-nums text-matcha-600 dark:text-matcha-400">
                  {naechster.aktuell}/{naechster.ziel} {naechster.einheit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-matcha-200 dark:bg-matcha-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, (naechster.aktuell / naechster.ziel) * 100)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-matcha-600 dark:text-matcha-400">
                Noch {naechster.ziel - naechster.aktuell} {naechster.einheit} bis zum Meilenstein
              </div>
            </div>
          )}

          {/* Achieved milestones */}
          {erreicht.length > 0 && (
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 tracking-wide">Heute erreicht</p>
              <div className="flex flex-wrap gap-2">
                {erreicht.map(m => (
                  <div
                    key={m.id}
                    className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2.5 py-1"
                  >
                    <span className="text-base leading-none">{m.badge}</span>
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming milestones (max 3) */}
          {meilensteine.filter(m => m.status === 'offen').length > 0 && (
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 tracking-wide">Kommende Ziele</p>
              <div className="flex flex-wrap gap-1.5">
                {meilensteine.filter(m => m.status === 'offen').slice(0, 3).map(m => (
                  <div
                    key={m.id}
                    className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5"
                  >
                    <span className="text-sm leading-none opacity-50">{m.badge}</span>
                    <span className="text-[10px] text-muted-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!data && !loading && (
            <p className="text-sm text-muted-foreground">Keine Daten verfügbar.</p>
          )}
        </div>
      )}
    </div>
  );
}
