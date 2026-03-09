"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "@/shims/next-intl";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, RefreshCw, Search, Trash2, Pencil } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

type HarborStatus = "ACTIVE" | "INACTIVE";

type HarborRecord = {
  id: number;
  name: string;
  code: string;
  status: HarborStatus;
  created_at?: string;
  updated_at?: string;
};

type HarborPayload = {
  name: string;
  code: string;
  status: HarborStatus;
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function AdminHarborsPage() {
  const t = useTranslations("DashboardAdminLocations");
  const loadFailedText = t("toasts.loadFailed");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<HarborRecord[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | HarborStatus>("");
  const [editing, setEditing] = useState<HarborRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HarborRecord | null>(null);
  const [form, setForm] = useState<HarborPayload>({
    name: "",
    code: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadHarbors = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (debouncedQuery.trim()) params.search = debouncedQuery.trim();
      if (statusFilter) params.status = statusFilter;

      const res = await api.get("/admin/harbors", { params });
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
      setRows(list);
    } catch {
      toast.error(loadFailedText);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, statusFilter, loadFailedText]);

  useEffect(() => {
    void loadHarbors();
  }, [loadHarbors]);

  const isEdit = Boolean(editing);
  const canSubmit = form.name.trim().length > 1 && form.code.trim().length > 1;

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [rows],
  );

  function resetForm() {
    setEditing(null);
    setForm({ name: "", code: "", status: "ACTIVE" });
    setFormOpen(false);
  }

  async function handleSubmit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/harbors/${editing.id}`, {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          status: form.status,
        });
        toast.success(t("toasts.updated"));
      } else {
        await api.post("/admin/harbors", {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          status: form.status,
        });
        toast.success(t("toasts.created"));
      }
      resetForm();
      await loadHarbors();
    } catch {
      toast.error(isEdit ? t("toasts.updateFailed") : t("toasts.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/harbors/${deleteTarget.id}`);
      toast.success(t("toasts.deleted"));
      setDeleteTarget(null);
      await loadHarbors();
    } catch (error: any) {
      if (error?.response?.status === 409) {
        toast.error(t("toasts.deleteConflict"));
      } else {
        toast.error(t("toasts.deleteFailed"));
      }
    }
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              {t("header.kicker")}
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#003566] dark:text-slate-100">
              {t("header.title")}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("header.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => void loadHarbors()}
              className="rounded-xl bg-[#003566] text-white hover:bg-[#00284d]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("actions.refresh")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm({ name: "", code: "", status: "ACTIVE" });
                setFormOpen(true);
              }}
              className="rounded-xl bg-[#003566] text-white hover:bg-[#00284d]"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("actions.create")}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("filters.search")}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "" | HarborStatus)
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t("filters.allStatus")}</option>
            <option value="ACTIVE">{t("status.active")}</option>
            <option value="INACTIVE">{t("status.inactive")}</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#003566]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
                <tr className="text-left text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-5 py-4">{t("table.name")}</th>
                  <th className="px-5 py-4">{t("table.code")}</th>
                  <th className="px-5 py-4">{t("table.status")}</th>
                  <th className="px-5 py-4">{t("table.updated")}</th>
                  <th className="px-5 py-4">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 text-sm text-slate-700 last:border-b-0 dark:border-slate-800 dark:text-slate-200"
                  >
                    <td className="px-5 py-4 font-semibold">{row.name}</td>
                    <td className="px-5 py-4">{row.code}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          row.status === "ACTIVE"
                            ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }
                      >
                        {row.status === "ACTIVE"
                          ? t("status.active")
                          : t("status.inactive")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {formatDate(row.updated_at || row.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(row);
                            setForm({
                              name: row.name,
                              code: row.code,
                              status: row.status,
                            });
                            setFormOpen(true);
                          }}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label={t("actions.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row)}
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
                          aria-label={t("actions.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && sortedRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      {t("table.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={formOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">
              {isEdit ? t("form.editTitle") : t("form.createTitle")}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              {t("header.subtitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder={t("form.name")}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.code}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                placeholder={t("form.code")}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.value as HarborStatus,
                  }))
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ACTIVE">{t("status.active")}</option>
                <option value="INACTIVE">{t("status.inactive")}</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetForm}>
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!canSubmit || saving}
              onClick={() => void handleSubmit()}
              className="bg-[#003566] text-white hover:bg-[#00284d] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isEdit ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {isEdit ? t("actions.update") : t("actions.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.deleteBody", { name: deleteTarget?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
