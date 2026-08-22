'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Mail, Copy, Check } from 'lucide-react';

export function InviteApplicantButton({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLink(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await fetch('/api/applications/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fd.get('email'),
          vorname: fd.get('vorname'),
          nachname: fd.get('nachname'),
          location_id: fd.get('location_id') || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return toastError('Einladung fehlgeschlagen', data?.error ?? `${res.status}`);
      setLink(data.link);
      if (data.email?.sent) {
        toastSuccess('Einladung versendet ✉️', `Mail ist unterwegs an ${fd.get('email')}.`);
      } else if (data.email?.skipped) {
        toastSuccess('Einladung erstellt', 'Mail-Versand nicht aktiv — Link kopieren und selbst schicken.');
      } else {
        toastSuccess('Einladung erstellt', data.email?.error
          ? `Mail fehlgeschlagen: ${String(data.email.error).slice(0, 80)}`
          : 'Link 14 Tage gültig.');
      }
      router.refresh();
    });
  }

  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setLink(null); }}>
      <DialogTrigger asChild>
        <Button><Mail className="h-4 w-4" /> Einladen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Bewerbung einladen</DialogTitle></DialogHeader>

        {!link ? (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vorname</Label><Input name="vorname" required /></div>
              <div><Label>Nachname</Label><Input name="nachname" required /></div>
            </div>
            <div><Label>E-Mail</Label><Input name="email" type="email" required /></div>
            <div><Label>Standort (optional)</Label>
              <select name="location_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">—</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button type="submit" disabled={pending}>{pending ? '...' : 'Einladung erstellen'}</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">Einladung erstellt. Schick diesen Link dem Bewerber — per E-Mail, WhatsApp, QR-Code, was du willst:</p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
              <code className="flex-1 break-all text-xs">{link}</code>
              <Button size="sm" variant="secondary" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Kopiert' : 'Kopieren'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Link ist 14 Tage gültig. Bewerber landet auf einem Wizard mit Fortschritts-Balken.</p>
            <DialogFooter>
              <Button onClick={() => { setOpen(false); setLink(null); }}>Fertig</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
