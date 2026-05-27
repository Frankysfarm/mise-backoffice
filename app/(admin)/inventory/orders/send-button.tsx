'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { toastError, toastSuccess } from '@/components/ui/toaster';

export function SendOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function send() {
    if (!confirm('Bestellung jetzt per E-Mail an den Lieferanten senden?')) return;
    start(async () => {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/order-list-mail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ order_list_id: orderId }),
      });
      const text = await res.text();
      if (!res.ok) { toastError('Versand fehlgeschlagen', text); return; }
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
