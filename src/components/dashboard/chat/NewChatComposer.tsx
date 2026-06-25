"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Anchor,
  AtSign,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatType, SendChannel } from "@/types/chat";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComposerPayload {
  contact: {
    name: string;
    email?: string;
    phone?: string;
    language_preferred?: string;
  };
  location_id?: number;
  boat_id?: number;
  chat_type: ChatType;
  send_channel: SendChannel;
  initial_message: string;
}

interface Location {
  id: number;
  name: string;
}

interface Boat {
  id: number;
  name: string;
  location_id?: number;
}

interface NewChatComposerProps {
  onSubmit: (payload: ComposerPayload) => Promise<void>;
  onCancel: () => void;
  /** List of available locations (harbors) */
  locations?: Location[];
  /** List of available boats (optional, loaded async) */
  boats?: Boat[];
  locale?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAT_TYPES: { value: ChatType; labelNl: string; labelEn: string; color: string }[] = [
  { value: "general", labelNl: "Algemeen", labelEn: "General", color: "bg-slate-100 text-slate-700" },
  { value: "offer", labelNl: "Bod", labelEn: "Offer", color: "bg-blue-100 text-blue-700" },
  { value: "viewing", labelNl: "Bezichtiging", labelEn: "Viewing", color: "bg-purple-100 text-purple-700" },
  { value: "callback", labelNl: "Terugbellen", labelEn: "Callback", color: "bg-amber-100 text-amber-700" },
  { value: "question", labelNl: "Vraag", labelEn: "Question", color: "bg-teal-100 text-teal-700" },
  { value: "brochure", labelNl: "Brochure", labelEn: "Brochure", color: "bg-orange-100 text-orange-700" },
  { value: "seller", labelNl: "Verkoper", labelEn: "Seller", color: "bg-emerald-100 text-emerald-700" },
  { value: "buyer", labelNl: "Koper", labelEn: "Buyer", color: "bg-rose-100 text-rose-700" },
];

const LANGUAGES = [
  { value: "nl", label: "Nederlands" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
];

// Normalize Dutch mobile phone numbers to E.164 (+31...)
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("31") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10)
    return `+31${digits.slice(1)}`;
  if (digits.length === 9) return `+31${digits}`;
  return raw.trim();
}

function InputRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 focus-within:border-blue-500 focus-within:bg-white transition-colors">
      <span className="text-slate-400 shrink-0">{icon}</span>
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewChatComposer({
  onSubmit,
  onCancel,
  locations = [],
  boats = [],
  locale = "nl",
}: NewChatComposerProps) {
  const isNl = locale === "nl";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    language: "nl",
    location_id: "" as string | number,
    boat_id: "" as string | number,
    chat_type: "general" as ChatType,
    send_channel: "chat" as SendChannel,
    message: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Derive send_channel from whether we have an email
  const canUseChat = true; // always available
  const canUseEmail = form.email.includes("@");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError(isNl ? "Naam is verplicht." : "Name is required.");
      return;
    }
    if (!form.message.trim()) {
      setError(
        isNl
          ? "Voer een openingsbericht in."
          : "An opening message is required.",
      );
      return;
    }
    if (form.send_channel === "email" && !canUseEmail) {
      setError(
        isNl
          ? "Voer een geldig e-mailadres in om via e-mail te sturen."
          : "Enter a valid email to send via email.",
      );
      return;
    }

    setSaving(true);
    try {
      const normalizedPhone = form.phone ? normalizePhone(form.phone) : undefined;

      await onSubmit({
        contact: {
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: normalizedPhone,
          language_preferred: form.language,
        },
        location_id: form.location_id ? Number(form.location_id) : undefined,
        boat_id: form.boat_id ? Number(form.boat_id) : undefined,
        chat_type: form.chat_type,
        send_channel: form.send_channel,
        initial_message: form.message.trim(),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isNl
            ? "Kon chat niet starten."
            : "Failed to start chat.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20">
              <MessageSquare size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {isNl ? "Nieuwe chat" : "New chat"}
              </h2>
              <p className="text-xs text-slate-500">
                {isNl
                  ? "Vul de gegevens in en stuur een openingsbericht"
                  : "Fill in contact details and send an opening message"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-2xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
            {/* Contact */}
            <fieldset className="space-y-3">
              <legend className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {isNl ? "Ontvanger" : "Recipient"}
              </legend>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  {isNl ? "Naam" : "Name"}{" "}
                  <span className="text-red-400">*</span>
                </span>
                <InputRow icon={<User size={15} />}>
                  <input
                    ref={nameRef}
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    required
                    placeholder={isNl ? "Hans Müller" : "Jane Smith"}
                    className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </InputRow>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    {isNl ? "E-mail" : "Email"}
                  </span>
                  <InputRow icon={<Mail size={15} />}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </InputRow>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    {isNl ? "Telefoon" : "Phone"}
                  </span>
                  <InputRow icon={<Phone size={15} />}>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="0612345678"
                      className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </InputRow>
                </label>
              </div>

              {/* Phone normalization hint */}
              {form.phone && (
                <p className="text-[11px] text-slate-400">
                  {isNl ? "Genormaliseerd: " : "Normalized: "}
                  <span className="font-mono font-medium text-slate-600">
                    {normalizePhone(form.phone)}
                  </span>
                </p>
              )}

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  {isNl ? "Taal" : "Language"}
                </span>
                <InputRow icon={<Globe size={15} />}>
                  <select
                    value={form.language}
                    onChange={(e) => set("language", e.target.value)}
                    className="w-full bg-transparent text-sm text-slate-800 outline-none"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </InputRow>
              </label>
            </fieldset>

            {/* Context */}
            <fieldset className="space-y-3 border-t border-slate-100 pt-4">
              <legend className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {isNl ? "Context" : "Context"}
              </legend>

              <div className="grid grid-cols-2 gap-3">
                {locations.length > 0 && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      {isNl ? "Locatie" : "Location"}
                    </span>
                    <InputRow icon={<MapPin size={15} />}>
                      <select
                        value={form.location_id}
                        onChange={(e) => set("location_id", e.target.value)}
                        className="w-full bg-transparent text-sm text-slate-800 outline-none"
                      >
                        <option value="">
                          {isNl ? "— Kies locatie —" : "— Choose location —"}
                        </option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </InputRow>
                  </label>
                )}

                {boats.length > 0 && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      {isNl ? "Boot" : "Boat"}
                    </span>
                    <InputRow icon={<Anchor size={15} />}>
                      <select
                        value={form.boat_id}
                        onChange={(e) => set("boat_id", e.target.value)}
                        className="w-full bg-transparent text-sm text-slate-800 outline-none"
                      >
                        <option value="">
                          {isNl ? "— Kies boot —" : "— Choose boat —"}
                        </option>
                        {boats.map((boat) => (
                          <option key={boat.id} value={boat.id}>
                            {boat.name}
                          </option>
                        ))}
                      </select>
                    </InputRow>
                  </label>
                )}
              </div>
            </fieldset>

            {/* Chat type */}
            <fieldset className="space-y-3 border-t border-slate-100 pt-4">
              <legend className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {isNl ? "Chat type" : "Chat type"}
              </legend>
              <div className="flex flex-wrap gap-2">
                {CHAT_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => set("chat_type", ct.value)}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                      form.chat_type === ct.value
                        ? `${ct.color} ring-2 ring-offset-1 ring-current`
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                    )}
                  >
                    {isNl ? ct.labelNl : ct.labelEn}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Send channel */}
            <fieldset className="space-y-3 border-t border-slate-100 pt-4">
              <legend className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {isNl ? "Verzendkanaal" : "Send via"}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => set("send_channel", "chat")}
                  disabled={!canUseChat}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-semibold transition-all",
                    form.send_channel === "chat"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                    !canUseChat && "cursor-not-allowed opacity-40",
                  )}
                >
                  <MessageSquare size={15} />
                  💬 Chat
                </button>
                <button
                  type="button"
                  onClick={() => canUseEmail && set("send_channel", "email")}
                  disabled={!canUseEmail}
                  title={
                    !canUseEmail
                      ? isNl
                        ? "Voer eerst een e-mailadres in"
                        : "Enter an email address first"
                      : undefined
                  }
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-semibold transition-all",
                    form.send_channel === "email"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                    !canUseEmail && "cursor-not-allowed opacity-40",
                  )}
                >
                  <AtSign size={15} />
                  {isNl ? "@ E-mail" : "@ Email"}
                </button>
              </div>
              {!canUseEmail && form.send_channel === "chat" && (
                <p className="text-[11px] text-slate-400">
                  {isNl
                    ? "Voeg een e-mailadres toe om ook via e-mail te sturen."
                    : "Add an email address to also send via email."}
                </p>
              )}
            </fieldset>

            {/* Message */}
            <fieldset className="space-y-3 border-t border-slate-100 pt-4">
              <legend className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {isNl ? "Openingsbericht" : "Opening message"}{" "}
                <span className="text-red-400">*</span>
              </legend>
              <textarea
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                required
                rows={4}
                placeholder={
                  isNl
                    ? "Typ het openingsbericht voor deze chat..."
                    : "Type the opening message for this chat..."
                }
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white transition-colors"
              />
            </fieldset>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              {isNl ? "Annuleren" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim() || !form.message.trim()}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {saving
                ? isNl
                  ? "Versturen..."
                  : "Sending..."
                : isNl
                  ? "Verstuur"
                  : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
