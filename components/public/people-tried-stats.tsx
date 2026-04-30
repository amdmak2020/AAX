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
const maxUsersSwing = 0.008;

function seededUnitInterval(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function growFromBaselineByMinute(baseline: number, minuteCount: number, salt: number) {
  let total = baseline;
  const minMinuteGrowth = minHourlyGrowth / 60;
  const maxMinuteGrowth = maxHourlyGrowth / 60;

  for (let minute = 0; minute < minuteCount; minute += 1) {
    const unit = seededUnitInterval(minute + salt);
    const growth = minMinuteGrowth + unit * (maxMinuteGrowth - minMinuteGrowth);
    total *= 1 + growth;
  }

  return Math.round(total);
}

function useLiveGrowthSnapshot() {
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
    const minutesElapsed = Math.floor(elapsedMs / 60000);
    const daysElapsed = elapsedMs / (24 * 60 * 60 * 1000);

    const usersBaseline = baselineUsers * 1.02 ** daysElapsed;
    const usersSwingSeed = seededUnitInterval(minutesElapsed + 17);
    const usersSwing = (usersSwingSeed * 2 - 1) * maxUsersSwing;
    const users = Math.max(1, Math.round(usersBaseline * (1 + usersSwing)));

    const videos = growFromBaselineByMinute(baselineVideos, minutesElapsed, 79);

    return { users, videos };
  }, [now]);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function PeopleTriedStats() {
  const snapshot = useLiveGrowthSnapshot();

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
                  <p className="people-hype-micro mt-4">live and shifting</p>
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
                  <p className="people-hype-micro mt-4">live and climbing</p>
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
