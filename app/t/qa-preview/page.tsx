import { notFound } from 'next/navigation';
import { TableStorefront } from '../[token]/storefront';

export const dynamic = 'force-dynamic';

export default function TableOrderQaPage() {
  if (process.env.MISE_E2E_TABLE_ORDER !== '1') notFound();

  const categories = [
    { id: 'burgers', name: 'Burger', icon: '🍔', sort_order: 1 },
    { id: 'bowls', name: 'Bowls', icon: '🥣', sort_order: 2 },
    { id: 'drinks', name: 'Drinks', icon: '🥤', sort_order: 3 },
    { id: 'sides', name: 'Sides', icon: '🍟', sort_order: 4 },
  ];

  const items = [
    {
      id: 'smash-burger',
      name: 'Franky’s Smash Burger',
      beschreibung: 'Doppelt gesmasht, Cheddar, hausgemachte Sauce und Gurken.',
      preis: 13.9,
      bild_url: null,
      category_id: 'burgers',
      beliebt: true,
      allergene: ['Gluten', 'Milch'],
      tags: ['Bestseller'],
      extras: {},
      option_groups: null,
    },
    {
      id: 'acai-bowl',
      name: 'Açaí Power Bowl',
      beschreibung: 'Açaí, Banane, Beeren, Granola und Kokos.',
      preis: 11.5,
      bild_url: null,
      category_id: 'bowls',
      beliebt: true,
      allergene: ['Nüsse'],
      tags: ['Vegan', 'Fresh'],
      extras: {},
      option_groups: [
        {
          id: 'base',
          name: 'Basis',
          type: 'single',
          required: true,
          options: [
            { id: 'classic', name: 'Classic Açaí', priceDelta: 0, default: true },
            { id: 'protein', name: 'Protein Açaí', priceDelta: 1.5 },
          ],
        },
        {
          id: 'toppings',
          name: 'Extra Toppings',
          type: 'multi',
          max: 2,
          options: [
            { id: 'pistachio', name: 'Pistaziensauce', priceDelta: 1 },
            { id: 'berries', name: 'Extra Beeren', priceDelta: 1.2 },
          ],
        },
      ],
    },
    {
      id: 'matcha',
      name: 'Iced Strawberry Matcha',
      beschreibung: 'Premium Matcha, Erdbeerpüree und Haferdrink.',
      preis: 6.9,
      bild_url: null,
      category_id: 'drinks',
      beliebt: true,
      allergene: [],
      tags: ['Vegan', 'Cold'],
      extras: {},
      option_groups: null,
    },
    {
      id: 'lemonade',
      name: 'Homemade Lemonade',
      beschreibung: 'Zitrone, Minze und Soda.',
      preis: 4.9,
      bild_url: null,
      category_id: 'drinks',
      beliebt: false,
      allergene: [],
      tags: ['Vegan'],
      extras: {},
      option_groups: null,
    },
    {
      id: 'fries',
      name: 'Truffle Fries',
      beschreibung: 'Knusprige Fries, Trüffel und Parmesan.',
      preis: 5.9,
      bild_url: null,
      category_id: 'sides',
      beliebt: true,
      allergene: ['Milch'],
      tags: ['Cross-Sell'],
      extras: {},
      option_groups: null,
    },
    {
      id: 'cheesecake',
      name: 'San Sebastian Cheesecake',
      beschreibung: 'Cremig gebacken mit karamellisierter Oberfläche.',
      preis: 6.5,
      bild_url: null,
      category_id: 'sides',
      beliebt: false,
      allergene: ['Ei', 'Milch'],
      tags: ['Dessert'],
      extras: {},
      option_groups: null,
    },
  ];

  return (
    <TableStorefront
      table={{
        id: '00000000-0000-4000-8000-000000000012',
        nummer: '12',
        name: 'Fensterplatz',
        bereich: 'Gastraum',
        tenant_id: '00000000-0000-4000-8000-000000000001',
        location_id: '00000000-0000-4000-8000-000000000002',
      }}
      tenant={{
        name: 'Franky’s Farm',
        slug: 'frankys-farm',
        logo_url: null,
        hero_image_url: null,
        storefront_theme_id: null,
        theme_primary: '#102f27',
        theme_accent: '#d7ff43',
        qr_theme_primary: '#102f27',
        qr_theme_accent: '#d7ff43',
        qr_welcome_text: 'Bestell direkt am Tisch. Frisch gemacht, ohne Anstehen.',
        qr_cta_label: 'Bestellung prüfen',
      }}
      location={{
        name: 'Franky’s Aachen',
        adresse: 'Markt 1',
        stadt: 'Aachen',
        plz: '52062',
      }}
      categories={categories}
      items={items}
      relations={[
        { item_id: 'smash-burger', related_item_id: 'fries', typ: 'crosssell', sort_order: 1 },
        { item_id: 'smash-burger', related_item_id: 'lemonade', typ: 'crosssell', sort_order: 2 },
        { item_id: 'acai-bowl', related_item_id: 'matcha', typ: 'crosssell', sort_order: 1 },
      ]}
      orderToken="qa-table-token"
    />
  );
}
