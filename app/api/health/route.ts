import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { logServerError } from "@/lib/secure-log";

export async function GET() {
  const headers = new Headers({
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json"
  });

  if (!isSupabaseConfigured()) {
    return new NextResponse(JSON.stringify({ ok: false, status: "degraded", database: "unconfigured" }), {
      status: 503,
      headers
    });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("profiles").select("id", { count: "exact", head: true }).limit(1);

    if (error) {
      logServerError("Health check database query failed", { reason: error.message });
      return new NextResponse(JSON.stringify({ ok: false, status: "degraded", database: "error" }), {
        status: 503,
        headers
      });
    }

    return new NextResponse(
      JSON.stringify({
        ok: true,
        status: "healthy",
        database: "ok",
        time: new Date().toISOString()
      }),
      {
        status: 200,
        headers
      }
    );
  } catch (error) {
    logServerError("Health check failed", { error });
    return new NextResponse(JSON.stringify({ ok: false, status: "degraded", database: "error" }), {
      status: 503,
      headers
    });
  }
}
