"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AxiosError } from "axios";
import {
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  Globe,
  HelpCircle,
  Lock,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { normalizeRole } from "@/lib/auth/roles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type FaqVisibility = "public" | "staff" | "internal";

interface Faq {
  id: number;
  location_id: number;
  question: string;
  answer: string;
  category: string;
  language?: string | null;
  visibility: FaqVisibility;
  source_type?: string | null;
  created_at: string;
  updated_at: string;
}

interface FaqKnowledgeDocument {
  id: number;
  location_id: number;
  file_name: string;
  source_type: string;
  status: string;
  visibility: FaqVisibility;
  language?: string | null;
  category?: string | null;
  generated_qna_count?: number | null;
  items_count?: number | null;
  processed_at?: string | null;
  processing_error?: string | null;
  created_at: string;
}

interface FaqKnowledgeItem {
  id: number;
  document_id: number;
  location_id: number;
  approved_faq_id?: number | null;
  status: string;
  question: string;
  answer: string;
  category?: string | null;
  language?: string | null;
  visibility: FaqVisibility;
  source_type: string;
  source_excerpt?: string | null;
  review_notes?: string | null;
  created_at: string;
  document?: {
    id: number;
    file_name: string;
  } | null;
  approved_faq?: {
    id: number;
    question: string;
  } | null;
}

interface PreviewSource {
  faq_id?: number | null;
  question?: string | null;
  category?: string | null;
  visibility?: string | null;
  confidence?: number | null;
}

interface PreviewAnswer {
  question?: string | null;
  answer?: string | null;
  category?: string | null;
  strategy?: string | null;
  confidence?: number | null;
  confidence_label?: string | null;
  sources?: PreviewSource[];
}

interface PreviewResult {
  answers?: PreviewAnswer[];
  confidence?: number;
  answer_strategy?: string | null;
  clarifying_question?: string | null;
  language?: string | null;
  knowledge_trace?: {
    strategy?: string | null;
    filters?: {
      visibility?: string | null;
      location_scope?: number | number[] | null;
    };
    used_source_ids?: number[];
  } | null;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

const FAQ_PAGE_SIZE = 12;

interface LocationOption {
  id: number;
  name: string;
}

type ApiErrorResponse = {
  message?: string;
};

type ItemDraft = {
  question: string;
  answer: string;
  category: string;
  language: string;
  visibility: FaqVisibility;
};

type FaqDraft = {
  question: string;
  answer: string;
  category: string;
  language: string;
  visibility: FaqVisibility;
};

function getCurrentLocationId() {
  if (typeof window === "undefined") return null;
  const userDataRaw = localStorage.getItem("user_data");
  if (!userDataRaw) return null;

  try {
    const userData = JSON.parse(userDataRaw) as {
      location_id?: number | string;
      locationId?: number | string;
      location?: { id?: number | string };
      client_location_id?: number | string;
    };

    const locationValue =
      userData.location_id ??
      userData.locationId ??
      userData.client_location_id ??
      userData.location?.id;

    if (
      locationValue === null ||
      locationValue === undefined ||
      locationValue === ""
    ) {
      return null;
    }

    const parsed = Number(locationValue);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const intlLocale =
    locale === "nl"
      ? "nl-NL"
      : locale === "de"
        ? "de-DE"
        : locale === "fr"
          ? "fr-FR"
          : "en-US";

  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function createItemDraft(item: FaqKnowledgeItem): ItemDraft {
  return {
    question: item.question,
    answer: item.answer,
    category: item.category || "Website",
    language: item.language || "",
    visibility: item.visibility || "public",
  };
}

function createFaqDraft(faq: Faq): FaqDraft {
  return {
    question: faq.question,
    answer: faq.answer,
    category: faq.category || "Website",
    language: faq.language || "",
    visibility: faq.visibility || "public",
  };
}

function getLocationOptions(payload: unknown): LocationOption[] {
  if (Array.isArray(payload)) {
    return payload as LocationOption[];
  }

  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { data?: unknown[] }).data)
  ) {
    return (payload as { data: LocationOption[] }).data;
  }

  return [];
}

function badgeClassesForStatus(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-700";
    case "pending":
    case "pending_review":
      return "bg-amber-100 text-amber-700";
    case "failed":
    case "declined":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function badgeClassesForVisibility(visibility: FaqVisibility) {
  switch (visibility) {
    case "public":
      return "bg-sky-100 text-sky-700";
    case "staff":
      return "bg-violet-100 text-violet-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function FAQPage() {
  const params = useParams<{ role?: string }>();
  const t = useTranslations("DashboardFaq");
  const locale = useLocale();
  const role = normalizeRole(params?.role) ?? "admin";
  const canManage = role !== "client";

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [documents, setDocuments] = useState<FaqKnowledgeDocument[]>([]);
  const [pendingItems, setPendingItems] = useState<FaqKnowledgeItem[]>([]);
  const [itemDrafts, setItemDrafts] = useState<Record<number, ItemDraft>>({});
  const [faqDrafts, setFaqDrafts] = useState<Record<number, FaqDraft>>({});
  const [faqTotal, setFaqTotal] = useState(0);
  const [faqListTotal, setFaqListTotal] = useState(0);
  const [faqPage, setFaqPage] = useState(1);
  const [faqLastPage, setFaqLastPage] = useState(1);
  const [faqPerPage, setFaqPerPage] = useState(FAQ_PAGE_SIZE);
  const [documentTotal, setDocumentTotal] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [approvedKnowledgeCount, setApprovedKnowledgeCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewQuestion, setPreviewQuestion] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [expandedFaqId, setExpandedFaqId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submittingFaq, setSubmittingFaq] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [reviewingItemId, setReviewingItemId] = useState<number | null>(null);
  const [editingFaqId, setEditingFaqId] = useState<number | null>(null);
  const [savingFaqId, setSavingFaqId] = useState<number | null>(null);
  const [faqToDelete, setFaqToDelete] = useState<number | null>(null);
  const [deletingFaq, setDeletingFaq] = useState(false);
  const [selectedFaqIds, setSelectedFaqIds] = useState<number[]>([]);
  const [bulkVisibility, setBulkVisibility] = useState<FaqVisibility>("public");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkUpdatingVisibility, setBulkUpdatingVisibility] = useState(false);
  const [bulkDeletingFaqs, setBulkDeletingFaqs] = useState(false);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const hasFetchedRef = useRef(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [newFaq, setNewFaq] = useState({
    question: "",
    answer: "",
    category: "Website",
    language: "",
    visibility: "public" as FaqVisibility,
  });
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    category: "Website",
    language: "",
    visibility: "public" as FaqVisibility,
  });

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(
        faqs
          .map((faq) => faq.category)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return values.length > 0 ? values.sort() : ["Website", "General"];
  }, [faqs]);

  const selectedLocationName = useMemo(
    () =>
      locations.find((locationOption) => String(locationOption.id) === selectedLocationId)
        ?.name ?? "Selected location",
    [locations, selectedLocationId],
  );
  const failedLoadMessage = t("toastFailedLoad");
  const topPreviewAnswer = previewResult?.answers?.[0] ?? null;
  const selectedFaqCount = selectedFaqIds.length;
  const allFaqsOnPageSelected =
    faqs.length > 0 && faqs.every((faq) => selectedFaqIds.includes(faq.id));
  const faqRangeStart = faqListTotal === 0 ? 0 : (faqPage - 1) * faqPerPage + 1;
  const faqRangeEnd =
    faqListTotal === 0 ? 0 : Math.min(faqPage * faqPerPage, faqListTotal);

  const refreshData = useCallback(
    async (locationIdOverride?: string) => {
      const effectiveLocationId = locationIdOverride || selectedLocationId;
      const locationIdNumber = Number(effectiveLocationId);

      if (!Number.isFinite(locationIdNumber) || locationIdNumber <= 0) {
        setFaqs([]);
        setDocuments([]);
        setPendingItems([]);
        setFaqTotal(0);
        setFaqListTotal(0);
        setFaqLastPage(1);
        setFaqPerPage(FAQ_PAGE_SIZE);
        setDocumentTotal(0);
        setPendingReviewCount(0);
        setApprovedKnowledgeCount(0);
        setSelectedFaqIds([]);
        hasFetchedRef.current = false;
        setLoading(false);
        return;
      }

      if (!hasFetchedRef.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const faqListParams = {
          location_id: locationIdNumber,
          page: faqPage,
          per_page: FAQ_PAGE_SIZE,
          ...(selectedCategory !== "all" ? { category: selectedCategory } : {}),
          ...(deferredSearchQuery ? { search: deferredSearchQuery } : {}),
        };

        const [
          faqListResponse,
          faqTotalResponse,
          pendingItemsResponse,
          approvedItemsResponse,
          documentsResponse,
        ] = await Promise.all([
          api.get<PaginatedResponse<Faq>>("/faqs", {
            params: faqListParams,
          }),
          api.get<PaginatedResponse<Faq>>("/faqs", {
            params: {
              location_id: locationIdNumber,
              per_page: 1,
            },
          }),
          api.get<PaginatedResponse<FaqKnowledgeItem>>("/faqs/knowledge/items", {
            params: {
              location_id: locationIdNumber,
              status: "pending",
              per_page: 12,
            },
          }),
          api.get<PaginatedResponse<FaqKnowledgeItem>>("/faqs/knowledge/items", {
            params: {
              location_id: locationIdNumber,
              status: "approved",
              per_page: 1,
            },
          }),
          api.get<PaginatedResponse<FaqKnowledgeDocument>>("/faqs/knowledge/documents", {
            params: {
              location_id: locationIdNumber,
              per_page: 8,
            },
          }),
        ]);

        setFaqs(faqListResponse.data.data ?? []);
        setFaqListTotal(faqListResponse.data.total ?? 0);
        setFaqLastPage(Math.max(1, faqListResponse.data.last_page ?? 1));
        setFaqPerPage(faqListResponse.data.per_page ?? FAQ_PAGE_SIZE);
        setPendingItems(pendingItemsResponse.data.data ?? []);
        setDocuments(documentsResponse.data.data ?? []);
        setFaqTotal(faqTotalResponse.data.total ?? 0);
        setPendingReviewCount(pendingItemsResponse.data.total ?? 0);
        setApprovedKnowledgeCount(approvedItemsResponse.data.total ?? 0);
        setDocumentTotal(documentsResponse.data.total ?? 0);
        hasFetchedRef.current = true;
      } catch (error) {
        console.error("Failed to load FAQ dashboard data:", error);
        toast.error(failedLoadMessage);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [deferredSearchQuery, failedLoadMessage, faqPage, selectedCategory, selectedLocationId],
  );

  const fetchLocations = useCallback(async () => {
    try {
      const response = await api.get("/public/locations");
      const list = getLocationOptions(response.data);
      setLocations(list);

      const currentLocationId = getCurrentLocationId();
      if (list.length > 0) {
        const preferredLocation =
          currentLocationId &&
          list.some((locationOption) => locationOption.id === currentLocationId)
            ? String(currentLocationId)
            : String(list[0].id);

        setSelectedLocationId((current) => current || preferredLocation);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch FAQ locations:", error);
      toast.error("Failed to load locations");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (!selectedLocationId) return;
    void refreshData();
  }, [refreshData, selectedLocationId]);

  useEffect(() => {
    setPreviewResult(null);
  }, [selectedLocationId]);

  useEffect(() => {
    setSelectedFaqIds((current) =>
      current.filter((faqId) => faqs.some((faq) => faq.id === faqId)),
    );
  }, [faqs]);

  useEffect(() => {
    if (editingFaqId !== null && !faqs.some((faq) => faq.id === editingFaqId)) {
      setEditingFaqId(null);
    }

    if (expandedFaqId !== null && !faqs.some((faq) => faq.id === expandedFaqId)) {
      setExpandedFaqId(null);
    }
  }, [editingFaqId, expandedFaqId, faqs]);

  useEffect(() => {
    setItemDrafts((previousDrafts) => {
      const nextDrafts = { ...previousDrafts };

      for (const item of pendingItems) {
        nextDrafts[item.id] = previousDrafts[item.id] ?? createItemDraft(item);
      }

      return nextDrafts;
    });
  }, [pendingItems]);

  useEffect(() => {
    setFaqDrafts((previousDrafts) => {
      const nextDrafts = { ...previousDrafts };

      for (const faq of faqs) {
        nextDrafts[faq.id] =
          editingFaqId === faq.id
            ? previousDrafts[faq.id] ?? createFaqDraft(faq)
            : createFaqDraft(faq);
      }

      return nextDrafts;
    });
  }, [editingFaqId, faqs]);

  const updateItemDraft = (itemId: number, patch: Partial<ItemDraft>) => {
    const sourceItem = pendingItems.find((item) => item.id === itemId);

    setItemDrafts((previousDrafts) => ({
      ...previousDrafts,
      [itemId]: {
        ...(previousDrafts[itemId] ??
          (sourceItem
            ? createItemDraft(sourceItem)
            : {
                question: "",
                answer: "",
                category: "Website",
                language: "",
                visibility: "public" as FaqVisibility,
              })),
        ...patch,
      },
    }));
  };

  const updateFaqDraft = (faqId: number, patch: Partial<FaqDraft>) => {
    const sourceFaq = faqs.find((faq) => faq.id === faqId);

    setFaqDrafts((previousDrafts) => ({
      ...previousDrafts,
      [faqId]: {
        ...(previousDrafts[faqId] ??
          (sourceFaq
            ? createFaqDraft(sourceFaq)
            : {
                question: "",
                answer: "",
                category: "Website",
                language: "",
                visibility: "public" as FaqVisibility,
              })),
        ...patch,
      },
    }));
  };

  const handleToggleFaqSelection = (faqId: number) => {
    setSelectedFaqIds((current) =>
      current.includes(faqId)
        ? current.filter((currentId) => currentId !== faqId)
        : [...current, faqId],
    );
  };

  const handleToggleSelectAllFaqs = () => {
    setSelectedFaqIds(allFaqsOnPageSelected ? [] : faqs.map((faq) => faq.id));
  };

  const refreshFaqListAfterRemoval = async (removedCount: number) => {
    const nextPage = faqPage > 1 && faqs.length <= removedCount ? faqPage - 1 : faqPage;

    if (nextPage !== faqPage) {
      setFaqPage(nextPage);
      return;
    }

    await refreshData();
  };

  const handleAddFaq = async (event: React.FormEvent) => {
    event.preventDefault();

    const locationIdNumber = Number(selectedLocationId);
    if (!Number.isFinite(locationIdNumber) || locationIdNumber <= 0) {
      toast.error("Select a location first.");
      return;
    }

    try {
      setSubmittingFaq(true);

      await api.post("/faqs", {
        location_id: locationIdNumber,
        question: newFaq.question,
        answer: newFaq.answer,
        category: newFaq.category,
        visibility: newFaq.visibility,
        language: newFaq.language || undefined,
        source_type: "faq",
      });

      toast.success(t("toastFaqAdded"));
      setNewFaq({
        question: "",
        answer: "",
        category: newFaq.category,
        language: newFaq.language,
        visibility: newFaq.visibility,
      });
      setShowAddForm(false);
      await refreshData();
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as ApiErrorResponse | undefined)?.message
          : undefined;
      toast.error(message || t("toastFailedAdd"));
    } finally {
      setSubmittingFaq(false);
    }
  };

  const handleUploadDocument = async (event: React.FormEvent) => {
    event.preventDefault();

    const locationIdNumber = Number(selectedLocationId);
    if (!Number.isFinite(locationIdNumber) || locationIdNumber <= 0) {
      toast.error("Select a location first.");
      return;
    }

    if (!uploadForm.file) {
      toast.error("Choose a document to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("location_id", String(locationIdNumber));
    formData.append("file", uploadForm.file);
    formData.append("category", uploadForm.category);
    formData.append("visibility", uploadForm.visibility);

    if (uploadForm.language.trim()) {
      formData.append("language", uploadForm.language.trim());
    }

    try {
      setUploadingDocument(true);

      await api.post("/faqs/knowledge/documents", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Document uploaded. Generated Q&A items are ready for review.");
      setUploadForm((previousForm) => ({
        ...previousForm,
        file: null,
      }));
      setUploadInputKey((current) => current + 1);
      await refreshData();
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as ApiErrorResponse | undefined)?.message
          : undefined;
      toast.error(message || "Document upload failed.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleReviewItem = async (
    item: FaqKnowledgeItem,
    status: "approved" | "declined",
  ) => {
    const draft = itemDrafts[item.id] ?? createItemDraft(item);

    try {
      setReviewingItemId(item.id);

      await api.patch(`/faqs/knowledge/items/${item.id}`, {
        status,
        question: draft.question,
        answer: draft.answer,
        category: draft.category,
        visibility: draft.visibility,
        language: draft.language || null,
      });

      toast.success(
        status === "approved"
          ? "Knowledge item approved and added to FAQs."
          : "Knowledge item declined.",
      );
      await refreshData();
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as ApiErrorResponse | undefined)?.message
          : undefined;
      toast.error(message || "Failed to review knowledge item.");
    } finally {
      setReviewingItemId(null);
    }
  };

  const handleDeleteFaq = async (faqId: number) => {
    try {
      setDeletingFaq(true);
      await api.delete(`/faqs/${faqId}`);
      toast.success(t("toastFaqDeleted"));
      setFaqToDelete(null);
      setSelectedFaqIds((current) => current.filter((currentId) => currentId !== faqId));
      await refreshFaqListAfterRemoval(1);
    } catch {
      toast.error(t("toastFailedDelete"));
    } finally {
      setDeletingFaq(false);
    }
  };

  const handleStartEditingFaq = (faq: Faq) => {
    setExpandedFaqId(faq.id);
    setEditingFaqId(faq.id);
    setFaqDrafts((previousDrafts) => ({
      ...previousDrafts,
      [faq.id]: createFaqDraft(faq),
    }));
  };

  const handleCancelEditingFaq = (faq: Faq) => {
    setFaqDrafts((previousDrafts) => ({
      ...previousDrafts,
      [faq.id]: createFaqDraft(faq),
    }));
    setEditingFaqId((current) => (current === faq.id ? null : current));
  };

  const handleSaveFaq = async (faq: Faq) => {
    const draft = faqDrafts[faq.id] ?? createFaqDraft(faq);

    try {
      setSavingFaqId(faq.id);

      await api.put(`/faqs/${faq.id}`, {
        question: draft.question,
        answer: draft.answer,
        category: draft.category,
        visibility: draft.visibility,
        language: draft.language || null,
      });

      toast.success("FAQ updated.");
      setEditingFaqId((current) => (current === faq.id ? null : current));
      await refreshData();
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as ApiErrorResponse | undefined)?.message
          : undefined;
      toast.error(message || "Failed to update FAQ.");
    } finally {
      setSavingFaqId(null);
    }
  };

  const handleBulkUpdateVisibility = async () => {
    const locationIdNumber = Number(selectedLocationId);

    if (!Number.isFinite(locationIdNumber) || locationIdNumber <= 0) {
      toast.error("Select a location first.");
      return;
    }

    if (selectedFaqIds.length === 0) {
      toast.error("Select at least one FAQ on this page.");
      return;
    }

    try {
      setBulkUpdatingVisibility(true);

      await api.post("/faqs/bulk", {
        action: "update_visibility",
        location_id: locationIdNumber,
        faq_ids: selectedFaqIds,
        visibility: bulkVisibility,
      });

      toast.success(`Updated ${selectedFaqIds.length} FAQ entries.`);
      setSelectedFaqIds([]);
      await refreshData();
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as ApiErrorResponse | undefined)?.message
          : undefined;
      toast.error(message || "Failed to update FAQ visibility.");
    } finally {
      setBulkUpdatingVisibility(false);
    }
  };

  const handleBulkDeleteFaqs = async () => {
    const locationIdNumber = Number(selectedLocationId);

    if (!Number.isFinite(locationIdNumber) || locationIdNumber <= 0) {
      toast.error("Select a location first.");
      return;
    }

    if (selectedFaqIds.length === 0) {
      toast.error("Select at least one FAQ on this page.");
      return;
    }

    const removedCount = selectedFaqIds.length;

    try {
      setBulkDeletingFaqs(true);

      await api.post("/faqs/bulk", {
        action: "delete",
        location_id: locationIdNumber,
        faq_ids: selectedFaqIds,
      });

      toast.success(`Deleted ${removedCount} FAQ entries.`);
      setBulkDeleteOpen(false);
      setSelectedFaqIds([]);
      await refreshFaqListAfterRemoval(removedCount);
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as ApiErrorResponse | undefined)?.message
          : undefined;
      toast.error(message || "Failed to delete selected FAQs.");
    } finally {
      setBulkDeletingFaqs(false);
    }
  };

  const handlePreviewQuestion = async (event: React.FormEvent) => {
    event.preventDefault();

    const locationIdNumber = Number(selectedLocationId);
    if (!Number.isFinite(locationIdNumber) || locationIdNumber <= 0) {
      toast.error("Select a location first.");
      return;
    }

    if (!previewQuestion.trim()) {
      toast.error("Enter a question to preview.");
      return;
    }

    try {
      setPreviewLoading(true);

      const response = await api.post<PreviewResult>("/copilot/resolve", {
        text: previewQuestion.trim(),
        source: "chatpage",
        context: {
          location_id: locationIdNumber,
          visibility: "public",
          language: locale,
          preview_mode: true,
        },
      });

      setPreviewResult(response.data);
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as ApiErrorResponse | undefined)?.message
          : undefined;
      toast.error(message || "Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 p-6">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-serif italic text-[#003566] md:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.35em] text-blue-600">
              {t("subtitle", { count: faqTotal })}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                Location
              </label>
              <select
                value={selectedLocationId}
                onChange={(event) => {
                  setSelectedLocationId(event.target.value);
                  setFaqPage(1);
                  setSelectedFaqIds([]);
                  setExpandedFaqId(null);
                  setEditingFaqId(null);
                }}
                className="min-w-[240px] bg-transparent text-sm font-semibold text-slate-700 outline-none"
              >
                {locations.map((locationOption) => (
                  <option key={locationOption.id} value={locationOption.id}>
                    {locationOption.name}
                  </option>
                ))}
                {locations.length === 0 && <option value="">Loading...</option>}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003566] px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-colors hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <HelpCircle size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  {t("totalFaqs")}
                </p>
                <p className="mt-1 text-2xl font-serif text-[#003566]">
                  {faqTotal}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Clock3 size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  Pending Review
                </p>
                <p className="mt-1 text-2xl font-serif text-[#003566]">
                  {pendingReviewCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  Approved Knowledge
                </p>
                <p className="mt-1 text-2xl font-serif text-[#003566]">
                  {approvedKnowledgeCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  Uploaded Documents
                </p>
                <p className="mt-1 text-2xl font-serif text-[#003566]">
                  {documentTotal}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
                <Globe size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-700">
                  Public
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Website visitors and the public chat widget can answer from these FAQs. Use this for content that is safe to show on your website.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm">
                <Users size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-700">
                  Staff
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Keep these for employee-facing guidance or internal assistant support. They stay out of the public website chat.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                <Lock size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-700">
                  Internal
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Use this for notes, policy reminders, or sensitive operational guidance. Internal FAQs are blocked from the public widget.
                </p>
              </div>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">
                  Public Chat Preview
                </p>
                <h2 className="mt-2 text-2xl font-serif text-[#003566]">
                  Test the website bot before publishing
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  This preview checks the current FAQ grounding for {selectedLocationName} using <span className="font-semibold text-slate-700">public-only</span> knowledge. It does not create leads, audit noise, or Knowledge Brain missing-question records.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700">
                <Bot size={14} />
                Public FAQ mode
              </div>
            </div>

            <form onSubmit={handlePreviewQuestion} className="space-y-4">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Visitor question
                </label>
                <textarea
                  value={previewQuestion}
                  onChange={(event) => setPreviewQuestion(event.target.value)}
                  className="min-h-[110px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                  placeholder="Do you offer winter storage at this location?"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={previewLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#003566] px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-colors hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {previewLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Bot size={14} />
                  )}
                  Preview answer
                </button>
                <p className="text-xs text-slate-500">
                  Uses the selected location plus <span className="font-semibold text-slate-700">visibility=public</span>.
                </p>
              </div>
            </form>

            {previewResult ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                    {previewResult.answer_strategy || previewResult.knowledge_trace?.strategy || "preview"}
                  </span>
                  {typeof previewResult.confidence === "number" ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      Confidence {Math.round(previewResult.confidence * 100)}%
                    </span>
                  ) : null}
                  {previewResult.language ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                      {previewResult.language}
                    </span>
                  ) : null}
                </div>

                {topPreviewAnswer?.answer ? (
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Preview reply
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {topPreviewAnswer.answer}
                    </p>
                  </div>
                ) : previewResult.clarifying_question ? (
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Clarifying response
                    </p>
                    <p className="text-sm leading-7 text-slate-700">
                      {previewResult.clarifying_question}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Preview reply
                    </p>
                    <p className="text-sm leading-7 text-slate-700">
                      No public FAQ answer matched this question confidently yet.
                    </p>
                  </div>
                )}

                {topPreviewAnswer?.sources && topPreviewAnswer.sources.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Grounded sources
                    </p>
                    {topPreviewAnswer.sources.map((source, index) => (
                      <div
                        key={`${source.faq_id ?? "source"}-${index}`}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {source.category ? (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                              {source.category}
                            </span>
                          ) : null}
                          {source.visibility ? (
                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClassesForVisibility(source.visibility as FaqVisibility)}`}>
                              {source.visibility}
                            </span>
                          ) : null}
                          {typeof source.confidence === "number" ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                              {Math.round(source.confidence * 100)}%
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-800">
                          {source.question || `FAQ #${source.faq_id ?? "?"}`}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {canManage && (
          <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600">
                    Manual FAQ
                  </p>
                  <h2 className="mt-2 text-2xl font-serif text-[#003566]">
                    Add website answers directly
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Create FAQ entries for {selectedLocationName}. Approved FAQs are what the public chat can use.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm((current) => !current)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  {showAddForm ? t("cancel") : t("addFaq")}
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleAddFaq} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      {t("question")}
                    </label>
                    <input
                      type="text"
                      value={newFaq.question}
                      onChange={(event) =>
                        setNewFaq((previous) => ({
                          ...previous,
                          question: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                      placeholder={t("enterQuestion")}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      {t("answer")}
                    </label>
                    <textarea
                      value={newFaq.answer}
                      onChange={(event) =>
                        setNewFaq((previous) => ({
                          ...previous,
                          answer: event.target.value,
                        }))
                      }
                      className="min-h-[160px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                      placeholder={t("enterAnswer")}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        {t("category")}
                      </label>
                      <input
                        type="text"
                        value={newFaq.category}
                        onChange={(event) =>
                          setNewFaq((previous) => ({
                            ...previous,
                            category: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                        placeholder="Website"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Visibility
                      </label>
                      <select
                        value={newFaq.visibility}
                        onChange={(event) =>
                          setNewFaq((previous) => ({
                            ...previous,
                            visibility: event.target.value as FaqVisibility,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                      >
                        <option value="public">Public</option>
                        <option value="staff">Staff</option>
                        <option value="internal">Internal</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Language
                      </label>
                      <input
                        type="text"
                        value={newFaq.language}
                        onChange={(event) =>
                          setNewFaq((previous) => ({
                            ...previous,
                            language: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none transition focus:border-blue-400"
                        placeholder="en"
                        maxLength={5}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={submittingFaq}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#003566] px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-colors hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submittingFaq ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : null}
                      {t("addFaq")}
                    </button>
                    <p className="text-xs text-slate-500">
                      This saves directly into the FAQ database and indexes it for chat grounding.
                    </p>
                  </div>
                </form>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-violet-600">
                  Knowledge Upload
                </p>
                <h2 className="mt-2 text-2xl font-serif text-[#003566]">
                  Upload files to generate FAQs
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Upload PDFs, DOCX, CSV, XLSX, TXT, or Markdown. The system extracts text, generates Q&amp;A suggestions, and lets your team approve them before they go live.
                </p>
              </div>

              <form onSubmit={handleUploadDocument} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Document
                  </label>
                  <input
                    key={uploadInputKey}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.csv,.txt,.md"
                    onChange={(event) =>
                      setUploadForm((previous) => ({
                        ...previous,
                        file: event.target.files?.[0] ?? null,
                      }))
                    }
                    className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#003566] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Category
                    </label>
                    <input
                      type="text"
                      value={uploadForm.category}
                      onChange={(event) =>
                        setUploadForm((previous) => ({
                          ...previous,
                          category: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                      placeholder="Website"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Visibility
                    </label>
                    <select
                      value={uploadForm.visibility}
                      onChange={(event) =>
                        setUploadForm((previous) => ({
                          ...previous,
                          visibility: event.target.value as FaqVisibility,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                    >
                      <option value="public">Public</option>
                      <option value="staff">Staff</option>
                      <option value="internal">Internal</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Language
                    </label>
                    <input
                      type="text"
                      value={uploadForm.language}
                      onChange={(event) =>
                        setUploadForm((previous) => ({
                          ...previous,
                          language: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none transition focus:border-blue-400"
                      placeholder="en"
                      maxLength={5}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={uploadingDocument}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingDocument ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <UploadCloud size={14} />
                    )}
                    Upload document
                  </button>
                  <p className="text-xs text-slate-500">
                    Upload for {selectedLocationName}. Use visibility <span className="font-semibold text-slate-700">Public</span> for content the website chat is allowed to answer from.
                  </p>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-600">
                Review Queue
              </p>
              <h2 className="mt-2 text-2xl font-serif text-[#003566]">
                Pending knowledge items
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Review the generated Q&amp;A items before they become live FAQ entries for the chat widget.
              </p>
            </div>
            <div className="rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
              {pendingReviewCount} pending for {selectedLocationName}
            </div>
          </div>

          {pendingItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No pending knowledge items.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Upload a document and new Q&amp;A suggestions will appear here for review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingItems.map((item) => {
                const draft = itemDrafts[item.id] ?? createItemDraft(item);
                const isBusy = reviewingItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClassesForStatus(item.status)}`}
                      >
                        {item.status}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClassesForVisibility(draft.visibility)}`}
                      >
                        {draft.visibility}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                        {item.source_type}
                      </span>
                      <span className="text-xs text-slate-400">
                        {item.document?.file_name || "Generated item"} • {formatDate(item.created_at, locale)}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                          {t("question")}
                        </label>
                        <input
                          type="text"
                          value={draft.question}
                          onChange={(event) =>
                            updateItemDraft(item.id, {
                              question: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                          {t("answer")}
                        </label>
                        <textarea
                          value={draft.answer}
                          onChange={(event) =>
                            updateItemDraft(item.id, {
                              answer: event.target.value,
                            })
                          }
                          className="min-h-[150px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {t("category")}
                          </label>
                          <input
                            type="text"
                            value={draft.category}
                            onChange={(event) =>
                              updateItemDraft(item.id, {
                                category: event.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            Visibility
                          </label>
                          <select
                            value={draft.visibility}
                            onChange={(event) =>
                              updateItemDraft(item.id, {
                                visibility: event.target.value as FaqVisibility,
                              })
                            }
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                          >
                            <option value="public">Public</option>
                            <option value="staff">Staff</option>
                            <option value="internal">Internal</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            Language
                          </label>
                          <input
                            type="text"
                            value={draft.language}
                            onChange={(event) =>
                              updateItemDraft(item.id, {
                                language: event.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none transition focus:border-blue-400"
                            placeholder="en"
                            maxLength={5}
                          />
                        </div>
                      </div>

                      {item.source_excerpt ? (
                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            Source excerpt
                          </p>
                          <p className="text-sm leading-6 text-slate-600">
                            {item.source_excerpt}
                          </p>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleReviewItem(item, "approved")}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <ShieldCheck size={14} />
                          )}
                          Approve
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleReviewItem(item, "declined")}
                          disabled={isBusy}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Decline
                        </button>

                        {item.approved_faq?.id ? (
                          <p className="text-xs text-slate-500">
                            Already linked to FAQ #{item.approved_faq.id}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Approval will create or update a searchable FAQ entry for this location.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-violet-600">
              Uploaded Files
            </p>
            <h2 className="mt-2 text-2xl font-serif text-[#003566]">
              Recent knowledge documents
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              These files were uploaded for {selectedLocationName}. Their generated FAQ suggestions appear in the review queue above.
            </p>
          </div>

          {documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No documents uploaded yet.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Upload a file to start building FAQ knowledge from your website content.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {documents.map((knowledgeDocument) => (
                <div
                  key={knowledgeDocument.id}
                  className="rounded-2xl border border-slate-200 p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClassesForStatus(knowledgeDocument.status)}`}
                    >
                      {knowledgeDocument.status}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClassesForVisibility(knowledgeDocument.visibility)}`}
                    >
                      {knowledgeDocument.visibility}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                      {knowledgeDocument.source_type}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-800">
                    {knowledgeDocument.file_name}
                  </h3>

                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm text-slate-500">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Category
                      </p>
                      <p className="mt-1 font-medium text-slate-700">
                        {knowledgeDocument.category || "Website"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Generated Q&amp;A
                      </p>
                      <p className="mt-1 font-medium text-slate-700">
                        {knowledgeDocument.generated_qna_count ??
                          knowledgeDocument.items_count ??
                          0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Uploaded
                      </p>
                      <p className="mt-1 font-medium text-slate-700">
                        {formatDate(knowledgeDocument.created_at, locale)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Processed
                      </p>
                      <p className="mt-1 font-medium text-slate-700">
                        {formatDate(
                          knowledgeDocument.processed_at || knowledgeDocument.created_at,
                          locale,
                        )}
                      </p>
                    </div>
                  </div>

                  {knowledgeDocument.processing_error ? (
                    <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                      {knowledgeDocument.processing_error}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setFaqPage(1);
                setSelectedFaqIds([]);
                setExpandedFaqId(null);
                setEditingFaqId(null);
              }}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-[11px] font-bold uppercase tracking-[0.18em] outline-none transition focus:border-blue-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("all");
                setFaqPage(1);
                setSelectedFaqIds([]);
                setExpandedFaqId(null);
                setEditingFaqId(null);
              }}
              className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${
                selectedCategory === "all"
                  ? "bg-[#003566] text-white"
                  : "bg-white text-slate-500 hover:bg-slate-100"
              }`}
            >
              {t("all")}
            </button>

            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setSelectedCategory(category);
                  setFaqPage(1);
                  setSelectedFaqIds([]);
                  setExpandedFaqId(null);
                  setEditingFaqId(null);
                }}
                className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${
                  selectedCategory === category
                    ? "bg-blue-100 text-blue-700"
                    : "bg-white text-slate-500 hover:bg-slate-100"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">
              Live FAQ Index
            </p>
            <h2 className="mt-2 text-2xl font-serif text-[#003566]">
              FAQs available to your team
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Public chat answers are grounded from the public subset of these FAQs for the current location.
            </p>
          </div>

          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Showing {faqRangeStart}-{faqRangeEnd} of {faqListTotal} matching FAQs
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Page {faqPage} of {faqLastPage}
                {selectedFaqCount > 0 ? ` • ${selectedFaqCount} selected on this page` : ""}
              </p>
            </div>

            {canManage ? (
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={allFaqsOnPageSelected}
                    onChange={handleToggleSelectAllFaqs}
                    className="h-4 w-4 rounded border-slate-300 text-[#003566] focus:ring-[#003566]"
                  />
                  Select this page
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={bulkVisibility}
                    onChange={(event) =>
                      setBulkVisibility(event.target.value as FaqVisibility)
                    }
                    disabled={selectedFaqCount === 0 || bulkUpdatingVisibility || bulkDeletingFaqs}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="public">Set visibility: Public</option>
                    <option value="staff">Set visibility: Staff</option>
                    <option value="internal">Set visibility: Internal</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => void handleBulkUpdateVisibility()}
                    disabled={selectedFaqCount === 0 || bulkUpdatingVisibility || bulkDeletingFaqs}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#003566] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bulkUpdatingVisibility ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Apply
                  </button>

                  <button
                    type="button"
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={selectedFaqCount === 0 || bulkUpdatingVisibility || bulkDeletingFaqs}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete selected
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-[#003566]" />
              <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-slate-400">
                {t("loadingFaqs")}
              </p>
            </div>
          ) : faqs.length === 0 ? (
            <div className="py-16 text-center">
              <HelpCircle className="mx-auto text-slate-300" size={48} />
              <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-slate-400">
                {t("noFaqsFound")}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {t("tryDifferentSearch")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {faqs.map((faq) => {
                const isEditing = editingFaqId === faq.id;
                const isSaving = savingFaqId === faq.id;
                const faqDraft = faqDrafts[faq.id] ?? createFaqDraft(faq);

                return (
                  <div
                    key={faq.id}
                    className="overflow-hidden rounded-2xl border border-slate-200"
                  >
                    <div className="flex gap-4 px-5 py-5">
                      {canManage ? (
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={selectedFaqIds.includes(faq.id)}
                            onChange={() => handleToggleFaqSelection(faq.id)}
                            className="h-4 w-4 rounded border-slate-300 text-[#003566] focus:ring-[#003566]"
                            aria-label={`Select FAQ ${faq.question}`}
                          />
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedFaqId((current) => (current === faq.id ? null : faq.id))
                        }
                        className="min-w-0 flex-1 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                                {faq.category}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClassesForVisibility(faq.visibility)}`}
                              >
                                {faq.visibility}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                                {faq.source_type || "faq"}
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">
                              {faq.question}
                            </h3>
                            <p className="mt-2 text-xs text-slate-400">
                              Updated {formatDate(faq.updated_at, locale)}
                            </p>
                          </div>
                        </div>
                      </button>

                      {canManage ? (
                        <div className="flex shrink-0 items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleStartEditingFaq(faq)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100"
                            title="Edit FAQ"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setFaqToDelete(faq.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
                            title={t("deleteFaq")}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {expandedFaqId === faq.id ? (
                      <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                        {isEditing ? (
                          <div className="space-y-4">
                            <div>
                              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                {t("question")}
                              </label>
                              <input
                                type="text"
                                value={faqDraft.question}
                                onChange={(event) =>
                                  updateFaqDraft(faq.id, {
                                    question: event.target.value,
                                  })
                                }
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                {t("answer")}
                              </label>
                              <textarea
                                value={faqDraft.answer}
                                onChange={(event) =>
                                  updateFaqDraft(faq.id, {
                                    answer: event.target.value,
                                  })
                                }
                                className="min-h-[160px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                              />
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                              <div>
                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                  {t("category")}
                                </label>
                                <input
                                  type="text"
                                  value={faqDraft.category}
                                  onChange={(event) =>
                                    updateFaqDraft(faq.id, {
                                      category: event.target.value,
                                    })
                                  }
                                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                  Visibility
                                </label>
                                <select
                                  value={faqDraft.visibility}
                                  onChange={(event) =>
                                    updateFaqDraft(faq.id, {
                                      visibility: event.target.value as FaqVisibility,
                                    })
                                  }
                                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                                >
                                  <option value="public">Public</option>
                                  <option value="staff">Staff</option>
                                  <option value="internal">Internal</option>
                                </select>
                              </div>

                              <div>
                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                  Language
                                </label>
                                <input
                                  type="text"
                                  value={faqDraft.language}
                                  onChange={(event) =>
                                    updateFaqDraft(faq.id, {
                                      language: event.target.value,
                                    })
                                  }
                                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none transition focus:border-blue-400"
                                  placeholder="en"
                                  maxLength={5}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() => void handleSaveFaq(faq)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#003566] px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-colors hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSaving ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Save size={14} />
                                )}
                                Save changes
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelEditingFaq(faq)}
                                disabled={isSaving}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {t("cancel")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                            {faq.answer}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {faqListTotal > 0
                ? `Showing ${faqRangeStart}-${faqRangeEnd} of ${faqListTotal} matching FAQs.`
                : "No FAQs match the current filters."}
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFaqPage((current) => Math.max(1, current - 1))}
                disabled={faqPage <= 1 || refreshing}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-500">
                Page {faqPage} / {faqLastPage}
              </span>
              <button
                type="button"
                onClick={() => setFaqPage((current) => Math.min(faqLastPage, current + 1))}
                disabled={faqPage >= faqLastPage || refreshing}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-slate-200 pt-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            {t("support.title")}
          </p>
          <p className="mt-2 text-sm text-slate-600">{t("support.contact")}</p>
        </div>
      </div>

      <ConfirmDialog
        open={faqToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingFaq) {
            setFaqToDelete(null);
          }
        }}
        title={t("confirmDelete")}
        description={t("confirmDelete")}
        confirmText={t("deleteFaq")}
        cancelText={t("cancel")}
        variant="destructive"
        isLoading={deletingFaq}
        onConfirm={() => {
          if (faqToDelete !== null) {
            void handleDeleteFaq(faqToDelete);
          }
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open && !bulkDeletingFaqs) {
            setBulkDeleteOpen(false);
          }
        }}
        title="Delete selected FAQs?"
        description={`This will permanently remove ${selectedFaqCount} FAQ entr${selectedFaqCount === 1 ? "y" : "ies"} from this location.`}
        confirmText="Delete selected"
        cancelText={t("cancel")}
        variant="destructive"
        isLoading={bulkDeletingFaqs}
        onConfirm={() => {
          void handleBulkDeleteFaqs();
        }}
      />
    </div>
  );
}
