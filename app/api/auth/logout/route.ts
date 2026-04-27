import { NextResponse } from "next/server";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { verifyCsrfRequest } from "@/lib/csrf";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.redirect(new URL("/login?error=session-expired", request.url), { status: 303 });
  }

  await supabase.auth.signOut();
  await logAuditEvent({
    actorUserId: user?.id ?? null,
    targetType: "auth_user",
    targetId: user?.id ?? "unknown",
    action: "auth.logout",
    metadata: buildRequestAuditMetadata(request)
  });
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
