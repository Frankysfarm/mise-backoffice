// Offline-Outbox: wichtige Aktionen werden in localStorage gepuffert
// und beim nächsten Online-Moment zuverlässig gesendet.
'use client';

type OutboxEntry = { id: string; url: string; method: string; body: string; ts: number; tries: number; };
const KEY = 'mise_driver_outbox';
const MAX = 50;

export function enqueueOutbox(url: string, method: string, body: unknown): string {
  const id = Math.random().toString(36).slice(2);
  const entries: OutboxEntry[] = getQueue();
  entries.push({ id, url, method, body: JSON.stringify(body), ts: Date.now(), tries: 0 });
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);
  localStorage.setItem(KEY, JSON.stringify(entries));
  return id;
}

export function getQueue(): OutboxEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export async function flushOutbox(getToken: () => Promise<string | null>): Promise<number> {
  const entries = getQueue();
  if (!entries.length) return 0;
  const token = await getToken();
  const remaining: OutboxEntry[] = [];
  let flushed = 0;
  for (const e of entries) {
    try {
      const res = await fetch(e.url, {
        method: e.method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: e.body,
      });
      if (res.ok) { flushed++; continue; }
    } catch {}
    e.tries++;
    if (e.tries < 5) remaining.push(e);
  }
  localStorage.setItem(KEY, JSON.stringify(remaining));
  return flushed;
}
