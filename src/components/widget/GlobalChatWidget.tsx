"use client";

import { usePathname } from "next/navigation";
import { ContextAwareChatWidget } from "@/components/widget/ContextAwareChatWidget";
import { useClientSession } from "@/components/session/ClientSessionProvider";

export function GlobalChatWidget() {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const pageRoot = segments[1] ?? "";
  const { user } = useClientSession();
  const role = user?.role ?? "";

  if (pageRoot === "widget") {
    return null;
  }

  // Only show the floating chat widget for admin/staff accounts.
  if (role !== "admin" && role !== "employee") {
    return null;
  }

  if (segments[0] === "dashboard" && segments[2] === "chat") {
    return null;
  }

  return <ContextAwareChatWidget />;
}
