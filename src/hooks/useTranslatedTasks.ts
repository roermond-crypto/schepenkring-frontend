"use client";

import { useEffect, useRef, useState } from "react";
import { translateTexts } from "@/lib/task-translation";

interface TranslatableTask {
  id: number;
  title: string;
  description?: string;
}

// Returns the same task array with title/description replaced by locale translations.
// Falls back to the original while translating. Batches all strings in one API call.
export function useTranslatedTasks<T extends TranslatableTask>(
  tasks: T[],
  locale: string,
): T[] {
  const [translated, setTranslated] = useState<T[]>(tasks);
  // Track the previous key to skip re-translating when only irrelevant fields changed.
  const prevKeyRef = useRef<string>("");

  useEffect(() => {
    // No translation needed for English locale
    if (locale === "en") {
      setTranslated(tasks);
      return;
    }

    const stableKey = `${locale}:${tasks.map((t) => `${t.id}:${t.title}:${t.description ?? ""}`).join("|")}`;
    if (stableKey === prevKeyRef.current) return;
    prevKeyRef.current = stableKey;

    if (tasks.length === 0) {
      setTranslated([]);
      return;
    }

    // Collect titles and descriptions into a flat list for one batch call
    const titles = tasks.map((t) => t.title);
    const descriptions = tasks.map((t) => t.description ?? "");

    translateTexts([...titles, ...descriptions], locale).then((results) => {
      const translatedTitles = results.slice(0, tasks.length);
      const translatedDescriptions = results.slice(tasks.length);

      setTranslated(
        tasks.map((task, i) => ({
          ...task,
          title: translatedTitles[i] || task.title,
          description: task.description
            ? translatedDescriptions[i] || task.description
            : task.description,
        })),
      );
    });
  }, [tasks, locale]);

  return translated;
}
