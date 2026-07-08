'use client';

import { useEffect, useState } from 'react';
import { Map, CheckCircle, Circle, Truck, Clock } from 'lucide-react';

interface Props {
  locationId: string | null;
}

type StoppStatus = 'erledigt' | 'aktiv' | 'ausstehend';

interface TourStopp {
  id: string;
  nr: number;
  adresse: string;
  status: StoppStatus;
  eta_min: number | null;
}

interface TourFortschritt {
  tour_id: string;
  fahrer: string;
  stopps: TourStopp[];
  erledigt: number;
  gesamt: number;
  score: number;
}

function buildMock(): TourFortschritt[] {
  return [
    {
      tour_id: 'T-001',
      fahrer: 'Max M.',
      erledigt: 2,
      gesamt: 4,
      score: 87,
      stopps: [
        { id: 's1', nr: 1, adresse: 'Hauptstr. 12', status: 'erledigt', eta_min: null },
        { id: 's2', nr: 2, adresse: 'Gartenweg 5', status: 'erledigt', eta_min: null },
        { id: 's3', nr: 3, adresse: 'Lindenallee 8', status: 'aktiv', eta_min: 7 },
        { id: 's4', nr: 4, adresse: 'Parkstr. 22', status: 'ausstehend', eta_min: 18 },
      ],
    },
    {
      tour_id: 'T-002',
      fahrer: 'Anna K.',
      erledigt: 1,
      gesamt: 3,
      score: 92,
      stopps: [
        { id: 's5', nr: 1, adresse: 'Bahnhofstr. 3', status: 'erledigt', eta_min: null },
        { id: 's6', nr: 2, adresse: 'Marktplatz 1', status: 'aktiv', eta_min: 5 },
        { id: 's7', nr: 3, adresse: 'Schloßgasse 9', status: 'ausstehend', eta_min: 15 },
      ],
    },
  ];
}

const STATUS_ICON: Record<StoppStatus, typeof Circle> = {
  erledigt: CheckCircle,
  aktiv: Truck,
  ausstehend: Circle,
};

const STATUS_COLOR: Record<StoppStatus, string> = {
  erledigt: 'text-emerald-500 dark:text-emerald-400',
  aktiv: 'text-blue-500 dark:text-blue-400',
  ausstehend: 'text-muted-foreground',
};

export function DispatchPhase807TourLiveFortschritt({ locationId: _locationId }: Props) {
  const [touren, setTouren] = useState<TourFortschritt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const fetchData = async () => {
    setTouren(buildMock());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (touren.length > 0 && !selected) setSelected(touren[0].tour_id);
  }, [touren, selected]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-40 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  const aktiveTour = touren.find((t) => t.tour_id === selected) ?? touren[0];

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Tour-Fortschritt Live</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{touren.length} aktive Touren</span>
      </div>

      {/* Tour-Tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {touren.map((t) => (
          <button
            key={t.tour_id}
            onClick={() => setSelected(t.tour_id)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-medium border transition-colors ${
              selected === t.tour_id
                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : 'bg-muted/40 border-transparent text-muted-foreground hover:border-border'
            }`}
          >
            {t.fahrer} · {t.erledigt}/{t.gesamt}
          </button>
        ))}
      </div>

      {aktiveTour && (
        <>
          {/* Score + Fortschrittsbalken */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">
                  {aktiveTour.erledigt} von {aktiveTour.gesamt} Stopps
                </span>
                <span className={`text-[10px] font-bold ${aktiveTour.score >= 85 ? 'text-emerald-600 dark:text-emerald-400' : aktiveTour.score >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                  Score {aktiveTour.score}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${aktiveTour.gesamt > 0 ? (aktiveTour.erledigt / aktiveTour.gesamt) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stopp-Liste */}
          <div className="space-y-1.5">
            {aktiveTour.stopps.map((s) => {
              const Icon = STATUS_ICON[s.status];
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                    s.status === 'aktiv'
                      ? 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800'
                      : s.status === 'erledigt'
                      ? 'bg-muted/30'
                      : 'bg-muted/20'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${STATUS_COLOR[s.status]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[11px] font-medium truncate ${
                          s.status === 'erledigt' ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {s.nr}. {s.adresse}
                      </span>
                      {s.eta_min !== null && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {s.eta_min} Min
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-2 text-[9px] text-muted-foreground">Tour-Visualisierung · 30s-Update</p>
    </div>
  );
}
