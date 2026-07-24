'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CANONICAL_OFFER_STORAGE_KEY,
  integrateCanonicalOffer,
  parseCanonicalOffer,
} from './atomic-offer-client-state';

interface NativeOfferDetail {
  offer_id?: unknown;
  assignment_version?: unknown;
  batch_id?: unknown;
  ack_url?: unknown;
}

const STORAGE_PREFIX = 'mise-driver-offer:';

export function NativeOfferBridge() {
  useEffect(() => {
    const isNativeShell = Boolean(
      (window as unknown as {
        Capacitor?: { isNativePlatform?: () => boolean };
      }).Capacitor?.isNativePlatform?.(),
    );

    const onOffer = async (event: Event) => {
      const detail = (event as CustomEvent<NativeOfferDetail>).detail ?? {};
      const offerId = typeof detail.offer_id === 'string' ? detail.offer_id : '';
      const assignmentVersion =
        typeof detail.assignment_version === 'number'
          ? detail.assignment_version
          : Number.NaN;
      const nativeAckUrl =
        typeof detail.ack_url === 'string' &&
        detail.ack_url.startsWith('mise-driver://offer-ack?event_id=')
          ? detail.ack_url
          : null;

      // Compatibility fallback für alte Pushes/TestFlight-Builds.
      if (!offerId || !Number.isSafeInteger(assignmentVersion) || assignmentVersion < 1) {
        window.dispatchEvent(new CustomEvent('mise-driver-legacy-offer', { detail }));
        if (document.visibilityState === 'visible') window.location.reload();
        return;
      }

      const storageKey = `${STORAGE_PREFIX}${offerId}:${assignmentVersion}`;
      const previous = localStorage.getItem(storageKey);
      if (previous === 'acked') return;
      localStorage.setItem(storageKey, 'received');

      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const response = await fetch('/api/driver/v1/offers/ack', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          offer_id: offerId,
          assignment_version: assignmentVersion,
        }),
      });
      if (!response.ok) return;

      // Erst nach serverseitiger Assignment-Integration als ACK persistieren.
      localStorage.setItem(storageKey, 'acked');
      let stored = null;
      try {
        stored = parseCanonicalOffer(
          JSON.parse(localStorage.getItem(CANONICAL_OFFER_STORAGE_KEY) ?? 'null'),
        );
      } catch {
        localStorage.removeItem(CANONICAL_OFFER_STORAGE_KEY);
      }
      const canonical = integrateCanonicalOffer(stored, {
        offerId,
        assignmentVersion,
        batchId: typeof detail.batch_id === 'string' ? detail.batch_id : undefined,
      });
      if (canonical) {
        localStorage.setItem(CANONICAL_OFFER_STORAGE_KEY, JSON.stringify(canonical));
      }
      window.dispatchEvent(new CustomEvent('mise-driver-offer-integrated', {
        detail: {
          offer_id: offerId,
          assignment_version: assignmentVersion,
          batch_id: typeof detail.batch_id === 'string' ? detail.batch_id : undefined,
        },
      }));

      // Erst der native URL-Callback entfernt das persistierte Bridge-Event.
      if (isNativeShell && nativeAckUrl) window.location.href = nativeAckUrl;
    };

    window.addEventListener('mise-driver-offer', onOffer);
    // Teilt der nativen Shell mit, dass der Listener installiert ist.
    if (isNativeShell) window.location.href = 'mise-driver://bridge-ready';
    return () => window.removeEventListener('mise-driver-offer', onOffer);
  }, []);

  return null;
}
