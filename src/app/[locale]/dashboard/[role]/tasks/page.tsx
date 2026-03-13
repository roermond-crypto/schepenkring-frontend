"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Plus,
  User as UserIcon,
  X,
  Trash2,
  Search,
  Loader2,
  Bell,
  Calendar as CalendarIcon,
  Eye,
  EyeOff,
  List,
  CalendarDays,
  AlertTriangle,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Shield,
  Info,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Paperclip,
  MessageSquare,
  Download,
  Image as ImageIcon,
  Maximize2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import DynamicKanbanBoard from "./DynamicKanbanBoard";
import { normalizeRole } from "@/lib/auth/roles";
import {
  getBoardColumnDisplayName,
  getBoardStatusForColumn,
  resolveBoardColumnId,
} from "./board-utils";

// ============================================
// INTERFACES
// ============================================
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  priority: "Low" | "Medium" | "High";
  status: string;
  due_date: string;
  reminder_at?: string | null;
  reminder_sent_at?: string | null;
  assigned_to?: number;
  assigned_to_user?: User;
  type: "assigned" | "personal";
  assignment_status?: "pending" | "accepted" | "rejected";
  user_id?: number;
  created_by?: number;
  created_by_user?: User;
  created_at: string;
  updated_at: string;
  column_id?: number | null;
  position?: number;
  yacht_id?: number | null;
  yacht?: { id: number; boat_name: string };
}

interface BoardColumn {
  id: number;
  board_id: number;
  name: string;
  position: number;
  location_id?: number;
}

interface BoardData {
  id: number;
  name?: string;
  columns: BoardColumn[];
}

interface TaskActivity {
  id: number | string;
  action?: string;
  description?: string;
  created_at: string;
  user?: { name?: string } | null;
}

interface TaskAttachment {
  id: number;
  file_name: string;
  file_path: string;
  created_at: string;
  user?: { name?: string } | null;
}

type TaskSubmitData = {
  title: string;
  description: string;
  priority: Task["priority"];
  status: Task["status"];
  column_id?: number;
  assigned_to: string | number | null;
  due_date: string;
  type: "assigned" | "personal";
  pendingAttachments?: File[];
};

type ViewMode = "list" | "calendar" | "board";
type StatusFilter = "all" | "To Do" | "In Progress" | "Done";
type PriorityFilter = "all" | "Low" | "Medium" | "High";
type TypeFilter = "all" | "assigned" | "personal";

function getStoredToken() {
  if (typeof window === "undefined") return null;

  const cookieToken = document.cookie
    .split("; ")
    .find((part) => part.startsWith("schepenkring_auth_token="))
    ?.split("=")[1];
  if (cookieToken) return decodeURIComponent(cookieToken);

  const authToken = localStorage.getItem("auth_token");
  if (authToken) return authToken;

  const adminToken = localStorage.getItem("admin_token");
  if (adminToken) return adminToken;

  const userDataRaw = localStorage.getItem("user_data");
  if (userDataRaw) {
    try {
      const userData = JSON.parse(userDataRaw);
      if (userData?.token) return userData.token;
    } catch {
      // Ignore malformed local storage payloads.
    }
  }

  return null;
}

function getLocalUserId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const rawSession = document.cookie
      .split("; ")
      .find((part) => part.startsWith("schepenkring_session="))
      ?.split("=")[1];

    if (rawSession) {
      let b64 = decodeURIComponent(rawSession)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      while (b64.length % 4) {
        b64 += "=";
      }
      const binStr = atob(b64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      const jsonStr = new TextDecoder().decode(bytes);
      const session = JSON.parse(jsonStr);
      if (session?.id != null) return String(session.id);
    }
  } catch (e) {
    // Ignore cookie parse failures
  }

  const ud = localStorage.getItem("user_data");
  if (!ud) return null;
  try {
    const u = JSON.parse(ud);
    const id = u.id ?? u.mainId;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
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
    };

    const locationValue =
      userData.location_id ?? userData.locationId ?? userData.location?.id;
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

function fromApiStatus(status: string | undefined): Task["status"] {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "new" || normalized === "pending") return "To Do";
  if (normalized === "in progress") return "In Progress";
  if (normalized === "done" || normalized === "completed") return "Done";
  return "To Do";
}

function toApiStatus(status: Task["status"]): string {
  if (status === "To Do") return "New";
  return status;
}

function resolveApiErrorMessage(
  error: unknown,
  t: (key: string) => string,
  fallbackKey: string,
) {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = error as {
      response?: { data?: { message?: string; error?: string } };
      message?: string;
    };
    const raw =
      maybeResponse.response?.data?.message ??
      maybeResponse.response?.data?.error ??
      maybeResponse.message;
    if (typeof raw === "string" && raw.trim()) {
      return raw.includes(".") ? t(raw) : raw;
    }
  }
  return t(fallbackKey);
}

// ============================================
// CALENDAR VIEW COMPONENT (shared)
// ============================================
interface CalendarViewProps {
  tasks: Task[];
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  onTaskClick?: (task: Task) => void;
}

function CalendarView({
  tasks,
  currentDate,
  setCurrentDate,
  onTaskClick,
}: CalendarViewProps) {
  const t = useTranslations("DashboardAdminTasks");
  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "High":
        return "#dc2626"; // Red for High
      case "Medium":
        return "#f59e0b"; // Amber for Medium
      case "Low":
        return "#3b82f6"; // Blue for Low
      default:
        return "#6b7280";
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { firstDay, lastDay, daysInMonth, startingDay };
  };

  const weekDays = [
    t("calendar.sun"),
    t("calendar.mon"),
    t("calendar.tue"),
    t("calendar.wed"),
    t("calendar.thu"),
    t("calendar.fri"),
    t("calendar.sat"),
  ];

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  };

  const prevMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const nextMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getTasksForDay = (day: number) => {
    const date = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date);
      return (
        taskDate.getDate() === day &&
        taskDate.getMonth() === currentDate.getMonth() &&
        taskDate.getFullYear() === currentDate.getFullYear()
      );
    });
  };

  const getCalendarGrid = () => {
    const { daysInMonth, startingDay } = getDaysInMonth(currentDate);
    const days = [];

    const prevMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      0,
    );
    const prevMonthDays = prevMonth.getDate();

    for (let i = 0; i < startingDay; i++) {
      days.push({
        day: prevMonthDays - startingDay + i + 1,
        isCurrentMonth: false,
        date: new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - 1,
          prevMonthDays - startingDay + i + 1,
        ),
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i),
      });
    }

    const totalCells = 42;
    for (let i = 1; days.length < totalCells; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          i,
        ),
      });
    }

    return days;
  };

  const calendarGrid = getCalendarGrid();
  const today = new Date();

  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <div className="flex items-center gap-4 mb-4 md:mb-0">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="text-slate-600" size={20} />
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
          >
            {t("calendar.today")}
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight className="text-slate-600" size={20} />
          </button>
          <h2 className="text-xl font-bold text-[#003566] ml-4">
            {getMonthName(currentDate)}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
        {weekDays.map((day) => (
          <div
            key={day}
            className="bg-slate-50 p-3 text-center text-sm font-medium text-slate-600"
          >
            {day}
          </div>
        ))}

        {calendarGrid.map(({ day, isCurrentMonth, date }, index) => {
          const dayTasks = isCurrentMonth ? getTasksForDay(day) : [];
          const isToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();

          return (
            <div
              key={index}
              className={cn(
                "min-h-[120px] bg-white p-2 border border-slate-100",
                !isCurrentMonth && "bg-slate-50",
                isToday && "bg-blue-50",
              )}
            >
              <div className="flex justify-between items-center mb-1">
                <span
                  className={cn(
                    "text-sm font-medium",
                    isCurrentMonth ? "text-slate-900" : "text-slate-400",
                    isToday && "text-blue-600 font-bold",
                  )}
                >
                  {day}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    {dayTasks.length}
                  </span>
                )}
              </div>

              <div className="space-y-1 max-h-20 overflow-y-auto">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="text-xs p-1 rounded border-l-2 cursor-pointer hover:opacity-90"
                    style={{
                      borderLeftColor: getPriorityColor(task.priority),
                      backgroundColor: `${getPriorityColor(task.priority)}10`,
                      color: getPriorityColor(task.priority),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick?.(task);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {task.priority === "High" && (
                        <AlertTriangle className="text-red-600" size={10} />
                      )}
                      {task.priority === "Medium" && (
                        <Shield className="text-amber-500" size={10} />
                      )}
                      {task.priority === "Low" && (
                        <Clock className="text-blue-500" size={10} />
                      )}
                      <span className="truncate">{task.title}</span>
                    </div>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-slate-500 text-center">
                    +{dayTasks.length - 3} {t("calendar.more")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-50"></div>
          <span className="text-sm text-slate-600">{t("calendar.today")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600"></div>
          <span className="text-sm text-slate-600">{t("priority.high")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-sm text-slate-600">{t("priority.medium")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-sm text-slate-600">{t("priority.low")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-sm text-slate-600">{t("status.done")}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TASK MODAL COMPONENT (Admin/Partner)
// ============================================
interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskSubmitData) => void;
  task?: Task;
  users: User[];
  columns?: BoardColumn[];
  preSelectedColId?: number;
}

function TaskModal({
  isOpen,
  onClose,
  onSubmit,
  task,
  users,
  columns,
  preSelectedColId,
}: TaskModalProps) {
  const t = useTranslations("DashboardAdminTasks");
  const canAssignToOtherUsers = users.length > 0;
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "Medium" as Task["priority"],
    status: "To Do" as string,
    column_id: undefined as number | undefined,
    assigned_to: "",
    due_date: new Date().toISOString().split("T")[0],
    type: "assigned" as "assigned" | "personal",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || "",
        description: task.description ?? task.title ?? "",
        priority: task.priority || "Medium",
        status: task.status || "To Do",
        column_id: task.column_id ?? preSelectedColId,
        assigned_to: task.assigned_to?.toString() || "",
        due_date: task.due_date
          ? task.due_date.split("T")[0]
          : new Date().toISOString().split("T")[0],
        type: task.type || "assigned",
      });
      setReminderAt(
        task.reminder_at
          ? new Date(task.reminder_at).toISOString().slice(0, 16)
          : "",
      );
      setPendingAttachments([]);
    } else {
      const currentId = getLocalUserId();
      setFormData({
        title: "",
        description: "",
        priority: "Medium",
        status: "To Do",
        column_id: preSelectedColId,
        assigned_to: currentId || "",
        due_date: new Date().toISOString().split("T")[0],
        type: canAssignToOtherUsers ? "assigned" : "personal",
      });
      setReminderAt("");
      setPendingAttachments([]);
    }
    setErrors({});
  }, [task, isOpen, preSelectedColId, canAssignToOtherUsers]);

  const API_BASE =
    typeof window !== "undefined" && window.location.hostname == "localhost"
      ? "http://localhost:8000/api"
      : "https://app.schepen-kring.nl/api";
  const getHeaders = () => {
    const token = getStoredToken();
    return { headers: token ? { Authorization: `Bearer ${token}` } : {} };
  };

  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [reminderAt, setReminderAt] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  useEffect(() => {
    if (task && isOpen) {
      setLoadingExtras(true);
      axios
        .get(`${API_BASE}/tasks/${task.id}/activities`, getHeaders())
        .then((res) => {
          setActivities(res.data.activities);
          setAttachments(res.data.attachments);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingExtras(false));
    } else {
      setActivities([]);
      setAttachments([]);
      setNewComment("");
    }
  }, [task, isOpen]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;
    try {
      const res = await axios.post(
        `${API_BASE}/tasks/${task.id}/comments`,
        { content: newComment },
        getHeaders(),
      );
      setActivities([res.data, ...activities]);
      setNewComment("");
      toast.success(t("toasts.commentAdded") || "Comment added");
    } catch (error) {
      toast.error(t("toasts.commentFailed") || "Failed to add comment");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!task) {
      setPendingAttachments((prev) => [...prev, file]);
      toast.success(t("toasts.fileAdded") || "Attachment staged for upload");
      // Reset input so the same file could be selected again if needed
      if (e.target) e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(
        `${API_BASE}/tasks/${task.id}/attachments`,
        formData,
        {
          headers: {
            ...getHeaders().headers,
            "Content-Type": "multipart/form-data",
          },
        },
      );
      setAttachments([res.data, ...attachments]);
      // Refresh activities to see the log
      const actRes = await axios.get(
        `${API_BASE}/tasks/${task.id}/activities`,
        getHeaders(),
      );
      setActivities(actRes.data.activities);
      toast.success(t("toasts.fileUploaded") || "File uploaded");
    } catch (error) {
      toast.error(t("toasts.uploadFailed") || "Failed to upload file");
    } finally {
      setUploading(false);
      // Reset input
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (
      !task ||
      !confirm(t("prompts.deleteAttachment") || "Delete attachment?")
    )
      return;
    try {
      await axios.delete(
        `${API_BASE}/tasks/${task.id}/attachments/${attachmentId}`,
        getHeaders(),
      );
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      const actRes = await axios.get(
        `${API_BASE}/tasks/${task.id}/activities`,
        getHeaders(),
      );
      setActivities(actRes.data.activities);
      toast.success(t("toasts.fileDeleted") || "File deleted");
    } catch (error) {
      toast.error(t("toasts.deleteFailed") || "Failed to delete file");
    }
  };

  const isImageFile = (fileName: string) =>
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName);

  const getStorageUrl = (filePath: string) => {
    const base =
      typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:8000"
        : "https://app.schepen-kring.nl";
    return `${base}/storage/${filePath}`;
  };

  const handlePasteImage = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;

    if (!task) {
      const newFile = new File([file], `pasted-image-${Date.now()}.png`, {
        type: file.type,
      });
      setPendingAttachments((prev) => [newFile, ...prev]);
      toast.success(t("toasts.fileAdded") || "Image staged for upload");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file, `pasted-image-${Date.now()}.png`);
      const res = await axios.post(
        `${API_BASE}/tasks/${task.id}/attachments`,
        fd,
        {
          headers: {
            ...getHeaders().headers,
            "Content-Type": "multipart/form-data",
          },
        },
      );
      setAttachments((prev) => [res.data, ...prev]);
      const actRes = await axios.get(
        `${API_BASE}/tasks/${task.id}/activities`,
        getHeaders(),
      );
      setActivities(actRes.data.activities);
      toast.success(t("toasts.fileUploaded") || "Image pasted & uploaded");
    } catch (error) {
      toast.error(t("toasts.uploadFailed") || "Failed to upload pasted image");
    } finally {
      setUploading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim())
      newErrors.description = t("validation.descriptionRequired");
    if (!formData.due_date)
      newErrors.due_date = t("validation.dueDateRequired");
    if (
      canAssignToOtherUsers &&
      formData.type === "assigned" &&
      !formData.assigned_to
    ) {
      newErrors.assigned_to = t("validation.assignEmployee");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const titleForApi =
      formData.title.trim() ||
      formData.description.trim().slice(0, 80) ||
      t("labels.task");
    const apiData = {
      ...formData,
      title: titleForApi,
      type: canAssignToOtherUsers ? formData.type : "personal",
      assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
      pendingAttachments: pendingAttachments,
    };
    onSubmit(apiData);
  };

  const handlePrioritySelect = (priority: Task["priority"]) => {
    setFormData((prev) => ({ ...prev, priority }));
  };

  const handleRescheduleTask = async () => {
    if (!task || !formData.due_date) return;

    setSavingReminder(true);
    try {
      const res = await axios.patch(
        `${API_BASE}/tasks/${task.id}/reschedule`,
        {
          due_date: formData.due_date,
          reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
        },
        getHeaders(),
      );

      setFormData((prev) => ({
        ...prev,
        due_date: res.data?.due_date || prev.due_date,
      }));
      setReminderAt(
        res.data?.reminder_at
          ? new Date(res.data.reminder_at).toISOString().slice(0, 16)
          : "",
      );
      toast.success("Task schedule updated");
    } catch (error) {
      toast.error("Failed to reschedule task");
    } finally {
      setSavingReminder(false);
    }
  };

  const handleSaveReminder = async () => {
    if (!task) return;

    setSavingReminder(true);
    try {
      const res = await axios.patch(
        `${API_BASE}/tasks/${task.id}/reminder`,
        {
          reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
        },
        getHeaders(),
      );

      setReminderAt(
        res.data?.reminder_at
          ? new Date(res.data.reminder_at).toISOString().slice(0, 16)
          : "",
      );
      toast.success(reminderAt ? "Reminder scheduled" : "Reminder cleared");
    } catch (error) {
      toast.error("Failed to update reminder");
    } finally {
      setSavingReminder(false);
    }
  };

  const handleSendReminderNow = async () => {
    if (!task) return;

    setSendingReminder(true);
    try {
      await axios.post(
        `${API_BASE}/tasks/${task.id}/remind`,
        {
          realtime: true,
          email: true,
        },
        getHeaders(),
      );
      toast.success("Reminder sent");
    } catch (error) {
      toast.error("Failed to send reminder");
    } finally {
      setSendingReminder(false);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "High":
        return <AlertTriangle className="text-red-500" size={20} />;
      case "Medium":
        return <Shield className="text-amber-500" size={20} />;
      case "Low":
        return <Info className="text-blue-500" size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-50 border-red-500 text-red-700";
      case "Medium":
        return "bg-amber-50 border-amber-500 text-amber-700";
      case "Low":
        return "bg-blue-50 border-blue-500 text-blue-700";
      default:
        return "bg-slate-50 border-slate-500 text-slate-700";
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-start justify-center pt-12 pb-6 px-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#f1f2f4] dark:bg-[#1d2125] rounded-xl shadow-2xl w-full max-w-[860px] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top color bar based on priority */}
        <div
          className={cn(
            "h-[6px] rounded-t-xl w-full",
            formData.priority === "High"
              ? "bg-gradient-to-r from-red-500 to-orange-500"
              : formData.priority === "Medium"
                ? "bg-gradient-to-r from-amber-400 to-yellow-500"
                : "bg-gradient-to-r from-blue-400 to-cyan-500",
          )}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute right-3 top-4 p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors z-10"
          aria-label={t("actions.close")}
        >
          <X className="text-slate-600 dark:text-slate-300" size={18} />
        </button>

        <form onSubmit={handleSubmit}>
          {/* Header / Title */}
          <div className="px-6 pt-5 pb-2">
            <input
              id="task-title"
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className={cn(
                "w-full bg-transparent text-[20px] font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none border-b-2 border-transparent focus:border-sky-500 transition-colors pb-1 pr-10",
                errors.title && "border-red-500",
              )}
              placeholder={t("placeholders.taskTitle")}
            />
          </div>

          {/* Trello-style Action Buttons Bar */}
          <div className="px-6 py-3 flex flex-wrap gap-2">
            {canAssignToOtherUsers ? (
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    type: prev.type === "assigned" ? "personal" : "assigned",
                  }))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#282e33] border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-[#333b44] transition-colors text-slate-700 dark:text-slate-300"
              >
                <UserIcon size={14} />
                {formData.type === "assigned"
                  ? t("type.assigned")
                  : t("type.personal")}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#282e33] border border-slate-200 dark:border-slate-700 rounded-md shadow-sm text-slate-700 dark:text-slate-300">
                <UserIcon size={14} />
                {t("type.personal")}
              </span>
            )}
            <div className="relative inline-flex">
              <CalendarIcon
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, due_date: e.target.value }))
                }
                className={cn(
                  "pl-8 pr-2 py-1.5 text-xs font-semibold bg-white dark:bg-[#282e33] border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-[#333b44] transition-colors text-slate-700 dark:text-slate-300 outline-none",
                  errors.due_date && "border-red-400",
                )}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            {task && (
              <>
                <div className="relative inline-flex">
                  <Clock
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                  <input
                    type="datetime-local"
                    value={reminderAt}
                    onChange={(e) => setReminderAt(e.target.value)}
                    className="pl-8 pr-2 py-1.5 text-xs font-semibold bg-white dark:bg-[#282e33] border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-[#333b44] transition-colors text-slate-700 dark:text-slate-300 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveReminder}
                  disabled={savingReminder}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#282e33] border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-[#333b44] transition-colors text-slate-700 dark:text-slate-300 disabled:opacity-50"
                >
                  {savingReminder ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Bell size={14} />
                  )}
                  {reminderAt ? "Save reminder" : "Clear reminder"}
                </button>
                <button
                  type="button"
                  onClick={handleRescheduleTask}
                  disabled={savingReminder}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#282e33] border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-[#333b44] transition-colors text-slate-700 dark:text-slate-300 disabled:opacity-50"
                >
                  {savingReminder ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CalendarIcon size={14} />
                  )}
                  Reschedule
                </button>
                <button
                  type="button"
                  onClick={handleSendReminderNow}
                  disabled={sendingReminder}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sky-600 border border-sky-700 rounded-md shadow-sm hover:bg-sky-500 transition-colors text-white disabled:opacity-50"
                >
                  {sendingReminder ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Bell size={14} />
                  )}
                  Remind now
                </button>
              </>
            )}
            {canAssignToOtherUsers && formData.type === "assigned" && (
              <select
                value={formData.assigned_to}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    assigned_to: e.target.value,
                  }))
                }
                className={cn(
                  "pl-3 pr-8 py-1.5 text-xs font-semibold bg-white dark:bg-[#282e33] border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-[#333b44] transition-colors text-slate-700 dark:text-slate-300 outline-none appearance-none",
                  errors.assigned_to && "border-red-400",
                )}
              >
                <option value="">{t("placeholders.selectUser")}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            )}
            <label
              htmlFor={`file-upload-${task?.id || "new"}`}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#282e33] border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-[#333b44] transition-colors text-slate-700 dark:text-slate-300 cursor-pointer",
                uploading && "opacity-50 cursor-not-allowed",
              )}
            >
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Paperclip size={14} />
              )}
              {t("modal.attachments")}
            </label>
            <input
              type="file"
              id={`file-upload-${task?.id || "new"}`}
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />

            {columns && columns.length > 0 && (
              <select
                value={formData.column_id || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    column_id: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  }))
                }
                className="pl-3 pr-8 py-1.5 text-xs font-semibold bg-white dark:bg-[#282e33] border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 dark:hover:bg-[#333b44] transition-colors text-slate-700 dark:text-slate-300 outline-none appearance-none"
              >
                <option value="">Column: Default</option>
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {getBoardColumnDisplayName(col.name, t)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Two-Column Body */}
          <div className="flex flex-col md:flex-row gap-0 border-t border-slate-200 dark:border-slate-700/50">
            {/* LEFT COLUMN — Card Details */}
            <div className="flex-1 p-6 space-y-6 md:border-r border-slate-200 dark:border-slate-700/50">
              {/* Labels / Priority */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Labels
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(["Low", "Medium", "High"] as const).map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => handlePrioritySelect(priority)}
                      className={cn(
                        "px-3 py-1 rounded-[4px] text-xs font-bold transition-all border-2",
                        formData.priority === priority
                          ? priority === "High"
                            ? "bg-red-500 text-white border-red-600 shadow-md shadow-red-500/25"
                            : priority === "Medium"
                              ? "bg-amber-400 text-amber-900 border-amber-500 shadow-md shadow-amber-400/25"
                              : "bg-blue-500 text-white border-blue-600 shadow-md shadow-blue-500/25"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-300 dark:hover:bg-slate-600",
                      )}
                    >
                      {t(`priority.${priority.toLowerCase()}`)}
                    </button>
                  ))}
                  {formData.type === "personal" && (
                    <span className="px-3 py-1 rounded-[4px] text-xs font-bold bg-violet-500 text-white">
                      {t("type.personal")}
                    </span>
                  )}
                </div>
              </div>

              {/* Status pills (when no columns) */}
              {(!columns || columns.length === 0) && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    {t("modal.status")}
                  </h4>
                  <div className="flex gap-2">
                    {(["To Do", "In Progress", "Done"] as const).map(
                      (status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, status }))
                          }
                          className={cn(
                            "px-3 py-1 rounded-[4px] text-xs font-bold transition-all",
                            formData.status === status
                              ? status === "Done"
                                ? "bg-emerald-500 text-white"
                                : status === "In Progress"
                                  ? "bg-amber-400 text-amber-900"
                                  : "bg-sky-500 text-white"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600",
                          )}
                        >
                          {t(
                            status === "To Do"
                              ? "status.todo"
                              : status === "In Progress"
                                ? "status.inProgress"
                                : "status.done",
                          )}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                  <ClipboardList size={14} /> {t("modal.description")}
                </h4>
                <div className="relative">
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    onPaste={handlePasteImage}
                    className="w-full px-4 py-3 bg-white dark:bg-[#22272b] border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm leading-relaxed resize-y"
                    placeholder={t("placeholders.description")}
                    rows={5}
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                    <ImageIcon size={10} /> Paste images here (Ctrl+V / ⌘V)
                  </p>
                </div>
                {errors.description && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Attachments */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <Paperclip size={14} /> {t("modal.attachments")}
                </h4>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  Files
                </p>
                {attachments.length > 0 || pendingAttachments.length > 0 ? (
                  <div className="space-y-2.5">
                    {/* Render existing attachments */}
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-3 bg-white dark:bg-[#22272b] border border-slate-200 dark:border-slate-600 rounded-lg group hover:border-slate-300 dark:hover:border-slate-500 transition-colors overflow-hidden"
                      >
                        {/* Thumbnail Preview */}
                        <div className="w-[88px] h-[64px] shrink-0 bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          {isImageFile(att.file_name) ? (
                            <img
                              src={getStorageUrl(att.file_path)}
                              alt={att.file_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                              <FileText size={24} />
                            </div>
                          )}
                        </div>
                        {/* File Info */}
                        <div className="flex-1 min-w-0 py-2">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {att.file_name}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            Added{" "}
                            {new Date(att.created_at).toLocaleString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              },
                            )}
                            {att.user?.name ? ` by ${att.user.name}` : ""}
                          </p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={getStorageUrl(att.file_path)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            title="Open"
                          >
                            <Maximize2 size={15} />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            title="More"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Render pending attachments */}
                    {pendingAttachments.map((att, idx) => (
                      <div
                        key={`pending-${idx}`}
                        className="flex items-center gap-3 bg-white dark:bg-[#22272b] border border-sky-300 dark:border-sky-600 rounded-lg group hover:border-sky-400 dark:hover:border-sky-500 transition-colors overflow-hidden relative"
                      >
                        <div className="w-[88px] h-[64px] shrink-0 bg-sky-50 dark:bg-sky-900/30 overflow-hidden flex items-center justify-center">
                          {isImageFile(att.name) ? (
                            <img
                              src={URL.createObjectURL(att)}
                              alt={att.name}
                              className="w-full h-full object-cover opacity-80"
                            />
                          ) : (
                            <FileText size={24} className="text-sky-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 py-2">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {att.name}
                          </p>
                          <p className="text-[11px] text-amber-500 font-medium">
                            Pending Upload upon saving...
                          </p>
                        </div>
                        <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAttachments((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            title="Remove pending file"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full m-2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                    No attachments yet. Click &quot;Attachment&quot; above or
                    paste images to add files.
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN — Comments and Activity */}
            <div className="w-full md:w-[320px] shrink-0 p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[12px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <MessageSquare size={15} /> Comments and activity
                </h4>
              </div>

              {/* Comment Input */}
              {task && (
                <div className="mb-4">
                  <div className="flex gap-2 items-start">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0 text-white text-xs font-bold mt-0.5">
                      You
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onPaste={handlePasteImage}
                        placeholder={t("placeholders.addComment")}
                        className="w-full px-3 py-2 bg-white dark:bg-[#22272b] border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                      />
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <ImageIcon size={10} /> Paste images (⌘V)
                        </p>
                        {newComment.trim() && (
                          <button
                            type="button"
                            onClick={handleAddComment}
                            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded transition-colors"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Feed */}
              <div className="flex-1 overflow-y-auto max-h-[380px] space-y-4 pr-1 custom-scrollbar">
                {loadingExtras ? (
                  <div className="flex justify-center py-8">
                    <Loader2
                      size={20}
                      className="animate-spin text-slate-400"
                    />
                  </div>
                ) : task && activities.length > 0 ? (
                  activities.map((act) => (
                    <div key={act.id} className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase mt-0.5">
                        {(act.user?.name || "S").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-slate-700 dark:text-slate-200">
                          <span className="font-bold">
                            {act.user?.name || "System"}
                          </span>
                          {act.action === "commented" ? (
                            ""
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">
                              {" "}
                              {act.description}
                            </span>
                          )}
                        </p>
                        {act.action === "commented" && (
                          <div className="mt-1.5 px-3 py-2 bg-white dark:bg-[#22272b] border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                            {act.description}
                          </div>
                        )}
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          {new Date(act.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare
                      size={28}
                      className="mx-auto text-slate-300 dark:text-slate-600 mb-2"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {task
                        ? "No activity yet"
                        : "Activity will appear after creation"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-[#1d2125] rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            >
              {t("actions.cancel")}
            </button>
            <Button
              type="submit"
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md shadow-sm text-sm"
            >
              {task ? t("actions.updateTask") : t("actions.createTask")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// MAIN ADMIN TASKS PAGE
// ============================================
export default function AdminTaskBoardPage() {
  const t = useTranslations("DashboardAdminTasks");
  const locale = useLocale();
  const params = useParams<{ role?: string; locale?: string }>();
  const role = normalizeRole(params?.role) ?? "admin";
  const canManageTaskWorkspace = role === "admin" || role === "location";
  const canConfigureAutomation = canManageTaskWorkspace;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showDone, setShowDone] = useState(true);
  const [activeStatBlock, setActiveStatBlock] = useState<
    "active" | "priority" | "completed" | null
  >(null);
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(
    new Date(),
  );
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "all" as StatusFilter,
    priority: "all" as PriorityFilter,
    type: "all" as TypeFilter,
  });

  const [board, setBoard] = useState<BoardData | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [preSelectedColId, setPreSelectedColId] = useState<number | undefined>(
    undefined,
  );
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const API_BASE =
    typeof window !== "undefined" && window.location.hostname == "localhost"
      ? "http://localhost:8000/api"
      : "https://app.schepen-kring.nl/api";

  const getHeaders = () => {
    const token = getStoredToken();
    return { headers: token ? { Authorization: `Bearer ${token}` } : {} };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getStoredToken();
      const locationId = getCurrentLocationId();
      if (!token) {
        toast.error(t("toasts.authRequired"));
        return;
      }

      const taskEndpoint = canManageTaskWorkspace ? "/tasks" : "/tasks/my";
      const tasksRes = await axios.get(`${API_BASE}${taskEndpoint}`, {
        ...getHeaders(),
        params: locationId ? { location_id: locationId } : undefined,
      });
      const boardsRes = canManageTaskWorkspace
        ? await axios.get(`${API_BASE}/boards`, {
            ...getHeaders(),
            params: locationId ? { location_id: locationId } : undefined,
          })
        : null;
      const usersRes = canManageTaskWorkspace
        ? await axios.get(`${API_BASE}/public/users/employees`, {
            ...getHeaders(),
            params: locationId ? { location_id: locationId } : undefined,
          })
        : null;

      const nextTasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
      setTasks(
        nextTasks.map((task: Task) => ({
          ...task,
          status: fromApiStatus(task.status),
        })),
      );
      if (boardsRes?.data && boardsRes.data.columns) {
        setBoard(boardsRes.data);
        setColumns(boardsRes.data.columns);
      } else {
        setBoard(null);
        setColumns([]);
      }
      setUsers(Array.isArray(usersRes?.data) ? usersRes.data : []);
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
      toast.error(resolveApiErrorMessage(error, t, "toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Stat counts
  const todayStr = new Date().toISOString().split("T")[0];

  // Conditionally calculate based on View Mode
  let activeTasks = 0;
  let highPriorityTasks = 0;
  let completedTasks = 0;
  let efficiencyTasksLength = 0;
  let efficiencyTasksDone = 0;

  if (viewMode === "calendar") {
    // 1. Get stats for the current Calendar Month
    const calYear = currentCalendarDate.getFullYear();
    const calMonth = currentCalendarDate.getMonth();

    // Filter tasks whose due_date falls in `currentCalendarDate`'s month
    const tasksInMonth = tasks.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d.getFullYear() === calYear && d.getMonth() === calMonth;
    });

    activeTasks = tasksInMonth.filter((t) => t.status === "To Do").length;
    highPriorityTasks = tasksInMonth.filter(
      (t) => t.priority === "High",
    ).length;
    completedTasks = tasksInMonth.filter((t) => t.status === "Done").length;

    efficiencyTasksLength = tasksInMonth.length;
    efficiencyTasksDone = completedTasks;
  } else {
    // 2. Default List View -> everything everywhere (except efficiency is ONLY today)
    activeTasks = tasks.filter((t) => t.status === "To Do").length;
    highPriorityTasks = tasks.filter((t) => t.priority === "High").length;
    completedTasks = tasks.filter((t) => t.status === "Done").length;

    const todayTasks = tasks.filter((t) => t.due_date?.startsWith(todayStr));
    efficiencyTasksLength = todayTasks.length;
    efficiencyTasksDone = todayTasks.filter((t) => t.status === "Done").length;
  }

  const todayEfficiency =
    efficiencyTasksLength > 0
      ? Math.round((efficiencyTasksDone / efficiencyTasksLength) * 100)
      : 0;

  const handleStatBlockClick = (block: "active" | "priority" | "completed") => {
    if (activeStatBlock === block) {
      // Toggle off — reset filters
      setActiveStatBlock(null);
      setFilters((prev) => ({
        ...prev,
        status: "all" as StatusFilter,
        priority: "all" as PriorityFilter,
      }));
      setShowDone(true);
    } else {
      setActiveStatBlock(block);
      if (block === "active") {
        setFilters((prev) => ({
          ...prev,
          status: "To Do" as StatusFilter,
          priority: "all" as PriorityFilter,
        }));
        setShowDone(true);
      } else if (block === "priority") {
        setFilters((prev) => ({
          ...prev,
          priority: "High" as PriorityFilter,
          status: "all" as StatusFilter,
        }));
        setShowDone(true);
      } else if (block === "completed") {
        setFilters((prev) => ({
          ...prev,
          status: "Done" as StatusFilter,
          priority: "all" as PriorityFilter,
        }));
        setShowDone(true);
      }
    }
  };

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];
    if (filters.status !== "all")
      filtered = filtered.filter((t) => t.status === filters.status);
    if (filters.priority !== "all")
      filtered = filtered.filter((t) => t.priority === filters.priority);
    if (filters.type !== "all")
      filtered = filtered.filter((t) => t.type === filters.type);
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower) ||
          t.assigned_to_user?.name.toLowerCase().includes(searchLower),
      );
    }
    if (!showDone) filtered = filtered.filter((t) => t.status !== "Done");
    return filtered;
  }, [tasks, filters, showDone]);

  const filteredBoardTasks = useMemo(
    () =>
      filteredTasks.map((task) => ({
        ...task,
        column_id: resolveBoardColumnId(task, columns),
      })),
    [filteredTasks, columns],
  );

  const handleTaskSubmit = async (taskData: TaskSubmitData) => {
    try {
      const token = getStoredToken();
      if (!token) throw new Error(t("errors.noToken"));

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const normalizedStatus = taskData.status as Task["status"];
      const resolvedColumnId =
        taskData.column_id ??
        resolveBoardColumnId(
          { status: normalizedStatus, column_id: null },
          columns,
        );
      const resolvedStatus = getBoardStatusForColumn(
        resolvedColumnId,
        columns,
        normalizedStatus,
      );
      const dataToSend = {
        ...taskData,
        status: toApiStatus(resolvedStatus),
        column_id: resolvedColumnId ?? undefined,
        assigned_to: taskData.assigned_to
          ? typeof taskData.assigned_to === "number"
            ? taskData.assigned_to
            : parseInt(taskData.assigned_to, 10)
          : null,
        location_id: getCurrentLocationId(),
      };

      console.log("SENDING TASK DATA TO BACKEND:", JSON.stringify(dataToSend));
      // FOR DEBUGGING ONLY
      // toast.success("Payload: " + JSON.stringify(dataToSend));

      if (editingTask) {
        await axios.put(`${API_BASE}/tasks/${editingTask.id}`, dataToSend, {
          headers,
        });
        toast.success(t("toasts.taskUpdated"));

        // Upload pending attachments sequentially
        if (
          taskData.pendingAttachments &&
          taskData.pendingAttachments.length > 0
        ) {
          for (const file of taskData.pendingAttachments) {
            try {
              const formData = new FormData();
              formData.append("file", file);
              await axios.post(
                `${API_BASE}/tasks/${editingTask.id}/attachments`,
                formData,
                {
                  headers: {
                    ...headers,
                    "Content-Type": "multipart/form-data",
                  },
                },
              );
            } catch (e) {
              console.error("Failed to upload pending attachment:", e);
              toast.error("Failed to upload some attachments");
            }
          }
        }
      } else {
        const response = await axios.post(`${API_BASE}/tasks`, dataToSend, {
          headers,
        });
        toast.success(t("toasts.taskCreated"));

        // Upload pending attachments sequentially
        const newTaskId = response.data?.id;
        if (
          newTaskId &&
          taskData.pendingAttachments &&
          taskData.pendingAttachments.length > 0
        ) {
          for (const file of taskData.pendingAttachments) {
            try {
              const formData = new FormData();
              formData.append("file", file);
              await axios.post(
                `${API_BASE}/tasks/${newTaskId}/attachments`,
                formData,
                {
                  headers: {
                    ...headers,
                    "Content-Type": "multipart/form-data",
                  },
                },
              );
            } catch (e) {
              console.error("Failed to upload pending attachment:", e);
              toast.error("Failed to upload some attachments");
            }
          }
        }
      }
      await fetchData();
      setIsModalOpen(false);
      setEditingTask(undefined);
    } catch (error: unknown) {
      console.error("Error saving task:", error);
      toast.error(resolveApiErrorMessage(error, t, "toasts.saveFailed"));
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm(t("confirm.deleteTask"))) return;
    try {
      await axios.delete(`${API_BASE}/tasks/${taskId}`, getHeaders());
      toast.success(t("toasts.taskDeleted"));
      await fetchData();
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t, "toasts.deleteFailed"));
    }
  };

  const handleStatusChange = async (
    taskId: number,
    newStatus: Task["status"],
  ) => {
    try {
      const currentTask = tasks.find((task) => task.id === taskId);
      const nextColumnId = currentTask
        ? resolveBoardColumnId(
            {
              status: newStatus,
              column_id: currentTask.column_id ?? null,
            },
            columns,
          )
        : null;

      if (nextColumnId != null && currentTask?.column_id !== nextColumnId) {
        await axios.put(
          `${API_BASE}/tasks/${taskId}`,
          {
            status: toApiStatus(newStatus),
            column_id: nextColumnId,
          },
          getHeaders(),
        );
      } else {
        await axios.patch(
          `${API_BASE}/tasks/${taskId}/status`,
          { status: toApiStatus(newStatus) },
          getHeaders(),
        );
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: newStatus,
                column_id:
                  nextColumnId != null ? nextColumnId : task.column_id,
              }
            : task,
        ),
      );
      toast.success(t("toasts.statusUpdated"));
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t, "toasts.statusFailed"));
    }
  };

  const handleTaskDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    newStatus: Task["status"],
  ) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    const taskId = Number(raw);
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );
    setDraggingTaskId(null);
    await handleStatusChange(taskId, newStatus);
  };

  const handleAddColumn = async (name: string) => {
    try {
      if (!board) return;
      const res = await axios.post(
        `${API_BASE}/columns`,
        { name, position: columns.length, board_id: board.id },
        getHeaders(),
      );
      setColumns((prev) => [...prev, res.data]);
      toast.success("Column added");
    } catch (err) {
      toast.error("Failed to add column");
    }
  };

  const handleRenameColumn = async (id: number, name: string) => {
    try {
      const res = await axios.put(
        `${API_BASE}/columns/${id}`,
        { name },
        getHeaders(),
      );
      setColumns((prev) => prev.map((c) => (c.id === id ? res.data : c)));
    } catch (err) {
      toast.error("Failed to rename column");
    }
  };

  const handleDeleteColumn = async (id: number) => {
    if (!confirm("Delete this column?")) return;
    try {
      await axios.delete(`${API_BASE}/columns/${id}`, getHeaders());
      setColumns((prev) => prev.filter((c) => c.id !== id));
      toast.success("Column deleted");
    } catch (err) {
      toast.error("Failed to delete column");
    }
  };

  const handleColumnMove = async (
    colId: number,
    newPosition: number,
    cols: BoardColumn[],
  ) => {
    setColumns(cols);
    try {
      await axios.post(
        `${API_BASE}/columns/reorder`,
        { columns: cols },
        getHeaders(),
      );
    } catch (err) {
      toast.error("Failed to reorder columns");
    }
  };

  const handleTaskMove = async (
    taskId: number,
    newColId: number,
    newPosition: number,
    tasksMap: Record<number, Task[]>,
  ) => {
    const movedTask = tasks.find((task) => task.id === taskId);
    const nextStatus = getBoardStatusForColumn(
      newColId,
      columns,
      movedTask?.status ?? "To Do",
    ) as Task["status"];
    const payloadTasks: Array<{
      id: number;
      column_id: number;
      position: number;
    }> = [];
    Object.keys(tasksMap).forEach((colId) => {
      tasksMap[Number(colId)].forEach((t) => {
        payloadTasks.push({
          id: t.id,
          column_id: Number(colId),
          position: t.position ?? 0,
        });
      });
    });

    setTasks((prev) =>
      prev.map((t) => {
        const updatedT = payloadTasks.find((pt) => pt.id === t.id);
        if (updatedT) {
          return {
            ...t,
            column_id: Number(updatedT.column_id),
            position: updatedT.position,
            status: t.id === taskId ? nextStatus : t.status,
          };
        }
        return t;
      }),
    );

    try {
      await axios.post(
        `${API_BASE}/tasks/reorder`,
        { tasks: payloadTasks },
        getHeaders(),
      );

      if (movedTask && movedTask.status !== nextStatus) {
        await axios.patch(
          `${API_BASE}/tasks/${taskId}/status`,
          { status: toApiStatus(nextStatus) },
          getHeaders(),
        );
      }
    } catch (err) {
      toast.error("Failed to move task");
      await fetchData();
    }
  };

  const handleAcceptTask = async (taskId: number) => {
    try {
      await axios.patch(`${API_BASE}/tasks/${taskId}/accept`, {}, getHeaders());
      toast.success(t("toasts.assignmentAccepted"));
      await fetchData();
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t, "toasts.acceptFailed"));
    }
  };

  const handleRejectTask = async (taskId: number) => {
    try {
      await axios.patch(`${API_BASE}/tasks/${taskId}/reject`, {}, getHeaders());
      toast.success(t("toasts.assignmentRejected"));
      await fetchData();
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t, "toasts.rejectFailed"));
    }
  };

  const getCurrentUserId = (): number | null => {
    const idStr = getLocalUserId();
    if (!idStr) return null;
    const num = Number(idStr);
    return isNaN(num) ? null : num;
  };

  const getPriorityIcon = (priority: Task["priority"]) => {
    switch (priority) {
      case "High":
        return <AlertTriangle className="text-red-500" size={16} />;
      case "Medium":
        return <Shield className="text-amber-500" size={16} />;
      case "Low":
        return <Info className="text-blue-500" size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const getPriorityStyles = (priority: Task["priority"]) => {
    switch (priority) {
      case "High":
        return "bg-red-50 border-red-200 text-red-700";
      case "Medium":
        return "bg-amber-50 border-amber-200 text-amber-700";
      case "Low":
        return "bg-blue-50 border-blue-200 text-blue-700";
      default:
        return "bg-slate-50 border-slate-200 text-slate-700";
    }
  };

  const getStatusStyles = (status: Task["status"]) => {
    switch (status) {
      case "Done":
        return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "In Progress":
        return "bg-blue-50 text-blue-600 border-blue-200";
      case "To Do":
        return "bg-slate-50 text-slate-600 border-slate-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return t("labels.noDate");
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today && due.toDateString() !== today.toDateString();
  };

  return (
    <>
      <Toaster position="top-right" />
      <main className="copied-admin-theme flex-1 p-4 sm:p-6 bg-white min-h-[calc(100vh-80px)] dark:bg-[#050b19]">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h1 className="text-4xl font-serif italic text-[#003566]">
                {t("title")}
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-blue-600 font-black mt-2">
                {t("subtitle")}
              </p>
            </div>

            <div className="flex flex-col md:flex-row w-full md:w-auto gap-4">
              <div className="relative w-full md:w-64">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={14}
                />
                <input
                  type="text"
                  placeholder={t("placeholders.searchTasks")}
                  className="w-full bg-white border border-slate-200 pl-10 pr-4 py-3 text-[10px] font-bold tracking-widest uppercase focus:border-blue-400 outline-none"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  onClick={() => setViewMode("list")}
                  className="rounded-none h-12 px-4 border text-xs"
                >
                  <List size={16} className="mr-2" /> {t("views.list")}
                </Button>
                {canManageTaskWorkspace && (
                  <Button
                    variant={viewMode === "board" ? "default" : "outline"}
                    onClick={() => setViewMode("board")}
                    className="rounded-none h-12 px-4 border text-xs"
                  >
                    <ClipboardList size={16} className="mr-2" />{" "}
                    {t("views.board")}
                  </Button>
                )}
                <Button
                  variant={viewMode === "calendar" ? "default" : "outline"}
                  onClick={() => setViewMode("calendar")}
                  className="rounded-none h-12 px-4 border text-xs"
                >
                  <CalendarDays size={16} className="mr-2" />{" "}
                  {t("views.calendar")}
                </Button>
                {/* {viewMode === "board" && (
                  <Button
                    variant="outline"
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="rounded-none h-12 px-4 border text-xs"
                  >
                    {isDarkMode ? (
                      <Sun size={16} className="mr-2 text-amber-500" />
                    ) : (
                      <Moon size={16} className="mr-2 text-slate-500" />
                    )}
                    {isDarkMode ? "Light" : "Dark"}
                  </Button>
                )} */}
              </div>

              <button
                onClick={() => {
                  setEditingTask(undefined);
                  setPreSelectedColId(undefined);
                  setIsModalOpen(true);
                }}
                className="bg-[#003566] text-white rounded-none h-12 px-2 uppercase text-xs tracking-widest font-black shadow-lg hover:bg-[#003566]/90 flex items-center"
              >
                <Plus size={16} className="mr-2" /> {t("actions.newTask")}
              </button>
              {canConfigureAutomation && (
                <Link href={`/dashboard/${role}/tasks/automation`}>
                  <button className="rounded-none h-12 w-fit px-8 border text-xs uppercase tracking-widest font-black flex items-center">
                    <CalendarIcon size={16} className="mr-2" /> Automation Rules
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* ── 4 STAT BLOCKS ────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Active Tasks */}
            <button
              onClick={() => handleStatBlockClick("active")}
              className={`flex items-center gap-4 p-5 border rounded-lg transition-all text-left hover:shadow-md ${
                activeStatBlock === "active"
                  ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                <ClipboardList size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-400">
                  {t("stats.activeTasks")}
                </p>
                <p className="text-2xl font-bold text-[#003566]">
                  {activeTasks}
                </p>
              </div>
            </button>

            {/* Critical Priority */}
            <button
              onClick={() => handleStatBlockClick("priority")}
              className={`flex items-center gap-4 p-5 border rounded-lg transition-all text-left hover:shadow-md ${
                activeStatBlock === "priority"
                  ? "border-red-500 bg-red-50 shadow-md ring-2 ring-red-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] font-black justify-between flex w-full text-slate-400">
                  <span>{t("stats.priority")}</span>
                  <span className="bg-red-100 text-red-700 px-1 py-0.5 rounded text-[8px] ml-2">
                    {t("priority.high").toUpperCase()}
                  </span>
                </p>
                <p className="text-2xl font-bold text-[#003566]">
                  {highPriorityTasks}
                </p>
              </div>
            </button>

            {/* Completed Tasks */}
            <button
              onClick={() => handleStatBlockClick("completed")}
              className={`flex items-center gap-4 p-5 border rounded-lg transition-all text-left hover:shadow-md ${
                activeStatBlock === "completed"
                  ? "border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                <CheckCircle2 size={18} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-400">
                  {t("stats.completedAssets")}
                </p>
                <p className="text-2xl font-bold text-[#003566]">
                  {completedTasks}
                </p>
              </div>
            </button>

            {/* User Efficiency */}
            <div className="flex items-center gap-4 p-5 border border-slate-200 bg-white rounded-lg">
              <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center">
                <TrendingUp size={18} className="text-indigo-500" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-400">
                  {viewMode === "calendar"
                    ? t("stats.monthlyEfficiency")
                    : t("stats.todayEfficiency")}
                </p>
                <p className="text-2xl font-bold text-[#003566]">
                  {todayEfficiency}%
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">
                {t("filters.status")}:
              </span>
              <select
                className="bg-white border border-slate-200 px-3 py-2 text-sm font-medium outline-none rounded"
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value as StatusFilter,
                  }))
                }
              >
                <option value="all">{t("filters.allStatus")}</option>
                <option value="To Do">{t("status.todo")}</option>
                <option value="In Progress">{t("status.inProgress")}</option>
                <option value="Done">{t("status.done")}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">
                {t("filters.priority")}:
              </span>
              <select
                className="bg-white border border-slate-200 px-3 py-2 text-sm font-medium outline-none rounded"
                value={filters.priority}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    priority: e.target.value as PriorityFilter,
                  }))
                }
              >
                <option value="all">{t("filters.allPriorities")}</option>
                <option value="Low">{t("priority.low")}</option>
                <option value="Medium">{t("priority.medium")}</option>
                <option value="High">{t("priority.high")}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">
                {t("filters.type")}:
              </span>
              <select
                className="bg-white border border-slate-200 px-3 py-2 text-sm font-medium outline-none rounded"
                value={filters.type}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    type: e.target.value as TypeFilter,
                  }))
                }
              >
                <option value="all">{t("filters.allTypes")}</option>
                <option value="assigned">{t("type.assigned")}</option>
                <option value="personal">{t("type.personal")}</option>
              </select>
            </div>

            <Button
              variant={showDone ? "default" : "outline"}
              onClick={() => setShowDone(!showDone)}
              className="gap-2 ml-auto"
            >
              {showDone ? <EyeOff size={16} /> : <Eye size={16} />}
              {showDone ? t("actions.hideDone") : t("actions.showDone")}
            </Button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="animate-spin text-[#003566]" size={32} />
              <span className="ml-3 text-slate-600">{t("loading")}</span>
            </div>
          ) : viewMode === "board" ? (
            <div
              className={cn(
                "w-full h-full rounded-xl transition-colors duration-300",
                isDarkMode ? "dark bg-slate-900 p-2" : "bg-white",
              )}
            >
              <DynamicKanbanBoard
                tasks={filteredBoardTasks}
                columns={columns}
                onTaskMove={handleTaskMove}
                onColumnMove={handleColumnMove}
                onAddColumn={handleAddColumn}
                onRenameColumn={handleRenameColumn}
                onDeleteColumn={handleDeleteColumn}
                onAddTask={(colId) => {
                  setPreSelectedColId(colId);
                  setEditingTask(undefined);
                  setIsModalOpen(true);
                }}
                onEditTask={(task) => {
                  setEditingTask(task);
                  setPreSelectedColId(task.column_id || undefined);
                  setIsModalOpen(true);
                }}
                onDeleteTask={handleDeleteTask}
              />
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredTasks.length === 0 ? (
                  <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-lg">
                    <p className="text-slate-400">{t("empty.noTasks")}</p>
                    <p className="text-sm text-slate-300 mt-2">
                      {filters.search ||
                      filters.status !== "all" ||
                      filters.priority !== "all"
                        ? t("empty.changeFilters")
                        : t("empty.createFirst")}
                    </p>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={cn(
                        "flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-6 border shadow-sm rounded-lg transition-all hover:shadow-md cursor-pointer",
                        task.status === "Done" && "opacity-70",
                        task.priority === "High" &&
                          task.status !== "Done" &&
                          "border-l-4 border-l-red-600",
                      )}
                      onClick={() => {
                        setEditingTask(task);
                        setIsModalOpen(true);
                      }}
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <div
                          className={cn(
                            "w-12 h-12 flex items-center justify-center rounded-full border-2",
                            getPriorityStyles(task.priority),
                          )}
                        >
                          {getPriorityIcon(task.priority)}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-lg font-bold text-[#003566]">
                              {task.title}
                            </h3>
                            <span
                              className={cn(
                                "px-2 py-1 text-xs font-bold uppercase border rounded",
                                getPriorityStyles(task.priority),
                              )}
                            >
                              {t(`priority.${task.priority.toLowerCase()}`)}
                            </span>
                            <span
                              className={cn(
                                "px-2 py-1 text-xs font-bold uppercase border rounded",
                                getStatusStyles(task.status),
                              )}
                            >
                              {t(
                                task.status === "To Do"
                                  ? "status.todo"
                                  : task.status === "In Progress"
                                    ? "status.inProgress"
                                    : "status.done",
                              )}
                            </span>
                            {task.assignment_status === "pending" && (
                              <span className="px-2 py-1 text-xs font-bold uppercase bg-yellow-50 text-yellow-600 border border-yellow-200 rounded">
                                {t("status.pending")}
                              </span>
                            )}

                          </div>

                          {task.description && (
                            <p className="text-sm text-slate-600 mb-3">
                              {task.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                            <span className="flex items-center gap-1.5">
                              {t("labels.createdBy")}:{" "}
                              {task.created_by_user?.name ??
                                (() => {
                                  if (typeof window === "undefined")
                                    return t("labels.na");
                                  const ud = localStorage.getItem("user_data");
                                  if (!ud) return t("labels.na");
                                  try {
                                    const u = JSON.parse(ud);
                                    const myId = u.id ?? u.mainId;
                                    return task.created_by != null &&
                                      Number(task.created_by) === Number(myId)
                                      ? t("labels.me")
                                      : t("labels.na");
                                  } catch {
                                    return t("labels.na");
                                  }
                                })()}
                            </span>
                            {task.assigned_to_user && (
                              <span className="flex items-center gap-1.5">
                                <UserIcon size={14} />{" "}
                                {task.assigned_to_user.name}
                              </span>
                            )}
                            <span
                              className={cn(
                                "flex items-center gap-1.5",
                                isOverdue(task.due_date) &&
                                  "text-red-600 font-bold",
                              )}
                            >
                              <CalendarIcon size={14} /> {t("labels.due")}:{" "}
                              {formatDate(task.due_date)}
                              {isOverdue(task.due_date) &&
                                ` (${t("labels.overdue")})`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {task.assignment_status === "pending" &&
                          task.assigned_to === getCurrentUserId() && (
                            <>
                              <Button
                                onClick={() => handleAcceptTask(task.id)}
                                className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                size="sm"
                              >
                                <CheckCircle2 size={16} className="mr-2" />{" "}
                                {t("actions.accept")}
                              </Button>
                              <Button
                                onClick={() => handleRejectTask(task.id)}
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-600 hover:bg-red-50"
                              >
                                {t("actions.reject")}
                              </Button>
                            </>
                          )}
                        {task.status !== "Done" ? (
                          <Button
                            onClick={() => handleStatusChange(task.id, "Done")}
                            className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                            size="sm"
                          >
                            <CheckCircle2 size={16} className="mr-2" />
                            {t("actions.markDone")}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleStatusChange(task.id, "To Do")}
                            variant="outline"
                            size="sm"
                          >
                            {t("actions.reopen")}
                          </Button>
                        )}

                        <Button
                          onClick={() => handleDeleteTask(task.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <CalendarView
                tasks={filteredTasks}
                currentDate={currentCalendarDate}
                setCurrentDate={setCurrentCalendarDate}
                onTaskClick={(task) => {
                  setEditingTask(task);
                  setIsModalOpen(true);
                }}
              />
            </div>
          )}
        </div>
      </main>
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(undefined);
          setPreSelectedColId(undefined);
        }}
        onSubmit={handleTaskSubmit}
        task={editingTask}
        users={users}
        columns={columns}
        preSelectedColId={preSelectedColId}
      />
    </>
  );
}
