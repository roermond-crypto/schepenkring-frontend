"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Images,
  Menu,
  MessageSquare,
  Ship,
  Users,
  WifiOff,
  Wifi,
  CheckCircle2,
  CreditCard,
  Search,
  ArrowRight,
  HandCoins,
  Handshake,
  ShieldCheck,
  LogOut,
  FileText,
  RefreshCw,
  PhoneCall,
  Bot,
  Megaphone,
  PhoneIncoming,
  AlertCircle,
  BookOpen,
  Phone,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import { isPartnerLikeRole, type UserRole } from "@/lib/auth/roles";
import { getProfileSetupStatus } from "@/lib/api/profile-setup";
import { getMyLocationBidSettings } from "@/lib/api/location-bid-settings";

type SidebarProps = {
  locale: AppLocale;
  role: UserRole;
  variant?: "sidebar" | "drawer";
  onLogout: () => void;
  onNavigate?: () => void;
  onCollapse?: (collapsed: boolean) => void;
  className?: string;
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
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const isDrawer = variant === "drawer";
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [bidsPageEnabled, setBidsPageEnabled] = useState(false);

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
    if (role === "buyer" || role === "seller" || role === "client") {
      getMyLocationBidSettings()
        .then((settings) => setBidsPageEnabled(Boolean(settings?.bids_page_enabled)))
        .catch(() => setBidsPageEnabled(false));
    } else if (role === "admin" || role === "employee") {
      setBidsPageEnabled(true);
    }
  }, [role]);

  useEffect(() => {
    if (role === "buyer" || role === "seller") {
      getProfileSetupStatus()
        .then((status) => setIsOnboarded(status.complete))
        .catch(() => setIsOnboarded(true));
    } else {
      setIsOnboarded(true);
    }
  }, [role]);

  useEffect(() => {
    if (!isDrawer) {
      onCollapse?.(isCollapsed);
    }
  }, [isCollapsed, isDrawer, onCollapse]);

  const root = `/${locale}/dashboard/${role}`;

  const menuItems = useMemo<MenuItem[]>(() => {
    const overviewTitle =
      role === "admin"
        ? t.overview_admin
        : role === "client"
          ? t.overview_client
          : role === "employee"
            ? t.overview_employee
            : role === "partner"
              ? t.overview_partner
              : role === "seller" || role === "buyer"
                ? t.overview
                : t.overview_location;

    const items: MenuItem[] = [
      {
        title: overviewTitle,
        href: root,
        icon: BarChart3,
      },
      { title: t.tasks, href: `${root}/tasks`, icon: ClipboardList },
    ];

    if (role === "admin") {
      items.push({ title: t.users, href: `${root}/users`, icon: Users });
      items.push({
        title: t.bookings,
        href: `${root}/bookings`,
        icon: CalendarDays,
      });
      items.push({
        title: t.bids ?? "Biedingen",
        href: `${root}/offers`,
        icon: Handshake,
      });
      items.push({
        title: "KYC",
        href: `${root}/kyc`,
        icon: ShieldCheck,
      });
      items.push({
        title: t.interaction,
        href: `${root}/chat`,
        icon: MessageSquare,
      });
      items.push({
        title: "Sales Command Center",
        href: `${root}/sales-command-center`,
        icon: PhoneCall,
      });
      items.push({
        title: "Voice AI — Agents",
        href: `${root}/voice-ai/agents`,
        icon: Bot,
      });
      items.push({
        title: "Voice AI — Campagnes",
        href: `${root}/voice-ai/campaigns`,
        icon: Megaphone,
      });
      items.push({
        title: "Voice AI — Gesprekken",
        href: `${root}/voice-ai/calls`,
        icon: PhoneIncoming,
      });
      items.push({
        title: "Voice AI — Wachtrij",
        href: `${root}/voice-ai/human-queue`,
        icon: AlertCircle,
      });
      items.push({
        title: "Voice AI — Kennisbank",
        href: `${root}/voice-ai/knowledge`,
        icon: BookOpen,
      });
      items.push({
        title: "Voice AI — Nummers",
        href: `${root}/voice-ai/numbers`,
        icon: Phone,
      });
      items.push({
        title: "OpenMarine Integration",
        href: `${root}/openmarine`,
        icon: RefreshCw,
      });
      items.push({
        title: "Content",
        href: `${root}/content`,
        icon: FileText,
      });
      items.push({
        title: "Navigatie",
        href: `${root}/navigation`,
        icon: Menu,
      });
      items.push({
        title: "Media",
        href: `${root}/media`,
        icon: Images,
      });
      items.push({
        title: "Onboarding Vragen",
        href: `${root}/onboarding-questions`,
        icon: ListChecks,
      });
    } else if (role === "employee") {
      items.push({ title: t.clients, href: `${root}/users`, icon: Users });
      items.push({
        title: t.interaction,
        href: `${root}/chat`,
        icon: MessageSquare,
      });
      items.push({
        title: "Sales Command Center",
        href: `${root}/sales-command-center`,
        icon: PhoneCall,
      });
    } else if (role === "client" || role === "buyer" || role === "seller") {
      if (role === "seller" || role === "buyer") {
        items.push({ title: t.interaction, href: `${root}/chat`, icon: MessageSquare });
      }
      if (bidsPageEnabled) {
        items.push({
          title: t.bids ?? "Bids",
          href: `${root}/bids`,
          icon: HandCoins,
        });
      }
    } else if (isPartnerLikeRole(role)) {
      items.push({
        title: t.bids ?? "Biedingen",
        href: `${root}/offers`,
        icon: Handshake,
      });
      items.push({
        title: t.interaction,
        href: `${root}/chat`,
        icon: MessageSquare,
      });
    }

    items.push({ title: t.boats, href: `${root}/yachts`, icon: Ship });

    if (isOnboarded === false) {
      return items.filter(item => item.href === root);
    }

    return items;
  }, [role, root, t, isOnboarded, bidsPageEnabled]);

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
            {`${
              role === "employee"
                ? t.roleEmployee
                : role === "client"
                  ? t.roleClient
                  : role === "partner"
                    ? t.rolePartner
                    : role === "location"
                      ? t.roleLocation
                      : t.roleAdmin
            } ${t.terminalSuffix}`}
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

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 pt-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {menuItems.map((item) => {
          const isActive =
            item.href === root
              ? pathname === item.href
              : pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              (item.href === `${root}/locations` &&
                (pathname === `${root}/harbors` ||
                  pathname.startsWith(`${root}/harbors/`)));

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
        className
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
