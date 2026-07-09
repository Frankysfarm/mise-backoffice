'use client';

import { useEffect, useState } from 'react';
import { Loader2, Star, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type ScoreDaten = {
  score: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  punkte: number;
  ø_bewertung: number;
};

type MotivationsConfig = {
  emoji: string;
  titel: string;
  text: string;
  farbe: 'gruen' | 'amber' | 'blau';
};

function getMock(driverId: string): ScoreDaten {
  const hash = driverId.charCodeAt(0) % 3;
  const trends = ['steigend', 'stabil', 'fallend'] as const;
  return {
    score: 65 + hash * 10,
    trend: trends[hash],
    punkte: 8 + hash * 3,
    ø_bewertung: 4.2 + hash * 0.2,
  };
}

function buildMotivation(daten: ScoreDaten): MotivationsConfig {
  if (daten.trend === 'steigend' && daten.score >= 70) {
    return {
      emoji: '🚀',
      titel: 'Starke Leistung!',
      text: `Dein Score steigt — bleib dran! ${daten.punkte} Punkte heute, Ø ${daten.ø_bewertung.toFixed(1)} ⭐. Du bist auf dem richtigen Weg.`,
      farbe: 'gruen',
    };
  }
  if (daten.trend === 'fallend' || daten.score < 50) {
    return {
      emoji: '💡',
      titel: 'Kleiner Tipp für dich',
      text: `Score ${daten.score} — pünktliche Lieferungen und freundliches Auftreten steigern deinen Score schnell. Du schaffst das!`,
      farbe: 'amber',
    };
  }
  if (daten.score >= 80) {
    return {
      emoji: '🏆',
      titel: 'Herausragend!',
      text: `Score ${daten.score} — du gehörst zu den besten Fahrern. Schaff heute ein neues Persönlichkeitsrekord!`,
      farbe: 'gruen',
    };
  }
  return {
    emoji: '🎯',
    titel: 'Challenge für heute',
    text: `Score ${daten.score} — versuche heute 2 mehr Stopps als gestern! Kleine Schritte, großer Unterschied.`,
    farbe: 'blau',
  };
}

export function FahrerPhase1056SchichtMotivationsCoach({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline?: boolean;
}) {
  const [daten, setDaten] = useState<ScoreDaten | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tages-score?location_id=&driver_id=${driverId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const fahrer = Array.isArray(json.fahrer)
        ? json.fahrer.find((f: { fahrer_id?: string; driver_id?: string }) => f.fahrer_id === driverId || f.driver_id === driverId)
        : null;
      if (!fahrer) throw new Error();
      setDaten({
        score: fahrer.score ?? fahrer.gesamt_score ?? 65,
        trend: fahrer.trend ?? 'stabil',
        punkte: fahrer.stopps ?? fahrer.lieferungen ?? 8,
        ø_bewertung: fahrer.ø_bewertung ?? fahrer.bewertung ?? 4.3,
      });
    } catch {
      setDaten(getMock(driverId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, isOnline]);

  if (!isOnline) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!daten) return null;

  const motivation = buildMotivation(daten);

  const farbMap = {
    gruen: {
      bg: 'bg-gradient-to-br from-matcha-900/80 to-matcha-800/80',
      border: 'border-matcha-700/50',
      badge: 'bg-matcha-500/20 text-matcha-200',
      text: 'text-matcha-100',
      sub: 'text-matcha-300',
      icon: 'text-matcha-300',
    },
    amber: {
      bg: 'bg-gradient-to-br from-amber-900/80 to-amber-800/80',
      border: 'border-amber-700/50',
      badge: 'bg-amber-500/20 text-amber-200',
      text: 'text-amber-100',
      sub: 'text-amber-300',
      icon: 'text-amber-300',
    },
    blau: {
      bg: 'bg-gradient-to-br from-blue-900/80 to-blue-800/80',
      border: 'border-blue-700/50',
      badge: 'bg-blue-500/20 text-blue-200',
      text: 'text-blue-100',
      sub: 'text-blue-300',
      icon: 'text-blue-300',
    },
  }[motivation.farbe];

  const TrendIcon = daten.trend === 'steigend' ? TrendingUp : daten.trend === 'fallend' ? TrendingDown : Zap;

  return (
    <section className={cn('border rounded-2xl p-4 space-y-3', farbMap.bg, farbMap.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-lg', farbMap.badge)}>
            {motivation.emoji}
          </div>
          <div>
            <div className={cn('text-xs font-semibold uppercase tracking-wide', farbMap.sub)}>
              Coach
            </div>
            <div className={cn('text-sm font-bold', farbMap.text)}>{motivation.titel}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={cn('text-lg font-black tabular-nums', farbMap.text)}>{daten.score}</div>
          <div className={cn('flex items-center gap-0.5 text-[10px] font-semibold', farbMap.sub)}>
            <TrendIcon size={10} className={farbMap.icon} />
            {daten.trend === 'steigend' ? 'steigend' : daten.trend === 'fallend' ? 'fallend' : 'stabil'}
          </div>
        </div>
      </div>

      <p className={cn('text-xs leading-relaxed', farbMap.sub)}>{motivation.text}</p>

      <div className={cn('flex items-center gap-4 text-[11px] font-semibold border-t pt-2.5', farbMap.border, farbMap.sub)}>
        <span className="flex items-center gap-1">
          <Star size={10} className={farbMap.icon} />
          Ø {daten.ø_bewertung.toFixed(1)} ⭐
        </span>
        <span>{daten.punkte} Stopps heute</span>
        <span className={cn('ml-auto text-[10px] font-normal', farbMap.sub)}>10-Min-Update</span>
      </div>
    </section>
  );
}
