import type { ParticipantAnswers, ResponseSession } from "@saywide/contracts";

interface StoredResponseSession extends ResponseSession {
  consentVersion: string;
}

const RESPONSE_PREFIX = "saywide.response.";
const sessions = new Map<string, StoredResponseSession>();

export function getDraftAnswers(publicToken: string): ParticipantAnswers {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(`${RESPONSE_PREFIX}${publicToken}.draft`) ?? "{}") as ParticipantAnswers;
  } catch {
    return {};
  }
}

export function saveDraftAnswer(publicToken: string, questionId: string, answer: string): void {
  const answers = getDraftAnswers(publicToken);
  answers[questionId] = answer;
  window.localStorage.setItem(`${RESPONSE_PREFIX}${publicToken}.draft`, JSON.stringify(answers));
}

export function completeDraft(publicToken: string, submittedAt: string): void {
  window.localStorage.removeItem(`${RESPONSE_PREFIX}${publicToken}.draft`);
  window.localStorage.setItem(`${RESPONSE_PREFIX}${publicToken}.submitted`, submittedAt);
}

export function rememberResponseSession(publicToken: string, session: ResponseSession, consentVersion: string): void {
  sessions.set(publicToken, { ...session, consentVersion });
}

export function readResponseSession(publicToken: string): StoredResponseSession | undefined {
  const session = sessions.get(publicToken);
  if (session && new Date(session.expiresAt) <= new Date()) {
    sessions.delete(publicToken);
    return undefined;
  }
  return session;
}
