'use client';

/**
 * StornoSchutzBadge — Phase 345
 *
 * Zeigt Kunden-seitig ob kostenlose Stornierung möglich ist
 * und informiert über Stornierungsschutz-Bedingungen.
 * Nur sichtbar bei Lieferbestellungen.
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

interface GuardConfig {
  isEnabled: boolean;
  blockAfterNCancellations: number;
  blockWindowHours: number;
  voucherEnabled: boolean;
  voucherAmountEur: number;
}

export function StornoSchutzBadge({
  locationId,
  orderType,
}: {
  locationId: string;
  orderType: string;
}) {
  const [config, setConfig] = useState<GuardConfig | null>(null);

  useEffect(() => {
    if (orderType !== 'lieferung') return;
    const load = async () => {
      const res = await fetch(
        `/api/delivery/admin/cancellation-guard?action=config&location_id=${locationId}`,
        { cache: 'no-store' },
      ).catch(() => null);
      if (res?.ok) setConfig(await res.json() as GuardConfig);
    };
    load();
  }, [locationId, orderType]);

  if (orderType !== 'lieferung' || !config || !config.isEnabled) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      <span>
        <strong>Kostenlose Stornierung</strong> vor Zubereitung möglich
        {config.blockAfterNCancellations > 0 && (
          <span className="text-emerald-700">
            {' · '}Max. {config.blockAfterNCancellations} Stornierungen in {config.blockWindowHours}h
          </span>
        )}
        {config.voucherEnabled && (
          <span className="text-emerald-700">
            {' · '}Bei Stornierung: €{config.voucherAmountEur.toFixed(2)} Gutschein möglich
          </span>
        )}
      </span>
      <ShieldAlert className="h-3 w-3 text-emerald-400 shrink-0" />
    </div>
  );
}
