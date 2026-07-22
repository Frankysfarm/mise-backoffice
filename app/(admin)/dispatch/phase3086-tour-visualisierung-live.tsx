'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MapPin, Navigation } from 'lucide-react';

interface StoppInfo {
  nr: number;
  adresse: string;
  status: 'offen' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
}

interface TourEntry {
  fahrer_id: string;
  fahrer_name: string;
  tour_nr: number;
  stopps: StoppInfo[];
  geliefert: number;
  gesamt_stopps: number;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  eta_gesamt_min: number;
}

interface ApiData {
  touren: TourEntry[];
  aktive_count: number;
  alert_count: number;
}

const MOCK: ApiData = {
  touren: [
    {
      fahrer_id: 'f1', fahrer_name: 'Max M.', tour_nr: 1, score: 88, ampel: 'gruen',
      geliefert: 2, gesamt_stopps: 4, eta_gesamt_min: 18,
      stopps: [
        { nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null },
        { nr: 2, adresse: 'Bahnhofstr. 5', status: 'geliefert', eta_min: null },
        { nr: 3, adresse: 'Gartenweg 8', status: 'unterwegs', eta_min: 7 },
        { nr: 4, adresse: 'Lindenstr. 22', status: 'offen', eta_min: 18 },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Sara K.', tour_nr: 2, score: 55, ampel: 'rot',
      geliefert: 0, gesamt_stopps: 3, eta_gesamt_min: 35,
      stopps: [
        { nr: 1, adresse: 'Ringstr. 3', status: 'unterwegs', eta_min: 12 },
        { nr: 2, adresse: 'Kirchgasse 7', status: 'offen', eta_min: 22 },
        { nr: 3, adresse: 'Bergweg 15', status: 'offen', eta_min: 35 },
      ],
    },
  ],
  aktive_count: 2,
  alert_count: 1,
};

function stoppCls(status: string) {
  if (status === 'geliefert') return { dot: 'bg-green-500', ring: 'border-green-400',  text: 'text-green-600 dark:text-green-400',  line: 'bg-green-400'  };
  if (status === 'unterwegs') return { dot: 'bg-blue-500',  ring: 'border-blue-400',   text: 'text-blue-600 dark:text-blue-400',    line: 'bg-gray-200 dark:bg-gray-600'   };
  return                             { dot: 'bg-gray-300',  ring: 'border-gray-300',   text: 'text-gray-400 dark:text-gray-500',    line: 'bg-gray-200 dark:bg-gray-600'   };
}

function ScoreArc({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const r = 14, cx = 18, cy = 18, circ = 2 * Math.PI * r;
  return (
    <svg width={36} height={36} viewBox="0 0 36 36" className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={8} fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

export function DispatchPhase3086TourVisualisierungLive({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kapazitaet-live?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load();
    else setData(MOCK);
    const t = setInterval(load, 25_000);
    return () => clearInterval(t);
  }, [locationId]);

  const touren = data?.touren ?? [];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Tour-Visualisierung Live</span>
          <span className="text-xs text-gray-500">{data?.aktive_count ?? 0} aktive Touren</span>
          {(data?.alert_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 dark:bg-red-900/40 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {data?.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {touren.map(tour => {
            const isExp = expanded === tour.fahrer_id;
            const progressPct = tour.gesamt_stopps > 0 ? Math.round((tour.geliefert / tour.gesamt_stopps) * 100) : 0;
            const barColor = tour.ampel === 'rot' ? 'bg-red-500' : tour.ampel === 'gelb' ? 'bg-amber-400' : 'bg-green-500';
            return (
              <div key={tour.fahrer_id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setExpanded(isExp ? null : tour.fahrer_id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <ScoreArc score={tour.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{tour.fahrer_name}</span>
                      <span className="text-xs text-gray-500">ETA ~{tour.eta_gesamt_min} min</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      {tour.stopps.map(s => {
                        const c = stoppCls(s.status);
                        return (
                          <div key={s.nr} className="flex items-center gap-0.5">
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${c.ring} ${s.status === 'geliefert' ? 'bg-green-100' : s.status === 'unterwegs' ? 'bg-blue-100' : 'bg-gray-100'} dark:bg-transparent`}>
                              <span className="text-[7px] font-bold text-gray-600 dark:text-gray-300">{s.nr}</span>
                            </div>
                            {s.nr < tour.stopps.length && <div className={`w-3 h-0.5 ${c.line}`} />}
                          </div>
                        );
                      })}
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                      <div className={`h-1 rounded-full ${barColor}`} style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{tour.geliefert}/{tour.gesamt_stopps} geliefert</div>
                  </div>
                  {isExp ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                </button>

                {isExp && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-1.5 bg-gray-50 dark:bg-gray-800/50">
                    {tour.stopps.map(s => {
                      const c = stoppCls(s.status);
                      return (
                        <div key={s.nr} className="flex items-center gap-2 text-xs">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-white ${s.status === 'geliefert' ? 'bg-green-500' : s.status === 'unterwegs' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                            {s.nr}
                          </span>
                          <MapPin size={10} className={c.text} />
                          <span className={`flex-1 ${c.text}`}>{s.adresse}</span>
                          {s.eta_min && <span className="text-gray-400">~{s.eta_min} min</span>}
                          {s.status === 'geliefert' && <span className="text-green-600 dark:text-green-400 font-semibold">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
