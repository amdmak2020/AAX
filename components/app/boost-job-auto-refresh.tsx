"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { BoostJobStatus } from "@/lib/boost-jobs";

export function BoostJobAutoRefresh({ status }: { status: BoostJobStatus }) {
  const router = useRouter();

  useEffect(() => {
    if (status === "completed" || status === "failed") {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [router, status]);

  return null;
}
