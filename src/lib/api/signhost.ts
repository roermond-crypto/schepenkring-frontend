import { api } from "@/lib/api";

export interface SignRecipient {
    user_id?: number | string;
    email?: string;
    name?: string;
    role: "buyer" | "seller" | string;
}

export interface SignRequestPayload {
    sign_request_id: number;
    recipients: SignRecipient[];
    reference?: string;
    password?: string;
    otp_code?: string;
}

export interface SignActionPayload {
    sign_request_id: number;
    password?: string;
    otp_code?: string;
    reason?: string;
}

export interface ContractGeneratePayload {
    entity_type: string;
    entity_id: number;
    location_id?: number;
    title: string;
    send_to_signhost?: boolean;
    reference?: string;
    recipients?: SignRecipient[];
    pdf?: File | Blob;
    attachments?: (File | Blob)[];
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
}

export interface SignhostDocument {
    id: number;
    sign_request_id: number;
    type: "original" | "signed" | string;
    file_path: string;
    file_url: string;
    sha256: string;
    created_at: string;
}

export interface SignRequest {
    id: number;
    location_id: number;
    entity_type: string;
    entity_id: number;
    provider: string;
    status: string; // DRAFT, SENT, SIGNED, FAILED, etc.
    signhost_transaction_id: string | null;
    sign_url: string | null;
    requested_by_user_id: number | null;
    metadata: Record<string, unknown>;
    documents?: SignhostDocument[];
    created_at: string;
    updated_at: string;
}

function appendNestedFormData(
    formData: FormData,
    key: string,
    value: unknown,
) {
    if (value == null) {
        return;
    }

    if (value instanceof Blob) {
        formData.append(key, value);
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            appendNestedFormData(formData, `${key}[${index}]`, item);
        });
        return;
    }

    if (typeof value === "object") {
        Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
            appendNestedFormData(formData, `${key}[${childKey}]`, childValue);
        });
        return;
    }

    formData.append(key, String(value));
}

export const signhostApi = {
    /**
     * Generate a contract PDF and create a DRAFT SignRequest
     */
    generateContract: async (payload: ContractGeneratePayload) => {
        const formData = new FormData();
        formData.append("entity_type", payload.entity_type);
        formData.append("entity_id", String(payload.entity_id));
        if (payload.location_id != null) {
            formData.append("location_id", String(payload.location_id));
        }
        formData.append("title", payload.title);
        if (payload.send_to_signhost) {
            formData.append("send_to_signhost", "1");
        }
        if (payload.reference) {
            formData.append("reference", payload.reference);
        }
        payload.recipients?.forEach((recipient, index) => {
            if (recipient.name) {
                formData.append(`recipients[${index}][name]`, recipient.name);
            }
            if (recipient.email) {
                formData.append(`recipients[${index}][email]`, recipient.email);
            }
            formData.append(`recipients[${index}][role]`, recipient.role);
            if (recipient.user_id != null) {
                formData.append(
                    `recipients[${index}][user_id]`,
                    String(recipient.user_id),
                );
            }
        });
        if (payload.pdf) {
            formData.append("pdf", payload.pdf);
        }
        payload.attachments?.forEach((attachment, index) => {
            formData.append(`attachments[${index}]`, attachment);
        });
        if (payload.metadata) {
            appendNestedFormData(formData, "metadata", payload.metadata);
        }

        const response = await api.post<{
            message: string;
            contract_pdf_path: string;
            contract_sha256: string;
            sign_url?: string | null;
            sign_request: SignRequest;
        }>("/contracts/generate", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
                ...(payload.idempotencyKey
                    ? { "Idempotency-Key": payload.idempotencyKey }
                    : {}),
            },
        });
        return response.data;
    },

    /**
     * Send a SignRequest to Signhost (transitions status from DRAFT to SENT)
     */
    createRequest: async (payload: SignRequestPayload, idempotencyKey: string) => {
        const response = await api.post<{
            message: string;
            sign_request: SignRequest;
        }>("/signhost/request", payload, {
            headers: {
                "Idempotency-Key": idempotencyKey,
            },
        });
        return response.data;
    },

    /**
     * Resend the signature request
     */
    resend: async (payload: SignActionPayload, idempotencyKey: string) => {
        const response = await api.post<{
            message: string;
            sign_request: SignRequest;
        }>("/signhost/resend", payload, {
            headers: {
                "Idempotency-Key": idempotencyKey,
            },
        });
        return response.data;
    },

    /**
     * Cancel the signature request
     */
    cancel: async (payload: SignActionPayload, idempotencyKey: string) => {
        const response = await api.post<{
            message: string;
            sign_request: SignRequest;
        }>("/signhost/cancel", payload, {
            headers: {
                "Idempotency-Key": idempotencyKey,
            },
        });
        return response.data;
    },

    /**
     * Get the current status of a SignRequest
     */
    getStatus: async (signRequestId: number) => {
        const response = await api.get<{
            sign_request: SignRequest;
        }>(`/signhost/status?sign_request_id=${signRequestId}`);
        return response.data;
    },

    /**
     * List documents associated with a SignRequest
     */
    getDocuments: async (signRequestId: number) => {
        const response = await api.get<{
            documents: SignhostDocument[];
        }>(`/signhost/documents?sign_request_id=${signRequestId}`);
        return response.data;
    },
};
