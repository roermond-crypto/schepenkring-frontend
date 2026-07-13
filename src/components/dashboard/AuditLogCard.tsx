"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, ChevronUp, CircleCheck, CircleX, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  translateAuditTitle,
  translateAuditEventLabel,
  translateActorRole,
  translateAuditStatus,
  translateEntityType,
  translateChangedField,
  diffChangedFields,
  type AuditActor,
} from "@/lib/audit-i18n";
import type { AppLocale } from "@/lib/i18n";

export type AuditLogCardItem = {
  id: number;
  action?: string | null;
  entity_type?: string | null;
  entity_id?: number | string | null;
  result?: string | null;
  created_at?: string | null;
  actor?: AuditActor;
  actor_id?: number | null;
  snapshot_before?: Record<string, unknown> | null;
  snapshot_after?: Record<string, unknown> | null;
};

// Resolves a link to the entity an audit event touched, for the small set
// of entity types this dashboard actually has a page for. Returns null
// (no link, not a broken one) for anything else — better than guessing.
function relatedObjectHref(
  entityType: string | null | undefined,
  entityId: number | string | null | undefined,
  dashboardBase: string,
): string | null {
  if (!entityType || entityId === null || entityId === undefined || entityId === "") return null;
  const basename = entityType.split("\\").pop();
  switch (basename) {
    case "User":
      return `${dashboardBase}/account?userId=${entityId}`;
    case "Yacht":
      return `${dashboardBase}/yachts/${entityId}`;
    case "Task":
      return `${dashboardBase}/tasks?task=${entityId}`;
    default:
      return null;
  }
}

export function AuditLogCard({
  item,
  dashboardBase,
}: {
  item: AuditLogCardItem;
  dashboardBase: string;
}) {
  const t = useTranslations("DashboardAdminOverview");
  const locale = useLocale() as AppLocale;
  const [expanded, setExpanded] = useState(false);

  const action = item.action || "unknown";
  const title = translateAuditTitle(action, item.actor, locale);
  const roleLabel = translateActorRole(item.actor?.type, locale);
  const entityLabel = translateEntityType(item.entity_type, locale);
  const status = translateAuditStatus(item.result, locale);
  const changedFields = diffChangedFields(item.snapshot_before, item.snapshot_after);
  const actorId = item.actor?.id ?? item.actor_id ?? null;
  const isSelfAction = action.startsWith("me.");
  const objectHref = relatedObjectHref(item.entity_type, item.entity_id, dashboardBase);

  const viewActorHref = actorId ? `${dashboardBase}/account?userId=${actorId}` : null;
  const viewAuditHref = actorId
    ? `${dashboardBase}/audit?user_id=${actorId}`
    : `${dashboardBase}/audit?logId=${item.id}`;

  const StatusIcon = status.tone === "success" ? CircleCheck : status.tone === "fail" ? CircleX : HelpCircle;
  const statusDot =
    status.tone === "success" ? "bg-emerald-500" : status.tone === "fail" ? "bg-red-500" : "bg-slate-400";
  const statusText =
    status.tone === "success" ? "text-emerald-600 dark:text-emerald-400" : status.tone === "fail" ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 rounded-full p-1.5 text-white shrink-0", statusDot)}>
            <StatusIcon size={12} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">{title}</p>

            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              {item.actor?.name && (
                <>
                  <dt className="text-slate-400 dark:text-slate-500">{t("audit.actorLabel")}</dt>
                  <dd className="truncate text-slate-600 dark:text-slate-300">{item.actor.name}</dd>
                  <dt className="text-slate-400 dark:text-slate-500">{t("audit.roleLabel")}</dt>
                  <dd className="text-slate-600 dark:text-slate-300">{roleLabel}</dd>
                </>
              )}
              {item.entity_type && (
                <>
                  <dt className="text-slate-400 dark:text-slate-500">{t("audit.relatedObjectLabel")}</dt>
                  <dd className="truncate text-slate-600 dark:text-slate-300">
                    {objectHref ? (
                      <Link href={objectHref} className="text-[#1E3A8A] underline underline-offset-2 hover:text-[#152a63] dark:text-sky-300">
                        {entityLabel}
                        {item.entity_id ? ` #${item.entity_id}` : ""}
                      </Link>
                    ) : (
                      <>
                        {entityLabel}
                        {item.entity_id ? ` #${item.entity_id}` : ""}
                      </>
                    )}
                  </dd>
                </>
              )}
              {changedFields.length > 0 && (
                <>
                  <dt className="text-slate-400 dark:text-slate-500">{t("audit.changedFieldsLabel")}</dt>
                  <dd className="truncate text-slate-600 dark:text-slate-300">
                    {changedFields.map((field) => translateChangedField(field, locale)).join(", ")}
                  </dd>
                </>
              )}
            </dl>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className={cn("text-xs font-semibold", statusText)}>{status.label}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatDistanceToNow(new Date(item.created_at || Date.now()), { addSuffix: true })}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              {viewActorHref && (
                <Link
                  href={viewActorHref}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] hover:text-[#152a63] dark:text-sky-300"
                >
                  {isSelfAction ? t("audit.viewProfile") : t("audit.viewUser")}
                  <ArrowRight size={11} />
                </Link>
              )}
              <Link
                href={viewAuditHref}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] hover:text-[#152a63] dark:text-sky-300"
              >
                {t("audit.seeAll")}
                <ArrowRight size={11} />
              </Link>
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {expanded ? t("audit.hideDetails") : t("audit.showDetails")}
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/40">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-slate-400 dark:text-slate-500">{t("audit.eventLabel")}</dt>
            <dd className="text-slate-600 dark:text-slate-300">{translateAuditEventLabel(action, locale)}</dd>
            <dt className="text-slate-400 dark:text-slate-500">{t("audit.technicalActionLabel")}</dt>
            <dd className="font-mono text-slate-500 dark:text-slate-400">{action}</dd>
            {item.entity_type && (
              <>
                <dt className="text-slate-400 dark:text-slate-500">{t("audit.technicalObjectLabel")}</dt>
                <dd className="font-mono text-slate-500 dark:text-slate-400">
                  {item.entity_type}
                  {item.entity_id ? ` #${item.entity_id}` : ""}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
