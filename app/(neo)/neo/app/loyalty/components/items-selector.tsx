'use client';

import { useMemo } from 'react';
import { LoyaltyProgramItem } from '@/lib/loyalty/types';

interface MenuItem {
  id: string;
  name: string;
  preis: number;
  category_id: string | null;
  beschreibung?: string | null;
  verfuegbar?: boolean;
}

interface ItemsSelectorProps {
  menuItems: MenuItem[];
  selectedItems: LoyaltyProgramItem[];
  onSelectionChange: (itemId: string) => void;
}

export function ItemsSelector({
  menuItems,
  selectedItems,
  onSelectionChange,
}: ItemsSelectorProps) {
  // Create a map of selected item IDs for quick lookup
  const selectedItemIds = useMemo(
    () => new Set(selectedItems.map((item) => item.menu_item_id)),
    [selectedItems]
  );

  // Group items by category_id
  const groupedItems = useMemo(() => {
    const groups: Map<string | null, MenuItem[]> = new Map();

    menuItems.forEach((item) => {
      const categoryId = item.category_id || '__uncategorized__';
      if (!groups.has(categoryId)) {
        groups.set(categoryId, []);
      }
      groups.get(categoryId)!.push(item);
    });

    return Array.from(groups.entries()).sort((a, b) => {
      // Move uncategorized to the end
      if (a[0] === '__uncategorized__') return 1;
      if (b[0] === '__uncategorized__') return -1;
      return 0;
    });
  }, [menuItems]);

  // Format price as EUR with 2 decimals
  const formatPrice = (price: number): string => {
    return price.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleCheckboxChange = (itemId: string) => {
    onSelectionChange(itemId);
  };

  if (menuItems.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        Keine Artikel verfügbar
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedItems.map(([categoryId, items]) => (
        <div
          key={categoryId}
          data-category-group={categoryId}
          className="bg-white rounded-lg border border-gray-200 overflow-hidden"
        >
          {categoryId !== '__uncategorized__' && (
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">
                {categoryId}
              </h3>
            </div>
          )}
          <div className="divide-y divide-gray-200">
            {items.map((item) => {
              const isSelected = selectedItemIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    id={`item-${item.id}`}
                    checked={isSelected}
                    onChange={() => handleCheckboxChange(item.id)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                  <label
                    htmlFor={`item-${item.id}`}
                    className="flex-1 cursor-pointer min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {item.name}
                      </span>
                      <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                        {formatPrice(item.preis)} €
                      </span>
                    </div>
                    {item.beschreibung && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {item.beschreibung}
                      </p>
                    )}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
