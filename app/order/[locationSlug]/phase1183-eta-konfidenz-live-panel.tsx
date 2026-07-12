'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1178 — ETA-Konfidenz-Live-Panel (Storefront)
// Echtzeit-Anzeige der ETA-Zuverlässigkeit: Pct-Ring + Konfidenz-Level + Erklärung

interface Props {
  orderId: string;
  locationId: string;
}

interface KonfidenzData {
  etaMinutes: number;
  etaEarliest: number;
  etaLatest: number;
  konfidenzPct: number; // 0-100
  level: 'sehr_hoch' | 'hoch' | 'mittel' | 'niedrig';
  reason: string;
}

const LEVEL_CFG: Record<KonfidenzData['level'], { label: string; color: string; ringColor: string }> = {
  sehr_hoch: { label: 'Sehr zuverlässig', color: 'text-matcha-700', ringColor: '#4ade80' },
  hoch:      { label: 'Zuverlässig',      color: 'text-blue-700',   ringColor: '#60a5fa' },
  mittel:    { label: 'Moderate Konfidenz', color: 'text-amber-600', ringColor: '#fbbf24' },
  niedrig:   { label: 'Unsicher',          color: 'text-red-600',   ringColor: '#f87171' },
};

const MOCK: KonfidenzData = {
  etaMinutes: 22,
  etaEarliest: 18,
  etaLatest: 28,
  konfidenzPct: 82,
  level: 'hoch',
  reason: 'Fahrer auf bekannter Route, normales Verkehrsaufkommen',
};

function mapToLevel(pct: number): KonfidenzData['level'] {
  if (pct >= 85) return 'sehr_hoch';
  if (pct >= 65) return 'hoch';
  if (pct >= 40) return 'mittel';
  return 'niedrig';
}

const R = 38;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function Phase1183EtaKonfidenzLivePanel({ orderId, locationId }: Props) {
  const [data, setData] = useState<KonfidenzData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/eta/${orderId}`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (cancelled) return;
        const konfidenz = d.confidence_pct ?? d.konfidenzPct ?? MOCK.konfidenzPct;
        const level = mapToLevel(konfidenz);
        setData({
          etaMinutes: d.eta_minutes ?? d.etaMinutes ?? MOCK.etaMinutes,
          etaEarliest: d.eta_earliest ?? MOCK.etaEarliest,
          etaLatest: d.eta_latest ?? MOCK.etaLatest,
          konfidenzPct: konfidenz,
          level,
          reason: d.reason ?? MOCK.reason,
        });
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [orderId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-stone-300" />
        <span className="text-sm text-stone-400">ETA wird berechnet …</span>
      </div>
    );
  }

  if (!data) return null;

  const cfg = LEVEL_CFG[data.level];
  const dashOffset = CIRCUMFERENCE * (1 - data.konfidenzPct / 100);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-4">
        {/* SVG-Konfidenz-Ring */}
        <div className="shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={R} fill="none" stroke="#f5f5f4" strokeWidth="8" />
            <circle
              cx="48" cy="48" r={R}
              fill="none"
              stroke={cfg.ringColor}
              strokeWidth="8"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
            <text x="48" y="44" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1c1917">
              {data.konfidenzPct}%
            </text>
            <text x="48" y="58" textAnchor="middle" fontSize="9" fill="#78716c">
              Konfidenz
            </text>
          </svg>
        </div>

        {/* Info-Block */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-stone-400" />
            <span className="text-xl font-black text-stone-800 tabular-nums">{data.etaMinutes} Min</span>
          </div>
          <p className="text-xs text-stone-500">
            Fenster: {data.etaEarliest}–{data.etaLatest} Min
          </p>
          <span className={cn('inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 bg-stone-100', cfg.color)}>
            <CheckCircle2 className="h-3 w-3" />
            {cfg.label}
          </span>
          <p className="text-[11px] text-stone-400 leading-snug">{data.reason}</p>
        </div>
      </div>
    </div>
  );
}
