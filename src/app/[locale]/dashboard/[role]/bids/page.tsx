import { BidsManagementPage } from "@/components/dashboard/BidsManagementPage";
import { normalizeRole } from "@/lib/auth/roles";

export default async function BidsPage({
  params,
}: {
  params: Promise<{ role?: string }>;
}) {
  const { role: rawRole } = await params;
  const role = normalizeRole(rawRole) ?? "client";

  return <BidsManagementPage role={role} />;
}
