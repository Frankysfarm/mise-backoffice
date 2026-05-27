'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { TableStorefront } from '@/app/t/[token]/storefront';

type Location = {
  id: string;
  name: string;
  adresse: string | null;
  stadt: string | null;
  plz: string | null;
  tenant_id: string;
};

type Tenant = {
  name: string;
  slug: string;
  logo_url: string | null;
  hero_image_url: string | null;
  storefront_theme_id: string | null;
  theme_primary: string | null;
  theme_accent: string | null;
};

type Table = { id: string; nummer: string; name: string | null; bereich: string | null };

export function UniversalStorefront({
  location, tenant, categories, items, tables, relations,
}: {
  location: Location;
  tenant: Tenant;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  tables: Table[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  relations: any[];
}) {
  const [pickedTable, setPickedTable] = useState<Table | null>(null);
  const [manualNummer, setManualNummer] = useState('');

  const primary = tenant.theme_primary ?? '#14532d';
  const accent = tenant.theme_accent ?? '#4ae68a';

  // Wenn Tisch bereits gewählt → zeige Storefront (mit virtual "table" object)
  if (pickedTable) {
    return (
      <TableStorefront
        table={{
          id: pickedTable.id,
          nummer: pickedTable.nummer,
          name: pickedTable.name,
          bereich: pickedTable.bereich,
          tenant_id: location.tenant_id,
          location_id: location.id,
        }}
        tenant={tenant as any}
        location={{
          name: location.name,
          adresse: location.adresse,
          stadt: location.stadt,
          plz: location.plz,
        } as any}
        categories={categories}
        items={items}
        relations={relations}
      />
    );
  }

  // Table-Picker
  const bereiche = Array.from(new Set(tables.map((t) => t.bereich).filter(Boolean))) as string[];
  const [selectedBereich, setSelectedBereich] = useState<string>(bereiche[0] ?? 'all');
  const filtered = !selectedBereich || selectedBereich === 'all'
    ? tables
    : tables.filter((t) => t.bereich === selectedBereich);

  function submitManual() {
    const trimmed = manualNummer.trim();
    if (!trimmed) return;
    const match = tables.find((t) => t.nummer.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      setPickedTable(match);
    } else {
      // Kunde gibt Nummer ein, auch wenn Tisch nicht in DB
      setPickedTable({
        id: 'manual',
        nummer: trimmed,
        name: null,
        bereich: null,
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: primary, color: 'white' }}>
      {/* Hero */}
      <header className="relative p-5 pt-8">
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl opacity-25" style={{ background: accent }} />
        <div className="relative flex items-center gap-3">
          {tenant.logo_url ? (
            <Image src={tenant.logo_url} width={48} height={48} alt={tenant.name} className="rounded-xl ring-2 ring-white/20" unoptimized />
          ) : (
            <div className="h-12 w-12 rounded-xl grid place-items-center font-display font-black text-lg ring-2 ring-white/20" style={{ background: accent, color: primary }}>
              {tenant.name[0]}
            </div>
          )}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-70">{location.stadt || 'Restaurant'}</div>
            <div className="font-display text-xl font-black">{tenant.name}</div>
          </div>
        </div>

        <div className="relative mt-8 max-w-lg">
          <h1 className="font-display text-3xl sm:text-4xl font-black leading-tight">
            An welchem Tisch<br />sitzt du?
          </h1>
          <p className="text-sm opacity-80 mt-2 max-w-xs">
            Tipp die Nummer deines Tisches ein oder wähle ihn aus der Liste.
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 bg-white rounded-t-3xl -mt-2 text-gray-900 p-5 pb-8">
        {/* Manual input */}
        <div className="max-w-md mx-auto">
          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 block text-center mb-2">
            Tisch-Nummer
          </label>
          <div className="flex items-stretch gap-2">
            <input
              value={manualNummer}
              onChange={(e) => setManualNummer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitManual()}
              inputMode="numeric"
              placeholder="12"
              className="flex-1 h-20 rounded-2xl border-4 bg-white px-4 font-display text-4xl font-black text-center focus:outline-none focus:ring-4 transition"
              style={{ borderColor: manualNummer ? primary : '#e5e7eb' }}
              autoFocus
            />
            <button
              onClick={submitManual}
              disabled={!manualNummer.trim()}
              className="h-20 w-20 rounded-2xl grid place-items-center disabled:opacity-30"
              style={{ background: primary, color: 'white' }}
            >
              <ArrowRight className="h-7 w-7" />
            </button>
          </div>
        </div>

        {/* Tisch-Grid */}
        {tables.length > 0 && (
          <div className="mt-8 max-w-lg mx-auto">
            <div className="text-center text-xs text-gray-500 mb-3 inline-flex items-center gap-2 justify-center w-full">
              <div className="h-px flex-1 bg-gray-200" />
              <span>oder direkt antippen</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {bereiche.length > 1 && (
              <div className="flex gap-1 justify-center flex-wrap mb-3">
                <button
                  onClick={() => setSelectedBereich('all')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    selectedBereich === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100'
                  }`}
                >
                  Alle
                </button>
                {bereiche.map((b) => (
                  <button
                    key={b}
                    onClick={() => setSelectedBereich(b)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                      selectedBereich === b ? 'bg-gray-900 text-white' : 'bg-gray-100'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPickedTable(t)}
                  className="aspect-square rounded-2xl border-2 bg-white hover:bg-gray-50 active:scale-95 transition font-display font-black text-2xl"
                  style={{ borderColor: '#e5e7eb' }}
                >
                  {t.nummer}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-500">
          Findest du deine Nummer nicht? Frag kurz das Personal.
        </div>
      </main>
    </div>
  );
}
