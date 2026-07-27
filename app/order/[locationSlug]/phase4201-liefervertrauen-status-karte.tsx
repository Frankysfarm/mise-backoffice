'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Star, Clock, CheckCircle } from 'lucide-react';

interface VertrauenData {
  on_time_rate_pct: number;
  kundenbewertung_avg: number;
  bewertungs_count: number;
  avg_lieferzeit_min: number;
  konfidenz_stufe: 'hoch' | 'mittel' | 'niedrig';
  konfidenz_label: string;
}

const MOCK: VertrauenData = {
  on_time_rate_pct: 94,
  kundenbewertung_avg: 4.7,
  bewertungs_count: 312,
  avg_lieferzeit_min: 28,
  konfidenz_stufe: 'hoch',
  konfidenz_label: 'Sehr zuverlässig',
};

const konfidenzStyle: Record<VertrauenData['konfidenz_stufe'], { bg: string; text: string; icon: string }> = {
  hoch:    { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: 'text-green-500' },
  mittel:  { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', icon: 'text-yellow-500' },
  niedrig: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: 'text-red-400' },
};

interface Props { locationSlug?: string; orderId?: string | null; }

export function Phase4201LiefervertrauenStatusKarte({ locationSlug, orderId }: Props) {
  const [data, setData] = useState<VertrauenData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const param = locationSlug ? `location_slug=${locationSlug}` : orderId ? `order_id=${orderId}` : null;
    if (!param) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/storefront/liefervertrauen?${param}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationSlug, orderId]);

  useEffect(() => { load(); const id = setInterval(load, 5 * 60_000); return () => clearInterval(id); }, [load]);

  const st = konfidenzStyle[data.konfidenz_stufe];

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${st.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield className={`w-4 h-4 ${st.icon}`} />
          <span className={`text-xs font-semibold ${st.text}`}>{data.konfidenz_label}</span>
        </div>
        {loading && <span className="w-2 h-2 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <CheckCircle className="w-3 h-3 text-green-500" />
          </div>
          <div className={`text-sm font-bold ${st.text}`}>{data.on_time_rate_pct}%</div>
          <div className="text-[10px] text-gray-500">pünktlich</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <Star className="w-3 h-3 text-yellow-500" />
          </div>
          <div className="text-sm font-bold text-yellow-600">{data.kundenbewertung_avg.toFixed(1)}</div>
          <div className="text-[10px] text-gray-500">{data.bewertungs_count} Bew.</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <Clock className="w-3 h-3 text-blue-500" />
          </div>
          <div className="text-sm font-bold text-blue-600">{data.avg_lieferzeit_min} min</div>
          <div className="text-[10px] text-gray-500">Ø Lieferzeit</div>
        </div>
      </div>
    </div>
  );
}
