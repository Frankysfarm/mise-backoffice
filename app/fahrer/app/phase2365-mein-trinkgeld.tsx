'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Banknote } from 'lucide-react';

interface FahrerTrinkgeld {
  id: string;
  name: string;
  trinkgeld_gesamt: number;
  trinkgeld_avg: number;
  trinkgeld_avg_vw: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerTrinkgeld[];
  team_avg: number;
}

function fmt(val: number) {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-red-50 border-red-200 text-red-700';
}

function coachingTipp(ampel: string, trend: string): string {
  if (ampel === 'rot') return 'Wenig Trinkgeld — freundlicher Gruß, zügige Übergabe und ein Lächeln machen den Unterschied.';
  if (ampel === 'gelb' && trend === 'down') return 'Quote fällt — auf pünktliche Lieferung und ordentliche Übergabe achten.';
  if (ampel === 'gruen' && trend === 'up') return 'Starke Entwicklung! Kunden schätzen deinen Service — weiter so!';
  if (ampel === 'gruen') return 'Gutes Trinkgeld! Zuverlässigkeit und Freundlichkeit zahlen sich aus.';
  return 'Solider Wert — kleine Extras bei der Übergabe können das Trinkgeld noch erhöhen.';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2365MeinTrinkgeld({ driverId, locationId, isOnline }: Props) {
  const [mein, setMein] = useState<FahrerTrinkgeld | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-trinkgeld?location_id=${locationId}`);
      if (!r.ok) return;
      const d: ApiData = await r.json();
      setTeamAvg(d.team_avg);
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

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          <Banknote size={14} className="inline mr-1 text-emerald-500" />
          Mein Trinkgeld
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className={`rounded-lg border px-3 py-3 ${ampelBg(mein.ampel)}`}>
            <p className="text-xs opacity-70 mb-1">Ø Trinkgeld/Tour (heute)</p>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{fmt(mein.trinkgeld_avg)}</span>
              <div className="text-right text-xs opacity-70">
                <p>{fmt(mein.trinkgeld_gesamt)} gesamt</p>
                <p>{mein.touren} Touren</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
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
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Vorwoche</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{fmt(mein.trinkgeld_avg_vw)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">
                {teamAvg !== null ? fmt(teamAvg) : '—'}
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
            💡 {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
