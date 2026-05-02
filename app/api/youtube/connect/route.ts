import { NextResponse } from "next/server";
import { createYouTubeOAuthUrl, hasYouTubeConfig } from "@/lib/youtube";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url), { status: 303 });
  }

  if (!hasYouTubeConfig()) {
    return NextResponse.redirect(new URL("/app/settings?notice=youtube_failed", request.url), { status: 303 });
  }

  const url = new URL(request.url);
  const next = typeof url.searchParams.get("next") === "string" ? url.searchParams.get("next")! : "/app/settings";

  const redirectUrl = createYouTubeOAuthUrl({
    appUrl: url.origin,
    userId: user.id,
    returnTo: next.startsWith("/") ? next : "/app/settings"
  });

  return NextResponse.redirect(redirectUrl, { status: 303 });
}
