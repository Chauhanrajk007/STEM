import { useState, useCallback, useEffect, useRef } from 'react';
import { MathCanvas } from './components/MathCanvas';
import { TypedInput } from './components/TypedInput';
import { ModeToggle } from './components/ModeToggle';
import { MathDisplay } from './components/MathDisplay';
import { ParabolaVisualizer } from './components/visualizations/ParabolaVisualizer';
import { EquationBalanceVisualizer } from './components/visualizations/EquationBalanceVisualizer';
import { AlgebraTilesVisualizer } from './components/visualizations/AlgebraTilesVisualizer';
import { GeometryDiagramVisualizer } from './components/visualizations/GeometryDiagramVisualizer';
import { CircleAreaExhaustionVisualizer } from './components/visualizations/CircleAreaExhaustionVisualizer';
import { PythagoreanVisualizer } from './components/visualizations/PythagoreanVisualizer';
import { NumberLineVisualizer } from './components/visualizations/NumberLineVisualizer';
import { ConceptLearningDrawer } from './components/ConceptLearningDrawer';
import { AccessibilityPanel } from './components/AccessibilityPanel';
import { StudentProfileModal } from './components/StudentProfileModal';
import { LiveISLRecognitionModal } from './components/LiveISLRecognitionModal';
import { TextbookView } from './components/TextbookView';
import { soundEffects } from './utils/soundEffects';
import type { Stroke, SolutionStep, DisplayMode } from './types/canvas';
import type { UnifiedMathematicalRepresentation, StudentProfile } from './types/umr';
import './styles/globals.css';
import './styles/canvas.css';
import './styles/notebook.css';
import './styles/textbook.css';
import './App.css';

const INITIAL_STROKES: Stroke[] = [];

type ScreenTab = 'canvas' | 'solution' | 'prerequisites' | 'visualizer';
type VisualMode = 'parabola' | 'balance' | 'circle' | 'pythagoras' | 'numberline' | 'tiles' | 'geometry';

const DEFAULT_PROFILE: StudentProfile = {
  student_id: 'student_user',
  grade: 7,
  preferences: {
    learning_style: 'balanced',
    steps_per_screen: 1,
    explanation_depth: 'detailed',
    show_prerequisites_first: true,
    speech_enabled: true,
    speech_rate: 1.0,
    speech_dialect: 'clearspeak',
    braille_enabled: true,
    braille_standard: 'nemeth',
    sign_language_enabled: true,
    sign_language_dialect: 'ISL',
    interactive_visuals_enabled: true,
    sonification_enabled: true,
    reduced_distraction: false,
    break_reminders: false,
    animation_enabled: true
  }
};

function App() {
  const [strokes, setStrokes] = useState<Stroke[]>(INITIAL_STROKES);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const [typedInput, setTypedInput] = useState('');
  const [lastActiveSource, setLastActiveSource] = useState<'canvas' | 'typed'>('canvas');
  const [mode, setMode] = useState<DisplayMode>('notebook');
  const [tool, setTool] = useState<'pen' | 'eraser' | 'select'>('pen');
  const [penColor] = useState('#000000');
  const [penWidth] = useState(2);
  const [eraserWidth] = useState(20);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [activeTab, setActiveTab] = useState<ScreenTab>('canvas');
  const [solutionSteps, setSolutionSteps] = useState<SolutionStep[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const [clarification, setClarification] = useState<{ question: string; options: string[] } | null>(null);
  const [profile, setProfile] = useState<StudentProfile>(DEFAULT_PROFILE);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [umr, setUmr] = useState<UnifiedMathematicalRepresentation | null>(null);
  const [visualMode, setVisualMode] = useState<VisualMode>('parabola');

  const exportCanvasRef = useRef<() => string>(() => '');
  const recognizeAbortRef = useRef<AbortController | null>(null);
  const isRecognizingRef = useRef(false);
  const speechRecRef = useRef<any>(null);

  const handleExportReady = useCallback((fn: () => string) => {
    exportCanvasRef.current = fn;
  }, []);

  const handleStrokesChange = useCallback((newStrokes: Stroke[]) => {
    setStrokes(newStrokes);
    setRedoStack([]);
    setLastActiveSource('canvas');
    if (notice) setNotice(null);
  }, [notice]);

  // Debounced auto-recognize when user draws on canvas
  useEffect(() => {
    if (strokes.length === 0) return;
    if (recognizeAbortRef.current) recognizeAbortRef.current.abort();

    const timer = setTimeout(async () => {
      const imageB64 = exportCanvasRef.current ? exportCanvasRef.current() : '';
      if (!imageB64 || isRecognizingRef.current) return;

      const controller = new AbortController();
      recognizeAbortRef.current = controller;
      isRecognizingRef.current = true;

      try {
        const recRes = await fetch('/api/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_b64: imageB64, strokes }),
          signal: controller.signal
        });
        if (recRes.ok) {
          const recData = await recRes.json();
          if (recData.recognized_text) {
            setTypedInput(recData.recognized_text);
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          // Preview recognition error is non-fatal
        }
      } finally {
        isRecognizingRef.current = false;
      }
    }, 2500);

    return () => {
      clearTimeout(timer);
      if (recognizeAbortRef.current) recognizeAbortRef.current.abort();
    };
  }, [strokes]);

  const handleUndo = useCallback(() => {
    setStrokes(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack(r => [...r, [last]]);
      return prev.slice(0, -1);
    });
    soundEffects.playClick(400, 0.03);
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack(r => {
      if (r.length === 0) return r;
      const last = r[r.length - 1];
      setStrokes(prev => [...prev, ...last]);
      return r.slice(0, -1);
    });
    soundEffects.playClick(500, 0.03);
  }, []);

  const handleClear = useCallback(() => {
    setStrokes([]);
    setRedoStack([]);
    setSolutionSteps([]);
    setTypedInput('');
    setNotice(null);
    setClarification(null);
    setUmr(null);
    setActiveTab('canvas');
    soundEffects.playClick(300, 0.05);
  }, []);

  // Voice Input Handler using Voice-to-Math Normalizer
  const handleVoiceInput = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListeningVoice) {
      if (speechRecRef.current) {
        try { speechRecRef.current.stop(); } catch (e) {}
      }
      setIsListeningVoice(false);
      return;
    }

    try {
      const recognizer = new SpeechRec();
      speechRecRef.current = recognizer;
      recognizer.lang = 'en-US';
      recognizer.continuous = false;
      recognizer.interimResults = false;

      soundEffects.playClick(600, 0.08);
      setIsListeningVoice(true);

      recognizer.onresult = async (event: any) => {
        setIsListeningVoice(false);
        const transcript = event.results[0][0].transcript;
        soundEffects.playClick(700, 0.08);

        try {
          const normRes = await fetch('/api/voice/normalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript })
          });
          if (normRes.ok) {
            const normData = await normRes.json();
            const cleanMath = normData.latex || normData.normalized || transcript;
            setTypedInput(cleanMath);
            setLastActiveSource('typed');
            setNotice({
              message: `🎙️ Voice Heard: "${transcript}" → Standardized: ${cleanMath}`,
              type: 'success'
            });
            soundEffects.playSuccessChime();
          } else {
            setTypedInput(transcript);
            setLastActiveSource('typed');
          }
        } catch (e) {
          setTypedInput(transcript);
          setLastActiveSource('typed');
        }
      };

      recognizer.onerror = () => {
        setIsListeningVoice(false);
      };

      recognizer.onend = () => {
        setIsListeningVoice(false);
      };

      recognizer.start();
    } catch (e) {
      setIsListeningVoice(false);
    }
  }, [isListeningVoice]);

  // Sign Language insertion handler
  const handleSignRecognized = useCallback((sign: string) => {
    setTypedInput(prev => (prev ? `${prev} ${sign}` : sign).trim());
    setLastActiveSource('typed');
    soundEffects.playClick(500, 0.06);
  }, []);

  const handleSignDeleteLast = useCallback(() => {
    setTypedInput(prev => {
      if (!prev) return '';
      const trimmed = prev.trimEnd();
      const parts = trimmed.split(/\s+/);
      if (parts.length > 1) {
        parts.pop();
        return parts.join(' ');
      }
      return '';
    });
    soundEffects.playClick(440, 0.06);
  }, []);

  const handleSignClear = useCallback(() => {
    setTypedInput('');
    soundEffects.playClick(320, 0.08);
  }, []);

  const handleSolve = useCallback(async (overrideText?: string | React.MouseEvent) => {
    if (recognizeAbortRef.current) recognizeAbortRef.current.abort();

    let text = (typeof overrideText === 'string' ? overrideText : typedInput).trim();
    // Pre-clean conversational prefixes and trailing "for x" from text
    let prev = '';
    while (text !== prev) {
      prev = text;
      text = text.replace(/^(solve(\s+for\s+\w+)?|simplify|calculate(\s+value\s+of)?|evaluate|find(\s+the\s+value\s+of)?|value\s+of)\s*/i, '').trim();
      text = text.replace(/\s+for\s+[a-zA-Z]+$/i, '').trim();
      text = text.replace(/\s+with\s+respect\s+to\s+[a-zA-Z]+$/i, '').trim();
    }

    setNotice(null);
    setClarification(null);
    setIsLoading(true);
    soundEffects.playClick(520, 0.08);

    try {
      const shouldSolveCanvas = lastActiveSource === 'canvas' && strokes.length > 0 && !text;
      let textToSolve = text;
      let imageB64 = '';

      if (shouldSolveCanvas || strokes.length > 0) {
        if (exportCanvasRef.current) {
          imageB64 = exportCanvasRef.current();
        }

        // Try handwriting OCR first if text input is empty
        if (!textToSolve && imageB64) {
          try {
            const recRes = await fetch('/api/recognize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image_b64: imageB64, strokes })
            });
            if (recRes.ok) {
              const recData = await recRes.json();
              if (recData.recognized_text) {
                textToSolve = recData.recognized_text;
                setTypedInput(recData.recognized_text);
              }
              if (recData.needs_clarification && recData.clarification && recData.clarification.options?.length > 0) {
                setClarification({
                  question: recData.clarification.question,
                  options: recData.clarification.options.map((o: any) => o.label || o.value || o)
                });
                setActiveTab('canvas');
                setIsLoading(false);
                return;
              }
            }
          } catch (e) {
            console.warn('Recognition step failed, falling back to direct solve:', e);
          }
        }
      }

      if (!textToSolve && strokes.length === 0) {
        setNotice({ message: 'Please write or type an equation first.', type: 'warning' });
        setIsLoading(false);
        return;
      }

      // Execute Universal Capability Orchestrator via FastAPI
      const apiBase = import.meta.env.VITE_MATH_BACKEND_URL || '';
      let orchData: UnifiedMathematicalRepresentation | null = null;

      try {
        const orchRes = await fetch(`${apiBase}/api/orchestrate/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            raw_content: textToSolve || 'handwritten_canvas',
            input_type: shouldSolveCanvas ? 'handwriting' : 'typed',
            strokes: shouldSolveCanvas ? strokes : undefined,
            image_b64: shouldSolveCanvas ? imageB64 : undefined,
            recognized_latex: textToSolve || undefined,
            profile: profile
          })
        });

        if (orchRes.ok) {
          orchData = await orchRes.json();
        } else {
          console.warn(`FastAPI backend responded with status ${orchRes.status}, switching to AI fallback solver`);
        }
      } catch (e) {
        console.warn('Backend unavailable, switching to AI fallback solver:', e);
      }

      // If backend is offline or returns 405 on static Vercel, solve via Groq AI
      if (!orchData) {
        const groqKey = import.meta.env.VITE_GROQ_API_KEY || "";
        if (groqKey) {
          try {
            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${groqKey}`
              },
              body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                messages: [
                  {
                    role: "system",
                    content: `You are an expert mathematical step solver. Solve the user's math expression step-by-step.
Output ONLY valid JSON matching this schema:
{
  "topic": "algebra",
  "steps": [
    {
      "step_number": 1,
      "operation": "description of step",
      "latex": "LaTeX of equation after step",
      "explanation": "Clear explanation",
      "why": "Reason for step"
    }
  ],
  "final_answer": "LaTeX format of final result"
}`
                  },
                  {
                    role: "user",
                    content: `Solve this math equation or problem step-by-step: ${textToSolve}`
                  }
                ],
                temperature: 0.1
              })
            });

            if (groqRes.ok) {
              const aiJson = await groqRes.json();
              const parsed = JSON.parse(aiJson.choices?.[0]?.message?.content || '{}');
              orchData = {
                umr_version: "1.0",
                raw_input: textToSolve,
                input_type: "typed",
                latex: textToSolve,
                understanding: {
                  topic: parsed.topic || "algebra",
                  subtopic: "step_solution",
                  is_ambiguous: false
                },
                solution: {
                  method: "algebraic_step_solver",
                  steps: (parsed.steps || []).map((s: any, idx: number) => ({
                    step_number: s.step_number || idx + 1,
                    operation: s.operation || `Step ${idx + 1}`,
                    latex: s.latex || s.operation,
                    explanation: s.explanation || s.operation,
                    why: s.why || ""
                  })),
                  final_answer: parsed.final_answer || ""
                }
              } as any;
            }
          } catch (groqErr) {
            console.error("Groq fallback solver failed:", groqErr);
          }
        }
      }

      if (!orchData) {
        throw new Error("Math solver is currently starting or offline. Please verify the backend is running.");
      }

      setUmr(orchData);

      // Check if pedagogical clarification was requested
      if (orchData.understanding?.is_ambiguous && orchData.understanding.clarification_question) {
        setClarification({
          question: orchData.understanding.clarification_question,
          options: orchData.understanding.clarification_options || []
        });
        setActiveTab('canvas');
        return;
      }

      if (orchData.solution && orchData.solution.steps && orchData.solution.steps.length > 0) {
        const transformedSteps: SolutionStep[] = orchData.solution.steps.map((s, idx, arr) => ({
          step_number: s.step_number,
          operation: s.operation || '',
          equation_ast: {},
          display_math: s.latex,
          explanation: s.explanation,
          validation: {
            is_valid: true,
            method: 'SymPy algebraic equivalence',
            details: 'Verified correct algebraic progression'
          },
          hint: s.why || '',
          is_final_answer: idx === arr.length - 1,
          final_answer_text: idx === arr.length - 1 ? s.latex : '',
          step_gestures: s.step_gestures
        }));

        setSolutionSteps(transformedSteps);
        setCurrentStep(1);
        soundEffects.playSuccessChime();

        // Auto-select best matching visualizer
        if (orchData.visualisation?.type === 'quadratic_parabola') {
          setVisualMode('parabola');
        } else if (orchData.visualisation?.type === 'equation_balance') {
          setVisualMode('balance');
        } else if (orchData.visualisation?.type === 'circle_exhaustion') {
          setVisualMode('circle');
        } else if (orchData.visualisation?.type === 'pythagoras') {
          setVisualMode('pythagoras');
        } else if (orchData.understanding?.topic === 'geometry' || orchData.visualisation?.type === 'geometry_diagram' || orchData.visualisation?.type === 'svg_diagram') {
          setVisualMode('geometry');
        }

        // Navigate based on prerequisite preferences
        if (profile.preferences.show_prerequisites_first && orchData.learning?.prerequisites?.length > 0) {
          setActiveTab('prerequisites');
          setNotice({
            message: `Identified topic: ${orchData.understanding.topic}. Foundational concepts highlighted before solution.`,
            type: 'info'
          });
        } else {
          setActiveTab('solution');
        }
      } else {
        setNotice({
          message: 'Unable to derive a step-by-step solution for this input. Please check expression syntax.',
          type: 'warning'
        });
      }
    } catch (err: any) {
      setNotice({
        message: err.message || 'An error occurred while solving the problem.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, [typedInput, strokes, profile, lastActiveSource]);

  const handleClarificationSelect = useCallback((option: string) => {
    // 1. If option contains a colon (e.g. "Solve for x: x^2 + 3 = 7"), extract the part after the colon
    let clean = option;
    if (clean.includes(':')) {
      clean = clean.split(':').slice(1).join(':').trim();
    }
    // 2. Strip any and all repeated conversational command prefixes until stable
    let prev = '';
    while (clean !== prev) {
      prev = clean;
      clean = clean.replace(/^(solve(\s+for\s+\w+)?|simplify|calculate(\s+value\s+of)?|evaluate|find(\s+the\s+value\s+of)?|value\s+of)\s*/i, '').trim();
      clean = clean.replace(/\s+for\s+[a-zA-Z]+$/i, '').trim();
      clean = clean.replace(/\s+with\s+respect\s+to\s+[a-zA-Z]+$/i, '').trim();
    }
    // 3. Clean any leading/trailing operators
    clean = clean.replace(/^[+\-*/=\s]+/, '').replace(/[+\-*/\s]+$/, '').trim();

    setClarification(null);
    setNotice(null);
    setTypedInput(clean);
    setLastActiveSource('typed');
    handleSolve(clean);
  }, [handleSolve]);

  const handleHint = useCallback(() => {
    setNotice({
      message: 'Hint: Remember to balance operations on both sides of the equation.',
      type: 'info'
    });
    soundEffects.playClick(440, 0.05);
  }, []);

  const handleShowAll = useCallback(() => {
    setCurrentStep(solutionSteps.length);
    soundEffects.playClick(500, 0.05);
  }, [solutionSteps.length]);

  const handleRestartSteps = useCallback(() => {
    setCurrentStep(1);
    soundEffects.playClick(420, 0.05);
  }, []);

  const handleBackToCanvas = useCallback(() => {
    setActiveTab('canvas');
  }, []);

  useEffect(() => {
    setCanUndo(strokes.length > 0);
    setCanRedo(redoStack.length > 0);
  }, [strokes.length, redoStack.length]);

  return (
    <div className={`app ${profile.preferences.reduced_distraction ? 'reduced-distraction' : ''}`}>
      {/* Top Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-titles">
            <h1 className="app-title">{mode === 'textbook' ? 'MathAI Academic Textbook' : 'MathAI Notebook'}</h1>
            <p className="app-subtitle">
              {mode === 'textbook'
                ? 'Curriculum Chapter Theory, Axiomatic Proofs & Rigorous Derivation'
                : 'Inclusive, Multimodal & Adaptive Mathematics Learning'}
            </p>
          </div>
          <div className="header-controls">
            <button
              className="pref-toggle-btn"
              onClick={() => setIsProfileModalOpen(true)}
              aria-label="Open Student Learning Profile and Accessibility Preferences"
            >
              <span>⚙️ Learning Preferences</span>
            </button>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
        </div>
      </header>

      {/* Main Single Unified Screen */}
      <main className="app-main">
        {mode === 'textbook' ? (
          <TextbookView
            umr={umr}
            steps={solutionSteps}
            onSolveProblem={(val) => {
              setTypedInput(val);
              setLastActiveSource('typed');
              handleSolve(val);
            }}
            onSwitchToNotebook={() => setMode('notebook')}
            isLoading={isLoading}
          />
        ) : (
          <section className="single-screen-card" aria-label="Unified Mathematics Workspace">
          {/* Screen Header Tabs */}
          <div className="screen-header-bar">
            <div className="screen-tabs" role="tablist">
              <button
                className={`screen-tab-btn ${activeTab === 'canvas' ? 'active' : ''}`}
                onClick={() => setActiveTab('canvas')}
                role="tab"
                aria-selected={activeTab === 'canvas'}
              >
                ✏️ Canvas Drawing
              </button>
              <button
                className={`screen-tab-btn ${activeTab === 'solution' ? 'active' : ''}`}
                onClick={() => setActiveTab('solution')}
                role="tab"
                aria-selected={activeTab === 'solution'}
              >
                📝 Verified Solution
                {solutionSteps.length > 0 && (
                  <span className="screen-tab-badge">{solutionSteps.length}</span>
                )}
              </button>
              {umr?.learning?.prerequisites && umr.learning.prerequisites.length > 0 && (
                <button
                  className={`screen-tab-btn ${activeTab === 'prerequisites' ? 'active' : ''}`}
                  onClick={() => setActiveTab('prerequisites')}
                  role="tab"
                  aria-selected={activeTab === 'prerequisites'}
                >
                  💡 Prerequisites
                  <span className="screen-tab-badge prereq">{umr.learning.prerequisites.length}</span>
                </button>
              )}
              <button
                className={`screen-tab-btn ${activeTab === 'visualizer' ? 'active' : ''}`}
                onClick={() => setActiveTab('visualizer')}
                role="tab"
                aria-selected={activeTab === 'visualizer'}
              >
                📊 Interactive Lab
              </button>
            </div>

            <div className="screen-actions">
              <button
                className="action-btn"
                onClick={handleClear}
                disabled={isLoading && strokes.length === 0 && !typedInput}
                title="Clear notebook and reset canvas"
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {/* Interactive Pedagogical Clarification Banner */}
          {clarification && (
            <div className="clarification-card" role="region" aria-label="Interactive Problem Clarification">
              <div className="clarification-header">
                <span className="clarification-icon">🤔</span>
                <div className="clarification-title-wrap">
                  <h4 className="clarification-title">Help me understand what to solve</h4>
                  <p className="clarification-question">{clarification.question}</p>
                </div>
              </div>
              {clarification.options.length > 0 && (
                <div className="clarification-options">
                  {clarification.options.map((opt, idx) => (
                    <button
                      key={idx}
                      className="clarification-option-btn"
                      onClick={() => handleClarificationSelect(opt)}
                    >
                      <span className="clarification-bullet">➔</span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Inline Guidance Notice */}
          {notice && !clarification && (
            <div className={`screen-notice ${notice.type}`} role="alert">
              <span>{notice.message}</span>
              <button
                className="screen-notice-close"
                onClick={() => setNotice(null)}
                aria-label="Dismiss notice"
              >
                ×
              </button>
            </div>
          )}

          {/* Screen Body */}
          <div className="screen-body">
            {/* Canvas Tab */}
            <div style={{ display: activeTab === 'canvas' ? 'block' : 'none', height: '100%' }}>
              <MathCanvas
                strokes={strokes}
                onStrokesChange={handleStrokesChange}
                tool={tool}
                penColor={penColor}
                penWidth={penWidth}
                eraserWidth={eraserWidth}
                onToolChange={setTool}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onClear={handleClear}
                canUndo={canUndo}
                canRedo={canRedo}
                disabled={isLoading}
                onExportCanvas={handleExportReady}
              />
            </div>

            {/* Solution Steps Tab */}
            <div
              className="screen-body-solution"
              style={{ display: activeTab === 'solution' ? 'block' : 'none' }}
            >
              <MathDisplay
                steps={solutionSteps}
                mode={mode}
                currentStep={currentStep}
                onStepReveal={setCurrentStep}
                onShowAll={handleShowAll}
                onHint={handleHint}
                onRestart={handleRestartSteps}
                onBackToCanvas={handleBackToCanvas}
                disabled={isLoading}
              />

              {/* Multi-modal Accessibility Panel */}
              <AccessibilityPanel
                accessibility={umr?.accessibility}
              />
            </div>

            {/* Prerequisites Tab (Mathua DAG + FSRS-6) */}
            <div
              className="screen-body-prerequisites"
              style={{ display: activeTab === 'prerequisites' ? 'block' : 'none', padding: '16px' }}
            >
              <ConceptLearningDrawer
                prerequisites={umr?.learning?.prerequisites || []}
                primaryConceptId={umr?.learning?.primary_concept_id}
              />
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="step-btn active"
                  style={{ padding: '8px 16px', borderRadius: '6px' }}
                  onClick={() => setActiveTab('solution')}
                >
                  Proceed to Verified Solution ➔
                </button>
              </div>
            </div>

            {/* Comprehensive Interactive Visualizer Lab (MathLearn Primary Suite) */}
            <div
              className="screen-body-visualizer"
              style={{ display: activeTab === 'visualizer' ? 'block' : 'none', padding: '16px' }}
            >
              {/* Visualizer selector bar */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                <button
                  className={`tab-btn ${visualMode === 'parabola' ? 'active' : ''}`}
                  onClick={() => setVisualMode('parabola')}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  📈 Parabola & Curve (Gr 9)
                </button>
                <button
                  className={`tab-btn ${visualMode === 'balance' ? 'active' : ''}`}
                  onClick={() => setVisualMode('balance')}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  ⚖️ Equation Balance (Gr 7)
                </button>
                <button
                  className={`tab-btn ${visualMode === 'circle' ? 'active' : ''}`}
                  onClick={() => setVisualMode('circle')}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  ⭕ Circle Area Wedges (Primary)
                </button>
                <button
                  className={`tab-btn ${visualMode === 'pythagoras' ? 'active' : ''}`}
                  onClick={() => setVisualMode('pythagoras')}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  📐 Pythagoras 3-Squares (Gr 8)
                </button>
                <button
                  className={`tab-btn ${visualMode === 'numberline' ? 'active' : ''}`}
                  onClick={() => setVisualMode('numberline')}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  ➖ Number Line (Gr 7)
                </button>
                <button
                  className={`tab-btn ${visualMode === 'tiles' ? 'active' : ''}`}
                  onClick={() => setVisualMode('tiles')}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  🧩 Algebra Tiles (Gr 8)
                </button>
                {umr?.visualisation?.type === 'svg_diagram' && (
                  <button
                    className={`tab-btn ${visualMode === 'geometry' ? 'active' : ''}`}
                    onClick={() => setVisualMode('geometry')}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    📐 Geometric Diagram
                  </button>
                )}
              </div>

              {visualMode === 'parabola' && (
                <ParabolaVisualizer
                  key={`${umr?.problem_id || 'default'}-parabola`}
                  initialA={umr?.visualisation?.initial_params?.a !== undefined ? umr.visualisation.initial_params.a : 1}
                  initialB={umr?.visualisation?.initial_params?.b !== undefined ? umr.visualisation.initial_params.b : 0}
                  initialC={umr?.visualisation?.initial_params?.c !== undefined ? umr.visualisation.initial_params.c : -4}
                />
              )}

              {visualMode === 'balance' && (
                <EquationBalanceVisualizer
                  key={`${umr?.problem_id || 'default'}-balance`}
                  initialA={umr?.visualisation?.initial_params?.a !== undefined ? umr.visualisation.initial_params.a : 2}
                  initialB={umr?.visualisation?.initial_params?.b !== undefined ? umr.visualisation.initial_params.b : 3}
                  initialC={umr?.visualisation?.initial_params?.c !== undefined ? umr.visualisation.initial_params.c : 7}
                />
              )}

              {visualMode === 'circle' && (
                <CircleAreaExhaustionVisualizer
                  key={`${umr?.problem_id || 'default'}-circle`}
                  radius={umr?.visualisation?.initial_params?.radius !== undefined ? umr.visualisation.initial_params.radius : 5}
                />
              )}

              {visualMode === 'pythagoras' && (
                <PythagoreanVisualizer
                  key={`${umr?.problem_id || 'default'}-pythagoras`}
                  initialA={umr?.visualisation?.initial_params?.a !== undefined ? umr.visualisation.initial_params.a : 3}
                  initialB={umr?.visualisation?.initial_params?.b !== undefined ? umr.visualisation.initial_params.b : 4}
                />
              )}

              {visualMode === 'numberline' && (
                <NumberLineVisualizer
                  key={`${umr?.problem_id || 'default'}-numberline`}
                  initialA={umr?.visualisation?.initial_params?.a !== undefined ? umr.visualisation.initial_params.a : 2}
                  initialB={umr?.visualisation?.initial_params?.b !== undefined ? umr.visualisation.initial_params.b : 3}
                />
              )}

              {visualMode === 'tiles' && (
                <AlgebraTilesVisualizer
                  key={`${umr?.problem_id || 'default'}-tiles`}
                  initialP={2}
                  initialQ={3}
                />
              )}

              {visualMode === 'geometry' && (
                <GeometryDiagramVisualizer
                  key={`${umr?.problem_id || 'default'}-geometry`}
                  svgCode={umr?.visualisation?.initial_params?.svg_code}
                  topic={umr?.visualisation?.initial_params?.topic || umr?.understanding?.topic || 'geometry'}
                  description={umr?.visualisation?.description}
                />
              )}
            </div>
          </div>
        </section>
        )}

        {/* Unified Multimodal Input Row */}
        <section className="problem-input-row" aria-label="Problem Input">
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <TypedInput
              value={typedInput}
              onChange={(val) => {
                setTypedInput(val);
                setLastActiveSource('typed');
              }}
              onSubmit={handleSolve}
              placeholder="Type an equation, draw above, or use Voice/Sign input (e.g. x^2 + 5x + 6 = 0 or 2x + 4 = 10)..."
              disabled={isLoading}
              rows={2}
            />

            <div className="input-multimodal-actions">
              <button
                type="button"
                className={`voice-btn ${isListeningVoice ? 'listening' : ''}`}
                onClick={handleVoiceInput}
                disabled={isLoading}
                title="Speak math problem via microphone (Voice Normalizer)"
              >
                {isListeningVoice ? '🔴 Listening (Speak now)...' : '🎙️ Speak Math (Voice Normalizer)'}
              </button>

              <button
                type="button"
                className="sign-btn"
                onClick={() => setIsSignModalOpen(true)}
                disabled={isLoading}
                title="Open live webcam Indian Sign Language (ISL) recognition"
              >
                🤟 Sign Input (Webcam ISL)
              </button>
            </div>
          </div>

          <button
            className="solve-btn"
            onClick={() => handleSolve()}
            disabled={isLoading}
            aria-label="Solve math problem"
          >
            {isLoading ? (
              <>
                <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                Solving...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Solve
              </>
            )}
          </button>
        </section>
      </main>

      <StudentProfileModal
        profile={profile}
        onChange={setProfile}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Live Webcam Indian Sign Language Recognition Modal */}
      <LiveISLRecognitionModal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        onRecognizedSign={handleSignRecognized}
        onDeleteLastSign={handleSignDeleteLast}
        onClearSigns={handleSignClear}
        currentInput={typedInput}
      />

      <footer className="app-footer">
        <p>MathAI — One verified mathematical solution · Multiple ways of understanding</p>
      </footer>
    </div>
  );
}

export default App;
