'use client';

import { useRouter } from 'next/navigation';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

/**
 * Minimal-Komponente: abonniert eine Tabelle und ruft router.refresh() bei jedem Event.
 * Für Seiten, wo Server-Component-Refresh der einfachste Update-Weg ist.
 */
export function LiveRefresh({ channel, table, filter }: { channel: string; table: string; filter?: string }) {
  const router = useRouter();
  useRealtimeTable({
    channel, table, filter,
    onChange: () => router.refresh(),
  });
  return null;
}
