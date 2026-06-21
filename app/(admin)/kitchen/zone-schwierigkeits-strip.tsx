'use client';

/**
 * KitchenZoneSchwierigkeitsStrip — Phase 356
 *
 * Zeigt einen Amber/Rot-Strip wenn mindestens eine Zone einen
 * hohen Schwierigkeits-Score hat (avgDifficulty ≥ 3.5).
 * Informiert das Küchen-Team: schwierige Zonen → Fahrer brauchen länger.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, CheckCircle } from 'lucide-react';

interface ZoneCacheEntry {
  zone: string;
  avg_difficulty: number;
  avg_traffic: number;
  stop_count_modifier: number;
  detour_modifier: number;
  sample_count: number;
}

const DIFFICULTY_THRESHOLD = 3.5;
const POLL_MS = 5 * 60 * 1000; // 5 Min

function difficultyLabel(score: number): string {
  if (score >= 4.5) return 'Sehr schwierig';
  if (score >= 3.5) return 'Schwierig';
  if (score >= 2.5) return 'Mittel';
  return 'Leicht';
}

function difficultyColor(score: number): { bg: string; text: string; dot: string } {
  if (score >= 4.5) return { bg: 'bg-red-50 border-red-200',    text: 'text-red-800',   dot: 'bg-red-500' };
  if (score >= 3.5) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' };
  return                    { bg: 'bg-matcha-50 border-matcha-200', text: 'text-matcha-800', dot: 'bg-matcha-500' };
}

export function KitchenZoneSchwierigkeitsStrip() {
  const [entries, setEntries] = useState<ZoneCacheEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/delivery/admin/zone-difficulty?action=cache', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json() as { cache?: ZoneCacheEntry[] };
        if (active) setEntries(json.cache ?? []);
      } catch { /* ignore */ } finally {
        if (active) setLoading(false);
      }
    };
    fetch_();
    const t = setInterval(fetch_, POLL_MS);
    return () => { active = false; clearInterval(t); };
  }, []);

  const hardZones = entries.filter((e) => e.avg_difficulty >= DIFFICULTY_THRESHOLD && e.sample_count >= 3);
  if (loading || hardZones.length === 0) {
    if (!loading && entries.length > 0) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-matcha-200 bg-matcha-50 px-3 py-2 text-xs text-matcha-700">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Alle Zonen: normale Schwierigkeit</span>
        </div>
      );
    }
    return null;
  }

  const maxDiff = Math.max(...hardZones.map((z) => z.avg_difficulty));
  const colors = difficultyColor(maxDiff);

  return (
    <div className={`rounded-lg border px-3 py-2 ${colors.bg}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${colors.text}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${colors.text}`}>
            Schwierige Lieferzonen aktiv — Fahrer brauchen länger
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {hardZones.map((z) => {
              const c = difficultyColor(z.avg_difficulty);
              return (
                <div key={z.zone} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${c.bg}`}>
                  <MapPin className={`h-3 w-3 ${c.text}`} />
                  <span className={`text-[11px] font-bold ${c.text}`}>Zone {z.zone}</span>
                  <span className={`text-[10px] ${c.text}`}>{difficultyLabel(z.avg_difficulty)}</span>
                  {z.stop_count_modifier < 1.0 && (
                    <span className={`text-[9px] font-medium ${c.text} opacity-75`}>
                      (−{Math.round((1 - z.stop_count_modifier) * 100)}% Kapazität)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default KitchenZoneSchwierigkeitsStrip;
