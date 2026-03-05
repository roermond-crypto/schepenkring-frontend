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

export function VerifyEmailForm({ locale, email }: VerifyEmailFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const normalizedEmail = useMemo(() => email.trim(), [email]);

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!normalizedEmail || !code.trim()) {
      setError("Email and verification code are required.");
      return;
    }

    try {
      setLoading(true);
      const response = await verifyEmail({ email: normalizedEmail, code: code.trim() });
      setSuccess("Email verified successfully.");

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
      const message = err instanceof Error ? err.message : "Verification failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError("");
    setSuccess("");

    if (!normalizedEmail) {
      setError("Email is required to resend code.");
      return;
    }

    try {
      setResending(true);
      await resendVerification({ email: normalizedEmail });
      setSuccess("A new verification code has been sent.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend code.";
      setError(message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm dark:bg-slate-900">
      <h1 className="text-xl font-semibold">Verify Email</h1>
      <p className="mt-2 text-sm text-muted-foreground">Enter the verification code sent to {normalizedEmail || "your email"}.</p>

      <form className="mt-5 space-y-4" onSubmit={onVerify}>
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{success}</p> : null}

        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Verification code"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[#003566] py-2.5 text-sm font-semibold text-white hover:bg-[#001d3d] disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Verify email"}
        </button>
      </form>

      <button
        type="button"
        onClick={onResend}
        disabled={resending}
        className="mt-3 w-full rounded-md border border-input py-2 text-sm hover:bg-accent disabled:opacity-60"
      >
        {resending ? "Resending..." : "Resend code"}
      </button>
    </div>
  );
}
