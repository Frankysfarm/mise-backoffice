'use client';
import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  gesamt: number;
}

const AMPEL_COLOR = { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' };
const COACHING = {
  gruen: 'Exzellente Bewertungen! Kunden lieben deinen Service.',
  gelb: 'Gute Bewertung — ein Lächeln und Pünktlichkeit helfen weiter.',
  rot: 'Bewertung niedrig — achte auf freundlichen Kontakt und schnelle Lieferung.',
};

export function FahrerPhase3182MeinBewertungsScore({
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
        ? `/api/delivery/admin/fahrer-bewertungs-ranking?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-bewertungs-ranking';
      fetch(url).then(r => r.json()).then(setData).catch(() => {});
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const total = data.gesamt ?? data.fahrer.length;
  const barPct = Math.max(5, ((total - me.rang + 1) / total) * 100);

  return (
    <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Star size={18} color="#eab308" />
        <span style={{ color: '#fff', fontWeight: 700 }}>Mein Bewertungs-Score</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: AMPEL_COLOR[me.ampel], fontSize: 36, fontWeight: 900 }}>#{me.rang}</div>
          <div style={{ color: '#888', fontSize: 11 }}>Rang</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#eab308', fontSize: 36, fontWeight: 900 }}>★{me.score.toFixed(1)}</div>
          <div style={{ color: '#888', fontSize: 11 }}>Ø Score</div>
        </div>
      </div>

      <div style={{ background: '#2d2d4e', borderRadius: 4, height: 10, marginBottom: 12 }}>
        <div style={{ width: `${barPct}%`, background: AMPEL_COLOR[me.ampel], height: 10, borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: 10, marginBottom: 12 }}>
        <span>#{total}</span>
        <span>#1</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ background: '#0f0f23', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 10 }}>Team-Ø</div>
          <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 16 }}>★{data.team_avg_score.toFixed(1)}</div>
        </div>
        <div style={{ background: '#0f0f23', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 10 }}>Δ Vortag</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {me.rank_delta === 0 ? <Minus size={14} color="#666" /> :
              me.rank_delta < 0 ? <><TrendingUp size={14} color="#22c55e" /><span style={{ color: '#22c55e', fontSize: 13 }}>{me.rank_delta}</span></> :
              <><TrendingDown size={14} color="#ef4444" /><span style={{ color: '#ef4444', fontSize: 13 }}>+{me.rank_delta}</span></>}
          </div>
        </div>
      </div>

      <div style={{ background: '#0f0f23', borderRadius: 8, padding: '8px 10px', color: '#ccc', fontSize: 12 }}>
        💬 {COACHING[me.ampel]}
      </div>
    </div>
  );
}
