"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TestToolsPanel } from "@/components/platforms/TestToolsPanel";
import { cn } from "@/lib/utils";
import type { PlatformTabProps } from "../_types";
import { FormSection, Field } from "./shared";

function SecretField({
  value,
  onChange,
  isSet,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  isSet: boolean;
  hint: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={show ? "text" : "password"}
          placeholder={isSet ? "••••••••" : ""}
          className="text-sm font-mono pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {isSet && !value && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function AdvancedTab({ form, set, platformId }: PlatformTabProps & { platformId: number | null }) {
  const t = useTranslations("Platforms");

  const setCredential = (key: keyof typeof form.credentials, value: string | boolean) =>
    set("credentials", { ...form.credentials, [key]: value });

  return (
    <div className="space-y-6">
      <FormSection title={t("tabs.advanced")}>
        <Field label={t("advanced.apiUrlLabel")} hint={t("advanced.apiUrlHint")}>
          <Input
            value={form.api_url}
            onChange={(e) => set("api_url", e.target.value)}
            placeholder="https://api.platform.com/v1"
            type="url"
            className="text-sm"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("advanced.apiKeyLabel")}>
            <Input
              value={form.credentials.api_key ?? ""}
              onChange={(e) => setCredential("api_key", e.target.value)}
              className="text-sm font-mono"
            />
          </Field>
          <Field label={t("advanced.apiSecretLabel")}>
            <SecretField
              value={form.credentials.api_secret ?? ""}
              onChange={(v) => setCredential("api_secret", v)}
              isSet={form.has_api_secret}
              hint={t("advanced.secretSetHint")}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("advanced.webhookUrlLabel")}>
            <Input
              value={form.credentials.webhook_url ?? ""}
              onChange={(e) => setCredential("webhook_url", e.target.value)}
              type="url"
              className="text-sm"
            />
          </Field>
          <Field label={t("advanced.webhookSecretLabel")}>
            <SecretField
              value={form.credentials.webhook_secret ?? ""}
              onChange={(v) => setCredential("webhook_secret", v)}
              isSet={form.has_webhook_secret}
              hint={t("advanced.secretSetHint")}
            />
          </Field>
        </div>

        <Field label={t("advanced.debugModeLabel")} hint={t("advanced.debugModeHint")}>
          <div className="flex items-center gap-3 h-9">
            <button
              type="button"
              onClick={() => setCredential("debug_mode", !form.credentials.debug_mode)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                form.credentials.debug_mode ? "bg-amber-500" : "bg-slate-200"
              )}
            >
              <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", form.credentials.debug_mode ? "translate-x-6" : "translate-x-1")} />
            </button>
          </div>
        </Field>

        <Field label={t("advanced.jsonEditorLabel")} hint={t("advanced.jsonEditorHint")}>
          <textarea
            value={form.openmarine_category_map}
            onChange={(e) => set("openmarine_category_map", e.target.value)}
            placeholder='{"motorboat": "MB", "sailboat": "SB"}'
            rows={4}
            className="w-full text-xs font-mono rounded-md border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
          />
        </Field>
      </FormSection>

      <FormSection title={t("testTools.title")}>
        <TestToolsPanel platformId={platformId} />
      </FormSection>
    </div>
  );
}
