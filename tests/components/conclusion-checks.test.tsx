// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { ConclusionChecks, checkConclusion } from '@/components/conclusion-checks';

const show = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

const FINDINGS = 'Liver S7에 0.9cm 크기의 arterial enhancing lesion 있고, washout보여 HCC 가능성 있음.';
const base = { findings: FINDINGS, style: 'numbered', lang: 'en' };

afterEach(cleanup);

describe('components/conclusion-checks', () => {
  it('shows nothing for a conclusion the Findings support', () => {
    show(<ConclusionChecks {...base} conclusion="1. 0.9 cm S7 lesion, probably HCC." />);
    expect(screen.queryByText('Check before signing')).toBeNull();
  });

  it('flags a change word without a stated prior and an added recommendation', () => {
    show(<ConclusionChecks {...base} conclusion="1. 0.9 cm S7 lesion, unchanged; probably HCC — MRI recommended." />);
    expect(screen.getByText('Check before signing')).toBeTruthy();
    expect(screen.getByText('Change word, but Findings state no prior')).toBeTruthy();
    expect(screen.getByText('Recommendation not in Findings')).toBeTruthy();
  });

  it('lists content problems before format problems and skips empty output', () => {
    const flags = checkConclusion({ ...base, conclusion: 'Left 2.4 cm S7 lesion, unchanged.' });
    expect(flags[0].severity).toBe('suspect');
    expect(flags.at(-1)?.kind).toBe('format_not_numbered');
    expect(checkConclusion({ ...base, conclusion: '  ' })).toEqual([]);
  });
});
