"use client";

import { usePathname } from "next/navigation";
import { ContextAwareChatWidget } from "@/components/widget/ContextAwareChatWidget";
import { useOptionalClientSession } from "@/components/session/ClientSessionProvider";

export function GlobalChatWidget() {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const pageRoot = segments[1] ?? "";
  const session = useOptionalClientSession();
  const role = session?.user?.role ?? "";

  if (pageRoot === "widget") {
    return null;
  }

  // Only show the floating chat widget for admin/staff accounts.
  if (role !== "admin" && role !== "employee") {
    return null;
  }

  // Path shape is /{locale}/dashboard/{role}/chat — the admin chat page
  // builds its own UI and must never show the public-facing widget on top
  // of it. (segments[0] is the locale, segments[1] "dashboard", segments[2]
  // the role, segments[3] "chat" — previously checked the wrong indices and
  // never matched, so the widget rendered here unconditionally.)
  if (segments[1] === "dashboard" && segments[3] === "chat") {
    return null;
  }

  return <ContextAwareChatWidget />;
}
