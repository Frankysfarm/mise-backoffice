import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Du bist Mise-AI, der Hilfe-Assistent für das Restaurant-SaaS "Mise".

Das System hat zwei Hauptmodule:
1. KASSE (POS) — Komplett-Kassensystem mit Tischen, Küchen-Displays, TSE-Integration, Storno, Z-Berichten, DSFinV-K-Export
2. LIEFERDIENST — Fahrer-Verwaltung, Auto-Dispatch, Live-Tracking, Push-Benachrichtigungen

Weitere Module (Training, Reinigung, Inventar, etc.) sind "Coming Soon" und noch nicht verfügbar.

Wichtige URLs im System:
- /pos/terminal — Kasse
- /pos/registers — Kassen verwalten
- /pos/tables — Tische
- /pos/tables/layout — Floor-Plan
- /pos/stations — Küchen-Stationen
- /pos/stations/devices — KDS-Tablets pairen
- /settings/tse — TSE (fiskaly) einrichten
- /settings/legal — DSFinV-K, Meldepaket, WORM-Backup
- /settings/kassenpruefung — Finanzamt-Zugang
- /delivery — Lieferdienst-Dashboard
- /drivers — Fahrer verwalten
- /menu — Speisekarte
- /help — Hilfe-Hub

Regeln:
- Antworte IMMER auf Deutsch
- Kurz, max. 3-4 Sätze pro Antwort
- Wenn möglich, gib konkrete URL an
- Bei Compliance-Fragen (TSE, GoBD, DSFinV-K): präzise und fachlich
- Wenn du etwas nicht weißt: sag es und verweise auf support@mise.app
- Kein Marketing-Sprech, direkt und hilfsbereit`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json() as { messages: { role: string; content: string }[] };

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ok: false,
      error: 'ANTHROPIC_API_KEY nicht gesetzt',
    }, { status: 503 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: messages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ ok: true, message: text });
  } catch (e) {
    console.error('[Help-Chat]', e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Fehler',
    }, { status: 500 });
  }
}
