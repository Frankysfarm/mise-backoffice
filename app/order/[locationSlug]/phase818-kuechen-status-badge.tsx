'use client';

import { useEffect, useState } from 'react';
import { Circle } from 'lucide-react';

type Ampel = 'gruen' | 'amber' | 'rot';

interface KuechenStatus {
  ampel: Ampel;
  wartezeit: number | null;
  label: string;
}

const MOCK: KuechenStatus = { ampel: 'gruen', wartezeit: 18, label: 'Küche bereit' };

const FARBE: Record<Ampel, { dot: string; bg: string; text: string; border: string }> = {
  gruen: { dot: 'text-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  amber: { dot: 'text-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  rot:   { dot: 'text-red-500',   bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200'   },
};

interface Props {
  locationId: string | null;
}

export function Phase818KuechenStatusBadge({ locationId }: Props) {
  const [status, setStatus] = useState<KuechenStatus | null>(null);

  async function load() {
    if (!locationId) { setStatus(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`);
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();
      const level: string = json.level ?? 'gruen';
      const ampel: Ampel = level === 'rot' ? 'rot' : level === 'amber' ? 'amber' : 'gruen';
      const wartezeit: number | null = json.estimated_wait_min ?? json.wartezeit ?? null;
      const label =
        ampel === 'rot' ? 'Küche ausgelastet' :
        ampel === 'amber' ? 'Küche beschäftigt' : 'Küche bereit';
      setStatus({ ampel, wartezeit, label });
    } catch {
      setStatus(MOCK);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!status) return null;

  const c = FARBE[status.ampel];

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${c.bg} ${c.border} ${c.text}`}>
      <Circle className={`h-2 w-2 fill-current ${c.dot}`} />
      <span>{status.label}</span>
      {status.wartezeit != null && (
        <span className="opacity-75">· ca. {status.wartezeit} Min</span>
      )}
    </div>
  );
}
