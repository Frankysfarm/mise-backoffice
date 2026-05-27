'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import {
  Sparkles,
  Plus,
  Trash2,
  Star,
  TrendingUp,
  Search,
  Percent,
  GripVertical,
  AlertCircle,
} from 'lucide-react';

interface Item {
  id: string;
  name: string;
  beschreibung: string | null;
  preis: number;
  bild_url: string | null;
  beliebt: boolean | null;
  kategorie: { name: string } | { name: string }[] | null;
}

interface Upsell {
  id: string;
  menu_item_id: string;
  rabatt_prozent: number;
  aktiv: boolean;
  sort_order: number;
  label_override: string | null;
}

const DISCOUNT_STEPS = [0, 5, 10, 15, 20, 25, 30, 40, 50] as const;

export function UpsellsClient({
  tenantId,
  items,
  initialUpsells,
}: {
  tenantId: string;
  items: Item[];
  initialUpsells: Upsell[];
}) {
  const sb = createClient();
  const [upsells, setUpsells] = useState<Upsell[]>(initialUpsells);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const itemById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items],
  );

  const upsellByItemId = useMemo(
    () => new Map(upsells.map((u) => [u.menu_item_id, u])),
    [upsells],
  );

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.beschreibung ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  async function toggleUpsell(itemId: string, on: boolean) {
    setError(null);
    const existing = upsellByItemId.get(itemId);
    if (on) {
      if (existing) {
        await updateUpsell(existing.id, { aktiv: true });
        return;
      }
      const { data, error: e } = await sb
        .from('tenant_upsells')
        .insert({
          tenant_id: tenantId,
          menu_item_id: itemId,
          rabatt_prozent: 0,
          aktiv: true,
          sort_order: upsells.length,
        })
        .select()
        .single();
      if (e || !data) {
        setError('Anlegen fehlgeschlagen: ' + (e?.message ?? 'unbekannt'));
        return;
      }
      setUpsells((prev) => [...prev, data as Upsell]);
    } else {
      if (!existing) return;
      await updateUpsell(existing.id, { aktiv: false });
    }
  }

  async function updateUpsell(id: string, patch: Partial<Upsell>) {
    const { error: e } = await sb
      .from('tenant_upsells')
      .update(patch)
      .eq('id', id);
    if (e) {
      setError('Update fehlgeschlagen: ' + e.message);
      return;
    }
    setUpsells((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
  }

  async function deleteUpsell(id: string) {
    if (!confirm('Item aus Upsell-Liste entfernen?')) return;
    const { error: e } = await sb.from('tenant_upsells').delete().eq('id', id);
    if (e) {
      setError('Löschen fehlgeschlagen: ' + e.message);
      return;
    }
    setUpsells((prev) => prev.filter((u) => u.id !== id));
  }

  const activeUpsells = upsells.filter((u) => u.aktiv);
  const activeUpsellItems = activeUpsells
    .map((u) => ({ upsell: u, item: itemById.get(u.menu_item_id) }))
    .filter((x) => x.item)
    .sort((a, b) => a.upsell.sort_order - b.upsell.sort_order);

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-900">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="text-sm">{error}</div>
        </div>
      )}

      {/* === Wie's funktioniert === */}
      <Card className="p-5 bg-gradient-to-br from-orange-50/50 to-amber-50/40 border-orange-200/40">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">So funktioniert's</h3>
            <p className="text-sm text-muted-foreground">
              Wenn ein Kunde im Warenkorb auf „Zur Kasse" klickt, zeigen wir die
              hier ausgewählten Items als Vorschlag an — z.B.{' '}
              <em>„Vergiss das nicht"</em>. Bei aktiviertem Rabatt wird der
              Originalpreis durchgestrichen + der Rabatt-Preis prominent
              gezeigt. Klick = direkt im Warenkorb.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Empfehlung:</strong> 3–6 Items als Upsell, davon
              1–2 mit kleinem Rabatt (10–20 %). Mehr verwirrt; weniger fällt zu
              wenig auf.
            </p>
          </div>
        </div>
      </Card>

      {/* === Aktive Upsells (sortierbar) === */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp
              size={18}
              className="text-orange-500"
              strokeWidth={2}
            />
            <h3 className="font-semibold">
              Aktiv ({activeUpsellItems.length})
            </h3>
          </div>
          {activeUpsellItems.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Noch nichts ausgewählt — wähle unten
            </span>
          )}
        </div>

        {activeUpsellItems.length > 0 ? (
          <div className="space-y-2">
            {activeUpsellItems.map(({ upsell, item }, idx) => (
              <div
                key={upsell.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 bg-white"
              >
                <span className="font-mono text-xs text-muted-foreground w-6">
                  {idx + 1}.
                </span>
                <div
                  className="w-12 h-12 rounded-lg shrink-0"
                  style={{
                    background: item!.bild_url
                      ? `url(${item!.bild_url}) center/cover`
                      : 'linear-gradient(135deg, #FFEDD5, #FED7AA)',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <div className="font-semibold text-sm truncate">
                      {item!.name}
                    </div>
                    {item!.beliebt && (
                      <Star
                        size={11}
                        className="text-amber-500 shrink-0"
                        fill="currentColor"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{item!.preis.toFixed(2)} €</span>
                    {Number(upsell.rabatt_prozent) > 0 && (
                      <>
                        <span>→</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {(
                            item!.preis *
                            (1 - Number(upsell.rabatt_prozent) / 100)
                          ).toFixed(2)}{' '}
                          €
                        </span>
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                          −{upsell.rabatt_prozent}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {/* Rabatt-Picker */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Percent
                    size={12}
                    className="text-muted-foreground"
                  />
                  <select
                    value={Number(upsell.rabatt_prozent)}
                    onChange={(e) =>
                      updateUpsell(upsell.id, {
                        rabatt_prozent: Number(e.target.value),
                      })
                    }
                    className="text-xs font-mono border border-zinc-200 rounded-md px-2 py-1.5 bg-white"
                  >
                    {DISCOUNT_STEPS.map((d) => (
                      <option key={d} value={d}>
                        {d === 0 ? 'kein Rabatt' : `−${d}%`}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => deleteUpsell(upsell.id)}
                  aria-label="Entfernen"
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-600 transition shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Wähle unten Items aus, um sie als Upsell anzubieten.
          </div>
        )}
      </Card>

      {/* === Item-Auswahl === */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h3 className="font-semibold">Items aus deiner Karte</h3>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 bg-white max-w-xs">
            <Search size={14} className="text-muted-foreground" />
            <input
              type="search"
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm w-full"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Keine Items gefunden.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredItems.map((item) => {
              const upsell = upsellByItemId.get(item.id);
              const active = upsell?.aktiv === true;
              const kat = Array.isArray(item.kategorie)
                ? item.kategorie[0]?.name
                : item.kategorie?.name;
              return (
                <button
                  key={item.id}
                  onClick={() => toggleUpsell(item.id, !active)}
                  className="flex items-center gap-3 p-3 rounded-xl border transition text-left"
                  style={{
                    borderColor: active ? '#F97316' : '#E4E4E7',
                    background: active ? '#FFF7ED' : 'white',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-lg shrink-0"
                    style={{
                      background: item.bild_url
                        ? `url(${item.bild_url}) center/cover`
                        : 'linear-gradient(135deg, #F4F4F5, #E4E4E7)',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {kat ?? '—'} · {item.preis.toFixed(2)} €
                    </div>
                  </div>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition"
                    style={{
                      background: active ? '#F97316' : '#F4F4F5',
                      color: active ? 'white' : '#A1A1AA',
                    }}
                  >
                    <Plus
                      size={14}
                      strokeWidth={3}
                      className={active ? 'rotate-45' : ''}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
