"use client";

import { Mic, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { startTranscribeStream, type TranscribeStreamController } from "@/lib/audio/transcribe-stream";

interface Props {
  field: "title" | "introduction" | "question" | "report-instruction";
  fieldLabel?: string;
  value: string;
  disabled: boolean;
  voiceButtonClassName?: string;
  onChange(value: string): void;
  onBusyChange(busy: boolean): void;
}

export function SurveyWritingControls({ field, fieldLabel, value, disabled, voiceButtonClassName, onChange, onBusyChange }: Props) {
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "finishing" | "polishing">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [partial, setPartial] = useState("");
  const [suggestion, setSuggestion] = useState<{ source: string; text: string } | null>(null);
  const [undo, setUndo] = useState<{ source: string; text: string } | null>(null);
  const controller = useRef<TranscribeStreamController | null>(null);
  const requestId = useRef(0);
  const pending = useRef(false);
  const maxLength = field === "title" ? 160 : field === "question" ? 1000 : 2000;
  const label = fieldLabel ?? (field === "title" ? "title" : field === "question" ? "question" : field === "report-instruction" ? "report instruction" : "participant introduction");

  useEffect(() => () => {
    requestId.current += 1;
    controller.current?.cancel();
    onBusyChange(false);
  }, [onBusyChange]);

  async function record() {
    if (pending.current || disabled) return;
    pending.current = true;
    const id = ++requestId.current;
    const before = value.trim();
    let ended = false;
    setError("");
    setMessage("");
    setPartial("");
    setSuggestion(null);
    setPhase("starting");
    onBusyChange(true);
    try {
      const stream = await startTranscribeStream({
        createSession: () => api.createOrganizerTranscriptionSession(),
        onTranscript: ({ finalizedText, partialText }) => {
          if (requestId.current !== id) return;
          const next = [before, finalizedText].filter(Boolean).join(" ");
          if (next.length > maxLength) {
            setError(`The ${label} is limited to ${maxLength} characters. Shorten the text to continue.`);
            controller.current?.stop();
            setPhase("finishing");
            return;
          }
          onChange(next);
          setPartial(partialText);
        },
        onError: () => {
          if (requestId.current === id) setError("Voice input could not continue. Check microphone permission and your connection, or type your text.");
        },
        onEnded: (reason) => {
          ended = true;
          if (requestId.current !== id) return;
          controller.current = null;
          pending.current = false;
          setPhase("idle");
          setPartial("");
          setMessage(reason === "limit" ? "Recording limit reached. Review your text or record more." : "");
          onBusyChange(false);
        },
      });
      if (requestId.current !== id || ended) {
        stream.cancel();
        return;
      }
      controller.current = stream;
      setPhase("recording");
    } catch (reason) {
      if (requestId.current !== id) return;
      pending.current = false;
      setPhase("idle");
      setError(reason instanceof Error ? reason.message : "Voice input is unavailable. You can continue by typing.");
      onBusyChange(false);
    }
  }

  async function polish() {
    if (field === "report-instruction" || pending.current || disabled || !value.trim()) return;
    pending.current = true;
    const id = ++requestId.current;
    setError("");
    setMessage("");
    setSuggestion(null);
    setPhase("polishing");
    onBusyChange(true);
    try {
      const result = await api.polishSurveyText({ field, text: value });
      if (requestId.current === id) setSuggestion({ source: value, text: result.text });
    } catch (reason) {
      if (requestId.current === id) setError(reason instanceof Error ? reason.message : "AI polishing is unavailable. Your text is unchanged.");
    } finally {
      if (requestId.current === id) {
        pending.current = false;
        setPhase("idle");
        onBusyChange(false);
      }
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {phase === "recording" ? (
          <Button type="button" variant="accent" size="sm" onClick={() => { setPhase("finishing"); controller.current?.stop(); }}>
            <Square className="size-4" /> Stop recording
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" className={voiceButtonClassName} disabled={disabled || phase !== "idle" || value.length >= maxLength} onClick={() => void record()} aria-label={`Dictate ${label}`}>
            <Mic className="size-4" /> {phase === "starting" ? "Connecting…" : phase === "finishing" ? "Finishing…" : "Use voice"}
          </Button>
        )}
        {field !== "report-instruction" && <Button type="button" variant="ghost" size="sm" disabled={disabled || phase !== "idle" || !value.trim()} onClick={() => void polish()} aria-label={`Polish ${label} with AI`}>
          <Sparkles className="size-4" /> {phase === "polishing" ? "Polishing…" : "Polish with AI"}
        </Button>}
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]" role="status">
        {phase === "recording" ? (partial || "Listening… speak naturally, then stop to review.") : phase === "finishing" ? "Finishing your transcript…" : message}
      </p>
      {error && <p className="mt-2 text-sm text-red-800" role="alert">{error}</p>}
      {suggestion && suggestion.source === value && (
        <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--mint-soft)] p-4">
          <p className="text-sm font-semibold">AI suggestion — review before using</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{suggestion.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={disabled} onClick={() => { onChange(suggestion.text); setUndo(suggestion); setSuggestion(null); }}>Use suggestion</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSuggestion(null)}>Keep original</Button>
          </div>
        </div>
      )}
      {undo && undo.text === value && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { onChange(undo.source); setUndo(null); }}>Restore original text</Button>}
    </div>
  );
}
