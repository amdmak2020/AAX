import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCsrfRequest } from "@/lib/csrf";
import { buildRequestAuditMetadata, logAuditEvent } from "@/lib/audit";
import { getUnexpectedFormFields, singleLineTextSchema } from "@/lib/validation";

const schema = z
  .object({
    reason: singleLineTextSchema({ max: 160, tooLongMessage: "Keep the reason under 160 characters." }).optional()
  })
  .strict();

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url), { status: 303 });
  }

  const formData = await request.formData();
  const csrfCheck = await verifyCsrfRequest(request, formData.get("csrfToken")?.toString() ?? null);
  if (!csrfCheck.ok) {
    return NextResponse.redirect(new URL("/app/settings?notice=csrf_failed", request.url), { status: 303 });
  }

  const unexpectedFields = getUnexpectedFormFields(formData, ["reason", "csrfToken"]);
  if (unexpectedFields.length > 0) {
    return NextResponse.redirect(new URL("/app/settings?notice=unexpected_fields", request.url), { status: 303 });
  }

  const parsed = schema.safeParse({
    reason: formData.get("reason")?.toString()
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/app/settings?notice=invalid_request", request.url), { status: 303 });
  }

  const admin = createSupabaseAdminClient();
  const reason = parsed.data.reason?.trim() || "User requested account deletion/export follow-up";

  await admin
    .from("profiles")
    .update({
      is_suspended: true,
      submissions_locked: true,
      billing_locked: true,
      suspended_reason: `Deletion requested: ${reason}`,
      updated_at: new Date().toISOString()
    })
    .eq("id", user.id);

  await logAuditEvent({
    actorUserId: user.id,
    targetType: "profile",
    targetId: user.id,
    action: "account.deletion_requested",
    metadata: buildRequestAuditMetadata(request, { reason })
  });

  return NextResponse.redirect(new URL("/app/settings?notice=deletion_requested", request.url), { status: 303 });
}
