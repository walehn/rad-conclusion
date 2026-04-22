import { hash, verify } from '@node-rs/argon2';

/**
 * Precomputed argon2id hash of a fixed dummy password.
 * Used to run verify() against a real hash when the lookup email does not exist,
 * so that response timing does not leak user existence. Do not reuse as a real password.
 */
export const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$+tDE75as/U/ryffkmt9elA$WKaXw8qhYSAXnqGUVbqQEP2nP9s27VnNpBUtirfwES8';

/** Hashes a plaintext password with argon2id using the library defaults (OWASP 2024 aligned). */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/** Verifies a plaintext password against a stored argon2id hash. */
export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  return verify(storedHash, plain);
}
