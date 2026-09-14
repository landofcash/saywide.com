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
      src: "/images/slide-1.png",
      alt: "Two hundred messages in the group chat. A yes-or-no poll. Still no decision.",
    },
  },
  {
    number: "02",
    label: "Respondents answer in their own words.",
    headline: "Record what you want to say.",
    description: "Step 2 — Collect responses for the agent.",
	image: {
      src: "/images/slide-2.png",
      alt: "Participants answer anonymously by voice or text, review their answers, and submit. No participant account is needed.",
    },
  },
  {
    number: "03",
    label: "Tell the agent what you want to discover.",
    headline: "The agent generates a report.",
    description: "Step 3 — Guide the agent to create the report.",
	image: {
      src: "/images/slide-3.png",
      alt: "Watch the agent's progress, then explore findings, supporting quotes, and suggested actions.",
    },
  },
];
