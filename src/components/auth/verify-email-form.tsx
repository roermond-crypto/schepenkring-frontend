"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resendVerification, verifyEmail } from "@/lib/api/auth";
import { setClientSession } from "@/lib/auth/client-session";
import type { AppLocale } from "@/lib/i18n";

type VerifyEmailFormProps = {
  locale: AppLocale;
  email: string;
};

const VERIFY_COPY = {
  en: {
    title: "Verify email",
    description: "Enter the verification code sent to",
    fallbackEmail: "your email",
    emailPlaceholder: "Email",
    codePlaceholder: "Verification code",
    emailRequired: "Email and verification code are required.",
    verified: "Email verified successfully.",
    verifyFailed: "Verification failed.",
    resendEmailRequired: "Email is required to resend code.",
    resendSuccess: "A new verification code has been sent.",
    resendFailed: "Could not resend code.",
    verifying: "Verifying...",
    verifyButton: "Verify email",
    resending: "Resending...",
    resendButton: "Resend code",
  },
  nl: {
    title: "E-mail verifiëren",
    description: "Voer de verificatiecode in die is verzonden naar",
    fallbackEmail: "je e-mail",
    emailPlaceholder: "E-mail",
    codePlaceholder: "Verificatiecode",
    emailRequired: "E-mail en verificatiecode zijn verplicht.",
    verified: "E-mail succesvol geverifieerd.",
    verifyFailed: "Verificatie mislukt.",
    resendEmailRequired: "E-mail is verplicht om de code opnieuw te sturen.",
    resendSuccess: "Er is een nieuwe verificatiecode verzonden.",
    resendFailed: "Code opnieuw verzenden is mislukt.",
    verifying: "Verifiëren...",
    verifyButton: "E-mail verifiëren",
    resending: "Opnieuw verzenden...",
    resendButton: "Code opnieuw sturen",
  },
  de: {
    title: "E-Mail verifizieren",
    description: "Geben Sie den Verifizierungscode ein, der gesendet wurde an",
    fallbackEmail: "Ihre E-Mail",
    emailPlaceholder: "E-Mail",
    codePlaceholder: "Verifizierungscode",
    emailRequired: "E-Mail und Verifizierungscode sind erforderlich.",
    verified: "E-Mail erfolgreich verifiziert.",
    verifyFailed: "Verifizierung fehlgeschlagen.",
    resendEmailRequired:
      "Eine E-Mail-Adresse ist erforderlich, um den Code erneut zu senden.",
    resendSuccess: "Ein neuer Verifizierungscode wurde gesendet.",
    resendFailed: "Der Code konnte nicht erneut gesendet werden.",
    verifying: "Wird verifiziert...",
    verifyButton: "E-Mail verifizieren",
    resending: "Wird erneut gesendet...",
    resendButton: "Code erneut senden",
  },
  fr: {
    title: "Vérifier l'e-mail",
    description: "Saisissez le code de vérification envoyé à",
    fallbackEmail: "votre e-mail",
    emailPlaceholder: "E-mail",
    codePlaceholder: "Code de vérification",
    emailRequired: "L'e-mail et le code de vérification sont requis.",
    verified: "E-mail vérifié avec succès.",
    verifyFailed: "La vérification a échoué.",
    resendEmailRequired:
      "L'e-mail est requis pour renvoyer le code.",
    resendSuccess: "Un nouveau code de vérification a été envoyé.",
    resendFailed: "Impossible de renvoyer le code.",
    verifying: "Vérification...",
    verifyButton: "Vérifier l'e-mail",
    resending: "Renvoi...",
    resendButton: "Renvoyer le code",
  },
} as const;

export function VerifyEmailForm({ locale, email }: VerifyEmailFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [emailValue, setEmailValue] = useState(email);
  const copy = VERIFY_COPY[locale] ?? VERIFY_COPY.en;

  const normalizedEmail = useMemo(() => emailValue.trim(), [emailValue]);

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!normalizedEmail || !code.trim()) {
      setError(copy.emailRequired);
      return;
    }

    try {
      setLoading(true);
      const response = await verifyEmail({ email: normalizedEmail, code: code.trim() });
      setSuccess(copy.verified);

      if (response.user && response.token) {
        setClientSession(response.token, response.user);
      }

      if (response.user) {
        router.push(`/${locale}/dashboard/${response.user.role}`);
      } else {
        router.push(`/${locale}/login`);
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.verifyFailed;
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError("");
    setSuccess("");

    if (!normalizedEmail) {
      setError(copy.resendEmailRequired);
      return;
    }

    try {
      setResending(true);
      await resendVerification({ email: normalizedEmail });
      setSuccess(copy.resendSuccess);
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.resendFailed;
      setError(message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm dark:bg-slate-900">
      <h1 className="text-xl font-semibold">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {copy.description} {normalizedEmail || copy.fallbackEmail}.
      </p>

      <form className="mt-5 space-y-4" onSubmit={onVerify}>
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{success}</p> : null}

        <input
          value={emailValue}
          onChange={(event) => setEmailValue(event.target.value)}
          placeholder={copy.emailPlaceholder}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
          type="email"
          required
        />

        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={copy.codePlaceholder}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[#003566] py-2.5 text-sm font-semibold text-white hover:bg-[#001d3d] disabled:opacity-60"
        >
          {loading ? copy.verifying : copy.verifyButton}
        </button>
      </form>

      <button
        type="button"
        onClick={onResend}
        disabled={resending}
        className="mt-3 w-full rounded-md border border-input py-2 text-sm hover:bg-accent disabled:opacity-60"
      >
        {resending ? copy.resending : copy.resendButton}
      </button>
    </div>
  );
}
