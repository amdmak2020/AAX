import {
  Captions,
  Clapperboard,
  Gauge,
  ScissorsLineDashed,
  Sparkles,
  Upload,
  Wand2
} from "lucide-react";
import { planCatalog } from "@/lib/app-config";

export const navItems = [
  { label: "Chat Editing", href: "/#chat-editing" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" }
];

export const heroProof = ["Upload a clip", "Pick a boost style", "Get the improved version back"];

export const problems = [
  {
    title: "Weak openings",
    description: "Your clip may be good, but the first seconds do not grab attention fast enough.",
    icon: Wand2
  },
  {
    title: "Hard-to-read captions",
    description: "Small, inconsistent subtitles make the video feel cheaper and harder to follow.",
    icon: Captions
  },
  {
    title: "Not enough watchability",
    description: "The clip needs more shape, more clarity, and a cleaner presentation to hold attention.",
    icon: Gauge
  }
];

export const steps = [
  { title: "Upload your clip", description: "Drag in the source video and give the project a name.", icon: Upload },
  { title: "Choose a boost preset", description: "Tell the product whether you want better hooks, captions, retention, or a balanced pass.", icon: Sparkles },
  { title: "Download the improved version", description: "Track the status and grab the final boosted short when it is ready.", icon: Clapperboard }
];

export const beforeAfter = [
  {
    title: "Before",
    bullets: ["Weak first line", "Flat captions", "Less urgency to keep watching"]
  },
  {
    title: "After",
    bullets: ["Stronger opening hook", "Cleaner, more visible subtitles", "More engaging short-form presentation"]
  }
];

export const examples = [
  {
    title: "Talking-head clip",
    label: "Hook Boost",
    caption: "Stop losing viewers in the first 3 seconds",
    image:
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80"
  },
  {
    title: "Tutorial clip",
    label: "Caption Boost",
    caption: "Cleaner subtitles that are easier to follow on mute",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80"
  },
  {
    title: "Story clip",
    label: "Retention Boost",
    caption: "A stronger opener and clearer pacing for short-form feeds",
    image:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80"
  }
] as const;

export const features = [
  { title: "Hook upgrades", description: "Give the opening seconds a clearer reason to keep watching.", icon: Wand2 },
  { title: "Subtitle improvements", description: "Make captions easier to read and more natural for short-form viewing.", icon: Captions },
  { title: "Retention polish", description: "Shape the clip into something more watchable without manual editing.", icon: ScissorsLineDashed },
  { title: "Simple status tracking", description: "See whether the clip is queued, processing, rendering, completed, or failed.", icon: Gauge }
];

export const faqs = [
  {
    question: "Is this a full video editor?",
    answer: "No. This is a focused product for improving short-form clips before posting, not a full editing timeline."
  },
  {
    question: "What does the boost actually change?",
    answer: "V1 is designed around stronger opening hooks, better subtitle presentation, and a more watchable short-form result."
  },
  {
    question: "How do credits work?",
    answer: "Each submitted boost uses one credit. Your dashboard shows the remaining balance for the current period."
  },
  {
    question: "Can it connect to an external processing engine?",
    answer: "Yes. The app is designed around a processor provider abstraction so the external clip-processing engine can be swapped in cleanly."
  }
];

export const plans = Object.values(planCatalog).map((plan) => ({
  name: plan.name,
  price: `$${plan.priceMonthly}`,
  description: plan.tagline,
  credits: `${plan.monthlyCredits} boosts / month`,
  cta: plan.priceMonthly === 0 ? "Start free" : "Coming soon",
  featured: plan.featured,
  features: plan.features,
  ctaHref: plan.priceMonthly === 0 ? "/signup" : undefined,
  ctaDisabled: plan.priceMonthly > 0
}));

export const marketingCopy = {
  title: `AutoAgentX | AI video editor for hooks, subtitles, and short-form retention`,
  description:
    "AutoAgentX helps creators turn boring clips into high-retention shorts with stronger hooks, cleaner subtitles, and faster short-form editing."
};
