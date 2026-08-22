'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Check, Copy, Eye, Grid3x3, Loader2, Plus, Printer, QrCode, Trash2, Users, X,
} from 'lucide-react';

type Table = {
  id: string;
  tenant_id: string;
  location_id: string;
  nummer: string;
  name: string | null;
  kapazitaet: number | null;
  bereich: string | null;
  qr_token: string;
  aktiv: boolean;
  sort_order: number;
};

export function TablesManager({
  tenantId, locationId, initialTables, slug,
}: {
  tenantId: string;
  locationId: string;
  initialTables: Table[];
  slug: string;
}) {
  const supabase = createClient();
  const [tables, setTables] = useState(initialTables);
  const [bereichFilter, setBereichFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Table | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const bereiche = Array.from(new Set(tables.map((t) => t.bereich).filter(Boolean))) as string[];
  const filtered = bereichFilter === 'all' ? tables : tables.filter((t) => t.bereich === bereichFilter);

  async function saveTable(data: Partial<Table>) {
    startTransition(async () => {
      if (data.id) {
        const { data: updated } = await supabase
          .from('restaurant_tables').update(data).eq('id', data.id).select().single();
        if (updated) setTables((arr) => arr.map((t) => t.id === updated.id ? updated as any : t));
      } else {
        const { data: inserted } = await supabase
          .from('restaurant_tables').insert({
            ...data,
            tenant_id: tenantId,
            location_id: locationId,
          }).select().single();
        if (inserted) setTables((arr) => [...arr, inserted as any]);
      }
      setEditing(null);
      setAdding(false);
    });
  }

  async function deleteTable(id: string) {
    if (!confirm('Tisch wirklich löschen? QR-Code wird ungültig.')) return;
    startTransition(async () => {
      await supabase.from('restaurant_tables').delete().eq('id', id);
      setTables((arr) => arr.filter((t) => t.id !== id));
    });
  }

  async function bulkCreate(count: number, prefix: string) {
    startTransition(async () => {
      const rows = Array.from({ length: count }, (_, i) => ({
        tenant_id: tenantId,
        location_id: locationId,
        nummer: `${prefix}${i + 1}`,
        kapazitaet: 2,
        sort_order: tables.length + i,
      }));
      const { data } = await supabase.from('restaurant_tables').insert(rows).select();
      if (data) setTables((arr) => [...arr, ...(data as any[])]);
    });
  }

  const tableUrl = (token: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/t/${token}` : `/t/${token}`;

  return (
    <div className="space-y-6">
      {/* Hero: Universal QR Highlight */}
      <Card className="p-5 bg-gradient-to-br from-matcha-50 to-amber-50 border-matcha-300">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-matcha-900 text-matcha-50 grid place-items-center shrink-0">
            <QrCode className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-700">EIN QR für alle Tische</div>
            <div className="font-display text-lg font-bold">Universal Tisch-QR</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              Ein Aufsteller an der Wand oder ein QR auf jedem Tisch — Kunde scannt und wählt dann seine Tisch-Nummer.
            </div>
          </div>
          <a
            href="/api/pos/universal-qr"
            target="_blank"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-5 py-2.5 text-sm font-bold hover:bg-matcha-800"
          >
            <Printer className="h-4 w-4" /> Universal-QR drucken
          </a>
        </div>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={bereichFilter}
            onChange={(e) => setBereichFilter(e.target.value)}
            className="h-10 rounded-xl border bg-background px-3 text-sm"
          >
            <option value="all">Alle Bereiche ({tables.length})</option>
            {bereiche.map((b) => (
              <option key={b} value={b}>{b} ({tables.filter((t) => t.bereich === b).length})</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href="/pos/tables/layout"
            className="h-10 px-4 rounded-xl bg-matcha-900 text-matcha-50 text-sm font-bold hover:bg-matcha-800 inline-flex items-center gap-2"
          >
            <Grid3x3 className="h-4 w-4" /> Tische platzieren (Floor-Plan)
          </a>
          <a
            href="/pos/tables/preview"
            target="_blank"
            className="h-10 px-4 rounded-xl border bg-card hover:bg-muted text-sm font-semibold inline-flex items-center gap-2"
          >
            <Eye className="h-4 w-4" /> Vorschau
          </a>
          {tables.length === 0 && (
            <button
              onClick={() => bulkCreate(10, 'T')}
              disabled={pending}
              className="h-10 px-4 rounded-xl border bg-card hover:bg-muted text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> 10 Tische auf einmal
            </button>
          )}
          <button
            onClick={() => setAdding(true)}
            className="h-10 px-4 rounded-xl bg-matcha-900 text-matcha-50 text-sm font-bold hover:bg-matcha-800 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Tisch hinzufügen
          </button>
        </div>
      </div>

      {/* Empty State */}
      {tables.length === 0 && (
        <Card className="p-10 text-center bg-gradient-to-br from-matcha-50/60 to-gold/10 border-matcha-200">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-matcha-900 text-matcha-50 flex items-center justify-center mb-4">
            <QrCode className="h-7 w-7" />
          </div>
          <h3 className="font-display text-2xl font-bold mb-2">Noch keine Tische angelegt</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Leg Tische an — jeder bekommt seinen eigenen QR-Code. Gäste scannen, öffnen die Karte, bestellen und zahlen direkt. Bestellung landet in deinem POS und in der Küche.
          </p>
          <button
            onClick={() => bulkCreate(10, 'T')}
            disabled={pending}
            className="h-12 px-6 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 inline-flex items-center gap-2"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            10 Tische automatisch erstellen
          </button>
        </Card>
      )}

      {/* Grid */}
      {tables.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {filtered.map((t) => (
            <TableCard key={t.id} table={t} slug={slug} onEdit={() => setEditing(t)} onDelete={() => deleteTable(t.id)} tableUrl={tableUrl} />
          ))}
        </div>
      )}

      {/* Print All QR */}
      {tables.length > 0 && (
        <div className="flex justify-end">
          <a
            href={`/pos/tables/print`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl border bg-card hover:bg-muted px-4 py-2 text-sm font-semibold"
          >
            <Printer className="h-4 w-4" /> Alle QR-Codes drucken
          </a>
        </div>
      )}

      {/* Edit/Add Modal */}
      {(editing || adding) && (
        <TableFormModal
          table={editing}
          bereiche={bereiche}
          onClose={() => { setEditing(null); setAdding(false); }}
          onSave={saveTable}
        />
      )}
    </div>
  );
}

function TableCard({
  table: t, slug, onEdit, onDelete, tableUrl,
}: {
  table: Table;
  slug: string;
  onEdit: () => void;
  onDelete: () => void;
  tableUrl: (t: string) => string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(tableUrl(t.qr_token));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className={cn('p-4 transition hover:shadow-soft', !t.aktiv && 'opacity-50')}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-display text-xl font-bold">{t.nummer}</div>
          {t.name && <div className="text-xs text-muted-foreground">{t.name}</div>}
          {t.bereich && <div className="text-[10px] uppercase tracking-wider text-matcha-700 mt-0.5">{t.bereich}</div>}
        </div>
        <button onClick={onDelete} className="h-7 w-7 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-700">
          <Trash2 className="h-3.5 w-3.5 mx-auto" />
        </button>
      </div>

      {/* QR-Preview */}
      <a
        href={`/api/pos/tables/${t.qr_token}/qr`}
        target="_blank"
        className="block bg-white rounded-xl p-2 border border-border mb-2 hover:border-matcha-500 transition"
        title="QR-Code öffnen"
      >
        <div className="aspect-square grid place-items-center text-[10px] text-muted-foreground font-mono break-all text-center p-2">
          <QrCode className="h-8 w-8 mb-1 text-matcha-700" />
          QR drucken
        </div>
      </a>

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
        <Users className="h-3 w-3" /> {t.kapazitaet ?? '?'} Pers.
      </div>

      <div className="flex gap-1">
        <button
          onClick={copy}
          className="flex-1 h-8 rounded-md border bg-card hover:bg-muted text-[11px] font-semibold inline-flex items-center justify-center gap-1"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Kopiert' : 'Link'}
        </button>
        <button
          onClick={onEdit}
          className="h-8 px-2 rounded-md border bg-card hover:bg-muted text-[11px] font-semibold"
        >
          Edit
        </button>
      </div>
    </Card>
  );
}

function TableFormModal({
  table, bereiche, onClose, onSave,
}: {
  table: Table | null;
  bereiche: string[];
  onClose: () => void;
  onSave: (data: Partial<Table>) => void;
}) {
  const [nummer, setNummer] = useState(table?.nummer ?? '');
  const [name, setName] = useState(table?.name ?? '');
  const [kapazitaet, setKapazitaet] = useState(table?.kapazitaet ?? 2);
  const [bereich, setBereich] = useState(table?.bereich ?? '');
  const [aktiv, setAktiv] = useState(table?.aktiv ?? true);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <Card className="max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-display text-xl font-bold">{table ? 'Tisch bearbeiten' : 'Neuer Tisch'}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted">
            <X className="h-4 w-4 mx-auto" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Tisch-Nummer *" required>
            <input value={nummer} onChange={(e) => setNummer(e.target.value)}
              className="w-full h-11 rounded-xl border bg-background px-3" placeholder="z.B. 1, T-12, Terrasse-3" />
          </Field>
          <Field label="Name (optional)">
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full h-11 rounded-xl border bg-background px-3" placeholder="z.B. Fenstertisch groß" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plätze">
              <input type="number" min={1} max={20} value={kapazitaet}
                onChange={(e) => setKapazitaet(Number(e.target.value))}
                className="w-full h-11 rounded-xl border bg-background px-3" />
            </Field>
            <Field label="Bereich">
              <input value={bereich} onChange={(e) => setBereich(e.target.value)}
                list="bereiche" placeholder="Innen, Terrasse…"
                className="w-full h-11 rounded-xl border bg-background px-3" />
              <datalist id="bereiche">
                {bereiche.map((b) => <option key={b} value={b} />)}
              </datalist>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
            Tisch aktiv (sichtbar im POS + QR gültig)
          </label>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => onSave({ id: table?.id, nummer, name: name || null, kapazitaet, bereich: bereich || null, aktiv } as any)}
            disabled={!nummer.trim()}
            className="flex-1 h-11 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 disabled:opacity-50"
          >
            Speichern
          </button>
          <button onClick={onClose} className="h-11 px-4 rounded-xl border bg-card hover:bg-muted">
            Abbrechen
          </button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}{required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
