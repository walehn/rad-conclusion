import { describe, it, expect } from 'vitest';
import { findingsProblem, findingsWordCount } from '@/lib/findings-check';

describe('lib/findings-check', () => {
  it('rejects empty input, a pasted ID and a stray keystroke', () => {
    expect(findingsProblem('   ')).toMatch(/enter the Findings/);
    expect(findingsProblem('12345678')).toMatch(/no descriptive text/);
    expect(findingsProblem('ㅇ')).toMatch(/no descriptive text/);
    expect(findingsProblem('A 1')).toMatch(/no descriptive text/);
  });

  it('accepts short but real findings in English or Korean', () => {
    expect(findingsProblem('GB sludge.')).toBeNull();
    expect(findingsProblem('담낭 결석 있음')).toBeNull();
    expect(findingsWordCount('Liver S7에 0.9cm lesion')).toBe(3);
  });
});
