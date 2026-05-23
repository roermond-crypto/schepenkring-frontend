"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import {
  getLocationBidSettings,
  updateLocationBidSettings,
  type BidRoutingMode,
  type LocationBidSettings,
} from "@/lib/api/location-bid-settings";

export function LocationBidSettingsSection({
  locale,
  locationId,
}: {
  locale: AppLocale;
  locationId: number;
}) {
  const t = getDictionary(locale).LocationBidSettings;
  const [settings, setSettings] = useState<LocationBidSettings>({
    bids_page_enabled: false,
    seller_bid_notifications_enabled: true,
    direct_buyer_seller_chat_enabled: false,
    bid_routing_mode: "broker",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getLocationBidSettings(locationId);
        if (!cancelled) setSettings(data);
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateLocationBidSettings(locationId, settings);
      setSettings(updated);
      toast.success(t.saveSuccess);
    } catch {
      toast.error(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LocationBidSettingsSkeleton />;

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-[#0B1F3A]">{t.title}</h3>
      <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>

      <div className="mt-6 space-y-4">
        <ToggleRow
          label={t.bidsPageEnabled}
          checked={settings.bids_page_enabled}
          onChange={(checked) =>
            setSettings((prev) => ({ ...prev, bids_page_enabled: checked }))
          }
        />
        <ToggleRow
          label={t.sellerNotifications}
          checked={settings.seller_bid_notifications_enabled}
          onChange={(checked) =>
            setSettings((prev) => ({
              ...prev,
              seller_bid_notifications_enabled: checked,
            }))
          }
        />
        <ToggleRow
          label={t.directChat}
          checked={settings.direct_buyer_seller_chat_enabled}
          onChange={(checked) =>
            setSettings((prev) => ({
              ...prev,
              direct_buyer_seller_chat_enabled: checked,
            }))
          }
        />

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">{t.routingMode}</span>
          <select
            value={settings.bid_routing_mode}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                bid_routing_mode: e.target.value as BidRoutingMode,
              }))
            }
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          >
            <option value="direct">{t.modes.direct}</option>
            <option value="broker">{t.modes.broker}</option>
            <option value="admin_review">{t.modes.adminReview}</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        <Save size={16} />
        {saving ? t.saving : t.save}
      </button>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 rounded-full px-1 transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

function LocationBidSettingsSkeleton() {
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Skeleton className="h-6 w-56 rounded-md bg-slate-200" />
      <Skeleton className="mt-2 h-4 w-full max-w-xl rounded-md bg-slate-100" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3"
          >
            <Skeleton className="h-4 w-48 rounded-md bg-slate-200" />
            <Skeleton className="h-6 w-11 rounded-full bg-slate-100" />
          </div>
        ))}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-md bg-slate-200" />
          <Skeleton className="h-10 w-full rounded-xl bg-slate-100" />
        </div>
      </div>
      <Skeleton className="mt-6 h-10 w-28 rounded-xl bg-slate-200" />
    </section>
  );
}
