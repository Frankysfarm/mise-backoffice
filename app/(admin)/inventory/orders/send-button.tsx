'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { toastError, toastSuccess } from '@/components/ui/toaster';

export function SendOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function send() {
    if (!confirm('Bestellung jetzt per E-Mail an den Lieferanten senden?')) return;
    start(async () => {
      const res = await fetch(`/api/inventory/orders/${orderId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
      if (!res.ok) { toastError('Versand fehlgeschlagen', payload.error); return; }
      toastSuccess('Bestellung versendet', 'Status: bestellt.');
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={send} disabled={pending}>
      <Send className="h-3.5 w-3.5" /> {pending ? 'Sende...' : 'Versenden'}
    </Button>
  );
}
