"use client";

import { useState, useEffect, useCallback, useDeferredValue } from "react";
import { AxiosError } from "axios";
import {
  Search,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Bot,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
  Filter,
  BarChart,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { normalizeRole } from "@/lib/auth/roles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Faq {
  id: number;
  question: string;
  answer: string;
  category: string;
  views: number;
  helpful: number;
  not_helpful: number;
  created_at: string;
  updated_at: string;
}

interface FaqStats {
  total_faqs: number;
  total_views: number;
  total_helpful: number;
  categories?: string[];
}

interface FaqResponse {
  data?: Faq[];
  faqs?: { data?: Faq[] } | Faq[];
  categories?: string[];
}

interface AiAnswerResponse {
  answer: string;
  sources: number;
  timestamp: string;
}

interface LocationOption {
  id: number;
  name: string;
}

type ApiErrorResponse = {
  message?: string;
};

function extractFaqItems(payload?: FaqResponse["faqs"]): Faq[] {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : (payload.data ?? []);
}

function extractFaqResponseItems(payload?: FaqResponse): Faq[] {
  if (!payload) return [];
  if (Array.isArray(payload.data)) return payload.data;
  return extractFaqItems(payload.faqs);
}

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

export default function FAQPage() {
  const params = useParams<{ role?: string }>();
  const t = useTranslations("DashboardFaq");
  const locale = useLocale();
  const role = normalizeRole(params?.role) ?? "admin";
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [categories, setCategories] = useState<string[]>([
    "General",
    "Booking",
    "Technical",
    "Payment",
  ]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState<{
    question: string;
    answer: string;
    sources: number;
    timestamp: string;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [stats, setStats] = useState<FaqStats | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFaq, setNewFaq] = useState({
    question: "",
    answer: "",
    category: "General",
    location_id: "",
  });
  const [isAdmin, setIsAdmin] = useState(role === "admin");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [faqToDelete, setFaqToDelete] = useState<number | null>(null);
  const [deletingFaq, setDeletingFaq] = useState(false);

  const checkAdminStatus = useCallback(() => {
    setIsAdmin(role === "admin");

    const userData = localStorage.getItem("user_data");
    if (!userData) return;

    try {
      const parsed = JSON.parse(userData) as {
        role?: string | null;
        userType?: string | null;
        type?: string | null;
      };

      const storedRole =
        normalizeRole(parsed.role) ||
        normalizeRole(parsed.userType) ||
        normalizeRole(parsed.type);

      if (storedRole) {
        setIsAdmin(storedRole === "admin");
      }
    } catch (error) {
      console.error("Failed to parse stored FAQ user_data:", error);
    }
  }, [role]);

  const fetchFaqs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("locale", locale);
      if (selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      if (deferredSearchQuery) {
        params.append("search", deferredSearchQuery);
      }

      const response = await api.get<FaqResponse>(`/faqs?${params.toString()}`);
      setFaqs(extractFaqResponseItems(response.data));
      setCategories(
        response.data.categories || [
          "General",
          "Booking",
          "Technical",
          "Payment",
        ],
      );
    } catch (error: unknown) {
      console.error("Error fetching FAQs:", error);
      toast.error(t("toastFailedLoad"));
    } finally {
      setLoading(false);
    }
  }, [deferredSearchQuery, locale, selectedCategory, t]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get<FaqStats>("/faqs/stats");
      setStats(response.data);
    } catch (error: unknown) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await api.get("/public/locations");
      const list = (
        Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.data)
            ? response.data.data
            : []
      ) as LocationOption[];
      setLocations(list);

      const currentLocationId = getCurrentLocationId();
      if (list.length > 0) {
        const fallbackLocationId =
          currentLocationId &&
          list.some((location) => location.id === currentLocationId)
            ? String(currentLocationId)
            : String(list[0].id);

        setNewFaq((prev) =>
          prev.location_id
            ? prev
            : { ...prev, location_id: fallbackLocationId },
        );
      }
    } catch (error: unknown) {
      console.error("Error fetching FAQ locations:", error);
      setLocations([]);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, []);

  useEffect(() => {
    fetchStats();
    checkAdminStatus();
    fetchLocations();
  }, []);

  const askGemini = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;

    setAiLoading(true);
    try {
      const response = await api.post<AiAnswerResponse>("/faqs/ask-gemini", {
        question: aiQuery,
      });

      setAiAnswer({
        question: aiQuery,
        answer: response.data.answer,
        sources: response.data.sources,
        timestamp: response.data.timestamp,
      });

      setAiQuery("");
      toast.success(t("toastAiAnswered"));
    } catch (error: unknown) {
      console.error("Error asking Gemini:", error);
      toast.error(t("toastFailedAi"));
    } finally {
      setAiLoading(false);
    }
  };

  const rateHelpful = async (id: number) => {
    try {
      await api.post(`/faqs/${id}/rate-helpful`);
      fetchFaqs();
      toast.success(t("toastThanksFeedback"));
    } catch (error: unknown) {
      console.error("Error rating:", error);
    }
  };

  const rateNotHelpful = async (id: number) => {
    try {
      await api.post(`/faqs/${id}/rate-not-helpful`);
      fetchFaqs();
      toast.success(t("toastThanksFeedback"));
    } catch (error: unknown) {
      console.error("Error rating:", error);
    }
  };

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    const locationId = Number(newFaq.location_id);

    if (!Number.isFinite(locationId) || locationId <= 0) {
      toast.error("Select a location first.");
      return;
    }

    try {
      await api.post("/faqs", {
        ...newFaq,
        location_id: locationId,
      });

      toast.success(t("toastFaqAdded"));
      setNewFaq((prev) => ({
        question: "",
        answer: "",
        category: "General",
        location_id: prev.location_id,
      }));
      setShowAddForm(false);
      fetchFaqs();
      fetchStats();
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as ApiErrorResponse | undefined)?.message
          : undefined;
      toast.error(message || t("toastFailedAdd"));
    }
  };

  const handleDeleteFaq = async (id: number) => {
    try {
      setDeletingFaq(true);
      await api.delete(`/faqs/${id}`);

      toast.success(t("toastFaqDeleted"));
      setFaqToDelete(null);
      fetchFaqs();
      fetchStats();
    } catch {
      toast.error(t("toastFailedDelete"));
    } finally {
      setDeletingFaq(false);
    }
  };

  const trainGemini = async () => {
    try {
      await api.get("/faqs/train-gemini");
      toast.success(t("toastAiTrained"));
    } catch {
      toast.error(t("toastFailedTrain"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 p-6">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif italic text-[#003566]">
              {t("title")}
            </h1>
            <p className="text-[10px] uppercase tracking-[0.4em] text-blue-600 font-black mt-2">
              {t("subtitle", { count: stats?.total_faqs || 0 })}
            </p>
          </div>

          {isAdmin && (
            <div className="flex gap-4 mt-4 md:mt-0">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-emerald-600 text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-colors"
              >
                <Plus size={14} /> {t("addFaq")}
              </button>
              <button
                onClick={trainGemini}
                className="bg-purple-600 text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-purple-700 transition-colors"
              >
                <RefreshCw size={14} /> {t("trainAi")}
              </button>
            </div>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div className="bg-white p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <HelpCircle className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-widest text-slate-400 font-black">
                    {t("totalFaqs")}
                  </p>
                  <p className="text-2xl font-serif text-[#003566]">
                    {stats.total_faqs}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <BarChart className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-widest text-slate-400 font-black">
                    {t("totalViews")}
                  </p>
                  <p className="text-2xl font-serif text-[#003566]">
                    {stats.total_views}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <ThumbsUp className="text-emerald-600" size={20} />
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-widest text-slate-400 font-black">
                    {t("helpfulVotes")}
                  </p>
                  <p className="text-2xl font-serif text-[#003566]">
                    {stats.total_helpful}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Filter className="text-amber-600" size={20} />
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-widest text-slate-400 font-black">
                    {t("categories")}
                  </p>
                  <p className="text-2xl font-serif text-[#003566]">
                    {stats.categories?.length || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 p-8 mb-10 shadow-lg rounded-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <Bot className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-serif text-[#003566]">
                {t("askAssistant")}
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                {t("trainedOn", { count: stats?.total_faqs || 0 })}
              </p>
            </div>
          </div>

          <form onSubmit={askGemini} className="mb-8">
            <div className="relative">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder={t("placeholderAsk")}
                className="w-full border-2 border-slate-200 p-4 text-sm font-medium outline-none focus:border-blue-400 pr-32 placeholder:text-slate-400"
                disabled={aiLoading}
              />
              <button
                type="submit"
                disabled={aiLoading || !aiQuery.trim()}
                className="absolute right-2 top-2 bg-[#003566] text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-blue-900 transition-colors"
              >
                {aiLoading ? t("thinking") : t("askAi")}
              </button>
            </div>
          </form>

          {aiAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-50 border border-blue-200 p-6 rounded-lg"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-blue-600 font-black">
                    {t("aiAnswer")}
                  </p>
                  <p className="text-sm text-slate-700 mt-2 font-medium">
                    {aiAnswer.question}
                  </p>
                </div>
                <button
                  onClick={() => setAiAnswer(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="bg-white p-4 border border-slate-100 rounded-md">
                <p className="text-slate-700 whitespace-pre-wrap">
                  {aiAnswer.answer}
                </p>
              </div>
              <div className="mt-4">
                <p className="text-[8px] text-slate-400">
                  {t("sources")}: {aiAnswer.sources} FAQs • Gemini Pro •{" "}
                  {aiAnswer.timestamp}
                </p>
              </div>
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {showAddForm && isAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white border border-slate-200 p-8 mb-10 overflow-hidden rounded-lg shadow-lg"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif text-[#003566]">
                  {t("addNewFaq")}
                </h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddFaq} className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-slate-600 font-black block mb-2">
                    {t("question")}
                  </label>
                  <input
                    type="text"
                    value={newFaq.question}
                    onChange={(e) =>
                      setNewFaq({ ...newFaq, question: e.target.value })
                    }
                    className="w-full border border-slate-200 p-3 text-sm outline-none focus:border-blue-400 rounded"
                    placeholder={t("enterQuestion")}
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-slate-600 font-black block mb-2">
                    {t("answer")}
                  </label>
                  <textarea
                    value={newFaq.answer}
                    onChange={(e) =>
                      setNewFaq({ ...newFaq, answer: e.target.value })
                    }
                    className="w-full border border-slate-200 p-4 text-sm outline-none focus:border-blue-400 min-h-[150px] rounded"
                    placeholder={t("enterAnswer")}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-slate-600 font-black block mb-2">
                      {t("category")}
                    </label>
                    <select
                      value={newFaq.category}
                      onChange={(e) =>
                        setNewFaq({ ...newFaq, category: e.target.value })
                      }
                      className="w-full border border-slate-200 p-3 text-sm outline-none rounded"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-slate-600 font-black block mb-2">
                      Location
                    </label>
                    <select
                      value={newFaq.location_id}
                      onChange={(e) =>
                        setNewFaq({ ...newFaq, location_id: e.target.value })
                      }
                      className="w-full border border-slate-200 p-3 text-sm outline-none rounded"
                      required
                    >
                      <option value="" disabled>
                        Select location
                      </option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end gap-4">
                    <button
                      type="submit"
                      className="bg-[#003566] text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-blue-900 transition-colors rounded"
                    >
                      {t("addFaq")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-widest"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col md:flex-row gap-4 mb-10">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full bg-white border border-slate-200 pl-12 pr-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-blue-400 rounded"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest border transition-all rounded ${
                selectedCategory === "all"
                  ? "bg-[#003566] text-white border-[#003566]"
                  : "bg-white text-slate-400 border-slate-200 hover:border-blue-400"
              }`}
            >
              {t("all")}
            </button>

            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest border transition-all rounded ${
                  selectedCategory === category
                    ? "bg-blue-100 text-blue-700 border-blue-300"
                    : "bg-white text-slate-400 border-slate-200 hover:border-blue-400"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003566] mx-auto"></div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-4">
              {t("loadingFaqs")}
            </p>
          </div>
        ) : faqs.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-lg">
            <HelpCircle className="mx-auto text-slate-300" size={48} />
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-4">
              {t("noFaqsFound")}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {t("tryDifferentSearch")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {faqs.map((faq) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200 hover:border-blue-200 transition-all rounded-lg overflow-hidden"
              >
                <div
                  className="p-6 cursor-pointer flex justify-between items-start"
                  onClick={() =>
                    setExpandedId(expandedId === faq.id ? null : faq.id)
                  }
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="bg-blue-100 text-blue-700 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                        {faq.category}
                      </span>
                      <span className="text-[8px] text-slate-400">
                        {faq.views} views • {faq.helpful || 0} helpful
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-slate-800">
                      {faq.question}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFaqToDelete(faq.id);
                        }}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title={t("deleteFaq")}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <div className="text-slate-400">
                      {expandedId === faq.id ? (
                        <ChevronUp size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === faq.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                        <div className="text-slate-700 mb-6 whitespace-pre-wrap">
                          {faq.answer}
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex gap-4">
                            <button
                              onClick={() => rateHelpful(faq.id)}
                              className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-[10px] font-black uppercase tracking-widest"
                            >
                              <ThumbsUp size={14} /> {t("helpful")} (
                              {faq.helpful || 0})
                            </button>
                            <button
                              onClick={() => rateNotHelpful(faq.id)}
                              className="flex items-center gap-2 text-amber-600 hover:text-amber-700 text-[10px] font-black uppercase tracking-widest"
                            >
                              <ThumbsDown size={14} /> {t("notHelpful")} (
                              {faq.not_helpful || 0})
                            </button>
                          </div>

                          <p className="text-[8px] text-slate-400">
                            {t("added")}{" "}
                            {new Date(faq.created_at).toLocaleDateString(
                              locale,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-20 pt-10 border-t border-slate-200 text-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
            {t("support.title")}
          </p>
          <p className="text-sm text-slate-600 mt-2">{t("support.contact")}</p>
        </div>
      </div>
      <ConfirmDialog
        open={faqToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingFaq) setFaqToDelete(null);
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
    </div>
  );
}
