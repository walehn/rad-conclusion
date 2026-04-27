import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Returns a 32-byte encryption key derived from API_KEY_ENCRYPTION_SECRET env var.
 * Throws if the env var is not set.
 */
export function getEncryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET is not configured');
  }
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext API key using AES-256-GCM.
 * Returns a string in the format: "{ivHex}:{encryptedHex}:{authTagHex}"
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted API key.
 * Expects format: "{ivHex}:{encryptedHex}:{authTagHex}"
 * Throws on invalid format, wrong key, or authentication failure.
 */
export function decryptApiKey(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format');
  }

  const [ivHex, encryptedHex, authTagHex] = parts;
  const key = getEncryptionKey();

  const iv = Buffer.from(ivHex, 'hex');
  const encryptedData = Buffer.from(encryptedHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Masks an API key showing only the last 4 characters.
 * Returns "****" for keys shorter than 4 characters.
 */
export function maskApiKey(key: string): string {
  if (key.length < 4) {
    return '****';
  }
  return '****' + key.slice(-4);
}
