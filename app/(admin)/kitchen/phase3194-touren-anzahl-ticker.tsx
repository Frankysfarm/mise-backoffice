'use client';
import { useEffect, useState } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerTouren {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerTouren[];
  team_avg_touren: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const AMPEL_COLOR = { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' };

export function KitchenPhase3194TourenAnzahlTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () => {
      const url = locationId
        ? `/api/delivery/admin/fahrer-touren-anzahl-ranking?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-touren-anzahl-ranking';
      fetch(url).then(r => r.json()).then(setData).catch(() => {});
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const best     = data.fahrer[0];
  const hasAlert = data.fahrer.some(f => f.alert_bottom);

  return (
    <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Route size={16} color="#a855f7" />
        {best && (
          <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 13 }}>
            #1 {best.fahrer_name} — {best.touren} Touren
          </span>
        )}
        {hasAlert && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} color="#fca5a5" />
            <span style={{ color: '#fca5a5', fontSize: 11 }}>Wenige Touren!</span>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: AMPEL_COLOR[f.ampel], fontWeight: 700, fontSize: 12, width: 20, textAlign: 'right' }}>#{f.rang}</span>
            <span style={{ color: '#ddd', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fahrer_name}</span>
            <span style={{ color: '#a855f7', fontSize: 12, width: 40, textAlign: 'right' }}>{f.touren} T.</span>
            <span style={{ width: 16, textAlign: 'center' }}>
              {f.rank_delta === 0 ? <Minus size={10} color="#666" /> :
                f.rank_delta < 0 ? <TrendingUp size={10} color="#22c55e" /> :
                <TrendingDown size={10} color="#ef4444" />}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, color: '#888', fontSize: 11, textAlign: 'right' }}>Team-Ø: {data.team_avg_touren} Touren</div>
    </div>
  );
}
