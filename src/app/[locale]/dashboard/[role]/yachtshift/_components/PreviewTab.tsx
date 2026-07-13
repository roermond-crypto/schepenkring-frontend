"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Database, FileCode, Loader2, Plus, Sailboat, ShoppingBag, Trash2, Waypoints } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarketplacePreview, TestYacht } from "../_types";

type StageId = "form" | "database" | "openmarine" | "yachtshift" | "marketplace";
type SubTab = "database" | "openmarine" | "yachtshift" | "api";

export function PreviewTab() {
  const t = useTranslations("IntegrationCenter.preview");

  const [testYachts, setTestYachts] = useState<TestYacht[]>([]);
  const [testYachtsLoading, setTestYachtsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [form, setForm] = useState({ boat_type: "", builder: "", model: "", engine: "", length: "", price: "" });
  const [generating, setGenerating] = useState(false);

  const [selectedTestYachtId, setSelectedTestYachtId] = useState("");
  const [manualYachtId, setManualYachtId] = useState("");
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [preview, setPreview] = useState<MarketplacePreview | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("database");

  const loadTestYachts = useCallback(async () => {
    setTestYachtsLoading(true);
    try {
      const res = await api.get<{ data: TestYacht[] }>("/admin/test-yachts");
      setTestYachts(res.data.data ?? []);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setTestYachtsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTestYachts();
  }, [loadTestYachts]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const payload = {
        boat_type: form.boat_type || undefined,
        builder: form.builder || undefined,
        model: form.model || undefined,
        engine: form.engine || undefined,
        length: form.length ? Number(form.length) : undefined,
        price: form.price ? Number(form.price) : undefined,
      };
      await api.post("/admin/test-yachts", payload);
      toast.success(t("generateSuccess"));
      setForm({ boat_type: "", builder: "", model: "", engine: "", length: "", price: "" });
      void loadTestYachts();
    } catch {
      toast.error(t("generateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (yacht: TestYacht) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    setDeletingId(yacht.id);
    try {
      await api.delete(`/admin/test-yachts/${yacht.id}`);
      toast.success(t("deleteSuccess"));
      setTestYachts((prev) => prev.filter((y) => y.id !== yacht.id));
      if (selectedTestYachtId === String(yacht.id)) setSelectedTestYachtId("");
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  const loadPipeline = async () => {
    const yachtId = selectedTestYachtId || manualYachtId;
    if (!yachtId) return;
    setPipelineLoading(true);
    setPreview(null);
    try {
      const res = await api.get<MarketplacePreview>(`/admin/openmarine/preview/${yachtId}`);
      setPreview(res.data);
      setSubTab("database");
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setPipelineLoading(false);
    }
  };

  const stages: { id: StageId; label: string; icon: typeof Sailboat; sub?: SubTab }[] = [
    { id: "form", label: t("stageBoatForm"), icon: Sailboat },
    { id: "database", label: t("stageDatabase"), icon: Database, sub: "database" },
    { id: "openmarine", label: t("stageOpenMarine"), icon: FileCode, sub: "openmarine" },
    { id: "yachtshift", label: t("stageYachtShift"), icon: Waypoints, sub: "yachtshift" },
    { id: "marketplace", label: t("stageMarketplace"), icon: ShoppingBag, sub: "api" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Test Yacht Generator ──────────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-400">{t("generatorTitle")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input placeholder={t("boatType")} value={form.boat_type} onChange={(e) => setForm({ ...form, boat_type: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" />
          <input placeholder={t("builder")} value={form.builder} onChange={(e) => setForm({ ...form, builder: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" />
          <input placeholder={t("model")} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" />
          <input placeholder={t("engine")} value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" />
          <input type="number" placeholder={t("length")} value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" />
          <input type="number" placeholder={t("price")} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" />
        </div>
        <Button size="sm" disabled={generating} onClick={() => void handleGenerate()} className="mt-3 gap-1.5 rounded-lg bg-[#003566] text-xs text-white hover:bg-[#00284f]">
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          {generating ? t("generating") : t("generate")}
        </Button>

        <p className="mb-2 mt-5 text-[11px] font-black uppercase tracking-wider text-slate-400">{t("testYachtsTitle")}</p>
        {testYachtsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : testYachts.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">{t("testYachtsEmpty")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {testYachts.map((y) => (
              <span key={y.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                #{y.id} {y.boat_name ?? y.model ?? y.boat_type ?? ""}
                <button type="button" disabled={deletingId === y.id} onClick={() => void handleDelete(y)} className="text-slate-400 hover:text-red-500">
                  {deletingId === y.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Pipeline ──────────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-400">{t("pipelineTitle")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTestYachtId}
            onChange={(e) => {
              setSelectedTestYachtId(e.target.value);
              if (e.target.value) setManualYachtId("");
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">{t("selectTestYacht")}</option>
            {testYachts.map((y) => (
              <option key={y.id} value={y.id}>
                #{y.id} {y.boat_name ?? y.model ?? y.boat_type ?? ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">{t("orYachtId")}</span>
          <input
            type="number"
            value={manualYachtId}
            onChange={(e) => {
              setManualYachtId(e.target.value);
              if (e.target.value) setSelectedTestYachtId("");
            }}
            className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          <Button
            size="sm"
            disabled={pipelineLoading || (!selectedTestYachtId && !manualYachtId)}
            onClick={() => void loadPipeline()}
            className="gap-1.5 rounded-lg bg-[#003566] text-xs text-white hover:bg-[#00284f]"
          >
            {pipelineLoading ? <Loader2 size={13} className="animate-spin" /> : null}
            {pipelineLoading ? t("loading") : t("loadPipeline")}
          </Button>
        </div>

        {preview && (
          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {stages.map((stage, i) => (
                <div key={stage.id} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stage.sub && setSubTab(stage.sub)}
                    disabled={!stage.sub}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                      stage.sub && subTab === stage.sub
                        ? "border-[#003566] bg-[#003566] text-white"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
                    )}
                  >
                    <stage.icon size={13} /> {stage.label}
                  </button>
                  {i < stages.length - 1 && <ArrowRight size={13} className="text-slate-300" />}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs italic text-slate-400">{t("sameDataNote")}</p>

            <div className="mt-4 flex gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {([
                { id: "database", label: t("tabDatabase") },
                { id: "openmarine", label: t("tabOpenMarine") },
                { id: "yachtshift", label: t("tabYachtShift") },
                { id: "api", label: t("tabApi") },
              ] as const).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSubTab(s.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold",
                    subTab === s.id ? "bg-white text-[#003566] shadow-sm dark:bg-slate-900 dark:text-slate-100" : "text-slate-500",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              {subTab === "database" && JSON.stringify(preview.database, null, 2)}
              {subTab === "openmarine" && preview.openmarine_xml.xml}
              {subTab === "yachtshift" && JSON.stringify(preview.yachtshift_json, null, 2)}
              {subTab === "api" &&
                ("error" in preview.generic_api_json ? t("noApiPlatform") : JSON.stringify(preview.generic_api_json, null, 2))}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
