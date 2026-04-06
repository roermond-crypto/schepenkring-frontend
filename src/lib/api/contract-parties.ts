import { api } from "@/lib/api";

export type ContractPartyRoleType = "seller" | "buyer";

export interface ContractParty {
  id: number;
  role_type: ContractPartyRoleType;
  name: string;
  company_name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  passport_number: string | null;
  partner_name: string | null;
  married: boolean;
  location_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ContractPartyPayload {
  role_type: ContractPartyRoleType;
  name: string;
  company_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  passport_number?: string | null;
  partner_name?: string | null;
  married?: boolean;
  location_id?: number | null;
}

export async function listContractParties(params: {
  role_type: ContractPartyRoleType;
  location_id?: number | null;
}): Promise<ContractParty[]> {
  const res = await api.get<{ data: ContractParty[] }>("/contract-parties", {
    params,
  });

  return res.data.data ?? [];
}

export async function createContractParty(
  payload: ContractPartyPayload,
): Promise<ContractParty> {
  const res = await api.post<ContractParty>("/contract-parties", payload);
  return res.data;
}

export async function updateContractParty(
  id: number,
  payload: Partial<ContractPartyPayload>,
): Promise<ContractParty> {
  const res = await api.patch<ContractParty>(`/contract-parties/${id}`, payload);
  return res.data;
}

export async function deleteContractParty(id: number): Promise<void> {
  await api.delete(`/contract-parties/${id}`);
}
