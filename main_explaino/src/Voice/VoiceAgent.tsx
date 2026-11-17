import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Maximize2,
  Minimize2,
  BookOpen
} from 'lucide-react';

export interface VoiceAgentProps {
  initialTopic?: string;
  onClose?: () => void;
  onNavigateToTopic?: (topic: string) => void;
  className?: string;
}

interface ChatMessage {
  id: string;
  role: 'student' | 'exo';
  text: string;
  timestamp: string;
  concepts?: string[];
  gaps?: string[];
}

const CURRICULUM_PROMPTS = [
  { id: 'photosynthesis', label: '🌿 Photosynthesis & Light Reactions', prompt: "Can you explain how chloroplasts convert sunlight and water into energy during light reactions?" },
  { id: 'electricity', label: '⚡ Ohm\'s Law & Resistance', prompt: "What really happens to electric current when resistance increases in a circuit?" },
  { id: 'cell_division', label: '🧬 Mitosis & Cell Division', prompt: "How do chromosomes duplicate and separate accurately during cell division?" },
  { id: 'quadratics', label: '📐 Quadratic Equations & Roots', prompt: "Can you explain what the discriminant b² - 4ac tells us about the roots of a parabola?" }
];

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

export const VoiceAgent: React.FC<VoiceAgentProps> = ({
  initialTopic = 'Photosynthesis & Light Reactions',
  onClose,
  onNavigateToTopic,
  className = '',
}) => {
  const [topic, setTopic] = useState(initialTopic);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [transcript, setTranscript] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'exo',
      text: "Hi, I'm EXO! I learn by having you teach me. Pick a concept or start speaking—explain it to me in your own words, and I'll test your explanation!",
      timestamp: 'Just now'
    }
  ]);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  // Setup Web Speech API (Recognition)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        setInputText(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Text-to-Speech (TTS)
  const speakText = (text: string) => {
    if (!isSoundEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Clean markdown symbols for cleaner pronunciation
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 1.05;

    // Try finding a friendly natural voice
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira')));
    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Microphone recognition is not supported in this browser. You can still type your explanation!");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn("Recognition already started or error:", err);
      }
    }
  };

  // Send explanation to EXO
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isAiThinking) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setInputText('');
    setTranscript('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'student',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsAiThinking(true);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `You are EXO, an intelligent, enthusiastic, voice-first Socratic STEM tutor for school students (Classes 9-10).
The student is using the Feynman Learning Technique: they learn by teaching the concept to you in their own words.
Active Topic: ${topic}
Guidelines:
1. Keep your reply concise (2 to 3 sentences maximum) so it is clear and punchy when spoken aloud.
2. Validate what they explained correctly with encouraging enthusiasm.
3. If they missed an important detail or held a misconception, explain the correction gently.
4. End with one thought-provoking follow-up question to test their deeper logic.`
            },
            ...messages.slice(-6).map(m => ({
              role: m.role === 'student' ? 'user' : 'assistant',
              content: m.text
            })),
            { role: "user", content: text }
          ],
          temperature: 0.7,
          max_tokens: 220
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API returned ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.choices?.[0]?.message?.content || "That's a good start! Could you elaborate a bit more on how that mechanism works?";

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'exo',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        concepts: text.length > 30 ? ['Concept Explored', 'Logic Evaluated'] : undefined
      };

      setMessages(prev => [...prev, aiMsg]);
      speakText(replyText);
    } catch (err) {
      console.error("EXO AI Error:", err);
      const fallbackReply = "That's an interesting explanation! Let's examine: how does this process connect to the main conservation laws in nature?";
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'exo',
        text: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
      speakText(fallbackReply);
    } finally {
      setIsAiThinking(false);
    }
  };

  return (
    <div
      className={`relative w-full ${
        isExpanded ? 'max-w-[96vw] h-[93vh]' : 'max-w-5xl h-[84vh]'
      } bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-purple-200/80 flex flex-col overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* ── 1. HEADER BAR ── */}
      <header className="h-16 px-6 border-b border-purple-100 bg-white/90 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6366F1] via-[#7C5CFF] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-purple-500/25 ${isSpeaking ? 'animate-bounce' : ''}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            {isSpeaking && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-ping" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-[#1E1926]">
                EXO Voice Feynman Agent
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#7C5CFF] border border-purple-200/60">
                Spoken Dialogue
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Active Topic: <span className="font-semibold text-purple-700">{topic}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Mute/Unmute Speech Output */}
          <button
            onClick={() => {
              if (isSoundEnabled && typeof window !== 'undefined') window.speechSynthesis?.cancel();
              setIsSoundEnabled(prev => !prev);
            }}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isSoundEnabled ? 'text-purple-600 bg-purple-50 hover:bg-purple-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
            }`}
            title={isSoundEnabled ? "Mute EXO Voice" : "Enable EXO Voice Output"}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Reset Conversation */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
              setMessages([
                {
                  id: 'welcome_reset',
                  role: 'exo',
                  text: "Reset complete! What concept would you like to explain to me now?",
                  timestamp: 'Just now'
                }
              ]);
            }}
            className="p-2 rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-all cursor-pointer"
            title="Clear Chat History"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Expand / Minimize Window */}
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-2 rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-all cursor-pointer hidden sm:flex"
            title={isExpanded ? "Minimize" : "Expand Full View"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Modal */}
          {onClose && (
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer ml-1"
              title="Close Voice Agent"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* ── 2. QUICK TOPIC SELECTION PILLS ── */}
      <div className="px-6 py-2.5 bg-purple-50/60 border-b border-purple-100/60 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5 text-purple-600" /> Topics:
        </span>
        {CURRICULUM_PROMPTS.map(p => (
          <button
            key={p.id}
            onClick={() => {
              setTopic(p.label);
              handleSendMessage(`Let's discuss ${p.label}. ${p.prompt}`);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              topic === p.label
                ? 'bg-[#7C5CFF] text-white shadow-xs'
                : 'bg-white hover:bg-purple-100 text-slate-700 border border-purple-200/60'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── 3. CHAT MESSAGE STREAM WORKSPACE ── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 [scrollbar-width:none]">
        {messages.map(m => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'student' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[11px] font-bold text-slate-400">
                {m.role === 'student' ? 'You (Explaining)' : 'EXO (Listener & Evaluator)'}
              </span>
              <span className="text-[10px] text-slate-400">{m.timestamp}</span>
            </div>

            <div
              className={`max-w-xl p-4 rounded-3xl text-sm leading-relaxed shadow-xs ${
                m.role === 'student'
                  ? 'bg-gradient-to-r from-[#7C5CFF] to-[#6366F1] text-white rounded-tr-xs'
                  : 'bg-white text-slate-800 border border-purple-100 rounded-tl-xs'
              }`}
            >
              {m.text}

              {m.concepts && m.concepts.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-purple-200/30 flex items-center gap-1.5 flex-wrap">
                  {m.concepts.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-300" /> {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isAiThinking && (
          <div className="flex items-center gap-2.5 text-xs text-purple-600 font-semibold p-3 bg-purple-50/80 rounded-2xl w-fit">
            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span>EXO is evaluating your explanation...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── 4. SPEECH WAVE & INTERACTION BAR ── */}
      <footer className="p-4 sm:p-5 border-t border-purple-100 bg-white/90 shrink-0 space-y-3">
        {/* Live speech wave banner when listening or speaking */}
        {(isListening || isSpeaking) && (
          <div className="flex items-center justify-center gap-2 py-1.5 px-4 rounded-2xl bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 border border-purple-200/60 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#EC4899] animate-ping" />
            <span className="text-xs font-bold text-purple-900">
              {isListening ? "Listening to your explanation... Speak out loud!" : "EXO is speaking out loud..."}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Big Microphone Push-to-Talk Button */}
          <button
            onClick={toggleListening}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all shadow-md cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-500 shadow-rose-500/30 scale-105 animate-pulse'
                : 'bg-gradient-to-tr from-[#6366F1] to-[#7C5CFF] hover:opacity-95 shadow-purple-500/25 hover:scale-105'
            }`}
            title={isListening ? "Stop Microphone" : "Speak to EXO"}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Input for Typing as Alternative */}
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isListening ? "Listening... your voice will appear here" : "Or type your explanation to EXO here..."}
              className="w-full h-12 pl-4 pr-12 rounded-2xl bg-slate-50 border border-purple-100 focus:bg-white focus:border-purple-300 focus:ring-2 focus:ring-purple-200 outline-none text-sm text-slate-800 transition-all placeholder:text-slate-400"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isAiThinking}
              className="absolute right-2 w-8 h-8 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Send explanation"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
