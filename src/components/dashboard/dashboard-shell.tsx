"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { logout } from "@/lib/api/auth";
import {
  clearClientSession,
  setClientSession,
  CLIENT_SESSION_UPDATED_EVENT,
} from "@/lib/auth/client-session";
import type { UserRole } from "@/lib/auth/roles";
import type { AppLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { stopImpersonation } from "@/lib/api/account";
import { Button } from "@/components/ui/button";
import LockscreenOverlay from "@/components/LockscreenOverlay";
import { NetworkStatusBar } from "@/components/common/NetworkStatusBar";
import {
  ClientSessionProvider,
  useClientSession,
} from "@/components/session/ClientSessionProvider";

import { Link } from "@/i18n/navigation";
import { getProfileSetupStatus } from "@/lib/api/profile-setup";
import { LanguageSwitcher } from "@/components/common/language-switcher";

type DashboardShellProps = {
  locale: AppLocale;
  role: UserRole;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  children: React.ReactNode;
};

export function DashboardShell({
  locale,
  role,
  userName,
  userEmail,
  userAvatar,
  children,
}: DashboardShellProps) {
  return (
    <ClientSessionProvider
      initialUser={{
        name: userName,
        email: userEmail,
        avatar: userAvatar,
        role,
      }}
    >
      <DashboardShellInner locale={locale} role={role}>
        {children}
      </DashboardShellInner>
    </ClientSessionProvider>
  );
}

function DashboardShellInner({
  locale,
  role,
  children,
}: {
  locale: AppLocale;
  role: UserRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useClientSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [impersonatingName, setImpersonatingName] = useState<string | null>(
    null,
  );
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  // For buyer/seller: default to true (onboarding mode) until API confirms completion
  const isBuyerOrSeller = role === "buyer" || role === "seller";
  const [isOnboardingActive, setIsOnboardingActive] = useState(isBuyerOrSeller);

  useEffect(() => {
    const raw = localStorage.getItem("impersonation_session");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { impersonated_name?: string };
      if (parsed.impersonated_name) {
        setImpersonatingName(parsed.impersonated_name);
      }
    } catch {
      localStorage.removeItem("impersonation_session");
    }
  }, []);

  useEffect(() => {
    if (!isBuyerOrSeller) {
      setIsOnboardingActive(false);
      return;
    }
    
    async function checkOnboarding() {
      try {
        const status = await getProfileSetupStatus();
        if (!status.complete) {
          setIsOnboardingActive(true);
        } else {
          setIsOnboardingActive(false);
        }
      } catch (error) {
        // On error, keep onboarding active to be safe
        setIsOnboardingActive(true);
      }
    }
    
    checkOnboarding();
  }, [role, locale, isBuyerOrSeller]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Clear local session even if backend logout fails.
    }
    clearClientSession();
    router.push(`/${locale}`);
    router.refresh();
  }

  const mapTypeToRole = (type: string | undefined): UserRole => {
    if (type === "ADMIN") return "admin";
    if (type === "EMPLOYEE") return "employee";
    if (type === "LOCATION") return "location";
    if (type === "PARTNER") return "partner";
    return "client";
  };

  async function handleStopImpersonation() {
    setStoppingImpersonation(true);
    try {
      const response = await stopImpersonation();
      const nextRole = mapTypeToRole(response?.impersonator?.type);
      setClientSession(response.token, {
        id: String(response.impersonator.id),
        name: response.impersonator.name,
        email: response.impersonator.email,
        role: nextRole,
      });
      localStorage.removeItem("impersonation_session");
      setImpersonatingName(null);
      router.push(`/${locale}/dashboard/${nextRole}`);
      router.refresh();
    } catch {
      // Backend has no matching active session (stale local flag, expired
      // token, etc). Don't leave the user stuck behind the banner — clear
      // the local flag and send them back to login to get a clean session.
      localStorage.removeItem("impersonation_session");
      setImpersonatingName(null);
      clearClientSession();
      router.push(`/${locale}/auth?mode=login`);
      router.refresh();
    } finally {
      setStoppingImpersonation(false);
    }
  }

  return (
    <LockscreenOverlay
      locale={locale}
      userName={user.name}
      userAvatar={user.avatar}
    >
      <NetworkStatusBar />
      <div className="min-h-screen bg-[#f5f8fc] dark:bg-slate-950">
        {isOnboardingActive ? (
          <div className="flex flex-col min-h-screen">
             {/* Minimal Onboarding Header */}
             <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-[70]">
                <div className="flex items-center">
                  <Link href={`/${locale}/boot-aanmelden`}>
                    <img src="/schepenkring-logo.png" alt="Schepenkring" className="h-9 w-auto object-contain" />
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <LanguageSwitcher locale={locale} />
                  <button
                    onClick={handleLogout}
                    className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
                  >
                    {{ nl: "Uitloggen", en: "Logout", de: "Abmelden", fr: "Déconnexion" }[locale] ?? "Logout"}
                  </button>
                </div>
             </header>
             <main className="flex-1 p-4 sm:p-6 lg:p-12 max-w-7xl mx-auto w-full">
                {children}
             </main>
          </div>
        ) : (
          <>
            <DashboardHeader
              locale={locale}
              role={role}
              userName={user.name}
              userEmail={user.email}
              userAvatar={user.avatar}
              onOpenMobileNav={() => setMobileOpen(true)}
              onLogout={handleLogout}
            />

            {/* Impersonation banner */}
            {impersonatingName && (
              <div className="fixed left-0 right-0 z-65 flex items-center justify-between gap-4 bg-amber-500 px-4 py-2 text-white shadow-md" style={{ top: "80px" }}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-black uppercase tracking-wider">Imitatie</span>
                  <span>Je imiteert <strong>{impersonatingName}</strong></span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-lg border-white/40 bg-white/10 text-white hover:bg-white/20 text-xs font-bold"
                  onClick={() => void handleStopImpersonation()}
                  disabled={stoppingImpersonation}
                >
                  {stoppingImpersonation ? "Stoppen..." : "Stop imitatie"}
                </Button>
              </div>
            )}

            <div className={cn("flex w-full min-w-0", impersonatingName ? "pt-[120px]" : "pt-20")}>
              <Sidebar
                locale={locale}
                role={role}
                variant="sidebar"
                onLogout={handleLogout}
                onCollapse={setIsSidebarCollapsed}
              />

              <div
                className={cn(
                  "fixed inset-0 z-50 lg:hidden",
                  mobileOpen ? "pointer-events-auto" : "pointer-events-none",
                )}
                aria-hidden={!mobileOpen}
              >
                <button
                  type="button"
                  className={cn(
                    "absolute inset-0 bg-black/50 transition-opacity duration-300",
                    mobileOpen ? "opacity-100" : "opacity-0",
                  )}
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                />
                <div
                  className={cn(
                    "absolute left-0 top-0 h-full transform transition-transform duration-300 ease-out",
                    mobileOpen ? "translate-x-0" : "-translate-x-full",
                  )}
                >
                  <Sidebar
                    locale={locale}
                    role={role}
                    variant="drawer"
                    onLogout={handleLogout}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
              </div>

              <main
                className={cn(
                  "min-h-[calc(100vh-80px)] w-full min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8",
                  "ml-0 transition-[margin] duration-300",
                  !isSidebarCollapsed && "lg:ml-64",
                  isSidebarCollapsed && "lg:ml-20",
                )}
              >
                {children}
              </main>
            </div>
          </>
        )}
      </div>
    </LockscreenOverlay>
  );
}
