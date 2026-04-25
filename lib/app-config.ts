export const brand = {
  name: "AutoAgentX",
  shortName: "AAX",
  supportEmail: "support@autoagentx.com",
  url: "https://www.autoagentx.com"
};

export const boostPresets = [
  {
    key: "hook-boost",
    name: "Hook Boost",
    description: "Sharper opening text and a stronger first impression."
  },
  {
    key: "caption-boost",
    name: "Caption Boost",
    description: "Cleaner, easier-to-read captions for short-form clips."
  },
  {
    key: "retention-boost",
    name: "Retention Boost",
    description: "More watchable pacing and visual retention cues."
  },
  {
    key: "balanced",
    name: "Balanced",
    description: "A clean all-around improvement pass for most clips."
  }
] as const;

export const targetPlatforms = [
  { key: "tiktok", name: "TikTok" },
  { key: "youtube-shorts", name: "YouTube Shorts" },
  { key: "instagram-reels", name: "Instagram Reels" }
] as const;

export const subtitleStyles = [
  "High Contrast",
  "Minimal Clean",
  "Bold Creator",
  "Story Captions"
] as const;

export const sourceUploadMaxMb = 20;

export const planCatalog = {
  free: {
    key: "free",
    name: "Free",
    monthlyCredits: 2,
    maxFileSizeMb: 150,
    featured: false,
    priceMonthly: 0,
    tagline: "Try the product with a couple of real boosts.",
    features: ["2 boosts", "Standard queue", "Lower file size limit"]
  },
  creator: {
    key: "creator",
    name: "Creator",
    monthlyCredits: 40,
    maxFileSizeMb: 500,
    featured: true,
    priceMonthly: 24,
    tagline: "For creators improving clips every week.",
    features: ["40 boosts / month", "Standard queue", "Bigger uploads"]
  },
  pro: {
    key: "pro",
    name: "Pro",
    monthlyCredits: 150,
    maxFileSizeMb: 1024,
    featured: false,
    priceMonthly: 79,
    tagline: "For serious short-form volume and faster turnaround.",
    features: ["150 boosts / month", "Priority label", "Large file limit"]
  },
  business: {
    key: "business",
    name: "Business",
    monthlyCredits: 500,
    maxFileSizeMb: 2048,
    featured: false,
    priceMonthly: 199,
    tagline: "For operators and teams processing many clips.",
    features: ["500 boosts / month", "Priority label", "Best limits"]
  }
} as const;

export type PlanKey = keyof typeof planCatalog;
export type BoostPresetKey = (typeof boostPresets)[number]["key"];
export type TargetPlatformKey = (typeof targetPlatforms)[number]["key"];

export const publicNav = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" }
];
