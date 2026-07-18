'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerBewertungInfo {
  fahrer_id: string;
  fahrer_name: string;
  avg_bewertung: number;
  bewertungen_anzahl: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerBewertungInfo[];
  team_avg: number;
}

function coachingTipp(ampel: string, trend: string): string {
  if (ampel === 'rot') return 'Bewertung unter 3.5 — lächeln, pünktlich sein und freundlich grüßen hilft!';
  if (ampel === 'gelb' && trend === 'fallend') return 'Trend fällt — auf freundliche Übergabe und Pünktlichkeit achten.';
  if (ampel === 'gruen' && trend === 'steigend') return 'Super Leistung — weiter so! Du bist auf dem Weg zur Top-Bewertung.';
  if (ampel === 'gruen') return 'Tolle Bewertung! Kunden schätzen deine Arbeit sehr.';
  return 'Solide Bewertung — kleine Verbesserungen beim Lächeln und Pünktlichkeit zahlen sich aus.';
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-red-50 border-red-200 text-red-700';
}

function StarRow({ avg }: { avg: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={18}
          className={i <= Math.round(avg) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
        />
      ))}
    </div>
  );
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2355MeineBewertungen({ driverId, locationId, isOnline }: Props) {
  const [mein, setMein] = useState<FahrerBewertungInfo | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-kundenzufriedenheit?location_id=${locationId}`);
      if (!r.ok) return;
      const d: ApiData = await r.json();
      setTeamAvg(d.team_avg);
      if (driverId) {
        const found = d.fahrer.find((f) => f.fahrer_id === driverId) ?? d.fahrer[0] ?? null;
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
          <Star size={14} className="inline mr-1 text-yellow-500" />
          Meine Bewertungen
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Score */}
          <div className={`rounded-lg border px-3 py-3 ${ampelBg(mein.ampel)}`}>
            <p className="text-xs opacity-70 mb-1">Mein Schnitt (letzte 7 Tage)</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{mein.avg_bewertung.toFixed(1)}</span>
              <div>
                <StarRow avg={mein.avg_bewertung} />
                <p className="text-xs opacity-70 mt-0.5">{mein.bewertungen_anzahl} Bewertungen</p>
              </div>
            </div>
          </div>

          {/* Trend + Team-Ø */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Trend</p>
              <div className="flex items-center gap-1 mt-0.5">
                {mein.trend === 'steigend' ? (
                  <TrendingUp size={16} className="text-green-600" />
                ) : mein.trend === 'fallend' ? (
                  <TrendingDown size={16} className="text-red-500" />
                ) : (
                  <Minus size={16} className="text-gray-400" />
                )}
                <span className="text-sm font-semibold text-gray-800">
                  {mein.trend === 'steigend' ? '+' : ''}{mein.trend_delta.toFixed(1)}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">
                {teamAvg !== null ? `${teamAvg.toFixed(1)}★` : '—'}
              </p>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
            💡 {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
