"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Shield,
  Server,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

/* ─── Types ──────────────────────────────────────────────── */

type Integration = {
  id: number;
  integration_type: string;
  label: string | null;
  username: string | null;
  has_password: boolean;
  has_api_key: boolean;
  password: string | null;
  api_key: string | null;
  environment: "test" | "live";
  status: "active" | "inactive";
  location_id: number | null;
  created_at: string;
  updated_at: string;
};

type FormData = {
  integration_type: string;
  label: string;
  username: string;
  password: string;
  api_key: string;
  environment: "test" | "live";
  status: "active" | "inactive";
  location_id: string;
};

const EMPTY_FORM: FormData = {
  integration_type: "",
  label: "",
  username: "",
  password: "",
  api_key: "",
  environment: "live",
  status: "active",
  location_id: "",
};

const INTEGRATION_TYPES = [
  "telnyx",
  "360dialog",
  "mollie",
  "signhost",
  "openai",
  "pinecone",
  "cloudinary",
  "mailgun",
  "google",
  "other",
];

/* ─── Page ───────────────────────────────────────────────── */

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Integration | null>(null);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/integrations");
      setIntegrations(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchIntegrations();
  }, [fetchIntegrations]);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setShowApiKey(false);
    setShowForm(true);
  };

  const openEdit = (item: Integration) => {
    setEditId(item.id);
    setForm({
      integration_type: item.integration_type,
      label: item.label || "",
      username: item.username || "",
      password: "",
      api_key: "",
      environment: item.environment,
      status: item.status,
      location_id: item.location_id ? String(item.location_id) : "",
    });
    setShowPassword(false);
    setShowApiKey(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.integration_type.trim()) {
      toast.error("Integration type is required");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        integration_type: form.integration_type,
        label: form.label || null,
        username: form.username || null,
        environment: form.environment,
        status: form.status,
        location_id: form.location_id ? Number(form.location_id) : null,
      };

      // Only send secrets when they have a value
      if (form.password) payload.password = form.password;
      if (form.api_key) payload.api_key = form.api_key;

      if (editId) {
        const { data } = await api.put(`/admin/integrations/${editId}`, payload);
        setIntegrations((prev) =>
          prev.map((i) => (i.id === editId ? data : i))
        );
        toast.success("Integration updated");
      } else {
        const { data } = await api.post("/admin/integrations", payload);
        setIntegrations((prev) => [data, ...prev]);
        toast.success("Integration created");
      }
      setShowForm(false);
    } catch {
      toast.error(editId ? "Failed to update" : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/integrations/${deleteTarget.id}`);
      setIntegrations((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      toast.success("Integration deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />

      {/* ── Header ──────────────────────────────── */}
      <div className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-serif italic text-[#003566] dark:text-slate-100 sm:text-4xl">
            Integrations
          </h1>
          <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-300">
            Central Credential Management
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-10 shrink-0 gap-2 rounded-lg bg-[#003566] px-5 text-xs font-bold tracking-wider text-white transition-colors hover:bg-[#002a52]"
        >
          <Plus size={15} />
          <span>Add Integration</span>
        </Button>
      </div>

      {/* ── Stats Cards ──────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total",
            value: integrations.length,
            icon: Server,
            active: false,
          },
          {
            label: "Active",
            value: integrations.filter((i) => i.status === "active").length,
            icon: CheckCircle2,
            active: false,
          },
          {
            label: "Live",
            value: integrations.filter((i) => i.environment === "live").length,
            icon: Shield,
            active: false,
          },
          {
            label: "Test",
            value: integrations.filter((i) => i.environment === "test").length,
            icon: Key,
            active: false,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <card.icon
                size={18}
                className="text-[#003566] dark:text-slate-200"
              />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none text-[#003566] dark:text-slate-100">
                {card.value}
              </p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {card.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ──────────────────────────────── */}
      <div className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="hidden grid-cols-[1fr_1fr_100px_100px_100px_80px] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 md:grid dark:border-slate-700 dark:bg-slate-800/70">
          {["Type / Label", "Credentials", "Env", "Status", "Location", "Actions"].map(
            (h) => (
              <p
                key={h}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-400"
              >
                {h}
              </p>
            )
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2
              className="animate-spin text-[#003566] dark:text-slate-200"
              size={32}
            />
            <p className="text-sm text-slate-400">Loading integrations…</p>
          </div>
        ) : integrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Key size={36} className="text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-500">
                No integrations yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                Add your first integration to start managing credentials
                centrally.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {integrations.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group"
              >
                {/* Desktop row */}
                <div className="hidden grid-cols-[1fr_1fr_100px_100px_100px_80px] items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50/80 md:grid dark:hover:bg-slate-800/40">
                  {/* Type/Label */}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#003566] dark:text-slate-100">
                      {item.integration_type}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {item.label || "No label"}
                    </p>
                  </div>

                  {/* Credentials */}
                  <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      User: {item.username || "—"}
                    </span>
                    <span>
                      Pass: {item.has_password ? "●●●●●●●●" : "—"}
                    </span>
                    <span>
                      Key: {item.has_api_key ? "●●●●●●●●" : "—"}
                    </span>
                  </div>

                  {/* Env */}
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      item.environment === "live"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    )}
                  >
                    {item.environment}
                  </span>

                  {/* Status */}
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      item.status === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    )}
                  >
                    {item.status === "active" ? (
                      <CheckCircle2 size={11} />
                    ) : (
                      <XCircle size={11} />
                    )}
                    {item.status}
                  </span>

                  {/* Location */}
                  <span className="text-[11px] text-slate-400">
                    {item.location_id ? `#${item.location_id}` : "Global"}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Mobile card */}
                <div className="flex flex-col gap-2 p-4 md:hidden">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#003566] dark:text-slate-100">
                      {item.integration_type}
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {item.label || "No label"} · {item.environment} ·{" "}
                    {item.status}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    User: {item.username || "—"} · Pass:{" "}
                    {item.has_password ? "●●●●" : "—"} · Key:{" "}
                    {item.has_api_key ? "●●●●" : "—"}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#003566] dark:text-slate-100">
                  {editId ? "Edit Integration" : "New Integration"}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Type */}
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Integration Type *
                    </label>
                    <select
                      value={form.integration_type}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          integration_type: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">Select type…</option>
                      {INTEGRATION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Label */}
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Label (optional)
                    </label>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, label: e.target.value }))
                      }
                      placeholder="e.g. Telnyx for Location A"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Username
                    </label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, username: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Password{" "}
                      {editId && (
                        <span className="normal-case tracking-normal text-slate-400">
                          (leave blank to keep current)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, password: e.target.value }))
                        }
                        placeholder={editId ? "●●●●●●●●" : ""}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      API Key{" "}
                      {editId && (
                        <span className="normal-case tracking-normal text-slate-400">
                          (leave blank to keep current)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={form.api_key}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, api_key: e.target.value }))
                        }
                        placeholder={editId ? "●●●●●●●●" : ""}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Location ID */}
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Location ID{" "}
                      <span className="normal-case tracking-normal text-slate-400">
                        (leave empty for global)
                      </span>
                    </label>
                    <input
                      type="number"
                      value={form.location_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, location_id: e.target.value }))
                      }
                      placeholder="Global"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  {/* Environment */}
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Environment
                    </label>
                    <select
                      value={form.environment}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          environment: e.target.value as "test" | "live",
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="live">Live</option>
                      <option value="test">Test</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          status: e.target.value as "active" | "inactive",
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="rounded-lg px-5 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="gap-2 rounded-lg bg-[#003566] px-5 text-xs font-bold text-white hover:bg-[#002a52]"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {editId ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation ──────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Delete Integration
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Are you sure you want to delete{" "}
                <strong>{deleteTarget.integration_type}</strong>
                {deleteTarget.label ? ` (${deleteTarget.label})` : ""}? This
                cannot be undone.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg px-5 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  className="rounded-lg bg-red-600 px-5 text-xs font-bold text-white hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
