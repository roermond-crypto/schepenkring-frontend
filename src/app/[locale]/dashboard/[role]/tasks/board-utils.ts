type SystemColumnKey = "todo" | "inProgress" | "done";

type ColumnLike = {
  id: number;
  name: string;
};

type TaskLike = {
  status?: string | null;
  column_id?: number | null;
};

function normalizeLabel(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function statusFromColumnKey(key: SystemColumnKey) {
  switch (key) {
    case "todo":
      return "To Do";
    case "inProgress":
      return "In Progress";
    case "done":
      return "Done";
  }
}

function findSystemColumn(columns: ColumnLike[], key: SystemColumnKey) {
  return columns.find((column) => getSystemColumnKey(column.name) === key);
}

export function getSystemColumnKey(
  value?: string | null,
): SystemColumnKey | null {
  const normalized = normalizeLabel(value);

  if (
    normalized === "todo" ||
    normalized === "to do" ||
    normalized === "new" ||
    normalized === "pending"
  ) {
    return "todo";
  }

  if (normalized === "in progress" || normalized === "inprogress") {
    return "inProgress";
  }

  if (
    normalized === "done" ||
    normalized === "completed" ||
    normalized === "complete"
  ) {
    return "done";
  }

  return null;
}

export function getBoardColumnDisplayName(
  name: string,
  t: (key: string) => string,
) {
  const key = getSystemColumnKey(name);

  switch (key) {
    case "todo":
      return t("status.todo");
    case "inProgress":
      return t("status.inProgress");
    case "done":
      return t("status.done");
    default:
      return name;
  }
}

export function resolveBoardColumnId(task: TaskLike, columns: ColumnLike[]) {
  if (columns.length === 0) {
    return task.column_id ?? null;
  }

  const currentColumn =
    task.column_id != null
      ? columns.find((column) => column.id === task.column_id)
      : undefined;
  const currentColumnKey = currentColumn
    ? getSystemColumnKey(currentColumn.name)
    : null;
  const statusColumnKey = getSystemColumnKey(task.status);

  if (currentColumn && currentColumnKey === null) {
    return currentColumn.id;
  }

  if (statusColumnKey) {
    const statusColumn = findSystemColumn(columns, statusColumnKey);

    if (statusColumn) {
      if (!currentColumn) {
        return statusColumn.id;
      }

      if (currentColumnKey && currentColumnKey !== statusColumnKey) {
        return statusColumn.id;
      }
    }
  }

  if (currentColumn) {
    return currentColumn.id;
  }

  return columns[0]?.id ?? null;
}

export function getBoardStatusForColumn(
  columnId: number | null | undefined,
  columns: ColumnLike[],
  fallbackStatus: string,
) {
  if (columnId == null) {
    return fallbackStatus;
  }

  const column = columns.find((item) => item.id === columnId);
  const key = column ? getSystemColumnKey(column.name) : null;

  return key ? statusFromColumnKey(key) : fallbackStatus;
}
