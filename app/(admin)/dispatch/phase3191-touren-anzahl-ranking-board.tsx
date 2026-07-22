'use client';
import { useEffect, useState } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

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
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const AMPEL_COLOR = { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' };

export function DispatchPhase3191TourenAnzahlRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [collapsed, setCollapsed] = useState(false);

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

  const best  = data.fahrer[0] ?? null;
  const worst = data.fahrer[data.fahrer.length - 1] ?? null;
  const hasAlert = data.fahrer.some(f => f.alert_bottom);
  const maxVal = data.fahrer[0]?.touren ?? 1;

  return (
    <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Route size={20} color="#a855f7" />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Touren-Anzahl-Ranking</span>
        </div>
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {hasAlert && (
        <div style={{ background: '#7f1d1d', borderRadius: 8, padding: '6px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="#fca5a5" />
          <span style={{ color: '#fca5a5', fontSize: 12, fontWeight: 600 }}>Wenige Touren abgeschlossen!</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Bester', value: best ? `${best.touren} T.` : '—', name: best?.fahrer_name ?? '—', color: '#22c55e' },
          { label: 'Team-Ø', value: `${data.team_avg_touren} T.`, name: '', color: '#60a5fa' },
          { label: 'Letzter', value: worst ? `${worst.touren} T.` : '—', name: worst?.fahrer_name ?? '—', color: '#ef4444' },
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
            <div key={f.fahrer_id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ color: AMPEL_COLOR[f.ampel], fontWeight: 700, fontSize: 13, width: 24, textAlign: 'right' }}>#{f.rang}</span>
                <span style={{ color: '#ddd', fontSize: 13, flex: 1 }}>{f.fahrer_name}</span>
                <span style={{ color: '#a855f7', fontSize: 13, fontWeight: 600, width: 44, textAlign: 'right' }}>{f.touren} T.</span>
                <span style={{ width: 18, textAlign: 'center' }}>
                  {f.rank_delta === 0 ? <Minus size={11} color="#666" /> :
                    f.rank_delta < 0 ? <TrendingUp size={11} color="#22c55e" /> :
                    <TrendingDown size={11} color="#ef4444" />}
                </span>
              </div>
              <div style={{ background: '#2d2d4e', borderRadius: 3, height: 5, marginLeft: 30 }}>
                <div style={{ width: `${Math.max(4, (f.touren / maxVal) * 100)}%`, background: AMPEL_COLOR[f.ampel], height: 5, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, color: '#888', fontSize: 11, textAlign: 'right' }}>
        {data.gesamt} Fahrer · Team-Ø {data.team_avg_touren} Touren
      </div>
    </div>
  );
}
