"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiKeyInput } from "./api-key-input";
import { ModelList } from "./model-list";
import type { ProviderSettings, ValidationStatus } from "@/lib/providers/types";

interface ProviderCardProps {
  settings: ProviderSettings;
  onChange: (updated: ProviderSettings) => void;
  onValidate: (providerId: string) => void;
}

export function ProviderCard({
  settings,
  onChange,
  onValidate,
}: ProviderCardProps) {
  const isLocal = settings.id === "local";
  const hasKey = isLocal ? !!settings.hostUrl : !!settings.apiKey;

  const handleEnabledToggle = () => {
    onChange({ ...settings, enabled: !settings.enabled });
  };

  const handleApiKeyChange = (apiKey: string) => {
    onChange({
      ...settings,
      apiKey,
      validationStatus: "none" as ValidationStatus,
    });
  };

  const handleHostUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...settings,
      hostUrl: e.target.value,
      validationStatus: "none" as ValidationStatus,
    });
  };

  const handleDefaultModelChange = (modelId: string) => {
    onChange({
      ...settings,
      models: settings.models.map((m) => ({
        ...m,
        isDefault: m.id === modelId,
      })),
    });
  };

  return (
    <Card
      className={
        settings.enabled ? "" : "opacity-70"
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">
          {settings.name}
        </CardTitle>
        <label className="flex cursor-pointer items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {settings.enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            onClick={handleEnabledToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              settings.enabled ? "bg-primary" : "bg-input"
            }`}
          >
            <span
              className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                settings.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLocal ? (
          <Input
            id={`host-url-${settings.id}`}
            label="Host URL"
            value={settings.hostUrl || ""}
            onChange={handleHostUrlChange}
            placeholder="http://localhost:5100"
            disabled={!settings.enabled}
          />
        ) : (
          <ApiKeyInput
            value={settings.apiKey || ""}
            onChange={handleApiKeyChange}
            onValidate={() => onValidate(settings.id)}
            validationStatus={settings.validationStatus}
            disabled={!settings.enabled}
          />
        )}

        {isLocal && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onValidate(settings.id)}
              disabled={!settings.enabled || !settings.hostUrl}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {settings.validationStatus === "validating"
                ? "Checking..."
                : "Test Connection"}
            </button>
            {settings.validationStatus === "valid" && (
              <span className="text-sm text-green-500">Connected</span>
            )}
            {settings.validationStatus === "invalid" && (
              <span className="text-sm text-red-500">Connection failed</span>
            )}
          </div>
        )}

        <ModelList
          models={settings.models}
          onDefaultChange={handleDefaultModelChange}
          disabled={!settings.enabled || !hasKey}
        />
      </CardContent>
    </Card>
  );
}
