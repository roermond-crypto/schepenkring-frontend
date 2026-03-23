"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";
import {
  Brain,
  RefreshCw,
  FileText,
  Sparkles,
  AlertCircle,
  GitMerge,
  CheckCircle2,
  Clock3,
  Database,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { api } from "@/lib/api";
import { normalizeRole } from "@/lib/auth/roles";

type Overview = {
  documents_analyzed: number;
  total_qna: number;
  approved_knowledge: number;
  pending_review: number;
  missing_questions: number;
  suggested_improvements: number;
  duplicate_clusters: number;
};

type KnowledgeQuestion = {
  id: number;
  location_id: number;
  matched_faq_id: number | null;
  source_type: string;
  status: string;
  question: string;
  times_asked: number;
  confidence: string;
  first_seen_at: string;
  last_seen_at: string;
};

type Suggestion = {
  id: number;
  location_id: number;
  faq_id: number | null;
  question_id: number | null;
  approved_faq_id: number | null;
  type: string;
  status: string;
  title: string;
  source_type: string;
  question: string | null;
  current_answer: string | null;
  suggested_answer: string | null;
  summary: string | null;
  ai_score: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  faq?: {
    id: number;
    question: string;
  } | null;
};

type DocumentIntelligence = {
  documents: number;
  pending_document_reviews: number;
  approved_document_knowledge: number;
  detected_document_gaps: number;
};

type TrainingStatus = {
  vectors_stored: number;
  last_sync: string | null;
  pending_embeddings: number;
  failed_embeddings: number;
  pinecone_enabled: boolean;
};

type EvolutionPoint = {
  month: string;
  label: string;
  faqs_created: number;
  questions_captured: number;
  suggestions_approved: number;
};

type KnowledgeBrainResponse = {
  overview: Overview;
  missing_questions: KnowledgeQuestion[];
  suggested_improvements: Suggestion[];
  document_intelligence: DocumentIntelligence;
  training_status: TrainingStatus;
  evolution: EvolutionPoint[];
};

type SuggestionsResponse = {
  data: Suggestion[];
};

type LocationOption = {
  id: number;
  name: string;
  code?: string | null;
};

function getCurrentLocationId() {
  if (typeof window === "undefined") return null;
  const userDataRaw = localStorage.getItem("user_data");
  if (!userDataRaw) return null;

  try {
    const userData = JSON.parse(userDataRaw) as {
      location_id?: number | string;
      location?: { id?: number | string };
      client_location_id?: number | string;
    };

    const locationValue =
      userData.location_id ??
      userData.client_location_id ??
      userData.location?.id;

    if (locationValue === null || locationValue === undefined || locationValue === "") {
      return null;
    }

    const parsed = Number(locationValue);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function formatDate(value?: string | null, locale = "en") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMonthLabel(month: string, fallbackLabel: string, locale = "en") {
  const date = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return fallbackLabel;

  return new Intl.DateTimeFormat(
    locale === "nl"
      ? "nl-NL"
      : locale === "de"
        ? "de-DE"
        : locale === "fr"
          ? "fr-FR"
          : "en-US",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(date);
}

export default function KnowledgeBrainPage() {
  const params = useParams<{ role?: string }>();
  const role = normalizeRole(params?.role) ?? "admin";
  const locale = useLocale();
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsReady, setLocationsReady] = useState(false);
  const [locationsLoadFailed, setLocationsLoadFailed] = useState(false);
  const [dashboard, setDashboard] = useState<KnowledgeBrainResponse | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<number, string>>({});
  const [draftCategories, setDraftCategories] = useState<Record<number, string>>({});

  const copy = useMemo(() => {
    const isNl = locale === "nl";
    const isDe = locale === "de";
    const isFr = locale === "fr";

    if (isNl) {
      return {
        title: "Knowledge Brain",
        subtitle:
          "Laat AI hiaten signaleren, kennis voorstellen en documentinzichten verzamelen met admincontrole.",
        adminOnly: "Deze pagina is alleen beschikbaar voor admin.",
        refresh: "Knowledge Brain verversen",
        refreshing: "Verversen...",
        location: "Locatie",
        allSuggestions: "Alle suggesties",
        overview: "Kennisoverzicht",
        missingQuestions: "Ontbrekende vragen",
        improvements: "Voorgestelde verbeteringen",
        documentIntelligence: "Documentintelligentie",
        trainingStatus: "Trainingsstatus",
        pendingSuggestions: "Openstaande suggesties",
        evolution: "Kennisontwikkeling",
        approve: "Goedkeuren",
        decline: "Afwijzen",
        answer: "Antwoord",
        category: "Categorie",
        visibility: "Zichtbaarheid",
        internal: "Intern",
        loading: "Knowledge Brain laden...",
        noSuggestions: "Geen openstaande suggesties voor deze locatie.",
        noLocation: "Geen locatie geselecteerd.",
        refreshed: "Knowledge Brain ververst.",
        refreshFailed: "Verversen van Knowledge Brain mislukt.",
        loadFailed: "Knowledge Brain laden mislukt.",
        reviewFailed: "Beoordelen van suggestie mislukt.",
        reviewed: "Suggestie bijgewerkt.",
        vectors: "Opgeslagen vectoren",
        lastSync: "Laatste synchronisatie",
        pendingEmbeddings: "Openstaande embeddings",
        failedEmbeddings: "Mislukte embeddings",
        pineconeEnabled: "Pinecone ingeschakeld",
        documentsAnalyzed: "Documenten geanalyseerd",
        totalQna: "Totaal Q&A",
        approvedKnowledge: "Goedgekeurde kennis",
        pendingReview: "In afwachting van review",
        aiScore: "AI-score",
        evolutionSubtitle: "Groei van goedgekeurde FAQ's en suggestie-activiteit",
        overviewSubtitle: "AI-signaalsamenvatting voor deze locatie",
        documentSubtitle: "Documentextractie en kennishiaten",
        trainingSubtitle: "Pinecone-vectoren en embeddingstatus",
        duplicateClusters: "Dubbele clusters",
        documents: "Documenten",
        pendingReviews: "Openstaande reviews",
        detectedGaps: "Gedetecteerde hiaten",
        faqsCreated: "FAQ's",
        questionsCaptured: "Vragen",
        suggestionsApproved: "Goedgekeurd",
        yes: "Ja",
        no: "Nee",
        timesAsked: "keer gevraagd",
        confidence: "Confidence",
        source: "Bron",
        currentAnswer: "Huidig antwoord",
        suggestedAnswer: "Voorgesteld antwoord",
      };
    }

    if (isDe) {
      return {
        title: "Knowledge Brain",
        subtitle:
          "Lassen Sie KI Luecken erkennen, Wissen vorschlagen und Dokumenteinsichten sammeln, waehrend Admins die Kontrolle behalten.",
        adminOnly: "Diese Seite ist nur fuer Admin verfuegbar.",
        refresh: "Knowledge Brain aktualisieren",
        refreshing: "Aktualisieren...",
        location: "Standort",
        allSuggestions: "Alle Vorschlaege",
        overview: "Wissensuebersicht",
        missingQuestions: "Fehlende Fragen",
        improvements: "Vorgeschlagene Verbesserungen",
        documentIntelligence: "Dokumentenintelligenz",
        trainingStatus: "Trainingsstatus",
        pendingSuggestions: "Offene Vorschlaege",
        evolution: "Wissensentwicklung",
        approve: "Genehmigen",
        decline: "Ablehnen",
        answer: "Antwort",
        category: "Kategorie",
        visibility: "Sichtbarkeit",
        internal: "Intern",
        loading: "Knowledge Brain wird geladen...",
        noSuggestions: "Keine offenen Vorschlaege fuer diesen Standort.",
        noLocation: "Kein Standort ausgewaehlt.",
        refreshed: "Knowledge Brain aktualisiert.",
        refreshFailed: "Knowledge Brain konnte nicht aktualisiert werden.",
        loadFailed: "Knowledge Brain konnte nicht geladen werden.",
        reviewFailed: "Vorschlag konnte nicht geprueft werden.",
        reviewed: "Vorschlag aktualisiert.",
        vectors: "Gespeicherte Vektoren",
        lastSync: "Letzte Synchronisierung",
        pendingEmbeddings: "Ausstehende Embeddings",
        failedEmbeddings: "Fehlgeschlagene Embeddings",
        pineconeEnabled: "Pinecone aktiviert",
        documentsAnalyzed: "Dokumente analysiert",
        totalQna: "Gesamte Q&A",
        approvedKnowledge: "Freigegebenes Wissen",
        pendingReview: "Ausstehende Pruefung",
        aiScore: "AI-Score",
        evolutionSubtitle: "Wachstum freigegebener FAQs und Vorschlagsaktivitaet",
        overviewSubtitle: "Zusammenfassung der KI-Signale fuer diesen Standort",
        documentSubtitle: "Dokumentenextraktion und Wissensluecken",
        trainingSubtitle: "Pinecone-Vektor- und Embedding-Status",
        duplicateClusters: "Doppelte Cluster",
        documents: "Dokumente",
        pendingReviews: "Ausstehende Reviews",
        detectedGaps: "Erkannte Luecken",
        faqsCreated: "FAQs",
        questionsCaptured: "Fragen",
        suggestionsApproved: "Freigegeben",
        yes: "Ja",
        no: "Nein",
        timesAsked: "mal gefragt",
        confidence: "Confidence",
        source: "Quelle",
        currentAnswer: "Aktuelle Antwort",
        suggestedAnswer: "Vorgeschlagene Antwort",
      };
    }

    if (isFr) {
      return {
        title: "Knowledge Brain",
        subtitle:
          "Laissez l'IA detecter les manques, proposer des connaissances et analyser les documents, avec validation admin.",
        adminOnly: "Cette page est reservee aux admins.",
        refresh: "Rafraichir Knowledge Brain",
        refreshing: "Rafraichissement...",
        location: "Emplacement",
        allSuggestions: "Toutes les suggestions",
        overview: "Vue d'ensemble des connaissances",
        missingQuestions: "Questions manquantes",
        improvements: "Ameliorations suggerees",
        documentIntelligence: "Intelligence documentaire",
        trainingStatus: "Statut de formation",
        pendingSuggestions: "Suggestions en attente",
        evolution: "Evolution des connaissances",
        approve: "Approuver",
        decline: "Refuser",
        answer: "Reponse",
        category: "Categorie",
        visibility: "Visibilite",
        internal: "Interne",
        loading: "Chargement du Knowledge Brain...",
        noSuggestions: "Aucune suggestion en attente pour cet emplacement.",
        noLocation: "Aucun emplacement selectionne.",
        refreshed: "Knowledge Brain rafraichi.",
        refreshFailed: "Echec du rafraichissement du Knowledge Brain.",
        loadFailed: "Echec du chargement du Knowledge Brain.",
        reviewFailed: "Echec de la revision de la suggestion.",
        reviewed: "Suggestion mise a jour.",
        vectors: "Vecteurs stockes",
        lastSync: "Derniere synchronisation",
        pendingEmbeddings: "Embeddings en attente",
        failedEmbeddings: "Embeddings echoues",
        pineconeEnabled: "Pinecone active",
        documentsAnalyzed: "Documents analyses",
        totalQna: "Total Q&R",
        approvedKnowledge: "Connaissance approuvee",
        pendingReview: "En attente de revision",
        aiScore: "Score IA",
        evolutionSubtitle: "Croissance des FAQ approuvees et de l'activite des suggestions",
        overviewSubtitle: "Resume des signaux IA pour cet emplacement",
        documentSubtitle: "Extraction documentaire et lacunes detectees",
        trainingSubtitle: "Etat des vecteurs et embeddings Pinecone",
        duplicateClusters: "Clusters en doublon",
        documents: "Documents",
        pendingReviews: "Revisions en attente",
        detectedGaps: "Lacunes detectees",
        faqsCreated: "FAQ",
        questionsCaptured: "Questions",
        suggestionsApproved: "Approuvees",
        yes: "Oui",
        no: "Non",
        timesAsked: "fois demandee",
        confidence: "Confidence",
        source: "Source",
        currentAnswer: "Reponse actuelle",
        suggestedAnswer: "Reponse suggeree",
      };
    }

    return {
      title: "Knowledge Brain",
      subtitle:
        "Let AI detect gaps, suggest knowledge, and analyze documents while admins stay in control.",
      adminOnly: "This page is only available to admin.",
      refresh: "Refresh Knowledge Brain",
      refreshing: "Refreshing...",
      location: "Location",
      allSuggestions: "All suggestions",
      overview: "Knowledge Overview",
      missingQuestions: "Missing Questions",
      improvements: "Suggested Improvements",
      documentIntelligence: "Document Intelligence",
      trainingStatus: "Training Status",
      pendingSuggestions: "Pending Suggestions",
      evolution: "Knowledge Evolution",
      approve: "Approve",
      decline: "Decline",
      answer: "Answer",
      category: "Category",
      visibility: "Visibility",
      internal: "Internal",
      loading: "Loading Knowledge Brain...",
      noSuggestions: "No pending suggestions for this location.",
      noLocation: "No location selected.",
      refreshed: "Knowledge Brain refreshed.",
      refreshFailed: "Failed to refresh Knowledge Brain.",
      loadFailed: "Failed to load Knowledge Brain.",
      reviewFailed: "Failed to review suggestion.",
      reviewed: "Suggestion updated.",
      vectors: "Vectors stored",
      lastSync: "Last sync",
      pendingEmbeddings: "Pending embeddings",
      failedEmbeddings: "Failed embeddings",
      pineconeEnabled: "Pinecone enabled",
      documentsAnalyzed: "Documents analyzed",
      totalQna: "Total Q&A",
      approvedKnowledge: "Approved knowledge",
      pendingReview: "Pending review",
      aiScore: "AI score",
      evolutionSubtitle: "Growth of approved FAQ and suggestion activity",
      overviewSubtitle: "AI signal summary for this location",
      documentSubtitle: "Document extraction and gap signals",
      trainingSubtitle: "Pinecone vector and embedding state",
      duplicateClusters: "Duplicate clusters",
      documents: "Documents",
      pendingReviews: "Pending reviews",
      detectedGaps: "Detected gaps",
      faqsCreated: "FAQs",
      questionsCaptured: "Questions",
      suggestionsApproved: "Approved",
      yes: "Yes",
      no: "No",
      timesAsked: "times asked",
      confidence: "Confidence",
      source: "Source",
      currentAnswer: "Current answer",
      suggestedAnswer: "Suggested answer",
    };
  }, [locale]);

  const brainUiCopy = useMemo(() => {
    if (locale === "nl") {
      return {
        statusActive: "Actief",
        statusEmpty: "Leeg",
        statusUnavailable: "Niet geconfigureerd",
        noLocationsTitle: "Knowledge Brain is nog niet gekoppeld aan een adminlocatie.",
        noLocationsDescription:
          "Er zijn geen locaties beschikbaar om te beheren, dus deze pagina kan nog niets verversen of beoordelen.",
        emptyTitle: "Knowledge Brain is actief, maar er is nog geen kennisactiviteit voor deze locatie.",
        emptyDescription:
          "Zodra vragen, documenten of suggesties binnenkomen, kun je ze hier beoordelen en verbeteren.",
      };
    }

    if (locale === "de") {
      return {
        statusActive: "Aktiv",
        statusEmpty: "Leer",
        statusUnavailable: "Nicht konfiguriert",
        noLocationsTitle: "Knowledge Brain ist noch keiner Admin-Location zugeordnet.",
        noLocationsDescription:
          "Es stehen keine Standorte zur Verwaltung bereit, daher kann diese Seite noch nichts aktualisieren oder pruefen.",
        emptyTitle: "Knowledge Brain ist aktiv, aber fuer diesen Standort gibt es noch keine Wissenssignale.",
        emptyDescription:
          "Sobald Fragen, Dokumente oder Vorschlaege eintreffen, koennen sie hier geprueft und verbessert werden.",
      };
    }

    if (locale === "fr") {
      return {
        statusActive: "Actif",
        statusEmpty: "Vide",
        statusUnavailable: "Non configure",
        noLocationsTitle: "Knowledge Brain n'est pas encore relie a un emplacement admin.",
        noLocationsDescription:
          "Aucun emplacement n'est disponible a gerer, donc cette page ne peut encore rien rafraichir ni valider.",
        emptyTitle: "Knowledge Brain est actif, mais il n'y a pas encore de signaux de connaissance pour cet emplacement.",
        emptyDescription:
          "Des que des questions, documents ou suggestions arrivent, vous pourrez les examiner ici.",
      };
    }

    return {
      statusActive: "Active",
      statusEmpty: "Empty",
      statusUnavailable: "Not configured",
      noLocationsTitle: "Knowledge Brain is not connected to an admin location yet.",
      noLocationsDescription:
        "There are no locations available to manage, so this page cannot refresh or review anything yet.",
      emptyTitle: "Knowledge Brain is active, but this location has no knowledge activity yet.",
      emptyDescription:
        "As soon as questions, documents, or suggestions arrive, you can review and improve them here.",
    };
  }, [locale]);

  const loadLocations = useCallback(async () => {
    try {
      setLocationsLoadFailed(false);
      const response = await api.get<{ data?: LocationOption[] }>("/admin/locations");
      const nextLocations = Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setLocations(nextLocations);

      const currentLocationId = getCurrentLocationId();
      if (!selectedLocationId) {
        const fallbackLocationId =
          currentLocationId &&
          nextLocations.some((location) => location.id === currentLocationId)
            ? String(currentLocationId)
            : nextLocations[0]
              ? String(nextLocations[0].id)
              : "";
        setSelectedLocationId(fallbackLocationId);
      }
    } catch (error) {
      console.error("Failed to load locations for Knowledge Brain", error);
      setLocations([]);
      setLocationsLoadFailed(true);
    } finally {
      setLocationsReady(true);
    }
  }, [selectedLocationId]);

  const loadDashboard = useCallback(async () => {
    if (!selectedLocationId) return;
    setLoading(true);
    try {
      const [dashboardResponse, suggestionsResponse] = await Promise.all([
        api.get<KnowledgeBrainResponse>("/faqs/knowledge-brain", {
          params: { location_id: selectedLocationId },
        }),
        api.get<SuggestionsResponse>("/faqs/knowledge-brain/suggestions", {
          params: { location_id: selectedLocationId, status: "pending" },
        }),
      ]);

      setDashboard(dashboardResponse.data);
      const nextSuggestions = Array.isArray(suggestionsResponse.data?.data)
        ? suggestionsResponse.data.data
        : [];
      setSuggestions(nextSuggestions);
      setDraftAnswers(
        Object.fromEntries(
          nextSuggestions.map((suggestion) => [
            suggestion.id,
            suggestion.suggested_answer ?? suggestion.current_answer ?? "",
          ]),
        ),
      );
      setDraftCategories(
        Object.fromEntries(
          nextSuggestions.map((suggestion) => [
            suggestion.id,
            typeof suggestion.metadata?.category === "string"
              ? suggestion.metadata.category
              : "General",
          ]),
        ),
      );
    } catch (error) {
      console.error("Failed to load Knowledge Brain", error);
      toast.error(copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed, selectedLocationId]);

  useEffect(() => {
    if (role !== "admin") return;
    void loadLocations();
  }, [loadLocations, role]);

  useEffect(() => {
    if (role !== "admin" || !selectedLocationId) return;
    void loadDashboard();
  }, [loadDashboard, role, selectedLocationId]);

  const handleRefresh = async () => {
    if (!selectedLocationId) {
      toast.error(copy.noLocation);
      return;
    }

    setRefreshing(true);
    try {
      await api.post("/faqs/knowledge-brain/refresh", {
        location_id: Number(selectedLocationId),
      });
      toast.success(copy.refreshed);
      await loadDashboard();
    } catch (error) {
      console.error("Failed to refresh Knowledge Brain", error);
      toast.error(copy.refreshFailed);
    } finally {
      setRefreshing(false);
    }
  };

  const handleReviewSuggestion = async (
    suggestionId: number,
    status: "approved" | "declined",
  ) => {
    setReviewingId(suggestionId);
    try {
      const payload: Record<string, unknown> = { status };
      if (status === "approved") {
        payload.answer = draftAnswers[suggestionId] || "";
        payload.category = draftCategories[suggestionId] || "General";
        payload.visibility = "internal";
      }

      await api.patch(`/faqs/knowledge-brain/suggestions/${suggestionId}`, payload);
      toast.success(copy.reviewed);
      await loadDashboard();
    } catch (error) {
      console.error("Failed to review suggestion", error);
      toast.error(copy.reviewFailed);
    } finally {
      setReviewingId(null);
    }
  };

  if (role !== "admin") {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-700">
        {copy.adminOnly}
      </div>
    );
  }

  const overviewCards = dashboard
    ? [
        {
          label: copy.documentsAnalyzed,
          value: dashboard.overview.documents_analyzed,
          icon: FileText,
        },
        {
          label: copy.totalQna,
          value: dashboard.overview.total_qna,
          icon: Brain,
        },
        {
          label: copy.approvedKnowledge,
          value: dashboard.overview.approved_knowledge,
          icon: CheckCircle2,
        },
        {
          label: copy.pendingReview,
          value: dashboard.overview.pending_review,
          icon: Clock3,
        },
      ]
    : [];

  const knowledgeBrainState = !locationsReady
    ? "loading"
    : locations.length === 0 || locationsLoadFailed
      ? "unavailable"
      : dashboard &&
          dashboard.overview.documents_analyzed === 0 &&
          dashboard.overview.total_qna === 0 &&
          dashboard.overview.approved_knowledge === 0 &&
          dashboard.overview.pending_review === 0 &&
          dashboard.overview.missing_questions === 0 &&
          dashboard.overview.suggested_improvements === 0 &&
          dashboard.overview.duplicate_clusters === 0 &&
          dashboard.document_intelligence.documents === 0 &&
          dashboard.document_intelligence.pending_document_reviews === 0 &&
          dashboard.document_intelligence.approved_document_knowledge === 0 &&
          dashboard.document_intelligence.detected_document_gaps === 0 &&
          suggestions.length === 0
        ? "empty"
        : "active";

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <div className="rounded-[28px] border border-[#C9D8EE] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_38%),linear-gradient(135deg,#F7FBFF_0%,#EDF4FF_52%,#E4EEF9_100%)] p-8 text-[#0B1F3A] shadow-[0_20px_60px_rgba(15,39,74,0.10)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-blue-700">
              {copy.title}
            </p>
            <h1 className="mt-3 text-4xl font-serif italic sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
              {copy.subtitle}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  knowledgeBrainState === "active"
                    ? "bg-emerald-100 text-emerald-800"
                    : knowledgeBrainState === "empty"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-200 text-slate-700"
                }`}
              >
                {knowledgeBrainState === "active"
                  ? brainUiCopy.statusActive
                  : knowledgeBrainState === "empty"
                    ? brainUiCopy.statusEmpty
                    : brainUiCopy.statusUnavailable}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              disabled={locations.length === 0}
              className="h-12 min-w-[220px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400"
            >
              <option value="">{copy.allSuggestions}</option>
              {locations.map((location) => (
                <option key={location.id} value={String(location.id)}>
                  {location.name}
                  {location.code ? ` (${location.code})` : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing || !selectedLocationId || locations.length === 0}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#003566] px-5 text-sm font-semibold text-white transition hover:bg-[#0B4A8B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} size={16} />
              {refreshing ? copy.refreshing : copy.refresh}
            </button>
          </div>
        </div>
      </div>

      {locationsReady && locations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0B1F3A]">
            {brainUiCopy.noLocationsTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {brainUiCopy.noLocationsDescription}
          </p>
        </div>
      ) : loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
          {copy.loading}
        </div>
      ) : dashboard ? (
        <>
          {knowledgeBrainState === "empty" ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900 shadow-sm">
              <p className="font-semibold">{brainUiCopy.emptyTitle}</p>
              <p className="mt-2 text-amber-800">{brainUiCopy.emptyDescription}</p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => (
              <div
                key={card.label}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    {card.label}
                  </p>
                  <card.icon className="h-5 w-5 text-blue-600" />
                </div>
                <p className="mt-4 text-3xl font-black text-[#0B1F3A]">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <div>
                    <h2 className="text-xl font-bold text-[#0B1F3A]">{copy.pendingSuggestions}</h2>
                    <p className="text-sm text-slate-500">
                      {dashboard.overview.missing_questions} {copy.missingQuestions.toLowerCase()} •{" "}
                      {dashboard.overview.suggested_improvements} {copy.improvements.toLowerCase()}
                    </p>
                  </div>
                </div>

                {suggestions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
                    {copy.noSuggestions}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {suggestions.map((suggestion) => (
                      <article
                        key={suggestion.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                              {suggestion.type === "missing_question" ? (
                                <AlertCircle size={12} className="text-amber-500" />
                              ) : suggestion.type === "answer_improvement" ? (
                                <Wand2 size={12} className="text-violet-500" />
                              ) : (
                                <GitMerge size={12} className="text-blue-500" />
                              )}
                              {suggestion.title}
                            </div>
                            <h3 className="text-lg font-bold text-[#0B1F3A]">
                              {suggestion.question || suggestion.faq?.question || "—"}
                            </h3>
                            {suggestion.summary ? (
                              <p className="text-sm leading-6 text-slate-600">
                                {suggestion.summary}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                              <span>
                                {copy.source}: {suggestion.source_type}
                              </span>
                              {typeof suggestion.ai_score === "number" ? (
                                <span>
                                  {copy.aiScore}: {suggestion.ai_score}/100
                                </span>
                              ) : null}
                              <span>{formatDate(suggestion.created_at, locale)}</span>
                            </div>
                          </div>

                          <div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                              {copy.confidence}
                            </p>
                            <p className="mt-2 font-semibold text-slate-700">
                              {typeof suggestion.metadata?.times_asked === "number"
                                ? `${suggestion.metadata.times_asked} ${copy.timesAsked}`
                                : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                              {copy.currentAnswer}
                            </p>
                            <div className="min-h-[88px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                              {suggestion.current_answer || suggestion.suggested_answer || "—"}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                              {copy.answer}
                            </p>
                            <textarea
                              value={draftAnswers[suggestion.id] ?? ""}
                              onChange={(event) =>
                                setDraftAnswers((current) => ({
                                  ...current,
                                  [suggestion.id]: event.target.value,
                                }))
                              }
                              rows={4}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-blue-400"
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-semibold text-slate-500">
                              {copy.category}
                            </label>
                            <input
                              value={draftCategories[suggestion.id] ?? "General"}
                              onChange={(event) =>
                                setDraftCategories((current) => ({
                                  ...current,
                                  [suggestion.id]: event.target.value,
                                }))
                              }
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                            />
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                void handleReviewSuggestion(suggestion.id, "declined")
                              }
                              disabled={reviewingId === suggestion.id}
                              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                            >
                              {copy.decline}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleReviewSuggestion(suggestion.id, "approved")
                              }
                              disabled={reviewingId === suggestion.id}
                              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#003566] px-4 text-sm font-semibold text-white transition hover:bg-[#0B4A8B] disabled:opacity-60"
                            >
                              {reviewingId === suggestion.id ? (
                                <RefreshCw className="animate-spin" size={14} />
                              ) : (
                                <CheckCircle2 size={14} />
                              )}
                              {copy.approve}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <div>
                    <h2 className="text-xl font-bold text-[#0B1F3A]">{copy.evolution}</h2>
                    <p className="text-sm text-slate-500">
                      {copy.evolutionSubtitle}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {dashboard.evolution.map((point) => {
                    const total =
                      point.faqs_created +
                      point.questions_captured +
                      point.suggestions_approved;
                    return (
                      <div key={point.month} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold capitalize text-slate-700">
                            {formatMonthLabel(point.month, point.label, locale)}
                          </span>
                          <span className="text-slate-500">{total}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500"
                            style={{
                              width: `${Math.min(total * 8, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                          <span>{copy.faqsCreated}: {point.faqs_created}</span>
                          <span>{copy.questionsCaptured}: {point.questions_captured}</span>
                          <span>{copy.suggestionsApproved}: {point.suggestions_approved}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  <div>
                    <h2 className="text-xl font-bold text-[#0B1F3A]">{copy.overview}</h2>
                    <p className="text-sm text-slate-500">
                      {copy.overviewSubtitle}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.missingQuestions}</span>
                    <strong>{dashboard.overview.missing_questions}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.improvements}</span>
                    <strong>{dashboard.overview.suggested_improvements}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.duplicateClusters}</span>
                    <strong>{dashboard.overview.duplicate_clusters}</strong>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-emerald-500" />
                  <div>
                    <h2 className="text-xl font-bold text-[#0B1F3A]">{copy.documentIntelligence}</h2>
                    <p className="text-sm text-slate-500">
                      {copy.documentSubtitle}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.documents}</span>
                    <strong>{dashboard.document_intelligence.documents}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.pendingReviews}</span>
                    <strong>{dashboard.document_intelligence.pending_document_reviews}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.approvedKnowledge}</span>
                    <strong>{dashboard.document_intelligence.approved_document_knowledge}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.detectedGaps}</span>
                    <strong>{dashboard.document_intelligence.detected_document_gaps}</strong>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <Database className="h-5 w-5 text-blue-500" />
                  <div>
                    <h2 className="text-xl font-bold text-[#0B1F3A]">{copy.trainingStatus}</h2>
                    <p className="text-sm text-slate-500">
                      {copy.trainingSubtitle}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.vectors}</span>
                    <strong>{dashboard.training_status.vectors_stored}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.lastSync}</span>
                    <strong>{formatDate(dashboard.training_status.last_sync, locale)}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.pendingEmbeddings}</span>
                    <strong>{dashboard.training_status.pending_embeddings}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.failedEmbeddings}</span>
                    <strong>{dashboard.training_status.failed_embeddings}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>{copy.pineconeEnabled}</span>
                    <strong>
                      {dashboard.training_status.pinecone_enabled
                        ? copy.yes
                        : copy.no}
                    </strong>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
