import { MessageSquare, Zap, Shield, Clock } from "lucide-react"

export function EmptyState() {
  const features = [
    {
      icon: Zap,
      title: "Fast Responses",
      description: "Get instant answers to your questions",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your conversations are protected",
    },
    {
      icon: Clock,
      title: "24/7 Available",
      description: "Chat anytime, anywhere",
    },
  ]

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-8 h-8 text-blue-600" />
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Welcome to Chat Assistant</h2>

        <p className="text-gray-600 mb-8">
          Start a conversation by typing a message below. I'm here to help with any questions you might have.
        </p>

        <div className="grid gap-4">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 text-sm">{feature.title}</h3>
                <p className="text-gray-600 text-xs">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
