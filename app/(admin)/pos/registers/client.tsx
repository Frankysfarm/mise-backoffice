'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import {
  Calculator, Check, Clock, Copy, Loader2, Monitor, Plus, Trash2, Wifi, X, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Terminal = {
  id: string;
  name: string;
  device_token: string;
  pairing_code: string | null;
  gepaart_am: string | null;
  letzter_kontakt: string | null;
  aktiv: boolean;
  sumup_reader_id: string | null;
};

type Register = {
  id: string;
  name: string;
  aktiv: boolean;
  terminals: Terminal[];
};

export function RegistersManager({
  tenantId, locationId, initialRegisters,
}: {
  tenantId: string;
  locationId: string;
  initialRegisters: Register[];
}) {
  const supabase = createClient();
  const [registers, setRegisters] = useState(initialRegisters);
  const [newRegister, setNewRegister] = useState(false);
  const [newName, setNewName] = useState('');
  const [pending, startTransition] = useTransition();

  async function addRegister() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const { data } = await supabase.from('pos_registers').insert({
        tenant_id: tenantId,
        location_id: locationId,
        name: newName.trim(),
        aktiv: true,
      }).select().single();
      if (data) {
        setRegisters((xs) => [...xs, { ...(data as any), terminals: [] }]);
        setNewName('');
        setNewRegister(false);
      }
    });
  }

  async function deleteRegister(id: string) {
    if (!confirm('Kasse wirklich löschen? Verbundene Tablets werden entkoppelt.')) return;
    await supabase.from('pos_registers').delete().eq('id', id);
    setRegisters((xs) => xs.filter((r) => r.id !== id));
  }

  async function renameRegister(id: string, name: string) {
    await supabase.from('pos_registers').update({ name }).eq('id', id);
    setRegisters((xs) => xs.map((r) => r.id === id ? { ...r, name } : r));
  }

  async function addTerminal(registerId: string) {
    startTransition(async () => {
      // 6-stelligen Pairing-Code erzeugen
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const { data } = await supabase.from('pos_terminals').insert({
        tenant_id: tenantId,
        location_id: locationId,
        register_id: registerId,
        name: `Tablet ${Date.now().toString().slice(-4)}`,
        pairing_code: code,
        aktiv: true,
      }).select().single();
      if (data) {
        setRegisters((xs) => xs.map((r) => r.id === registerId
          ? { ...r, terminals: [...r.terminals, data as any] }
          : r,
        ));
      }
    });
  }

  async function deleteTerminal(terminalId: string) {
    if (!confirm('Tablet entkoppeln? Muss dann neu verbunden werden.')) return;
    await supabase.from('pos_terminals').delete().eq('id', terminalId);
    setRegisters((xs) => xs.map((r) => ({
      ...r,
      terminals: r.terminals.filter((t) => t.id !== terminalId),
    })));
  }

  const totalRegisters = registers.length;
  const totalTerminals = registers.reduce((s, r) => s + r.terminals.length, 0);
  const paired = registers.reduce((s, r) => s + r.terminals.filter((t) => t.gepaart_am).length, 0);

  return (
    <div className="space-y-6">
      {/* Überblick */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Calculator className="h-4 w-4" />} label="Kassen" value={totalRegisters} />
        <Stat icon={<Monitor className="h-4 w-4" />} label="Tablets" value={totalTerminals} />
        <Stat icon={<Wifi className="h-4 w-4" />} label="davon verbunden" value={paired} positive={paired === totalTerminals && totalTerminals > 0} />
      </div>

      {/* Registers */}
      {registers.length === 0 ? (
        <Card className="p-10 text-center bg-gradient-to-br from-matcha-50 to-gold/10 border-matcha-200">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-matcha-900 text-matcha-50 grid place-items-center mb-4">
            <Calculator className="h-7 w-7" />
          </div>
          <h3 className="font-display text-2xl font-bold mb-2">Noch keine Kasse angelegt</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Lege eine Kasse an — z. B. <strong>„Theke"</strong> oder <strong>„Kasse Obergeschoss"</strong>.
            Dann bekommst du einen Code, den du auf dem Tablet eingibst.
          </p>
          <button
            onClick={() => { setNewName('Haupt-Kasse'); setNewRegister(true); }}
            className="h-12 px-6 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Erste Kasse anlegen
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          {registers.map((r) => (
            <RegisterCard
              key={r.id}
              register={r}
              onRename={(name) => renameRegister(r.id, name)}
              onDelete={() => deleteRegister(r.id)}
              onAddTerminal={() => addTerminal(r.id)}
              onDeleteTerminal={(tid) => deleteTerminal(tid)}
              pending={pending}
            />
          ))}

          {newRegister ? (
            <Card className="p-4 flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRegister()}
                placeholder="Name der Kasse (z.B. Theke, Terrasse-Kasse, …)"
                className="flex-1 h-11 rounded-xl border bg-white px-3 outline-none focus:border-gray-900"
                autoFocus
              />
              <button
                onClick={addRegister}
                disabled={!newName.trim() || pending}
                className="h-11 px-4 rounded-xl bg-gray-900 text-white font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Anlegen
              </button>
              <button onClick={() => setNewRegister(false)} className="h-11 w-11 rounded-xl hover:bg-muted grid place-items-center">
                <X className="h-4 w-4" />
              </button>
            </Card>
          ) : (
            <button
              onClick={() => setNewRegister(true)}
              className="w-full h-14 rounded-2xl border-2 border-dashed hover:bg-muted/30 hover:text-foreground text-muted-foreground inline-flex items-center justify-center gap-2 font-semibold"
            >
              <Plus className="h-4 w-4" /> Weitere Kasse hinzufügen
            </button>
          )}
        </div>
      )}

      {/* Help */}
      <Card className="p-5 bg-blue-50 border-blue-200">
        <h3 className="font-display font-bold text-blue-900 mb-2">So koppelst du ein Tablet</h3>
        <ol className="space-y-1 text-sm text-blue-900">
          <li><strong>1.</strong> Hier oben auf <strong>„Tablet hinzufügen"</strong> klicken — du bekommst einen 6-stelligen Code</li>
          <li><strong>2.</strong> Auf dem Tablet öffnest du <code className="bg-white px-1.5 py-0.5 rounded font-mono text-xs">{typeof window !== 'undefined' ? window.location.origin : ''}/pos/pair</code></li>
          <li><strong>3.</strong> Code eingeben → Tablet merkt sich seine Kasse (bleibt eingeloggt)</li>
          <li><strong>4.</strong> Fertig — Terminal startet, Kellner loggt sich per PIN ein, los geht's</li>
        </ol>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, positive }: { icon: React.ReactNode; label: string; value: number; positive?: boolean }) {
  return (
    <Card className={cn('p-4', positive && 'bg-matcha-50/50 border-matcha-200')}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className={positive ? 'text-matcha-700' : 'text-gray-600'}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-black">{value}</div>
    </Card>
  );
}

function RegisterCard({
  register, onRename, onDelete, onAddTerminal, onDeleteTerminal, pending,
}: {
  register: Register;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddTerminal: () => void;
  onDeleteTerminal: (tid: string) => void;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(register.name);

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b bg-gray-50">
        <div className="h-11 w-11 rounded-xl bg-gray-900 text-white grid place-items-center shrink-0">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onRename(nameDraft); setEditing(false); }
                  if (e.key === 'Escape') { setNameDraft(register.name); setEditing(false); }
                }}
                className="h-9 rounded-lg border bg-white px-2 font-display text-lg font-bold flex-1"
                autoFocus
              />
              <button onClick={() => { onRename(nameDraft); setEditing(false); }} className="h-9 w-9 rounded-lg bg-matcha-700 text-white grid place-items-center">
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="font-display text-lg font-bold hover:underline">
              {register.name}
            </button>
          )}
          <div className="text-xs text-muted-foreground">
            {register.terminals.length} Tablet{register.terminals.length === 1 ? '' : 's'}
          </div>
        </div>
        <button onClick={onDelete} className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-700 grid place-items-center" title="Kasse löschen">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Terminals */}
      <div className="p-4 space-y-2">
        {register.terminals.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Noch kein Tablet verbunden.
          </div>
        )}
        {register.terminals.map((t) => (
          <TerminalRow key={t.id} terminal={t} onDelete={() => onDeleteTerminal(t.id)} />
        ))}
        <button
          onClick={onAddTerminal}
          disabled={pending}
          className="w-full h-11 rounded-xl border-2 border-dashed hover:bg-muted/30 hover:text-foreground text-muted-foreground inline-flex items-center justify-center gap-2 font-semibold text-sm"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Tablet hinzufügen
        </button>
      </div>
    </Card>
  );
}

function TerminalRow({
  terminal, onDelete,
}: { terminal: Terminal; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  const paired = Boolean(terminal.gepaart_am);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const lastSeen = terminal.letzter_kontakt ? new Date(terminal.letzter_kontakt) : null;
  const minutesAgo = lastSeen ? Math.floor((Date.now() - lastSeen.getTime()) / 60000) : null;
  const isOnline = minutesAgo !== null && minutesAgo < 5;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl p-3 border',
      paired ? 'bg-white' : 'bg-amber-50 border-amber-200',
    )}>
      <div className={cn(
        'h-10 w-10 rounded-lg grid place-items-center shrink-0',
        paired ? 'bg-matcha-100 text-matcha-800' : 'bg-amber-100 text-amber-800',
      )}>
        <Monitor className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">{terminal.name}</div>
        {paired ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', isOnline ? 'bg-matcha-600 animate-pulse' : 'bg-gray-300')} />
            {isOnline ? 'Online' : minutesAgo !== null ? `vor ${minutesAgo} Min gesehen` : 'Offline'}
          </div>
        ) : (
          <div className="text-xs text-amber-900 font-semibold">Warten auf Pairing</div>
        )}
      </div>

      {!paired && terminal.pairing_code && (
        <div className="flex items-center gap-2">
          <div className="font-display font-black text-3xl tracking-[0.15em] text-amber-900 font-mono">
            {terminal.pairing_code}
          </div>
          <button
            onClick={() => copy(terminal.pairing_code!)}
            className="h-9 w-9 rounded-lg hover:bg-amber-100 text-amber-800 grid place-items-center"
            title="Code kopieren"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      )}

      {paired && (
        <a
          href={`/pos/terminal?device=${terminal.device_token}`}
          target="_blank"
          className="h-9 px-3 rounded-lg bg-matcha-900 text-matcha-50 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-matcha-800"
        >
          Öffnen <ExternalLink className="h-3 w-3" />
        </a>
      )}

      <button onClick={onDelete} className="h-9 w-9 rounded-lg hover:bg-red-50 hover:text-red-700 grid place-items-center text-muted-foreground">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
