import { describe, it, expect } from 'vitest';
import {
  CURRENT_PROMPT_REVISION,
  PROMPT_REVISIONS,
  UNREGISTERED_REVISION_ID,
  findPromptRevision,
} from '@/lib/prompts/revisions';
import {
  PROMPT_HASH_LENGTH,
  computePromptFingerprint,
  resolveActivePromptRevision,
} from '@/lib/prompts/fingerprint';

describe('lib/prompts/revisions', () => {
  // This is the guard that makes prompt history trustworthy: editing
  // system-prompt.ts without registering a revision fails the suite, so no
  // generation can be recorded under a revision id that describes other text.
  it('registers the prompt text currently rendered by the code', () => {
    const fingerprint = computePromptFingerprint();
    const match = PROMPT_REVISIONS.find((r) => r.fingerprint === fingerprint);

    expect(
      match,
      [
        '',
        `The conclusion prompts render as ${fingerprint}, which matches no`,
        'entry in lib/prompts/revisions.ts.',
        '',
        'If you changed lib/prompts/system-prompt.ts on purpose, run',
        '`npm run prompt:revision` and append the entry it prints.',
        'Never edit an existing entry: old generation rows point at it.',
        '',
      ].join('\n')
    ).toBeDefined();
  });

  it('treats the newest entry as the active revision', () => {
    expect(CURRENT_PROMPT_REVISION.fingerprint).toBe(
      computePromptFingerprint()
    );
    expect(CURRENT_PROMPT_REVISION.id).toBe(
      PROMPT_REVISIONS[PROMPT_REVISIONS.length - 1].id
    );
  });

  it('stamps generations with the matching revision id and hash', () => {
    const { revisionId, promptHash } = resolveActivePromptRevision();
    expect(revisionId).toBe(CURRENT_PROMPT_REVISION.id);
    expect(revisionId).not.toBe(UNREGISTERED_REVISION_ID);
    expect(promptHash).toBe(CURRENT_PROMPT_REVISION.fingerprint);
  });

  it('keeps revision ids unique so history rows resolve to one entry', () => {
    const ids = PROMPT_REVISIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(UNREGISTERED_REVISION_ID);
  });

  it('keeps fingerprints unique so two revisions are never the same text', () => {
    const hashes = PROMPT_REVISIONS.map((r) => r.fingerprint);
    expect(new Set(hashes).size).toBe(hashes.length);
    for (const hash of hashes) {
      expect(hash).toMatch(
        new RegExp(`^[0-9a-f]{${PROMPT_HASH_LENGTH}}$`)
      );
    }
  });

  it('orders revisions oldest first by date', () => {
    const dates = PROMPT_REVISIONS.map((r) => r.date);
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect([...dates].sort()).toEqual(dates);
  });

  it('requires a summary on every revision, and changes on non-base ones', () => {
    PROMPT_REVISIONS.forEach((rev, index) => {
      expect(rev.summary.trim().length, `${rev.id} summary`).toBeGreaterThan(0);
      if (index > 0) {
        // The base revision has nothing to diff against; later ones must say
        // what moved, or the history is just a list of opaque hashes.
        expect(rev.changes.length, `${rev.id} changes`).toBeGreaterThan(0);
      }
    });
  });

  it('resolves ids for the review screen and ignores unknown ones', () => {
    expect(findPromptRevision(CURRENT_PROMPT_REVISION.id)).toEqual(
      CURRENT_PROMPT_REVISION
    );
    expect(findPromptRevision(null)).toBeUndefined();
    expect(findPromptRevision(UNREGISTERED_REVISION_ID)).toBeUndefined();
  });
});
