"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Edit3 } from "lucide-react";
import { normalizeRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type BoatFieldSettingsLinkProps = {
  fieldName?: string | null;
  className?: string;
  title?: string;
};

export function BoatFieldSettingsLink({
  fieldName,
  className,
  title = "Edit field settings",
}: BoatFieldSettingsLinkProps) {
  const locale = useLocale();
  const params = useParams<{ role?: string }>();
  const role = normalizeRole(
    typeof params?.role === "string" ? params.role : null,
  );

  if (!fieldName || role !== "admin") {
    return null;
  }

  const href = `/${locale}/dashboard/admin/yachts/settings/${encodeURIComponent(
    fieldName,
  )}`;

  return (
    <Link
      href={href}
      prefetch={false}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-600",
        className,
      )}
    >
      <Edit3 className="h-3.5 w-3.5" />
    </Link>
  );
}
