import { describe, expect, it } from 'vitest';
import {
  canManageProviders,
  canUseProvider,
  canViewAllGenerations,
  countsInEvaluation,
  DEFAULT_ROLE,
  isRole,
} from '@/lib/auth/roles';

describe('lib/auth/roles', () => {
  it('recognises only the defined roles', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('restricted')).toBe(true);
    expect(isRole('Admin')).toBe(false);
    expect(isRole('')).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(1)).toBe(false);
  });

  it('defaults to the least-privileged role', () => {
    expect(DEFAULT_ROLE).toBe('restricted');
  });

  it('admin may use every provider', () => {
    for (const p of ['local', 'openai', 'anthropic', 'google'] as const) {
      expect(canUseProvider('admin', p)).toBe(true);
    }
  });

  it('restricted may use only the local model', () => {
    expect(canUseProvider('restricted', 'local')).toBe(true);
    for (const p of ['openai', 'anthropic', 'google'] as const) {
      expect(canUseProvider('restricted', p)).toBe(false);
    }
  });

  it('only admin reads all history, manages providers, and counts in evaluation', () => {
    expect(canViewAllGenerations('admin')).toBe(true);
    expect(canViewAllGenerations('restricted')).toBe(false);
    expect(canManageProviders('admin')).toBe(true);
    expect(canManageProviders('restricted')).toBe(false);
    expect(countsInEvaluation('admin')).toBe(true);
    expect(countsInEvaluation('restricted')).toBe(false);
  });
});
