'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function SwapActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  if (status !== 'angefragt') return null;
  function update(newStatus: string) {
    start(async () => {
      await createClient().from('shift_swaps').update({ status: newStatus }).eq('id', id);
      router.refresh();
    });
  }
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="secondary" onClick={() => update('angenommen')} disabled={isPending}>Genehmigen</Button>
      <Button size="sm" variant="outline" onClick={() => update('abgelehnt')} disabled={isPending}>Ablehnen</Button>
    </div>
  );
}
