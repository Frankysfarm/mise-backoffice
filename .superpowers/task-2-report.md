# Task 2 Fix Report — items-selector.tsx

**Date:** 2026-06-28  
**Commit:** b6941ea

## Changes Made

### 1. Checkbox Component (CRITICAL) ✅
- Installed `@radix-ui/react-checkbox` package
- Created `/opt/mise/backoffice/components/ui/checkbox.tsx` — standard shadcn/ui Checkbox component using Radix UI primitives, matching project's existing component patterns (see `switch.tsx`)
- Replaced all `<input type="checkbox">` usage in `items-selector.tsx` with `<Checkbox id="..." checked={isSelected} onCheckedChange={() => onSelectionChange(item.id)} />`

### 2. Category Display (HIGH) ✅
- Added `formatCategoryName(categoryId: string): string` utility function
- Strips `cat-` / `category-` prefix
- Converts hyphens/underscores to spaces and title-cases each word
- Falls back to raw ID for UUIDs
- Examples: `"cat-pizza"` → `"Pizza"`, `"cat-soft-drinks"` → `"Soft Drinks"`, UUID → unchanged
- Component prop interface (`ItemsSelectorProps`) unchanged — no new props required

### 3. Test Configuration (CRITICAL) ✅
- Installed: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- Created `vitest.config.ts` with jsdom environment, `@/` path alias, and `tests/setup.ts` setup file
- Added `"test": "vitest run"` to `package.json` scripts
- Rewrote `tests/loyalty/items-selector.test.ts` using React Testing Library `render()` + `screen`

### 4. Price Formatting (MINOR) ✅
- Changed from `toLocaleString('de-DE')` with `€` suffix (`"12,50 €"`) to `€${price.toFixed(2)}` prefix format (`"€12.50"`)

## Test Results

```
✓ tests/loyalty/items-selector.test.ts (6 tests) 397ms

 Test Files  1 passed (1)
       Tests  6 passed (6)
    Duration  2.59s
```

### Tests verified:
1. **renders item names and prices** — all 4 items visible, prices in `€X.XX` format
2. **reflects selected state in checkboxes** — `data-state=checked/unchecked` on Radix Checkbox
3. **calls onSelectionChange when checkbox is clicked** — callback receives correct item id
4. **groups items by category and shows formatted names** — "Pizza", "Pasta", "Drinks" visible; "cat-pizza" etc not shown
5. **shows empty state** — "Keine Artikel verfügbar" when no items
6. **handles null category_id** — no crash, item renders normally
