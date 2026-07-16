'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Flame, CheckCircle2, Clock } from 'lucide-react';

/**
 * Phase 1855 — Küchenstatus-Banner (Storefront)
 *
 * Zeigt Kapazitätsstatus aus /api/delivery/admin/schicht-kapazitaets-ampel (Phase 1841 API):
 *  grün  → "Küche auf Hochtouren — schnelle Lieferung"
 *  gelb  → "Aktuell etwas mehr Bestellungen — kurze Wartezeit möglich"
 *  rot   → "Küche sehr ausgelastet — etwas mehr Geduld"
 * Hydration-safe; schließbar; 5-Min-Polling.
 */

interface KapazitaetData {
  status: 'gruen' | 'gelb' | 'rot';
  auslastungs_prozent: number;
  wartende_bestellungen: number;
  freie_fahrer: number;
  empfehlung: string | null;
}

const MOCK: KapazitaetData = {
  status: 'gruen',
  auslastungs_prozent: 45,
  wartende_bestellungen: 2,
  freie_fahrer: 3,
  empfehlung: null,
};

interface BannerConfig {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bg: string;
  border: string;
  text: string;
}

function bannerConfig(d: KapazitaetData): BannerConfig {
  if (d.status === 'gruen') return {
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
    title: 'Küche auf Hochtouren',
    subtitle: d.freie_fahrer > 0
      ? `${d.freie_fahrer} Fahrer verfügbar — schnelle Lieferung`
      : 'Schnelle Lieferung erwartet',
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-800',
    text: 'text-matcha-800 dark:text-matcha-200',
  };
  if (d.status === 'gelb') return {
    icon: <Clock className="h-4 w-4 shrink-0" />,
    title: 'Aktuell etwas mehr Bestellungen',
    subtitle: 'Kurze Wartezeit möglich — wir arbeiten auf Hochdruck',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-200',
  };
  return {
    icon: <Flame className="h-4 w-4 shrink-0" />,
    title: 'Küche sehr ausgelastet',
    subtitle: d.empfehlung ?? 'Etwas mehr Geduld — deine Bestellung wird sorgfältig zubereitet',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
  };
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase1855KuechenStatusBanner({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<KapazitaetData | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);

  useEffect(() => {
    setMounted(true);
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-kapazitaets-ampel?location_id=${locationId}`);
        if (res.ok && alive) setData(await res.json());
      } catch {
        if (alive) setData(MOCK);
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [locationId]);

  if (!mounted || geschlossen) return null;
  const d = data ?? MOCK;
  const cfg = bannerConfig(d);

  return (
    <div className={cn('relative flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-sm', cfg.bg, cfg.border, cfg.text, className)}>
      {cfg.icon}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[11px] leading-tight">{cfg.title}</p>
        <p className="text-[10px] opacity-80 mt-0.5 leading-tight">{cfg.subtitle}</p>
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors mt-0.5"
        aria-label="Schließen"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
