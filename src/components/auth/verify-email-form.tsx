"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resendVerification, verifyEmail } from "@/lib/api/auth";
import { setClientSession } from "@/lib/auth/client-session";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/lib/i18n";
import { Mail, ShieldCheck, ArrowRight, RefreshCw, Loader2 } from "lucide-react";

const PENDING_VERIFICATION_EMAIL_KEY = "pending_verification_email";

type VerifyEmailFormProps = {
  locale: AppLocale;
  email: string;
  code?: string;
};

const VERIFY_COPY = {
  en: {
    title: "Verify your email",
    description: "To keep your account secure, please enter the 6-digit code sent to",
    intro: "Enter your email address to receive a secure verification code.",
    fallbackEmail: "your email",
    emailPlaceholder: "name@example.com",
    codePlaceholder: "0 0 0 0 0 0",
    sendEmailRequired: "Email is required to send a verification code.",
    resendEmailRequired: "Email is required to resend the code.",
    codeRequired: "Verification code is required.",
    emailRequired: "Email and verification code are required.",
    verified: "Account verified! Welcome aboard.",
    verifyFailed: "Invalid code. Please check and try again.",
    sent: "Code sent! Please check your inbox.",
    resendSuccess: "A fresh code has been sent.",
    resendFailed: "Failed to resend. Please try again later.",
    verifying: "Authenticating...",
    verifyButton: "Verify account",
    resending: "Resending...",
    resendButton: "Resend verification code",
  },
  nl: {
    title: "E-mail verifiëren",
    description: "Voer de 6-cijferige code in die is verzonden naar",
    intro: "Voer je e-mailadres in om een beveiligde code te ontvangen.",
    fallbackEmail: "je e-mail",
    emailPlaceholder: "naam@voorbeeld.nl",
    codePlaceholder: "0 0 0 0 0 0",
    sendEmailRequired: "E-mail is verplicht.",
    resendEmailRequired: "E-mail is verplicht om de code opnieuw te sturen.",
    codeRequired: "Verificatiecode is verplicht.",
    emailRequired: "E-mail en code zijn verplicht.",
    verified: "Account geverifieerd! Welkom.",
    verifyFailed: "Ongeldige code. Probeer het opnieuw.",
    sent: "Code verzonden! Controleer je inbox.",
    resendSuccess: "Er is een nieuwe code verzonden.",
    resendFailed: "Kon de code niet opnieuw verzenden.",
    verifying: "Authenticeren...",
    verifyButton: "Account verifiëren",
    resending: "Opnieuw verzenden...",
    resendButton: "Code opnieuw sturen",
  },
  de: {
    title: "E-Mail verifizieren",
    description: "Geben Sie den 6-stelligen Code ein, der gesendet wurde an",
    intro: "Geben Sie Ihre E-Mail-Adresse ein, um einen Code zu erhalten.",
    fallbackEmail: "Ihre E-Mail",
    emailPlaceholder: "name@beispiel.de",
    codePlaceholder: "0 0 0 0 0 0",
    sendEmailRequired: "E-mail ist erforderlich.",
    resendEmailRequired: "E-Mail ist erforderlich, um den Code erneut zu senden.",
    codeRequired: "Verifizierungscode ist erforderlich.",
    emailRequired: "E-Mail und Code sind erforderlich.",
    verified: "Konto verifiziert! Willkommen.",
    verifyFailed: "Ungültiger Code. Bitte versuchen Sie es erneut.",
    sent: "Code gesendet! Bitte prüfen Sie Ihren Posteingang.",
    resendSuccess: "Ein neuer Code wurde gesendet.",
    resendFailed: "Der Code konnte nicht erneut gesendet werden.",
    verifying: "Authentifizierung...",
    verifyButton: "Konto verifizieren",
    resending: "Wird gesendet...",
    resendButton: "Code erneut senden",
  },
  fr: {
    title: "Vérifier l'e-mail",
    description: "Saisissez le code à 6 chiffres envoyé à",
    intro: "Saisissez votre e-mail pour recevoir un code de sécurité.",
    fallbackEmail: "votre e-mail",
    emailPlaceholder: "nom@exemple.fr",
    codePlaceholder: "0 0 0 0 0 0",
    sendEmailRequired: "L'e-mail est requis.",
    resendEmailRequired: "L'e-mail est requis pour renvoyer le code.",
    codeRequired: "Le code est requis.",
    emailRequired: "L'e-mail et le code sont requis.",
    verified: "Compte vérifié ! Bienvenue.",
    verifyFailed: "Code invalide. Veuillez réessayer.",
    sent: "Code envoyé ! Vérifiez votre boîte de réception.",
    resendSuccess: "Un nouveau code a été envoyé.",
    resendFailed: "Impossible de renvoyer le code.",
    verifying: "Authentification...",
    verifyButton: "Vérifier le compte",
    resending: "Renvoi...",
    resendButton: "Renvoyer le code",
  },
} as const;

export function VerifyEmailForm({ locale, email, code: initialCode = "" }: VerifyEmailFormProps) {
  const router = useRouter();
  const [emailValue, setEmailValue] = useState(email.trim());
  const [code, setCode] = useState(initialCode.trim());
  const [codeRequested, setCodeRequested] = useState(Boolean(email.trim() || initialCode.trim()));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const autoVerifyTriggeredRef = useRef(false);
  const copy = VERIFY_COPY[locale] ?? VERIFY_COPY.en;

  const normalizedEmail = emailValue.trim();

  useEffect(() => {
    const normalizedInitialEmail = email.trim();
    const normalizedInitialCode = initialCode.trim();

    if (normalizedInitialCode) {
      setCode(normalizedInitialCode);
      setCodeRequested(true);
    }

    if (normalizedInitialEmail) {
      setEmailValue(normalizedInitialEmail);
      setCodeRequested(true);
      sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, normalizedInitialEmail);
      return;
    }

    const storedEmail = sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
    if (storedEmail) {
      setEmailValue(storedEmail);
      setCodeRequested(true);
    }
  }, [email, initialCode]);

  async function sendVerificationCode(isResend = false) {
    setError("");
    setSuccess("");

    if (!normalizedEmail) {
      setError(isResend ? copy.resendEmailRequired : copy.sendEmailRequired);
      return;
    }

    try {
      if (isResend) setResending(true);
      else setLoading(true);

      const response = await resendVerification({ email: normalizedEmail, locale });

      if (response.verified) {
        setSuccess(response.message || "Already verified");
        setTimeout(() => router.push(`/${locale}/auth?mode=login`), 1500);
        return;
      }

      setCodeRequested(true);
      setSuccess(response.message ?? (isResend ? copy.resendSuccess : copy.sent));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || copy.resendFailed);
    } finally {
      setResending(false);
      setLoading(false);
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedEmail) { setError(copy.emailRequired); return; }
    if (!codeRequested) { await sendVerificationCode(false); return; }
    if (!code.trim()) { setError(copy.codeRequired); return; }

    try {
      setLoading(true);
      setError("");
      const response = await verifyEmail({ email: normalizedEmail, code: code.trim() });
      setSuccess(copy.verified);
      sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);

      if (response.user && response.token) {
        setClientSession(response.token, response.user);
        router.push(`/${locale}/dashboard/${response.user.role}`);
      } else {
        router.push(`/${locale}/auth?mode=login`);
      }
      router.refresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || copy.verifyFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_32px_120px_-40px_rgba(15,23,42,0.35)]">
      {/* Visual Header */}
      <div className="bg-gradient-to-br from-[#003566] to-[#001d3d] p-8 pb-12 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)] ring-1 ring-white/20 backdrop-blur-md">
            <ShieldCheck className="h-10 w-10 text-sky-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-blue-100/70 antialiased">
          {codeRequested
            ? <>{copy.description} <span className="font-bold text-sky-300">{normalizedEmail || copy.fallbackEmail}</span></>
            : copy.intro}
        </p>
      </div>

      {/* Form Content */}
      <div className="relative -mt-6 rounded-t-[32px] bg-white p-8">
        <form className="space-y-6" onSubmit={onVerify}>
          {error && (
            <div className="animate-in fade-in slide-in-from-top-2 flex gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-600 ring-1 ring-rose-100">
               <div className="h-2 w-2 mt-1.5 shrink-0 rounded-full bg-rose-500" />
               <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="animate-in fade-in slide-in-from-top-2 flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-600 ring-1 ring-emerald-100">
               <div className="h-2 w-2 mt-1.5 shrink-0 rounded-full bg-emerald-500" />
               <p>{success}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="group relative">
               <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#003566]" />
               <input
                 type="email"
                 value={emailValue}
                 onChange={(e) => {
                    setEmailValue(e.target.value);
                    if (e.target.value.trim() !== normalizedEmail) {
                        setCodeRequested(false);
                        setCode("");
                    }
                 }}
                 placeholder={copy.emailPlaceholder}
                 className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-medium outline-none transition-all focus:border-[#003566] focus:bg-white focus:ring-4 focus:ring-sky-100 placeholder:text-slate-400"
                 required
               />
            </div>

            {codeRequested && (
              <div className="animate-in zoom-in-95 duration-500">
                 <input
                   type="text"
                   maxLength={6}
                   value={code}
                   onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                   placeholder={copy.codePlaceholder}
                   className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-center text-2xl font-bold tracking-[0.5em] outline-none transition-all focus:border-[#003566] focus:bg-white focus:ring-4 focus:ring-sky-100 placeholder:text-slate-400/50 placeholder:font-normal placeholder:tracking-normal"
                   required
                 />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#003566] text-[15px] font-bold text-white transition-all hover:bg-[#001d3d] active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
                <>
                  {codeRequested ? copy.verifyButton : "Send Code"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
            )}
          </button>
        </form>

        {codeRequested && (
          <button
            type="button"
            onClick={() => void sendVerificationCode(true)}
            disabled={resending}
            className="mt-6 flex w-full items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-[#003566] disabled:opacity-50"
          >
            {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {resending ? copy.resending : copy.resendButton}
          </button>
        )}
      </div>

      {/* Footer Decoration */}
      <div className="flex justify-center border-t border-slate-100 bg-slate-50/50 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">Schepenkring Security Protocol</p>
      </div>
    </div>
  );
}
