import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exchangeYouTubeCode, fetchYouTubeChannel, buildStoredYouTubeConnection, verifyYouTubeOAuthState } from "@/lib/youtube";
import { logServerError } from "@/lib/secure-log";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/app/settings?notice=youtube_failed", request.url), { status: 303 });
  }

  const verifiedState = verifyYouTubeOAuthState(state);
  if (!verifiedState) {
    return NextResponse.redirect(new URL("/app/settings?notice=youtube_failed", request.url), { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || user.id !== verifiedState.userId) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url), { status: 303 });
  }

  try {
    const tokenPayload = await exchangeYouTubeCode({ appUrl: url.origin, code });
    const channel = await fetchYouTubeChannel(tokenPayload.access_token);
    const admin = createSupabaseAdminClient();

    await admin.from("youtube_connections").upsert(
      buildStoredYouTubeConnection({
        userId: user.id,
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token ?? null,
        expiresIn: tokenPayload.expires_in,
        scope: tokenPayload.scope ?? null,
        channelId: channel.channelId,
        channelTitle: channel.channelTitle,
        channelThumbnailUrl: channel.channelThumbnailUrl
      }),
      { onConflict: "user_id" }
    );

    const returnTo = typeof verifiedState.returnTo === "string" && verifiedState.returnTo.startsWith("/") ? verifiedState.returnTo : "/app/settings";
    const destination = new URL(returnTo, request.url);
    destination.searchParams.set("notice", "youtube_connected");
    return NextResponse.redirect(destination, { status: 303 });
  } catch (error) {
    logServerError("YouTube OAuth callback failed", { error, userId: user.id });
    return NextResponse.redirect(new URL("/app/settings?notice=youtube_failed", request.url), { status: 303 });
  }
}
