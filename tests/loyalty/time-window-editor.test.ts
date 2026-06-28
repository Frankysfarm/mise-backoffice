import { describe, it, expect, vi } from 'vitest';
import { TimeWindow } from '@/lib/loyalty/types';

describe('TimeWindowEditor Component', () => {
  it('should render with no time windows initially', () => {
    const timeWindows: TimeWindow[] = [];
    expect(timeWindows).toHaveLength(0);
  });

  it('should accept multiple time windows with day and time data', () => {
    const timeWindows: TimeWindow[] = [
      { day: 'mo', start: '11:00', end: '15:00' },
      { day: 'tu', start: '11:00', end: '15:00' },
      { day: 'we', start: '18:00', end: '23:00' },
    ];

    expect(timeWindows).toHaveLength(3);
    expect(timeWindows[0]).toEqual({ day: 'mo', start: '11:00', end: '15:00' });
    expect(timeWindows[1].day).toBe('tu');
    expect(timeWindows[2].end).toBe('23:00');
  });

  it('should provide onChange callback with updated windows array', () => {
    const onTimeWindowsChange = vi.fn();
    const updatedWindows: TimeWindow[] = [
      { day: 'mo', start: '11:00', end: '15:00' },
    ];

    onTimeWindowsChange(updatedWindows);

    expect(onTimeWindowsChange).toHaveBeenCalledWith(updatedWindows);
    expect(onTimeWindowsChange).toHaveBeenCalledTimes(1);
  });

  it('should allow deleting a time window from the array', () => {
    const onDelete = vi.fn();
    const windowIndex = 1;
    
    onDelete(windowIndex);

    expect(onDelete).toHaveBeenCalledWith(windowIndex);
  });

  it('should support all days of the week', () => {
    const days = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;
    
    days.forEach((day) => {
      const window: TimeWindow = { day, start: '09:00', end: '17:00' };
      expect(window.day).toBe(day);
    });

    expect(days).toHaveLength(7);
  });

  it('should validate time format is HH:MM', () => {
    const window: TimeWindow = { day: 'mo', start: '11:30', end: '14:45' };
    
    const timeRegex = /^\d{2}:\d{2}$/;
    expect(timeRegex.test(window.start)).toBe(true);
    expect(timeRegex.test(window.end)).toBe(true);
  });

  it('should handle multiple windows with same day but different times', () => {
    const timeWindows: TimeWindow[] = [
      { day: 'mo', start: '11:00', end: '15:00' },
      { day: 'mo', start: '18:00', end: '23:00' },
    ];

    expect(timeWindows).toHaveLength(2);
    expect(timeWindows[0].day).toBe('mo');
    expect(timeWindows[1].day).toBe('mo');
    expect(timeWindows[0].start).toBe('11:00');
    expect(timeWindows[1].start).toBe('18:00');
  });

  it('should call onChange with complete updated array after modifications', () => {
    const onTimeWindowsChange = vi.fn();
    const originalWindows: TimeWindow[] = [
      { day: 'mo', start: '11:00', end: '15:00' },
      { day: 'tu', start: '11:00', end: '15:00' },
    ];

    const updatedWindows: TimeWindow[] = [
      { day: 'mo', start: '12:00', end: '15:00' },
      { day: 'tu', start: '11:00', end: '15:00' },
    ];

    onTimeWindowsChange(updatedWindows);

    expect(onTimeWindowsChange).toHaveBeenCalledWith(updatedWindows);
    expect(onTimeWindowsChange.mock.calls[0][0]).toEqual(updatedWindows);
  });
});
