'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Wysiwyg } from '@/components/ui/wysiwyg';

export function ModuleEditor({ mod, progress }: { mod: any; progress: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    titel: mod.titel, beschreibung: mod.beschreibung ?? '',
    kategorie: mod.kategorie ?? '', position_typ: mod.position_typ ?? '',
    dauer_minuten: mod.dauer_minuten ?? '', reihenfolge: mod.reihenfolge ?? '',
    gültig_monate: mod.gültig_monate ?? '', pflicht: mod.pflicht ?? false,
    aktiv: mod.aktiv ?? true,
    inhalt: JSON.stringify(mod.inhalt ?? { lessons: [] }, null, 2),
  });

  async function onSave(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    let inhaltParsed;
    try { inhaltParsed = JSON.parse(form.inhalt); } catch { setMsg('JSON im Inhalt ungültig'); return; }
    start(async () => {
      const { error } = await createClient().from('training_modules').update({
        titel: form.titel, beschreibung: form.beschreibung || null,
        kategorie: form.kategorie || null, position_typ: form.position_typ || null,
        dauer_minuten: form.dauer_minuten ? Number(form.dauer_minuten) : null,
        reihenfolge: form.reihenfolge ? Number(form.reihenfolge) : null,
        gültig_monate: form.gültig_monate ? Number(form.gültig_monate) : null,
        pflicht: form.pflicht, aktiv: form.aktiv, inhalt: inhaltParsed,
      }).eq('id', mod.id);
      setMsg(error ? error.message : 'Gespeichert ✓');
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardContent className="p-6">
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Titel"><Input value={form.titel} onChange={e => setForm({ ...form, titel: e.target.value })} required /></Field>
              <Field label="Reihenfolge"><Input type="number" value={form.reihenfolge} onChange={e => setForm({ ...form, reihenfolge: e.target.value as any })} /></Field>
              <Field label="Kategorie"><Input value={form.kategorie} onChange={e => setForm({ ...form, kategorie: e.target.value })} /></Field>
              <Field label="Position (Typ)"><Input value={form.position_typ} onChange={e => setForm({ ...form, position_typ: e.target.value })} placeholder="barista" /></Field>
              <Field label="Dauer (Min.)"><Input type="number" value={form.dauer_minuten} onChange={e => setForm({ ...form, dauer_minuten: e.target.value as any })} /></Field>
              <Field label="Gültig (Monate)"><Input type="number" value={form.gültig_monate} onChange={e => setForm({ ...form, gültig_monate: e.target.value as any })} /></Field>
            </div>
            <Field label="Beschreibung (wird auf der Modul-Start-Karte angezeigt)">
              <Wysiwyg
                value={form.beschreibung || ''}
                onChange={html => setForm({ ...form, beschreibung: html })}
                placeholder="Worum geht es in diesem Modul?"
                minHeight={140}
              />
            </Field>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pflicht} onChange={e => setForm({ ...form, pflicht: e.target.checked })} /> Pflichtmodul</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.aktiv} onChange={e => setForm({ ...form, aktiv: e.target.checked })} /> Aktiv</label>
            </div>
            <Field label="Inhalt (JSON: lessons[] mit type=info|quiz)">
              <Textarea rows={14} value={form.inhalt} onChange={e => setForm({ ...form, inhalt: e.target.value })} />
              <LessonPreview json={form.inhalt} />
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending}>{pending ? 'Speichere...' : 'Speichern'}</Button>
              {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Fortschritt</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {progress.length === 0 && <p className="text-sm text-muted-foreground">Noch niemand hat angefangen.</p>}
          {progress.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{p.employee?.vorname} {p.employee?.nachname}</span>
              <span className={p.abgeschlossen ? 'text-matcha-700' : 'text-muted-foreground'}>
                {p.fortschritt_prozent}%{p.testergebnis ? ` · Test ${p.testergebnis}%` : ''}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function LessonPreview({ json }: { json: string }) {
  let lessons: any[] = [];
  let err: string | null = null;
  try {
    const parsed = JSON.parse(json);
    lessons = Array.isArray(parsed?.lessons) ? parsed.lessons : [];
  } catch (e: any) {
    err = e?.message ?? 'JSON ungültig';
  }

  if (err) return (
    <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
      JSON-Fehler: {err}
    </div>
  );
  if (lessons.length === 0) return (
    <div className="mt-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
      Noch keine Lektionen. Füge im JSON oben eine hinzu, z.B. <code className="bg-muted px-1 rounded">{'{"id":"l1","type":"info","title":"…","body":"…"}'}</code>
    </div>
  );

  const infoCount = lessons.filter(l => l.type === 'info').length;
  const quizCount = lessons.filter(l => l.type === 'quiz').length;
  const recipeCount = lessons.filter(l => l.type === 'recipe').length;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2 text-xs">
        <span className="rounded-full bg-matcha-100 text-matcha-800 px-2 py-0.5 font-semibold">{lessons.length} Lektionen</span>
        {infoCount > 0 && <span className="rounded-full bg-muted px-2 py-0.5">📖 {infoCount} Info</span>}
        {quizCount > 0 && <span className="rounded-full bg-gold-soft text-matcha-800 px-2 py-0.5 font-medium">🧠 {quizCount} Quiz</span>}
        {recipeCount > 0 && <span className="rounded-full bg-accent/20 text-matcha-800 px-2 py-0.5 font-medium">🍽 {recipeCount} Rezept</span>}
      </div>
      <ol className="space-y-1 text-xs text-muted-foreground">
        {lessons.map((l, i) => (
          <li key={l.id ?? i} className="flex gap-2">
            <span className="font-mono text-matcha-600">{i + 1}.</span>
            <span className="flex-1 truncate">
              <span className="mr-1">{l.type === 'quiz' ? '🧠' : l.type === 'recipe' ? '🍽' : '📖'}</span>
              {l.title ?? l.question ?? l.name ?? <em>(ohne Titel)</em>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
