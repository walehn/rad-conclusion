import { describe, expect, it } from 'vitest';
import { formatBuildDate } from '@/lib/build-info';

describe('formatBuildDate', () => {
  it('formats in Korean time as YYYY-MM-DD', () => {
    expect(formatBuildDate('2026-11-10T07:30:00Z')).toBe('2026-11-10');
    // 16:00 UTC is already the next day in Seoul.
    expect(formatBuildDate('2026-11-10T16:00:00Z')).toBe('2026-11-11');
  });

  it('returns an empty string when unknown', () => {
    expect(formatBuildDate('')).toBe('');
    expect(formatBuildDate('not a date')).toBe('');
  });
});
