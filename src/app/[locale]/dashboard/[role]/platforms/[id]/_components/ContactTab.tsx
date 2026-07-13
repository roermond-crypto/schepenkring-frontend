"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import type { PlatformTabProps } from "../_types";
import { FormSection, Field } from "./shared";

export function ContactTab({ form, set }: PlatformTabProps) {
  const t = useTranslations("Platforms");

  return (
    <FormSection title={t("tabs.contact")}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t("contact.nameLabel")} field="contact_name">
          <Input
            value={form.contact_name}
            onChange={(e) => set("contact_name", e.target.value)}
            className="text-sm"
          />
        </Field>
        <Field label={t("contact.emailLabel")} field="contact_email">
          <Input
            value={form.contact_email}
            onChange={(e) => set("contact_email", e.target.value)}
            type="email"
            className="text-sm"
          />
        </Field>
      </div>
      <Field label={t("contact.notesLabel")} field="notes">
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder={t("contact.notesPlaceholder")}
          rows={4}
          className="w-full text-sm rounded-md border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
        />
      </Field>
    </FormSection>
  );
}
