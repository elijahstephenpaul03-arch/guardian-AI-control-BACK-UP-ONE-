import React, { useState, useEffect, useRef } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  MessageSquare, Mic, MicOff, Volume2, VolumeX, X, Send, 
  Sparkles, Shield, User, HelpCircle, BookOpen, AlertTriangle, 
  GraduationCap, Cpu, Zap, Activity, Info, Brain, RefreshCw,
  Copy, Check, ThumbsUp, ThumbsDown, Plus, Trash2, Edit3,
  ChevronRight, ChevronLeft, StopCircle, Menu, CornerDownRight,
  Globe, MapPin, Search, Layers, Lock, AlertOctagon, ExternalLink
} from "lucide-react";
import { openExternalLink, renderTextWithLinks, ensureAbsoluteUrl, extractUrlsFromText, copyLinkToClipboard } from "../lib/linkUtils";
import { auth, db, doc, getDoc } from "../lib/firebase";
import { 
  Conversation, 
  ChatMessage, 
  subscribeConversations, 
  createConversation, 
  updateConversation, 
  deleteConversation, 
  subscribeMessages, 
  saveMessage, 
  deleteMessage 
} from "../lib/chatService";

interface GuardianAssistantProps {
  viewMode: "public" | "dashboard" | "companion";
  isEmbedded?: boolean;
  user?: any;
  userData?: any;
}

export default function GuardianAssistant({ 
  viewMode, 
  isEmbedded = false,
  user,
  userData
}: GuardianAssistantProps) {
  // Authoritative role check: child accounts or companion view are strictly child mode
  const authoritativeRole = userData?.role || null;
  const isChildUser = authoritativeRole === "child" || viewMode === "companion";

  const [isOpen, setIsOpen] = useState(isEmbedded); // Default open if embedded
  const [showSidebar, setShowSidebar] = useState(false);
  const [mode, setMode] = useState<"parent" | "child">(isChildUser ? "child" : "parent");
  const [currentUid, setCurrentUid] = useState<string>(user?.uid || user?.id || "guest");

  // Safe mode switcher that strictly prevents child accounts from switching to parent mode
  const handleSetMode = (newMode: "parent" | "child") => {
    if (isChildUser && newMode === "parent") {
      console.warn("[Guardian Assistant] Security notice: Child accounts are permanently restricted to Child Assistant mode.");
      return;
    }
    setMode(newMode);
  };

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false); // Default response = TEXT (voice OFF)
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<"idle" | "listening" | "thinking" | "streaming" | "speaking">("idle");
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [assistantError, setAssistantError] = useState<{ text: string; lastMessage: string } | null>(null);

  // Settings state
  const [selectedModel, setSelectedModel] = useState<string>("openai/gpt-oss-120b");
  const [enableSearch, setEnableSearch] = useState(true);
  const [enableMaps, setEnableMaps] = useState(false);

  // Copy feedback state
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Edit user message state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState("");

  // Real child context telemetry fetched from Firestore or LocalStorage
  const [childContext, setChildContext] = useState<any>({
    name: "Alex",
    age: 12,
    status: "online",
    screenTimeLimit: 120,
    screenTimeToday: 82,
    riskScore: 18,
    battery: null,
    location: null,
    hasRealData: false
  });
  const [realLogs, setRealLogs] = useState<any[]>([]);
  const [realDangerousEvents, setRealDangerousEvents] = useState<any[]>([]);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);

  // 1. Monitor Auth State & load real telemetry context
  useEffect(() => {
    if (user?.uid || user?.id) {
      const activeId = user.uid || user.id;
      setCurrentUid(activeId);
      if (!isChildUser) {
        fetchRealChildData(activeId);
      }
    }

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUid(firebaseUser.uid);
        if (!isChildUser) {
          fetchRealChildData(firebaseUser.uid);
        }
      } else if (!user) {
        setCurrentUid("guest");
      }
    });
    return () => unsubscribe();
  }, [user, isChildUser]);

  // Fetch real telemetry data from Firestore (only for authorized parents)
  const fetchRealChildData = async (uid: string) => {
    if (isChildUser) return; // Prevent children from querying parent telemetry
    try {
      // Fetch user profile
      const userDocRef = doc(db, "users", uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data();
        setChildContext((prev: any) => ({
          ...prev,
          name: data.childName || data.displayName || "Alex",
          hasRealData: true
        }));
      }
    } catch (e) {
      console.warn("Could not load real child telemetry:", e);
    }
  };

  // Sync mode with viewMode and authoritative role
  useEffect(() => {
    if (isChildUser) {
      setMode("child");
    } else {
      setMode("parent");
    }
  }, [viewMode, isChildUser]);

  // 2. Subscribe to Conversation List
  useEffect(() => {
    const unsubscribe = subscribeConversations(currentUid, (convList) => {
      setConversations(convList);

      // Filter conversations for current mode
      const filtered = convList.filter(c => c.mode === mode);

      if (filtered.length > 0) {
        // If current active is not in filtered list, set to first
        if (!activeConvId || !filtered.find(c => c.id === activeConvId)) {
          setActiveConvId(filtered[0].id);
        }
      } else {
        // Create initial conversation for this mode
        initInitialConversation(mode);
      }
    });

    return () => unsubscribe();
  }, [currentUid, mode]);

  // Create initial conversation if none exists
  const initInitialConversation = async (convMode: "parent" | "child") => {
    const effectiveMode = isChildUser ? "child" : convMode;
    const title = effectiveMode === "parent" ? "Family Safety Counsel" : "Learning Companion";
    const newId = await createConversation(currentUid, title, effectiveMode);
    setActiveConvId(newId);
  };

  // 3. Subscribe to Messages in Active Conversation
  useEffect(() => {
    if (!activeConvId) return;

    const unsubscribe = subscribeMessages(currentUid, activeConvId, (msgList) => {
      setMessages(msgList);
    });

    return () => unsubscribe();
  }, [currentUid, activeConvId]);

  // 4. Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setAvatarState("listening");
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setAvatarState("idle");
        // User reviews text in input field and presses Send manually
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
        setIsListening(false);
        setAvatarState("idle");
      };

      rec.onend = () => {
        setIsListening(false);
        setAvatarState("idle");
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-scroll chat to bottom smoothly
  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    scrollToBottom("smooth");
    const t = setTimeout(() => scrollToBottom("auto"), 80);
    return () => clearTimeout(t);
  }, [messages, isThinking, isStreaming, assistantError]);

  // Read aloud specific AI response message with TTS
  const speakMessageText = (msgId: string, text: string) => {
    if (!window.speechSynthesis) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    // Toggle stop if already speaking this message
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      setAvatarState("idle");
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#+/g, "")
      .replace(/`{3}[\s\S]*?`{3}/g, "Here is a code snippet.")
      .replace(/`/g, "")
      .replace(/-\s+/g, "")
      .trim();

    if (!cleanText) return;

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Natural") || v.lang === "en-US");
      if (voice) utterance.voice = voice;

      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setSpeakingMsgId(msgId);
        setAvatarState("speaking");
      };
      utterance.onend = () => {
        setSpeakingMsgId(null);
        setAvatarState("idle");
      };
      utterance.onerror = (e) => {
        console.warn("Speech synthesis error:", e);
        setSpeakingMsgId(null);
        setAvatarState("idle");
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
      setSpeakingMsgId(null);
      setAvatarState("idle");
    }
  };

  const stopGenerationOrSpeech = () => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
    setIsThinking(false);
    setIsStreaming(false);
    setAvatarState("idle");
  };

  // Toggle microphone
  const handleMicrophoneClick = () => {
    if (!isSpeechSupported) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (window.speechSynthesis) window.speechSynthesis.cancel();

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.warn("Speech recognition error:", e);
      }
    }
  };

  // New Chat Handler
  const handleStartNewChat = async () => {
    stopGenerationOrSpeech();
    const effectiveMode = isChildUser ? "child" : mode;
    const title = effectiveMode === "parent" ? "New Safety Consultation" : "New Learning Chat";
    const newId = await createConversation(currentUid, title, effectiveMode);
    setActiveConvId(newId);
    setAssistantError(null);
  };

  // Rename Conversation Handler
  const handleRenameConv = async (convId: string) => {
    if (!editingTitle.trim()) return;
    await updateConversation(currentUid, convId, { title: editingTitle.trim() });
    setEditingConvId(null);
    setEditingTitle("");
  };

  // Delete Conversation Handler
  const handleDeleteConv = async (convId: string) => {
    if (confirm("Are you sure you want to delete this conversation?")) {
      await deleteConversation(currentUid, convId);
      const remaining = conversations.filter(c => c.id !== convId && c.mode === mode);
      if (remaining.length > 0) {
        setActiveConvId(remaining[0].id);
      } else {
        handleStartNewChat();
      }
    }
  };

  // Generate Suggested Follow-ups
  const getFollowUpSuggestions = (lastAiText: string): string[] => {
    const textLower = lastAiText.toLowerCase();

    if (mode === "child") {
      if (textLower.includes("code") || textLower.includes("python") || textLower.includes("programming")) {
        return ["Can you give me a code example?", "Explain step-by-step", "Quiz me on this!"];
      }
      if (textLower.includes("math") || textLower.includes("homework") || textLower.includes("solve")) {
        return ["Want an easier explanation?", "Give me a practice question", "Show me another example"];
      }
      return ["Explain this step-by-step", "Give me a fun example", "Quiz me on this!"];
    } else {
      if (textLower.includes("screen") || textLower.includes("usage") || textLower.includes("time")) {
        return ["How should I set screen time limits?", "Explain the app activity logs", "Suggest healthy balance tips"];
      }
      if (textLower.includes("safety") || textLower.includes("risk") || textLower.includes("block")) {
        return ["What security settings should I check?", "How do I talk to my child about online safety?", "Summarize recent threats"];
      }
      return ["Summarize key recommendations", "Give me actionable parenting advice", "Explain this in detail"];
    }
  };

  // Main Stream Execution Function
  const executeAssistantStream = async (rawMessage: string, historyTurns: ChatMessage[], convIdToUse: string) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    currentRequestIdRef.current = requestId;

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    setIsThinking(true);
    setIsStreaming(true);
    setAvatarState("thinking");
    setAssistantError(null);

    // Create placeholder AI message
    const aiMsgId = `model_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const aiMsgPlaceholder: ChatMessage = {
      id: aiMsgId,
      role: "model",
      text: "",
      timestamp: nowStr,
      isHelpful: null,
      followUps: []
    };

    // Immediately add AI message placeholder to local state so UI updates without waiting for DB sync
    setMessages((prev) => {
      if (prev.some((m) => m.id === aiMsgId)) return prev;
      return [...prev, aiMsgPlaceholder];
    });

    let accumulatedText = "";
    let groundingMetadata: any = null;

    try {
      const streamEndpoint = "/api/assistant/stream";
      console.log(`[CHAT REQUEST DEBUG] window.location.origin = ${window.location.origin}, request URL = ${window.location.origin}${streamEndpoint}, request path = ${streamEndpoint}`);
      
      const payload = {
        message: rawMessage,
        childContext: isChildUser ? { name: userData?.fullName || "Student", status: "online", hasRealData: false } : childContext,
        history: historyTurns.slice(-12),
        mode: isChildUser ? "child" : mode,
        logs: isChildUser ? [] : realLogs,
        dangerousEvents: isChildUser ? [] : realDangerousEvents,
        modelName: selectedModel,
        enableSearch,
        enableMaps
      };

      let response: Response;
      let usedStream = true;

      try {
        response = await fetch(streamEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Stream responded with HTTP ${response.status}`);
        }
      } catch (streamFetchErr: any) {
        if (streamFetchErr.name === "AbortError" || streamFetchErr.message?.includes("aborted")) {
          throw streamFetchErr;
        }
        console.warn("[Guardian Assistant] Streaming endpoint failed, falling back to /api/assistant JSON endpoint:", streamFetchErr);
        usedStream = false;
        response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("AI services quota has been exhausted. Please try again later.");
          }
          throw new Error(`AI Server responded with HTTP ${response.status}`);
        }
      }

      setIsThinking(false);
      setAvatarState("streaming");

      let providerModelUsed = "";

      if (!usedStream) {
        // Handle non-streaming JSON response
        const data = await response.json();
        accumulatedText = data.text || "";
        providerModelUsed = data.modelUsed || "Guardian AI";
        groundingMetadata = data.groundingMetadata || null;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, text: accumulatedText, groundingMetadata, modelUsed: providerModelUsed }
              : m
          )
        );
      } else {
        // Handle SSE streaming response
        try {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith("data: ")) {
                  try {
                    const parsed = JSON.parse(trimmed.slice(6));

                    if (parsed.error) {
                      console.warn("AI service warning in stream:", parsed.message);
                      continue;
                    }

                    if (parsed.modelUsed) {
                      providerModelUsed = parsed.modelUsed;
                    }

                    if (parsed.groundingMetadata) {
                      groundingMetadata = parsed.groundingMetadata;
                    }

                    if (parsed.text) {
                      accumulatedText += parsed.text;

                      // Update AI message state incrementally in React state directly
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === aiMsgId
                            ? { ...m, text: accumulatedText, groundingMetadata: groundingMetadata || m.groundingMetadata, modelUsed: providerModelUsed || m.modelUsed }
                            : m
                        )
                      );
                    }

                    if (parsed.done) {
                      if (parsed.fullText) accumulatedText = parsed.fullText;
                      if (parsed.groundingMetadata) groundingMetadata = parsed.groundingMetadata;
                      if (parsed.modelUsed) providerModelUsed = parsed.modelUsed;
                    }
                  } catch (e) {
                    // Ignore partial/malformed JSON chunk
                  }
                }
              }
            }
          }
        } catch (streamReadErr: any) {
          if (streamReadErr.name === "AbortError" || streamReadErr.message?.includes("aborted")) {
            throw streamReadErr;
          }
          console.warn("[Guardian Assistant] SSE stream interrupted:", streamReadErr);
        }

        // If stream ended with no text, attempt fallback to standard JSON endpoint
        if (!accumulatedText) {
          try {
            console.log("[Guardian Assistant] Stream yielded no text. Requesting /api/assistant fallback...");
            const fallbackResponse = await fetch("/api/assistant", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify(payload)
            });
            if (fallbackResponse.ok) {
              const fbData = await fallbackResponse.json();
              accumulatedText = fbData.text || "";
              providerModelUsed = fbData.modelUsed || "Guardian Neural Core (Offline Engine)";
              groundingMetadata = fbData.groundingMetadata || null;
            }
          } catch (fbErr) {
            console.warn("[Guardian Assistant] Fallback endpoint error:", fbErr);
          }
        }
      }

      // Safe client-side fallback if both stream and server failed completely
      if (!accumulatedText) {
        accumulatedText = mode === "child"
          ? "### 🌟 Guardian Learning Companion\n\nHello! I am your Guardian learning helper. I can assist you with homework, coding, and internet safety. What would you like to explore today?"
          : "### 🛡️ Guardian Family Security Advisor\n\nI am your Guardian AI family advisor. Child device telemetry, safe zones, and content filtering are operating normally. How can I assist your family today?";
        providerModelUsed = "Guardian Neural Core (Offline Engine)";
      }

      // Finalize AI message with follow-up suggestions
      const finalFollowUps = getFollowUpSuggestions(accumulatedText);
      const finalAiMsg: ChatMessage = {
        ...aiMsgPlaceholder,
        text: accumulatedText,
        groundingMetadata,
        followUps: finalFollowUps,
        modelUsed: providerModelUsed || undefined
      };

      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? finalAiMsg : m))
      );

      await saveMessage(currentUid, convIdToUse, finalAiMsg);

      if (autoSpeak && accumulatedText) {
        speakMessageText(aiMsgPlaceholder.id, accumulatedText);
      }

    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        console.log("Stream aborted.");
        return;
      }

      console.error("Stream generation failed:", err);

      if (!accumulatedText) {
        // Remove empty placeholder message so we don't pretend an AI response was generated
        setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
      }

      setAssistantError({
        text: err.message || "Guardian AI ran into a connection glitch. Please retry your message.",
        lastMessage: rawMessage
      });
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      setAvatarState("idle");
      activeAbortControllerRef.current = null;
    }
  };

  // Send Message
  const sendMessage = async (textToSend?: string) => {
    const rawMessage = (textToSend !== undefined ? textToSend : input).trim();
    if (!rawMessage) return;

    if (isThinking || isStreaming) {
      console.warn("Generation in progress. Blocking concurrent send.");
      return;
    }

    // Ensure we have an active conversation ID
    let convId = activeConvId;
    if (!convId) {
      convId = await createConversation(currentUid, rawMessage.substring(0, 25), mode);
      setActiveConvId(convId);
    } else {
      // If conversation title is default, update it to user's first prompt snippet
      const activeConv = conversations.find(c => c.id === convId);
      if (activeConv && (activeConv.title === "New Conversation" || activeConv.title === "New Safety Consultation" || activeConv.title === "New Learning Chat")) {
        updateConversation(currentUid, convId, { title: rawMessage.substring(0, 28) });
      }
    }

    if (!textToSend) setInput("");

    if (window.speechSynthesis) window.speechSynthesis.cancel();

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      role: "user",
      text: rawMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    // Update local state immediately so user prompt appears right away
    setMessages((prev) => [...prev, userMsg]);

    // Save user message to Firestore/LocalStorage
    await saveMessage(currentUid, convId, userMsg);

    const historyTurns = [...messages, userMsg];
    await executeAssistantStream(rawMessage, historyTurns, convId);
  };

  // Action: Copy Message Text
  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Action: Thumbs Up / Down Feedback
  const handleFeedback = async (msg: ChatMessage, isHelpful: boolean) => {
    if (!activeConvId) return;
    const updated = { ...msg, isHelpful };
    await saveMessage(currentUid, activeConvId, updated);
  };

  // Action: Regenerate AI Response
  const handleRegenerate = async (aiMsgIndex: number) => {
    if (!activeConvId) return;
    // Find preceding user message
    let precedingUserMsg: ChatMessage | null = null;
    for (let i = aiMsgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        precedingUserMsg = messages[i];
        break;
      }
    }

    if (precedingUserMsg) {
      const historyTurns = messages.slice(0, aiMsgIndex);
      await executeAssistantStream(precedingUserMsg.text, historyTurns, activeConvId);
    }
  };

  // Action: Edit User Message
  const handleSaveEditedMessage = async (msgId: string) => {
    if (!editingMsgText.trim() || !activeConvId) return;

    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex >= 0) {
      const updatedUserMsg: ChatMessage = {
        ...messages[msgIndex],
        text: editingMsgText.trim()
      };
      await saveMessage(currentUid, activeConvId, updatedUserMsg);

      setEditingMsgId(null);
      setEditingMsgText("");

      // Re-trigger assistant stream from this edited message point
      const historyTurns = messages.slice(0, msgIndex + 1);
      await executeAssistantStream(editingMsgText.trim(), historyTurns, activeConvId);
    }
  };

  // Render formatted markdown text with code snippets and bold tags
  const renderFormattedMarkdown = (text: string) => {
    if (!text) return null;

    const blocks = text.split(/(```[\s\S]*?```)/g);

    return blocks.map((block, bIdx) => {
      if (block.startsWith("```")) {
        const lines = block.slice(3, -3).trim().split("\n");
        const language = lines[0].match(/^[a-zA-Z0-9]+$/) ? lines[0] : "";
        const codeContent = language ? lines.slice(1).join("\n") : lines.join("\n");

        return (
          <div key={bIdx} className="my-2 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden text-xs font-mono">
            <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
              <span className="uppercase font-bold text-cyan-400">{language || "code"}</span>
              <button
                onClick={() => handleCopyMessage(`code_${bIdx}`, codeContent)}
                className="hover:text-white transition flex items-center gap-1 cursor-pointer"
              >
                {copiedMsgId === `code_${bIdx}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedMsgId === `code_${bIdx}` ? "Copied" : "Copy code"}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-slate-200 leading-relaxed font-mono text-[11px]">
              <code>{codeContent}</code>
            </pre>
          </div>
        );
      }

      const lines = block.split("\n");
      return lines.map((line, lIdx) => {
        const listMatch = line.match(/^(\d+\.|\-|\*)\s+(.*)$/);
        const boldRegex = /\*\*([^*]+)\*\*/g;
        const parts: React.ReactNode[] = [];
        let lastIdx = 0;
        let match;

        while ((match = boldRegex.exec(line)) !== null) {
          if (match.index > lastIdx) {
            const rawSub = line.substring(lastIdx, match.index);
            parts.push(...renderTextWithLinks(rawSub, undefined, `inline-${bIdx}-${lIdx}-${lastIdx}`));
          }
          parts.push(
            <strong key={`bold-${match.index}`} className="font-bold text-cyan-400">
              {renderTextWithLinks(match[1], undefined, `bold-link-${bIdx}-${lIdx}-${match.index}`)}
            </strong>
          );
          lastIdx = boldRegex.lastIndex;
        }
        if (lastIdx < line.length) {
          const rawSub = line.substring(lastIdx);
          parts.push(...renderTextWithLinks(rawSub, undefined, `inline-${bIdx}-${lIdx}-${lastIdx}`));
        }

        const renderedLine = parts.length > 0 ? parts : renderTextWithLinks(line, undefined, `line-${bIdx}-${lIdx}`);

        if (listMatch) {
          const listContent = renderTextWithLinks(listMatch[2], undefined, `list-${bIdx}-${lIdx}`);
          return (
            <div key={lIdx} className="flex items-start gap-2 pl-2 my-1">
              <span className="text-cyan-400 font-mono font-bold shrink-0 text-xs">{listMatch[1]}</span>
              <span className="text-slate-200 text-xs leading-relaxed">{listContent}</span>
            </div>
          );
        }

        if (line.trim() === "") return <div key={lIdx} className="h-1.5" />;

        return (
          <p key={lIdx} className="text-slate-200 text-xs leading-relaxed my-0.5">
            {renderedLine}
          </p>
        );
      });
    });
  };

  // Quick Starter Prompts
  const starterPrompts = mode === "child" ? [
    { title: "Homework Helper", desc: "Break down tricky math or science concepts step-by-step", prompt: "Help me with my homework step-by-step.", icon: <GraduationCap className="h-4 w-4 text-teal-400" /> },
    { title: "Learn Python Coding", desc: "Build cool games and learn programming magic", prompt: "Teach me Python programming basics with code snippets.", icon: <Cpu className="h-4 w-4 text-cyan-400" /> },
    { title: "Cyber Safety Advice", desc: "Learn key rules to stay safe in games and chats", prompt: "Give me internet safety advice for kids.", icon: <Shield className="h-4 w-4 text-violet-400" /> },
    { title: "Study Plan Helper", desc: "Create an awesome schedule for school projects", prompt: "Create a study plan for my subjects.", icon: <BookOpen className="h-4 w-4 text-emerald-400" /> }
  ] : [
    { title: "Screen Time Audit", desc: "Analyze daily usage and screen balance recommendations", prompt: "Analyze Alex's screen time usage and suggest limits.", icon: <Activity className="h-4 w-4 text-cyan-400" /> },
    { title: "Family Security Review", desc: "Review geofencing safe zones and threat shield metrics", prompt: "Give me a family cybersecurity protocol review.", icon: <Shield className="h-4 w-4 text-emerald-400" /> },
    { title: "Learning Recommendations", desc: "Discover top STEM and coding courses for children", prompt: "Recommend STEM educational apps for a 12-year-old.", icon: <GraduationCap className="h-4 w-4 text-indigo-400" /> },
    { title: "Digital Wellbeing Nudge", desc: "Practical parenting strategies for healthy online habits", prompt: "Give me actionable parenting advice on digital wellbeing.", icon: <Brain className="h-4 w-4 text-violet-400" /> }
  ];

  // Primary Assistant Chat Layout
  const mainChatContent = (
    <div className="flex-1 flex flex-col h-full bg-slate-950/80 backdrop-blur-2xl border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl relative">
      
      {/* Header bar */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          
          {/* Toggle Sidebar Button */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title="Conversation History"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Assistant Avatar Sphere */}
          <div className="relative">
            <div className={`h-9 w-9 rounded-full bg-gradient-to-tr ${mode === "child" ? "from-teal-500 to-emerald-600" : "from-cyan-500 to-indigo-600"} flex items-center justify-center shadow-lg border border-white/20`}>
              <Sparkles className="h-4 w-4 text-white animate-pulse" />
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${isStreaming || isThinking ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`}></span>
          </div>

          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              Guardian AI
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border font-bold ${mode === "child" ? "bg-teal-950 text-teal-300 border-teal-800" : "bg-cyan-950 text-cyan-300 border-cyan-800"}`}>
                {mode === "child" ? "Child Companion" : "Parent Advisor"}
              </span>
            </h3>
            <p className="text-[10.5px] text-slate-400">
              {mode === "child" ? "Safe learning helper & coding tutor" : "Family security & digital wellbeing intelligence"}
            </p>
          </div>
        </div>

        {/* Mode & Action Controls */}
        <div className="flex items-center space-x-2">
          
          {/* New Chat Button */}
          <button
            onClick={handleStartNewChat}
            className="hidden sm:flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </button>

          {/* Mode Switcher */}
          {isChildUser ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-950/80 border border-teal-500/30 text-[10px] font-bold uppercase text-teal-300 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
              <User className="h-3.5 w-3.5 text-teal-400" />
              <span>Child Safety Assistant</span>
            </div>
          ) : (
            <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-0.5">
              <button
                onClick={() => handleSetMode("parent")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1 ${mode === "parent" ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                <Shield className="h-3 w-3" />
                Parent
              </button>
              <button
                onClick={() => handleSetMode("child")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1 ${mode === "child" ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                <User className="h-3 w-3" />
                Child
              </button>
            </div>
          )}

          {!isEmbedded && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Container with Sidebar Overlay */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Sidebar Drawer */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="absolute inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 z-30 flex flex-col p-3 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-cyan-400" /> Conversations
                </span>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  handleStartNewChat();
                  setShowSidebar(false);
                }}
                className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer hover:opacity-90 transition"
              >
                <Plus className="h-4 w-4" /> Start New Chat
              </button>

              <div className="flex-1 overflow-y-auto mt-3 space-y-1 pr-1 scrollbar-thin">
                {conversations.filter(c => c.mode === mode).length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic text-center py-6">No previous chats yet.</p>
                ) : (
                  conversations.filter(c => c.mode === mode).map((conv) => (
                    <div
                      key={conv.id}
                      className={`group flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
                        activeConvId === conv.id 
                          ? "bg-slate-800 border border-slate-700 text-white font-semibold" 
                          : "text-slate-400 hover:bg-slate-850 hover:text-slate-200"
                      }`}
                      onClick={() => {
                        setActiveConvId(conv.id);
                        setShowSidebar(false);
                      }}
                    >
                      {editingConvId === conv.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameConv(conv.id);
                          }}
                          autoFocus
                          className="bg-slate-950 text-white text-xs px-2 py-1 rounded border border-cyan-500 focus:outline-none w-full"
                        />
                      ) : (
                        <span className="truncate flex-1 pr-2">{conv.title}</span>
                      )}

                      <div className="hidden group-hover:flex items-center space-x-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingConvId(conv.id);
                            setEditingTitle(conv.title);
                          }}
                          className="p-1 hover:text-cyan-400 text-slate-500 transition cursor-pointer"
                          title="Rename"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConv(conv.id);
                          }}
                          className="p-1 hover:text-rose-400 text-slate-500 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Thread Messages Stream */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 grid-bg scrollbar-thin flex flex-col"
        >
          {messages.length === 0 ? (
            /* EMPTY STATE WITH STARTER PROMPTS */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6 my-auto">
              <div className="relative">
                <div className={`h-16 w-16 rounded-3xl bg-gradient-to-tr ${mode === "child" ? "from-teal-500 to-emerald-600" : "from-cyan-500 to-indigo-600"} flex items-center justify-center shadow-2xl border border-white/20 animate-pulse`}>
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-black text-white tracking-tight">Guardian AI</h2>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  {mode === "child" 
                    ? "Your intelligent learning helper, coding tutor, and cyber-safety guide." 
                    : "Your intelligent family safety and digital wellbeing assistant."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {starterPrompts.map((card, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(card.prompt)}
                    className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer group flex items-start gap-3 shadow-lg"
                  >
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 group-hover:scale-110 transition shrink-0">
                      {card.icon}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition">{card.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{card.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* MESSAGES LIST */
            messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-start gap-2.5 group`}
              >
                {msg.role !== "user" && (
                  <div className={`h-8 w-8 rounded-2xl shrink-0 flex items-center justify-center text-xs font-bold shadow-md border ${mode === "child" ? "bg-teal-950 border-teal-800 text-teal-300" : "bg-cyan-950 border-cyan-800 text-cyan-300"}`}>
                    G
                  </div>
                )}

                <div className="flex flex-col max-w-[85%] sm:max-w-[78%]">
                  
                  {/* Message Bubble */}
                  <div className={`rounded-2xl px-4 py-3 shadow-md text-xs relative ${
                    msg.role === "user"
                      ? "bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white rounded-tr-none"
                      : "bg-slate-900/90 border border-slate-800/80 text-slate-100 rounded-tl-none backdrop-blur-md"
                  }`}>
                    
                    {/* Editable User Message */}
                    {editingMsgId === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingMsgText}
                          onChange={(e) => setEditingMsgText(e.target.value)}
                          className="w-full bg-slate-950 text-white text-xs p-2 rounded-xl border border-cyan-500 focus:outline-none"
                          rows={3}
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setEditingMsgId(null)}
                            className="px-2 py-1 text-[10px] bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEditedMessage(msg.id)}
                            className="px-2 py-1 text-[10px] bg-cyan-600 text-white rounded-lg cursor-pointer font-bold"
                          >
                            Save & Resend
                          </button>
                        </div>
                      </div>
                    ) : (
                      renderFormattedMarkdown(msg.text)
                    )}

                    {/* Extracted Web Links in Message (If Assistant suggested websites/links) */}
                    {msg.role !== "user" && (() => {
                      const webLinks = extractUrlsFromText(msg.text);
                      if (webLinks.length === 0) return null;
                      return (
                        <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5">
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> Website Links ({webLinks.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {webLinks.map((item, lIdx) => (
                              <div
                                key={lIdx}
                                className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono"
                              >
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="truncate text-teal-300 hover:text-teal-200 hover:underline flex items-center gap-1"
                                  title={`Open ${item.label} (${item.url})`}
                                >
                                  <Globe className="h-3 w-3 text-teal-400 shrink-0" />
                                  <span className="truncate">{item.label}</span>
                                </a>
                                <div className="flex items-center gap-1 shrink-0">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-1.5 py-0.5 rounded bg-teal-500/20 hover:bg-teal-500 text-teal-300 hover:text-slate-950 font-bold text-[9px] transition flex items-center gap-0.5 cursor-pointer"
                                    title="Open website in new tab"
                                  >
                                    <span>Open</span>
                                    <ExternalLink className="h-2 w-2" />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyMessage(`link_${msg.id}_${lIdx}`, item.url)}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                                    title="Copy link"
                                  >
                                    {copiedMsgId === `link_${msg.id}_${lIdx}` ? (
                                      <Check className="h-2.5 w-2.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-2.5 w-2.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Grounding Metadata References */}
                    {msg.groundingMetadata?.groundingChunks && msg.groundingMetadata.groundingChunks.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Grounded References:
                        </span>
                        {msg.groundingMetadata.groundingChunks.map((chunk: any, cIdx: number) => {
                          const url = chunk.web?.uri || chunk.maps?.uri;
                          const title = chunk.web?.title || chunk.maps?.title || "Reference Source";
                          if (!url) return null;
                          const safeUrl = ensureAbsoluteUrl(url);
                          return (
                            <a
                              key={cIdx}
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-slate-800/80 p-1.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2 font-mono group transition cursor-pointer"
                              title={`Open ${title} (${safeUrl}) in new tab`}
                            >
                              <span className="truncate flex items-center gap-1.5">
                                <Globe className="h-3 w-3 text-cyan-400 shrink-0" />
                                <span className="truncate">{title}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[9px] text-teal-400 opacity-80 group-hover:opacity-100 shrink-0 font-bold">
                                <span>Open</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Message Toolbar Actions */}
                  <div className={`flex items-center space-x-2 mt-1 text-[10px] text-slate-500 font-mono ${msg.role === "user" ? "justify-end mr-1" : "ml-1"}`}>
                    <span>{msg.timestamp}</span>
                    {msg.modelUsed && (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                        msg.modelUsed.includes("Offline")
                          ? "bg-amber-950/80 text-amber-300 border-amber-700/60 font-semibold"
                          : "bg-slate-800/80 text-cyan-400/90 border-slate-700/50"
                      }`}>
                        {msg.modelUsed.includes("Offline") && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0"></span>}
                        {msg.modelUsed}
                      </span>
                    )}

                    {msg.role === "user" ? (
                      <button
                        onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditingMsgText(msg.text);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-cyan-400 cursor-pointer"
                        title="Edit Message"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {/* 🔊 Listen / Stop Speaker Button */}
                        <button
                          onClick={() => speakMessageText(msg.id, msg.text)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[10px] font-mono transition cursor-pointer ${
                            speakingMsgId === msg.id
                              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold animate-pulse shadow-sm"
                              : "bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800 hover:text-white"
                          }`}
                          title={speakingMsgId === msg.id ? "Stop voice playback" : "Listen to this response"}
                        >
                          {speakingMsgId === msg.id ? (
                            <>
                              <StopCircle className="h-3 w-3 text-cyan-400" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3 w-3 text-cyan-400" />
                              <span>🔊 Listen</span>
                            </>
                          )}
                        </button>

                        {/* Copy */}
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded hover:bg-slate-800"
                          title="Copy text"
                        >
                          {copiedMsgId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>

                        {/* Thumbs Up / Down */}
                        <button
                          onClick={() => handleFeedback(msg, true)}
                          className={`transition cursor-pointer p-1 rounded hover:bg-slate-800 ${msg.isHelpful === true ? "text-emerald-400" : "text-slate-400 hover:text-emerald-400"}`}
                          title="Helpful"
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </button>

                        <button
                          onClick={() => handleFeedback(msg, false)}
                          className={`transition cursor-pointer p-1 rounded hover:bg-slate-800 ${msg.isHelpful === false ? "text-rose-400" : "text-slate-400 hover:text-rose-400"}`}
                          title="Not Helpful"
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </button>

                        {/* Regenerate */}
                        <button
                          onClick={() => handleRegenerate(index)}
                          className="text-slate-400 hover:text-cyan-400 transition cursor-pointer p-1 rounded hover:bg-slate-800"
                          title="Regenerate"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Follow-up Question Chips */}
                  {msg.role !== "user" && msg.followUps && msg.followUps.length > 0 && index === messages.length - 1 && !isStreaming && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 pl-1">
                      {msg.followUps.map((chip, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => sendMessage(chip)}
                          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-[10.5px] text-cyan-300 font-medium transition cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          <CornerDownRight className="h-3 w-3 text-cyan-400" />
                          <span>{chip}</span>
                        </button>
                      ))}
                    </div>
                  )}

                </div>
              </div>
            ))
          )}

          {/* Typing / Streaming Indicator */}
          {(isThinking || isStreaming) && (
            <div className="flex justify-start items-center gap-2.5">
              <div className={`h-8 w-8 rounded-2xl shrink-0 flex items-center justify-center text-xs font-bold animate-pulse ${mode === "child" ? "bg-teal-950 border border-teal-800 text-teal-300" : "bg-cyan-950 border border-cyan-800 text-cyan-300"}`}>
                G
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 rounded-tl-none flex items-center space-x-2 shadow-md">
                <span className="text-xs text-slate-400 font-medium animate-pulse">Guardian is typing...</span>
                <div className="flex space-x-1 items-center">
                  <div className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="h-1.5 w-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Assistant Error Banner */}
          {assistantError && (
            <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-2xl text-xs text-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{assistantError.text}</span>
              </div>
              <button
                onClick={() => sendMessage(assistantError.lastMessage)}
                className="px-3 py-1 bg-rose-900/80 hover:bg-rose-900 text-white font-bold text-[10px] rounded-xl transition cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Control Toolbar */}
      <div className="p-3 bg-slate-950 border-t border-slate-900 flex flex-col gap-2 shrink-0">
        
        {/* Settings Bar */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <span>Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-cyan-400 font-bold rounded px-1.5 py-0.5 focus:outline-none focus:border-cyan-500 cursor-pointer text-[10px]"
              >
                <option value="openai/gpt-oss-120b">Groq 120B Versatile (Recommended)</option>
                <option value="openai/gpt-oss-20b">Groq 20B Fast</option>
                <option value="qwen/qwen3.8-27b">Qwen 27B</option>
                <option value="canopylabs/orpheus-v1-english">Orpheus English</option>
              </select>
            </div>
            <label className="inline-flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={enableSearch}
                onChange={(e) => setEnableSearch(e.target.checked)}
                className="rounded text-cyan-500 bg-slate-900 border-slate-700 h-3 w-3"
              />
              <span>Web Search</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            {speakingMsgId && (
              <span className="text-cyan-400 animate-pulse flex items-center gap-1 text-[10px]">
                <Volume2 className="h-3 w-3" /> Voice Playing
              </span>
            )}
            <button
              onClick={() => {
                const nextState = !autoSpeak;
                setAutoSpeak(nextState);
                if (!nextState && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                  setSpeakingMsgId(null);
                  setAvatarState("idle");
                }
              }}
              className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono transition cursor-pointer flex items-center gap-1.5 ${
                autoSpeak
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
              title="Toggle automatic voice output on new responses"
            >
              {autoSpeak ? <Volume2 className="h-3.5 w-3.5 text-cyan-400" /> : <VolumeX className="h-3.5 w-3.5 text-slate-500" />}
              <span>Voice: {autoSpeak ? "ON" : "OFF"}</span>
            </button>
          </div>
        </div>

        {/* Primary Input Controls */}
        <div className="flex items-center gap-2">
          
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              disabled={isThinking || isStreaming}
              placeholder={mode === "child" ? "Ask Guardian helper, homework question..." : "Ask Guardian safety advisor..."}
              className="w-full text-xs font-medium rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 focus:border-cyan-500/50 px-4 py-3 text-white placeholder-slate-500 focus:outline-none transition pr-10 shadow-inner disabled:opacity-50"
            />

            {/* Mic Trigger */}
            <button
              type="button"
              onClick={handleMicrophoneClick}
              disabled={isThinking || isStreaming}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl transition cursor-pointer ${
                isListening ? "bg-cyan-500 text-white animate-pulse" : "text-slate-400 hover:text-cyan-400"
              }`}
              title="🎤 Speak to Guardian AI"
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>

          {/* Stop / Send Button */}
          {isStreaming || isThinking ? (
            <button
              onClick={stopGenerationOrSpeech}
              className="p-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 transition cursor-pointer shrink-0"
              title="Stop Generation"
            >
              <StopCircle className="h-4 w-4 animate-pulse" />
            </button>
          ) : (
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              className={`p-3 rounded-2xl cursor-pointer transition shrink-0 ${
                input.trim()
                  ? mode === "child"
                    ? "bg-gradient-to-tr from-teal-600 to-emerald-600 text-white hover:scale-105 active:scale-95"
                    : "bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white hover:scale-105 active:scale-95"
                  : "bg-slate-900 border border-slate-850 text-slate-600 cursor-not-allowed"
              }`}
            >
              <Send className="h-4 w-4" />
            </button>
          )}

        </div>
      </div>

    </div>
  );

  if (isEmbedded) {
    return <div className="h-[calc(100vh-140px)] w-full">{mainChatContent}</div>;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans no-print select-none">
      
      {/* Floating Trigger Sphere */}
      <div className="relative">
        {avatarState === "listening" && (
          <div className="absolute -inset-4 rounded-full border-2 border-cyan-400/30 animate-[ping_1.6s_infinite] pointer-events-none"></div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          id="guardian-assistant-trigger"
          className={`relative h-14 w-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl ${
            isOpen 
              ? "bg-slate-900 border border-slate-700 text-slate-400" 
              : "bg-gradient-to-tr from-cyan-600 via-indigo-600 to-teal-500 text-white hover:scale-110 active:scale-95"
          }`}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <div className="relative flex items-center justify-center">
              <motion.div 
                animate={avatarState === "listening" ? { scale: [1, 1.25, 1] } : { scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              >
                <Sparkles className="h-4.5 w-4.5 text-cyan-200" />
              </motion.div>
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 border border-slate-950 bg-emerald-500"></span>
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Floating Popup Drawer Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="absolute bottom-20 right-0 w-[360px] sm:w-[430px] h-[580px] max-h-[82vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-800/80"
          >
            {mainChatContent}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
