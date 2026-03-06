"use client";

import Image from "next/image";
import { Lock, LogOut, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "react-hot-toast";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import type { UserRole } from "@/lib/auth/roles";
import { lockScreenNow } from "@/lib/lockscreen";
import Link from "next/link";

type DashboardHeaderProps = {
  locale: AppLocale;
  role: UserRole;
  userName: string;
  userEmail: string;
  onOpenMobileNav: () => void;
  onLogout: () => void;
};

export function DashboardHeader({
  locale,
  role,
  userName,
  userEmail,
  onOpenMobileNav,
  onLogout,
}: DashboardHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const dictionary = getDictionary(locale);
  const tHeader = dictionary.dashboard.header;
  const tLock = dictionary.lockscreen;

  const toggleTheme = () =>
    setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const handleManualLock = () => {
    lockScreenNow("manual");
    toast.success(tLock.screenLocked);
  };

  const initials = (userName || tHeader.userFallback)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-20 items-center justify-between border-b border-[#d9e3f0] bg-white/95 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 sm:gap-4 lg:gap-12">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#0B1F3A] transition-colors hover:bg-slate-100 lg:hidden dark:text-slate-100 dark:hover:bg-slate-800"
          aria-label={tHeader.openMenu}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center group shrink-0">
              <Image
                alt=""
                src="/schepenkring-logo.png"
                width={140}
                height={40}
                quality={90}
                className="object-contain transition-transform group-hover:scale-[1.02] h-8 w-auto sm:h-10"
                priority
              />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
        <div className="hidden sm:block">
          <LanguageSwitcher locale={locale} />
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#d6e1ee] bg-white text-[#0B1F3A] transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          aria-label={tHeader.toggleTheme}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Lock button */}
        <button
          type="button"
          onClick={handleManualLock}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#d6e1ee] bg-white text-[#0B1F3A] transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          aria-label={tLock.lockNow}
        >
          <Lock className="h-4 w-4" />
        </button>

        <NotificationBell locale={locale} role={role} />

        <div className="hidden items-center gap-3 rounded-xl border border-[#d6e1ee] bg-white px-3 py-2 sm:flex dark:border-slate-700 dark:bg-slate-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E7F0FF] text-xs font-semibold text-[#0B1F3A] dark:bg-slate-700 dark:text-slate-100">
            {initials || "U"}
          </div>
          <div className="max-w-40 text-right">
            <p className="truncate text-xs font-semibold text-[#0B1F3A] dark:text-slate-100">
              {userName || tHeader.userFallback}
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {userEmail}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-600 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={tHeader.logout}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
