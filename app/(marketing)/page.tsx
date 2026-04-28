import { randomUUID } from "crypto";
import { CheckCircle2, CircleX, MessageSquareMore } from "lucide-react";
import Script from "next/script";
import { InteractiveSurface } from "@/components/effects/interactive-surface";
import { MagneticPanel } from "@/components/effects/magnetic-panel";
import { HomeHeroTool } from "@/components/public/home-hero-tool";
import { CtaBlock } from "@/components/public/cta-block";
import { PricingCard } from "@/components/public/pricing-card";
import { SectionWrapper } from "@/components/public/section-wrapper";
import { Card } from "@/components/ui/card";
import { brand, sourceUploadMaxMb } from "@/lib/app-config";
import { getCsrfTokenForRender } from "@/lib/csrf";
import { faqs, plans } from "@/lib/product";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const motionLabels = [
    "Hook rewrite",
    "Subtitle cleanup",
    "Pacing pass",
    "Scroll-stopping intro",
    "Mobile-friendly captions",
    "Retention polish"
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: brand.name,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    url: brand.url,
    description:
      "AutoAgentX is an AI video editor for creators who want stronger hooks, cleaner subtitles, and higher-retention short-form videos.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "199",
      priceCurrency: "USD"
    },
    creator: {
      "@type": "Organization",
      name: brand.name,
      url: brand.url
    }
  };

  const csrfToken = await getCsrfTokenForRender();
  let isLoggedIn = false;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    isLoggedIn = Boolean(user);
  } catch {
    isLoggedIn = false;
  }

  return (
    <main>
      <Script id="aax-softwareapp-schema" type="application/ld+json">
        {JSON.stringify(structuredData)}
      </Script>
      <section className="border-b border-pearl/10">
        <div className="hero-aurora mx-auto max-w-[88rem] px-5 py-7 md:py-8">
          <div className="hero-orbit" aria-hidden="true">
            <span className="hero-orbit-ring hero-orbit-ring-one" />
            <span className="hero-orbit-ring hero-orbit-ring-two" />
            <span className="hero-orbit-dot hero-orbit-dot-one" />
            <span className="hero-orbit-dot hero-orbit-dot-two" />
          </div>
          <div className="mx-auto max-w-7xl text-center">
            <p className="pulse-chip inline-flex rounded-full border border-pearl/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-pearl/78">
              Your content is fine. Your retention isn&apos;t.
            </p>
            <h1 className="mt-4 mx-auto max-w-[28ch] text-balance text-[2.7rem] font-black leading-[0.9] tracking-tight md:max-w-[24ch] md:text-[3.7rem] lg:max-w-[26ch] lg:text-[4.15rem]">
              <span className="block">Turn boring clips into</span>
              <span className="hero-highlight block text-mint">high-retention shorts</span>
            </h1>
            <p className="mx-auto mt-3 max-w-4xl text-[0.96rem] leading-6 text-pearl/66 md:text-[1rem] md:leading-7">
              Stronger hooks, cleaner subtitles, and tighter pacing for people who keep getting skipped.
            </p>
          </div>

          <div className="mx-auto mt-4 max-w-6xl">
            <HomeHeroTool csrfToken={csrfToken} idempotencyKey={randomUUID()} isLoggedIn={isLoggedIn} uploadLimitMb={sourceUploadMaxMb} />
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-full border border-pearl/10 bg-white/[0.03] lg:block">
            <div className="ticker-track py-3">
              {[...motionLabels, ...motionLabels].map((label, index) => (
                <span className="ticker-pill" key={`${label}-${index}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 hidden gap-3 sm:grid-cols-3 lg:grid">
            <div className="hero-stat-card">
              <span className="hero-stat-value">Faster</span>
              <span className="hero-stat-label">first-second hook</span>
            </div>
            <div className="hero-stat-card">
              <span className="hero-stat-value">Cleaner</span>
              <span className="hero-stat-label">subtitle readability</span>
            </div>
            <div className="hero-stat-card">
              <span className="hero-stat-value">Better</span>
              <span className="hero-stat-label">watchability feel</span>
            </div>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <MagneticPanel>
              <InteractiveSurface className="rounded-lg">
            <div className="interactive-card interactive-lift rounded-lg border border-pearl/10 bg-[#111418] p-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-coral/20 bg-coral/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-coral">
                <CircleX className="h-4 w-4" />
                Before
              </div>
              <h2 className="mt-4 text-2xl font-black">Raw clip</h2>
              <div className="mt-4 overflow-hidden rounded-lg border border-pearl/10 bg-[#191d24]">
                <div className="video-stage video-stage-before relative aspect-video bg-[radial-gradient(circle_at_78%_20%,rgba(255,191,128,0.22),transparent_18%),linear-gradient(120deg,#2a221e_0%,#17181b_72%)]">
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_34%,rgba(0,0,0,0.18))]" />
                  <div className="video-stage-chip left-4 top-4">slow intro</div>
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.72))] px-4 pb-3 pt-8 text-xs font-bold text-white/88">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-0 w-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-white/92" />
                      00:00 / 00:58
                    </span>
                    <span className="text-white/50">no captions</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-pearl/62">Slow start, no captions, easy to scroll past.</p>
            </div>
              </InteractiveSurface>
            </MagneticPanel>

            <div className="hero-arrow hidden h-12 w-12 items-center justify-center rounded-full border border-pearl/10 bg-white/[0.03] text-mint lg:flex">
              <CheckCircle2 className="h-5 w-5" />
            </div>

            <MagneticPanel>
              <InteractiveSurface className="rounded-lg">
            <div className="interactive-card interactive-lift rounded-lg border border-pearl/10 bg-[#111418] p-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-xs font-black uppercase tracking-wide text-ink">
                <CheckCircle2 className="h-4 w-4" />
                After
              </div>
              <h2 className="mt-4 text-2xl font-black">Boosted clip</h2>
              <div className="mt-4 overflow-hidden rounded-lg border border-pearl/10 bg-[#191d24]">
                <div className="video-stage video-stage-after relative aspect-video bg-black">
                  <div className="absolute inset-x-0 top-0 h-[62%] bg-[radial-gradient(circle_at_78%_18%,rgba(66,246,177,0.18),transparent_18%),radial-gradient(circle_at_62%_22%,rgba(255,191,128,0.18),transparent_14%),linear-gradient(120deg,#2b211d_0%,#15191c_72%)]" />
                  <div className="absolute left-4 top-4 rounded-md bg-black/82 px-3 py-2 text-left text-[10px] font-black uppercase leading-4 text-mint">
                    stronger hook
                  </div>
                  <div className="video-stage-chip right-4 top-4 bg-mint text-ink">captions live</div>
                  <div className="absolute inset-x-6 top-[54%] -translate-y-1/2 text-center text-sm font-black leading-5 text-white md:text-base">
                    Most viewers decide
                    <br />
                    <span className="text-mint">in the first seconds</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,#1a2740_0%,#0c1218_100%)]" />
                  <div className="absolute inset-x-5 bottom-[17%] rounded-full bg-white px-4 py-2 text-center text-[11px] font-black tracking-wide text-black">
                    bigger captions that are easier to follow
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.76))] px-4 pb-3 pt-8 text-xs font-bold text-white/92">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-0 w-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-white/92" />
                      00:02 / 00:58
                    </span>
                    <span className="text-mint">captions on</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-pearl/62">Clearer opening, cleaner captions, and more watchable pacing.</p>
            </div>
              </InteractiveSurface>
            </MagneticPanel>
          </div>

        </div>
      </section>

      <SectionWrapper
        body="Tell the editor what feels off, then let it rework the clip without sending you into a full editing workflow."
        eyebrow="Edit by Chat"
        id="chat-editing"
        title="Fix the video by chatting with it"
      >
        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <MagneticPanel>
            <InteractiveSurface className="rounded-lg">
          <div className="interactive-card interactive-lift rounded-lg border border-pearl/10 bg-[#111418] p-5">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-2 text-sm font-bold text-pearl/76">
              <MessageSquareMore className="h-4 w-4 text-mint" />
              Chat editor
            </div>
            <div className="space-y-3">
              <div className="chat-bubble-left max-w-[85%] rounded-lg rounded-bl-sm bg-white/[0.04] px-4 py-3 text-sm leading-6 text-pearl/84">
                This intro is too slow. Make the first second hit harder.
              </div>
              <div className="chat-bubble-right ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-mint px-4 py-3 text-sm font-bold leading-6 text-ink">
                Got it. I&apos;ll add a stronger opening hook and tighten the start.
              </div>
              <div className="chat-bubble-left max-w-[85%] rounded-lg rounded-bl-sm bg-white/[0.04] px-4 py-3 text-sm leading-6 text-pearl/84">
                Also make the captions bigger and easier to read on mobile.
              </div>
              <div className="chat-bubble-right ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-mint px-4 py-3 text-sm font-bold leading-6 text-ink">
                Done. Bigger captions, better contrast, and cleaner pacing.
              </div>
            </div>
          </div>
            </InteractiveSurface>
          </MagneticPanel>

          <MagneticPanel>
            <InteractiveSurface className="rounded-lg">
          <div className="interactive-card interactive-lift rounded-lg border border-pearl/10 bg-[#111418] p-5">
            <div className="interactive-card rounded-lg border border-pearl/10 bg-[#15191f] p-4">
              <div className="video-stage video-stage-after relative aspect-video overflow-hidden rounded-lg border border-pearl/10 bg-black">
                <div className="absolute inset-x-0 top-0 h-[62%] bg-[radial-gradient(circle_at_78%_18%,rgba(66,246,177,0.18),transparent_18%),radial-gradient(circle_at_62%_22%,rgba(255,191,128,0.18),transparent_14%),linear-gradient(120deg,#2b211d_0%,#15191c_72%)]" />
                <div className="absolute left-4 top-4 rounded-md bg-black/82 px-3 py-2 text-left text-[10px] font-black uppercase leading-4 text-mint">
                  stronger hook
                  <br />
                  cleaner start
                </div>
                <div className="absolute inset-x-6 top-[58%] -translate-y-1/2 text-center text-sm font-black leading-5 text-white md:text-base">
                  Most viewers decide
                  <br />
                  <span className="text-mint">in the first seconds</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,#1a2740_0%,#0c1218_100%)]" />
                <div className="absolute inset-x-5 bottom-[17%] rounded-full bg-white px-4 py-2 text-center text-[11px] font-black tracking-wide text-black">
                  bigger captions that are easy to read on mobile
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.76))] px-4 pb-3 pt-8 text-xs font-bold text-white/92">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-0 w-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-white/92" />
                    00:02 / 00:58
                  </span>
                  <span className="text-mint">updated live</span>
                </div>
              </div>
            </div>
          </div>
            </InteractiveSurface>
          </MagneticPanel>
        </div>
      </SectionWrapper>

      <SectionWrapper eyebrow="Pricing" title="Start free. Upgrade when the better clips are working.">
        <div className="grid gap-5 lg:grid-cols-4">
          {plans.map((plan) => (
            <PricingCard key={plan.name} plan={plan} />
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper eyebrow="FAQ" title="Simple answers before the first upload.">
        <div className="grid gap-4">
          {faqs.map((faq) => (
            <MagneticPanel key={faq.question}>
              <InteractiveSurface className="rounded-lg">
                <Card className="faq-card interactive-card">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-black">{faq.question}</h3>
                    <span className="faq-icon">+</span>
                  </div>
                  <p className="mt-3 leading-7 text-pearl/64">{faq.answer}</p>
                </Card>
              </InteractiveSurface>
            </MagneticPanel>
          ))}
        </div>
      </SectionWrapper>

      <section className="px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <CtaBlock
            body="Upload a clip, boost the hook and subtitles, and get back a version people are more likely to watch."
            primaryHref="/"
            primaryLabel="Fix my clip"
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
            title="People are skipping your videos. Fix that."
          />
        </div>
      </section>
    </main>
  );
}
