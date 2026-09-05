import type { Report, SurveyDetail } from "@saywide/contracts";

export interface MockState {
  surveys: SurveyDetail[];
  reports: Report[];
}

export function createInitialState(): MockState {
  return {
    surveys: [
      {
        surveyId: "team-retro",
        title: "Quarterly team retrospective",
        introduction:
          "Help us understand what made this quarter work, where collaboration felt difficult, and what we should change next.",
        status: "open",
        questions: [
          { questionId: "q-retro-1", prompt: "What helped you do your best work this quarter?", required: true, position: 0 },
          { questionId: "q-retro-2", prompt: "Where did our way of working slow you down?", required: true, position: 1 },
          { questionId: "q-retro-3", prompt: "What is one change we should try next quarter?", required: true, position: 2 },
        ],
        settings: { expiresAt: "2026-09-30T22:59:00.000Z", hasAccessCode: false, minReportResponses: 5 },
        publicToken: "team-voices",
        participantUrl: "/s/team-voices",
        questionCount: 3,
        submittedResponseCount: 12,
        startedResponseCount: 15,
        reportState: "Ready",
        expiresAt: "2026-09-30T22:59:00.000Z",
        lastSubmittedAt: "2026-09-05T09:20:00.000Z",
        createdAt: "2026-08-28T09:00:00.000Z",
        updatedAt: "2026-09-05T09:20:00.000Z",
      },
      {
        surveyId: "launch-feedback",
        title: "Beta launch feedback",
        introduction: "Tell us what felt useful and what needs another pass before launch.",
        status: "draft",
        questions: [
          { questionId: "q-launch-1", prompt: "What did you expect to accomplish with the beta?", required: true, position: 0 },
          {
            questionId: "q-launch-2",
            prompt: "Which part felt least clear, and why?",
            required: true,
            position: 1,
            warning: "Consider testing this wording with one participant before publishing.",
          },
        ],
        settings: { expiresAt: null, hasAccessCode: false, minReportResponses: 5 },
        publicToken: null,
        participantUrl: null,
        questionCount: 2,
        submittedResponseCount: 0,
        startedResponseCount: 0,
        reportState: "Not started",
        expiresAt: null,
        lastSubmittedAt: null,
        createdAt: "2026-09-04T14:40:00.000Z",
        updatedAt: "2026-09-04T15:12:00.000Z",
      },
      {
        surveyId: "volunteer-check-in",
        title: "Volunteer event check-in",
        introduction: "A short reflection on the community day.",
        status: "closed",
        questions: [
          { questionId: "q-volunteer-1", prompt: "What made volunteering feel worthwhile?", required: true, position: 0 },
          { questionId: "q-volunteer-2", prompt: "What would make the next event easier to join?", required: false, position: 1 },
        ],
        settings: { expiresAt: null, hasAccessCode: false, minReportResponses: 5 },
        publicToken: "volunteer-day",
        participantUrl: "/s/volunteer-day",
        questionCount: 2,
        submittedResponseCount: 8,
        startedResponseCount: 9,
        reportState: "Complete",
        expiresAt: null,
        lastSubmittedAt: "2026-08-21T18:02:00.000Z",
        createdAt: "2026-08-12T10:00:00.000Z",
        updatedAt: "2026-08-22T08:30:00.000Z",
      },
    ],
    reports: [
      {
        reportId: "report-retro-01",
        surveyId: "team-retro",
        surveyTitle: "Quarterly team retrospective",
        instruction: "Find the strongest patterns, the biggest friction points, and practical actions for next quarter.",
        status: "completed",
        snapshotAt: "2026-09-05T09:25:00.000Z",
        eligibleResponseCount: 12,
        createdAt: "2026-09-05T09:25:00.000Z",
        completedAt: "2026-09-05T09:27:00.000Z",
        limitations: [
          "The report describes 12 submitted responses, not 12 verified unique people.",
          "Open-ended responses may overrepresent experiences participants felt strongly about.",
        ],
        findings: [
          {
            findingId: "finding-1",
            title: "Clear ownership created momentum",
            category: "strength",
            summary: "Respondents most often connected productive weeks with knowing who could make a decision and what outcome mattered.",
            supportCount: 9,
            supportPercentage: 75,
            confidence: "high",
            suggestedAction: "Name one decision owner and one measurable outcome at the start of each cross-team project.",
            evidence: [
              { label: "Response A03", excerpt: "Once one person owned the call, we stopped circling and moved." },
              { label: "Response A11", excerpt: "The projects with a clear finish line were the ones I could actually protect time for." },
            ],
          },
          {
            findingId: "finding-2",
            title: "Meeting handoffs are the main source of drag",
            category: "friction",
            summary: "Unclear actions after recurring meetings caused repeated clarification and slowed work across teams.",
            supportCount: 7,
            supportPercentage: 58,
            confidence: "medium",
            suggestedAction: "End recurring meetings with a two-minute owner, action, and due-date recap.",
            evidence: [
              { label: "Response A01", excerpt: "The meeting ends, then everyone has a different version of what happens next." },
              { label: "Response A08", excerpt: "I lose more time checking the handoff than doing the handoff." },
            ],
          },
          {
            findingId: "finding-3",
            title: "A quieter group needs more preparation time",
            category: "minority-view",
            summary: "A smaller group said fast live discussions favor the loudest perspective and asked for questions in advance.",
            supportCount: 3,
            supportPercentage: 25,
            confidence: "emerging",
            suggestedAction: "Share discussion prompts one day ahead and collect a short written view before the meeting.",
            evidence: [
              { label: "Response A06", excerpt: "I usually have the useful thought after the call, not while five people are speaking." },
            ],
          },
        ],
        minorityViews: ["Three responses preferred fewer collaborative rituals, even if handoffs become less consistent."],
        followUpQuestions: ["Which recurring meeting creates the most avoidable follow-up?", "What decision can one team own end to end next quarter?"],
      },
    ],
  };
}
