'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Upload, Loader2 } from 'lucide-react';

const KATEGORIEN = [
  'Ausweis',
  'Gesundheitszeugnis',
  'Aufenthaltstitel',
  'Arbeitsvertrag',
  'Datenschutzerklärung',
  'Zeugnis',
  'Führerschein',
  'Sonstiges',
];

export function DocumentUploader({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [titel, setTitel] = useState('');
  const [kategorie, setKategorie] = useState(KATEGORIEN[0]);
  const [ablaufdatum, setAblaufdatum] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toastError('Datei fehlt', 'Bitte eine Datei auswählen.');
    if (!titel) return toastError('Titel fehlt');

    start(async () => {
      const sb = createClient();
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${employeeId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

      const { error: upErr } = await sb.storage.from('documents').upload(path, file, {
        upsert: false, contentType: file.type,
      });
      if (upErr) return toastError('Upload fehlgeschlagen', upErr.message);

      const res = await fetch('/api/documents/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId, titel, kategorie,
          ablaufdatum: ablaufdatum || undefined,
          storage_path: path, dateiname: file.name,
          mime_type: file.type, größe_bytes: file.size,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return toastError('Speichern fehlgeschlagen', data?.error ?? `${res.status}`);

      toastSuccess('Dokument gespeichert', titel);
      setFile(null); setTitel(''); setAblaufdatum('');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dokument hochladen</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Titel</Label>
            <Input value={titel} onChange={e => setTitel(e.target.value)} placeholder="Gesundheitszeugnis Lisa" required />
          </div>
          <div>
            <Label>Kategorie</Label>
            <select value={kategorie} onChange={e => setKategorie(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <Label>Ablaufdatum (optional)</Label>
            <Input type="date" value={ablaufdatum} onChange={e => setAblaufdatum(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Label>Datei</Label>
            <Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
              accept="image/*,application/pdf" required />
            {file && <div className="mt-1 text-xs text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
          </div>
          <Button type="submit" disabled={pending} className="md:col-span-1">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {pending ? 'Lade...' : 'Hochladen'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
