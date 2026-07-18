'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerLieferzeit {
  id: string;
  name: string;
  avg_min: number;
  avg_min_vw: number;
  min_min: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerLieferzeit[];
  team_avg_min: number;
  benchmark_min: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-red-50 border-red-200 text-red-700';
}

function coachingTipp(ampel: string, trend: string): string {
  if (ampel === 'rot') return 'Zu lang unterwegs — Route prüfen, Staus vermeiden, Priorisierung beim Dispatch ansprechen.';
  if (ampel === 'gelb' && trend === 'down') return 'Lieferzeit steigt — frühzeitig losfahren und optimale Route nehmen.';
  if (ampel === 'gruen' && trend === 'up') return 'Starke Verbesserung! Schnelle Lieferzeiten machen Kunden glücklich — weiter so!';
  if (ampel === 'gruen') return 'Im Zielbereich! Zügige, direkte Routen halten die Zeit niedrig.';
  return 'Solider Wert — auf Effizienz bei der Routenwahl achten.';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2370MeineLieferzeit({ driverId, locationId, isOnline }: Props) {
  const [mein, setMein] = useState<FahrerLieferzeit | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [benchmark, setBenchmark] = useState<number>(30);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-lieferzeit-benchmark?location_id=${locationId}`);
      if (!r.ok) return;
      const d: ApiData = await r.json();
      setTeamAvg(d.team_avg_min);
      setBenchmark(d.benchmark_min ?? 30);
      if (driverId) {
        const found = d.fahrer.find((f) => f.id === driverId) ?? d.fahrer[0] ?? null;
        setMein(found);
      } else if (d.fahrer.length > 0) {
        setMein(d.fahrer[0]);
      }
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId]);

  if (!isOnline || !mein) return null;

  const tipp = coachingTipp(mein.ampel, mein.trend);
  const maxBar = 60;
  const barPct = Math.min((mein.avg_min / maxBar) * 100, 100);
  const zielPct = (benchmark / maxBar) * 100;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          <Clock size={14} className="inline mr-1 text-blue-500" />
          Meine Lieferzeit
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className={`rounded-lg border px-3 py-3 ${ampelBg(mein.ampel)}`}>
            <p className="text-xs opacity-70 mb-1">Ø Lieferzeit heute</p>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{mein.avg_min.toFixed(1)} Min</span>
              <div className="text-right text-xs opacity-70">
                <p>Ziel: {benchmark} Min</p>
                <p>{mein.touren} Touren</p>
              </div>
            </div>
          </div>

          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${mein.ampel === 'gruen' ? 'bg-green-500' : mein.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${barPct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-500 opacity-80"
              style={{ left: `${zielPct}%` }}
              title={`Ziel: ${benchmark} Min`}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 Min</span>
            <span className="text-blue-500">Ziel {benchmark} Min</span>
            <span>{maxBar} Min</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-lg px-2 py-2">
              <p className="text-xs text-gray-500">Touren</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{mein.touren}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-2 py-2">
              <p className="text-xs text-gray-500">Kürzeste</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{mein.min_min > 0 ? `${mein.min_min.toFixed(0)} Min` : '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-2 py-2">
              <p className="text-xs text-gray-500">Trend</p>
              <div className="flex items-center gap-1 mt-0.5">
                {mein.trend === 'up' ? (
                  <TrendingUp size={16} className="text-green-600" />
                ) : mein.trend === 'down' ? (
                  <TrendingDown size={16} className="text-red-500" />
                ) : (
                  <Minus size={16} className="text-gray-400" />
                )}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-2 py-2">
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">
                {teamAvg !== null ? `${teamAvg.toFixed(1)} Min` : '—'}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
            💡 {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
