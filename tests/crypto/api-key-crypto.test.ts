import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  getEncryptionKey,
} from '@/lib/crypto/api-key-crypto';

describe('api-key-crypto', () => {
  beforeEach(() => {
    vi.stubEnv('API_KEY_ENCRYPTION_SECRET', 'test-secret-for-unit-tests-must-be-long-enough');
  });

  describe('encryptApiKey / decryptApiKey roundtrip', () => {
    it('decrypts back to the original plaintext', () => {
      const original = 'sk-test-1234567890abcdef';
      const encrypted = encryptApiKey(original);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(original);
    });

    it('handles an empty string roundtrip', () => {
      const original = '';
      const encrypted = encryptApiKey(original);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(original);
    });

    it('handles unicode characters in the key', () => {
      const original = 'sk-テスト-key-12345';
      const encrypted = encryptApiKey(original);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(original);
    });
  });

  describe('encryptApiKey uniqueness', () => {
    it('produces different ciphertext for the same input on each call (different IV)', () => {
      const plaintext = 'sk-test-same-input';
      const enc1 = encryptApiKey(plaintext);
      const enc2 = encryptApiKey(plaintext);
      expect(enc1).not.toBe(enc2);
    });

    it('stores format as ivHex:encryptedHex:authTagHex (3 colon-separated parts)', () => {
      const encrypted = encryptApiKey('sk-test-key');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      // Each part should be non-empty hex strings
      for (const part of parts) {
        expect(part).toMatch(/^[0-9a-f]+$/);
      }
    });

    it('IV part is 24 hex chars (12 bytes)', () => {
      const encrypted = encryptApiKey('sk-test-key');
      const [ivHex] = encrypted.split(':');
      expect(ivHex).toHaveLength(24);
    });
  });

  describe('maskApiKey', () => {
    it('masks a long key showing only last 4 chars', () => {
      expect(maskApiKey('sk-1234567890abcd')).toBe('****abcd');
    });

    it('masks a key of exactly 4 chars', () => {
      expect(maskApiKey('abcd')).toBe('****abcd');
    });

    it('returns **** for a key shorter than 4 chars', () => {
      expect(maskApiKey('abc')).toBe('****');
      expect(maskApiKey('a')).toBe('****');
      expect(maskApiKey('')).toBe('****');
    });

    it('masks a typical OpenAI key format', () => {
      const result = maskApiKey('sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1234');
      expect(result).toBe('****1234');
    });
  });

  describe('missing env var', () => {
    it('throws when API_KEY_ENCRYPTION_SECRET is not set', () => {
      vi.stubEnv('API_KEY_ENCRYPTION_SECRET', '');
      expect(() => getEncryptionKey()).toThrow('API_KEY_ENCRYPTION_SECRET is not configured');
    });

    it('throws on encryptApiKey when secret is missing', () => {
      vi.stubEnv('API_KEY_ENCRYPTION_SECRET', '');
      expect(() => encryptApiKey('test')).toThrow('API_KEY_ENCRYPTION_SECRET is not configured');
    });

    it('throws on decryptApiKey when secret is missing', () => {
      // First encrypt with valid secret
      vi.stubEnv('API_KEY_ENCRYPTION_SECRET', 'test-secret-for-unit-tests-must-be-long-enough');
      const encrypted = encryptApiKey('test-key');

      // Then try to decrypt without secret
      vi.stubEnv('API_KEY_ENCRYPTION_SECRET', '');
      expect(() => decryptApiKey(encrypted)).toThrow('API_KEY_ENCRYPTION_SECRET is not configured');
    });
  });

  describe('decryptApiKey error handling', () => {
    it('throws on invalid format (not 3 parts)', () => {
      expect(() => decryptApiKey('onlytwoparts:here')).toThrow('Invalid encrypted key format');
      expect(() => decryptApiKey('justonepart')).toThrow('Invalid encrypted key format');
    });

    it('throws on tampered ciphertext (auth tag mismatch)', () => {
      const encrypted = encryptApiKey('sk-original-key');
      // Tamper with the middle part (encrypted data)
      const parts = encrypted.split(':');
      parts[1] = 'deadbeef' + parts[1].slice(8);
      const tampered = parts.join(':');
      expect(() => decryptApiKey(tampered)).toThrow();
    });
  });
});
