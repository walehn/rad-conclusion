export type ProviderName = "local" | "openai" | "anthropic" | "google";

export interface ProviderInfo {
  name: ProviderName;
  label: string;
  defaultModel: string;
  models: string[];
  available: boolean;
}
