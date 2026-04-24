"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { JobStatus } from "@/lib/jobs";

export function JobAutoRefresh({ status }: { status: JobStatus }) {
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
