'use client';
import { useEffect, useState } from 'react';
import { Clock, MapPin, Navigation, TrendingUp, Zap } from 'lucide-react';

interface NaciData {
  aktiver_stopp_name: string | null;
  aktiver_stopp_adresse: string | null;
  eta_naechster_min: number | null;
  eta_gesamt_min: number | null;
  stopps_offen: number;
  stopps_erledigt: number;
  stopps_gesamt: number;
  tour_score: number;
  durchschnitt_min_pro_stopp: number | null;
  prognose_fertig: string | null;
}

const MOCK: NaciData = {
  aktiver_stopp_name: 'Max M.',
  aktiver_stopp_adresse: 'Gartenweg 8, Berlin',
  eta_naechster_min: 6,
  eta_gesamt_min: 24,
  stopps_offen: 2,
  stopps_erledigt: 1,
  stopps_gesamt: 3,
  tour_score: 82,
  durchschnitt_min_pro_stopp: 8.5,
  prognose_fertig: '17:45',
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const r = 22, cx = 28, cy = 28, circ = 2 * Math.PI * r;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

export function FahrerPhase3087TourNaviCockpit({ isOnline, locationId }: { isOnline: boolean; locationId: string | null }) {
  const [data, setData] = useState<NaciData | null>(null);

  useEffect(() => {
    if (!isOnline) { setData(null); return; }
    const load = () =>
      fetch(`/api/delivery/fahrer/tour-navi?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: NaciData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [isOnline, locationId]);

  if (!isOnline || !data) return null;

  const progressPct = data.stopps_gesamt > 0
    ? Math.round((data.stopps_erledigt / data.stopps_gesamt) * 100)
    : 0;

  const openNav = (app: 'google' | 'waze') => {
    if (!data.aktiver_stopp_adresse) return;
    const addr = encodeURIComponent(data.aktiver_stopp_adresse);
    const url = app === 'waze'
      ? `https://waze.com/ul?q=${addr}&navigate=yes`
      : `https://maps.google.com/maps?daddr=${addr}`;
    window.open(url, '_blank');
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-800 dark:to-indigo-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation size={16} className="text-white" />
            <span className="font-bold text-sm text-white">Tour Navi-Cockpit</span>
          </div>
          <div className="text-xs text-blue-200">{data.stopps_erledigt}/{data.stopps_gesamt} Stopps</div>
        </div>
        <div className="mt-2 w-full bg-blue-800 dark:bg-blue-900 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-white transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Tour Score + Stats */}
        <div className="flex items-center gap-4">
          <ScoreRing score={data.tour_score} />
          <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
              <div className="text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-1"><Clock size={9} /> ETA nächster</div>
              <div className="font-bold text-sm text-blue-700 dark:text-blue-400">{data.eta_naechster_min ? `${data.eta_naechster_min} min` : '—'}</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 text-center">
              <div className="text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-1"><Clock size={9} /> ETA gesamt</div>
              <div className="font-bold text-sm text-indigo-700 dark:text-indigo-400">{data.eta_gesamt_min ? `${data.eta_gesamt_min} min` : '—'}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
              <div className="text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-1"><TrendingUp size={9} /> Ø/Stopp</div>
              <div className="font-bold text-sm text-green-700 dark:text-green-400">{data.durchschnitt_min_pro_stopp ? `${data.durchschnitt_min_pro_stopp} min` : '—'}</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 text-center">
              <div className="text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-1"><Zap size={9} /> Fertig ~</div>
              <div className="font-bold text-sm text-purple-700 dark:text-purple-400">{data.prognose_fertig ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* Nächster Stopp */}
        {data.aktiver_stopp_adresse && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <div className="font-semibold text-sm text-blue-800 dark:text-blue-300">{data.aktiver_stopp_name}</div>
                <div className="text-xs text-blue-600 dark:text-blue-400">{data.aktiver_stopp_adresse}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openNav('google')}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 transition-colors"
              >
                <Navigation size={12} /> Google Maps
              </button>
              <button
                onClick={() => openNav('waze')}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold py-2 transition-colors"
              >
                <Navigation size={12} /> Waze
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
