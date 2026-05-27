'use client';

import * as React from 'react';
import { use } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepData = Record<string, string | number | null>;

const STEPS = [
  { id: 'persoenlich', title: 'Du', icon: '👋' },
  { id: 'kontakt',     title: 'Kontakt', icon: '📱' },
  { id: 'steuer',      title: 'Steuer & Bank', icon: '💳' },
  { id: 'arbeit',      title: 'Arbeit', icon: '🍵' },
  { id: 'fertig',      title: 'Abschicken', icon: '🎉' },
];

export default function RegisterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const [employee, setEmployee] = React.useState<{ vorname: string; nachname: string; email: string } | null>(null);
  const [data, setData] = React.useState<StepData>({});
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const res = await fetch(`/api/register/${token}`);
      if (!res.ok) { setError(res.status === 404 ? 'Einladung ungültig oder abgelaufen.' : 'Fehler beim Laden.'); setLoaded(true); return; }
      const d = await res.json();
      setEmployee(d.employee);
      if (d.progress) {
        setStep(d.progress.step ?? 0);
        setData(d.progress.daten ?? {});
        if (d.progress.abgeschlossen) setDone(true);
      }
      setLoaded(true);
    })();
  }, [token]);

  function upd<K extends keyof StepData>(k: K, v: StepData[K]) {
    setData(s => ({ ...s, [k]: v }));
  }

  async function saveStep(nextStep: number) {
    setSaving(true);
    await fetch(`/api/register/${token}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: nextStep, daten: data }),
    });
    setSaving(false);
    setStep(nextStep);
  }

  async function submit() {
    setSubmitting(true);
    await fetch(`/api/register/${token}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: STEPS.length - 1, daten: data }),
    });
    const res = await fetch(`/api/register/${token}/submit`, { method: 'POST' });
    setSubmitting(false);
    if (res.ok) setDone(true);
    else {
      const e = await res.json().catch(() => null);
      setError(e?.error ?? 'Abschicken fehlgeschlagen');
    }
  }

  if (!loaded) {
    return <Centered><Loader2 className="h-6 w-6 animate-spin text-matcha-700" /></Centered>;
  }
  if (error && !employee) {
    return <Centered>
      <Card className="max-w-md"><CardHeader>
        <CardTitle>Ups.</CardTitle>
        <CardDescription>{error}</CardDescription>
      </CardHeader></Card>
    </Centered>;
  }
  if (done) {
    return <Centered>
      <Card className="max-w-lg"><CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-matcha-100">
          <CheckCircle2 className="h-10 w-10 text-matcha-700" />
        </div>
        <CardTitle className="text-2xl">Geschafft, {employee!.vorname}! 🎉</CardTitle>
        <CardDescription className="mt-2 text-base">
          Deine Bewerbung ist eingereicht. Der Filialleiter meldet sich bei dir —
          meistens innerhalb von 1–2 Werktagen. Anschließend bekommst du eine Einladungs-Mail
          für die Mitarbeiter-App und die ersten Schulungen.
        </CardDescription>
      </CardHeader></Card>
    </Centered>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-matcha-100 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6 text-center">
          <div className="text-3xl">🍵</div>
          <h1 className="mt-2 font-display text-2xl font-bold">Bewerbung — Matcha Kaffee</h1>
          <p className="text-sm text-muted-foreground">Hi {employee!.vorname}! Dauert 5 Minuten.</p>
        </div>

        <Progress current={step} total={STEPS.length} />

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">{STEPS[step].icon}</span>
              {STEPS[step].title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === 0 && <StepPersoenlich data={data} upd={upd} employee={employee!} />}
            {step === 1 && <StepKontakt data={data} upd={upd} employee={employee!} />}
            {step === 2 && <StepSteuer data={data} upd={upd} />}
            {step === 3 && <StepArbeit data={data} upd={upd} />}
            {step === 4 && <StepFertig data={data} employee={employee!} />}
          </CardContent>
        </Card>

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" disabled={step === 0 || saving || submitting}
            onClick={() => saveStep(step - 1)}>
            <ChevronLeft className="h-4 w-4" /> Zurück
          </Button>
          <div className="text-xs text-muted-foreground">
            {saving ? <><Save className="mr-1 inline h-3 w-3 animate-pulse" /> Gespeichert</> : 'Auto-Save aktiv'}
          </div>
          {step < STEPS.length - 1 ? (
            <Button disabled={saving} onClick={() => saveStep(step + 1)}>
              Weiter <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={submitting} onClick={submit}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Schicke ab…</> : 'Abschicken'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-surface to-matcha-100">{children}</div>;
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn(
          'h-2 flex-1 rounded-full transition',
          i < current ? 'bg-matcha-700' : i === current ? 'bg-matcha-500' : 'bg-muted',
        )} />
      ))}
    </div>
  );
}

/* === Steps === */

function StepPersoenlich({ data, upd, employee }: any) {
  return (
    <div className="space-y-3">
      <Field label="Vorname"><Input defaultValue={employee.vorname} disabled /></Field>
      <Field label="Nachname"><Input defaultValue={employee.nachname} disabled /></Field>
      <Field label="Geburtsdatum"><Input type="date" value={data.geburtsdatum ?? ''} onChange={e => upd('geburtsdatum', e.target.value)} required /></Field>
      <p className="text-xs text-muted-foreground">Dein Name wurde vom Filialleiter vorausgefüllt.</p>
    </div>
  );
}

function StepKontakt({ data, upd, employee }: any) {
  return (
    <div className="space-y-3">
      <Field label="E-Mail"><Input value={employee.email} disabled /></Field>
      <Field label="Telefon"><Input type="tel" placeholder="+49 151 ..." value={data.telefon ?? ''} onChange={e => upd('telefon', e.target.value)} /></Field>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Straße & Hausnummer"><Input value={data.adresse_strasse ?? ''} onChange={e => upd('adresse_strasse', e.target.value)} /></Field>
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="PLZ"><Input value={data.adresse_plz ?? ''} onChange={e => upd('adresse_plz', e.target.value)} /></Field>
          <Field label="Stadt"><Input value={data.adresse_stadt ?? ''} onChange={e => upd('adresse_stadt', e.target.value)} /></Field>
        </div>
      </div>
    </div>
  );
}

function StepSteuer({ data, upd }: any) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Brauchen wir für deinen Arbeitsvertrag und die Lohnabrechnung.</p>
      <Field label="Steuer-Identifikationsnummer (11-stellig)"><Input value={data.steuer_id ?? ''} onChange={e => upd('steuer_id', e.target.value)} maxLength={11} placeholder="12345678901" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sozialvers.-Nr."><Input value={data.sv_nummer ?? ''} onChange={e => upd('sv_nummer', e.target.value)} /></Field>
        <Field label="Krankenkasse"><Input value={data.krankenkasse ?? ''} onChange={e => upd('krankenkasse', e.target.value)} placeholder="TK, AOK, …" /></Field>
      </div>
      <Field label="IBAN"><Input value={data.iban ?? ''} onChange={e => upd('iban', e.target.value)} placeholder="DE…" /></Field>
    </div>
  );
}

function StepArbeit({ data, upd }: any) {
  const positions = [
    { value: 'barista', label: '☕ Barista' },
    { value: 'koch',    label: '🍳 Küche' },
    { value: 'service', label: '🪑 Service' },
    { value: 'sonstiges', label: '⚙️ Sonstiges' },
  ];
  const types = [
    { value: 'minijob',    label: 'Minijob' },
    { value: 'teilzeit',   label: 'Teilzeit' },
    { value: 'vollzeit',   label: 'Vollzeit' },
    { value: 'werkstudent', label: 'Werkstudent' },
  ];
  return (
    <div className="space-y-4">
      <div>
        <Label>Wo willst du arbeiten?</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {positions.map(p => (
            <button key={p.value} type="button"
              onClick={() => upd('position_typ', p.value)}
              className={cn(
                'rounded-xl border p-4 text-left text-base font-medium transition',
                data.position_typ === p.value ? 'border-matcha-700 bg-matcha-50 text-matcha-800' : 'hover:bg-muted',
              )}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Anstellungsart</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {types.map(t => (
            <button key={t.value} type="button"
              onClick={() => upd('employment_type', t.value)}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm font-medium transition',
                data.employment_type === t.value ? 'border-matcha-700 bg-matcha-50 text-matcha-800' : 'hover:bg-muted',
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Wochenstunden (gewünscht)"><Input type="number" min={1} max={50} value={data.wochenstunden ?? ''} onChange={e => upd('wochenstunden', Number(e.target.value))} /></Field>
    </div>
  );
}

function StepFertig({ data, employee }: any) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        <strong>Fast geschafft, {employee.vorname}.</strong> Prüf kurz:
      </p>
      <div className="space-y-1 rounded-lg bg-muted/40 p-4 text-xs">
        <Row l="Name" v={`${employee.vorname} ${employee.nachname}`} />
        <Row l="Geburtstag" v={data.geburtsdatum} />
        <Row l="Telefon" v={data.telefon} />
        <Row l="Adresse" v={[data.adresse_strasse, data.adresse_plz, data.adresse_stadt].filter(Boolean).join(', ')} />
        <Row l="Steuer-ID" v={data.steuer_id} />
        <Row l="Position" v={data.position_typ} />
        <Row l="Typ" v={data.employment_type} />
        <Row l="Std./Woche" v={data.wochenstunden} />
      </div>
      <p className="text-muted-foreground">Nach dem Abschicken prüft der Filialleiter deine Daten und weist dich einer Abteilung zu. Du bekommst dann eine App-Einladung und startest mit den Schulungen.</p>
    </div>
  );
}

function Row({ l, v }: { l: string; v: any }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v || '—'}</span></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
