export type LatestSignhostStatus =
  | "pending_review"
  | "waiting_invite"
  | "signing"
  | "signed"
  | "failed";

export type LatestSignhostSummary = {
  sign_request_id: number | null;
  status: LatestSignhostStatus;
  client_sign_url: string | null;
  has_signed_document: boolean;
  updated_at: string | null;
};

export type LatestSignhostTransactionLike = {
  id?: number | string | null;
  status?: string | null;
  signing_url_buyer?: string | null;
  signing_url_seller?: string | null;
  signed_pdf_path?: string | null;
  updated_at?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeClientContractStatus(
  value: unknown,
): LatestSignhostStatus {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "signed") {
    return "signed";
  }

  if (
    [
      "sent",
      "viewed",
      "signing",
      "pending",
    ].includes(normalized)
  ) {
    return "signing";
  }

  if (
    [
      "failed",
      "declined",
      "rejected",
      "expired",
      "cancelled",
      "canceled",
    ].includes(normalized)
  ) {
    return "failed";
  }

  if (
    [
      "waiting_invite",
      "requested",
      "draft",
    ].includes(normalized)
  ) {
    return "waiting_invite";
  }

  return "pending_review";
}

export function normalizeLatestSignhost(
  value: unknown,
): LatestSignhostSummary {
  if (!isRecord(value)) {
    return {
      sign_request_id: null,
      status: "pending_review",
      client_sign_url: null,
      has_signed_document: false,
      updated_at: null,
    };
  }

  const signRequestId =
    typeof value.sign_request_id === "number"
      ? value.sign_request_id
      : typeof value.sign_request_id === "string" &&
          Number.isFinite(Number(value.sign_request_id))
        ? Number(value.sign_request_id)
        : null;

  return {
    sign_request_id: signRequestId,
    status: normalizeClientContractStatus(value.status),
    client_sign_url:
      typeof value.client_sign_url === "string" && value.client_sign_url.trim() !== ""
        ? value.client_sign_url
        : null,
    has_signed_document: Boolean(value.has_signed_document),
    updated_at:
      typeof value.updated_at === "string" && value.updated_at.trim() !== ""
        ? value.updated_at
        : null,
  };
}

export function latestSignhostFromTransaction(
  value: LatestSignhostTransactionLike | null | undefined,
): LatestSignhostSummary {
  const signRequestId =
    typeof value?.id === "number"
      ? value.id
      : typeof value?.id === "string" &&
          Number.isFinite(Number(value.id))
        ? Number(value.id)
        : null;

  return {
    sign_request_id: signRequestId,
    status: normalizeClientContractStatus(value?.status),
    client_sign_url:
      value?.signing_url_buyer?.trim() ||
      value?.signing_url_seller?.trim() ||
      null,
    has_signed_document: Boolean(value?.signed_pdf_path) ||
      normalizeClientContractStatus(value?.status) === "signed",
    updated_at:
      typeof value?.updated_at === "string" && value.updated_at.trim() !== ""
        ? value.updated_at
        : null,
  };
}

export function clientSigningPriority(status: LatestSignhostStatus): number {
  switch (status) {
    case "signing":
      return 0;
    case "failed":
      return 1;
    case "waiting_invite":
      return 2;
    case "signed":
      return 3;
    case "pending_review":
    default:
      return 4;
  }
}

export function compareLatestSignhost(
  left: LatestSignhostSummary,
  right: LatestSignhostSummary,
): number {
  const priorityDelta =
    clientSigningPriority(left.status) - clientSigningPriority(right.status);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const leftUpdatedAt = new Date(left.updated_at ?? 0).getTime();
  const rightUpdatedAt = new Date(right.updated_at ?? 0).getTime();

  return rightUpdatedAt - leftUpdatedAt;
}

export function isClientContractActionable(
  summary: LatestSignhostSummary,
): boolean {
  return ["signing", "failed", "waiting_invite"].includes(summary.status);
}
