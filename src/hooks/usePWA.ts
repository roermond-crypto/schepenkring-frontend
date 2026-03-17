"use client";

import { useEffect, useState } from "react";

type InstallOutcome = "accepted" | "dismissed" | "unavailable" | "ios";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;

const isStandaloneMode = () => {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
};

const isIOSSafariBrowser = () => {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

  return isIOS && isSafari;
};

export const usePWA = () => {
  const [isPWA, setIsPWA] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(sharedDeferredPrompt);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncModeState = () => {
      setIsPWA(isStandaloneMode());
      setIsIOSSafari(isIOSSafariBrowser());
    };

    syncModeState();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      const installEvent = event as BeforeInstallPromptEvent;
      sharedDeferredPrompt = installEvent;
      setDeferredPrompt(installEvent);
    };

    const handleAppInstalled = () => {
      sharedDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsPWA(true);
    };

    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => syncModeState();

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (typeof displayModeQuery.addEventListener === "function") {
      displayModeQuery.addEventListener("change", handleDisplayModeChange);
    } else {
      displayModeQuery.addListener(handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);

      if (typeof displayModeQuery.removeEventListener === "function") {
        displayModeQuery.removeEventListener("change", handleDisplayModeChange);
      } else {
        displayModeQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  const hasDeferredPrompt = Boolean(deferredPrompt || sharedDeferredPrompt);
  const isInstallable = !isPWA && (hasDeferredPrompt || isIOSSafari);

  const installPWA = async (): Promise<InstallOutcome> => {
    if (isPWA) return "unavailable";
    if (isIOSSafari) return "ios";

    const promptEvent = deferredPrompt || sharedDeferredPrompt;

    if (!promptEvent) {
      return "unavailable";
    }

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;

    sharedDeferredPrompt = null;
    setDeferredPrompt(null);

    if (outcome === "accepted") {
      setIsPWA(true);
      return "accepted";
    }

    return "dismissed";
  };

  return {
    isPWA,
    isIOSSafari,
    isInstallable,
    installPWA,
    hasDeferredPrompt,
  };
};
