'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar, Check, Clock, Mail, MapPin, Phone, Plus, User, Users, X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

type Status = 'angefragt' | 'bestaetigt' | 'wartet' | 'platziert' | 'noshow' | 'storniert' | 'beendet';

interface Reservation {
  id: string;
  gast_name: string;
  gast_telefon: string | null;
  gast_email: string | null;
  gast_anzahl: number;
  datum: string;
  zeit_von: string;
  zeit_bis: string | null;
  dauer_min: number;
  notiz: string | null;
  allergie_hinweis: string | null;
  status: Status;
  quelle: string;
  tisch_id: string | null;
  restaurant_tables: { nummer: string | number; kapazitaet: number } | null;
}

interface Table {
  id: string;
  nummer: string | number;
  kapazitaet: number;
}

interface Props {
  tag: 'heute' | 'morgen' | 'woche';
  locationName: string;
  reservations: Reservation[];
  tables: Table[];
}

const STATUS_LABEL: Record<Status, string> = {
  angefragt: 'Angefragt',
  bestaetigt: 'Bestätigt',
  wartet: 'Wartet',
  platziert: 'Sitzt',
  noshow: 'No-Show',
  storniert: 'Storniert',
  beendet: 'Beendet',
};

const STATUS_COLOR: Record<Status, string> = {
  angefragt: 'bg-amber-100 text-amber-900 border-amber-300',
  bestaetigt: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  wartet: 'bg-blue-100 text-blue-900 border-blue-300',
  platziert: 'bg-purple-100 text-purple-900 border-purple-300',
  noshow: 'bg-red-100 text-red-900 border-red-300',
  storniert: 'bg-zinc-100 text-zinc-600 border-zinc-300',
  beendet: 'bg-zinc-100 text-zinc-600 border-zinc-300',
};

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

export function ReservationsClient({ tag, locationName, reservations, tables }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    gast_name: '', gast_telefon: '', gast_anzahl: 2,
    datum: new Date().toISOString().slice(0, 10),
    zeit_von: '19:00', dauer_min: 90,
    tisch_id: '', notiz: '',
  });

  async function setStatus(id: string, status: Status) {
    setBusy(id);
    try {
      await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally { setBusy(null); }
  }

  async function createReservation(e: React.FormEvent) {
    e.preventDefault();
    setBusy('NEW');
    try {
      const r = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tisch_id: form.tisch_id || null,
          gast_telefon: form.gast_telefon || null,
          notiz: form.notiz || null,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        alert((e as { error?: string }).error || 'Fehler beim Anlegen');
        return;
      }
      setShowForm(false);
      setForm({ ...form, gast_name: '', gast_telefon: '', notiz: '' });
      router.refresh();
    } finally { setBusy(null); }
  }

  // Gruppieren nach Datum
  const grouped = reservations.reduce<Record<string, Reservation[]>>((acc, r) => {
    (acc[r.datum] = acc[r.datum] ?? []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="🪑 Tisch-Reservierungen"
        description={locationName}
      />

      <div className="flex flex-wrap gap-2 items-center">
        <Link href="/reservierungen?tag=heute"
          className={cn('px-4 py-2 rounded-xl text-base font-display font-black transition',
            tag === 'heute' ? 'bg-zinc-900 text-white' : 'bg-white border-2 border-zinc-300 text-zinc-700')}>
          Heute
        </Link>
        <Link href="/reservierungen?tag=morgen"
          className={cn('px-4 py-2 rounded-xl text-base font-display font-black transition',
            tag === 'morgen' ? 'bg-zinc-900 text-white' : 'bg-white border-2 border-zinc-300 text-zinc-700')}>
          Morgen
        </Link>
        <Link href="/reservierungen?tag=woche"
          className={cn('px-4 py-2 rounded-xl text-base font-display font-black transition',
            tag === 'woche' ? 'bg-zinc-900 text-white' : 'bg-white border-2 border-zinc-300 text-zinc-700')}>
          Diese Woche
        </Link>

        <button onClick={() => setShowForm(true)}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-base font-display font-black hover:bg-emerald-700 active:scale-[0.97]">
          <Plus className="h-5 w-5" />
          Neue Reservierung
        </button>
      </div>

      {/* FORM */}
      {showForm && (
        <form onSubmit={createReservation} className="rounded-2xl border-2 border-zinc-300 bg-white p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-bold text-zinc-700">Gast-Name *</span>
              <input required value={form.gast_name} onChange={(e) => setForm({ ...form, gast_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border-2 border-zinc-300 text-base" placeholder="Max Mustermann" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-zinc-700">Telefon</span>
              <input type="tel" value={form.gast_telefon} onChange={(e) => setForm({ ...form, gast_telefon: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border-2 border-zinc-300 text-base" placeholder="0241-12345" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-zinc-700">Personen *</span>
              <input required type="number" min={1} value={form.gast_anzahl}
                onChange={(e) => setForm({ ...form, gast_anzahl: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border-2 border-zinc-300 text-base" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-zinc-700">Tisch (optional)</span>
              <select value={form.tisch_id} onChange={(e) => setForm({ ...form, tisch_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border-2 border-zinc-300 text-base">
                <option value="">Ohne Tisch</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>Tisch {t.nummer} ({t.kapazitaet} Pers)</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-zinc-700">Datum *</span>
              <input required type="date" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border-2 border-zinc-300 text-base" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-zinc-700">Uhrzeit *</span>
              <input required type="time" value={form.zeit_von} onChange={(e) => setForm({ ...form, zeit_von: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border-2 border-zinc-300 text-base" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-bold text-zinc-700">Notiz</span>
              <input value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border-2 border-zinc-300 text-base"
                placeholder="z.B. Geburtstag, Allergie, Kinderstuhl..." />
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl border-2 border-zinc-300 text-base font-bold">Abbrechen</button>
            <button type="submit" disabled={busy === 'NEW'}
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-base font-display font-black disabled:opacity-50">
              {busy === 'NEW' ? 'Speichere...' : 'Reservieren'}
            </button>
          </div>
        </form>
      )}

      {/* LISTE */}
      {reservations.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <Calendar className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
          <h3 className="font-display text-lg font-black text-zinc-700">Keine Reservierungen für {tag === 'heute' ? 'heute' : tag === 'morgen' ? 'morgen' : 'die nächsten 7 Tage'}</h3>
          <button onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold">
            <Plus className="h-4 w-4" />Erste Reservierung anlegen
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(grouped).sort().map((datum) => (
            <div key={datum} className="space-y-2">
              <h2 className="font-display font-black text-lg text-zinc-700 capitalize">
                {formatDate(datum)} ({grouped[datum].length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[datum].map((r) => (
                  <div key={r.id} className="rounded-2xl border-2 border-zinc-200 bg-white p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <Clock className="h-4 w-4 text-zinc-700" />
                        <span className="font-display text-xl font-black">{r.zeit_von.slice(0, 5)}</span>
                        <span className="text-xs text-zinc-500">({r.dauer_min} Min)</span>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border',
                        STATUS_COLOR[r.status])}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-zinc-500" />
                      <span className="font-display font-black text-base">{r.gast_name}</span>
                      <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold">
                        <Users className="h-3 w-3" />{r.gast_anzahl}
                      </span>
                    </div>
                    {r.gast_telefon && (
                      <a href={`tel:${r.gast_telefon}`} className="block text-sm text-blue-700 inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />{r.gast_telefon}
                      </a>
                    )}
                    {r.restaurant_tables && (
                      <div className="text-xs text-zinc-700 inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />Tisch {r.restaurant_tables.nummer} ({r.restaurant_tables.kapazitaet} P)
                      </div>
                    )}
                    {r.notiz && (
                      <div className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1 text-yellow-900">
                        📝 {r.notiz}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-100">
                      {(r.status === 'angefragt' || r.status === 'wartet') && (
                        <button onClick={() => setStatus(r.id, 'bestaetigt')} disabled={busy === r.id}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                          <Check className="h-4 w-4" />Bestätigen
                        </button>
                      )}
                      {r.status === 'bestaetigt' && (
                        <button onClick={() => setStatus(r.id, 'platziert')} disabled={busy === r.id}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
                          <User className="h-4 w-4" />Sitzt jetzt
                        </button>
                      )}
                      {r.status === 'platziert' && (
                        <button onClick={() => setStatus(r.id, 'beendet')} disabled={busy === r.id}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-zinc-700 text-white text-sm font-bold hover:bg-zinc-800 disabled:opacity-50">
                          <Check className="h-4 w-4" />Beenden
                        </button>
                      )}
                      {(r.status === 'angefragt' || r.status === 'bestaetigt' || r.status === 'wartet') && (
                        <button onClick={() => setStatus(r.id, 'storniert')} disabled={busy === r.id}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border-2 border-red-300 text-red-700 text-sm font-bold hover:bg-red-50 disabled:opacity-50">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
