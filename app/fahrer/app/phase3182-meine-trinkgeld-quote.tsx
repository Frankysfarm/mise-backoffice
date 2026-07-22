'use client';
import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ApiData {
  fahrer: {
    driver_id: string;
    driver_name: string;
    trinkgeld_quote: number;
    trinkgeld_total: number;
    tour_count: number;
    rang: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    rank_delta: number | null;
    alert: boolean;
  }[];
  team_avg: number;
  location_id: string | null;
  date: string;
}

const AMPEL_COLOR = { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' };
const COACHING = {
  gruen: 'Top Trinkgeld-Quote! Dein Service begeistert die Kunden.',
  gelb: 'Gute Quote — ein freundliches Lächeln und schnelle Lieferung helfen!',
  rot: 'Trinkgeld-Quote niedrig — sei extra freundlich und pünktlich.',
};

export function FahrerPhase3182MeineTrinkgeldQuote({
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
        ? `/api/delivery/admin/fahrer-trinkgeld-quote-ranking?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-trinkgeld-quote-ranking';
      fetch(url).then(r => r.json()).then(setData).catch(() => {});
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !data) return null;

  const me = data.fahrer.find(f => f.driver_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const barPct = Math.max(5, ((data.fahrer.length - me.rang + 1) / data.fahrer.length) * 100);

  return (
    <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Star size={18} color="#eab308" />
        <span style={{ color: '#fff', fontWeight: 700 }}>Meine Trinkgeld-Quote</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: AMPEL_COLOR[me.ampel], fontSize: 36, fontWeight: 900 }}>#{me.rang}</div>
          <div style={{ color: '#888', fontSize: 11 }}>Rang</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#eab308', fontSize: 36, fontWeight: 900 }}>{me.trinkgeld_quote.toFixed(1)}%</div>
          <div style={{ color: '#888', fontSize: 11 }}>Trinkgeld-Quote</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#22c55e', fontSize: 28, fontWeight: 700 }}>€{me.trinkgeld_total.toFixed(2)}</div>
          <div style={{ color: '#888', fontSize: 11 }}>Gesamt</div>
        </div>
      </div>

      <div style={{ background: '#2d2d4e', borderRadius: 4, height: 10, marginBottom: 12 }}>
        <div style={{ width: `${barPct}%`, background: AMPEL_COLOR[me.ampel], height: 10, borderRadius: 4 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ background: '#0f0f23', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 10 }}>Team-Ø</div>
          <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 16 }}>{data.team_avg.toFixed(1)}%</div>
        </div>
        <div style={{ background: '#0f0f23', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 10 }}>Δ Vortag</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {me.rank_delta === null ? <Minus size={14} color="#666" /> :
              me.rank_delta > 0 ? <><TrendingUp size={14} color="#22c55e" /><span style={{ color: '#22c55e', fontSize: 13 }}>+{me.rank_delta}</span></> :
              me.rank_delta < 0 ? <><TrendingDown size={14} color="#ef4444" /><span style={{ color: '#ef4444', fontSize: 13 }}>{me.rank_delta}</span></> :
              <Minus size={14} color="#666" />}
          </div>
        </div>
      </div>

      <div style={{ background: '#0f0f23', borderRadius: 8, padding: '8px 10px', color: '#ccc', fontSize: 12 }}>
        💬 {COACHING[me.ampel]}
      </div>
    </div>
  );
}
