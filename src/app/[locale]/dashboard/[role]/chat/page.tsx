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

  // "client" has no support-inbox equivalent page today — only buyer/seller
  // were carved out of this redirect, since those are the two roles this
  // simplified chat experience is built for.
  if (role === "client") {
    redirect(`/${locale}/dashboard/${role}`);
  }

  return (
    <div className="w-full">
      <ChatPage role={role} />
    </div>
  );
}
