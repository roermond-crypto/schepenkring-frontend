"use client";

import type { LucideIcon } from "lucide-react";

export function ComingSoonTab({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400">
      <Icon size={32} className="mx-auto mb-3 opacity-40" />
      <p className="font-semibold text-slate-500">{title}</p>
      <p className="text-sm mt-1 max-w-sm mx-auto">{body}</p>
    </div>
  );
}
