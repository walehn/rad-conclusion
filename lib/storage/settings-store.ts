import type { ProviderName, ProviderSettings } from "@/lib/providers/types";
import { PROVIDER_DEFAULTS } from "@/lib/providers/constants";

const STORAGE_KEY = "rad-conclusion-provider-settings";
const CRYPTO_KEY_NAME = "rad-conclusion-crypto-key";

// -- Encryption helpers (Web Crypto API, client-side only) --

async function getEncryptionKey(): Promise<CryptoKey> {
  // Try to retrieve from sessionStorage (persists for tab lifetime)
  const stored = globalThis.sessionStorage?.getItem(CRYPTO_KEY_NAME);
  if (stored) {
    const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", true, [
      "encrypt",
      "decrypt",
    ]);
  }

  // Generate a new key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Export and store in sessionStorage
  const exported = await crypto.subtle.exportKey("raw", key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  globalThis.sessionStorage?.setItem(CRYPTO_KEY_NAME, b64);

  return key;
}

async function encrypt(text: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  // Store as iv:ciphertext, both base64
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `${ivB64}:${ctB64}`;
}

async function decrypt(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const [ivB64, ctB64] = data.split(":");
  if (!ivB64 || !ctB64) throw new Error("Invalid encrypted data format");

  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// -- Storage types for serialization (API keys stored encrypted) --

interface StoredProviderSettings {
  id: ProviderName;
  name: string;
  enabled: boolean;
  encryptedApiKey?: string;
  hostUrl?: string;
  lastValidatedAt?: string;
}

// -- Public API --

export async function saveProviderSettings(
  settings: ProviderSettings[]
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const stored: StoredProviderSettings[] = await Promise.all(
      settings.map(async (s) => {
        const entry: StoredProviderSettings = {
          id: s.id,
          name: s.name,
          enabled: s.enabled,
          hostUrl: s.hostUrl,
          lastValidatedAt: s.lastValidatedAt,
        };
        if (s.apiKey) {
          entry.encryptedApiKey = await encrypt(s.apiKey);
        }
        return entry;
      })
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Encryption or storage failure - fail silently
    console.error("Failed to save provider settings");
  }
}

export async function loadProviderSettings(): Promise<ProviderSettings[]> {
  if (typeof window === "undefined") return getDefaultSettings();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSettings();

    const stored: StoredProviderSettings[] = JSON.parse(raw);
    if (!Array.isArray(stored)) return getDefaultSettings();

    const settingsWithNulls = await Promise.all(
      stored.map(async (s): Promise<ProviderSettings | null> => {
        const defaults = PROVIDER_DEFAULTS.find((d) => d.id === s.id);
        if (!defaults) return null;

        let apiKey: string | undefined;
        if (s.encryptedApiKey) {
          try {
            apiKey = await decrypt(s.encryptedApiKey);
          } catch {
            // Decryption failed (new session, corrupted data) - clear key
            apiKey = undefined;
          }
        }

        return {
          ...defaults,
          enabled: s.enabled,
          apiKey,
          hostUrl: s.hostUrl ?? defaults.hostUrl,
          validationStatus: "none" as const,
          lastValidatedAt: s.lastValidatedAt,
        };
      })
    );

    // Filter nulls and merge with any new defaults not in stored data
    const validSettings = settingsWithNulls.filter(
      (s): s is ProviderSettings => s !== null
    );
    const storedIds = new Set(validSettings.map((s) => s.id));

    for (const d of PROVIDER_DEFAULTS) {
      if (!storedIds.has(d.id)) {
        validSettings.push({ ...d });
      }
    }

    return validSettings;
  } catch {
    // Corrupted data - reset to defaults
    localStorage.removeItem(STORAGE_KEY);
    return getDefaultSettings();
  }
}

export async function clearProviderSettings(
  providerId: ProviderName
): Promise<void> {
  const settings = await loadProviderSettings();
  const updated = settings.map((s) =>
    s.id === providerId
      ? {
          ...s,
          apiKey: undefined,
          enabled: false,
          validationStatus: "none" as const,
          lastValidatedAt: undefined,
        }
      : s
  );
  await saveProviderSettings(updated);
}

function getDefaultSettings(): ProviderSettings[] {
  return PROVIDER_DEFAULTS.map((d) => ({ ...d }));
}
