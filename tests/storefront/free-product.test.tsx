import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FreeProductBanner } from '@/app/order/[locationSlug]/components/free-product-banner';
import { FreeProductPopup } from '@/app/order/[locationSlug]/components/free-product-popup';

const items = [
  { id: 'pizza', name: 'Pizza Margherita', preis: 12.5 },
  { id: 'pasta', name: 'Pasta Napoli', preis: 10.9 },
];

describe('FreeProductBanner', () => {
  it('shows the remaining amount while the promotion is locked', () => {
    render(
      <FreeProductBanner
        eligibleItems={items}
        selectedItemId={null}
        onSelect={vi.fn()}
        triggerAbBetrag={50}
        currentSubtotal={42.5}
      />,
    );

    expect(screen.getByText('Noch €7.50')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pizza Margherita/i })).not.toBeInTheDocument();
  });

  it('unlocks choices at the threshold and reports the selected item', () => {
    const onSelect = vi.fn();
    render(
      <FreeProductBanner
        eligibleItems={items}
        selectedItemId="pizza"
        onSelect={onSelect}
        triggerAbBetrag={50}
        currentSubtotal={50}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Pasta Napoli/i }));
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it('renders nothing without eligible products', () => {
    const { container } = render(
      <FreeProductBanner
        eligibleItems={[]}
        selectedItemId={null}
        onSelect={vi.fn()}
        currentSubtotal={100}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('FreeProductPopup', () => {
  it('closes after selecting a product', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <FreeProductPopup
        open
        onClose={onClose}
        onSelect={onSelect}
        eligibleItems={items}
        alreadySelected={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Pizza Margherita/i }));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing while closed', () => {
    const { container } = render(
      <FreeProductPopup
        open={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        eligibleItems={items}
        alreadySelected={null}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
