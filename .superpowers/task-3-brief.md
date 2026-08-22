### Task 3: Time-Window Editor Component

**Files:**
- Create: `app/(neo)/neo/app/loyalty/components/time-window-editor.tsx`
- Modify: `app/(neo)/neo/app/loyalty/[programId]/page.tsx`
- Test: `tests/loyalty/time-window-editor.test.ts`

**Interfaces:**
- Consumes: TimeWindow[] type from lib/loyalty/types.ts
- Produces: TimeWindowEditor component, onTimeWindowsChange callback
- No new APIs needed (updates existing rule via PUT)

**Summary:**
Allow configuring when a rule applies (e.g., lunch 11-15h, dinner 18-23h). Day selector (Mo-So) + time inputs. Multiple windows per rule. Visual day/time grid display.

[Full task steps included with test code, implementation code, and commit instructions]
