"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  RefreshCw,
  Search,
  Ship,
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

type Filters = { search: string; status: string; location_id: string };

// ── Helpers ──────────────────────────────────────────────────

function fmtCurrency(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
}

function boatLabel(o: OfferRecord) {
  if (!o.yacht) return `Boot #${o.yacht_id}`;
  const name = [o.yacht.manufacturer, o.yacht.model].filter(Boolean).join(" ");
  return name || o.yacht.boat_name || `Boot #${o.yacht_id}`;
}

type StatusStyle = { label: string; ring: string; dot: string };
const STATUS_STYLES: Record<string, StatusStyle> = {
  new:              { label: "Nieuw",            ring: "ring-slate-200",   dot: "bg-slate-400" },
  sent_to_seller:   { label: "Verstuurd",        ring: "ring-blue-200",    dot: "bg-blue-500" },
  seller_accepted:  { label: "Geaccepteerd",     ring: "ring-emerald-200", dot: "bg-emerald-500" },
  seller_rejected:  { label: "Afgewezen",        ring: "ring-rose-200",    dot: "bg-rose-500" },
  seller_countered: { label: "Tegenbod",         ring: "ring-amber-200",   dot: "bg-amber-500" },
  withdrawn:        { label: "Ingetrokken",      ring: "ring-slate-200",   dot: "bg-slate-400" },
  completed:        { label: "Afgerond",         ring: "ring-emerald-200", dot: "bg-emerald-600" },
};

function StatusBadge({ status }: { status: OfferStatus }) {
  const s = STATUS_STYLES[status] ?? { label: status, ring: "ring-slate-200", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${s.ring} bg-white`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function AdminOffersPage() {
  const params = useParams<{ locale?: string; role?: string }>();
  const router = useRouter();
  const locale = params?.locale ?? "nl";
  const role = params?.role ?? "admin";

  const [filters, setFilters] = useState<Filters>({ search: "", status: "", location_id: "" });
  const [applied, setApplied] = useState<Filters>({ search: "", status: "", location_id: "" });
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OfferRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (role !== "admin") router.replace(`/${locale}/dashboard/${role}`);
  }, [locale, role, router]);

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
      setError("Boden laden mislukt. Probeer opnieuw.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applied, page]);

  useEffect(() => {
    if (role !== "admin") return;
    if (initialized.current) return;
    initialized.current = true;
    void loadOffers();
  }, [loadOffers, role]);

  useEffect(() => {
    if (!initialized.current) return;
    if (role !== "admin") return;
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
      toast.error("Detail laden mislukt.");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const notifySeller = useCallback(async (offerId: number) => {
    setNotifying(true);
    try {
      await api.post(`/admin/offers/${offerId}/notify-seller`);
      toast.success("E-mail verstuurd naar verkoper.");
      void loadOffers(true);
      if (selected?.id === offerId) {
        setSelected((prev) => prev ? { ...prev, status: "sent_to_seller", seller_notified: true } : prev);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Verzenden mislukt.");
    } finally {
      setNotifying(false);
    }
  }, [loadOffers, selected?.id]);

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
            <p className="text-[10px] font-black uppercase tracking-[0.38em] text-[#C8102E]">Bieden &amp; aanbiedingen</p>
            <h1 className="mt-3 text-4xl font-serif italic text-[#003566] sm:text-5xl">Bod-overzicht</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-500">
              Beheer alle ontvangen boden — bekijk status, notificeer verkopers en volg het tegenbodproces.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void loadOffers(true)}
            disabled={refreshing}
            className="h-12 rounded-2xl bg-[#003566] px-6 text-[10px] font-black uppercase tracking-[0.26em] text-white hover:bg-[#00284d]"
          >
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Verversen
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Totaal", value: stats.total, icon: Handshake, color: "text-[#003566]" },
            { label: "Nieuw", value: stats.new_count, icon: Search, color: "text-slate-600" },
            { label: "Geaccepteerd", value: stats.accepted, icon: CheckCircle2, color: "text-emerald-700" },
            { label: "Tegenbod", value: stats.countered, icon: RefreshCw, color: "text-amber-700" },
            { label: "Onder minimum", value: stats.below_minimum, icon: TrendingDown, color: "text-rose-700" },
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
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Zoeken</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Naam, e-mail, telefoon…"
                className="h-11 rounded-2xl border-slate-200 pl-9 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { setApplied(filters); } }}
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Status</span>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#003566]"
            >
              <option value="">Alle statussen</option>
              <option value="new">Nieuw</option>
              <option value="sent_to_seller">Verstuurd</option>
              <option value="seller_accepted">Geaccepteerd</option>
              <option value="seller_rejected">Afgewezen</option>
              <option value="seller_countered">Tegenbod</option>
              <option value="withdrawn">Ingetrokken</option>
              <option value="completed">Afgerond</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Locatie ID</span>
            <Input
              value={filters.location_id}
              onChange={(e) => setFilters((f) => ({ ...f, location_id: e.target.value }))}
              placeholder="bv. 3"
              inputMode="numeric"
              className="h-11 rounded-2xl border-slate-200 text-sm"
            />
          </label>

          <Button
            type="button"
            variant="outline"
            className="mt-auto h-11 rounded-2xl border-slate-200"
            onClick={() => { setFilters({ search: "", status: "", location_id: "" }); setApplied({ search: "", status: "", location_id: "" }); }}
          >
            Reset
          </Button>
          <Button
            type="button"
            className="mt-auto h-11 rounded-2xl bg-[#003566] px-5 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-[#00284d]"
            onClick={() => setApplied(filters)}
            disabled={refreshing}
          >
            <Search className="mr-2 h-4 w-4" />
            Zoeken
          </Button>
        </div>

        {/* ── Table ──────────────────────────────────────────── */}
        <div className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_140px_140px_110px_100px] gap-4 border-b border-[#E5EEFB] bg-[#F8FBFF] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#7C94B8] lg:grid">
            <span>#</span>
            <span>Koper</span>
            <span>Boot</span>
            <span>Bedrag</span>
            <span>Status</span>
            <span>Datum</span>
            <span>Actie</span>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-[#003566]" />
              <span>Boden laden…</span>
            </div>
          ) : error ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 px-6 text-center">
              <AlertCircle className="h-10 w-10 text-rose-400" />
              <p className="text-sm text-slate-500">{error}</p>
              <Button type="button" className="rounded-2xl bg-[#003566] hover:bg-[#00284d]" onClick={() => void loadOffers(true)}>
                Opnieuw proberen
              </Button>
            </div>
          ) : offers.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
              <Handshake className="h-10 w-10 text-slate-300" />
              <h2 className="text-lg font-semibold text-[#0B1F3A]">Geen boden gevonden</h2>
              <p className="max-w-md text-sm text-slate-500">
                Er zijn nog geen boden ontvangen of ze voldoen niet aan de filters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5EEFB]">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="grid items-center gap-4 px-5 py-4 text-sm text-slate-600 lg:grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_140px_140px_110px_100px]"
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
                      <p className="font-semibold text-[#0B1F3A]">{boatLabel(offer)}</p>
                      <p className="text-xs text-slate-400">{offer.location?.name ?? `Locatie ${offer.location_id ?? "—"}`}</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-bold text-[#003566]">{fmtCurrency(offer.amount)}</p>
                    {offer.asking_price ? <p className="text-xs text-slate-400">Vraagprijs {fmtCurrency(offer.asking_price)}</p> : null}
                    {offer.below_minimum ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                        <TrendingDown className="h-3 w-3" /> onder min.
                      </span>
                    ) : null}
                  </div>

                  <StatusBadge status={offer.status} />

                  <span className="text-xs text-slate-400">{fmtDate(offer.created_at)}</span>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-2xl border-slate-200 text-xs"
                    onClick={() => void openDetail(offer.id)}
                  >
                    Bekijken
                  </Button>
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
            <span className="text-sm text-slate-500">Pagina {page} van {lastPage}</span>
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
              {selected ? `Bod #${selected.id}` : "Bod detail"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Volledige informatie over dit bod en de status.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            {detailLoading || !selected ? (
              <div className="flex min-h-[220px] items-center justify-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#003566]" />
                <span>Laden…</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status row */}
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <StatusBadge status={selected.status} />
                  {selected.below_minimum && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-rose-600">
                      <TrendingDown className="h-3.5 w-3.5" /> Onder minimumbod
                    </span>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Buyer */}
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Koper</h3>
                    <dl className="space-y-1.5 text-sm">
                      <dt className="font-semibold text-slate-600">Naam</dt>
                      <dd className="text-[#0B1F3A]">{selected.buyer_name || "—"}</dd>
                      <dt className="font-semibold text-slate-600">E-mail</dt>
                      <dd className="text-[#0B1F3A]">{selected.buyer_email || "—"}</dd>
                      <dt className="font-semibold text-slate-600">Telefoon</dt>
                      <dd className="text-[#0B1F3A]">{selected.buyer_phone || "—"}</dd>
                    </dl>
                  </div>

                  {/* Offer amounts */}
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Bedragen</h3>
                    <dl className="space-y-1.5 text-sm">
                      <dt className="font-semibold text-slate-600">Bod</dt>
                      <dd className="text-xl font-bold text-[#003566]">{fmtCurrency(selected.amount)}</dd>
                      <dt className="font-semibold text-slate-600">Vraagprijs</dt>
                      <dd className="text-[#0B1F3A]">{fmtCurrency(selected.asking_price)}</dd>
                      {selected.minimum_amount ? (
                        <>
                          <dt className="font-semibold text-slate-600">Minimumbod</dt>
                          <dd className="text-[#0B1F3A]">{fmtCurrency(selected.minimum_amount)}</dd>
                        </>
                      ) : null}
                    </dl>
                  </div>

                  {/* Counter offer (if any) */}
                  {selected.counter_amount ? (
                    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">Tegenbod</h3>
                      <p className="text-xl font-bold text-amber-700">{fmtCurrency(selected.counter_amount)}</p>
                      {selected.counter_message && <p className="text-sm text-amber-800">{selected.counter_message}</p>}
                    </div>
                  ) : null}

                  {/* Boat & Location */}
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Boot &amp; locatie</h3>
                    <dl className="space-y-1.5 text-sm">
                      <dt className="font-semibold text-slate-600">Boot</dt>
                      <dd className="text-[#0B1F3A]">{boatLabel(selected)}</dd>
                      <dt className="font-semibold text-slate-600">Locatie</dt>
                      <dd className="text-[#0B1F3A]">{selected.location?.name ?? `#${selected.location_id ?? "—"}`}</dd>
                    </dl>
                  </div>
                </div>

                {/* Buyer message */}
                {selected.message ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Bericht koper</h3>
                    <p className="text-sm leading-6 text-[#0B1F3A]">{selected.message}</p>
                  </div>
                ) : null}

                {/* Seller notification */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Verkoper</h3>
                  {selected.seller ? (
                    <p className="mb-3 text-sm text-[#0B1F3A]">
                      {selected.seller.name} — <a href={`mailto:${selected.seller.email}`} className="text-[#003566] underline">{selected.seller.email}</a>
                    </p>
                  ) : (
                    <p className="mb-3 text-sm text-slate-400">Geen verkoper gekoppeld</p>
                  )}

                  {selected.seller_notified ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <MailCheck className="h-4 w-4" />
                      <span>Verstuurd op {fmtDate(selected.seller_notified_at)}</span>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="h-10 rounded-2xl bg-[#003566] px-5 text-[10px] font-black uppercase tracking-[0.22em] hover:bg-[#00284d]"
                      disabled={notifying || !selected.seller}
                      onClick={() => void notifySeller(selected.id)}
                    >
                      {notifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
                      Verkoper notificeren
                    </Button>
                  )}
                </div>

                {/* Timeline mini */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tijdlijn</h3>
                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>Bod ontvangen — {fmtDate(selected.created_at)}</span>
                    </div>
                    {selected.seller_notified_at && (
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span>Verstuurd naar verkoper — {fmtDate(selected.seller_notified_at)}</span>
                      </div>
                    )}
                    {selected.seller_responded_at && (
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${selected.status === "seller_accepted" ? "bg-emerald-500" : selected.status === "seller_rejected" ? "bg-rose-500" : "bg-amber-500"}`} />
                        <span>
                          Verkoper gereageerd ({STATUS_STYLES[selected.status]?.label ?? selected.status}) — {fmtDate(selected.seller_responded_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                  {selected.conversation_id && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-2xl border-slate-200"
                      onClick={() => { setDetailOpen(false); router.push(`/${locale}/dashboard/${role}/chat?conversation=${selected.conversation_id}`); }}
                    >
                      Chat bekijken
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
                      Verkoper mailen
                    </Button>
                  )}
                  {(selected.status === "seller_accepted" || selected.status === "completed") && (
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Geaccepteerd
                    </div>
                  )}
                  {selected.status === "seller_rejected" && (
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
                      <XCircle className="h-4 w-4" />
                      Afgewezen
                    </div>
                  )}
                  {selected.status === "withdrawn" && (
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                      <Ban className="h-4 w-4" />
                      Ingetrokken
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
