export type MarketingSlide = {
  number: string;
  label: string;
  headline: string;
  description: string;
  image?: {
    src: string;
    alt: string;
  };
};

export const marketingSlides: MarketingSlide[] = [
  {
    number: "01",
    label: "AI prepares the survey—just share it.",
    headline: "Hear from everyone.",
    description: "Step 1 — Create your survey with the agent.",
    image: {
      src: "/images/first-story.png",
      alt: "People gathered around a table with speech bubbles representing a shared conversation",
    },
  },
  {
    number: "02",
    label: "Respondents answer in their own words.",
    headline: "Record what you want to say.",
    description: "Step 2 — Collect responses for the agent.",
  },
  {
    number: "03",
    label: "Tell the agent what you want to discover.",
    headline: "The agent generates a report.",
    description: "Step 3 — Guide the agent to create the report.",
  },
];
