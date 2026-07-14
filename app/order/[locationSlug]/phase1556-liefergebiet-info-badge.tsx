'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  locationId: string;
  mindestbestellwert?: number;
  lieferzeitMin?: number;
  lieferzeitMax?: number;
  liefergebietName?: string;
}

export function StorefrontPhase1556LiefergebietInfoBadge({
  locationId,
  mindestbestellwert,
  lieferzeitMin,
  lieferzeitMax,
  liefergebietName,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<{
    mov: number;
    eta_min: number;
    eta_max: number;
    name: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    if (mindestbestellwert !== undefined && lieferzeitMin !== undefined && lieferzeitMax !== undefined) {
      setData({
        mov: mindestbestellwert,
        eta_min: lieferzeitMin,
        eta_max: lieferzeitMax,
        name: liefergebietName ?? 'Liefergebiet',
      });
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/public/liefergebiet-info?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          setData({
            mov: json.mindestbestellwert ?? json.mov ?? 10,
            eta_min: json.eta_min ?? json.lieferzeit_min ?? 20,
            eta_max: json.eta_max ?? json.lieferzeit_max ?? 40,
            name: json.name ?? json.liefergebiet_name ?? 'Liefergebiet',
          });
          return;
        }
      } catch {}
      setData({ mov: 10, eta_min: 20, eta_max: 40, name: 'Gesamtes Stadtgebiet' });
    };
    load();
  }, [locationId, mindestbestellwert, lieferzeitMin, lieferzeitMax, liefergebietName]);

  if (!mounted || !data) return null;

  const movFormatted = data.mov.toFixed(2).replace('.', ',');

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-base">📍</span>
        <span className="font-semibold text-foreground text-xs">{data.name}</span>
      </div>
      <div className="h-3 w-px bg-border hidden sm:block" />
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{movFormatted} €</span>
        <span>Mindestbestellung</span>
      </div>
      <div className="h-3 w-px bg-border hidden sm:block" />
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>⏱</span>
        <span className="font-medium text-foreground">{data.eta_min}–{data.eta_max} Min</span>
        <span>Lieferzeit</span>
      </div>
    </div>
  );
}
