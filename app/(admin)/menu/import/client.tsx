'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera, Mic, FileText, Loader2, Check, X, AlertCircle, Sparkles,
  ImagePlus, Square, Upload, Trash2, ArrowRight, Edit3, Table2, Download,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn, euro } from '@/lib/utils';

interface ExtractedItem {
  kategorie: string;
  name: string;
  beschreibung: string | null;
  preis: number | null;
  allergene?: string[];
  confidence: number;
}

interface ExtractionResult {
  items: ExtractedItem[];
  detectedRestaurantName?: string;
  notes?: string;
  source: string;
}

type Mode = 'photo' | 'voice' | 'text' | 'csv';

/**
 * Parsed CSV row → unsere ExtractedItem-Form.
 * Erlaubte Spalten (case-insensitive, deutsch oder englisch):
 *   kategorie | category   (Pflicht — fehlende Items kommen in „Sonstiges")
 *   name      | titel      (Pflicht)
 *   beschreibung | description
 *   preis     | price      (Pflicht — akzeptiert „4,80" oder „4.80" oder „4,80 €")
 *   allergene | allergens  (kommasepariert: „Milch,Gluten")
 *
 * Delimiter: ; oder , (auto-detect anhand der Header-Zeile).
 * UTF-8 mit oder ohne BOM.
 */
function parseCsv(text: string): { items: ExtractedItem[]; warnings: string[] } {
  const warnings: string[] = [];
  // BOM weg
  let src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!src) return { items: [], warnings: ['CSV ist leer.'] };

  const lines: string[][] = [];
  // Detect delimiter aus Header-Zeile
  const firstLine = src.split('\n')[0];
  const delim = firstLine.includes(';') ? ';' : ',';

  // RFC4180-light Parser (handle quoted fields with embedded delimiters/newlines)
  let i = 0, field = '', row: string[] = [], inQuotes = false;
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { inQuotes = true; i++; continue; }
    if (c === delim) { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); lines.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); lines.push(row); }

  if (lines.length < 2) {
    return { items: [], warnings: ['CSV hat nur eine Zeile — Header fehlt oder keine Daten.'] };
  }

  const header = lines[0].map((h) => h.trim().toLowerCase());
  const idx = {
    kategorie: header.findIndex((h) => h === 'kategorie' || h === 'category'),
    name:      header.findIndex((h) => h === 'name' || h === 'titel' || h === 'title'),
    beschreibung: header.findIndex((h) => h === 'beschreibung' || h === 'description'),
    preis:     header.findIndex((h) => h === 'preis' || h === 'price'),
    allergene: header.findIndex((h) => h === 'allergene' || h === 'allergens'),
  };
  if (idx.name < 0) warnings.push('Spalte „name" nicht gefunden — bitte Header prüfen.');
  if (idx.preis < 0) warnings.push('Spalte „preis" nicht gefunden — bitte Header prüfen.');
  if (warnings.length > 0) return { items: [], warnings };

  const items: ExtractedItem[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r];
    if (cols.every((c) => c.trim() === '')) continue; // Leerzeile
    const name = (cols[idx.name] ?? '').trim();
    const priceStr = (cols[idx.preis] ?? '').trim();
    if (!name) { warnings.push(`Zeile ${r + 1}: kein Name — übersprungen.`); continue; }
    const cleanedPrice = priceStr.replace(/[€\s]/g, '').replace(',', '.');
    const preis = cleanedPrice === '' ? null : Number(cleanedPrice);
    if (preis === null || Number.isNaN(preis)) {
      warnings.push(`Zeile ${r + 1} („${name}"): Preis „${priceStr}" nicht lesbar — übersprungen.`);
      continue;
    }
    const allergeneRaw = idx.allergene >= 0 ? (cols[idx.allergene] ?? '').trim() : '';
    const allergene = allergeneRaw
      ? allergeneRaw.split(',').map((a) => a.trim()).filter(Boolean)
      : undefined;
    items.push({
      kategorie: (idx.kategorie >= 0 ? cols[idx.kategorie] : '').trim() || 'Sonstiges',
      name,
      beschreibung: idx.beschreibung >= 0 ? ((cols[idx.beschreibung] ?? '').trim() || null) : null,
      preis,
      allergene,
      confidence: 1, // CSV ist deterministisch
    });
  }

  if (items.length === 0 && warnings.length === 0) {
    warnings.push('Keine Items gefunden.');
  }
  return { items, warnings };
}

export function MenuImportClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('photo');
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Voice state
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Text state
  const [text, setText] = useState('');

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [csvWarnings, setCsvWarnings] = useState<string[]>([]);

  function handleCsv(file: File | null) {
    setCsvFile(file);
    setCsvWarnings([]);
    if (!file) { setCsvText(''); return; }
    const reader = new FileReader();
    reader.onload = (e) => setCsvText(String(e.target?.result ?? ''));
    reader.onerror = () => setError('CSV-Datei konnte nicht gelesen werden.');
    reader.readAsText(file, 'utf-8');
  }

  function handlePhoto(file: File | null) {
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
    else setPhotoPreview(null);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setRecording(true);
    } catch {
      setError('Mikrofon-Zugriff verweigert.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function clearVoice() {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  }

  async function runExtraction() {
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      // CSV läuft komplett clientseitig — kein KI-Call nötig.
      if (mode === 'csv') {
        if (!csvText) {
          setError('Bitte eine CSV-Datei auswählen.');
          setBusy(false);
          return;
        }
        const parsed = parseCsv(csvText);
        setCsvWarnings(parsed.warnings);
        if (parsed.items.length === 0) {
          setError(parsed.warnings[0] ?? 'CSV hat keine validen Zeilen.');
          setBusy(false);
          return;
        }
        setResult({ items: parsed.items, source: 'csv' });
        setSelected(new Set(parsed.items.map((_, i) => i)));
        setBusy(false);
        return;
      }

      const form = new FormData();
      form.append('mode', mode);
      if (mode === 'photo') {
        if (!photoFile) {
          setError('Bitte ein Foto auswählen.');
          setBusy(false);
          return;
        }
        form.append('file', photoFile);
      } else if (mode === 'voice') {
        if (!audioBlob) {
          setError('Bitte eine Sprachnotiz aufnehmen.');
          setBusy(false);
          return;
        }
        form.append('file', audioBlob, 'recording.webm');
      } else {
        if (text.trim().length < 10) {
          setError('Bitte mindestens 10 Zeichen eingeben.');
          setBusy(false);
          return;
        }
        form.append('text', text);
      }
      const res = await fetch('/api/menu/import', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ?? json.error ?? 'KI konnte nichts extrahieren.');
        setBusy(false);
        return;
      }
      setResult(json);
      // Standard: alle Items selektiert die Preis haben
      const initial = new Set<number>();
      (json.items as ExtractedItem[]).forEach((it: ExtractedItem, i: number) => {
        if (it.preis != null) initial.add(i);
      });
      setSelected(initial);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!result) return;
    setCommitting(true);
    setError(null);
    const items = (result.items ?? []).filter((_, i) => selected.has(i));
    const res = await fetch('/api/menu/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const json = await res.json();
    setCommitting(false);
    if (!res.ok) {
      setError(json.error ?? 'Speichern fehlgeschlagen.');
      return;
    }
    router.push(`/menu?imported=${json.inserted}`);
  }

  function toggle(i: number) {
    setSelected((s) => {
      const ns = new Set(s);
      if (ns.has(i)) ns.delete(i);
      else ns.add(i);
      return ns;
    });
  }

  function updateItem(i: number, patch: Partial<ExtractedItem>) {
    if (!result) return;
    const items = [...result.items];
    items[i] = { ...items[i], ...patch };
    setResult({ ...result, items });
  }

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ModeBtn
          active={mode === 'csv'}
          onClick={() => { setMode('csv'); setResult(null); }}
          icon={<Table2 size={20} />}
          title="CSV / Excel"
          desc="Tabelle hochladen — schnell & deterministisch"
        />
        <ModeBtn
          active={mode === 'photo'}
          onClick={() => { setMode('photo'); setResult(null); }}
          icon={<Camera size={20} />}
          title="Foto"
          desc="Speisekarte abfotografieren"
        />
        <ModeBtn
          active={mode === 'voice'}
          onClick={() => { setMode('voice'); setResult(null); }}
          icon={<Mic size={20} />}
          title="Sprache"
          desc="Items mündlich aufzählen"
        />
        <ModeBtn
          active={mode === 'text'}
          onClick={() => { setMode('text'); setResult(null); }}
          icon={<FileText size={20} />}
          title="Text"
          desc="Liste einfügen"
        />
      </div>

      {/* CSV Input */}
      {mode === 'csv' && (
        <Card className="p-6 space-y-4">
          {!csvFile ? (
            <>
              <label className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center transition-colors hover:border-matcha-700 hover:bg-matcha-50/30 cursor-pointer">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-500 shadow ring-1 ring-zinc-200 transition group-hover:scale-105 group-hover:text-matcha-700">
                  <Upload size={24} />
                </div>
                <div className="text-sm font-semibold text-zinc-700">
                  CSV-Datei hochladen
                </div>
                <div className="text-xs text-muted-foreground max-w-md">
                  Excel: <em>Datei → Speichern unter → CSV UTF-8</em>. Spalten: <code className="font-mono bg-zinc-100 px-1 rounded">kategorie</code> · <code className="font-mono bg-zinc-100 px-1 rounded">name</code> · <code className="font-mono bg-zinc-100 px-1 rounded">beschreibung</code> · <code className="font-mono bg-zinc-100 px-1 rounded">preis</code> · <code className="font-mono bg-zinc-100 px-1 rounded">allergene</code>
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => handleCsv(e.target.files?.[0] ?? null)}
                />
              </label>

              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <a
                  href="/beispiel-speisekarte.csv"
                  download="beispiel-speisekarte.csv"
                  className="inline-flex items-center gap-1.5 rounded-full border border-matcha-300 bg-matcha-50 text-matcha-900 px-3 py-1.5 font-bold hover:bg-matcha-100"
                >
                  <Download size={12} /> Beispiel-CSV herunterladen
                </a>
                <span className="text-muted-foreground">
                  · in Excel/Numbers öffnen, eigene Items eintragen, als CSV speichern, hier hochladen.
                </span>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border bg-zinc-50 p-3">
                <Table2 className="h-6 w-6 text-matcha-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{csvFile.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(csvFile.size / 1024).toFixed(1)} KB · {csvText.split('\n').filter(Boolean).length} Zeilen
                  </div>
                </div>
                <button
                  onClick={() => handleCsv(null)}
                  className="rounded-full bg-white p-1.5 shadow ring-1 ring-zinc-200 hover:bg-red-50 hover:ring-red-200"
                  aria-label="Entfernen"
                >
                  <X size={14} />
                </button>
              </div>
              {csvWarnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5"><AlertCircle size={12} /> Hinweise zur CSV:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {csvWarnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}
                    {csvWarnings.length > 8 && <li>… und {csvWarnings.length - 8} weitere.</li>}
                  </ul>
                </div>
              )}
            </div>
          )}

          <details className="text-xs text-muted-foreground border-t pt-3">
            <summary className="cursor-pointer font-bold hover:text-foreground">CSV-Format im Detail</summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>
                Trennzeichen: <strong>Semikolon ;</strong> (Excel-DE-Default) oder Komma. Wird automatisch erkannt.
                UTF-8-Encoding für Umlaute. Erste Zeile ist die Spalten-Überschrift.
              </p>
              <p>
                <strong>Pflichtspalten:</strong> <code>name</code>, <code>preis</code>.
                <br />
                <strong>Optional:</strong> <code>kategorie</code> (fehlt → „Sonstiges"), <code>beschreibung</code>, <code>allergene</code> (mehrere kommasepariert).
              </p>
              <p>
                Preise akzeptieren <code>4,80</code>, <code>4.80</code>, <code>4,80 €</code> — alle drei werden zu 4,80 €.
                Beim Hochladen siehst du eine Vorschau und kannst pro Zeile abwählen, was nicht rein soll.
              </p>
            </div>
          </details>
        </Card>
      )}

      {/* Input area */}
      {mode === 'photo' && (
        <Card className="p-6">
          {!photoPreview ? (
            <label className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center transition-colors hover:border-matcha-700 hover:bg-matcha-50/30 cursor-pointer">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-500 shadow ring-1 ring-zinc-200 transition group-hover:scale-105 group-hover:text-matcha-700">
                <ImagePlus size={24} />
              </div>
              <div className="text-sm font-semibold text-zinc-700">
                Foto hochladen oder mit Handy fotografieren
              </div>
              <div className="text-xs text-muted-foreground">
                JPG, PNG, WebP · max. 10 MB · die KI liest Karte + Preise
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border bg-zinc-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Menu preview" className="max-h-96 w-full object-contain" />
                <button
                  onClick={() => handlePhoto(null)}
                  className="absolute right-2 top-2 rounded-full bg-white p-1.5 shadow ring-1 ring-zinc-200 hover:bg-red-50 hover:ring-red-200"
                  aria-label="Entfernen"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {mode === 'voice' && (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 py-8">
            {!audioBlob ? (
              <>
                <button
                  onClick={recording ? stopRecording : startRecording}
                  className={cn(
                    'flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl transition-all',
                    recording
                      ? 'bg-red-600 animate-pulse scale-110 ring-4 ring-red-200'
                      : 'bg-matcha-900 hover:bg-matcha-800 hover:scale-105',
                  )}
                  aria-label={recording ? 'Stoppen' : 'Aufnehmen'}
                >
                  {recording ? <Square size={28} fill="white" /> : <Mic size={28} />}
                </button>
                <div className="text-center">
                  <div className="text-sm font-semibold">
                    {recording ? 'Höre zu …' : 'Tippe auf Mikrofon zum Aufnehmen'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Sag die Items: „Pizza Margherita 9 Euro 50, Pizza Salami 11 Euro …"
                  </div>
                </div>
              </>
            ) : (
              <>
                <audio src={audioUrl ?? ''} controls className="w-full max-w-md" />
                <button
                  onClick={clearVoice}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-600"
                >
                  <Trash2 size={12} /> Neu aufnehmen
                </button>
              </>
            )}
          </div>
        </Card>
      )}

      {mode === 'text' && (
        <Card className="p-6">
          <textarea
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Beispiel:

Pizza
- Margherita 9,50€
- Salami 11€
- Hawaii 10,50€ (Schinken, Ananas)

Pasta
- Carbonara 12€
- Bolognese 11,50€

Getränke
- Cola 0,33L 3€
- Wasser still 2,50€`}
            className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-sm font-mono focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20"
          />
        </Card>
      )}

      {/* Action */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={runExtraction}
          disabled={busy}
          className="group flex items-center gap-2 rounded-xl bg-matcha-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-matcha-900/20 transition-all hover:bg-matcha-800 hover:shadow-xl disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> KI analysiert…
            </>
          ) : (
            <>
              <Sparkles size={15} /> Mit KI extrahieren
            </>
          )}
        </button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50/60 p-4">
          <div className="flex items-start gap-2 text-sm text-red-900">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              {error}
              {error.includes('ANTHROPIC_API_KEY') && (
                <div className="mt-1 text-xs">
                  Setze in <code className="rounded bg-red-100 px-1">/opt/mise/.env</code>{' '}
                  <code className="rounded bg-red-100 px-1">ANTHROPIC_API_KEY=sk-ant-…</code> und starte den Container neu.
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Preview */}
      {result && (
        <Card className="overflow-hidden p-0">
          <div className="border-b bg-zinc-50/60 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{result.items.length} Positionen erkannt</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Wähle aus, was übernommen werden soll. Klick aufs Feld zum Bearbeiten.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set(result.items.map((_, i) => i)))}
                  className="rounded-md border bg-white px-2.5 py-1 text-xs hover:bg-zinc-50"
                >
                  Alle
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="rounded-md border bg-white px-2.5 py-1 text-xs hover:bg-zinc-50"
                >
                  Keine
                </button>
              </div>
            </div>
            {result.notes && (
              <div className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                {result.notes}
              </div>
            )}
          </div>

          <div className="divide-y">
            {groupByCategory(result.items).map(([cat, group]) => (
              <div key={cat}>
                <div className="bg-zinc-50/40 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  {cat}
                </div>
                {group.map(([item, idx]) => (
                  <ItemRow
                    key={idx}
                    item={item}
                    selected={selected.has(idx)}
                    onToggle={() => toggle(idx)}
                    onUpdate={(p) => updateItem(idx, p)}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t bg-white px-5 py-4">
            <div className="text-sm text-muted-foreground">
              <strong className="text-foreground">{selected.size}</strong> von {result.items.length} ausgewählt
            </div>
            <button
              onClick={commit}
              disabled={committing || selected.size === 0}
              className="group flex items-center gap-2 rounded-xl bg-matcha-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-matcha-900/20 transition-all hover:bg-matcha-800 disabled:opacity-60"
            >
              {committing ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Speichere…
                </>
              ) : (
                <>
                  <Check size={15} /> Ins Menü übernehmen
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────

function ModeBtn({
  active, onClick, icon, title, desc,
}: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; title: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all',
        active
          ? 'border-matcha-700 bg-matcha-50/50 ring-2 ring-matcha-700/15 shadow-sm'
          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl transition',
          active ? 'bg-matcha-900 text-white' : 'bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200',
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}

function ItemRow({
  item, selected, onToggle, onUpdate,
}: {
  item: ExtractedItem;
  selected: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<ExtractedItem>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const lowConfidence = item.confidence < 0.75;
  const noPrice = item.preis == null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-5 py-3 transition-colors',
        selected ? 'bg-white' : 'bg-zinc-50/30 opacity-50',
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-4 w-4 rounded border-zinc-300 text-matcha-700 focus:ring-matcha-700"
      />

      <div className="flex-1 min-w-0">
        {!editing ? (
          <div onClick={() => setEditing(true)} className="cursor-text">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate">{item.name}</span>
              {lowConfidence && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700" title="KI ist sich unsicher">
                  prüfen
                </span>
              )}
              {noPrice && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">
                  preis fehlt
                </span>
              )}
              <Edit3 size={11} className="ml-auto text-zinc-300" />
            </div>
            {item.beschreibung && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.beschreibung}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              autoFocus
              value={item.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
              className="w-full rounded border-zinc-200 px-2 py-1 text-sm font-semibold focus:border-matcha-700 focus:outline-none focus:ring-1 focus:ring-matcha-700/20"
            />
            <input
              value={item.beschreibung ?? ''}
              onChange={(e) => onUpdate({ beschreibung: e.target.value || null })}
              placeholder="Beschreibung (optional)"
              className="w-full rounded border-zinc-200 px-2 py-1 text-xs focus:border-matcha-700 focus:outline-none focus:ring-1 focus:ring-matcha-700/20"
            />
          </div>
        )}
      </div>

      <input
        type="number"
        step="0.01"
        min="0"
        value={item.preis ?? ''}
        onChange={(e) => onUpdate({ preis: e.target.value ? Number(e.target.value) : null })}
        placeholder="0,00"
        className={cn(
          'w-24 rounded border px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1',
          noPrice
            ? 'border-red-200 focus:border-red-500 focus:ring-red-500/20'
            : 'border-zinc-200 focus:border-matcha-700 focus:ring-matcha-700/20',
        )}
      />
      <span className="text-xs text-muted-foreground">€</span>
    </div>
  );
}

function groupByCategory(items: ExtractedItem[]): [string, [ExtractedItem, number][]][] {
  const map = new Map<string, [ExtractedItem, number][]>();
  items.forEach((it, i) => {
    const k = it.kategorie || 'Sonstiges';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push([it, i]);
  });
  return Array.from(map.entries());
}
