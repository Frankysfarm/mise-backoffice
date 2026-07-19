'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_sterne: number;
  avg_sterne_vw: number | null;
  bewertungs_count: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_sterne: number;
}

function ampelStyle(sterne: number) {
  if (sterne < 3.5) return { text: 'text-red-600', bg: 'bg-red-50 border-red-200', bar: 'bg-red-500', label: 'Verbesserungsbedarf — Gespräch empfohlen' };
  if (sterne < 4.5) return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400', label: 'Guter Ansatz — weiter verbessern!' };
  return { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500', label: 'Ausgezeichnet — Kunden lieben dich!' };
}

function coachingTipp(sterne: number): string {
  if (sterne < 3.5) return 'Deine Bewertung liegt unter dem Ziel. Fokussiere auf freundlichen Kundenkontakt, pünktliche Lieferung und sorgfältige Übergabe.';
  if (sterne < 4.5) return 'Solide Leistung! Ein freundliches Lächeln und ein kurzes Lob an der Tür können deine Bewertung auf 4.5+ heben.';
  return 'Fantastisch! Deine Kunden sind begeistert. Du setzt den Standard für das Team!';
}

function StarDisplay({ sterne }: { sterne: number }) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={20}
          className={i <= Math.round(sterne) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
        />
      ))}
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me',
    fahrer_name: 'Ich',
    avg_sterne: 4.1,
    avg_sterne_vw: 4.2,
    bewertungs_count: 23,
    trend: 'fallend',
    trend_delta: -0.1,
    ampel: 'gelb',
  },
  team_avg_sterne: 4.0,
};

export function FahrerPhase2546MeineBewertung({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<SingleData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const params = new URLSearchParams({ location_id: locationId });
    if (driverId) params.set('driver_id', driverId);
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-bewertung-score?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_sterne: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_sterne: number };
            const me = driverId ? all.fahrer.find(f => f.fahrer_id === driverId) : null;
            setData({ fahrer_single: me ?? all.fahrer[0], team_avg_sterne: all.team_avg_sterne });
          } else {
            setData(MOCK);
          }
        })
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const e = data.fahrer_single;
  const st = ampelStyle(e.avg_sterne);
  const barW = Math.min(100, ((e.avg_sterne - 1) / 4) * 100);

  return (
    <div className={`rounded-xl border ${st.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Star size={16} className={e.ampel === 'gruen' ? 'text-amber-400 fill-amber-400' : 'text-gray-400'} />
          <span className="font-semibold text-sm text-gray-800">Meine Bewertung</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{e.avg_sterne.toFixed(2)}★</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{e.avg_sterne.toFixed(2)}</div>
            <StarDisplay sterne={e.avg_sterne} />
            <div className="text-xs text-gray-500 mt-1">{st.label}</div>
          </div>

          {/* Balken */}
          <div className="relative h-3 rounded-full bg-gray-200">
            <div className={`absolute left-0 top-0 h-full rounded-full ${st.bar}`} style={{ width: `${barW}%` }} />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-red-500" style={{ left: `${((3.5 - 1) / 4) * 100}%` }} title="Alert <3.5★" />
            <div className="absolute top-0 h-full border-l border-dashed border-amber-400" style={{ left: `${((4.5 - 1) / 4) * 100}%` }} title="Ziel ≥4.5★" />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>1★</span>
            <span className="text-red-500">3.5★</span>
            <span className="text-amber-500">4.5★</span>
            <span>5★</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">
                {e.avg_sterne_vw !== null ? `${e.avg_sterne_vw.toFixed(2)}★` : '—'}
              </div>
              <div className="text-xs text-gray-400">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={e.trend} />
                <span className="text-base font-bold text-gray-700">
                  {e.trend_delta > 0 ? '+' : ''}{e.trend_delta.toFixed(2)}★
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≥4.5★</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{data.team_avg_sterne.toFixed(2)}★</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
          </div>

          {/* Bewertungsanzahl */}
          <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-600 text-center">
            {e.bewertungs_count} Bewertung{e.bewertungs_count !== 1 ? 'en' : ''} heute
          </div>

          {/* Coaching */}
          <div className={`rounded-lg p-2.5 text-xs ${e.ampel === 'rot' ? 'bg-red-100 text-red-800' : e.ampel === 'gelb' ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
            {coachingTipp(e.avg_sterne)}
          </div>
        </div>
      )}
    </div>
  );
}
