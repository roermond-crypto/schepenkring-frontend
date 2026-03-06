import { ChatPage } from "@/components/dashboard/chat/ChatPage";

export default function ChatPageRoute() {
    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Support Chat</h1>
                <p className="text-slate-500 mt-2">Manage customer conversations and inquiries</p>
            </div>
            <ChatPage />
        </div>
    );
}
