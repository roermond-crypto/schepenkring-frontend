"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { logout } from "@/lib/api/auth";
import { clearClientSession } from "@/lib/auth/client-session";
import type { UserRole } from "@/lib/auth/roles";
import type { AppLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  locale: AppLocale;
  role: UserRole;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
};

export function DashboardShell({ locale, role, userName, userEmail, children }: DashboardShellProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Clear local session even if backend logout fails.
    }
    clearClientSession();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f5f8fc] dark:bg-slate-950">
      <DashboardHeader
        locale={locale}
        role={role}
        userName={userName}
        userEmail={userEmail}
        onOpenMobileNav={() => setMobileOpen(true)}
        onLogout={handleLogout}
      />

      <div className="flex w-full min-w-0 pt-20">
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
    </div>
  );
}
