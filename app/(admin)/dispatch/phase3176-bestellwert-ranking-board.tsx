'use client';
import { useEffect, useState } from 'react';
import { CircleDollarSign, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

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

export function DispatchPhase3176BestellwertRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [collapsed, setCollapsed] = useState(false);

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

  const best = data.fahrer[0] ?? null;
  const worst = data.fahrer[data.fahrer.length - 1] ?? null;
  const hasAlert = data.fahrer.some(f => f.alert);
  const maxVal = data.fahrer[0]?.avg_bestellwert ?? 1;

  return (
    <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CircleDollarSign size={20} color="#22c55e" />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Ø Bestellwert-Ranking</span>
        </div>
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {hasAlert && (
        <div style={{ background: '#7f1d1d', borderRadius: 8, padding: '6px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="#fca5a5" />
          <span style={{ color: '#fca5a5', fontSize: 12, fontWeight: 600 }}>Niedriger Ø-Bestellwert!</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Bester', value: best ? `€${best.avg_bestellwert.toFixed(2)}` : '—', name: best?.driver_name ?? '—', color: '#22c55e' },
          { label: 'Team-Ø', value: `€${data.team_avg.toFixed(2)}`, name: '', color: '#60a5fa' },
          { label: 'Niedrigster', value: worst ? `€${worst.avg_bestellwert.toFixed(2)}` : '—', name: worst?.driver_name ?? '—', color: '#ef4444' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: '#0f0f23', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>{kpi.label}</div>
            <div style={{ color: kpi.color, fontWeight: 700, fontSize: 16 }}>{kpi.value}</div>
            {kpi.name && <div style={{ color: '#aaa', fontSize: 10, marginTop: 1 }}>{kpi.name}</div>}
          </div>
        ))}
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.fahrer.map(f => (
            <div key={f.driver_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: AMPEL_COLOR[f.ampel], fontWeight: 700, width: 22, fontSize: 13, textAlign: 'right' }}>#{f.rang}</span>
              <span style={{ color: '#ddd', fontSize: 13, width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.driver_name}</span>
              <div style={{ flex: 1, background: '#2d2d4e', borderRadius: 4, height: 8 }}>
                <div style={{ width: `${(f.avg_bestellwert / maxVal) * 100}%`, background: AMPEL_COLOR[f.ampel], height: 8, borderRadius: 4 }} />
              </div>
              <span style={{ color: '#ddd', fontSize: 12, width: 56, textAlign: 'right' }}>€{f.avg_bestellwert.toFixed(2)}</span>
              <span style={{ width: 20, textAlign: 'center' }}>
                {f.rank_delta === null ? <Minus size={12} color="#666" /> :
                  f.rank_delta > 0 ? <TrendingUp size={12} color="#22c55e" /> :
                  f.rank_delta < 0 ? <TrendingDown size={12} color="#ef4444" /> :
                  <Minus size={12} color="#666" />}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
