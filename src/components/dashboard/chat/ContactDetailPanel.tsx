"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  Building2,
  Check,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldOff,
  UserRound,
  X,
} from "lucide-react";
import type { ContactInfo, Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ContactDetailPanelProps {
  contact: ContactInfo | null;
  conversation: Conversation;
  onUpdateContact: (payload: {
    name: string;
    email?: string;
    phone?: string;
    whatsapp_user_id?: string;
    language_preferred?: string;
    do_not_contact: boolean;
    consent_marketing: boolean;
    consent_service_messages: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  whatsapp_user_id: string;
  language_preferred: string;
  do_not_contact: boolean;
  consent_marketing: boolean;
  consent_service_messages: boolean;
}

function buildFormState(
  contact: ContactInfo | null,
  conversation: Conversation,
): ContactFormState {
  return {
    name: contact?.name ?? conversation.contact_name ?? "",
    email: contact?.email ?? conversation.guest_email ?? "",
    phone: contact?.phone ?? conversation.guest_phone ?? "",
    whatsapp_user_id: contact?.whatsapp_user_id ?? "",
    language_preferred: contact?.language_preferred ?? "nl",
    do_not_contact: contact?.do_not_contact ?? false,
    consent_marketing: contact?.consent_marketing ?? false,
    consent_service_messages: contact?.consent_service_messages ?? true,
  };
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
      <span
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border transition-colors",
          checked ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
    </label>
  );
}

export function ContactDetailPanel({
  contact,
  conversation,
  onUpdateContact,
  onClose,
}: ContactDetailPanelProps) {
  const t = useTranslations("DashboardChat");
  const [form, setForm] = useState<ContactFormState>(() =>
    buildFormState(contact, conversation),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildFormState(contact, conversation));
    setError(null);
    setSuccess(null);
  }, [contact, conversation]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await onUpdateContact({
        name: form.name.trim(),
        email: normalizeOptional(form.email),
        phone: normalizeOptional(form.phone),
        whatsapp_user_id: normalizeOptional(form.whatsapp_user_id),
        language_preferred: normalizeOptional(form.language_preferred),
        do_not_contact: form.do_not_contact,
        consent_marketing: form.consent_marketing,
        consent_service_messages: form.consent_service_messages,
      });
      setSuccess(t("detail.saved"));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("detail.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof ContactFormState>(
    key: K,
    value: ContactFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const statusLabel = contact?.status ?? "online";
  const avatarLetter = (form.name || conversation.contact_name || "?")
    .charAt(0)
    .toUpperCase();
  const avatarSrc = contact?.avatar ?? conversation.contact_avatar;

  return (
    <aside className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
            {t("detail.contactRecord")}
          </p>
          <h3 className="mt-1 text-sm font-bold text-slate-800">
            {t("detail.contactInfo")}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
          aria-label={t("detail.close")}
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-slate-200/60 px-5 py-6">
          <div className="mx-auto flex w-full max-w-[248px] flex-col items-center rounded-[2rem] border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 px-6 py-7 text-center shadow-sm">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={form.name}
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 rounded-[1.5rem] object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-amber-300 via-orange-400 to-emerald-500 text-2xl font-bold text-white shadow-sm">
                {avatarLetter}
              </div>
            )}
            <h4 className="mt-5 text-2xl font-bold text-slate-800">
              {form.name || t("detail.unknownVisitor")}
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              {contact?.company ??
                conversation.contact_company ??
                t("detail.noCompany")}
            </p>
            <div className="mt-4 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">
              {t(`detail.presence.${statusLabel}`)}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-5 py-5">
          <section className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                {t("detail.editContact")}
              </p>
              <h4 className="text-sm font-semibold text-slate-800">
                {t("detail.updateContact")}
              </h4>
            </div>

            <div className="grid gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  {t("detail.name")}
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 focus-within:border-blue-500 focus-within:bg-white">
                  <UserRound size={16} className="text-slate-400" />
                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    placeholder={t("detail.placeholders.name")}
                    required
                  />
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  {t("detail.email")}
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 focus-within:border-blue-500 focus-within:bg-white">
                  <Mail size={16} className="text-slate-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                    className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    placeholder={t("detail.placeholders.email")}
                  />
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  {t("detail.phone")}
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 focus-within:border-blue-500 focus-within:bg-white">
                  <Phone size={16} className="text-slate-400" />
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                    className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    placeholder={t("detail.placeholders.phone")}
                  />
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  {t("detail.whatsapp")}
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 focus-within:border-blue-500 focus-within:bg-white">
                  <Phone size={16} className="text-slate-400" />
                  <input
                    value={form.whatsapp_user_id}
                    onChange={(event) =>
                      updateField("whatsapp_user_id", event.target.value)
                    }
                    className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    placeholder={t("detail.placeholders.whatsapp")}
                  />
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  {t("detail.language")}
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 focus-within:border-blue-500 focus-within:bg-white">
                  <Globe size={16} className="text-slate-400" />
                  <select
                    value={form.language_preferred}
                    onChange={(event) =>
                      updateField("language_preferred", event.target.value)
                    }
                    className="w-full bg-transparent text-sm text-slate-800 outline-none"
                  >
                    <option value="nl">{t("detail.languages.nl")}</option>
                    <option value="en">{t("detail.languages.en")}</option>
                    <option value="de">{t("detail.languages.de")}</option>
                    <option value="fr">{t("detail.languages.fr")}</option>
                  </select>
                </div>
              </label>
            </div>

            <div className="space-y-3">
              <ToggleRow
                label={t("detail.doNotContact")}
                description={t("detail.doNotContactHelp")}
                checked={form.do_not_contact}
                onChange={(checked) => updateField("do_not_contact", checked)}
              />
              <ToggleRow
                label={t("detail.consentMarketing")}
                description={t("detail.consentMarketingHelp")}
                checked={form.consent_marketing}
                onChange={(checked) =>
                  updateField("consent_marketing", checked)
                }
              />
              <ToggleRow
                label={t("detail.consentService")}
                description={t("detail.consentServiceHelp")}
                checked={form.consent_service_messages}
                onChange={(checked) =>
                  updateField("consent_service_messages", checked)
                }
              />
            </div>

            {(error || success) && (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm",
                  error
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                )}
              >
                {error ?? success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B1F3A] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#12315d] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {saving ? t("detail.saving") : t("detail.save")}
            </button>
          </section>

          <section className="space-y-3 border-t border-slate-200/70 pt-5">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
              {t("detail.snapshot")}
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 px-4 py-3">
                <Phone size={16} className="mt-0.5 text-emerald-500" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {t("detail.phone")}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {contact?.phone ?? conversation.guest_phone ?? t("detail.noPhone")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 px-4 py-3">
                <Building2 size={16} className="mt-0.5 text-fuchsia-500" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {t("detail.company")}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {contact?.company ??
                      conversation.contact_company ??
                      t("detail.noCompany")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 px-4 py-3">
                <MapPin size={16} className="mt-0.5 text-sky-500" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {t("detail.location")}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {contact?.location ??
                      conversation.context?.place_id ??
                      t("detail.unknownLocation")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 px-4 py-3">
                <ShieldOff size={16} className="mt-0.5 text-amber-500" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {t("detail.statusLabel")}
                  </p>
                  <p className="mt-1 text-sm capitalize text-slate-700">
                    {conversation.status}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-slate-200/70 pt-5">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
              {t("detail.activity")}
            </p>
            <div className="space-y-3">
              {contact?.events?.length ? (
                contact.events.map((eventItem) => (
                  <div
                    key={eventItem.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white">
                        <Check size={13} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-700">
                          {eventItem.description}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(eventItem.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                  {t("detail.noActivity")}
                </div>
              )}
            </div>
          </section>
        </form>
      </div>
    </aside>
  );
}
