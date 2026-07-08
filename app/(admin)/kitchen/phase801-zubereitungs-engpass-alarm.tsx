'use client';

import { useEffect, useState } from 'react';
import { Flame, Clock } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface EngpassDaten {
  engpass_aktiv: boolean;
  bestellungen_in_vorbereitung: number;
  laengste_wartezeit_min: number;
  kritische_bestellungen: { order_id: string; wartezeit_min: number }[];
}

const MOCK: EngpassDaten = {
  engpass_aktiv: true,
  bestellungen_in_vorbereitung: 7,
  laengste_wartezeit_min: 23,
  kritische_bestellungen: [
    { order_id: 'B-001', wartezeit_min: 23 },
    { order_id: 'B-002', wartezeit_min: 19 },
    { order_id: 'B-003', wartezeit_min: 17 },
  ],
};

export function KitchenPhase801ZubereitungsEngpassAlarm({ locationId }: Props) {
  const [data, setData] = useState<EngpassDaten | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();

      // Interpretiere kuechen-kapazitaets-warnsignal Antwort für Engpass
      const wartende = json.wartende_bestellungen ?? 0;
      const engpass = wartende > 5;
      setData({
        engpass_aktiv: engpass,
        bestellungen_in_vorbereitung: wartende,
        laengste_wartezeit_min: json.eta_minuten ?? 0,
        kritische_bestellungen: [],
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-12 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  if (!data || !data.engpass_aktiv) return null;

  const { bestellungen_in_vorbereitung, laengste_wartezeit_min, kritische_bestellungen } = data;
  const schwere = bestellungen_in_vorbereitung >= 10 ? 'kritisch' : 'warnung';

  return (
    <div
      className={`rounded-xl border shadow-sm px-4 py-3 ${
        schwere === 'kritisch'
          ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 animate-pulse'
          : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Flame
          className={`h-4 w-4 shrink-0 ${
            schwere === 'kritisch'
              ? 'text-red-600 dark:text-red-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        />
        <span
          className={`text-xs font-semibold ${
            schwere === 'kritisch'
              ? 'text-red-700 dark:text-red-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          Zubereitungs-Engpass
          {schwere === 'kritisch' ? ' — Kritisch!' : ''}
        </span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-bold tabular-nums ${
                schwere === 'kritisch'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {bestellungen_in_vorbereitung}
            </span>
            <span className="text-xs text-muted-foreground">Bestellungen in Vorbereitung</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              Längste Wartezeit:{' '}
              <span className="font-medium">{laengste_wartezeit_min} Min</span>
            </span>
          </div>
        </div>

        <div
          className={`rounded-lg px-3 py-1.5 text-center ${
            schwere === 'kritisch'
              ? 'bg-red-100 dark:bg-red-900/40'
              : 'bg-amber-100 dark:bg-amber-900/40'
          }`}
        >
          <p
            className={`text-xs font-bold ${
              schwere === 'kritisch'
                ? 'text-red-700 dark:text-red-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {schwere === 'kritisch' ? '🔴 Stopp' : '🟡 Aufpassen'}
          </p>
          <p className="text-[9px] text-muted-foreground">Neue Annahme</p>
        </div>
      </div>

      {kritische_bestellungen.length > 0 && (
        <div className="mt-1.5 space-y-1">
          <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
            Überfällige Bestellungen
          </p>
          {kritische_bestellungen.slice(0, 3).map((b) => (
            <div
              key={b.order_id}
              className="flex items-center justify-between text-[10px] rounded bg-white/60 dark:bg-black/20 px-2 py-1"
            >
              <span className="font-mono text-muted-foreground">{b.order_id}</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {b.wartezeit_min} Min
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[9px] text-muted-foreground">
        Alarm bei &gt;5 Bestellungen in Vorbereitung · 30s-Update
      </p>
    </div>
  );
}
