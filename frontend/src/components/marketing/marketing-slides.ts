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
    label: "Placeholder one",
    headline: "First story headline",
    description: "Temporary supporting copy for the first Saywide story.",
    image: {
      src: "/images/first-story.png",
      alt: "People gathered around a table with speech bubbles representing a shared conversation",
    },
  },
  {
    number: "02",
    label: "Placeholder two",
    headline: "Second story headline",
    description: "Temporary supporting copy for the second Saywide story.",
  },
  {
    number: "03",
    label: "Placeholder three",
    headline: "Third story headline",
    description: "Temporary supporting copy for the third Saywide story.",
  },
];
