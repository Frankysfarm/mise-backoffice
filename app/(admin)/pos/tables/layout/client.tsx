'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import {
  Check, Circle, Loader2, Move, Plus, Save, Square,
  Trash2, Users, Grid3x3, RectangleHorizontal,
} from 'lucide-react';

type Table = {
  id: string;
  tenant_id: string;
  location_id: string;
  nummer: string;
  name: string | null;
  kapazitaet: number | null;
  bereich: string | null;
  pos_x: number | null;
  pos_y: number | null;
  breite: number | null;
  hoehe: number | null;
  form: 'rund' | 'eckig' | 'lang' | null;
  aktiv: boolean;
};

const GRID_SIZE = 20;

export function FloorPlanEditor({
  tenantId, locationId, initialTables,
}: {
  tenantId: string;
  locationId: string;
  initialTables: Table[];
}) {
  const supabase = createClient();
  const [tables, setTables] = useState(initialTables);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<{ x: number; y: number } | null>(null);

  // Auto-save mit Debounce
  useEffect(() => {
    if (dirty.size === 0) return;
    const t = setTimeout(async () => {
      await persist();
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  async function persist() {
    if (dirty.size === 0) return;
    setSaving(true);
    try {
      const changed = tables.filter((t) => dirty.has(t.id));
      for (const t of changed) {
        await supabase.from('restaurant_tables').update({
          pos_x: t.pos_x, pos_y: t.pos_y,
          breite: t.breite, hoehe: t.hoehe,
          form: t.form,
        }).eq('id', t.id);
      }
      setDirty(new Set());
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  function markDirty(id: string) {
    setDirty((d) => new Set(d).add(id));
  }

  function updateTable(id: string, patch: Partial<Table>) {
    setTables((ts) => ts.map((t) => t.id === id ? { ...t, ...patch } : t));
    markDirty(id);
  }

  function snap(n: number): number {
    return Math.round(n / GRID_SIZE) * GRID_SIZE;
  }

  /* -------- Drag & Drop -------- */

  function onPointerDownTable(e: React.PointerEvent, t: Table) {
    e.preventDefault();
    setSelected(t.id);
    setDraggingId(t.id);
    offsetRef.current = {
      x: e.clientX - (t.pos_x ?? 0),
      y: e.clientY - (t.pos_y ?? 0),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMoveTable(e: React.PointerEvent) {
    if (!draggingId || !offsetRef.current) return;
    const newX = snap(e.clientX - offsetRef.current.x);
    const newY = snap(e.clientY - offsetRef.current.y);
    updateTable(draggingId, {
      pos_x: Math.max(0, newX),
      pos_y: Math.max(0, newY),
    });
  }

  function onPointerUpTable(e: React.PointerEvent) {
    if (draggingId) {
      setDraggingId(null);
      offsetRef.current = null;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  }

  async function addQuickTable(form: 'rund' | 'eckig' | 'lang') {
    const nextNr = String(tables.length + 1);
    const size = form === 'lang' ? { breite: 140, hoehe: 60 } : { breite: 80, hoehe: 80 };
    const { data } = await supabase.from('restaurant_tables').insert({
      tenant_id: tenantId,
      location_id: locationId,
      nummer: nextNr,
      kapazitaet: 2,
      sort_order: tables.length,
      pos_x: 40,
      pos_y: 40,
      form,
      ...size,
    }).select().single();
    if (data) setTables((ts) => [...ts, data as any]);
  }

  async function deleteTable(id: string) {
    if (!confirm('Tisch wirklich löschen?')) return;
    await supabase.from('restaurant_tables').delete().eq('id', id);
    setTables((ts) => ts.filter((t) => t.id !== id));
    setSelected(null);
  }

  const selectedTable = selected ? tables.find((t) => t.id === selected) : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-3 flex flex-wrap items-center gap-2 bg-white">
        <div className="inline-flex items-center gap-1 mr-2 text-xs font-bold uppercase tracking-wider text-gray-500">
          <Plus className="h-3.5 w-3.5" /> Neuer Tisch:
        </div>
        <button
          onClick={() => addQuickTable('rund')}
          className="h-10 px-3 rounded-xl border-2 hover:bg-gray-50 text-sm font-semibold inline-flex items-center gap-2"
        >
          <Circle className="h-4 w-4" /> Rund
        </button>
        <button
          onClick={() => addQuickTable('eckig')}
          className="h-10 px-3 rounded-xl border-2 hover:bg-gray-50 text-sm font-semibold inline-flex items-center gap-2"
        >
          <Square className="h-4 w-4" /> Eckig
        </button>
        <button
          onClick={() => addQuickTable('lang')}
          className="h-10 px-3 rounded-xl border-2 hover:bg-gray-50 text-sm font-semibold inline-flex items-center gap-2"
        >
          <RectangleHorizontal className="h-4 w-4" /> Tafel
        </button>

        <div className="flex-1" />

        <div className="text-xs text-gray-500 inline-flex items-center gap-1.5">
          {saving ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Speichere…</>
          ) : savedHint ? (
            <><Check className="h-3.5 w-3.5 text-matcha-700" /> Gespeichert</>
          ) : dirty.size > 0 ? (
            <>Änderungen werden automatisch gespeichert</>
          ) : (
            <><Save className="h-3.5 w-3.5" /> Alles gespeichert</>
          )}
        </div>
      </Card>

      {/* Layout Canvas + Sidebar */}
      <div className="grid gap-4 lg:grid-cols-[1fr,260px]">
        {/* CANVAS */}
        <div
          ref={canvasRef}
          className="relative rounded-2xl border-2 bg-white overflow-auto"
          style={{
            height: '70vh',
            minHeight: 500,
            backgroundImage: 'linear-gradient(#0000000a 1px, transparent 1px), linear-gradient(90deg, #0000000a 1px, transparent 1px)',
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          {tables.length === 0 && (
            <div className="absolute inset-0 grid place-items-center text-gray-400">
              <div className="text-center">
                <Grid3x3 className="h-12 w-12 mx-auto opacity-30 mb-2" />
                <div className="font-bold">Noch keine Tische platziert</div>
                <div className="text-sm">Oben ein Tisch-Form auswählen → drag & drop</div>
              </div>
            </div>
          )}

          {tables.map((t) => {
            const isSelected = selected === t.id;
            const w = t.breite ?? 80;
            const h = t.hoehe ?? 80;
            const form = t.form ?? 'rund';
            return (
              <div
                key={t.id}
                onPointerDown={(e) => onPointerDownTable(e, t)}
                onPointerMove={onPointerMoveTable}
                onPointerUp={onPointerUpTable}
                onPointerCancel={onPointerUpTable}
                className={cn(
                  'absolute cursor-move select-none flex items-center justify-center text-center transition-shadow',
                  draggingId === t.id ? 'shadow-2xl z-10' : 'shadow',
                  isSelected ? 'ring-4 ring-matcha-500 ring-offset-2' : '',
                )}
                style={{
                  left: t.pos_x ?? 0,
                  top: t.pos_y ?? 0,
                  width: w,
                  height: h,
                  borderRadius: form === 'rund' ? '50%' : 12,
                  background: 'white',
                  border: '3px solid #0d1f16',
                  touchAction: 'none',
                }}
              >
                <div className="pointer-events-none">
                  <div className="font-display font-black text-gray-900" style={{ fontSize: Math.min(w, h) * 0.3 }}>
                    {t.nummer}
                  </div>
                  {t.kapazitaet && (
                    <div className="text-[10px] text-gray-500 font-bold">
                      {t.kapazitaet} Pers.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* SIDEBAR: Selected table details */}
        <div className="space-y-3">
          {selectedTable ? (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-10 w-10 rounded-xl bg-gray-900 text-white grid place-items-center font-display font-black">
                  {selectedTable.nummer}
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tisch</div>
                  <div className="font-display font-bold">{selectedTable.nummer}{selectedTable.name ? ` · ${selectedTable.name}` : ''}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Form</label>
                  <div className="mt-1 grid grid-cols-3 gap-1">
                    {(['rund', 'eckig', 'lang'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => updateTable(selectedTable.id, {
                          form: f,
                          ...(f === 'lang' ? { breite: 140, hoehe: 60 } : { breite: 80, hoehe: 80 }),
                        })}
                        className={cn(
                          'h-10 rounded-lg border-2 text-xs font-semibold capitalize transition',
                          selectedTable.form === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50',
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Breite</label>
                    <input
                      type="number" step={20} min={40} max={300}
                      value={selectedTable.breite ?? 80}
                      onChange={(e) => updateTable(selectedTable.id, { breite: Number(e.target.value) })}
                      className="mt-1 w-full h-10 rounded-lg border-2 bg-white px-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Höhe</label>
                    <input
                      type="number" step={20} min={40} max={300}
                      value={selectedTable.hoehe ?? 80}
                      onChange={(e) => updateTable(selectedTable.id, { hoehe: Number(e.target.value) })}
                      className="mt-1 w-full h-10 rounded-lg border-2 bg-white px-2 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">X</label>
                    <input
                      type="number" step={20} min={0}
                      value={selectedTable.pos_x ?? 0}
                      onChange={(e) => updateTable(selectedTable.id, { pos_x: Number(e.target.value) })}
                      className="mt-1 w-full h-10 rounded-lg border-2 bg-white px-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Y</label>
                    <input
                      type="number" step={20} min={0}
                      value={selectedTable.pos_y ?? 0}
                      onChange={(e) => updateTable(selectedTable.id, { pos_y: Number(e.target.value) })}
                      className="mt-1 w-full h-10 rounded-lg border-2 bg-white px-2 font-mono text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={() => deleteTable(selectedTable.id)}
                  className="w-full h-10 rounded-lg border-2 border-red-200 text-red-700 hover:bg-red-50 font-semibold text-sm inline-flex items-center justify-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Löschen
                </button>
              </div>
            </Card>
          ) : (
            <Card className="p-5 text-center">
              <Move className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <div className="text-sm font-bold text-gray-700">Tisch anklicken zum Bearbeiten</div>
              <div className="text-xs text-gray-500 mt-1">
                Drag zum Verschieben · Snap auf {GRID_SIZE}px-Raster
              </div>
            </Card>
          )}

          <Card className="p-4 bg-matcha-50/50 border-matcha-200">
            <div className="text-xs text-matcha-900 font-semibold mb-1">💡 Tipp</div>
            <div className="text-xs text-matcha-800 leading-relaxed">
              Im Kassen-Terminal kannst du später direkt auf den Tisch klicken, um eine Bestellung darauf zu starten.
            </div>
          </Card>

          <div className="text-xs text-gray-500 px-1">
            {tables.length} Tisch{tables.length === 1 ? '' : 'e'} platziert · {dirty.size > 0 ? `${dirty.size} ungespeichert` : 'alles synchron'}
          </div>
        </div>
      </div>
    </div>
  );
}
