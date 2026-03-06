import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

export function EmptyChatState() {
  return (
    <div className="hidden md:flex md:flex-1 md:flex-col md:items-center md:justify-center bg-white p-8">
      <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
        <MessageSquare className="w-12 h-12 text-blue-500" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Message someone and chat right now!</h2>
      <Button className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 rounded-full">Send Message</Button>
    </div>
  )
}
