import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ItemsSelector } from '@/app/(neo)/neo/app/loyalty/components/items-selector';
import { LoyaltyProgramItem } from '@/lib/loyalty/types';

interface MenuItem {
  id: string;
  name: string;
  preis: number;
  category_id: string | null;
  beschreibung?: string | null;
  verfuegbar?: boolean;
}

const mockMenuItems: MenuItem[] = [
  { id: '1', name: 'Pizza Margherita', preis: 12.5, category_id: 'cat-pizza' },
  { id: '2', name: 'Pizza Quattro Formaggi', preis: 15.9, category_id: 'cat-pizza' },
  { id: '3', name: 'Pasta Carbonara', preis: 14.5, category_id: 'cat-pasta' },
  { id: '4', name: 'Cola 0.5l', preis: 3.5, category_id: 'cat-drinks' },
];

describe('ItemsSelector', () => {
  it('renders item names and prices', () => {
    render(
      React.createElement(ItemsSelector, {
        menuItems: mockMenuItems,
        selectedItems: [],
        onSelectionChange: vi.fn(),
      })
    );

    expect(screen.getByText('Pizza Margherita')).toBeInTheDocument();
    expect(screen.getByText('Pizza Quattro Formaggi')).toBeInTheDocument();
    expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument();
    expect(screen.getByText('Cola 0.5l')).toBeInTheDocument();

    // Prices are shown with € prefix
    expect(screen.getByText('€12.50')).toBeInTheDocument();
    expect(screen.getByText('€15.90')).toBeInTheDocument();
    expect(screen.getByText('€14.50')).toBeInTheDocument();
    expect(screen.getByText('€3.50')).toBeInTheDocument();
  });

  it('reflects selected state in checkboxes', () => {
    const selectedItems: LoyaltyProgramItem[] = [
      {
        id: 'prog-item-1',
        program_id: 'prog-1',
        rule_id: 'rule-1',
        menu_item_id: '1',
        is_optional: true,
        max_quantity_per_redemption: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    render(
      React.createElement(ItemsSelector, {
        menuItems: mockMenuItems,
        selectedItems,
        onSelectionChange: vi.fn(),
      })
    );

    // Item 1 should be checked
    const item1Checkbox = document.getElementById('item-1');
    expect(item1Checkbox).toHaveAttribute('data-state', 'checked');

    // Item 2 should be unchecked
    const item2Checkbox = document.getElementById('item-2');
    expect(item2Checkbox).toHaveAttribute('data-state', 'unchecked');
  });

  it('calls onSelectionChange when checkbox is clicked', () => {
    const mockCallback = vi.fn();

    render(
      React.createElement(ItemsSelector, {
        menuItems: mockMenuItems,
        selectedItems: [],
        onSelectionChange: mockCallback,
      })
    );

    const item1Checkbox = document.getElementById('item-1');
    expect(item1Checkbox).not.toBeNull();
    fireEvent.click(item1Checkbox!);

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith('1');
  });

  it('groups items by category and shows formatted category names', () => {
    render(
      React.createElement(ItemsSelector, {
        menuItems: mockMenuItems,
        selectedItems: [],
        onSelectionChange: vi.fn(),
      })
    );

    // Category headers should show formatted names, not raw IDs
    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText('Pasta')).toBeInTheDocument();
    expect(screen.getByText('Drinks')).toBeInTheDocument();

    // Raw category IDs should NOT appear as headings
    expect(screen.queryByText('cat-pizza')).not.toBeInTheDocument();
    expect(screen.queryByText('cat-pasta')).not.toBeInTheDocument();
  });

  it('shows empty state when no menu items provided', () => {
    render(
      React.createElement(ItemsSelector, {
        menuItems: [],
        selectedItems: [],
        onSelectionChange: vi.fn(),
      })
    );

    expect(screen.getByText('Keine Artikel verfügbar')).toBeInTheDocument();
  });

  it('handles items with null category_id without crashing', () => {
    const itemsWithNullCat: MenuItem[] = [
      { id: '1', name: 'Uncategorized Item', preis: 10.0, category_id: null },
    ];

    render(
      React.createElement(ItemsSelector, {
        menuItems: itemsWithNullCat,
        selectedItems: [],
        onSelectionChange: vi.fn(),
      })
    );

    expect(screen.getByText('Uncategorized Item')).toBeInTheDocument();
  });
});
