"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2, Globe2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  platformId: number;
  logoUrl: string | null;
  onUploaded: (logoUrl: string) => void;
}

export function LogoUpload({ platformId, logoUrl, onUploaded }: LogoUploadProps) {
  const t = useTranslations("Platforms.logo");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("invalidType"));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await api.post<{ logo_url: string }>(`/admin/platforms/${platformId}/logo`, formData);
      onUploaded(res.data.logo_url);
      toast.success(t("uploadSuccess"));
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors",
        dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <Globe2 className="h-6 w-6 text-slate-300" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <UploadCloud className="h-4 w-4 text-slate-400" />
          {t("dropHint")}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">{t("fileHint")}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
