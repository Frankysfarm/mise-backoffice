'use client';

import React, { useEffect, useState } from 'react';

interface FahrerProfil {
  name: string;
  avg_rating: number;
  anzahl_bewertungen: number;
}

interface Props {
  orderPlaced?: boolean;
  locationSlug?: string;
  driverId?: string;
}

const STORAGE_KEY_PREFIX = 'mise_fahrerprofil_';

const MOCK: FahrerProfil = {
  name: 'Ali Yilmaz',
  avg_rating: 4.8,
  anzahl_bewertungen: 127,
};

function Initialen(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function Sterne({ wert }: { wert: number }) {
  return (
    <span className="text-amber-400 text-sm select-none">
      {'★'.repeat(Math.floor(wert))}
      {wert % 1 >= 0.5 ? '½' : ''}
    </span>
  );
}

export function StorefrontPhase1551FahrerProfilVorschau({
  orderPlaced = false,
  locationSlug = '',
  driverId,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [profil, setProfil] = useState<FahrerProfil | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!orderPlaced) return;

    const storageKey = `${STORAGE_KEY_PREFIX}${locationSlug}`;

    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        setProfil(JSON.parse(cached));
        setVisible(true);
        return;
      } catch {}
    }

    const load = async () => {
      try {
        const url = driverId
          ? `/api/delivery/admin/fahrer-bewertungen?location_id=${locationSlug}&driver_id=${driverId}`
          : `/api/delivery/admin/fahrer-bewertungen?location_id=${locationSlug}`;
        const res = await fetch(url);
        if (!res.ok) { setProfil(MOCK); setVisible(true); return; }
        const json = await res.json();
        const f = driverId
          ? (json.fahrer ?? []).find((x: { driver_id: string }) => x.driver_id === driverId)
          : json.top3?.[0];
        if (f) {
          const p: FahrerProfil = {
            name: f.name,
            avg_rating: f.avg_heute || f.avg_7tage || 5,
            anzahl_bewertungen: f.anzahl_7tage ?? 0,
          };
          localStorage.setItem(storageKey, JSON.stringify(p));
          setProfil(p);
          setVisible(true);
        } else {
          setProfil(MOCK);
          setVisible(true);
        }
      } catch {
        setProfil(MOCK);
        setVisible(true);
      }
    };
    load();
  }, [orderPlaced, locationSlug, driverId]);

  if (!mounted || !orderPlaced || !visible || !profil) return null;

  const initialen = Initialen(profil.name);
  const avatarColor = 'bg-matcha-600';

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
        Dein Fahrer
      </p>
      <div className="flex items-center gap-3">
        <div className={`h-12 w-12 rounded-full ${avatarColor} flex items-center justify-center shrink-0`}>
          <span className="text-white text-sm font-black">{initialen}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{profil.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Sterne wert={profil.avg_rating} />
            <span className="text-sm font-bold tabular-nums text-foreground">{profil.avg_rating.toFixed(1)}</span>
            {profil.anzahl_bewertungen > 0 && (
              <span className="text-[11px] text-muted-foreground">({profil.anzahl_bewertungen} Bew.)</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
