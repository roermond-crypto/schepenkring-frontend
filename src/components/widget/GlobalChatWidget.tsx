"use client";

import { usePathname } from "next/navigation";
import { ContextAwareChatWidget } from "@/components/widget/ContextAwareChatWidget";

export function GlobalChatWidget() {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const pageRoot = segments[1] ?? "";

  if (pageRoot === "widget") {
    return null;
  }

  // Hide floating widget on dashboard chat pages — full-page chat is already open.
  if (segments[0] === "dashboard" && segments[2] === "chat") {
    return null;
  }

  return <ContextAwareChatWidget />;
}
