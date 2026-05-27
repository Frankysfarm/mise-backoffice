/**
 * KI-gestützte Menü-Extraktion.
 *
 * Drei Wege rein:
 *   - Foto: Claude Vision (analysiert Bild, extrahiert strukturiert)
 *   - Sprachnotiz: ElevenLabs Scribe (STT) → dann Text-Pfad
 *   - Text: Claude Text (parsed paste)
 *
 * Output ist immer dasselbe JSON-Format, sodass die UI nur eine
 * Preview-Komponente braucht.
 */

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';

export interface ExtractedItem {
  /** Kategorie-Vorschlag (Vorspeisen, Hauptspeisen, Pizza, Getränke, …) */
  kategorie: string;
  /** Item-Name (lowercase nicht erzwingen, schreiben wie auf Karte) */
  name: string;
  /** Optionaler Beschreibungstext */
  beschreibung: string | null;
  /** Preis in Euro (z. B. 9.50). Wenn nicht erkennbar: null */
  preis: number | null;
  /** Optional: Allergene/Tags die der Bot erkannt hat */
  allergene?: string[];
  /** Confidence des Bots (0-1) — UI kann unsichere Items rot markieren */
  confidence: number;
}

export interface ExtractionResult {
  items: ExtractedItem[];
  /** Wurde was gefunden, das wie ein Restaurant-Name aussieht? */
  detectedRestaurantName?: string;
  /** Frei-Notiz vom Bot, was er nicht zuordnen konnte */
  notes?: string;
  /** Welcher Mode wurde benutzt */
  source: 'photo' | 'voice' | 'text';
}

function getAnthropic(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY fehlt im .env — KI-Extraktion deaktiviert.');
  }
  return new Anthropic({ apiKey: key });
}

const SYSTEM = `Du bist ein Profi-Menü-Parser für deutschsprachige Restaurants.
Aus rohem Text, Bild oder Audio extrahierst du saubere Speisekarten-Einträge.

# Regeln
- Output: JSON mit Schema { items: [{kategorie, name, beschreibung, preis, allergene?, confidence}], detectedRestaurantName?, notes? }
- Preis als reine Zahl (z. B. 9.50), niemals "9,50 €"
- Beschreibung: kurz, max 1 Satz. Wenn keine: null
- Kategorie: Sammelbegriff aus dem Original (Vorspeisen, Pizza, Getränke, Burger, Desserts, Bowls …)
- Confidence: 0.95 wenn Preis & Name eindeutig, 0.7 wenn was geraten, 0.5 wenn unsicher
- Sprachnotizen / OCR-Fehler: korrigiere offensichtliche Tippfehler still
- Doppelte Items: dedupe
- Nicht-Speisen (Adresse, Öffnungszeiten, Werbung): ignorieren

# Antwort-Format
Antworte AUSSCHLIESSLICH mit gültigem JSON, kein Markdown, kein Preamble.`;

// ─── Photo (Vision) ─────────────────────────────────

export async function extractFromPhoto(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
): Promise<ExtractionResult> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extrahiere alle Speisen/Getränke aus diesem Menü-Foto als JSON.',
          },
        ],
      },
    ],
  });

  const text = res.content.find((b) => b.type === 'text')?.text ?? '{}';
  return parseExtraction(text, 'photo');
}

// ─── Text (Paste) ───────────────────────────────────

export async function extractFromText(text: string): Promise<ExtractionResult> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Extrahiere alle Speisen/Getränke aus diesem Text als JSON:\n\n${text.slice(0, 20000)}`,
      },
    ],
  });

  const t = res.content.find((b) => b.type === 'text')?.text ?? '{}';
  return parseExtraction(t, 'text');
}

// ─── Voice (STT via ElevenLabs Scribe → Text) ───────

export async function transcribeAudio(
  audioBlob: Buffer,
  filename = 'recording.webm',
): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY fehlt');

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audioBlob)]), filename);
  form.append('model_id', 'scribe_v1');
  form.append('language_code', 'deu');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs STT ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { text: string };
  return json.text;
}

export async function extractFromVoice(audioBlob: Buffer): Promise<ExtractionResult> {
  const transcript = await transcribeAudio(audioBlob);
  const result = await extractFromText(transcript);
  return { ...result, source: 'voice', notes: result.notes ?? `Transkript: ${transcript.slice(0, 200)}` };
}

// ─── Parser-Helper ──────────────────────────────────

function parseExtraction(raw: string, source: 'photo' | 'voice' | 'text'): ExtractionResult {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  }
  // Versuche JSON zu finden (manchmal liefern Modelle Vorgeplänkel)
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace > 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let parsed: any = { items: [] };
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      items: [],
      source,
      notes: `JSON-Parse-Fehler. Roh: ${raw.slice(0, 300)}`,
    };
  }

  const items: ExtractedItem[] = Array.isArray(parsed.items)
    ? parsed.items.map((it: any) => ({
        kategorie: String(it.kategorie ?? 'Sonstiges').slice(0, 80),
        name: String(it.name ?? '').slice(0, 120),
        beschreibung: it.beschreibung ? String(it.beschreibung).slice(0, 400) : null,
        preis: typeof it.preis === 'number' && !isNaN(it.preis) ? Math.round(it.preis * 100) / 100 : null,
        allergene: Array.isArray(it.allergene) ? it.allergene.slice(0, 20).map(String) : undefined,
        confidence: typeof it.confidence === 'number' ? Math.min(1, Math.max(0, it.confidence)) : 0.7,
      }))
    : [];

  return {
    items: items.filter((i) => i.name.length > 0),
    detectedRestaurantName: parsed.detectedRestaurantName ?? undefined,
    notes: parsed.notes ?? undefined,
    source,
  };
}
