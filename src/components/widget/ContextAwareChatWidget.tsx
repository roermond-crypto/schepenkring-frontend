"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { ChatWidget } from "@/components/widget/ChatWidget";
import { api } from "@/lib/api";

type YachtContext = {
  boatId?: number;
  locationId?: number;
  locationName?: string;
  boatName?: string;
};

function getMeaningfulText(...values: Array<string | number | null | undefined>) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (!text) continue;

    const normalized = text.toLowerCase();
    if (["-", "—", "–", "n/a", "na", "null", "undefined"].includes(normalized)) {
      continue;
    }

    return text;
  }

  return null;
}

function extractYachtIdFromPath(pathname: string): number | null {
  const match = pathname.match(/\/yachts\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function ContextAwareChatWidget() {
  const pathname = usePathname();
  const locale = useLocale();
  const [context, setContext] = useState<YachtContext>({});

  const yachtId = useMemo(() => extractYachtIdFromPath(pathname), [pathname]);
  const fallbackLocationId = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    try {
      const raw = window.localStorage.getItem("user_data");
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as {
        location_id?: number | null;
        client_location_id?: number | null;
        location?: { id?: number | null; name?: string | null } | null;
        client_location?: {
          id?: number | null;
          name?: string | null;
        } | null;
      };

      return (
        parsed.client_location_id ??
        parsed.location_id ??
        parsed.client_location?.id ??
        parsed.location?.id ??
        undefined
      ) as number | undefined;
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!yachtId) {
      return () => {
        cancelled = true;
      };
    }

    const loadContext = async () => {
      try {
        const response = await api.get(`/yachts/${yachtId}`);
        if (cancelled) return;

        const yacht = response.data ?? {};
        const locationId = Number(
          yacht.location_id ??
            yacht.location?.id ??
            fallbackLocationId ??
            0,
        );
        const locationName = getMeaningfulText(
          yacht.location?.name,
          yacht.vessel_lying,
          yacht.where,
        );
        const boatName = getMeaningfulText(
          yacht.boat_name,
          yacht.name,
          [yacht.manufacturer, yacht.model].filter(Boolean).join(" "),
        );

        setContext({
          boatId: yachtId,
          locationId: Number.isFinite(locationId) && locationId > 0 ? locationId : undefined,
          locationName: locationName ?? undefined,
          boatName: boatName ?? undefined,
        });
      } catch {
        if (cancelled) return;
        setContext({
          boatId: yachtId,
          locationId: fallbackLocationId,
        });
      }
    };

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [fallbackLocationId, yachtId]);

  const resolvedContext = yachtId
    ? context
    : {
        locationId: fallbackLocationId,
      };

  return (
    <ChatWidget
      boatId={resolvedContext.boatId}
      locationId={resolvedContext.locationId}
      locationName={resolvedContext.locationName}
      boatName={resolvedContext.boatName}
      locale={locale}
      widgetMode={resolvedContext.boatId ? "smart" : "chat"}
    />
  );
}
