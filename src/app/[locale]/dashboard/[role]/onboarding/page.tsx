"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SellerOnboardingPanel } from "@/components/dashboard/SellerOnboardingPanel";
import { BuyerVerificationPanel } from "@/components/dashboard/BuyerVerificationPanel";
import { getProfileSetupStatus } from "@/lib/api/profile-setup";
import { type AppLocale } from "@/lib/i18n";

export default function OnboardingPage() {
  const params = useParams<{ locale: string; role: string }>();
  const locale = (params?.locale as AppLocale) || "nl";
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<"buyer" | "seller" | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await getProfileSetupStatus();
        if (status.complete && status.next_route) {
           // If they are already complete, go to dashboard home
           router.push(`/${locale}/dashboard/${status.role}`);
           return;
        }
        setSelectedRole(status.selected_role);
      } catch (error) {
        console.error("Failed to check onboarding status", error);
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, [locale, router]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-8">
      {selectedRole === "seller" ? (
        <SellerOnboardingPanel locale={locale} />
      ) : (
        <BuyerVerificationPanel locale={locale} />
      )}
    </div>
  );
}
