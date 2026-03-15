import { ClientChatPage } from "@/components/dashboard/chat/ClientChatPage";
import { ChatPage } from "@/components/dashboard/chat/ChatPage";

export default async function ChatPageRoute({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;

  return (
    <div className="w-full">
      {role === "client" ? <ClientChatPage /> : <ChatPage />}
    </div>
  );
}
