'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_stopps: number;
  puenktlich: number;
  zu_spaet: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerPuenktlichkeit[];
  team_durchschnitt: number;
}

function coachingTipp(ampel: string, trend: string): string {
  if (ampel === 'rot') return 'Pünktlichkeit unter 65% — Route früher starten und Wartezeiten an der Tür verkürzen.';
  if (ampel === 'gelb' && trend === 'fallend') return 'Quote fällt — auf zügige Abholzeiten und direkte Routen achten.';
  if (ampel === 'gruen' && trend === 'steigend') return 'Tolle Entwicklung! Pünktlichkeit steigt — weiter so!';
  if (ampel === 'gruen') return 'Sehr pünktlich! Kunden und Küche schätzen deine Zuverlässigkeit.';
  return 'Solide Quote — kleine Verbesserungen bei der Abfahrtszeit zahlen sich aus.';
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-red-50 border-red-200 text-red-700';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2360MeinePuenktlichkeit({ driverId, locationId, isOnline }: Props) {
  const [mein, setMein] = useState<FahrerPuenktlichkeit | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`);
      if (!r.ok) return;
      const d: ApiData = await r.json();
      setTeamAvg(d.team_durchschnitt);
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
          <Clock size={14} className="inline mr-1 text-blue-500" />
          Meine Pünktlichkeit
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className={`rounded-lg border px-3 py-3 ${ampelBg(mein.ampel)}`}>
            <p className="text-xs opacity-70 mb-1">Meine Quote (letzte 7 Tage)</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{mein.quote_pct.toFixed(1)}%</span>
              <div className="text-xs opacity-70">
                <p>{mein.puenktlich} von {mein.gesamt_stopps} Stopps pünktlich</p>
                {mein.zu_spaet > 0 && <p>{mein.zu_spaet} zu spät</p>}
              </div>
            </div>
          </div>

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
                  {mein.trend === 'steigend' ? '+' : ''}{mein.trend_delta}%
                </span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">
                {teamAvg !== null ? `${teamAvg.toFixed(1)}%` : '—'}
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
