"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, UsersRound, Video, Zap } from "lucide-react";
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
    <section className="px-5 py-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="people-hype-shell rounded-lg border border-pearl/10 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="people-hype-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.24em] text-mint">
                <Sparkles className="h-3.5 w-3.5" />
                People tried
              </p>
              <h2 className="mt-4 max-w-4xl text-3xl font-black tracking-tight md:text-[2.7rem] lg:text-[3.15rem]">
                Already moving. Already posting.
              </h2>
            </div>
            <div className="people-hype-mini rounded-lg border border-pearl/10 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-pearl/48">Live pulse</p>
              <p className="mt-2 text-lg font-black text-pearl">refresh in {snapshot.minutesUntilRefresh} min</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_0.8fr]">
            <MagneticPanel>
              <InteractiveSurface className="rounded-lg">
                <div className="people-hype-card interactive-card interactive-lift rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <div className="people-hype-icon text-mint">
                      <UsersRound className="h-7 w-7" />
                    </div>
                    <span className="people-hype-tag">users</span>
                  </div>
                  <p className="people-hype-value mt-6">{formatCompact(snapshot.users)}</p>
                  <p className="people-hype-copy mt-2">testing clips right now</p>
                </div>
              </InteractiveSurface>
            </MagneticPanel>

            <MagneticPanel>
              <InteractiveSurface className="rounded-lg">
                <div className="people-hype-card interactive-card interactive-lift rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <div className="people-hype-icon people-hype-icon-sky text-sky">
                      <Video className="h-7 w-7" />
                    </div>
                    <span className="people-hype-tag">videos</span>
                  </div>
                  <p className="people-hype-value mt-6">{formatCompact(snapshot.videos)}</p>
                  <p className="people-hype-copy mt-2">boosted through the machine</p>
                </div>
              </InteractiveSurface>
            </MagneticPanel>

            <div className="people-hype-side rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="people-hype-icon people-hype-icon-coral text-coral">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-pearl/48">Tiny climb</p>
                  <p className="mt-1 text-xl font-black text-pearl">+0.01% to +0.05%</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-pearl/60">Slow growth. Fast vibe.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
