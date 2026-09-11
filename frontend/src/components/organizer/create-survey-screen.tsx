"use client";

import type { SurveyDraftInput } from "@saywide/contracts";
import { ClipboardList, LoaderCircle, Mic, PenLine, RotateCcw, Square } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Brand } from "@/components/brand";
import { SurveyBuilderScreen } from "@/components/organizer/survey-builder-screen";
import { Button } from "@/components/ui/button";
import { api, apiCapabilities } from "@/lib/api";
import { createSurveyCreation, initialCreationState } from "@/lib/audio/survey-creation";
import { startTranscribeStream } from "@/lib/audio/transcribe-stream";

import styles from "./create-survey-screen.module.css";

export function CreateSurveyScreen() {
  const [draft, setDraft] = useState<SurveyDraftInput>();
  const [state, setState] = useState(initialCreationState);
  const [elapsed, setElapsed] = useState(0);
  const flow = useRef<ReturnType<typeof createSurveyCreation> | null>(null);
  const microphone = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = createSurveyCreation({
      startStream: (options) => startTranscribeStream({ ...options, createSession: () => api.createOrganizerTranscriptionSession() }),
      generate: (transcript, signal) => api.draftSurveyFromGoal(transcript, signal),
      onState: setState,
      onDraft: setDraft,
    });
    flow.current = controller;
    return () => { controller.dispose(); flow.current = null; };
  }, []);

  useEffect(() => {
    if (state.phase !== "recording") return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "error") microphone.current?.focus();
  }, [state.phase]);

  if (draft) return <SurveyBuilderScreen initialDraft={draft} />;

  const recording = state.phase === "recording";
  const busy = ["starting", "finishing", "generating"].includes(state.phase);
  const available = apiCapabilities.goalDrafting && apiCapabilities.voice;
  const status = {
    idle: "Tap to start recording",
    starting: "Connecting to your microphone…",
    recording: "Listening… tap to stop and prepare your survey",
    finishing: "Finishing your recording…",
    generating: "Preparing your survey…",
    error: "Tap to record again",
  }[state.phase];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Brand />
        <Button variant="secondary" size="sm" asChild><Link href="/dashboard"><ClipboardList className="size-4" aria-hidden="true" /> My surveys</Link></Button>
      </header>
      <main className={styles.main}>
        <section className={styles.content} aria-labelledby="create-title">
          <p className={styles.eyebrow}>Start with an idea</p>
          <h1 id="create-title" className={styles.title}>What would you like to know?</h1>
          <p className={styles.description}>Describe what you want to learn and mention any questions you’d like to ask. Our AI agent will prepare a survey you can review and edit before publishing.</p>

          <div className={styles.recorder}>
            <button
              ref={microphone}
              type="button"
              className={styles.microphone}
              data-recording={recording}
              disabled={!available || busy}
              aria-label={recording ? "Stop recording and prepare survey" : busy ? status : "Start recording"}
              aria-describedby="recording-status"
              onClick={() => {
                if (recording) flow.current?.stop();
                else { setElapsed(0); void flow.current?.start(); }
              }}
            >
              {busy ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : recording ? <Square className={styles.stopIcon} aria-hidden="true" /> : <Mic aria-hidden="true" />}
            </button>
            <p id="recording-status" className={styles.status} role="status">{available ? status : "Voice and AI creation are available with the live service."}</p>
            <div className={styles.feedback}>
              {recording && <span className={styles.timer} aria-label="Recording duration">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>}
              {(recording || busy) && <Button variant="ghost" size="sm" onClick={() => { flow.current?.cancel(); microphone.current?.focus(); }}>Cancel</Button>}
            </div>
          </div>

          {state.error && <div className={styles.error}>
            <p role="alert">{state.error}</p>
            {state.canRetry && <Button variant="secondary" className="mt-4" onClick={() => flow.current?.retry()}><RotateCcw className="size-4" aria-hidden="true" /> Retry</Button>}
          </div>}

          <Button variant="ghost" className="mt-4" asChild><Link href="/surveys/new"><PenLine className="size-4" aria-hidden="true" /> Start manually</Link></Button>
        </section>
      </main>
    </div>
  );
}
