"use client";

import { useState, useEffect, SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLocale } from "next-intl";
import { getDictionary } from "@/lib/i18n";
import {
  Plus,
  Loader2,
  Edit3,
  Trash,
  Calendar,
  MapPin,
  Maximize2,
  Search,
  Ship,
  Euro,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Filter,
  BarChart3,
  RefreshCw,
  Eye,
  Settings,
  MoreHorizontal,
  Grid3x3,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";

const STORAGE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || "https://schepen-kring.nl/storage/";
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=600&q=80";

// Status badge configuration
const statusConfig: Record<string, { color: string; bg: string; border: string }> = {
  "For Sale": {
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  "For Bid": {
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  Sold: {
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  Draft: {
    color: "text-slate-500",
    bg: "bg-slate-100",
    border: "border-slate-200",
  },
  Active: {
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  Inactive: {
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-100",
  },
  Maintenance: {
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-100",
  },
};

export default function FleetManagementPage() {
  const router = useRouter();
  const locale = useLocale();
  const dict = getDictionary(locale) as any;
  const t = dict.DashboardYachts || {} as any;
  const [fleet, setFleet] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("boat_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [stats, setStats] = useState({
    total: 0,
    forSale: 0,
    forBid: 0,
    sold: 0,
    draft: 0,
    active: 0,
    inactive: 0,
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const statusOptions = [
    { value: "all", label: t?.status?.all || "All" },
    { value: "For Sale", label: t?.status?.forSale || "For Sale" },
    { value: "For Bid", label: t?.status?.forBid || "For Bid" },
    { value: "Sold", label: t?.status?.sold || "Sold" },
    { value: "Draft", label: t?.status?.draft || "Draft" },
    { value: "Active", label: t?.status?.active || "Active" },
    { value: "Inactive", label: t?.status?.inactive || "Inactive" },
    { value: "Maintenance", label: t?.status?.maintenance || "Maintenance" },
  ];
  const sortOptions = [
    { value: "boat_name-asc", label: t?.sort?.nameAsc || "Name A-Z" },
    { value: "boat_name-desc", label: t?.sort?.nameDesc || "Name Z-A" },
    { value: "price-desc", label: t?.sort?.priceDesc || "Price High-Low" },
    { value: "price-asc", label: t?.sort?.priceAsc || "Price Low-High" },
    { value: "year-desc", label: t?.sort?.yearDesc || "Year Newest" },
    { value: "year-asc", label: t?.sort?.yearAsc || "Year Oldest" },
    { value: "created_at-desc", label: t?.sort?.createdDesc || "Newest" },
    { value: "updated_at-desc", label: t?.sort?.updatedDesc || "Recently Updated" },
  ];

  // Normalize status to title-case to handle API inconsistency ("draft" vs "Draft")
  const normalizeStatus = (status: string | null | undefined): string => {
    if (!status) return "Draft";
    const map: Record<string, string> = {
      "draft": "Draft",
      "for sale": "For Sale",
      "for bid": "For Bid",
      "sold": "Sold",
      "active": "Active",
      "inactive": "Inactive",
      "maintenance": "Maintenance",
    };
    return map[status.toLowerCase()] || status;
  };

  // Fetch fleet
  const fetchFleet = async () => {
    try {
      setLoading(true);
      const res = await api.get("/yachts");
      // Normalize status on all yachts before using them
      const yachts = (res.data || []).map((y: any) => ({
        ...y,
        status: normalizeStatus(y.status),
      }));
      setFleet(yachts);

      // Calculate stats
      const statsData = {
        total: yachts.length,
        forSale: yachts.filter((y: any) => y.status === "For Sale").length,
        forBid: yachts.filter((y: any) => y.status === "For Bid").length,
        sold: yachts.filter((y: any) => y.status === "Sold").length,
        draft: yachts.filter((y: any) => y.status === "Draft").length,
        active: yachts.filter((y: any) => y.status === "Active").length,
        inactive: yachts.filter((y: any) => y.status === "Inactive").length,
      };
      setStats(statsData);
    } catch (err: any) {
      console.error("API Sync Error", err);
      toast.error(t?.toasts?.loadFailed || "Failed to load fleet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const handleImageError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = PLACEHOLDER_IMAGE;
    e.currentTarget.classList.add("opacity-50", "grayscale");
  };

  const handleDelete = async (yacht: any) => {
    const yachtName = yacht.boat_name || yacht.name || t?.fallbacks?.unnamedVessel || "Unnamed Vessel";
    const confirmed = window.confirm(
      `Are you sure you want to delete ${yachtName}?`,
    );
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await api.delete(`/yachts/${yacht.id}`);
      fetchFleet();
      toast.success(t?.toasts?.deleted || "Vessel deleted");
    } catch (err: any) {
      console.error("Deletion failed:", err);
      if (err.response?.status === 403) {
        toast.error(
          t?.errors?.permissionDenied || "Permission denied",
        );
      } else {
        toast.error(t?.errors?.deleteFailed || "Failed to delete vessel");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAvailability = async (yacht: any) => {
    try {
      const newStatus = yacht.status === "Active" ? "Inactive" : "Active";
      await api.put(`/yachts/${yacht.id}`, { ...yacht, status: newStatus });
      fetchFleet();
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error("Status update failed:", err);
      toast.error(t?.errors?.statusUpdateFailed || "Failed to update status");
    }
  };

  const getImageUrl = (imagePath: string | null | undefined) => {
    if (!imagePath) return PLACEHOLDER_IMAGE;
    if (imagePath.startsWith("http")) return imagePath;
    return `${STORAGE_URL}${imagePath}`;
  };

  // Safe string access with null checks
  const safeString = (value: any): string => {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  };

  // Filter and sort fleet
  const filteredAndSortedFleet = fleet
    .filter((yacht) => {
      if (!yacht) return false;

      // Search filter - safe with null checks
      const boatName = safeString(yacht.boat_name).toLowerCase();
      const vesselId = safeString(yacht.vessel_id).toLowerCase();
      const location = safeString(yacht.where).toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch =
        boatName.includes(query) ||
        vesselId.includes(query) ||
        location.includes(query);

      // Status filter
      const yachtStatus = yacht.status || "Draft";
      const matchesStatus =
        selectedStatus === "all" || yachtStatus === selectedStatus;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sorting logic with null checks
      let aValue: any = "";
      let bValue: any = "";

      if (sortBy.includes(".")) {
        // Handle nested properties if needed
        const keys = sortBy.split(".");
        aValue = keys.reduce((obj, key) => obj?.[key], a) || "";
        bValue = keys.reduce((obj, key) => obj?.[key], b) || "";
      } else {
        aValue = a[sortBy] || "";
        bValue = b[sortBy] || "";
      }

      // Handle numeric sorting for price, year, etc.
      if (sortBy === "price" || sortBy === "year") {
        const aNum = parseFloat(aValue) || 0;
        const bNum = parseFloat(bValue) || 0;
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Handle date sorting
      if (sortBy.includes("_at")) {
        const aDate = new Date(aValue || 0).getTime();
        const bDate = new Date(bValue || 0).getTime();
        return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
      }

      // Handle string sorting
      const aStr = safeString(aValue);
      const bStr = safeString(bValue);

      return sortOrder === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined || amount === "") return t?.fallbacks?.price || "Price on request";
    const numAmount = Number(amount);
    if (isNaN(numAmount)) return t?.fallbacks?.price || "Price on request";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
  };

  const formatLength = (loa: string | number | null | undefined) => {
    if (loa === null || loa === undefined || loa === "") return t?.fallbacks?.length || "--";
    return `${loa}m`;
  };

  const getStatusConfig = (status: string | null | undefined) => {
    const safeStatus = status || "Draft";
    return statusConfig[safeStatus] || statusConfig["Draft"];
  };

  const getYachtName = (yacht: any): string => {
    return yacht.boat_name || yacht.name || t?.fallbacks?.unnamedVessel || "Unnamed Vessel";
  };

  const getYachtStatus = (yacht: any): string => {
    const status = yacht.status || "Draft";
    const statusMap: Record<string, string> = {
      "For Sale": t?.status?.forSale || "For Sale",
      "For Bid": t?.status?.forBid || "For Bid",
      Sold: t?.status?.sold || "Sold",
      Draft: t?.status?.draft || "Draft",
      Active: t?.status?.active || "Active",
      Inactive: t?.status?.inactive || "Inactive",
      Maintenance: t?.status?.maintenance || "Maintenance",
    };
    return statusMap[status] || status;
  };

  const handleSortChange = (value: string) => {
    const [newSortBy, newSortOrder] = value.split("-");
    setSortBy(newSortBy);
    setSortOrder(newSortOrder as "asc" | "desc");
  };

  // View toggle buttons
  const ViewToggle = () => (
    <div className="flex border border-slate-200 rounded-sm overflow-hidden">
      <button
        onClick={() => setViewMode("grid")}
        title="Grid View"
        aria-label="Grid View"
        className={cn(
          "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors",
          viewMode === "grid"
            ? "bg-[#003566] text-white"
            : "bg-white text-slate-600 hover:bg-slate-50",
        )}
      >
        <Grid3x3 size={14} />
      </button>
      <button
        onClick={() => setViewMode("list")}
        title="List View"
        aria-label="List View"
        className={cn(
          "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors border-l border-slate-200",
          viewMode === "list"
            ? "bg-[#003566] text-white"
            : "bg-white text-slate-600 hover:bg-slate-50",
        )}
      >
        <List size={14} />
      </button>
    </div>
  );

  // Simple slugify function
  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // remove special chars
      .replace(/\s+/g, "-") // spaces to hyphens
      .replace(/--+/g, "-") // collapse multiple hyphens
      .replace(/^-+|-+$/g, ""); // trim hyphens
  };

  const getPublicUrl = (yacht: any): string => {
    const slug = yacht.slug || slugify(yacht.boat_name || "yacht");
    return `/${locale}/yachts/${yacht.id}/${slug}`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-12 -top-20">
      <Toaster position="top-right" />
      {/* HEADER */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h1 className="text-4xl lg:text-5xl font-serif italic tracking-tight mb-2">
              {t?.header?.title || "Fleet Management"}
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
              {t?.header?.subtitle || "Vessel Registry & Management"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={fetchFleet}
              className="bg-white text-[#003566] border border-slate-200 hover:bg-slate-50 rounded-none h-12 px-6 font-black uppercase text-[10px] tracking-widest transition-all shadow-sm flex items-center gap-2"
            >
              <RefreshCw size={14} />
              {t?.actions?.refresh || "Refresh"}
            </Button>
            <Button
              onClick={() => router.push(`/${locale}/dashboard/admin/yachts/new`)}
              className="bg-[#003566] text-white hover:bg-blue-800 rounded-none h-12 px-8 font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2"
            >
              <Plus size={14} />
              {t?.actions?.newVessel || "New Vessel"}
            </Button>
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-8">
          <div className="bg-white p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  {t?.stats?.total || "Total"}
                </p>
                <p className="text-xl font-bold text-[#003566]">
                  {stats.total}
                </p>
              </div>
              <BarChart3 className="text-blue-600" size={18} />
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  {t?.stats?.forSale || "For Sale"}
                </p>
                <p className="text-xl font-bold text-emerald-600">
                  {stats.forSale}
                </p>
              </div>
              <Euro className="text-emerald-600" size={18} />
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  {t?.stats?.forBid || "For Bid"}
                </p>
                <p className="text-xl font-bold text-blue-600">
                  {stats.forBid}
                </p>
              </div>
              <Users className="text-blue-600" size={18} />
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  {t?.stats?.sold || "Sold"}
                </p>
                <p className="text-xl font-bold text-amber-600">{stats.sold}</p>
              </div>
              <CheckCircle className="text-amber-600" size={18} />
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  {t?.stats?.draft || "Draft"}
                </p>
                <p className="text-xl font-bold text-slate-500">
                  {stats.draft}
                </p>
              </div>
              <AlertTriangle className="text-slate-500" size={18} />
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  {t?.stats?.active || "Active"}
                </p>
                <p className="text-xl font-bold text-emerald-600">
                  {stats.active}
                </p>
              </div>
              <CheckCircle className="text-emerald-600" size={18} />
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  {t?.stats?.inactive || "Inactive"}
                </p>
                <p className="text-xl font-bold text-red-600">
                  {stats.inactive}
                </p>
              </div>
              <XCircle className="text-red-600" size={18} />
            </div>
          </div>
        </div>

        {/* SEARCH AND FILTERS */}
        <div className="bg-white p-6 border border-slate-200 shadow-sm mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
            <div className="relative group lg:col-span-2">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors"
                size={18}
              />
              <input
                type="text"
                placeholder={t?.filters?.searchPlaceholder || "Search vessels..."}
                className="w-full bg-slate-50 border border-slate-200 p-3 pl-12 text-[11px] font-black tracking-widest outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="relative">
              <Filter
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                size={18}
              />
              <select
                className="w-full bg-slate-50 border border-slate-200 p-3 pl-12 text-[11px] font-black tracking-widest outline-none appearance-none"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <select
                className="w-full bg-slate-50 border border-slate-200 p-3 text-[11px] font-black tracking-widest outline-none"
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <ViewToggle />
            </div>
          </div>
        </div>
      </div>
      {/* LOADING STATE */}
      {loading && (
        <div className="col-span-full py-20 text-center">
          <Loader2 className="animate-spin mx-auto text-blue-600" size={40} />
          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
            {t?.loading || "Loading fleet..."}
          </p>
        </div>
      )}
      {/* EMPTY STATE */}
      {!loading && filteredAndSortedFleet.length === 0 && (
        <div className="text-center py-20">
          <Ship className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mb-2">
            {t?.empty?.title || "No vessels found"}
          </p>
          <p className="text-[10px] text-slate-400 mb-6">
            {searchQuery || selectedStatus !== "all"
              ? t?.empty?.adjustFilters || "Try adjusting your filters"
              : t?.empty?.noVessels || "Register your first vessel to get started"}
          </p>
          <Button
            onClick={() => router.push(`/${locale}/dashboard/admin/yachts/new`)}
            className="bg-[#003566] text-white hover:bg-blue-800 rounded-none px-8 font-black uppercase text-[10px] tracking-widest"
          >
            <Plus className="mr-2 w-4 h-4" />
            {t?.actions?.registerFirst || "Register First Vessel"}
          </Button>
        </div>
      )}
      {/* GRID VIEW */}
      {!loading && viewMode === "grid" && filteredAndSortedFleet.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAndSortedFleet.map((yacht) => (
            <div
              key={yacht.id}
              className="bg-white border border-slate-200 group overflow-hidden flex flex-col hover:shadow-xl transition-all duration-300"
            >
              {/* IMAGE SECTION */}
              <div className="h-64 bg-slate-100 overflow-hidden relative">
                <img
                  src={getImageUrl(yacht.main_image)}
                  onError={handleImageError}
                  alt={getYachtName(yacht)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* VESSEL ID BADGE */}
                {yacht.vessel_id && (
                  <div className="absolute top-3 left-3 bg-black/80 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1">
                    {yacht.vessel_id}
                  </div>
                )}

                {/* STATUS BADGE */}
                <div className="absolute top-3 right-3">
                  <span
                    className={cn(
                      "text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
                      getStatusConfig(yacht.status).color,
                      getStatusConfig(yacht.status).bg,
                      getStatusConfig(yacht.status).border,
                    )}
                  >
                    {getYachtStatus(yacht)}
                  </span>
                </div>

                {/* ACTION OVERLAY */}
                <div className="absolute inset-0 bg-[#003566]/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-6">
                  <button
                    onClick={() =>
                      router.push(`/${locale}/dashboard/admin/yachts/${yacht.id}`)
                    }
                    className="w-full max-w-[200px] bg-white text-[#003566] px-4 py-3 font-black uppercase text-[9px] tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Edit3 size={12} />
                    {t?.actions?.editManifest || "Edit Manifest"}
                  </button>

                  <button
                    onClick={() => window.open(getPublicUrl(yacht), "_blank")}
                    className="w-full max-w-[200px] bg-blue-600 text-white px-4 py-3 font-black uppercase text-[9px] tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Eye size={12} />
                    {t?.actions?.viewDetails || "View Details"}
                  </button>

                  <button
                    onClick={() => handleDelete(yacht)}
                    disabled={isSubmitting}
                    className="w-full max-w-[200px] bg-red-600 text-white px-4 py-3 font-black uppercase text-[9px] tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" size={12} />
                    ) : (
                      <Trash size={12} />
                    )}
                    {t?.actions?.deleteVessel || "Delete Vessel"}
                  </button>
                </div>
              </div>

              {/* DETAILS SECTION */}
              <div className="p-5 space-y-4 flex-1 flex flex-col">
                <div>
                  <h3 className="text-lg font-serif italic mb-1 line-clamp-1">
                    {getYachtName(yacht)}
                  </h3>
                  <p className="text-lg font-bold text-blue-900">
                    {formatCurrency(yacht.price)}
                  </p>
                </div>

                {/* SPECIFICATIONS */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                      {t?.sections?.dimensions || "Dimensions"}
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] text-slate-600">
                        <Maximize2 size={12} className="text-blue-600" />
                        <span className="font-medium">LOA: {yacht.loa ?? "--"}m</span>
                      </div>
                      {yacht.beam && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-600">
                          <Maximize2
                            size={12}
                            className="text-blue-600 rotate-90"
                          />
                          <span>Beam: {yacht.beam}m</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                      {t?.sections?.details || "Details"}
                    </p>
                    <div className="space-y-1">
                      {yacht.year && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-600">
                          <Calendar size={12} className="text-blue-600" />
                          <span>{yacht.year}</span>
                        </div>
                      )}
                      {yacht.where && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-600 line-clamp-1">
                          <MapPin size={12} className="text-blue-600" />
                          <span>{yacht.where}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="pt-4 border-t border-slate-100 mt-auto">
                  <button
                    onClick={() =>
                      router.push(`/${locale}/dashboard/admin/yachts/${yacht.id}`)
                    }
                    className="w-full text-[9px] font-black uppercase text-blue-600 tracking-widest hover:text-blue-800 transition-colors flex items-center justify-center gap-1"
                  >
                    {t?.actions?.manageVessel || "Manage Vessel"}
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* LIST VIEW */}
      {!loading && viewMode === "list" && filteredAndSortedFleet.length > 0 && (
        <div className="bg-white border border-slate-200">
          {/* TABLE HEADER */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <div className="col-span-3">{t?.table?.vessel || "Vessel"}</div>
            <div className="col-span-2">{t?.table?.price || "Price"}</div>
            <div className="col-span-2">{t?.table?.specifications || "Specs"}</div>
            <div className="col-span-2">{t?.table?.status || "Status"}</div>
            <div className="col-span-1">{t?.table?.year || "Year"}</div>
            <div className="col-span-2 text-right">{t?.table?.actions || "Actions"}</div>
          </div>

          {/* TABLE ROWS */}
          {filteredAndSortedFleet.map((yacht) => (
            <div
              key={yacht.id}
              className="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
            >
              {/* VESSEL */}
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-16 h-12 bg-slate-100 overflow-hidden flex-shrink-0">
                  <img
                    src={getImageUrl(yacht.main_image)}
                    onError={handleImageError}
                    alt={getYachtName(yacht)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-[#003566]">
                    {getYachtName(yacht)}
                  </p>
                  {yacht.vessel_id && (
                    <p className="text-[9px] text-slate-500 font-medium">
                      ID: {yacht.vessel_id}
                    </p>
                  )}
                </div>
              </div>

              {/* PRICE */}
              <div className="col-span-2 flex items-center">
                <p className="font-bold text-blue-900">
                  {formatCurrency(yacht.price)}
                </p>
              </div>

              {/* SPECIFICATIONS */}
              <div className="col-span-2 flex items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <Maximize2 size={12} className="text-blue-600" />
                    <span>{formatLength(yacht.loa)}</span>
                  </div>
                  {yacht.where && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <MapPin size={12} className="text-blue-600" />
                      <span className="truncate">{yacht.where}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* STATUS */}
              <div className="col-span-2 flex items-center">
                <span
                  className={cn(
                    "inline-flex text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
                    getStatusConfig(yacht.status).color,
                    getStatusConfig(yacht.status).bg,
                    getStatusConfig(yacht.status).border,
                  )}
                >
                  {getYachtStatus(yacht)}
                </span>
              </div>

              {/* YEAR */}
              <div className="col-span-1 flex items-center">
                <span className="text-[11px] font-medium text-slate-600">
                  {yacht.year || "--"}
                </span>
              </div>

              {/* ACTIONS */}
              <div className="col-span-2 flex items-center justify-end gap-2">
                <button
                  onClick={() =>
                    router.push(`/${locale}/dashboard/admin/yachts/${yacht.id}`)
                  }
                  className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                  title="Edit"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() =>
                    router.push(`/${locale}/dashboard/admin/yachts/${yacht.id}`)
                  }
                  className="p-2 text-emerald-600 hover:text-emerald-800 transition-colors"
                  title="View"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => handleDelete(yacht)}
                  disabled={isSubmitting}
                  className="p-2 text-red-600 hover:text-red-800 transition-colors"
                  title="Delete"
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* FOOTER */}
      {!loading && filteredAndSortedFleet.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span className="text-blue-600">
                {filteredAndSortedFleet.length}
              </span>{" "}
              of {fleet.length} vessels
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={fetchFleet}
                variant="outline"
                className="h-9 px-4 text-[10px] font-black uppercase tracking-widest"
              >
                <RefreshCw size={12} className="mr-2" />
                {t?.actions?.refresh || "Refresh"}
              </Button>
              <Button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                variant="outline"
                className="h-9 px-4 text-[10px] font-black uppercase tracking-widest"
              >
                {t?.actions?.backToTop || "Back to Top"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
