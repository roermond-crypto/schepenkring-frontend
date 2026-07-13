"use client";

import type { LucideIcon } from "lucide-react";

export function ComingSoonTab({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-10 text-center text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Icon size={32} className="mx-auto mb-3 opacity-40" />
      <p className="font-semibold text-slate-500 dark:text-slate-300">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm">{body}</p>
    </div>
  );
}
