'use client';

import { useEffect, useState } from 'react';
import { Navigation, CheckCircle2, MapPin, Clock, ChevronRight, Zap } from 'lucide-react';

interface Props {
  locationId?: string | null;
  driverId?: string | null;
}

type StoppZustand = 'aktiv' | 'naechste' | 'ausstehend' | 'erledigt';

interface NavigationsStop {
  id: string;
  nr: number;
  name: string;
  adresse: string;
  zustand: StoppZustand;
  eta_min: number | null;
  entfernung_m: number | null;
  notiz?: string;
}

const MOCK_STOPPS: NavigationsStop[] = [
  { id: 's1', nr: 1, name: 'Familie Müller', adresse: 'Hauptstraße 12', zustand: 'erledigt', eta_min: null, entfernung_m: null },
  { id: 's2', nr: 2, name: 'Frau Schmidt', adresse: 'Gartenweg 5', zustand: 'aktiv', eta_min: 4, entfernung_m: 820 },
  { id: 's3', nr: 3, name: 'Herr Wagner', adresse: 'Lindenallee 8', zustand: 'naechste', eta_min: 14, entfernung_m: 2100 },
  { id: 's4', nr: 4, name: 'Restaurant Bella', adresse: 'Parkstraße 22', zustand: 'ausstehend', eta_min: 25, entfernung_m: 3400, notiz: 'Bitte klingeln' },
];

const ZUSTAND_FARBE: Record<StoppZustand, string> = {
  aktiv: 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30',
  naechste: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20',
  ausstehend: 'border-transparent bg-muted/30',
  erledigt: 'border-transparent bg-muted/10 opacity-60',
};

const ZUSTAND_BADGE: Record<StoppZustand, { label: string; klasse: string }> = {
  aktiv: { label: '▶ Jetzt', klasse: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  naechste: { label: 'Nächster', klasse: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  ausstehend: { label: '', klasse: '' },
  erledigt: { label: '✓', klasse: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
};

function fmtEntfernung(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

export function FahrerPhase808TourStoppNavigatorUltimate({ locationId: _locationId, driverId: _driverId }: Props) {
  const [stopps, setStopps] = useState<NavigationsStop[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setStopps(MOCK_STOPPS);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 25_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-4 shadow-sm">
        <div className="h-48 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  const aktiv = stopps.find((s) => s.zustand === 'aktiv');
  const erledigt = stopps.filter((s) => s.zustand === 'erledigt').length;
  const gesamt = stopps.length;

  const handleNavi = (s: NavigationsStop) => {
    const query = encodeURIComponent(s.adresse);
    window.open(`https://maps.google.com/?q=${query}`, '_blank');
  };

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-xs font-semibold">Tour-Navigator</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {erledigt}/{gesamt} erledigt
          </span>
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${gesamt > 0 ? (erledigt / gesamt) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Aktiver Stopp Hero */}
      {aktiv && (
        <div className="mb-3 rounded-xl border-2 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[9px] font-bold text-white">
                  Jetzt liefern
                </span>
                <span className="text-[10px] text-muted-foreground">Stopp {aktiv.nr}</span>
              </div>
              <p className="text-sm font-bold truncate">{aktiv.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{aktiv.adresse}</p>
              <div className="flex items-center gap-3 mt-1.5">
                {aktiv.eta_min !== null && (
                  <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                    <Clock className="h-3 w-3" />
                    <span className="font-semibold">{aktiv.eta_min} Min</span>
                  </div>
                )}
                {aktiv.entfernung_m !== null && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{fmtEntfernung(aktiv.entfernung_m)}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => handleNavi(aktiv)}
              className="shrink-0 flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white active:opacity-80 transition-opacity"
            >
              <Zap className="h-3.5 w-3.5" />
              Navi
            </button>
          </div>
        </div>
      )}

      {/* Alle Stopps */}
      <div className="space-y-1.5">
        {stopps.filter((s) => s.zustand !== 'aktiv').map((s) => {
          const badge = ZUSTAND_BADGE[s.zustand];
          return (
            <div
              key={s.id}
              className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${ZUSTAND_FARBE[s.zustand]}`}
            >
              {s.zustand === 'erledigt' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-muted-foreground">{s.nr}</span>
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[11px] font-medium truncate ${s.zustand === 'erledigt' ? 'line-through text-muted-foreground' : ''}`}>
                    {s.name}
                  </span>
                  {badge.label && (
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${badge.klasse}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground truncate">{s.adresse}</span>
                  {s.eta_min !== null && (
                    <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">~{s.eta_min} Min</span>
                  )}
                </div>
                {s.notiz && (
                  <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">{s.notiz}</p>
                )}
              </div>
              {s.zustand === 'naechste' && (
                <button
                  onClick={() => handleNavi(s)}
                  className="shrink-0 rounded-lg p-1.5 bg-amber-100 dark:bg-amber-900/40 active:opacity-70"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[9px] text-muted-foreground">Tour-Stops live · 25s-Update</p>
    </div>
  );
}
