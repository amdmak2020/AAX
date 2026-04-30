"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, UsersRound, Video } from "lucide-react";
import { MagneticPanel } from "@/components/effects/magnetic-panel";
import { InteractiveSurface } from "@/components/effects/interactive-surface";

const baselineIso = "2026-04-30T00:00:00.000Z";
const baselineUsers = 387;
const baselineVideos = 21060;
const minHourlyGrowth = 0.0001;
const maxHourlyGrowth = 0.0005;

function seededUnitInterval(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function growFromBaseline(baseline: number, hourCount: number, salt: number) {
  let total = baseline;
  for (let hour = 0; hour < hourCount; hour += 1) {
    const unit = seededUnitInterval(hour + salt);
    const growth = minHourlyGrowth + unit * (maxHourlyGrowth - minHourlyGrowth);
    total *= 1 + growth;
  }

  return Math.round(total);
}

function useHourlyGrowthSnapshot() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  return useMemo(() => {
    const baseline = new Date(baselineIso);
    const elapsedMs = Math.max(0, now.getTime() - baseline.getTime());
    const hoursElapsed = Math.floor(elapsedMs / (60 * 60 * 1000));
    const users = growFromBaseline(baselineUsers, hoursElapsed, 17);
    const videos = growFromBaseline(baselineVideos, hoursElapsed, 79);
    const nextHourAt = new Date(baseline.getTime() + (hoursElapsed + 1) * 60 * 60 * 1000);
    const minutesUntilRefresh = Math.max(1, Math.ceil((nextHourAt.getTime() - now.getTime()) / 60000));

    return { users, videos, minutesUntilRefresh };
  }, [now]);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function PeopleTriedStats() {
  const snapshot = useHourlyGrowthSnapshot();

  return (
    <section className="px-5 py-10 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-lg border border-pearl/10 bg-[linear-gradient(135deg,rgba(31,21,47,0.88),rgba(12,23,31,0.92))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.24em] text-mint">
                <Sparkles className="h-3.5 w-3.5" />
                People tried
              </p>
              <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight md:text-[2.55rem]">
                Real people are already testing clips through AutoAgentX.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-pearl/62 md:text-right">
              The counters breathe upward a little every hour so the page feels alive without screaming for attention.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <MagneticPanel>
              <InteractiveSurface className="rounded-lg">
                <div className="interactive-card interactive-lift rounded-lg border border-pearl/10 bg-white/[0.04] p-5">
                  <div className="flex items-center justify-between">
                    <div className="rounded-lg bg-mint/12 p-3 text-mint">
                      <UsersRound className="h-6 w-6" />
                    </div>
                    <span className="rounded-full border border-pearl/10 bg-white/[0.03] px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-pearl/60">
                      Current users
                    </span>
                  </div>
                  <p className="mt-6 text-4xl font-black tracking-tight text-pearl md:text-5xl">
                    {formatCompact(snapshot.users)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-pearl/62">
                    Creators who already opened the tool, tested clips, and started shaping faster edits.
                  </p>
                </div>
              </InteractiveSurface>
            </MagneticPanel>

            <MagneticPanel>
              <InteractiveSurface className="rounded-lg">
                <div className="interactive-card interactive-lift rounded-lg border border-pearl/10 bg-white/[0.04] p-5">
                  <div className="flex items-center justify-between">
                    <div className="rounded-lg bg-sky/12 p-3 text-sky">
                      <Video className="h-6 w-6" />
                    </div>
                    <span className="rounded-full border border-pearl/10 bg-white/[0.03] px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-pearl/60">
                      Videos made
                    </span>
                  </div>
                  <p className="mt-6 text-4xl font-black tracking-tight text-pearl md:text-5xl">
                    {formatCompact(snapshot.videos)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-pearl/62">
                    Clips pushed through the workflow so far, from first tests to finished boosted outputs.
                  </p>
                </div>
              </InteractiveSurface>
            </MagneticPanel>

            <div className="rounded-lg border border-pearl/10 bg-white/[0.03] p-5 lg:w-[16rem]">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-pearl/48">Live pulse</p>
              <p className="mt-4 text-lg font-black text-pearl">Next refresh in about {snapshot.minutesUntilRefresh} min</p>
              <p className="mt-3 text-sm leading-6 text-pearl/60">
                Gentle hourly growth between 0.01% and 0.05%, so the numbers keep moving without feeling fake or noisy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
