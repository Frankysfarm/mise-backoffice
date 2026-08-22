'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Play } from 'lucide-react';

export function StartSessionButton({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const { error } = await createClient().from('inventory_sessions').insert({
        location_id: fd.get('location_id'),
        notiz: fd.get('notiz') || null,
      });
      if (error) return toastError('Inventur-Start fehlgeschlagen', error.message);
      toastSuccess('Inventur gestartet', 'Zähle Bestände jetzt in der Mobile-App.');
      setOpen(false); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Play className="h-4 w-4" /> Inventur starten</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Inventur starten</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><Label>Standort</Label>
            <select name="location_id" required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div><Label>Notiz (optional)</Label><Input name="notiz" placeholder="Monatsinventur Juli" /></div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" disabled={pending}>{pending ? '...' : 'Starten'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
