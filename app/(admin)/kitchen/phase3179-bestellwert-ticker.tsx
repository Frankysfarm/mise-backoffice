'use client';
import { useEffect, useState } from 'react';
import { CircleDollarSign, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerBestellwert {
  driver_id: string;
  driver_name: string;
  avg_bestellwert: number;
  tour_count: number;
  rang: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number | null;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerBestellwert[];
  team_avg: number;
  location_id: string | null;
  date: string;
}

const AMPEL_COLOR = { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' };

export function KitchenPhase3179BestellwertTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () => {
      const url = locationId
        ? `/api/delivery/admin/fahrer-bestellwert-ranking?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-bestellwert-ranking';
      fetch(url).then(r => r.json()).then(setData).catch(() => {});
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const best = data.fahrer[0];
  const hasAlert = data.fahrer.some(f => f.alert);

  return (
    <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <CircleDollarSign size={16} color="#22c55e" />
        {best && (
          <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>
            #{1} {best.driver_name} — €{best.avg_bestellwert.toFixed(2)}
          </span>
        )}
        {hasAlert && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} color="#fca5a5" />
            <span style={{ color: '#fca5a5', fontSize: 11 }}>Niedriger Ø-Bestellwert!</span>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.fahrer.map(f => (
          <div key={f.driver_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: AMPEL_COLOR[f.ampel], fontWeight: 700, fontSize: 12, width: 20, textAlign: 'right' }}>#{f.rang}</span>
            <span style={{ color: '#ddd', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.driver_name}</span>
            <span style={{ color: '#ddd', fontSize: 12, width: 56, textAlign: 'right' }}>€{f.avg_bestellwert.toFixed(2)}</span>
            <span style={{ width: 16, textAlign: 'center' }}>
              {f.rank_delta === null ? <Minus size={10} color="#666" /> :
                f.rank_delta > 0 ? <TrendingUp size={10} color="#22c55e" /> :
                f.rank_delta < 0 ? <TrendingDown size={10} color="#ef4444" /> :
                <Minus size={10} color="#666" />}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, color: '#888', fontSize: 11, textAlign: 'right' }}>Team-Ø: €{data.team_avg.toFixed(2)}</div>
    </div>
  );
}
