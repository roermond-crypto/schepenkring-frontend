"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Loader2,
  MailCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Ship,
  Sparkles,
  TrendingDown,
  XCircle,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────

type OfferStatus =
  | "new"
  | "sent_to_seller"
  | "seller_accepted"
  | "seller_rejected"
  | "seller_countered"
  | "withdrawn"
  | "completed"
  | string;

type OfferRecord = {
  id: number;
  yacht_id: number;
  location_id: number | null;
  seller_id: number | null;
  buyer_id: number | null;
  lead_id: number | null;
  conversation_id: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  amount: number | null;
  asking_price: number | null;
  minimum_amount: number | null;
  status: OfferStatus;
  counter_amount: number | null;
  counter_message: string | null;
  message: string | null;
  below_minimum: boolean;
  seller_notified: boolean;
  seller_notified_at: string | null;
  seller_responded_at: string | null;
  source: string | null;
  created_at: string | null;
  yacht?: { id: number; boat_name?: string | null; manufacturer?: string | null; model?: string | null; main_image?: string | null } | null;
  location?: { id: number; name?: string | null } | null;
  seller?: { id: number; name?: string | null; email?: string | null } | null;
};

type LocationOption = { id: number; name: string };
type YachtOption   = { id: number; label: string };

type Filters = { search: string; status: string; location_id: string };

type FormState = {
  yacht_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  amount: string;
  message: string;
  status: string;
  source: string;
};

const EMPTY_FORM: FormState = {
  yacht_id: "",
  buyer_name: "",
  buyer_email: "",
  buyer_phone: "",
  amount: "",
  message: "",
  status: "new",
  source: "admin",
};

// ── Helpers ──────────────────────────────────────────────────

function fmtCurrency(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
}

function boatLabel(o: OfferRecord, fallback: string) {
  if (!o.yacht) return fallback;
  const name = [o.yacht.manufacturer, o.yacht.model].filter(Boolean).join(" ");
  return name || o.yacht.boat_name || fallback;
}

// Ring + dot styles only — labels come from translations
const STATUS_RING_DOT: Record<string, { ring: string; dot: string }> = {
  new:              { ring: "ring-slate-200",   dot: "bg-slate-400" },
  sent_to_seller:   { ring: "ring-blue-200",    dot: "bg-blue-500" },
  seller_accepted:  { ring: "ring-emerald-200", dot: "bg-emerald-500" },
  seller_rejected:  { ring: "ring-rose-200",    dot: "bg-rose-500" },
  seller_countered: { ring: "ring-amber-200",   dot: "bg-amber-500" },
  withdrawn:        { ring: "ring-slate-200",   dot: "bg-slate-400" },
  completed:        { ring: "ring-emerald-200", dot: "bg-emerald-600" },
};

function StatusBadge({ status }: { status: OfferStatus }) {
  const t = useTranslations("DashboardAdminOffers");
  const s = STATUS_RING_DOT[status] ?? { ring: "ring-slate-200", dot: "bg-slate-400" };
  const labels: Record<string, string> = {
    new: t("status.new"),
    sent_to_seller: t("status.sent_to_seller"),
    seller_accepted: t("status.seller_accepted"),
    seller_rejected: t("status.seller_rejected"),
    seller_countered: t("status.seller_countered"),
    withdrawn: t("status.withdrawn"),
    completed: t("status.completed"),
  };
  const label = labels[status] ?? status;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${s.ring} bg-white`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

// ── Create / Edit form dialog ─────────────────────────────────

function OfferFormDialog({
  open,
  editOffer,
  prefill,
  locations,
  onClose,
  onSaved,
}: {
  open: boolean;
  editOffer: OfferRecord | null;
  prefill?: Partial<FormState>;
  locations: LocationOption[];
  onClose: () => void;
  onSaved: (o: OfferRecord) => void;
}) {
  const t = useTranslations("DashboardAdminOffers");
  const isEdit = !!editOffer;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [yachtQuery, setYachtQuery] = useState("");
  const [yachtResults, setYachtResults] = useState<YachtOption[]>([]);
  const [yachtOpen, setYachtOpen] = useState(false);
  const [yachtLabel, setYachtLabel] = useState("");
  const yachtSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editOffer) {
      setForm({
        yacht_id: String(editOffer.yacht_id),
        buyer_name: editOffer.buyer_name ?? "",
        buyer_email: editOffer.buyer_email ?? "",
        buyer_phone: editOffer.buyer_phone ?? "",
        amount: editOffer.amount != null ? String(editOffer.amount) : "",
        message: editOffer.message ?? "",
        status: editOffer.status,
        source: editOffer.source ?? "admin",
      });
      setYachtLabel(boatLabel(editOffer, t("row.boatFallback", { id: editOffer.yacht_id })));
      setYachtQuery("");
    } else {
      setForm({ ...EMPTY_FORM, ...prefill });
      setYachtLabel("");
      setYachtQuery("");
    }
    setYachtResults([]);
    setYachtOpen(false);
  }, [open, editOffer, prefill, t]);

  useEffect(() => {
    if (!yachtQuery || yachtQuery.length < 2) { setYachtResults([]); setYachtOpen(false); return; }
    if (yachtSearchTimer.current) clearTimeout(yachtSearchTimer.current);
    yachtSearchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get("/admin/yachts", { params: { search: yachtQuery, per_page: 8 } });
        const items = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        setYachtResults(items.map((y: { id: number; boat_name?: string; manufacturer?: string; model?: string }) => ({
          id: y.id,
          label: [y.manufacturer, y.model, y.boat_name].filter(Boolean).join(" ") || t("row.boatFallback", { id: y.id }),
        })));
        setYachtOpen(true);
      } catch { /* ignore */ }
    }, 300);
  }, [yachtQuery, t]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.buyer_name.trim()) { toast.error(t("toast.validationBuyerName")); return; }
    if (!form.amount || isNaN(Number(form.amount))) { toast.error(t("toast.validationAmount")); return; }
    if (!isEdit && !form.yacht_id) { toast.error(t("toast.validationBoat")); return; }

    setSaving(true);
    try {
      let res;
      if (isEdit) {
        res = await api.patch(`/admin/offers/${editOffer!.id}`, {
          buyer_name: form.buyer_name,
          buyer_email: form.buyer_email || null,
          buyer_phone: form.buyer_phone || null,
          amount: Number(form.amount),
          message: form.message || null,
          status: form.status,
        });
        toast.success(t("toast.updated"));
      } else {
        res = await api.post("/admin/offers", {
          yacht_id: Number(form.yacht_id),
          buyer_name: form.buyer_name,
          buyer_email: form.buyer_email || null,
          buyer_phone: form.buyer_phone || null,
          amount: Number(form.amount),
          message: form.message || null,
          source: form.source || "admin",
        });
        toast.success(t("toast.created"));
      }
      const saved = (res.data as { offer: OfferRecord }).offer;
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t("toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl rounded-[2rem] border-slate-200 p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle className="text-xl font-semibold text-[#0B1F3A]">
            {isEdit ? t("form.titleEdit", { id: editOffer!.id }) : t("form.titleCreate")}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {isEdit ? t("form.descriptionEdit") : t("form.descriptionCreate")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
          {/* Yacht search — create only */}
          {!isEdit && (
            <div className="space-y-1 relative">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("form.boat")}</label>
              <Input
                value={yachtQuery || yachtLabel}
                onChange={(e) => { setYachtQuery(e.target.value); setYachtLabel(""); set("yacht_id", ""); }}
                placeholder={t("form.boatSearch")}
                className="h-11 rounded-2xl border-slate-200"
                autoComplete="off"
              />
              {yachtOpen && yachtResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {yachtResults.map((y) => (
                    <button
                      key={y.id}
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 text-[#0B1F3A]"
                      onClick={() => { set("yacht_id", String(y.id)); setYachtLabel(y.label); setYachtQuery(""); setYachtOpen(false); }}
                    >
                      {y.label}
                    </button>
                  ))}
                </div>
              )}
              {form.yacht_id && (
                <p className="text-xs text-emerald-600 font-medium">✓ {yachtLabel}</p>
              )}
            </div>
          )}

          {/* Buyer info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("form.buyerName")}</label>
              <Input value={form.buyer_name} onChange={(e) => set("buyer_name", e.target.value)} className="h-11 rounded-2xl border-slate-200" placeholder={t("form.buyerNamePlaceholder")} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("form.email")}</label>
              <Input type="email" value={form.buyer_email} onChange={(e) => set("buyer_email", e.target.value)} className="h-11 rounded-2xl border-slate-200" placeholder={t("form.emailPlaceholder")} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("form.phone")}</label>
              <Input value={form.buyer_phone} onChange={(e) => set("buyer_phone", e.target.value)} className="h-11 rounded-2xl border-slate-200" placeholder={t("form.phonePlaceholder")} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("form.amount")}</label>
              <Input type="number" min={1} value={form.amount} onChange={(e) => set("amount", e.target.value)} className="h-11 rounded-2xl border-slate-200" placeholder={t("form.amountPlaceholder")} required />
            </div>
          </div>

          {/* Status — edit only */}
          {isEdit && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("form.status")}</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
              >
                <option value="new">{t("statusOptions.new")}</option>
                <option value="sent_to_seller">{t("statusOptions.sent_to_seller")}</option>
                <option value="seller_accepted">{t("statusOptions.seller_accepted")}</option>
                <option value="seller_rejected">{t("statusOptions.seller_rejected")}</option>
                <option value="seller_countered">{t("statusOptions.seller_countered")}</option>
                <option value="withdrawn">{t("statusOptions.withdrawn")}</option>
                <option value="completed">{t("statusOptions.completed")}</option>
              </select>
            </div>
          )}

          {/* Source — create only */}
          {!isEdit && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("form.source")}</label>
              <select
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
              >
                <option value="admin">{t("sourceOptions.admin")}</option>
                <option value="phone">{t("sourceOptions.phone")}</option>
                <option value="email">{t("sourceOptions.email")}</option>
                <option value="widget">{t("sourceOptions.widget")}</option>
              </select>
            </div>
          )}

          {/* Message */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("form.message")}</label>
            <textarea
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#003566] resize-none"
              placeholder={t("form.messagePlaceholder")}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" className="h-10 rounded-2xl" onClick={onClose}>{t("form.cancel")}</Button>
            <Button type="submit" disabled={saving} className="h-10 rounded-2xl bg-[#003566] px-6 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-[#00284d]">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? t("form.save") : t("form.createSubmit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── AI Bid-Extract Modal ──────────────────────────────────────

type ExtractedBid = {
  boat_name?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  offer_amount?: number | null;
  message?: string | null;
};

function BidExtractModal({
  open,
  onClose,
  onExtracted,
}: {
  open: boolean;
  onClose: () => void;
  onExtracted: (prefill: Partial<FormState>, imageUrl?: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setText(""); setImageFile(null); setImagePreview(null); }
  }, [open]);

  const applyImageFile = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const imageItem = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) { e.preventDefault(); applyImageFile(file); }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) applyImageFile(file);
  };

  const handleExtract = async () => {
    if (!text.trim() && !imageFile) return;
    setExtracting(true);
    try {
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (imageFile) fd.append("image", imageFile);
      const res = await api.post("/admin/bids/extract", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const ex = (res.data as { extracted: ExtractedBid; stored_image?: string | null }).extracted;
      const storedImage = (res.data as { stored_image?: string | null }).stored_image;
      const prefill: Partial<FormState> = {
        buyer_name:  ex.buyer_name  ?? "",
        buyer_email: ex.buyer_email ?? "",
        buyer_phone: ex.buyer_phone ?? "",
        amount:      ex.offer_amount != null ? String(ex.offer_amount) : "",
        message:     ex.message     ?? "",
      };
      onExtracted(prefill, storedImage);
      onClose();
    } catch {
      toast.error("AI extractie mislukt. Controleer de configuratie.");
    } finally {
      setExtracting(false);
    }
  };

  const canExtract = !extracting && (text.trim().length > 0 || !!imageFile);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl rounded-[2rem] border-slate-200 p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle className="text-xl font-semibold text-[#0B1F3A]">
            Bieding extraheren uit tekst / afbeelding
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Plak een e-mail, WhatsApp-bericht of screenshot — de AI vult het formulier automatisch in.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
          {/* Text area */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Tekst (e-mail / bericht)
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              rows={6}
              placeholder="Plak hier de tekst of e-mail van de koper..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#003566] resize-none"
            />
          </div>

          {/* Image drop zone */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Screenshot (optioneel)
            </label>
            <div
              tabIndex={0}
              role="button"
              aria-label="Afbeelding uploaden"
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
              className="flex min-h-[96px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-400 transition-colors hover:border-[#003566]/40 hover:bg-slate-100"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Voorvertoning" className="max-h-40 max-w-full rounded-xl object-contain" />
              ) : (
                <span>Klik, sleep of plak (Ctrl+V) een afbeelding</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) applyImageFile(f); }}
            />
            {imageFile && (
              <p className="text-xs font-medium text-emerald-600">✓ {imageFile.name}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" className="h-10 rounded-2xl" onClick={onClose}>
              Annuleren
            </Button>
            <Button
              type="button"
              disabled={!canExtract}
              onClick={() => void handleExtract()}
              className="h-10 rounded-2xl bg-[#003566] px-6 text-[10px] font-black uppercase tracking-[0.22em] text-white hover:bg-[#00284d] disabled:opacity-50"
            >
              {extracting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extraheren…</>
                : <><Sparkles className="mr-2 h-4 w-4" />Extraheren</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function AdminOffersPage() {
  const t = useTranslations("DashboardAdminOffers");
  const params = useParams<{ locale?: string; role?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = params?.locale ?? "nl";
  const role = params?.role ?? "admin";
  const initialLocationId = searchParams.get("location") ?? "";

  const [filters, setFilters] = useState<Filters>({ search: "", status: "", location_id: initialLocationId });
  const [applied, setApplied] = useState<Filters>({ search: "", status: "", location_id: initialLocationId });
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  const [selected, setSelected] = useState<OfferRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editOffer, setEditOffer] = useState<OfferRecord | null>(null);
  const [formPrefill, setFormPrefill] = useState<Partial<FormState>>({});
  const [extractOpen, setExtractOpen] = useState(false);

  const initialized = useRef(false);

  const isLocation = role === "location" || role === "partner";

  // Status label map for use outside StatusBadge (e.g. timeline)
  const statusLabels: Record<string, string> = {
    new: t("status.new"),
    sent_to_seller: t("status.sent_to_seller"),
    seller_accepted: t("status.seller_accepted"),
    seller_rejected: t("status.seller_rejected"),
    seller_countered: t("status.seller_countered"),
    withdrawn: t("status.withdrawn"),
    completed: t("status.completed"),
  };

  useEffect(() => {
    if (role !== "admin" && !isLocation) router.replace(`/${locale}/dashboard/${role}`);
  }, [locale, role, isLocation, router]);

  useEffect(() => {
    api.get("/admin/locations").then((res) => {
      const items = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setLocations(items.map((l: { id: number; name?: string; meta?: { name?: string } }) => ({
        id: l.id,
        name: l.meta?.name ?? l.name ?? t("row.location", { id: l.id }),
      })));
    }).catch(() => {/* ignore */});
  }, [t]);

  const loadOffers = useCallback(async (showRefresh = false, targetPage = page) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get("/admin/offers", {
        params: {
          search: applied.search || undefined,
          status: applied.status || undefined,
          location_id: applied.location_id || undefined,
          page: targetPage,
          per_page: 30,
        },
      });
      const d = res.data as { data: OfferRecord[]; total: number; page: number; last_page: number };
      setOffers(Array.isArray(d.data) ? d.data : []);
      setTotal(d.total ?? 0);
      setLastPage(d.last_page ?? 1);
    } catch {
      setError(t("toast.loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applied, page, t]);

  useEffect(() => {
    if (role !== "admin" && !isLocation) return;
    if (initialized.current) return;
    initialized.current = true;
    void loadOffers();
  }, [loadOffers, role, isLocation]);

  useEffect(() => {
    if (!initialized.current) return;
    if (role !== "admin" && !isLocation) return;
    void loadOffers(false, 1);
    setPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  const openDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await api.get(`/admin/offers/${id}`);
      const d = res.data as { offer: OfferRecord };
      setSelected(d.offer ?? null);
    } catch {
      toast.error(t("toast.detailFailed"));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const notifySeller = useCallback(async (offerId: number) => {
    setNotifying(true);
    try {
      await api.post(`/admin/offers/${offerId}/notify-seller`);
      toast.success(t("toast.emailSent"));
      void loadOffers(true);
      if (selected?.id === offerId) {
        setSelected((prev) => prev ? { ...prev, status: "sent_to_seller", seller_notified: true } : prev);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t("toast.emailFailed"));
    } finally {
      setNotifying(false);
    }
  }, [loadOffers, selected?.id, t]);

  const openCreate = () => { setFormPrefill({}); setEditOffer(null); setFormOpen(true); };
  const openEdit   = (o: OfferRecord) => { setEditOffer(o); setDetailOpen(false); setFormOpen(true); };

  const handleExtracted = (prefill: Partial<FormState>, _imageUrl?: string | null) => {
    setFormPrefill(prefill);
    setEditOffer(null);
    setFormOpen(true);
  };

  const handleSaved = (saved: OfferRecord) => {
    setOffers((prev) => {
      const idx = prev.findIndex((o) => o.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setTotal((tt) => tt + (offers.find((o) => o.id === saved.id) ? 0 : 1));
  };

  const stats = useMemo(() => ({
    total,
    new_count:      offers.filter((o) => o.status === "new").length,
    accepted:       offers.filter((o) => o.status === "seller_accepted").length,
    countered:      offers.filter((o) => o.status === "seller_countered").length,
    below_minimum:  offers.filter((o) => o.below_minimum).length,
  }), [offers, total]);

  return (
    <div className="space-y-8">
      <Toaster position="top-right" />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-[#F7FAFF] to-[#EAF3FF] px-6 py-8 shadow-[0_22px_60px_rgba(15,23,42,0.08)] sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.38em] text-[#C8102E]">{t("hero.tag")}</p>
            <h1 className="mt-3 text-4xl font-serif italic text-[#003566] sm:text-5xl">{t("hero.title")}</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-500">{t("hero.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => void loadOffers(true)}
              disabled={refreshing}
              variant="outline"
              className="h-12 rounded-2xl border-slate-200 px-5 text-[10px] font-black uppercase tracking-[0.26em]"
            >
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {t("hero.refresh")}
            </Button>
            <Button
              type="button"
              onClick={() => setExtractOpen(true)}
              variant="outline"
              className="h-12 rounded-2xl border-[#003566]/40 px-5 text-[10px] font-black uppercase tracking-[0.26em] text-[#003566] hover:bg-[#003566]/5"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              AI extraheren
            </Button>
            <Button
              type="button"
              onClick={openCreate}
              className="h-12 rounded-2xl bg-[#003566] px-6 text-[10px] font-black uppercase tracking-[0.26em] text-white hover:bg-[#00284d]"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("hero.newOffer")}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: t("stats.total"),    value: stats.total,         icon: Handshake,  color: "text-[#003566]" },
            { label: t("stats.new"),      value: stats.new_count,     icon: Search,     color: "text-slate-600" },
            { label: t("stats.accepted"), value: stats.accepted,      icon: CheckCircle2, color: "text-emerald-700" },
            { label: t("stats.counter"),  value: stats.countered,     icon: RefreshCw,  color: "text-amber-700" },
            { label: t("stats.belowMin"), value: stats.below_minimum, icon: TrendingDown, color: "text-rose-700" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-3xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
              </div>
              <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Filters ──────────────────────────────────────────── */}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_200px_200px_auto_auto]">
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{t("filters.search")}</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder={t("filters.searchPlaceholder")}
                className="h-11 rounded-2xl border-slate-200 pl-9 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { setApplied(filters); } }}
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{t("filters.status")}</span>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
            >
              <option value="">{t("filters.allStatuses")}</option>
              <option value="new">{t("status.new")}</option>
              <option value="sent_to_seller">{t("status.sent_to_seller")}</option>
              <option value="seller_accepted">{t("status.seller_accepted")}</option>
              <option value="seller_rejected">{t("status.seller_rejected")}</option>
              <option value="seller_countered">{t("status.seller_countered")}</option>
              <option value="withdrawn">{t("status.withdrawn")}</option>
              <option value="completed">{t("status.completed")}</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{t("filters.location")}</span>
            <select
              value={filters.location_id}
              onChange={(e) => setFilters((f) => ({ ...f, location_id: e.target.value }))}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
            >
              <option value="">{t("filters.allLocations")}</option>
              {locations.map((l) => (
                <option key={l.id} value={String(l.id)}>{l.name}</option>
              ))}
            </select>
          </label>

          <Button
            type="button"
            variant="outline"
            className="mt-auto h-11 rounded-2xl border-slate-200"
            onClick={() => { setFilters({ search: "", status: "", location_id: "" }); setApplied({ search: "", status: "", location_id: "" }); }}
          >
            {t("filters.reset")}
          </Button>
          <Button
            type="button"
            className="mt-auto h-11 rounded-2xl bg-[#003566] px-5 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-[#00284d]"
            onClick={() => setApplied(filters)}
            disabled={refreshing}
          >
            <Search className="mr-2 h-4 w-4" />
            {t("filters.searchBtn")}
          </Button>
        </div>

        {/* ── Table ──────────────────────────────────────────── */}
        <div className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_140px_140px_110px_120px] gap-4 border-b border-[#E5EEFB] bg-[#F8FBFF] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#7C94B8] lg:grid">
            <span>{t("table.id")}</span>
            <span>{t("table.buyer")}</span>
            <span>{t("table.boat")}</span>
            <span>{t("table.amount")}</span>
            <span>{t("table.status")}</span>
            <span>{t("table.date")}</span>
            <span>{t("table.actions")}</span>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-[#003566]" />
              <span>{t("loading")}</span>
            </div>
          ) : error ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 px-6 text-center">
              <AlertCircle className="h-10 w-10 text-rose-400" />
              <p className="text-sm text-slate-500">{error}</p>
              <Button type="button" className="rounded-2xl bg-[#003566] hover:bg-[#00284d]" onClick={() => void loadOffers(true)}>
                {t("retry")}
              </Button>
            </div>
          ) : offers.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
              <Handshake className="h-10 w-10 text-slate-300" />
              <h2 className="text-lg font-semibold text-[#0B1F3A]">{t("empty.title")}</h2>
              <p className="max-w-md text-sm text-slate-500">{t("empty.body")}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5EEFB]">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="grid items-center gap-4 px-5 py-4 text-sm text-slate-600 lg:grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_140px_140px_110px_120px]"
                >
                  <span className="font-mono text-xs text-slate-400">#{offer.id}</span>

                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#0B1F3A]">{offer.buyer_name || "—"}</p>
                    <p className="text-xs text-slate-400">{offer.buyer_email || "—"}</p>
                    <p className="text-xs text-slate-400">{offer.buyer_phone || ""}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Ship className="h-4 w-4 shrink-0 text-slate-300" />
                    <div>
                      <p className="font-semibold text-[#0B1F3A]">{boatLabel(offer, t("row.boatFallback", { id: offer.yacht_id }))}</p>
                      <p className="text-xs text-slate-400">{offer.location?.name ?? t("row.location", { id: offer.location_id ?? "—" })}</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-bold text-[#003566]">{fmtCurrency(offer.amount)}</p>
                    {offer.asking_price ? <p className="text-xs text-slate-400">{t("row.askingPrice")} {fmtCurrency(offer.asking_price)}</p> : null}
                    {offer.below_minimum ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                        <TrendingDown className="h-3 w-3" /> {t("row.belowMin")}
                      </span>
                    ) : null}
                  </div>

                  <StatusBadge status={offer.status} />

                  <span className="text-xs text-slate-400">{fmtDate(offer.created_at)}</span>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-2xl border-slate-200 text-xs px-3"
                      onClick={() => void openDetail(offer.id)}
                    >
                      {t("row.view")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-9 rounded-2xl border-slate-200 p-0 flex items-center justify-center"
                      title={t("row.edit")}
                      onClick={() => openEdit(offer)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pagination ───────────────────────────────────────── */}
        {lastPage > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-9 rounded-full p-0"
              disabled={page <= 1}
              onClick={() => { const p = page - 1; setPage(p); void loadOffers(false, p); }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-500">{t("pagination", { page, lastPage })}</span>
            <Button
              type="button"
              variant="outline"
              className="h-9 w-9 rounded-full p-0"
              disabled={page >= lastPage}
              onClick={() => { const p = page + 1; setPage(p); void loadOffers(false, p); }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>

      {/* ── Detail dialog ─────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl rounded-[2rem] border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="text-xl font-semibold text-[#0B1F3A]">
              {selected ? t("detail.titleWithId", { id: selected.id }) : t("detail.title")}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {t("detail.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            {detailLoading || !selected ? (
              <div className="flex min-h-[220px] items-center justify-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#003566]" />
                <span>{t("detail.loading")}</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status row */}
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <StatusBadge status={selected.status} />
                  {selected.below_minimum && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-rose-600">
                      <TrendingDown className="h-3.5 w-3.5" /> {t("detail.belowMin")}
                    </span>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Buyer */}
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{t("detail.buyer")}</h3>
                    <dl className="space-y-1.5 text-sm">
                      <dt className="font-semibold text-slate-600">{t("detail.name")}</dt>
                      <dd className="text-[#0B1F3A]">{selected.buyer_name || "—"}</dd>
                      <dt className="font-semibold text-slate-600">{t("detail.email")}</dt>
                      <dd className="text-[#0B1F3A]">{selected.buyer_email || "—"}</dd>
                      <dt className="font-semibold text-slate-600">{t("detail.phone")}</dt>
                      <dd className="text-[#0B1F3A]">{selected.buyer_phone || "—"}</dd>
                    </dl>
                  </div>

                  {/* Offer amounts */}
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{t("detail.amounts")}</h3>
                    <dl className="space-y-1.5 text-sm">
                      <dt className="font-semibold text-slate-600">{t("detail.offer")}</dt>
                      <dd className="text-xl font-bold text-[#003566]">{fmtCurrency(selected.amount)}</dd>
                      <dt className="font-semibold text-slate-600">{t("detail.askingPrice")}</dt>
                      <dd className="text-[#0B1F3A]">{fmtCurrency(selected.asking_price)}</dd>
                      {selected.minimum_amount ? (
                        <>
                          <dt className="font-semibold text-slate-600">{t("detail.minBid")}</dt>
                          <dd className="text-[#0B1F3A]">{fmtCurrency(selected.minimum_amount)}</dd>
                        </>
                      ) : null}
                    </dl>
                  </div>

                  {/* Counter offer (if any) */}
                  {selected.counter_amount ? (
                    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">{t("detail.counterOffer")}</h3>
                      <p className="text-xl font-bold text-amber-700">{fmtCurrency(selected.counter_amount)}</p>
                      {selected.counter_message && <p className="text-sm text-amber-800">{selected.counter_message}</p>}
                    </div>
                  ) : null}

                  {/* Boat & Location */}
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{t("detail.boatLocation")}</h3>
                    <dl className="space-y-1.5 text-sm">
                      <dt className="font-semibold text-slate-600">{t("detail.boat")}</dt>
                      <dd className="text-[#0B1F3A]">{boatLabel(selected, t("row.boatFallback", { id: selected.yacht_id }))}</dd>
                      <dt className="font-semibold text-slate-600">{t("detail.location")}</dt>
                      <dd className="text-[#0B1F3A]">{selected.location?.name ?? `#${selected.location_id ?? "—"}`}</dd>
                    </dl>
                  </div>
                </div>

                {/* Buyer message */}
                {selected.message ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{t("detail.buyerMessage")}</h3>
                    <p className="text-sm leading-6 text-[#0B1F3A]">{selected.message}</p>
                  </div>
                ) : null}

                {/* Seller notification */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{t("detail.seller")}</h3>
                  {selected.seller ? (
                    <p className="mb-3 text-sm text-[#0B1F3A]">
                      {selected.seller.name} — <a href={`mailto:${selected.seller.email}`} className="text-[#003566] underline">{selected.seller.email}</a>
                    </p>
                  ) : (
                    <p className="mb-3 text-sm text-slate-400">{t("detail.noSeller")}</p>
                  )}

                  {selected.seller_notified ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <MailCheck className="h-4 w-4" />
                      <span>{t("detail.notifiedOn", { date: fmtDate(selected.seller_notified_at) })}</span>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="h-10 rounded-2xl bg-[#003566] px-5 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-[#00284d]"
                      disabled={notifying || !selected.seller}
                      onClick={() => void notifySeller(selected.id)}
                    >
                      {notifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
                      {t("detail.notifySeller")}
                    </Button>
                  )}
                </div>

                {/* Timeline mini */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{t("detail.timeline")}</h3>
                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{t("detail.received", { date: fmtDate(selected.created_at) })}</span>
                    </div>
                    {selected.seller_notified_at && (
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span>{t("detail.sentToSeller", { date: fmtDate(selected.seller_notified_at) })}</span>
                      </div>
                    )}
                    {selected.seller_responded_at && (
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${selected.status === "seller_accepted" ? "bg-emerald-500" : selected.status === "seller_rejected" ? "bg-rose-500" : "bg-amber-500"}`} />
                        <span>
                          {t("detail.sellerResponded", {
                            status: statusLabels[selected.status] ?? selected.status,
                            date: fmtDate(selected.seller_responded_at),
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-2xl border-slate-200 gap-2"
                    onClick={() => openEdit(selected)}
                  >
                    <Pencil className="h-4 w-4" />
                    {t("detail.editBtn")}
                  </Button>

                  <div className="flex items-center gap-3">
                    {selected.conversation_id && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-2xl border-slate-200"
                        onClick={() => { setDetailOpen(false); router.push(`/${locale}/dashboard/${role}/chat?conversation=${selected.conversation_id}`); }}
                      >
                        {t("detail.viewChat")}
                      </Button>
                    )}
                    {selected.status === "new" && selected.seller && !selected.seller_notified && (
                      <Button
                        type="button"
                        className="h-10 rounded-2xl bg-[#003566] px-5 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-[#00284d]"
                        disabled={notifying}
                        onClick={() => void notifySeller(selected.id)}
                      >
                        {notifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
                        {t("detail.emailSeller")}
                      </Button>
                    )}
                    {(selected.status === "seller_accepted" || selected.status === "completed") && (
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        {t("detail.statusAccepted")}
                      </div>
                    )}
                    {selected.status === "seller_rejected" && (
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
                        <XCircle className="h-4 w-4" />
                        {t("detail.statusRejected")}
                      </div>
                    )}
                    {selected.status === "withdrawn" && (
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                        <Ban className="h-4 w-4" />
                        {t("detail.statusWithdrawn")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit form dialog ─────────────────────────── */}
      <OfferFormDialog
        open={formOpen}
        editOffer={editOffer}
        prefill={formPrefill}
        locations={locations}
        onClose={() => { setFormOpen(false); setEditOffer(null); setFormPrefill({}); }}
        onSaved={handleSaved}
      />

      {/* ── AI Bid Extract modal ───────────────────────────────── */}
      <BidExtractModal
        open={extractOpen}
        onClose={() => setExtractOpen(false)}
        onExtracted={handleExtracted}
      />
    </div>
  );
}
