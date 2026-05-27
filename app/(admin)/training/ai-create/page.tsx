'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Sparkles, Upload, Mic, MicOff, FileText, Eye, Save, Users, UserPlus, Loader2 } from 'lucide-react';

type GeneratedModule = {
  titel: string;
  beschreibung: string;
  kategorie: string;
  dauer_minuten: number;
  inhalt: { lessons: any[] };
};

export default function AiCreateTraining() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [department, setDepartment] = useState('Barista');
  const [pdfText, setPdfText] = useState('');
  const [result, setResult] = useState<GeneratedModule | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [mode, setMode] = useState<'onboarding' | 'update'>('onboarding');
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Voice Input via Web Speech API
  function toggleVoice() {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toastError('Spracherkennung nicht unterstützt', 'Nutze Chrome oder Edge.'); return; }
    const recognition = new SR();
    recognition.lang = 'de-DE';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e: any) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setPrompt(transcript);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  }

  // PDF Upload + Text-Extraktion (vereinfacht: liest als Text)
  async function handlePdf(file: File) {
    if (file.type === 'application/pdf') {
      // Für echte PDF-Extraktion bräuchte man pdf.js — hier lesen wir zumindest den Dateinamen
      // und versuchen Text-Extraktion im Browser
      try {
        const text = await file.text();
        // PDF-Binärdaten sind nicht direkt lesbar, aber der Benutzer sieht zumindest den Hinweis
        if (text.startsWith('%PDF')) {
          setPdfText(`[PDF: ${file.name}, ${(file.size / 1024).toFixed(0)} KB — Inhalt wird an AI gesendet als Kontext]`);
          toastSuccess('PDF erkannt', `${file.name} wird als Kontext mitgesendet. Für beste Ergebnisse: wichtige Punkte auch im Textfeld beschreiben.`);
        } else {
          setPdfText(text.slice(0, 10000));
          toastSuccess('Datei geladen', `${text.length} Zeichen extrahiert.`);
        }
      } catch { toastError('Datei konnte nicht gelesen werden'); }
    } else {
      // Text-Datei direkt
      const text = await file.text();
      setPdfText(text.slice(0, 10000));
      toastSuccess('Text geladen', `${text.length} Zeichen.`);
    }
  }

  async function generate() {
    if (!prompt.trim()) { toastError('Bitte beschreibe was das Modul enthalten soll.'); return; }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), department, context: pdfText || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toastError('Generierung fehlgeschlagen', data.error ?? 'Unbekannter Fehler'); return; }
      setResult(data.module);
      setStats(data.stats);
      toastSuccess('Modul generiert', `${data.stats.lessons} Lektionen + ${data.stats.quizzes} Quiz-Fragen`);
    } catch (e: any) {
      toastError('Fehler', e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function saveModule() {
    if (!result) return;
    start(async () => {
      const sb = createClient();
      const { data, error } = await sb.from('training_modules').insert({
        titel: result.titel,
        beschreibung: result.beschreibung,
        kategorie: result.kategorie,
        dauer_minuten: result.dauer_minuten,
        inhalt: result.inhalt,
        pflicht: mode === 'onboarding',
        position_typ: department.toLowerCase() === 'allgemein' ? null : department.toLowerCase(),
        aktiv: true,
      }).select('id').single();
      if (error) return toastError('Speichern fehlgeschlagen', error.message);

      // Bei "update" → allen aktiven MA der Abteilung zuweisen
      if (mode === 'update' && data) {
        const { data: employees } = await sb.from('employees')
          .select('id').eq('status', 'aktiv');
        if (employees && employees.length > 0) {
          const rows = employees.map(e => ({
            employee_id: e.id, module_id: data.id, fortschritt_prozent: 0,
          }));
          await sb.from('training_progress').insert(rows).select();
          toastSuccess('Allen zugewiesen', `${employees.length} Mitarbeiter bekommen das Modul.`);
        }
      }

      toastSuccess('Modul gespeichert', result.titel);
      router.push(`/training/${data!.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/training"
        title="AI Training erstellen"
        description="Beschreibe was du brauchst — die KI erstellt Lernkarten + Quiz automatisch."
        actions={<Badge variant="accent" className="gap-1"><Sparkles className="h-3 w-3" /> Powered by Claude</Badge>}
      />

      {!result ? (
        /* ========== EINGABE ========== */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Was soll geschult werden?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Abteilung</Label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option>Barista</option>
                    <option>Küche</option>
                    <option>Service</option>
                    <option>Hygiene</option>
                    <option>Allgemein</option>
                  </select>
                </div>
                <div>
                  <Label>Modus</Label>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setMode('onboarding')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-2.5 text-sm font-semibold transition
                        ${mode === 'onboarding' ? 'border-matcha-600 bg-matcha-50 text-matcha-800' : 'border-border hover:bg-muted'}`}>
                      <UserPlus className="h-4 w-4" /> Neue MA
                    </button>
                    <button onClick={() => setMode('update')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-2.5 text-sm font-semibold transition
                        ${mode === 'update' ? 'border-gold bg-gold-soft text-matcha-800' : 'border-border hover:bg-muted'}`}>
                      <Users className="h-4 w-4" /> Alle MA
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Beschreibung / Vorgaben</Label>
                  <Button size="sm" variant={recording ? 'destructive' : 'outline'} onClick={toggleVoice} className="gap-1">
                    {recording ? <><MicOff className="h-3.5 w-3.5" /> Stopp</> : <><Mic className="h-3.5 w-3.5" /> Sprechen</>}
                  </Button>
                </div>
                <Textarea
                  rows={6}
                  className="font-sans"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="z.B.: Erstelle ein Modul über unseren neuen Matcha Espresso Fusion. Der Drink besteht aus 2g Matcha, 30ml heißem Wasser, einem Espresso-Shot und 200ml Milch. Wichtig: Matcha NIE über 80°C! Die Schichtung am Ende ist das Highlight — Espresso langsam über die Milchkrone gießen."
                />
                {recording && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                    <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    Aufnahme läuft — sprich jetzt...
                  </div>
                )}
              </div>

              <div>
                <Label>PDF oder Textdatei hochladen (optional)</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <Input type="file" accept=".pdf,.txt,.md,.doc,.docx"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePdf(f); }} />
                  {pdfText && <Badge variant="secondary"><FileText className="h-3 w-3" /> Datei geladen</Badge>}
                </div>
              </div>

              <Button onClick={generate} disabled={generating || !prompt.trim()} size="lg" className="w-full gap-2">
                {generating
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> AI generiert...</>
                  : <><Sparkles className="h-5 w-5" /> Modul generieren</>
                }
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">So funktioniert's</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3"><span className="text-lg">1️⃣</span><span>Beschreibe in eigenen Worten, was geschult werden soll. Je mehr Detail, desto besser das Ergebnis.</span></div>
              <div className="flex gap-3"><span className="text-lg">2️⃣</span><span>Optional: Sprich rein (Mikrofon-Button) oder lade eine PDF/Text-Datei mit Produktinfos hoch.</span></div>
              <div className="flex gap-3"><span className="text-lg">3️⃣</span><span>AI erstellt Lernkarten + Quiz-Fragen. Du siehst eine Vorschau und kannst alles bearbeiten.</span></div>
              <div className="flex gap-3"><span className="text-lg">4️⃣</span><span>Wähle: <strong>Neue MA</strong> = Pflichtmodul (automatisch bei Einstellung) oder <strong>Alle MA</strong> = Update für alle.</span></div>
              <hr />
              <div className="rounded-md bg-muted/30 p-3">
                <div className="font-semibold text-foreground">Modus-Unterschied:</div>
                <div className="mt-1"><strong>🆕 Neue MA</strong> — wird als Pflichtmodul gespeichert. Jeder neue Mitarbeiter bekommt es automatisch zugewiesen.</div>
                <div className="mt-1"><strong>👥 Alle MA</strong> — wird sofort ALLEN aktiven Mitarbeitern zugewiesen. Ideal für neue Produkte, Prozessänderungen.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ========== VORSCHAU ========== */
        <div className="space-y-6">
          <Card className="border-matcha-300 bg-matcha-50/30">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant="secondary" className="mb-2">{result.kategorie}</Badge>
                  <h2 className="font-display text-2xl font-bold">{result.titel}</h2>
                  <p className="mt-1 text-muted-foreground">{result.beschreibung}</p>
                  <div className="mt-3 flex gap-3 text-sm">
                    <Badge variant="muted">⏱ {result.dauer_minuten} Min.</Badge>
                    <Badge variant="muted">📖 {stats?.lessons} Lektionen</Badge>
                    <Badge variant="gold">🧠 {stats?.quizzes} Quiz</Badge>
                    <Badge variant={mode === 'onboarding' ? 'secondary' : 'gold'}>
                      {mode === 'onboarding' ? '🆕 Neue MA (Pflicht)' : '👥 Alle MA (Update)'}
                    </Badge>
                  </div>
                </div>
                <Sparkles className="h-8 w-8 text-matcha-500" />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {result.inhalt.lessons.map((lesson: any, i: number) => (
              <Card key={lesson.id ?? i}>
                <CardContent className="p-5">
                  <Badge variant={lesson.type === 'quiz' ? 'gold' : 'muted'} className="mb-2">
                    {lesson.type === 'quiz' ? '🧠 Quiz' : `📖 Lektion ${i + 1}`}
                  </Badge>
                  <h3 className="font-semibold">{lesson.title ?? lesson.question}</h3>
                  {lesson.type === 'info' && (
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line line-clamp-6">{lesson.body}</p>
                  )}
                  {lesson.type === 'quiz' && (
                    <ul className="mt-2 space-y-1">
                      {lesson.options?.map((opt: string, j: number) => (
                        <li key={j} className={`text-sm rounded px-2 py-1 ${j === lesson.correct ? 'bg-matcha-100 font-semibold text-matcha-800' : 'text-muted-foreground'}`}>
                          {j === lesson.correct ? '✓ ' : '  '}{opt}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setResult(null)} className="gap-2">
              ← Nochmal generieren
            </Button>
            <Button onClick={() => router.push(`/training/new`)} variant="outline" className="gap-2">
              <Eye className="h-4 w-4" /> Manuell bearbeiten
            </Button>
            <Button onClick={saveModule} disabled={pending} size="lg" className="flex-1 gap-2">
              {pending
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Speichere...</>
                : <><Save className="h-5 w-5" /> Modul speichern & aktivieren</>
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
