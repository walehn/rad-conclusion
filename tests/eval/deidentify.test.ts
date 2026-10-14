import { describe, it, expect } from 'vitest';
import { deidentify } from '@/lib/eval/deidentify';

describe('lib/eval/deidentify', () => {
  it('replaces dates in every common format', () => {
    const { texts } = deidentify([
      '2026-9-18 CT, 2026.09.18 MRI, 2025년 3월 2일, 9/18/2026, September 16, 2025, 2024-05',
    ]);
    expect(texts[0]).not.toMatch(/\d{4}/);
    expect(texts[0]).not.toMatch(/September/);
  });

  it('shares one placeholder per distinct value across texts', () => {
    const { texts } = deidentify(['Compared with 2025-09-16 CT', 'Stable since 2025-09-16.']);
    expect(texts[0]).toContain('[DATE1]');
    expect(texts[1]).toContain('[DATE1]');
  });

  it('replaces registration numbers but keeps measurements and segments', () => {
    const { texts, replaced } = deidentify(['42238042\nLiver S7에 2.3 x 1.5 cm mass, LI-RADS 4']);
    expect(texts[0]).toContain('[ID1]');
    expect(texts[0]).toContain('S7에 2.3 x 1.5 cm mass, LI-RADS 4');
    expect(replaced.id).toBe(1);
  });

  it('replaces named hospitals but keeps generic references', () => {
    const { texts } = deidentify(['renal cyst f/u (서울대병원). 타병원 수술. Initial CT in our hospital.']);
    expect(texts[0]).toContain('([HOSPITAL1])');
    expect(texts[0]).toContain('타병원');
    expect(texts[0]).toContain('our hospital');
  });
});
