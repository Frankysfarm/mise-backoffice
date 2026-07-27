'use client';

import { createClient } from '@/lib/supabase/client';
import { replayOfflineOutbox } from './offline-outbox';

export function replayCanonicalDriverOutbox(): Promise<{ ok: number; fail: number }> {
  const supabase = createClient();
  const getAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error('OFFLINE_REPLAY_SESSION_FAILED');
    return data.session?.access_token ?? null;
  };
  return replayOfflineOutbox({
    getAccessToken,
    applySnapshot: (snapshot) => {
      window.dispatchEvent(new CustomEvent('mise:driver-snapshot-reconciled', { detail: snapshot }));
    },
    reconcileSnapshot: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('OFFLINE_REPLAY_SESSION_MISSING');
      const response = await fetch('/api/driver/v2/snapshot', {
        cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`OFFLINE_SNAPSHOT_FAILED:${response.status}`);
      const snapshot = await response.json();
      window.dispatchEvent(new CustomEvent('mise:driver-snapshot-reconciled', { detail: snapshot }));
    },
  });
}
