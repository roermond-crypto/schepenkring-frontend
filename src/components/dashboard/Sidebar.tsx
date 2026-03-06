"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Bot,
  Gauge,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  TriangleAlert,
  LogOut,
  MessageSquare,
  Ship,
  Settings,
  Share2,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import type { UserRole } from "@/lib/auth/roles";

type SidebarProps = {
  locale: AppLocale;
  role: UserRole;
  variant?: "sidebar" | "drawer";
  onLogout: () => void;
  onNavigate?: () => void;
  onCollapse?: (collapsed: boolean) => void;
};

type MenuItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function Sidebar({
  locale,
  role,
  variant = "sidebar",
  onLogout,
  onNavigate,
  onCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const isDrawer = variant === "drawer";
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const dictionary = getDictionary(locale);
  const t = dictionary.dashboard.sidebar;

  useEffect(() => {
    const syncStatus = () => setIsOnline(navigator.onLine);
    syncStatus();
    window.addEventListener("online", syncStatus);
    window.addEventListener("offline", syncStatus);
    return () => {
      window.removeEventListener("online", syncStatus);
      window.removeEventListener("offline", syncStatus);
    };
  }, []);

  useEffect(() => {
    if (!isDrawer) {
      onCollapse?.(isCollapsed);
    }
  }, [isCollapsed, isDrawer, onCollapse]);

  const root = `/${locale}/dashboard/${role}`;

  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { title: t.overview, href: root, icon: BarChart3 },
      { title: t.boats, href: `${root}/yachts`, icon: Ship },
      { title: t.users, href: `${root}/users`, icon: Users },
      { title: t.schedule, href: `${root}/onboarding`, icon: Calendar },
      { title: t.harbor, href: `${root}/emails`, icon: Anchor },
      { title: t.interaction, href: `${root}/chat`, icon: MessageSquare },
      { title: t.settings, href: `${root}/onboarding`, icon: Settings },
      { title: t.tasks, href: `${root}/tasks`, icon: ClipboardList },
    ];

    if (role === "admin") {
      items.push({ title: t.users, href: `${root}/users`, icon: Users });
      items.push({ title: t.copilot, href: `${root}/copilot`, icon: Bot });
      items.push({
        title: t.harborPerformance,
        href: `${root}/harbors/performance`,
        icon: Gauge,
      });
      items.push({ title: t.audit, href: `${root}/audit`, icon: ShieldAlert });
      items.push({ title: t.errors, href: `${root}/errors`, icon: TriangleAlert });
      items.splice(
        4,
        0,
        {
          title: t.harborPerformance,
          href: `${root}/harbors/performance`,
          icon: Gauge,
        },
        {
          title: t.socialAutomation,
          href: `${root}/social`,
          icon: Share2,
        },
        { title: t.audit, href: `${root}/audit`, icon: ShieldAlert },
        { title: t.errors, href: `${root}/errors`, icon: TriangleAlert },
      );
    }

    items.push({ title: t.settings, href: `${root}/account`, icon: Settings });

    return items;
  }, [
    role,
    root,
    t.audit,
    t.copilot,
    t.boats,
    t.errors,
    t.harborPerformance,
    t.overview,
    t.settings,
    t.socialAutomation,
    t.tasks,
    t.users,
  ]);

  const navContent = (
    <>
      <div
        className={cn(
          "mb-3 flex items-center justify-between px-4",
          isCollapsed && !isDrawer && "justify-center px-0",
        )}
      >
        {(!isCollapsed || isDrawer) && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {`${role} ${t.terminalSuffix}`}
          </p>
        )}
        {isOnline ? (
          <Wifi
            className="h-3.5 w-3.5 text-emerald-400"
            aria-label={t.online}
          />
        ) : (
          <WifiOff
            className="h-3.5 w-3.5 text-red-400"
            aria-label={t.offline}
          />
        )}
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 pt-6">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.title}
              href={item.href}
              onClick={onNavigate}
              title={item.title}
              className={cn(
                "group relative flex min-h-[44px] items-center gap-3 rounded-xl border px-4 py-2.5 text-[13px] font-medium tracking-wide transition-all",
                isActive
                  ? "border-[#1E3A8A] bg-[#0F274A] text-white shadow-[0_8px_16px_rgba(2,12,27,0.35)]"
                  : "border-transparent text-slate-300 hover:border-[#214172] hover:bg-[#102649] hover:text-white",
                isCollapsed && !isDrawer && "justify-center px-0",
              )}
            >
              {isActive && !isCollapsed && !isDrawer ? (
                <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#3B82F6]" />
              ) : null}
              <item.icon className="h-4 w-4 shrink-0" />
              {(!isCollapsed || isDrawer) && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#1A355F] p-3">
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/20 hover:text-red-100",
            isCollapsed && !isDrawer && "justify-center px-0",
          )}
        >
          <LogOut className="h-4 w-4" />
          {(!isCollapsed || isDrawer) && <span>{t.logout}</span>}
        </button>
      </div>
    </>
  );

  if (isDrawer) {
    return (
      <aside className="flex h-full w-72 flex-col bg-gradient-to-b from-[#07162C] to-[#0B1F3A] py-4">
        {navContent}
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "fixed bottom-0 left-0 top-20 z-40 hidden overflow-hidden border-r border-[#1A355F] bg-gradient-to-b from-[#07162C] to-[#0B1F3A] shadow-[0_16px_28px_rgba(11,31,58,0.35)] transition-[width] duration-300 lg:block",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      <div className="relative flex h-full flex-col py-4">
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="absolute right-3 top-4 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full border border-[#36558a] bg-[#1E3A8A] text-slate-200 transition-colors hover:text-white"
          aria-label={isCollapsed ? t.expand : t.collapse}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {navContent}
      </div>
    </aside>
  );
}
