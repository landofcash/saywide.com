"use client";

import type { SurveyDraftInput } from "@saywide/contracts";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Eye, GripVertical, Plus, Send, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { SurveyWritingControls } from "@/components/organizer/survey-writing-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { api } from "@/lib/api";

type DraftQuestion = SurveyDraftInput["questions"][number] & { editorId: string };

const blankQuestion = (position: number): DraftQuestion => ({ editorId: crypto.randomUUID(), prompt: "", required: true, position });

export function SurveyBuilderScreen({ surveyId }: { surveyId?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion(0)]);
  const [expiresAt, setExpiresAt] = useState("");
  const [minResponses, setMinResponses] = useState(2);
  const [loading, setLoading] = useState(Boolean(surveyId));
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [preview, setPreview] = useState(false);
  const [currentId, setCurrentId] = useState(surveyId);
  const [writingBusy, setWritingBusy] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  useEffect(() => {
    if (!surveyId) return;
    void api.getSurvey(surveyId).then((survey) => {
      setTitle(survey.title);
      setIntroduction(survey.introduction);
      setQuestions(survey.questions.map(({ questionId, prompt, required, position, warning }) => ({ editorId: questionId, prompt, required, position, warning })));
      setExpiresAt(survey.settings.expiresAt?.slice(0, 10) ?? "");
      setMinResponses(survey.settings.minReportResponses);
      setLoading(false);
    });
  }, [surveyId]);

  const descriptionValid = title.trim().length > 0 && Number.isInteger(minResponses) && minResponses >= 1 && minResponses <= 50;
  const valid = descriptionValid && questions.length > 0 && questions.every((question) => question.prompt.trim().length > 0);

  function input(): SurveyDraftInput {
    return {
      title: title.trim(),
      introduction: introduction.trim(),
      questions: questions.map((question, position) => ({ prompt: question.prompt.trim(), required: question.required, warning: question.warning, position })),
      settings: {
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:00`).toISOString() : null,
        hasAccessCode: false,
        minReportResponses: minResponses,
      },
    };
  }

  async function save() {
    if (!valid || writingBusy) return null;
    setSaving(true);
    setSaveState("idle");
    try {
      const survey = currentId ? await api.updateSurvey(currentId, input()) : await api.createSurvey(input());
      setCurrentId(survey.surveyId);
      setSaveState("saved");
      if (!currentId) window.history.replaceState({}, "", `/surveys/${survey.surveyId}/edit`);
      return survey;
    } catch {
      setSaveState("error");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    const saved = await save();
    if (!saved) return;
    const published = await api.publishSurvey(saved.surveyId);
    router.push(`/surveys/${published.surveyId}/share`);
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((current) => current.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question));
    setSaveState("idle");
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= questions.length) return;
    setQuestions((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next.map((question, position) => ({ ...question, position }));
    });
  }

  if (loading) {
    return <OrganizerShell><div className="space-y-5" aria-label="Loading survey builder"><div className="h-16 w-2/3 animate-pulse rounded-xl bg-white" /><div className="h-96 animate-pulse rounded-xl bg-white" /></div></OrganizerShell>;
  }

  return (
    <OrganizerShell wide>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" /> My surveys</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Step {step} of 2 · {step === 1 ? "Survey details" : "Questions"}</p>
          <h1 ref={headingRef} tabIndex={-1} className="font-display mt-2 text-3xl font-bold tracking-[-0.03em] outline-none sm:text-4xl">{step === 1 ? "Describe your survey" : "Shape your questions"}</h1>
          {step === 2 && <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Speak your questions naturally, then let AI polish them for clarity.</p>}
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-5">
          <div hidden={step !== 1} className="space-y-5">
          <Card className="p-5 sm:p-7">
            <div className="space-y-3 text-sm leading-6 text-[var(--muted)]">
              <p>Say your survey name and what participants should know, AI can polish the wording.</p>
            </div>
            <div className="mt-5">
              <Label htmlFor="survey-title">Title</Label>
              <Input id="survey-title" maxLength={160} readOnly={writingBusy} value={title} onChange={(event) => { setTitle(event.target.value); setSaveState("idle"); }} placeholder="Quarterly team retrospective" />
              <SurveyWritingControls field="title" value={title} disabled={writingBusy || saving} onBusyChange={setWritingBusy} onChange={(text) => { setTitle(text); setSaveState("idle"); }} />
            </div>
            <div className="mt-5">
              <Label htmlFor="survey-introduction">What participants should know</Label>
              <Textarea id="survey-introduction" rows={4} maxLength={2000} readOnly={writingBusy} value={introduction} onChange={(event) => { setIntroduction(event.target.value); setSaveState("idle"); }} placeholder="Why you are asking and how answers will be used." />
              <SurveyWritingControls field="introduction" value={introduction} disabled={writingBusy || saving} onBusyChange={setWritingBusy} onChange={(text) => { setIntroduction(text); setSaveState("idle"); }} />
            </div>
          </Card>

          <section aria-label="Additional settings">
            <Card className="p-5 sm:p-7">
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--coral)] [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block text-sm font-bold text-[var(--coral-dark)]">Additional settings</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                      {expiresAt ? `Closes ${new Date(`${expiresAt}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "No closing date"}
                      {` · Minimum ${minResponses} ${minResponses === 1 ? "response" : "responses"}`}
                    </span>
                  </span>
                  <ChevronDown className="size-5 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Choose a closing date and set the minimum number of responses required to generate a report.</p>
                <div className="mt-5">
                  <Label htmlFor="expiry">Close on</Label>
                  <Input id="expiry" type="date" value={expiresAt} onChange={(event) => { setExpiresAt(event.target.value); setSaveState("idle"); }} />
                </div>
                <div className="mt-5">
                  <Label htmlFor="minimum">Minimum responses for a report</Label>
                  <Input id="minimum" type="number" min={1} max={50} value={minResponses} onChange={(event) => { setMinResponses(Number(event.target.value)); setSaveState("idle"); }} />
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">A minimum helps keep small groups from being singled out.</p>
                </div>
                <div className="mt-6 rounded-lg border-l-4 border-l-[var(--coral)] bg-[var(--canvas)] p-4 text-sm leading-6">
                  <p className="font-bold">Participant privacy</p>
                  <p className="mt-1 text-emerald-950/75">Saywide will not ask participants for a name, email, or account.</p>
                </div>
              </details>
            </Card>
          </section>
          </div>

          <div hidden={step !== 2} className="space-y-5">

          {questions.map((question, index) => (
            <Card key={question.editorId} className="p-5 sm:p-6">
              <div className="flex gap-3">
                <GripVertical className="mt-3 hidden size-5 shrink-0 text-[var(--muted)] sm:block" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`question-${index}`} className="mb-0">Question {index + 1}</Label>
                    <div className="flex">
                      <Button variant="ghost" size="icon" onClick={() => moveQuestion(index, -1)} disabled={index === 0 || writingBusy || saving} aria-label={`Move question ${index + 1} up`}><ArrowUp className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1 || writingBusy || saving} aria-label={`Move question ${index + 1} down`}><ArrowDown className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={questions.length === 1 || writingBusy || saving} aria-label={`Remove question ${index + 1}`}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                  <Textarea id={`question-${index}`} rows={3} maxLength={1000} readOnly={writingBusy || saving} value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="Ask an open-ended question" className="mt-2" />
                  <SurveyWritingControls field="question" fieldLabel={`question ${index + 1}`} value={question.prompt} disabled={writingBusy || saving} onBusyChange={setWritingBusy} onChange={(text) => updateQuestion(index, { prompt: text })} />
                  {question.warning && <p className="mt-2 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> {question.warning}</p>}
                </div>
              </div>
            </Card>
          ))}

          <Button variant="secondary" onClick={() => setQuestions((current) => [...current, blankQuestion(current.length)])} disabled={writingBusy || saving}><Plus className="size-4" /> Add question</Button>
          </div>
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-6 flex flex-col items-end gap-2">
          {!descriptionValid && <p className="text-sm text-[var(--muted)]">{!title.trim() ? "Enter a survey title to continue." : "In Additional settings, choose a minimum of 1–50 responses."}</p>}
          <Button variant="accent" onClick={() => setStep(2)} disabled={!descriptionValid || saving || writingBusy}>Next: Questions <ArrowRight className="size-4" /></Button>
        </div>
      ) : <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" className="mr-auto" onClick={() => setStep(1)} disabled={saving || writingBusy}><ArrowLeft className="size-4" /> Back</Button>
        <span className="hidden text-xs font-semibold text-[var(--muted)] sm:inline" aria-live="polite">
          {saving ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Could not save" : "Not saved yet"}
        </span>
        <Button variant="secondary" onClick={() => void save()} disabled={!valid || saving || writingBusy}>{saving ? "Saving…" : "Save draft"}</Button>
        <Button variant="secondary" onClick={() => setPreview(true)}><Eye className="size-4" /> Preview</Button>
        <Button variant="accent" onClick={publish} disabled={!valid || saving || writingBusy}><Send className="size-4" /> Publish survey</Button>
      </div>}

      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--ink)]/45 p-4" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Participant preview</p><h2 id="preview-title" className="font-display mt-2 text-2xl font-bold">{title || "Untitled survey"}</h2></div><Button variant="ghost" onClick={() => setPreview(false)}>Close</Button></div>
            <p className="mt-4 leading-7 text-[var(--muted)]">{introduction || "Your survey introduction will appear here."}</p>
            <div className="mt-6 space-y-3">{questions.map((question, index) => <div key={index} className="rounded-lg border border-[var(--line)] p-4"><p className="text-xs font-bold text-[var(--muted)]">QUESTION {index + 1}</p><p className="mt-2 font-semibold">{question.prompt || "Your question will appear here."}</p></div>)}</div>
          </Card>
        </div>
      )}
    </OrganizerShell>
  );
}
