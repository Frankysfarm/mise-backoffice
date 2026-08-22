import { NextResponse, type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireManagerPlus } from '@/lib/auth/requireRole';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

const SYSTEM_PROMPT = `Du bist ein Experte für Gastronomie-Schulungen. Du erstellst professionelle Trainingsmodule für Restaurant-Mitarbeiter.

AUSGABE-FORMAT — STRIKT JSON, keine Erklärung drum herum:
{
  "titel": "Modulname",
  "beschreibung": "Kurze Beschreibung für die Modul-Karte",
  "kategorie": "Barista|Küche|Service|Hygiene|Allgemein",
  "dauer_minuten": 15,
  "lessons": [
    {
      "id": "l1",
      "type": "info",
      "title": "Lektions-Titel",
      "body": "Ausführlicher Lerntext. Kann mehrere Absätze haben.\\n\\nMit Aufzählungen:\\n• Punkt 1\\n• Punkt 2"
    },
    {
      "id": "q1",
      "type": "quiz",
      "question": "Frage an den Mitarbeiter?",
      "options": ["Antwort A", "Antwort B", "Antwort C", "Antwort D"],
      "correct": 0,
      "explanation": "Richtig ist A weil..."
    }
  ]
}

REGELN:
- Jede Info-Lektion: 100-300 Wörter, praxisnah, mit konkreten Beispielen
- Nach 2-3 Info-Lektionen: 1 Quiz mit 4 Optionen
- Quiz-Erklärungen immer ausfüllen
- Sprache: Du-Form, freundlich aber professionell
- Gastronomie-Kontext: HACCP, Hygiene, Kundenkontakt, Arbeitsabläufe
- IDs müssen eindeutig sein (l1, l2, q1, q2 etc.)
- Mindestens 3 Info-Lektionen + 2 Quiz-Fragen
- Maximal 8 Lektionen + 4 Quiz pro Modul`;

export async function POST(req: NextRequest) {
  await requireManagerPlus();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert. In .env.local setzen.' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.prompt) {
    return NextResponse.json({ error: 'prompt ist erforderlich' }, { status: 400 });
  }

  const { prompt, department, context } = body as {
    prompt: string;
    department?: string;
    context?: string; // z.B. PDF-Text
  };

  const userMessage = [
    `Erstelle ein Trainingsmodul für die Abteilung "${department ?? 'Allgemein'}".`,
    '',
    'ANFORDERUNG DES FILIALLEITERS:',
    prompt,
    context ? `\nZUSÄTZLICHER KONTEXT (z.B. aus hochgeladener PDF):\n${context}` : '',
    '',
    'Erstelle das Modul als JSON. Nur das JSON, nichts anderes.',
  ].join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    // JSON extrahieren (Claude gibt manchmal ```json ... ``` drum herum)
    let json: any;
    try {
      const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      json = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'AI hat kein gültiges JSON erzeugt', raw: text }, { status: 422 });
    }

    // Validierung
    if (!json.titel || !Array.isArray(json.lessons) || json.lessons.length === 0) {
      return NextResponse.json({ error: 'Unvollständiges Modul', data: json }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      module: {
        titel: json.titel,
        beschreibung: json.beschreibung ?? '',
        kategorie: json.kategorie ?? department ?? 'Allgemein',
        dauer_minuten: json.dauer_minuten ?? Math.ceil(json.lessons.length * 2.5),
        inhalt: { lessons: json.lessons },
      },
      stats: {
        lessons: json.lessons.filter((l: any) => l.type === 'info').length,
        quizzes: json.lessons.filter((l: any) => l.type === 'quiz').length,
        tokens: response.usage,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `AI-Fehler: ${e?.message ?? 'unbekannt'}` }, { status: 500 });
  }
}
