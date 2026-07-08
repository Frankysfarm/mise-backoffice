'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, MapPin, Euro, Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneEintrag {
  zone: string;
  lieferungen: number;
  umsatz_eur: number;
  trinkgeld_eur: number;
  erloes_pro_lieferung: number;
  gesamt_km: number | null;
  km_pro_lieferung: number | null;
  effizienz_score: number;
}

interface ApiResponse {
  ok: boolean;
  zonen: ZoneEintrag[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const ZONE_LABELS: Record<string, string> = {
  A: 'Zone A — Kern',
  B: 'Zone B — Nah',
  C: 'Zone C — Mittel',
  D: 'Zone D — Fern',
};

export function DispatchPhase661ZoneEffizienzRangliste({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/zonen-erloes-vergleich?location_id=${locationId}`);
        const json = await res.json() as ApiResponse;
        if (active) setData(json);
      } catch {
        // noop
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 120_000);
    return () => { active = false; clearInterval(timer); };
  }, [locationId]);

  if (!locationId) return null;
  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 flex items-center justify-center gap-2 text-sm text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Lade Zonen-Rangliste…
      </div>
    );
  }

  const zonen = data?.zonen ?? [];
  if (zonen.length === 0) return null;

  const maxErloes = Math.max(...zonen.map(z => z.erloes_pro_lieferung), 1);
  const maxUmsatz = Math.max(...zonen.map(z => z.umsatz_eur), 1);

  const ranged = [...zonen].sort((a, b) => b.erloes_pro_lieferung - a.erloes_pro_lieferung);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Zonen-Effizienz-Rangliste</div>
            <div className="text-[11px] text-stone-400">Erlös/Lieferung · Heute</div>
          </div>
        </div>
        <div className="text-[10px] text-stone-400">
          {zonen.reduce((s, z) => s + z.lieferungen, 0)} Lieferungen gesamt
        </div>
      </div>

      <div className="divide-y divide-stone-50">
        {ranged.map((z, idx) => {
          const barPct = (z.erloes_pro_lieferung / maxErloes) * 100;
          const umsatzPct = (z.umsatz_eur / maxUmsatz) * 100;
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
          const barColor = idx === 0 ? 'bg-emerald-500' : idx === 1 ? 'bg-blue-400' : idx === 2 ? 'bg-amber-400' : 'bg-stone-300';

          return (
            <div key={z.zone} className="px-5 py-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-6 text-center text-sm shrink-0">{medal}</div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-stone-400" />
                  <span className="text-sm font-bold text-stone-800">
                    {ZONE_LABELS[z.zone] ?? `Zone ${z.zone}`}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-3 text-[11px] text-stone-500">
                  <span className="flex items-center gap-0.5">
                    <Package className="h-3 w-3" />
                    {z.lieferungen}×
                  </span>
                  <span className="flex items-center gap-0.5 font-bold text-stone-700">
                    <Euro className="h-3 w-3" />
                    {z.erloes_pro_lieferung.toFixed(2)}/Lief.
                  </span>
                </div>
              </div>
              <div className="pl-9 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', barColor)}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-stone-400 w-16 text-right tabular-nums">
                    Ø {z.erloes_pro_lieferung.toFixed(2)} €
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-stone-400">
                  <span>Umsatz: {z.umsatz_eur.toFixed(2)} €</span>
                  {z.km_pro_lieferung !== null && (
                    <span>Ø {z.km_pro_lieferung.toFixed(1)} km/Lief.</span>
                  )}
                  {z.trinkgeld_eur > 0 && (
                    <span className="text-emerald-600">+{z.trinkgeld_eur.toFixed(2)} € TG</span>
                  )}
                </div>
                <div className="h-1 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-stone-200"
                    style={{ width: `${umsatzPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 text-[10px] text-stone-400 text-right">
        Gesamt-Umsatz heute: {zonen.reduce((s, z) => s + z.umsatz_eur, 0).toFixed(2)} €
        {data?.generatedAt && ` · ${new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}
      </div>
    </div>
  );
}
