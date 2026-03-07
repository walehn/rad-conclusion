export type ProviderName = "local" | "openai" | "anthropic" | "google";

export interface ProviderInfo {
  name: ProviderName;
  label: string;
  defaultModel: string;
  models: string[];
  available: boolean;
}

export type ValidationStatus = "none" | "validating" | "valid" | "invalid";

export interface ModelConfig {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface ProviderSettings {
  id: ProviderName;
  name: string;
  enabled: boolean;
  apiKey?: string;
  hostUrl?: string;
  validationStatus: ValidationStatus;
  lastValidatedAt?: string;
  models: ModelConfig[];
}
