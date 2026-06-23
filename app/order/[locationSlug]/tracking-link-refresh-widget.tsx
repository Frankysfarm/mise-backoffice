'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  orderId: string | undefined;
  liveStatus: string;
  className?: string;
}

interface RefreshTrackingResponse {
  ok: boolean;
  trackingUrl: string;
  orderId: string;
}

interface RefreshTrackingError {
  error: string;
}

export function TrackingLinkRefreshWidget({ orderId, liveStatus, className }: Props) {
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!orderId || liveStatus === 'geliefert' || liveStatus === 'abgeholt') {
    return null;
  }

  async function handleClick() {
    if (loading || sent) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/delivery/customer/refresh-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.ok) {
        const data = (await res.json()) as RefreshTrackingResponse;
        if (data.ok) {
          setSent(true);
        } else {
          setError('Fehler beim Senden');
        }
      } else {
        const errData = (await res.json()) as RefreshTrackingError;
        setError(errData.error ?? 'Fehler beim Senden');
      }
    } catch {
      setError('Fehler beim Senden');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-green-700', className)}>
        <CheckCircle2 className="size-3.5 shrink-0" />
        <span>Link wurde gesendet</span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5 shrink-0" />
        )}
        <span>Tracking-Link erneut senden</span>
      </button>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
