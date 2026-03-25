"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resendVerification, verifyEmail } from "@/lib/api/auth";
import { setClientSession } from "@/lib/auth/client-session";
import type { AppLocale } from "@/lib/i18n";

const PENDING_VERIFICATION_EMAIL_KEY = "pending_verification_email";

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
  const [emailValue, setEmailValue] = useState(email.trim());
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const copy = VERIFY_COPY[locale] ?? VERIFY_COPY.en;

  const normalizedEmail = emailValue.trim();

  useEffect(() => {
    const normalizedInitialEmail = email.trim();
    if (normalizedInitialEmail) {
      setEmailValue(normalizedInitialEmail);
      sessionStorage.setItem(
        PENDING_VERIFICATION_EMAIL_KEY,
        normalizedInitialEmail,
      );
      return;
    }

    const storedEmail = sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
    if (storedEmail) {
      setEmailValue(storedEmail);
    }
  }, [email]);

  async function sendVerificationCode(isResend = false) {
    setError("");
    setSuccess("");

    if (!normalizedEmail) {
      setError(
        isResend
          ? "Email is required to resend code."
          : "Email is required to send a verification code.",
      );
      return;
    }

    try {
      if (isResend) {
        setResending(true);
      } else {
        setLoading(true);
      }

      const response = await resendVerification({ email: normalizedEmail });

      if (response.verified) {
        setCodeRequested(false);
        setSuccess(
          response.message ?? "This email address is already verified. Please log in.",
        );
        setTimeout(() => {
          router.push(`/${locale}/auth?mode=login`);
          router.refresh();
        }, 600);
        return;
      }

      setCodeRequested(true);
      setSuccess(
        response.message ??
          (isResend
            ? "A new verification code has been sent."
            : "Verification code sent to your email."),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend code.";
      setError(message);
    } finally {
      if (isResend) {
        setResending(false);
      } else {
        setLoading(false);
      }
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    if (!codeRequested) {
      await sendVerificationCode(false);
      return;
    }

    if (!code.trim()) {
      setError("Verification code is required.");
      return;
    }

    try {
      setLoading(true);
      const response = await verifyEmail({
        email: normalizedEmail,
        code: code.trim(),
      });
      setSuccess("Email verified successfully.");
      sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);

      if (response.user && response.token) {
        setClientSession(response.token, response.user);
      }

      if (response.user) {
        router.push(`/${locale}/dashboard/${response.user.role}`);
      } else {
        router.push(`/${locale}/auth?mode=login`);
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm dark:bg-slate-900">
      <h1 className="text-xl font-semibold">Verify Email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {codeRequested
          ? `Enter the verification code sent to ${normalizedEmail || "your email"}.`
          : "Enter your email address to receive a verification code."}
      </p>

      <form className="mt-5 space-y-4" onSubmit={onVerify}>
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{success}</p> : null}

        <input
          type="email"
          value={emailValue}
          onChange={(event) => {
            const nextEmail = event.target.value;
            const nextNormalizedEmail = nextEmail.trim();
            const emailChanged = nextNormalizedEmail !== normalizedEmail;

            setEmailValue(nextEmail);

            if (emailChanged) {
              setCodeRequested(false);
              setCode("");
              setError("");
              setSuccess("");
            }

            if (nextNormalizedEmail) {
              sessionStorage.setItem(
                PENDING_VERIFICATION_EMAIL_KEY,
                nextNormalizedEmail,
              );
            } else {
              sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
            }
          }}
          placeholder="Email address"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
          required
        />

        {codeRequested ? (
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Verification code"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
            required
          />
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[#003566] py-2.5 text-sm font-semibold text-white hover:bg-[#001d3d] disabled:opacity-60"
        >
          {loading
            ? codeRequested
              ? "Verifying..."
              : "Sending code..."
            : "Verify email"}
        </button>
      </form>

      {codeRequested ? (
        <button
          type="button"
          onClick={() => void sendVerificationCode(true)}
          disabled={resending}
          className="mt-3 w-full rounded-md border border-input py-2 text-sm hover:bg-accent disabled:opacity-60"
        >
          {resending ? "Resending..." : "Resend code"}
        </button>
      ) : null}
    </div>
  );
}
