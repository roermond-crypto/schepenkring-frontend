import { ChatPage } from "@/components/dashboard/chat/ChatPage";

export default function ChatPageRoute() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Support Chat
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Manage customer conversations and inquiries
        </p>
      </div>
      <ChatPage />
    </div>
  );
}
