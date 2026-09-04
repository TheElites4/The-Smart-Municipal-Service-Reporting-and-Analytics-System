import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

const RESPONSES: { keywords: string[]; response: string }[] = [
  {
    keywords: ['hello', 'hi', 'hey', 'sawubona', 'molweni'],
    response:
      "Sawubona! 👋 I'm the MzansiReport assistant. I can help with reporting issues, emergency contacts, and municipal services. How can I help?",
  },
  {
    keywords: ['report', 'submit', 'new'],
    response:
      'To submit a report 📋: Tap "New Report" on your dashboard, choose a category, describe the issue, add your location, and submit. AI will help detect the category from your description!',
  },
  {
    keywords: ['emergency', 'sos', 'police', 'fire', 'ambulance', 'medical'],
    response:
      'For emergencies 🚨: Police - 10111, Fire - 10177, Medical - 10177. You can also tap the red SOS button on any screen for quick access!',
  },
  {
    keywords: ['loadshedding', 'load shedding', 'power', 'electricity', 'stage'],
    response:
      'Load shedding ⚡ information is available on your dashboard. Check the Service Status Board for live power status by area and the load-shedding banner for the current stage.',
  },
  {
    keywords: ['water', 'leak', 'outage'],
    response:
      'Water issues 💧: Report water leaks or outages through the "New Report" form. Check the Service Status Board for live water status in your municipality.',
  },
  {
    keywords: ['track', 'status', 'progress'],
    response:
      'To track your report 📊: Go to "My Reports" on your dashboard and tap any report to see its progress timeline and SLA countdown.',
  },
  {
    keywords: ['municipality', 'contact', 'phone', 'call'],
    response:
      'You can find all major SA municipality contact details in the Municipality Directory. The most common emergency numbers are Police 10111, Fire 10177, and Medical 10177.',
  },
  {
    keywords: ['sos', 'help', 'assist'],
    response:
      'I can help you with municipal issues! Ask me about reporting, tracking, emergencies, load shedding, water, or municipality contacts.',
  },
  {
    keywords: ['points', 'hero', 'badge', 'level', 'gam'],
    response:
      '🏆 Community Hero Points! You earn 10 points for each report you submit and 2 points for each "Me Too" upvote. Level up from Bronze → Silver → Gold → Platinum → Diamond!',
  },
  {
    keywords: ['community', 'feed', 'upvote', 'me too'],
    response:
      'The Community Feed 👥 shows what your neighbours are reporting, sorted by popularity. Use "Me Too" to upvote issues you also face - this earns you hero points!',
  },
  {
    keywords: ['thank', 'thanks', 'bye', 'goodbye'],
    response:
      "You're welcome! 🇿🇦 Together we're building better communities. Ask me anything about MzansiReport anytime!",
  },
];

const DEFAULT_RESPONSE =
  "I'm not sure about that yet, but you can ask me about reporting issues, tracking progress, emergency contacts, load shedding, water status, municipality contacts, or community hero points!";

function getBotResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const item of RESPONSES) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      return item.response;
    }
  }
  return DEFAULT_RESPONSE;
}

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
                <p className="text-xs text-white/80">AI-powered help</p>
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
