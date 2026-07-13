export type SyncStatus = {
  total_yachts: number;
  synced_to_yachtshift: number;
  pending_export: number;
  last_sync_at: string | null;
  publish_statuses: Record<string, number>;
  failed_exports: number;
  pending_conflicts: number;
};

export type Conflict = {
  id: number;
  yacht_id: number;
  external_id: string;
  field_name: string;
  local_value: string | null;
  remote_value: string | null;
  status: string;
  yacht?: { id: number; boat_name: string | null; vessel_id: string | null } | null;
};

export type SyncRun = {
  id: number;
  action: string;
  result: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

export type Platform = {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  category: string | null;
  export_method: string;
  openmarine_dealer_id: string | null;
  openmarine_version: string | null;
  is_active: boolean;
  is_default: boolean;
  feed_source_platform_id: number | null;
  priority: number;
};

export const fmt = (v?: string | null) =>
  v ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "—";
