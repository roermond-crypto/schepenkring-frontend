"use client";

import { Download, PlusSquare, Share } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { usePWA } from "@/hooks/usePWA";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PwaInstallButtonProps = {
  locale: AppLocale;
};

const FALLBACK_COPY = {
  installApp: "Install app",
  installIosInstructions:
    'To install this app, open the Share menu in Safari and choose "Add to Home Screen".',
  installUnavailable: "This app can't be installed from this browser yet.",
  installIosStepShare: "Tap Share",
  installIosStepAddToHomeScreen: "Tap Add to Home Screen",
} as const;

export function PwaInstallButton({ locale }: PwaInstallButtonProps) {
  const t = getDictionary(locale).dashboard.header;
  const { isPWA, isInstallable, installPWA, isIOSSafari } = usePWA();
  const copy = {
    installApp: t.installApp ?? FALLBACK_COPY.installApp,
    installIosInstructions:
      t.installIosInstructions ?? FALLBACK_COPY.installIosInstructions,
    installUnavailable:
      t.installUnavailable ?? FALLBACK_COPY.installUnavailable,
    installIosStepShare:
      t.installIosStepShare ?? FALLBACK_COPY.installIosStepShare,
    installIosStepAddToHomeScreen:
      t.installIosStepAddToHomeScreen ??
      FALLBACK_COPY.installIosStepAddToHomeScreen,
  };
  const [showIosModal, setShowIosModal] = useState(false);

  if (isPWA || !isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    if (isIOSSafari) {
      setShowIosModal(true);
      return;
    }

    const outcome = await installPWA();

    if (outcome === "dismissed" || outcome === "unavailable") {
      toast(copy.installUnavailable);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#d6e1ee] bg-white text-[#0B1F3A] transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-label={copy.installApp}
        title={copy.installApp}
      >
        <Download className="h-4 w-4" />
      </button>

      <Dialog open={showIosModal} onOpenChange={setShowIosModal}>
        <DialogContent className="max-w-md border border-slate-200 p-7 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#0B1F3A] dark:text-slate-100">
              {copy.installApp}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {copy.installIosInstructions}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3 text-sm text-[#0B1F3A] dark:text-slate-100">
            <p className="flex items-center gap-2">
              <Share size={16} />
              <span>{copy.installIosStepShare}</span>
            </p>
            <p className="flex items-center gap-2">
              <PlusSquare size={16} />
              <span>{copy.installIosStepAddToHomeScreen}</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
