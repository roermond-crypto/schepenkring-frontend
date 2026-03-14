"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { useTranslations } from "next-intl";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Shield,
  Lock,
  Save,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import {
  getAdminUser,
  getMe,
  updateAdminUser,
  updateMeAddress,
  updateMePassword,
  updateMePersonal,
  updateMeProfile,
  updateMeSecurity,
  updateAvatar,
  type MeUser,
} from "@/lib/api/account";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { setClientSession, getClientToken } from "@/lib/auth/client-session";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";
import { api } from "@/lib/api";
import { useClientSession } from "@/components/session/ClientSessionProvider";
import { SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n";
import { normalizeRole } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";

type AccountTab = "profile" | "personal" | "address" | "security" | "password";

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "object" && error !== null) {
    const maybeResponse = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return (
      maybeResponse.response?.data?.message || maybeResponse.message || fallback
    );
  }
  return fallback;
}

function normalizeAvatarUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) {
    return value;
  }

  const configured =
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.BACKEND_API_URL;
  const apiBase = normalizeApiBaseUrl(
    configured || "https://app.schepen-kring.nl/api",
  );
  const origin = apiBase.replace(/\/api\/?$/, "");

  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
}

function normalizeLocaleValue(
  value?: string | null,
  fallback: AppLocale = "nl",
): AppLocale {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  const matched = SUPPORTED_LOCALES.find(
    (locale) => normalized === locale || normalized.startsWith(`${locale}-`),
  );

  return matched ?? fallback;
}

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GooglePlaceResult = {
  address_components?: GoogleAddressComponent[];
};

type GooglePlacesAutocomplete = {
  addListener: (eventName: string, handler: () => void) => void;
  getPlace: () => GooglePlaceResult;
};

type LocationOption = {
  id: number;
  name: string;
  code?: string | null;
};

type GoogleWindow = Window & {
  google?: {
    maps?: {
      places?: {
        Autocomplete: new (
          input: HTMLInputElement,
          options: {
            fields: string[];
            types: string[];
          },
        ) => GooglePlacesAutocomplete;
      };
    };
  };
};

export default function DashboardAccountPage() {
  const t = useTranslations("DashboardAccount");
  const router = useRouter();
  const params = useParams<{ role?: string; locale?: string }>();
  const searchParams = useSearchParams();
  const { updateUser } = useClientSession();
  const role = params?.role ?? "admin";
  const locale = params?.locale ?? "en";
  const normalizedRouteLocale = normalizeLocaleValue(locale, "nl");
  const selectedUserId = searchParams.get("userId");
  const isAdminSelectedUserView = role === "admin" && Boolean(selectedUserId);

  const placeInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<AccountTab>("profile");
  const canEditCurrentTab =
    !isAdminSelectedUserView ||
    activeTab === "profile" ||
    activeTab === "personal";
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAdminSelectedUserView) return;
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const formData = new FormData();
    formData.append("avatar", file);

    setUploadingAvatar(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await updateAvatar(formData);
      const normalizedUser = {
        ...response.data,
        avatar: normalizeAvatarUrl(response.data.avatar),
      };
      setUser(normalizedUser);
      setSuccess("Profile picture updated successfully!");

      const token = getClientToken();
      if (token && normalizedUser) {
        const sessionUser: SessionUser = {
          id: String(normalizedUser.id),
          name: normalizedUser.name,
          email: normalizedUser.email,
          avatar: normalizedUser.avatar || undefined,
          role:
            normalizeRole(normalizedUser.role) ??
            normalizeRole(normalizedUser.type?.toLowerCase()) ??
            "client",
        };
        setClientSession(token, sessionUser);
      }

      updateUser({
        id: String(normalizedUser.id),
        name: normalizedUser.name,
        email: normalizedUser.email,
        avatar: normalizedUser.avatar || undefined,
      });

      try {
        const rawUserData = localStorage.getItem("user_data");
        if (rawUserData) {
          const parsed = JSON.parse(rawUserData) as Record<string, unknown>;
          localStorage.setItem(
            "user_data",
            JSON.stringify({
              ...parsed,
              avatar: normalizedUser.avatar,
            }),
          );
        }
      } catch {
        // Ignore malformed local user cache.
      }

      router.refresh();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to upload profile picture."));
    } finally {
      setUploadingAvatar(false);
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    name: "",
    timezone: "",
    locale: "en",
  });
  const [personal, setPersonal] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    date_of_birth: "",
    email: "",
  });
  const [address, setAddress] = useState({
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  });
  const [security, setSecurity] = useState({
    two_factor_enabled: false,
    otp_secret: "",
    otp_code: "",
  });
  const [password, setPassword] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [availableLocations, setAvailableLocations] = useState<
    LocationOption[]
  >([]);
  const [locationAssignment, setLocationAssignment] = useState({
    location_id: "",
    location_role: "LOCATION_EMPLOYEE",
  });

  const tabs: Array<{ id: AccountTab; label: string }> = [
    { id: "profile", label: t("tabs.profile") },
    { id: "personal", label: t("tabs.personal") },
    { id: "address", label: t("tabs.address") },
    { id: "security", label: t("tabs.security") },
    { id: "password", label: t("tabs.password") },
  ];

  const localeOptions: Array<{ value: AppLocale; label: string }> =
    SUPPORTED_LOCALES.map((value) => ({
      value,
      label: t(`languages.${value}`),
    }));

  const activeTabLabel =
    tabs.find((tab) => tab.id === activeTab)?.label ?? t("tabs.profile");

  useEffect(() => {
    let active = true;
    const loadMe = async () => {
      setLoading(true);
      setError(null);
      try {
        const response =
          isAdminSelectedUserView && selectedUserId
            ? await getAdminUser(selectedUserId)
            : await getMe();
        if (!active) return;

        const nextUser = {
          ...response.data,
          avatar: normalizeAvatarUrl(response.data.avatar),
        };
        setUser(nextUser);
        if (!isAdminSelectedUserView) {
          updateUser({
            id: String(nextUser.id),
            name: nextUser.name,
            email: nextUser.email,
            avatar: nextUser.avatar || undefined,
          });
        }
        setProfile({
          name: nextUser.name || "",
          timezone: nextUser.timezone || "",
          locale: normalizeLocaleValue(nextUser.locale, normalizedRouteLocale),
        });
        setPersonal({
          first_name: nextUser.first_name || "",
          last_name: nextUser.last_name || "",
          phone: nextUser.phone || "",
          date_of_birth: nextUser.date_of_birth || "",
          email: nextUser.email || "",
        });
        setAddress({
          address_line1: nextUser.address_line1 || "",
          address_line2: nextUser.address_line2 || "",
          city: nextUser.city || "",
          state: nextUser.state || "",
          postal_code: nextUser.postal_code || "",
          country: nextUser.country || "",
        });
        setSecurity((prev) => ({
          ...prev,
          two_factor_enabled: nextUser.two_factor_enabled,
        }));
        setLocationAssignment({
          location_id:
            nextUser.location_id !== null && nextUser.location_id !== undefined
              ? String(nextUser.location_id)
              : "",
          location_role: nextUser.location_role || "LOCATION_EMPLOYEE",
        });
      } catch (err: unknown) {
        if (!active) return;
        setError(extractErrorMessage(err, "Failed to load account profile."));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadMe();
    return () => {
      active = false;
    };
  }, [
    isAdminSelectedUserView,
    normalizedRouteLocale,
    selectedUserId,
    updateUser,
  ]);

  useEffect(() => {
    if (!isAdminSelectedUserView) return;

    let active = true;

    const loadLocations = async () => {
      try {
        const response = await api.get<{ data?: LocationOption[] }>(
          "/admin/locations",
        );
        if (!active) return;
        setAvailableLocations(
          Array.isArray(response.data?.data) ? response.data.data : [],
        );
      } catch (err) {
        if (!active) return;
        console.error("Failed to load admin locations for assignment", err);
      }
    };

    void loadLocations();
    return () => {
      active = false;
    };
  }, [isAdminSelectedUserView]);

  useEffect(() => {
    if (activeTab !== "address") return;
    if (typeof window === "undefined") return;
    if (!placeInputRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey) return;

    let cancelled = false;

    const setupAutocomplete = () => {
      const googleRef = (window as GoogleWindow).google;
      if (!googleRef?.maps?.places?.Autocomplete || !placeInputRef.current)
        return;

      const autocomplete = new googleRef.maps.places.Autocomplete(
        placeInputRef.current,
        {
          fields: ["address_components", "formatted_address"],
          types: ["address"],
        },
      );

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;

        let address1 = "";
        let city = "";
        let state = "";
        let postal = "";
        let countryObj = "";

        place.address_components.forEach(
          (component: GoogleAddressComponent) => {
            const types = component.types;
            if (types.includes("street_number")) {
              address1 = `${component.long_name} ${address1}`;
            }
            if (types.includes("route")) {
              address1 += component.short_name;
            }
            if (types.includes("locality")) {
              city = component.long_name;
            }
            if (types.includes("administrative_area_level_1")) {
              state = component.long_name;
            }
            if (types.includes("postal_code")) {
              postal = component.long_name;
            }
            if (types.includes("country")) {
              countryObj = component.short_name;
            }
          },
        );

        setAddress((prev) => ({
          ...prev,
          address_line1:
            address1.trim() ||
            placeInputRef.current?.value ||
            prev.address_line1,
          city: city || prev.city,
          state: state || prev.state,
          postal_code: postal || prev.postal_code,
          country: countryObj || prev.country,
        }));
      });
    };

    const existingGoogle = (window as GoogleWindow).google;
    if (existingGoogle?.maps?.places?.Autocomplete) {
      setupAutocomplete();
      return;
    }

    const scriptId = "google-places-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const handleLoad = () => {
      if (!cancelled) setupAutocomplete();
    };

    if (script) {
      script.addEventListener("load", handleLoad);
      return () => {
        cancelled = true;
        script?.removeEventListener("load", handleLoad);
      };
    }

    script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", handleLoad);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script?.removeEventListener("load", handleLoad);
    };
  }, [activeTab]);

  const completion = useMemo(() => {
    const fields = [
      profile.name,
      personal.email,
      personal.phone,
      address.address_line1,
      address.city,
      address.country,
      profile.timezone,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [profile, personal, address]);

  const saveCurrentTab = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (isAdminSelectedUserView && selectedUserId) {
        if (activeTab === "profile") {
          const response = await updateAdminUser(selectedUserId, {
            name: profile.name,
            status: user?.status || "ACTIVE",
            location_id:
              user?.type === "EMPLOYEE"
                ? locationAssignment.location_id
                  ? Number(locationAssignment.location_id)
                  : null
                : undefined,
            location_role:
              user?.type === "EMPLOYEE"
                ? locationAssignment.location_role || null
                : undefined,
          });
          setUser({
            ...response.data,
            avatar: normalizeAvatarUrl(response.data.avatar),
          });
        } else if (activeTab === "personal") {
          const response = await updateAdminUser(selectedUserId, {
            email: personal.email || null,
            phone: personal.phone || null,
          });
          setUser({
            ...response.data,
            avatar: normalizeAvatarUrl(response.data.avatar),
          });
        } else {
          throw new Error("This section is read-only for selected users.");
        }
      } else if (activeTab === "profile") {
        const response = await updateMeProfile({
          name: profile.name,
          timezone: profile.timezone || null,
          locale: profile.locale || null,
        });
        setUser(response.data);
      } else if (activeTab === "personal") {
        const response = await updateMePersonal({
          first_name: personal.first_name || null,
          last_name: personal.last_name || null,
          phone: personal.phone || null,
          date_of_birth: personal.date_of_birth || null,
          email: personal.email || null,
        });
        setUser(response.data);
      } else if (activeTab === "address") {
        const response = await updateMeAddress({
          address_line1: address.address_line1 || null,
          address_line2: address.address_line2 || null,
          city: address.city || null,
          state: address.state || null,
          postal_code: address.postal_code || null,
          country: address.country || null,
        });
        setUser(response.data);
      } else if (activeTab === "security") {
        const response = await updateMeSecurity({
          two_factor_enabled: security.two_factor_enabled,
          otp_secret: security.otp_secret || undefined,
          otp_code: security.otp_code || undefined,
        });
        setUser(response.data);
      } else {
        if (
          !password.password ||
          password.password !== password.password_confirmation
        ) {
          throw new Error(t("toasts.passwordMismatch"));
        }
        const response = await updateMePassword(password);
        setUser(response.data);
        setPassword({
          current_password: "",
          password: "",
          password_confirmation: "",
        });
      }

      setSuccess(t("toasts.saved"));
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t("toasts.updateFailed")));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#003566]" />
      </div>
    );
  }

  const initials =
    user?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const twoFactorStatusLabel = user?.two_factor_confirmed_at
    ? t("labels.verified")
    : security.two_factor_enabled
      ? t("labels.pendingVerification")
      : t("labels.notConfigured");

  return (
    <>
      <Toaster position="top-right" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mx-auto max-w-6xl"
      >
        <div className="relative mt-2 overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-[#F7FAFF] to-[#E7F0FF] px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 sm:px-8">
          {isAdminSelectedUserView ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/${locale}/dashboard/admin/users`)}
                className="h-10 rounded-2xl border-slate-200 bg-white/80 px-4 text-xs font-bold uppercase tracking-[0.16em]"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Users
              </Button>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
                Viewing selected user account
              </div>
            </div>
          ) : null}
          <p className="text-[10px] font-black uppercase tracking-[0.38em] text-blue-600 dark:text-blue-300">
            {t("header.subtitle")}
          </p>
          <h1 className="mt-3 text-4xl font-serif italic text-[#003566] dark:text-slate-100 sm:text-5xl">
            {t("header.title")}
          </h1>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/80 bg-white/80 p-4 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                {t("tabs.profile")}
              </p>
              <p className="mt-2 text-lg font-bold text-[#0B1F3A] dark:text-slate-100">
                {completion}%
              </p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-white/80 p-4 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                {t("tabs.address")}
              </p>
              <p className="mt-2 text-lg font-bold text-[#0B1F3A] dark:text-slate-100">
                {address.city || address.country || "..."}
              </p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-white/80 p-4 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                {t("tabs.security")}
              </p>
              <p className="mt-2 text-lg font-bold text-[#0B1F3A] dark:text-slate-100">
                {security.two_factor_enabled ? t("labels.yes") : t("labels.no")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="sticky top-24 overflow-hidden rounded-[2rem] border border-slate-200 bg-[#0B1F3A] p-8 text-center text-white shadow-[0_24px_48px_rgba(11,31,58,0.24)]">
              <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/20 bg-white/10 text-3xl font-bold">
                {user?.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user?.name || "Avatar"}
                    width={128}
                    height={128}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  initials
                )}
              </div>
              <h2 className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-white">
                {user?.name || t("labels.user")}
              </h2>
              <p className="mt-2 text-xs text-slate-300">{user?.email}</p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                    {t("tabs.profile")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {completion}%
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                    {t("tabs.security")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {security.two_factor_enabled
                      ? t("labels.yes")
                      : t("labels.no")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 lg:hidden">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as AccountTab)}
                  className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-[#003566] outline-none focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {tabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className="hidden overflow-x-auto lg:flex"
                style={{ scrollbarWidth: "none" }}
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={cn(
                      "min-h-[44px] shrink-0 border-b-2 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                      activeTab === tab.id
                        ? "border-[#003566] text-[#003566] dark:border-slate-200 dark:text-slate-100"
                        : "border-transparent text-slate-400 hover:text-[#003566] dark:hover:text-slate-200",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-100 bg-gradient-to-r from-[#F8FBFF] to-white px-5 py-5 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900 sm:px-7">
                <h2 className="text-lg font-bold text-[#003566] dark:text-slate-100">
                  {activeTabLabel}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t("header.subtitle")}
                </p>
              </div>

              <div className="space-y-5 p-5 sm:p-7">
                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}
                {success ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                  </div>
                ) : null}

                {activeTab === "profile" ? (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-[#E7F0FF] shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        {user?.avatar ? (
                          <Image
                            src={user.avatar}
                            alt="Avatar"
                            className="h-full w-full object-cover"
                            fill
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#0B1F3A] dark:text-slate-100">
                            {profile.name
                              ?.split(" ")
                              .map((s) => s[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "U"}
                          </div>
                        )}
                        {uploadingAvatar && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-center space-y-2 text-center sm:text-left">
                        <div>
                          <p className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                            {t("labels.profilePicture") || "Profile Picture"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t("labels.uploadHelp") ||
                              "Upload a new avatar (max 5MB, WEBP/JPG/PNG)."}
                          </p>
                        </div>
                        <div className="relative inline-flex">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={
                              uploadingAvatar || isAdminSelectedUserView
                            }
                            className="h-9 relative overflow-hidden text-xs"
                          >
                            {uploadingAvatar
                              ? t("actions.uploading") || "Uploading..."
                              : t("actions.uploadImage") || "Upload Image"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="absolute inset-0 cursor-pointer opacity-0"
                              onChange={handleAvatarUpload}
                              disabled={
                                uploadingAvatar || isAdminSelectedUserView
                              }
                            />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                          <User size={12} /> {t("fields.fullName")}
                        </span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          value={profile.name}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, name: e.target.value }))
                          }
                        />
                      </label>
                      {isAdminSelectedUserView ? (
                        <label className="space-y-2">
                          <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                            <Shield size={12} /> Status
                          </span>
                          <select
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            value={user?.status || "ACTIVE"}
                            onChange={(e) =>
                              setUser((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      status: e.target
                                        .value as MeUser["status"],
                                    }
                                  : prev,
                              )
                            }
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="DISABLED">Inactive</option>
                            <option value="BLOCKED">Blocked</option>
                          </select>
                        </label>
                      ) : null}
                      {isAdminSelectedUserView && user?.type === "EMPLOYEE" ? (
                        <>
                          <label className="space-y-2">
                            <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                              <MapPin size={12} />{" "}
                              {t("fields.location") || "Location"}
                            </span>
                            <select
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              value={locationAssignment.location_id}
                              onChange={(e) =>
                                setLocationAssignment((current) => ({
                                  ...current,
                                  location_id: e.target.value,
                                }))
                              }
                            >
                              <option value="">
                                {t("labels.noLocationAssigned") ||
                                  "No location assigned"}
                              </option>
                              {availableLocations.map((location) => (
                                <option
                                  key={location.id}
                                  value={String(location.id)}
                                >
                                  {location.name}
                                  {location.code ? ` (${location.code})` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                              <Shield size={12} />{" "}
                              {t("fields.locationRole") || "Location role"}
                            </span>
                            <select
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              value={locationAssignment.location_role}
                              onChange={(e) =>
                                setLocationAssignment((current) => ({
                                  ...current,
                                  location_role: e.target.value,
                                }))
                              }
                            >
                              <option value="LOCATION_EMPLOYEE">
                                LOCATION_EMPLOYEE
                              </option>
                              <option value="LOCATION_MANAGER">
                                LOCATION_MANAGER
                              </option>
                            </select>
                          </label>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:col-span-2 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                              {t("labels.assignmentStatus") ||
                                "Assignment status"}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                              {user.has_location_assignment
                                ? user.location?.name || t("labels.yes")
                                : t("labels.noLocationAssigned") ||
                                  "No location assigned"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {user.can_access_board
                                ? t("labels.boardAccessEnabled") ||
                                  "Board access enabled for this employee."
                                : t("labels.boardAccessDisabled") ||
                                  "Board access depends on a valid location assignment."}
                            </p>
                          </div>
                        </>
                      ) : null}
                      <label className="space-y-2">
                        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                          <Globe size={12} /> {t("fields.locale")}
                        </span>
                        <select
                          disabled={isAdminSelectedUserView}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          value={profile.locale}
                          onChange={(e) =>
                            setProfile((p) => ({
                              ...p,
                              locale: normalizeLocaleValue(
                                e.target.value,
                                normalizedRouteLocale,
                              ),
                            }))
                          }
                        >
                          {localeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 sm:col-span-2">
                        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                          <Globe size={12} /> {t("fields.timezone")}
                        </span>
                        <input
                          disabled={isAdminSelectedUserView}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          value={profile.timezone}
                          onChange={(e) =>
                            setProfile((p) => ({
                              ...p,
                              timezone: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {activeTab === "personal" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <User size={12} /> {t("fields.firstName")}
                      </span>
                      <input
                        disabled={isAdminSelectedUserView}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={personal.first_name}
                        onChange={(e) =>
                          setPersonal((p) => ({
                            ...p,
                            first_name: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <User size={12} /> {t("fields.lastName")}
                      </span>
                      <input
                        disabled={isAdminSelectedUserView}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={personal.last_name}
                        onChange={(e) =>
                          setPersonal((p) => ({
                            ...p,
                            last_name: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <Mail size={12} /> {t("fields.emailAddress")}
                      </span>
                      <input
                        type="email"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={personal.email}
                        onChange={(e) =>
                          setPersonal((p) => ({ ...p, email: e.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <Phone size={12} /> {t("fields.phoneNumber")}
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={personal.phone}
                        onChange={(e) =>
                          setPersonal((p) => ({ ...p, phone: e.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2 sm:col-span-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <User size={12} /> {t("fields.dateOfBirth")}
                      </span>
                      <input
                        disabled={isAdminSelectedUserView}
                        type="date"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={personal.date_of_birth}
                        onChange={(e) =>
                          setPersonal((p) => ({
                            ...p,
                            date_of_birth: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                ) : null}

                {activeTab === "address" ? (
                  <fieldset
                    disabled={isAdminSelectedUserView}
                    className="grid gap-4 sm:grid-cols-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <label className="space-y-2 sm:col-span-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <MapPin size={12} /> {t("fields.addressLine1")}
                      </span>
                      <input
                        ref={placeInputRef}
                        autoComplete="off"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={address.address_line1}
                        onChange={(e) =>
                          setAddress((p) => ({
                            ...p,
                            address_line1: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2 sm:col-span-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <MapPin size={12} /> {t("fields.addressLine2")}
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={address.address_line2}
                        onChange={(e) =>
                          setAddress((p) => ({
                            ...p,
                            address_line2: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <MapPin size={12} /> {t("fields.city")}
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={address.city}
                        onChange={(e) =>
                          setAddress((p) => ({ ...p, city: e.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <MapPin size={12} /> {t("fields.state")}
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={address.state}
                        onChange={(e) =>
                          setAddress((p) => ({ ...p, state: e.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <MapPin size={12} /> {t("fields.postalCode")}
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={address.postal_code}
                        onChange={(e) =>
                          setAddress((p) => ({
                            ...p,
                            postal_code: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <Globe size={12} /> {t("fields.country")}
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={address.country}
                        onChange={(e) =>
                          setAddress((p) => ({ ...p, country: e.target.value }))
                        }
                      />
                    </label>
                  </fieldset>
                ) : null}

                {activeTab === "security" ? (
                  <fieldset
                    disabled={isAdminSelectedUserView}
                    className="grid gap-4 sm:grid-cols-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <Shield size={14} />
                        <input
                          type="checkbox"
                          checked={security.two_factor_enabled}
                          onChange={(e) =>
                            setSecurity((p) => ({
                              ...p,
                              two_factor_enabled: e.target.checked,
                            }))
                          }
                        />
                        {t("fields.twoFactor")}
                      </label>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {t("labels.twoFactorStatus")} {twoFactorStatusLabel}
                    </div>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <Shield size={12} /> {t("fields.otpSecret")}
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={security.otp_secret}
                        onChange={(e) =>
                          setSecurity((p) => ({
                            ...p,
                            otp_secret: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <Shield size={12} /> {t("fields.otpCode")}
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={security.otp_code}
                        onChange={(e) =>
                          setSecurity((p) => ({
                            ...p,
                            otp_code: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </fieldset>
                ) : null}

                {activeTab === "password" ? (
                  <fieldset
                    disabled={isAdminSelectedUserView}
                    className="grid gap-4 sm:grid-cols-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <label className="space-y-2 sm:col-span-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <Lock size={12} /> {t("fields.currentPassword")}
                      </span>
                      <input
                        type="password"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={password.current_password}
                        onChange={(e) =>
                          setPassword((p) => ({
                            ...p,
                            current_password: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <Lock size={12} /> {t("fields.newPassword")}
                      </span>
                      <input
                        type="password"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={password.password}
                        onChange={(e) =>
                          setPassword((p) => ({
                            ...p,
                            password: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                        <Lock size={12} /> {t("fields.confirmPassword")}
                      </span>
                      <input
                        type="password"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-[#003566] outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={password.password_confirmation}
                        onChange={(e) =>
                          setPassword((p) => ({
                            ...p,
                            password_confirmation: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </fieldset>
                ) : null}

                {isAdminSelectedUserView && !canEditCurrentTab ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    This section is view-only for selected users. Admin editing
                    is currently limited to name, email, phone, and status.
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void saveCurrentTab()}
                    disabled={saving || !canEditCurrentTab}
                    className="h-11 rounded-2xl bg-[#003566] px-5 text-xs font-bold uppercase tracking-[0.16em] text-white hover:bg-[#00284d]"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {saving ? t("actions.saving") : t("actions.syncProfile")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
