'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Star } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    avg_rating: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert_niedrig: boolean;
  }>;
  team_avg_rating: number;
  gesamt: number;
}

function coachingTipp(rating: number): { text: string; color: string } {
  if (rating >= 4.5) return {
    text: 'Ausgezeichnete Bewertung! Kunden schätzen deinen Service besonders — Spitzenleistung im Team.',
    color: 'text-amber-300',
  };
  if (rating >= 4.0) return {
    text: 'Gute Bewertung! Pünktlichkeit und freundliche Übergabe steigern dein Rating weiter.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Potenzial vorhanden: Lächeln bei der Übergabe und schnelle Lieferzeiten verbessern deine Kundenbewertung.',
    color: 'text-gray-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-amber-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-gray-400';
}

export function FahrerPhase4991MeineBewertung({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-bewertungs-ranking?${params}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/40 px-4 py-3 flex items-center gap-2 mb-3">
        <WifiOff className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-500">Meine Bewertung — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.avg_rating);
  const ref  = 5;
  const ichPct = Math.min(100, Math.round((mein.avg_rating / ref) * 100));
  const avgPct = Math.min(100, Math.round((data.team_avg_rating / ref) * 100));

  return (
    <div className="rounded-2xl border border-amber-700 bg-amber-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-amber-700/40 flex items-center gap-2 bg-amber-900/20">
        <Star className="w-4 h-4 text-amber-300" />
        <span className="text-sm font-semibold text-amber-200">Meine Kundenbewertung (letzte 30 Tage)</span>
      </div>

      {/* Main Stats */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.avg_rating} ★
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Ø Kundenbewertung</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-amber-300' : 'text-gray-300'}`}>
            #{mein.rang}
          </div>
          <div className="text-xs text-gray-500">von {data.gesamt}</div>
        </div>
      </div>

      {/* Mini Bar: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${ichPct}%` }} />
          </div>
          <span className="text-[10px] text-amber-300 w-16 text-right">{mein.avg_rating} ★</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-16 text-right">{data.team_avg_rating} ★</span>
        </div>
      </div>

      {/* Coaching Tipp */}
      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
