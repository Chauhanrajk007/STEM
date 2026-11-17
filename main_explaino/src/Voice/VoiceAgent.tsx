import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  ExternalLink,
  Mic,
  Maximize2,
  Minimize2,
  Sparkles,
  AlertCircle,
  Settings,
  Check
} from 'lucide-react';

export interface VoiceAgentProps {
  initialTopic?: string;
  onClose?: () => void;
  onNavigateToTopic?: (topic: string) => void;
  className?: string;
}

export const VoiceAgent: React.FC<VoiceAgentProps> = ({
  initialTopic = 'Photosynthesis',
  onClose,
  onNavigateToTopic,
  className = '',
}) => {
  // Configured Voice Agent URL
  const defaultUrl = import.meta.env.VITE_VOICE_AGENT_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'http://localhost:3000');
  const [voiceAgentUrl, setVoiceAgentUrl] = useState<string>(() => {
    return localStorage.getItem('exo_voice_agent_url') || defaultUrl;
  });

  const [iframeKey, setIframeKey] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(voiceAgentUrl);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [iframeKey, voiceAgentUrl]);

  const handleRefresh = () => {
    setIsLoaded(false);
    setHasError(false);
    setIframeKey((prev) => prev + 1);
  };

  const handleSaveUrl = () => {
    const trimmed = customUrlInput.trim();
    if (trimmed) {
      setVoiceAgentUrl(trimmed);
      localStorage.setItem('exo_voice_agent_url', trimmed);
      setShowConfig(false);
      handleRefresh();
    }
  };

  return (
    <div
      className={`relative w-full ${
        isExpanded ? 'max-w-[96vw] h-[93vh]' : 'max-w-5xl h-[84vh]'
      } bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-purple-200/80 flex flex-col overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* ── 1. HEADER BAR ── */}
      <header className="h-14 px-5 border-b border-purple-100 bg-white/90 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#6366F1] via-[#7C5CFF] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-purple-500/25">
              <Mic className="w-4 h-4" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight text-[#1E1926]">
                EXO Voice Agent
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#7C5CFF] border border-purple-200/60 hidden sm:inline-block">
                Apu-g/voiceagent
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Host: <code className="text-purple-700 bg-purple-50 px-1 py-0.5 rounded">{voiceAgentUrl}</code>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Configure URL toggle */}
          <button
            onClick={() => setShowConfig((prev) => !prev)}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              showConfig ? 'text-purple-700 bg-purple-100' : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
            }`}
            title="Configure Voice Agent Endpoint"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-all cursor-pointer"
            title="Reload Voice Agent"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Expand / Minimize Window */}
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-2 rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-all cursor-pointer hidden sm:flex"
            title={isExpanded ? 'Restore window size' : 'Expand full window'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Pop out to standalone tab */}
          <a
            href={voiceAgentUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-all cursor-pointer"
            title="Open in new window"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer ml-1"
              title="Return to Dashboard"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* ── 2. OPTIONAL CONFIGURATION DRAWER ── */}
      {showConfig && (
        <div className="px-5 py-3 bg-purple-50/90 border-b border-purple-100 flex items-center gap-3 text-xs z-30 animate-in fade-in">
          <span className="font-semibold text-slate-700 shrink-0">Voice Agent URL:</span>
          <input
            type="text"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            placeholder="http://localhost:3000 or https://your-voice-agent.vercel.app"
            className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-purple-200 outline-none text-slate-800 focus:ring-1 focus:ring-purple-400 font-mono text-xs"
          />
          <button
            onClick={handleSaveUrl}
            className="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-all flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Check className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      )}

      {/* ── 3. IFRAME WORKSPACE HOSTING APU-G/VOICEAGENT ── */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-50">
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs z-10 space-y-3">
            <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-600">
              Connecting to EXO Voice Agent ({voiceAgentUrl})...
            </p>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 z-20 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 mb-3">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-slate-800">
              Voice Agent Offline ({voiceAgentUrl})
            </h2>
            <p className="text-xs text-slate-600 max-w-md mt-1">
              Could not connect to the Next.js Voice Agent.
              If running locally, ensure <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700">npm run dev:voice</code> is running.
              If on Vercel, deploy <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700">voice_agent</code> and set its live URL using the ⚙️ icon above.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold text-xs shadow-md shadow-purple-500/20 hover:bg-purple-700 transition-all cursor-pointer"
              >
                Retry Connection
              </button>
              <a
                href={voiceAgentUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all"
              >
                Open Directly
              </a>
            </div>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={voiceAgentUrl}
          title="EXO Voice Agent (Apu-g/voiceagent)"
          className="w-full h-full border-none"
          allow="microphone; speech-recognition; camera; clipboard-read; clipboard-write; autoplay; display-capture"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      </div>
    </div>
  );
};
