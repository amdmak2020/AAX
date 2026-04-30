"use client";

import { useEffect, useMemo, useState } from "react";
import { UsersRound, Video } from "lucide-react";
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
    <section className="px-5 py-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        <InteractiveSurface className="rounded-lg">
          <div className="people-hype-shell rounded-lg border border-pearl/10 p-4 md:p-5">
            <div className="people-hype-orbit people-hype-orbit-one" aria-hidden="true" />
            <div className="people-hype-orbit people-hype-orbit-two" aria-hidden="true" />
            <div className="people-hype-ping people-hype-ping-one" aria-hidden="true" />
            <div className="people-hype-ping people-hype-ping-two" aria-hidden="true" />

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="people-hype-live">
                <span className="people-hype-live-dot" />
                live now
              </span>
              <span className="people-hype-flash">people clicking</span>
              <span className="people-hype-flash people-hype-flash-sky">clips boosting</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MagneticPanel>
                <InteractiveSurface className="rounded-lg">
                <div className="people-hype-card people-hype-card-mint interactive-card interactive-lift rounded-lg p-5 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="people-hype-icon text-mint">
                      <UsersRound className="h-7 w-7" />
                    </div>
                    <span className="people-hype-tag">users</span>
                  </div>
                  <p className="people-hype-value mt-6">{formatCompact(snapshot.users)}</p>
                  <p className="people-hype-copy mt-2">current users right now</p>
                  <p className="people-hype-micro mt-4">ticks upward again in {snapshot.minutesUntilRefresh} min</p>
                  <div className="people-hype-scan people-hype-scan-mint" aria-hidden="true" />
                </div>
                </InteractiveSurface>
              </MagneticPanel>

              <MagneticPanel>
                <InteractiveSurface className="rounded-lg">
                <div className="people-hype-card people-hype-card-sky interactive-card interactive-lift rounded-lg p-5 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="people-hype-icon people-hype-icon-sky text-sky">
                      <Video className="h-7 w-7" />
                    </div>
                    <span className="people-hype-tag">videos</span>
                  </div>
                  <p className="people-hype-value mt-6">{formatCompact(snapshot.videos)}</p>
                  <p className="people-hype-copy mt-2">videos made so far</p>
                  <p className="people-hype-micro mt-4">slow climb, fast dopamine</p>
                  <div className="people-hype-scan people-hype-scan-sky" aria-hidden="true" />
                </div>
                </InteractiveSurface>
              </MagneticPanel>
            </div>
          </div>
        </InteractiveSurface>
      </div>
    </section>
  );
}
