"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

interface MappingRow {
  ours: string;
  theirs: string;
}

function parseMap(json: string): MappingRow[] {
  if (!json.trim()) return [];
  try {
    const obj = JSON.parse(json);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return Object.entries(obj).map(([ours, theirs]) => ({ ours, theirs: String(theirs) }));
    }
  } catch {
    // fall through — invalid JSON renders as an empty table rather than crashing
  }
  return [];
}

function serializeMap(rows: MappingRow[]): string {
  const obj: Record<string, string> = {};
  for (const row of rows) {
    if (row.ours.trim()) obj[row.ours.trim()] = row.theirs;
  }
  return JSON.stringify(obj, null, 2);
}

export function CategoryMappingTable({ value, onChange }: { value: string; onChange: (json: string) => void }) {
  const t = useTranslations("Platforms.openmarine.mappingTable");
  const [rows, setRows] = useState<MappingRow[]>(() => parseMap(value));
  const [prevValue, setPrevValue] = useState(value);
  const [lastEmitted, setLastEmitted] = useState(value);

  // Adjust state during render (React's sanctioned alternative to an effect
  // here) rather than setState-in-effect: skip re-parsing our own edits (a
  // still-blank "ours" key gets dropped from the serialized JSON, which
  // would otherwise make a freshly added row vanish before the user can
  // type into it) and only resync from genuinely external value changes.
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== lastEmitted) {
      setLastEmitted(value);
      setRows(parseMap(value));
    }
  }

  const update = (next: MappingRow[]) => {
    setRows(next);
    const json = serializeMap(next);
    setLastEmitted(json);
    setPrevValue(json);
    onChange(json);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 px-1">
        <span>{t("ourCategory")}</span>
        <span>{t("platformCategory")}</span>
        <span />
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-slate-400 italic px-1">{t("empty")}</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <Input
            value={row.ours}
            onChange={(e) => update(rows.map((r, idx) => (idx === i ? { ...r, ours: e.target.value } : r)))}
            placeholder="motorboat"
            className="text-sm font-mono"
          />
          <Input
            value={row.theirs}
            onChange={(e) => update(rows.map((r, idx) => (idx === i ? { ...r, theirs: e.target.value } : r)))}
            placeholder="MB"
            className="text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => update(rows.filter((_, idx) => idx !== i))}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-red-100 text-red-500 hover:bg-red-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => update([...rows, { ours: "", theirs: "" }])}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-1"
      >
        <Plus size={14} /> {t("addRow")}
      </button>
    </div>
  );
}
