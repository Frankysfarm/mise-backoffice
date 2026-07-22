'use client';
import { useEffect, useState } from 'react';
import { Route, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  gesamt: number;
}

const AMPEL_COLOR = { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' };
const COACHING = {
  gruen: 'Top Leistung! Du führst die Rangliste mit den meisten Touren an.',
  gelb: 'Gutes Tempo — jede zusätzliche Tour verbessert deinen Rang.',
  rot: 'Niedrige Touren-Anzahl — bleib aktiv und nehme mehr Touren an.',
};

export function FahrerPhase3192MeineTourenAnzahl({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    const load = () => {
      const url = locationId
        ? `/api/delivery/admin/fahrer-touren-anzahl-ranking?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-touren-anzahl-ranking';
      fetch(url).then(r => r.json()).then(setData).catch(() => {});
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const total  = data.gesamt ?? data.fahrer.length;
  const barPct = Math.max(5, ((total - me.rang + 1) / total) * 100);

  return (
    <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Route size={18} color="#a855f7" />
        <span style={{ color: '#fff', fontWeight: 700 }}>Meine Touren-Anzahl</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: AMPEL_COLOR[me.ampel], fontSize: 36, fontWeight: 900 }}>#{me.rang}</div>
          <div style={{ color: '#888', fontSize: 11 }}>Rang</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#a855f7', fontSize: 36, fontWeight: 900 }}>{me.touren}</div>
          <div style={{ color: '#888', fontSize: 11 }}>Touren heute</div>
        </div>
      </div>

      <div style={{ background: '#2d2d4e', borderRadius: 4, height: 10, marginBottom: 12 }}>
        <div style={{ width: `${barPct}%`, background: AMPEL_COLOR[me.ampel], height: 10, borderRadius: 4 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: '#0f0f23', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 11 }}>Rang-Δ</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {me.rank_delta === 0 ? <Minus size={14} color="#666" /> :
              me.rank_delta < 0 ? <TrendingUp size={14} color="#22c55e" /> :
              <TrendingDown size={14} color="#ef4444" />}
            <span style={{ color: me.rank_delta <= 0 ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: 16 }}>
              {me.rank_delta === 0 ? '—' : Math.abs(me.rank_delta)}
            </span>
          </div>
        </div>
        <div style={{ background: '#0f0f23', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 11 }}>Team-Ø</div>
          <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 16 }}>{data.team_avg_touren} T.</div>
        </div>
      </div>

      <div style={{ background: '#0f0f23', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ccc', lineHeight: 1.4 }}>
        {COACHING[me.ampel]}
      </div>
    </div>
  );
}
