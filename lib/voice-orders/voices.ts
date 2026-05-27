/**
 * Voice-Profile für die KI-Telefonie. Jedes Profil bündelt eine
 * vorausgewählte ElevenLabs Voice + Beschreibung + Preview-Sample.
 */

export interface VoiceProfile {
  /** Slug für die UI */
  slug: string;
  /** Anzeigename */
  name: string;
  /** ElevenLabs Voice-ID (echte ID aus https://elevenlabs.io/voice-library) */
  voiceId: string;
  /** Charakter-Beschreibung */
  description: string;
  /** Geschlecht (für UI-Filter) */
  gender: 'female' | 'male';
  /** Beispiel-Akzent / Sprach-Hinweis */
  accent: string;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    slug: 'sophia',
    name: 'Sophia',
    voiceId: 'XrExE9yKIg1WjnnlVkGX',
    description: 'Warm, freundlich, professionell. Perfekt fürs Restaurant.',
    gender: 'female',
    accent: 'Hochdeutsch',
  },
  {
    slug: 'lukas',
    name: 'Lukas',
    voiceId: 'TxGEqnHWrfWFTfGW9XjX',
    description: 'Ruhig, kompetent, gut verständlich.',
    gender: 'male',
    accent: 'Hochdeutsch',
  },
  {
    slug: 'emma',
    name: 'Emma',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    description: 'Jung, energisch, sympathisch. Für moderne Konzepte.',
    gender: 'female',
    accent: 'Hochdeutsch',
  },
  {
    slug: 'marco',
    name: 'Marco',
    voiceId: 'pNInz6obpgDQGcFmaJgB',
    description: 'Tief, vertrauenerweckend. Für klassische Restaurants.',
    gender: 'male',
    accent: 'Hochdeutsch',
  },
];

export function getVoiceProfile(slug: string): VoiceProfile | undefined {
  return VOICE_PROFILES.find((v) => v.slug === slug);
}

export function getVoiceProfileById(voiceId: string): VoiceProfile | undefined {
  return VOICE_PROFILES.find((v) => v.voiceId === voiceId);
}

export const DEFAULT_VOICE = VOICE_PROFILES[0];

// ── Greeting-Templates ───────────────────────────────────────

export const GREETING_TEMPLATES = {
  classic: (name: string) =>
    `${name}, guten Tag! Sie sprechen mit Ihrem digitalen Bestellassistenten. Was darf ich für Sie aufnehmen?`,
  casual: (name: string) =>
    `Hi, hier ${name}! Was möchten Sie heute bei uns bestellen?`,
  formal: (name: string) =>
    `Sehr geehrte Dame, sehr geehrter Herr, willkommen bei ${name}. Wie kann ich Ihnen helfen?`,
} as const;

export type GreetingStyle = keyof typeof GREETING_TEMPLATES;

// ── System-Prompt-Builder ────────────────────────────────────

export interface MenuItem {
  name: string;
  preis: number;
  beschreibung?: string | null;
  kategorie?: string | null;
}

export interface BuildPromptInput {
  restaurantName: string;
  menuItems: MenuItem[];
  oeffnungszeitenText?: string;
  liefergebiet?: string;
  mindestbestellwert?: number;
  liefergebuehr?: number;
}

export function buildSystemPrompt(input: BuildPromptInput): string {
  const menuText = input.menuItems
    .slice(0, 80)
    .map((m) => {
      const cat = m.kategorie ? `[${m.kategorie}] ` : '';
      const desc = m.beschreibung ? ` — ${m.beschreibung}` : '';
      return `- ${cat}${m.name}: ${m.preis.toFixed(2)} EUR${desc}`;
    })
    .join('\n');

  const lieferInfo: string[] = [];
  if (input.liefergebiet) lieferInfo.push(`Liefergebiet: ${input.liefergebiet}`);
  if (input.mindestbestellwert)
    lieferInfo.push(`Mindestbestellwert: ${input.mindestbestellwert.toFixed(2)} EUR`);
  if (input.liefergebuehr)
    lieferInfo.push(`Liefergebühr: ${input.liefergebuehr.toFixed(2)} EUR`);

  return `Du bist der KI-Bestellassistent für **${input.restaurantName}**.

# Deine Aufgabe
Höflich und effizient Telefonbestellungen entgegennehmen — wie ein erfahrener Kellner.

# Speisekarte
${menuText}

# Liefer-Infos
${lieferInfo.length > 0 ? lieferInfo.join('\n') : 'Bitte beim Anrufer erfragen.'}

${input.oeffnungszeitenText ? `# Öffnungszeiten\n${input.oeffnungszeitenText}\n` : ''}

# Regeln
- Sprich Deutsch.
- Bestätige jede Position freundlich, dann frage „Sonst noch was?".
- Erfasse am Ende: Name, Telefonnummer, Lieferadresse, Bezahlart.
- Wiederhole die komplette Bestellung zum Schluss zur Bestätigung.
- Bei Unklarheiten: nachfragen, niemals raten.
- Nicht-Speisekarten-Items: höflich ablehnen.
- Bei Beschwerden/Sonderwünschen: an Kollegen weiterleiten („Einen Moment, ich verbinde Sie.").
- Du nutzt Sie-Form, außer der Kunde duzt zuerst.
- Rede natürlich, keine Roboter-Floskeln.`;
}
