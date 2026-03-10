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
    metadata?: Record<string, any>;
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
    metadata: Record<string, any>;
    documents?: SignhostDocument[];
    created_at: string;
    updated_at: string;
}

export const signhostApi = {
    /**
     * Generate a contract PDF and create a DRAFT SignRequest
     */
    generateContract: async (payload: ContractGeneratePayload) => {
        const response = await api.post<{
            message: string;
            contract_pdf_path: string;
            contract_sha256: string;
            sign_request: SignRequest;
        }>("/contracts/generate", payload);
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
