// All on-screen copy lives here. Edit this file to change the video's wording.
// English + Roman Urdu, per the brand voice.
export const brand = {
  name: "ZIDANE",
  url: "zidane.com.pk",
  descriptor: "Finance · Business",
  hook: { line1: "Paisa aata hai…", line2: ["par", "rukta", "kyun", "nahi?"], accentIndex: 1 },
  pillarsHeading: { pre: "Plan it with", accent: "Zidane" },
  pillars: [
    { icon: "wallet", title: "Smart Budgeting", sub: "Har rupay ka plan" },
    { icon: "flow", title: "Cash Flow Clarity", sub: "Paisa kahan ja raha hai — saaf" },
    { icon: "target", title: "Business Strategy", sub: "Growth ke liye sahi faislay" },
  ],
  payoff: { line1: "Clear numbers.", line2: "Confident decisions." },
  cta: "Aaj hi apna plan banayein",
} as const;

export type IconName = (typeof brand.pillars)[number]["icon"];
