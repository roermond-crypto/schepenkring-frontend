import { redirect } from "next/navigation";
import { ChatPage } from "@/components/dashboard/chat/ChatPage";
import { normalizeRole } from "@/lib/auth/roles";

export default async function ChatPageRoute({
  params,
}: {
  params: Promise<{ locale: string; role: string }>;
}) {
  const { locale, role: rawRole } = await params;
  const role = normalizeRole(rawRole) ?? "client";

  if (role === "client" || role === "buyer" || role === "seller") {
    redirect(`/${locale}/dashboard/${role}`);
  }

  return (
    <div className="w-full">
      <ChatPage />
    </div>
  );
}
