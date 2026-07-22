'use client';
import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface FahrerBewertung {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  score: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerBewertung[];
  team_avg_score: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const AMPEL_COLOR = { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' };

export function DispatchPhase3181BewertungsRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const load = () => {
      const url = locationId
        ? `/api/delivery/admin/fahrer-bewertungs-ranking?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-bewertungs-ranking';
      fetch(url).then(r => r.json()).then(setData).catch(() => {});
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const best = data.fahrer[0] ?? null;
  const worst = data.fahrer[data.fahrer.length - 1] ?? null;
  const hasAlert = data.fahrer.some(f => f.alert_bottom);
  const maxVal = data.fahrer[0]?.score ?? 5;

  return (
    <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={20} color="#eab308" />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Ø Bewertungs-Score-Ranking</span>
        </div>
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {hasAlert && (
        <div style={{ background: '#7f1d1d', borderRadius: 8, padding: '6px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="#fca5a5" />
          <span style={{ color: '#fca5a5', fontSize: 12, fontWeight: 600 }}>Niedriger Bewertungs-Score!</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Bester', value: best ? `★${best.score.toFixed(1)}` : '—', name: best?.fahrer_name ?? '—', color: '#22c55e' },
          { label: 'Team-Ø', value: `★${data.team_avg_score.toFixed(1)}`, name: '', color: '#60a5fa' },
          { label: 'Niedrigster', value: worst ? `★${worst.score.toFixed(1)}` : '—', name: worst?.fahrer_name ?? '—', color: '#ef4444' },
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
            <div key={f.fahrer_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: AMPEL_COLOR[f.ampel], fontWeight: 700, width: 22, fontSize: 13, textAlign: 'right' }}>#{f.rang}</span>
              <span style={{ color: '#ddd', fontSize: 13, width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fahrer_name}</span>
              <div style={{ flex: 1, background: '#2d2d4e', borderRadius: 4, height: 8 }}>
                <div style={{ width: `${(f.score / maxVal) * 100}%`, background: AMPEL_COLOR[f.ampel], height: 8, borderRadius: 4 }} />
              </div>
              <span style={{ color: '#eab308', fontSize: 12, width: 40, textAlign: 'right' }}>★{f.score.toFixed(1)}</span>
              <span style={{ width: 20, textAlign: 'center' }}>
                {f.rank_delta === 0 ? <Minus size={12} color="#666" /> :
                  f.rank_delta < 0 ? <TrendingUp size={12} color="#22c55e" /> :
                  <TrendingDown size={12} color="#ef4444" />}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
