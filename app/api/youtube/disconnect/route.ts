import { NextResponse } from "next/server";
import { verifyCsrfRequest } from "@/lib/csrf";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.redirect(new URL("/app/settings?notice=csrf_failed", request.url), { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url), { status: 303 });
  }

  const admin = createSupabaseAdminClient();
  await admin.from("youtube_connections").delete().eq("user_id", user.id);
  return NextResponse.redirect(new URL("/app/settings?notice=youtube_disconnected", request.url), { status: 303 });
}
