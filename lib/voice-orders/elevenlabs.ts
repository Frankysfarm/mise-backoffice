/**
 * ElevenLabs Conversational AI HTTP-Client.
 *
 * Liest API-Key aus `process.env.ELEVENLABS_API_KEY`. Wir nutzen
 * `fetch` direkt statt SDK weil wir nur 5 Endpunkte brauchen.
 */

const BASE = 'https://api.elevenlabs.io/v1';

function apiKey(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('ELEVENLABS_API_KEY nicht gesetzt');
  return k;
}

export function isConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

// ── Agents ────────────────────────────────────────────────────

export interface CreateAgentInput {
  name: string;
  voiceId: string;
  firstMessage: string;
  systemPrompt: string;
  language?: string;
}

export interface AgentResponse {
  agent_id: string;
  name: string;
}

export async function createAgent(input: CreateAgentInput): Promise<AgentResponse> {
  const body = {
    name: input.name,
    conversation_config: {
      agent: {
        prompt: { prompt: input.systemPrompt },
        first_message: input.firstMessage,
        language: input.language ?? 'de',
      },
      tts: { voice_id: input.voiceId },
    },
  };
  const res = await fetch(`${BASE}/convai/agents/create`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createAgent ${res.status}: ${await res.text()}`);
  return (await res.json()) as AgentResponse;
}

export async function updateAgent(
  agentId: string,
  patch: Partial<CreateAgentInput>,
): Promise<AgentResponse> {
  const config: Record<string, unknown> = {};
  const agentBlock: Record<string, unknown> = {};
  if (patch.systemPrompt) agentBlock.prompt = { prompt: patch.systemPrompt };
  if (patch.firstMessage) agentBlock.first_message = patch.firstMessage;
  if (patch.language) agentBlock.language = patch.language;
  if (Object.keys(agentBlock).length > 0) config.agent = agentBlock;
  if (patch.voiceId) config.tts = { voice_id: patch.voiceId };

  const res = await fetch(`${BASE}/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_config: config }),
  });
  if (!res.ok) throw new Error(`updateAgent ${res.status}: ${await res.text()}`);
  return (await res.json()) as AgentResponse;
}

export async function deleteAgent(agentId: string): Promise<void> {
  const res = await fetch(`${BASE}/convai/agents/${agentId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey() },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteAgent ${res.status}: ${await res.text()}`);
  }
}

// ── Phone Numbers (Twilio) ────────────────────────────────────

export interface CreateTwilioPhoneInput {
  label: string;
  phoneNumber: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
}

export interface PhoneNumberResponse {
  phone_number_id: string;
  phone_number: string;
  agent_id: string | null;
}

export async function createTwilioPhoneNumber(
  input: CreateTwilioPhoneInput,
): Promise<PhoneNumberResponse> {
  const res = await fetch(`${BASE}/convai/phone-numbers/create`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: input.label,
      phone_number: input.phoneNumber,
      sid: input.twilioAccountSid,
      token: input.twilioAuthToken,
    }),
  });
  if (!res.ok) throw new Error(`createTwilioPhone ${res.status}: ${await res.text()}`);
  return (await res.json()) as PhoneNumberResponse;
}

export async function assignPhoneNumberToAgent(
  phoneNumberId: string,
  agentId: string,
): Promise<PhoneNumberResponse> {
  const res = await fetch(`${BASE}/convai/phone-numbers/${phoneNumberId}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId }),
  });
  if (!res.ok) throw new Error(`assignPhone ${res.status}: ${await res.text()}`);
  return (await res.json()) as PhoneNumberResponse;
}

export async function deletePhoneNumber(phoneNumberId: string): Promise<void> {
  const res = await fetch(`${BASE}/convai/phone-numbers/${phoneNumberId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey() },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deletePhone ${res.status}: ${await res.text()}`);
  }
}

export async function getSignedUrl(agentId: string): Promise<string> {
  const res = await fetch(
    `${BASE}/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { 'xi-api-key': apiKey() } },
  );
  if (!res.ok) throw new Error(`signedUrl ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { signed_url: string };
  return data.signed_url;
}

// ── Conversations (für Recording + Transcript abrufen) ────────

export interface ConversationDetail {
  conversation_id: string;
  agent_id: string;
  status: string;
  transcript?: Array<{ role: 'agent' | 'user'; message: string }>;
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    cost?: number;
  };
}

export async function getConversation(conversationId: string): Promise<ConversationDetail> {
  const res = await fetch(
    `${BASE}/convai/conversations/${encodeURIComponent(conversationId)}`,
    { headers: { 'xi-api-key': apiKey() } },
  );
  if (!res.ok) throw new Error(`getConversation ${res.status}: ${await res.text()}`);
  return (await res.json()) as ConversationDetail;
}

export async function getConversationAudioUrl(
  conversationId: string,
): Promise<string | null> {
  const res = await fetch(
    `${BASE}/convai/conversations/${encodeURIComponent(conversationId)}/audio`,
    { headers: { 'xi-api-key': apiKey() } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { audio_url?: string };
  return data.audio_url ?? null;
}
