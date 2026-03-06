import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  MessageCircle,
  Send,
  X,
  Paperclip,
  ChevronDown,
  Volume2,
  VolumeX,
  ArrowLeft,
  Mic, Anchor, Ship
} from "lucide-react";

// --- VOICE IMPORTS ---
import "regenerator-runtime/runtime";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

// --- Types ---
interface Message {
  sender: "user" | "bot";
  text: string;
  file?: {
    name: string;
    type: string;
    url?: string;
  };
}

// --- Configuration ---
const API_KEY = "AIzaSyDwfmbbGqI2gPPfhWbD9TK7m2RDB-K_tCA";
const SYSTEM_INSTRUCTION = `
    ROLE: You are the 'schepen-kring.nl' AI assistant.
    You are helpful, human, and extremely concise.
    
    

    TONE & STYLE:
    - INTRODUCTION: Greet warmly and excitedly, mention 'schepen-kring.nl' by name and always ask a user what they need.
    - CONCISE and FRIENDLY: Max 2 sentences. No paragraphs.
    - HUMAN: Use friendly language. Don't sound like a manual.
    Use contractions (we're, it's) and emojis.
    - ANALYZE: If a user asks about their shop, mention the Widget.
    If they want to save, mention the Portal. If a user wants to purchase, mention the cashback system in the widget.
    If a user wants to book, mention the booking system in the widget.
    - SLOGAN: Better Deals, Better Life.`;

const welcomeOptions = [
  { label: "What is schepen-kring.nl?", icon: "❓" },
  { label: "Contact support", icon: "💬" },
];

const ChatWidget: React.FC = () => {
  // --- State ---
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "chat">("home");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showNudge, setShowNudge] = useState(false);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // --- Voice Hooks & Refs ---
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();
  const autoSendTimer = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const welcomeContentRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isOpen) {
      const nudgeTimer = setTimeout(() => {
        setShowNudge(true);
      }, 5000);
      return () => clearTimeout(nudgeTimer);
    } else {
      setShowNudge(false);
    }
  }, [isOpen]);

  // --- EMOTIONAL VOICE ENGINE ---
  const playVoice = useCallback(
    (text: string, force: boolean = false) => {
      if (isMuted && !force) return;

      const cleanText = text.replace(
        /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF])/g,
        "",
      );

      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.pitch = text.includes("!") ? 1.15 : 1.0;
        utterance.rate = 1.05;
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
      }
    },
    [isMuted],
  );

  // Handle Reading last message when unmuting
  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // If unmuting, find the last bot message and read it
    if (!newMutedState) {
      const lastBotMsg = [...messages]
        .reverse()
        .find((m) => m.sender === "bot");
      if (lastBotMsg) {
        playVoice(lastBotMsg.text, true); // force reading since state might not have updated yet
      }
    } else {
      window.speechSynthesis.cancel();
    }
  };

  // --- VOICE SYNC & AUTO-SEND ---
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
      if (autoSendTimer.current) clearTimeout(autoSendTimer.current);

      autoSendTimer.current = setTimeout(() => {
        if (transcript.trim() && listening) {
          const finalTranscript = transcript;
          SpeechRecognition.stopListening();
          setInput("");
          resetTranscript();
          handleSend(finalTranscript);
        }
      }, 2000);
    }
  }, [transcript, listening]);

  // --- Handlers ---

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => setFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleListening = () => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true });
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend =
      typeof overrideInput === "string" ? overrideInput : input;

    if (!textToSend.trim() && !selectedFile) return;

    const userMessage: Message = { sender: "user", text: textToSend };
    if (selectedFile) {
      userMessage.file = {
        name: selectedFile.name,
        type: selectedFile.type,
        url: filePreview || undefined,
      };
    }
    setMessages((prev) => [...prev, userMessage]);

    const currentFile = selectedFile;
    const currentPreview = filePreview;

    setInput("");
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsTyping(true);

    try {
      const history = messages.map((msg) => ({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      }));

      const userParts: any[] = [{ text: textToSend }];

      if (
        currentFile &&
        currentFile.type.startsWith("image/") &&
        currentPreview
      ) {
        const base64Data = currentPreview.split(",")[1];
        userParts.push({
          inlineData: {
            mimeType: currentFile.type,
            data: base64Data,
          },
        });
        userParts[0].text +=
          " (Please analyze the attached image in the context of this request.)";
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [...history, { role: "user", parts: userParts }],
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }],
            },
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 800,
            },
          }),
        },
      );

      if (!response.ok) throw new Error("API Request Failed");

      const data = await response.json();
      const botResponse =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I'm sorry, I couldn't process that request right now.";

      setMessages((prev) => [...prev, { sender: "bot", text: botResponse }]);
      playVoice(botResponse);
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "I'm having trouble connecting to the server. Please try again later.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleOptionClick = (option: string) => {
    setActiveTab("chat");
    setInput(option);
    setTimeout(() => handleSend(option), 200);
  };

return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .font-inter { font-family: 'Inter', sans-serif; }
        
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-enter { animation: fadeInScale 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        
        .glass-panel {
          background: #0d0d0d;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(197, 165, 114, 0.2);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
        }
        
        .gradient-header { 
          background: #000000;
          border-bottom: 1px solid rgba(197, 165, 114, 0.2);
        }
        
        .msg-bubble-user {
          background: #c5a572;
          color: black;
          font-weight: 500;
        }
        
        .msg-bubble-bot {
          background: #1a1a1a;
          color: #e5e7eb;
          border: 1px solid rgba(255,255,255,0.05);
        }
        
        .nudge-popup {
          animation: bounceIn 0.5s ease forwards;
          background: #0d0d0d;
          border: 1px solid #c5a572;
        }

        
        @keyframes bounceIn {
          0% { opacity: 0; transform: translateY(10px) scale(0.9); }
          70% { transform: translateY(-5px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Launcher & Tiny Popup Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
        {showNudge && !isOpen && (
          <div className="nudge-popup px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 w-64">
            <div className="w-8 h-8 bg-[#c5a572] rounded-lg flex items-center justify-center shrink-0">
              <Anchor size={16} className="text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#c5a572] leading-tight">
                Fleet Concierge
              </span>
              <span className="text-[11px] text-gray-400 leading-tight">
                Seeking a specific vessel? 👋
              </span>
            </div>
            <button
              onClick={() => setShowNudge(false)}
              className="ml-auto text-gray-600 hover:text-white"
            >
              <X size={14} />
            </button>
            <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-[#0d0d0d] rotate-45 border-r border-b border-[#c5a572]"></div>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 bg-[#c5a572] text-black flex items-center justify-center group relative"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <MessageCircle className="w-7 h-7" />
          )}
          {!isOpen && (
            <span className="absolute inset-0 rounded-full bg-[#c5a572] opacity-40 animate-ping"></span>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[90vw] max-w-[400px] h-[650px] max-h-[80vh] flex flex-col font-inter rounded-2xl overflow-hidden animate-enter glass-panel z-[9998]">
          <div className="relative p-5 gradient-header shrink-0">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                {activeTab === "chat" && (
                  <button
                    onClick={() => setActiveTab("home")}
                    className="hover:bg-white/10 p-1.5 rounded-full transition-colors"
                  >
                    <ArrowLeft size={20} className="text-[#c5a572]" />
                  </button>
                )}
                <div className="flex items-center gap-4 group">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-sm border border-[#c5a572]/30">
                      <Ship size={20} className="text-[#c5a572]" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-black rounded-full flex items-center justify-center border border-[#c5a572]/20">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    </span>
                  </div>
                  <div className="flex flex-col items-start">
                    <h2 className="font-bold text-sm tracking-[0.2em] uppercase">
                      Fleet AI
                    </h2>
                    <span className="text-[9px] text-[#c5a572] font-black uppercase tracking-widest">Online Assistant</span>
                  </div>
                </div>
              </div>
              <button
                onClick={toggleMute}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400"
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative bg-black flex flex-col">
            {activeTab === "home" ? (
              <div
                ref={welcomeContentRef}
                className="flex-1 overflow-y-auto p-6 scrollbar-hide"
              >
                <div className="text-center mb-8 mt-4">
                  <h3 className="text-xl font-serif italic text-white mb-2">
                    Welcome to the Fleet
                  </h3>
                  <p className="text-gray-500 text-[10px] uppercase tracking-widest leading-relaxed">
                    Personalized sourcing for the world's finest vessels.
                  </p>
                </div>
                <div className="space-y-3">
                  {welcomeOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleOptionClick(opt.label)}
                      className="w-full flex items-center p-4 bg-[#0d0d0d] border border-white/5 rounded-xl hover:border-[#c5a572]/50 hover:bg-[#1a1a1a] transition-all duration-200 group text-left"
                    >
                      <span className="text-xl mr-4 group-hover:scale-110 transition-transform">
                        {opt.icon}
                      </span>
                      <span className="flex-1 text-[11px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">
                        {opt.label}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-700 -rotate-90 group-hover:text-[#c5a572] transition-colors" />
                    </button>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                  <button
                    onClick={() => setActiveTab("chat")}
                    className="inline-flex items-center justify-center px-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-[#c5a572] transition-colors shadow-xl"
                  >
                    Start Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide bg-[#050505]">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] px-5 py-3.5 text-sm leading-relaxed shadow-lg relative ${msg.sender === "user" ? "msg-bubble-user rounded-2xl rounded-tr-sm" : "msg-bubble-bot rounded-2xl rounded-tl-sm"}`}
                      >
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                        {msg.file && (
                          <div
                            className={`mt-3 p-2 rounded-lg flex items-center gap-3 ${msg.sender === "user" ? "bg-black/20" : "bg-black/40 border border-white/10"}`}
                          >
                            {msg.file.type.startsWith("image/") &&
                            msg.file.url ? (
                              <img
                                src={msg.file.url}
                                alt="Uploaded"
                                className="h-12 w-12 object-cover rounded-md bg-black"
                              />
                            ) : (
                              <Paperclip className="w-5 h-5 opacity-70" />
                            )}
                            <div className="flex flex-col overflow-hidden">
                              <span className="truncate font-bold text-[10px] uppercase">
                                {msg.file.name}
                              </span>
                              <span className="text-[9px] opacity-50 uppercase tracking-tighter">
                                Attached Spec
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start w-full">
                      <div className="bg-[#1a1a1a] border border-white/5 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-[#c5a572] rounded-full animate-bounce [animation-delay:-0.32s]"></span>
                        <span className="w-1.5 h-1.5 bg-[#c5a572] rounded-full animate-bounce [animation-delay:-0.16s]"></span>
                        <span className="w-1.5 h-1.5 bg-[#c5a572] rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-black border-t border-white/5 relative z-20">
                  {selectedFile && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 p-3 bg-[#1a1a1a] rounded-xl shadow-2xl border border-[#c5a572]/30 flex items-center justify-between animate-enter">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {filePreview &&
                        selectedFile.type.startsWith("image/") ? (
                          <img
                            src={filePreview}
                            alt="Preview"
                            className="w-10 h-10 object-cover rounded-lg border border-white/10"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-[#c5a572]">
                            <Paperclip size={20} />
                          </div>
                        )}
                        <div className="flex flex-col truncate">
                          <span className="text-[10px] font-black text-white uppercase truncate">
                            {selectedFile.name}
                          </span>
                          <span className="text-[9px] text-[#c5a572]">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveFile}
                        className="p-1 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-full transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleFileChange}
                      accept="image/*,.pdf,.doc,.docx"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-gray-600 hover:text-[#c5a572] hover:bg-white/5 rounded-full transition-colors mb-0.5"
                    >
                      <Paperclip size={20} />
                    </button>
                    <div className="flex-1 relative">
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder={
                          listening
                            ? "Listening..."
                            : "Type your inquiry..."
                        }
                        className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c5a572]/50 transition-all resize-none max-h-32 min-h-[46px] placeholder:text-gray-700"
                        rows={1}
                      />
                    </div>
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() && !selectedFile}
                      className="p-2.5 bg-[#c5a572] text-black rounded-full shadow-lg hover:bg-white transition-all disabled:opacity-20 mb-0.5"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-[8px] text-gray-700 font-black uppercase tracking-[0.3em]">
                      Schepen-Kring Secure Terminal
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
