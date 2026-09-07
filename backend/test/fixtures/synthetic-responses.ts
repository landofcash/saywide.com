export interface SyntheticResponse {
  fixtureId: string;
  workedWell: string;
  friction: string;
  nextChange: string;
}

const patterns: Omit<SyntheticResponse, "fixtureId">[] = [
  {
    workedWell: "Clear ownership helped us make decisions without another meeting.",
    friction: "Handoffs were sometimes unclear after a decision was made.",
    nextChange: "Name one owner and the next action in every meeting note.",
  },
  {
    workedWell: "Written context let quieter team members contribute thoughtfully.",
    friction: "Too many updates arrived in different channels.",
    nextChange: "Use one shared place for weekly project updates.",
  },
  {
    workedWell: "Short planning sessions kept the work focused.",
    friction: "Priorities changed without enough explanation.",
    nextChange: "Record why a priority changes and what work it replaces.",
  },
  {
    workedWell: "Pairing early helped us find risks before implementation.",
    friction: "Review requests could wait too long when schedules were busy.",
    nextChange: "Set a daily review window for open requests.",
  },
  {
    workedWell: "The team felt comfortable asking for help.",
    friction: "Some meetings did not have a clear purpose.",
    nextChange: "Add a decision or outcome to every meeting invitation.",
  },
  {
    workedWell: "Customer examples made abstract requirements easier to understand.",
    friction: "Late feedback caused avoidable rework.",
    nextChange: "Show a small draft to stakeholders earlier.",
  },
  {
    workedWell: "Protected focus time improved the quality of difficult work.",
    friction: "Unplanned requests often interrupted that focus time.",
    nextChange: "Route non-urgent requests through a visible intake queue.",
  },
  {
    workedWell: "Retrospectives led to small changes we could actually try.",
    friction: "We did not always revisit whether those changes helped.",
    nextChange: "Review the previous action at the start of each retrospective.",
  },
];

// Three deterministic variants keep the report fixture realistic but bounded at 24 responses.
export const syntheticResponses: SyntheticResponse[] = ["a", "b", "c"].flatMap((variant, variantIndex) =>
  patterns.map((pattern, patternIndex) => ({
    fixtureId: `synthetic-${variant}-${String(patternIndex + 1).padStart(2, "0")}`,
    workedWell: variantIndex === 0 ? pattern.workedWell : `${pattern.workedWell} This came up in our ${variantIndex === 1 ? "project" : "team"} work.`,
    friction: pattern.friction,
    nextChange: pattern.nextChange,
  })),
);
