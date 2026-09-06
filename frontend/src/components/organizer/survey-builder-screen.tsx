"use client";

import type { SurveyDraftInput } from "@saywide/contracts";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, GripVertical, Plus, Send, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { api } from "@/lib/api";

type DraftQuestion = SurveyDraftInput["questions"][number];

const blankQuestion = (position: number): DraftQuestion => ({ prompt: "", required: true, position });

export function SurveyBuilderScreen({ surveyId }: { surveyId?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion(0)]);
  const [expiresAt, setExpiresAt] = useState("");
  const [minResponses, setMinResponses] = useState(5);
  const [loading, setLoading] = useState(Boolean(surveyId));
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [preview, setPreview] = useState(false);
  const [currentId, setCurrentId] = useState(surveyId);

  useEffect(() => {
    if (!surveyId) return;
    void api.getSurvey(surveyId).then((survey) => {
      setTitle(survey.title);
      setIntroduction(survey.introduction);
      setQuestions(survey.questions.map(({ prompt, required, position, warning }) => ({ prompt, required, position, warning })));
      setExpiresAt(survey.settings.expiresAt?.slice(0, 10) ?? "");
      setMinResponses(survey.settings.minReportResponses);
      setLoading(false);
    });
  }, [surveyId]);

  const valid = title.trim().length > 0 && questions.length > 0 && questions.every((question) => question.prompt.trim().length > 0);

  function input(): SurveyDraftInput {
    return {
      title: title.trim(),
      introduction: introduction.trim(),
      questions: questions.map((question, position) => ({ ...question, prompt: question.prompt.trim(), position })),
      settings: {
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:00`).toISOString() : null,
        hasAccessCode: false,
        minReportResponses: minResponses,
      },
    };
  }

  async function save() {
    if (!valid) return null;
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
          <h1 className="font-display mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Shape the questions</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-semibold text-[var(--muted)] sm:inline" aria-live="polite">
            {saving ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Could not save" : "Not saved yet"}
          </span>
          <Button variant="secondary" onClick={() => setPreview(true)}><Eye className="size-4" /> Preview</Button>
          <Button variant="accent" onClick={publish} disabled={!valid || saving}><Send className="size-4" /> Publish survey</Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Survey introduction</p>
            <div className="mt-5">
              <Label htmlFor="survey-title">Title</Label>
              <Input id="survey-title" value={title} onChange={(event) => { setTitle(event.target.value); setSaveState("idle"); }} placeholder="Quarterly team retrospective" />
            </div>
            <div className="mt-5">
              <Label htmlFor="survey-introduction">What participants should know</Label>
              <Textarea id="survey-introduction" rows={4} value={introduction} onChange={(event) => { setIntroduction(event.target.value); setSaveState("idle"); }} placeholder="Why you are asking and how answers will be used." />
            </div>
          </Card>

          <div className="flex items-end justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Questions</p><h2 className="font-display mt-1 text-2xl font-bold">One clear thought at a time</h2></div>
            <span className="text-sm font-semibold text-[var(--muted)]">{questions.length} / 5</span>
          </div>

          {questions.map((question, index) => (
            <Card key={index} className="p-5 sm:p-6">
              <div className="flex gap-3">
                <GripVertical className="mt-3 hidden size-5 shrink-0 text-[var(--muted)] sm:block" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`question-${index}`} className="mb-0">Question {index + 1}</Label>
                    <div className="flex">
                      <Button variant="ghost" size="icon" onClick={() => moveQuestion(index, -1)} disabled={index === 0} aria-label={`Move question ${index + 1} up`}><ArrowUp className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1} aria-label={`Move question ${index + 1} down`}><ArrowDown className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={questions.length === 1} aria-label={`Remove question ${index + 1}`}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                  <Textarea id={`question-${index}`} rows={3} value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="Ask an open-ended question" className="mt-2" />
                  <label className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[var(--ink)]" checked={question.required} onChange={(event) => updateQuestion(index, { required: event.target.checked })} /> Required answer</label>
                  {question.warning && <p className="mt-2 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> {question.warning}</p>}
                </div>
              </div>
            </Card>
          ))}

          <Button variant="secondary" onClick={() => setQuestions((current) => [...current, blankQuestion(current.length)])} disabled={questions.length >= 5}><Plus className="size-4" /> Add question</Button>
        </div>

        <aside className="space-y-5">
          <Card className="p-6 xl:sticky xl:top-28">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Collection settings</p>
            <div className="mt-5">
              <Label htmlFor="expiry">Close on</Label>
              <Input id="expiry" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </div>
            <div className="mt-5">
              <Label htmlFor="minimum">Minimum responses for a report</Label>
              <Input id="minimum" type="number" min={3} max={50} value={minResponses} onChange={(event) => setMinResponses(Number(event.target.value))} />
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">A minimum helps keep small groups from being singled out.</p>
            </div>
            <div className="mt-6 rounded-lg border-l-4 border-l-[var(--coral)] bg-[var(--canvas)] p-4 text-sm leading-6">
              <p className="font-bold">Participant privacy</p>
              <p className="mt-1 text-emerald-950/75">Saywide will not ask participants for a name, email, or account.</p>
            </div>
            <Button variant="secondary" className="mt-5 w-full" onClick={() => void save()} disabled={!valid || saving}>{saving ? "Saving…" : "Save draft"}</Button>
          </Card>
        </aside>
      </div>

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
