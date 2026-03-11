"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_SESSION_COOKIE,
  CLIENT_SESSION_UPDATED_EVENT,
} from "@/lib/auth/client-session";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";
import type { UserRole } from "@/lib/auth/roles";

type ClientSessionUser = {
  id?: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
};

type ClientSessionContextValue = {
  user: ClientSessionUser;
  setUser: (nextUser: ClientSessionUser) => void;
  updateUser: (updates: Partial<ClientSessionUser>) => void;
};

type ClientSessionProviderProps = {
  initialUser: ClientSessionUser;
  children: ReactNode;
};

const ClientSessionContext = createContext<ClientSessionContextValue | null>(
  null,
);

function normalizeAvatarUrl(value?: string | null) {
  if (!value) return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;
  if (
    cleaned === "undefined" ||
    cleaned === "null" ||
    cleaned === "[object Object]" ||
    cleaned.startsWith("prefix")
  ) {
    return undefined;
  }
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith("data:")) {
    return cleaned;
  }

  const configured =
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.BACKEND_API_URL;
  const apiBase = normalizeApiBaseUrl(
    configured || "https://app.schepen-kring.nl/api",
  );
  const origin = apiBase.replace(/\/api\/?$/, "");

  return cleaned.startsWith("/")
    ? `${origin}${cleaned}`
    : `${origin}/${cleaned}`;
}

function buildUserFromStorage(
  fallback: ClientSessionUser,
): ClientSessionUser | null {
  let localName: string | undefined;
  let localEmail: string | undefined;
  let localAvatar: string | undefined;
  let localRole: UserRole | undefined;
  let localId: string | undefined;

  try {
    const rawUserData = localStorage.getItem("user_data");
    if (rawUserData) {
      const parsed = JSON.parse(rawUserData) as {
        id?: string | number;
        name?: string;
        email?: string;
        avatar?: string | null;
        role?: UserRole;
      };

      localId =
        parsed.id !== undefined && parsed.id !== null
          ? String(parsed.id)
          : undefined;
      localName = parsed.name;
      localEmail = parsed.email;
      localAvatar = normalizeAvatarUrl(parsed.avatar);
      localRole = parsed.role;
    }
  } catch {
    // Ignore malformed local cache.
  }

  const encoded = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${AUTH_SESSION_COOKIE}=`))
    ?.split("=")[1];

  if (!encoded) {
    return {
      id: localId || fallback.id,
      name: localName || fallback.name,
      email: localEmail || fallback.email,
      avatar: localAvatar || fallback.avatar,
      role: localRole || fallback.role,
    };
  }

  try {
    const padded = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as {
      id?: string | number;
      name?: string;
      email?: string;
      avatar?: string;
      role?: UserRole;
    };

    return {
      id:
        localId ||
        (parsed.id !== undefined && parsed.id !== null
          ? String(parsed.id)
          : fallback.id),
      name: localName || parsed.name || fallback.name,
      email: localEmail || parsed.email || fallback.email,
      avatar: localAvatar || normalizeAvatarUrl(parsed.avatar) || fallback.avatar,
      role: localRole || parsed.role || fallback.role,
    };
  } catch {
    return {
      id: localId || fallback.id,
      name: localName || fallback.name,
      email: localEmail || fallback.email,
      avatar: localAvatar || fallback.avatar,
      role: localRole || fallback.role,
    };
  }
}

export function ClientSessionProvider({
  initialUser,
  children,
}: ClientSessionProviderProps) {
  const [user, setUserState] = useState<ClientSessionUser>({
    ...initialUser,
    avatar: normalizeAvatarUrl(initialUser.avatar),
  });

  useEffect(() => {
    setUserState({
      ...initialUser,
      avatar: normalizeAvatarUrl(initialUser.avatar),
    });
  }, [initialUser]);

  const setUser = useCallback((nextUser: ClientSessionUser) => {
    setUserState({
      ...nextUser,
      avatar: normalizeAvatarUrl(nextUser.avatar),
    });
  }, []);

  const updateUser = useCallback((updates: Partial<ClientSessionUser>) => {
    setUserState((current) => ({
      ...current,
      ...updates,
      avatar:
        updates.avatar !== undefined
          ? normalizeAvatarUrl(updates.avatar)
          : current.avatar,
    }));
  }, []);

  useEffect(() => {
    const syncUser = () => {
      const nextUser = buildUserFromStorage(initialUser);
      if (nextUser) {
        setUserState(nextUser);
      }
    };

    syncUser();
    window.addEventListener("focus", syncUser);
    window.addEventListener("storage", syncUser);
    window.addEventListener(CLIENT_SESSION_UPDATED_EVENT, syncUser);

    return () => {
      window.removeEventListener("focus", syncUser);
      window.removeEventListener("storage", syncUser);
      window.removeEventListener(CLIENT_SESSION_UPDATED_EVENT, syncUser);
    };
  }, [initialUser]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      updateUser,
    }),
    [setUser, updateUser, user],
  );

  return (
    <ClientSessionContext.Provider value={value}>
      {children}
    </ClientSessionContext.Provider>
  );
}

export function useClientSession() {
  const context = useContext(ClientSessionContext);
  if (!context) {
    throw new Error(
      "useClientSession must be used within ClientSessionProvider",
    );
  }
  return context;
}
