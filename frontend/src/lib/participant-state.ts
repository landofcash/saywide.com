const SESSION_PREFIX = "saywide.participant-session.";

export function saveParticipantSession(publicToken: string, sessionId: string) {
  window.sessionStorage.setItem(`${SESSION_PREFIX}${publicToken}`, sessionId);
}

export function hasSubmittedFromBrowser(publicToken: string) {
  return Boolean(window.localStorage.getItem(`saywide.response.${publicToken}.submitted`));
}

export function getSubmittedAt(publicToken: string) {
  return window.localStorage.getItem(`saywide.response.${publicToken}.submitted`);
}
