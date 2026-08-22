'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

export function CashClosingDialog({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null);
    const fd = new FormData(e.currentTarget);
    const bar = Number(fd.get('bar') || 0);
    const karte = Number(fd.get('karte') || 0);
    const trinkgeld = Number(fd.get('trinkgeld') || 0);
    const soll = Number(fd.get('soll') || 0);
    const ist = Number(fd.get('ist') || 0);
    start(async () => {
      const { error } = await createClient().from('cash_closings').insert({
        datum: fd.get('datum'),
        location_id: fd.get('location_id'),
        bar_einnahmen: bar, karten_einnahmen: karte, trinkgeld,
        soll_bestand: soll, ist_bestand: ist, differenz: ist - soll,
        notiz: fd.get('notiz') || null,
        abgeschlossen: true,
      });
      if (error) return setErr(error.message);
      setOpen(false); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Neuer Abschluss</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Kassenabschluss anlegen</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <div><Label>Datum</Label><Input name="datum" type="date" defaultValue={new Date().toISOString().slice(0,10)} required /></div>
          <div><Label>Standort</Label>
            <select name="location_id" required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div><Label>Bar €</Label><Input name="bar" type="number" step="0.01" /></div>
          <div><Label>Karte €</Label><Input name="karte" type="number" step="0.01" /></div>
          <div><Label>Trinkgeld €</Label><Input name="trinkgeld" type="number" step="0.01" /></div>
          <div></div>
          <div><Label>Soll €</Label><Input name="soll" type="number" step="0.01" /></div>
          <div><Label>Ist €</Label><Input name="ist" type="number" step="0.01" /></div>
          <div className="col-span-2"><Label>Notiz</Label><Input name="notiz" /></div>
          {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
          <DialogFooter className="col-span-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" disabled={pending}>{pending ? '...' : 'Speichern'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
