import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { getBotResponse } from '../utils/assistantBot';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

/** Quick replies mirroring the Android chatbot's suggestion chips. */
const QUICK_QUERIES = [
  { label: 'Report an issue', query: 'How to report a pothole or leak?' },
  { label: 'Emergency SOS', query: 'Emergency SOS police fire numbers' },
  { label: 'Load shedding', query: 'Load shedding stage power status' },
  { label: 'Water leak', query: 'Water leak burst pipe report' },
  { label: 'Hero Points', query: 'How do Hero Points work?' },
];

export function CitizenAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Sawubona! 👋 I'm your MzansiReport assistant. How can I help you today?",
      sender: 'bot',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: input,
      sender: 'user',
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setTyping(true);

    // Matches the Android ChatbotFragment's 1s "typing" delay.
    setTimeout(() => {
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        text: getBotResponse(userMessage.text),
        sender: 'bot',
      };
      setMessages((prev) => [...prev, botMessage]);
      setTyping(false);
    }, 1000);
  };

  const sendQuickQuery = (query: string) => {
    setInput(query);
    if (!query.trim()) return;
    const userMessage: Message = { id: `user-${Date.now()}`, text: query, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, text: getBotResponse(query), sender: 'bot' },
      ]);
      setTyping(false);
    }, 1000);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-[#173d3c] text-white font-bold shadow-2xl hover:bg-[#176b5b] active:scale-95 transition-all"
        aria-label="Citizen Assistant"
      >
        <Bot className="w-6 h-6" />
        <span className="hidden sm:inline">Assistant</span>
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 left-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[70vh]">
          <div className="bg-gradient-to-r from-[#173d3c] to-[#176b5b] p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Citizen Assistant</h3>
                <p className="text-xs text-white/80">Help assistant</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#1e5a7d] text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 pt-3 pb-2 border-t border-gray-200 bg-white flex gap-2 overflow-x-auto">
            {QUICK_QUERIES.map((chip) => (
              <button
                key={chip.label}
                onClick={() => sendQuickQuery(chip.query)}
                className="shrink-0 px-3 py-1.5 rounded-full border border-[#1e5a7d]/30 text-[#1e5a7d] text-xs font-medium hover:bg-[#1e5a7d]/10 transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-gray-200 bg-white flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a7d] text-sm"
            />
            <button
              onClick={handleSend}
              className="px-4 py-2.5 rounded-xl bg-[#1e5a7d] text-white hover:bg-[#162f4d] transition-colors"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
